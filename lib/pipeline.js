// The one batch pipeline, shared by the manual proof endpoint, activation (the
// Go button), and the monthly cron. Given a buyer, it pulls, curates,
// deep-dives, renders the email, persists deliveries under the never-repeat
// guard, bumps the batch counter, and optionally sends.

import { runEngineForNiche } from './sam/engine.js';
import { curateForBuyer } from './match/curate.js';
import { disqualifyContract, whyLine, deepDive } from './ai/claude.js';
import { buildBatchEmailHTML } from './email/renderBatchEmail.js';
import { sendBatchEmail } from './email/resend.js';
import { incrementBatchesSent } from './buyers.js';
import { persistBatch, getDeliveredKeys } from './deliveries.js';

function resolveBaseUrl(explicit) {
  if (explicit) return explicit;
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return '';
}

// The auto-widen ladder. If a niche is too tight to fill the brief, we relax
// the softest filters in order (never the eligibility ones): first shorten the
// runway requirement, then drop the geography restriction. Each tier is only
// attempted if we are still short after the previous one, so a healthy niche
// pays for exactly one pull.
const WIDEN_RUNWAY_DAYS = 5;

// Run one batch for a buyer.
// options: { baseUrl, send, minRunwayDays, n }
export async function runBatchForBuyer(buyer, options = {}) {
  const { baseUrl, send = false, minRunwayDays = 14, n = 5 } = options;

  // Exclude already-delivered so batches backfill fresh contracts.
  const deliveredKeys = await getDeliveredKeys(buyer.id);
  const excludeNoticeIds = new Set(deliveredKeys.noticeIds || []);
  const excludeSolicitations = new Set(deliveredKeys.solicitations || []);

  const ladder = [
    { label: 'base', niche: buyer, runway: minRunwayDays },
    { label: 'runway', niche: buyer, runway: Math.min(WIDEN_RUNWAY_DAYS, minRunwayDays) },
    { label: 'nationwide', niche: { ...buyer, state: null }, runway: Math.min(WIDEN_RUNWAY_DAYS, minRunwayDays) },
  ];

  const rowById = new Map();
  const chosen = [];
  const chosenIds = new Set();
  let primaryStats = null;
  const widenedTiers = [];

  for (const tier of ladder) {
    if (chosen.length >= n) break;
    // Nothing to widen geographically if the buyer never set a state.
    if (tier.label === 'nationwide' && !buyer.state) continue;
    // Skip the runway tier when it would not actually loosen anything.
    if (tier.label === 'runway' && tier.runway >= minRunwayDays) continue;

    const need = n - chosen.length;
    const { rows } = await runEngineForNiche(tier.niche, {
      apiKey: process.env.SAM_API_KEY,
      minRunwayDays: tier.runway,
      resolveDescriptions: true,
    });
    for (const r of rows) if (!rowById.has(r.notice_id)) rowById.set(r.notice_id, r);

    const { chosen: tierChosen, stats } = await curateForBuyer(
      rows,
      tier.niche,
      { disqualify: disqualifyContract, writeWhyLine: whyLine },
      {
        minRunwayDays: tier.runway,
        n: need,
        maxCandidates: 12,
        // Exclude both prior deliveries and anything already chosen this cycle.
        deliveredNoticeIds: new Set([...excludeNoticeIds, ...chosenIds]),
        deliveredSolicitations: excludeSolicitations,
      },
    );

    if (tier.label === 'base') primaryStats = stats;

    let added = 0;
    for (const c of tierChosen) {
      if (chosenIds.has(c.notice_id)) continue;
      chosenIds.add(c.notice_id);
      chosen.push(c);
      added += 1;
      if (chosen.length >= n) break;
    }
    if (tier.label !== 'base' && added > 0) widenedTiers.push({ tier: tier.label, added });
  }

  // Funnel numbers come from the primary (on-target) pull; the delivered count
  // and shortfall reflect the full accumulated result.
  const stats = primaryStats || { input: 0, afterHardFilters: 0, disqualifiedByAI: 0, eligible: 0 };
  stats.chosen = chosen.length;
  stats.shortfall = Math.max(0, n - chosen.length);
  stats.widened = widenedTiers.length
    ? { added: widenedTiers.reduce((s, t) => s + t.added, 0), tiers: widenedTiers }
    : null;

  // Deep-dive per chosen contract.
  await Promise.all(
    chosen.map(async (c) => {
      try {
        c.deep_dive_text = await deepDive(rowById.get(c.notice_id) || c, buyer);
      } catch {
        c.deep_dive_text = '';
      }
    }),
  );

  // Tokenized links + branded email.
  const base = resolveBaseUrl(baseUrl);
  const token = buyer.access_token;
  const links = {
    deepDive: (nid) => `${base}/d/${token}/${nid}`,
    targeting: `${base}/targeting/${token}`,
    allContracts: `${base}/contracts/${token}`,
    logo: base ? `${base}/brand/wda-logo.png` : '',
    base,
  };
  const batchMonth = (buyer.batches_sent || 0) + 1;
  const periodLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const { subject, html } = buildBatchEmailHTML(buyer, chosen, links, {
    shortfall: stats.shortfall,
    stats,
    cycle: batchMonth,
    periodLabel,
    widened: stats.widened || null,
  });

  // Persist under the never-repeat guard, then bump the batch counter.
  const opportunityRows = chosen.map((c) => rowById.get(c.notice_id)).filter(Boolean);
  const items = chosen.map((c) => ({
    notice_id: c.notice_id,
    solicitation_num: rowById.get(c.notice_id)?.solicitation_num || null,
    why_line: c.why_line,
    deep_dive_text: c.deep_dive_text,
  }));
  const delivered = await persistBatch({ buyerId: buyer.id, batchMonth, opportunityRows, items });

  let batch = null;
  if (delivered.inserted.length > 0) batch = await incrementBatchesSent(buyer.id);

  let sent = null;
  if (send && delivered.inserted.length > 0) {
    if (!process.env.RESEND_API_KEY) sent = { skipped: 'RESEND_API_KEY not set' };
    else sent = await sendBatchEmail({ to: buyer.email, subject, html });
  }

  return { chosen, stats, delivered, batch, subject, html, sent };
}
