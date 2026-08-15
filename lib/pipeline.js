// The one batch pipeline, shared by the manual proof endpoint, activation (the
// Go button), and the monthly cron. Given a buyer, it pulls, curates,
// deep-dives, renders the email, persists deliveries under the never-repeat
// guard, bumps the batch counter, and optionally sends.

import { runEngineForNiche, resolveDescriptionsForRows } from './sam/engine.js';
import { curateForBuyer } from './match/curate.js';
import { disqualifyContract, whyLine, deepDive } from './ai/claude.js';
import { buildBatchEmailHTML } from './email/renderBatchEmail.js';
import { sendBatchEmail } from './email/resend.js';
import { incrementBatchesSent } from './buyers.js';
import { persistBatch, getDeliveredKeys } from './deliveries.js';
import { resolveBaseUrl } from './baseUrl.js';
import { readCachedOpportunities, upsertOpportunities } from './opportunities.js';
import { normalizeSolicitationNum, procurementIdentity } from './procurementIdentity.js';

// A niche is served from the cache when it holds at least this many open
// candidates; below that we treat the cache as cold and pull live (which also
// warms it). Keeps a brand-new or thin niche working before the daily sync has
// run for it.
const MIN_CACHE_POOL = 12;

function logPipeline(event, fields = {}, logger = console) {
  logger.info?.({ event, ...fields });
}

function warnPipeline(event, fields = {}, logger = console) {
  logger.warn?.({ event, ...fields });
}

// Get a niche's candidate pool without descriptions. Cache-first (the daily sync
// warms the cache and this costs no SAM search quota); falls back to a live pull
// when the cache is cold. Descriptions are resolved later, for finalists only.
async function poolForNiche(niche, { now, forceLive = false, logger = console } = {}) {
  if (!forceLive) {
    const cached = await readCachedOpportunities(niche, { now });
    if (cached.length >= MIN_CACHE_POOL) return { rows: cached, source: 'cache', engineStats: null };
  }
  try {
    const { rows, stats } = await runEngineForNiche(niche, {
      apiKey: process.env.SAM_API_KEY,
      now,
      minRunwayDays: 0, // keep the pool broad; curate is authoritative on runway
      resolveDescriptions: false, // finalists only, later
      enforceSetAside: false, // curate's hard filter is authoritative on set-aside
      upsert: upsertOpportunities, // warm the cache on the way through
    });
    return { rows, source: 'live', engineStats: stats };
  } catch (err) {
    warnPipeline('batch_pool_error', { source: 'live', error: String(err?.message || err).slice(0, 180) }, logger);
    throw err;
  }
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
  const logger = options.logger || console;

  // Exclude already-delivered so batches backfill fresh contracts.
  const deliveredKeys = await getDeliveredKeys(buyer.id);
  const excludeNoticeIds = new Set(deliveredKeys.noticeIds || []);
  const excludeSolicitations = new Set(deliveredKeys.solicitations || []);

  const ladder = [
    { label: 'base', niche: buyer, runway: minRunwayDays },
    { label: 'runway', niche: buyer, runway: Math.min(WIDEN_RUNWAY_DAYS, minRunwayDays) },
  ];

  const now = new Date();
  const rowById = new Map();
  const chosen = [];
  const chosenIds = new Set();
  const chosenProcurementIdentities = new Set();
  const chosenSolicitations = new Set();
  let primaryStats = null;
  const widenedTiers = [];
  const resolveDescriptions = (candidates) =>
    resolveDescriptionsForRows(candidates, { apiKey: process.env.SAM_API_KEY });

  for (const tier of ladder) {
    if (chosen.length >= n) break;
    // Skip the runway tier when it would not actually loosen anything.
    if (tier.label === 'runway' && tier.runway >= minRunwayDays) continue;

    const need = n - chosen.length;
    const { rows, source, engineStats } = await poolForNiche(tier.niche, { now, logger });
    logPipeline('batch_pool_ready', {
      buyerId: buyer.id,
      tier: tier.label,
      source,
      rows: rows.length,
      engineStats: engineStats ? {
        rawPulled: engineStats.rawPulled,
        afterDedupe: engineStats.afterDedupe,
        droppedGeography: engineStats.droppedGeography,
        droppedSetAside: engineStats.droppedSetAside,
        droppedClosed: engineStats.droppedClosed,
        droppedTightRunway: engineStats.droppedTightRunway,
        kept: engineStats.kept,
      } : null,
    }, logger);
    for (const r of rows) if (!rowById.has(r.notice_id)) rowById.set(r.notice_id, r);

    const { chosen: tierChosen, stats } = await curateForBuyer(
      rows,
      tier.niche,
      { disqualify: disqualifyContract, writeWhyLine: whyLine, resolveDescriptions },
      {
        now,
        minRunwayDays: tier.runway,
        n: need,
        maxCandidates: 12,
        // Exclude both prior deliveries and anything already chosen this cycle.
        deliveredNoticeIds: new Set([...excludeNoticeIds, ...chosenIds]),
        deliveredSolicitations: new Set([...excludeSolicitations, ...chosenSolicitations]),
      },
    );

    if (tier.label === 'base') primaryStats = stats;
    logPipeline('batch_tier_curated', {
      buyerId: buyer.id,
      tier: tier.label,
      input: stats.input,
      afterHardFilters: stats.afterHardFilters,
      hardFilter: stats.hardFilter,
      procurementDedupe: stats.procurementDedupe ? {
        input: stats.procurementDedupe.input,
        output: stats.procurementDedupe.output,
        removed: stats.procurementDedupe.removed,
        duplicateGroupCount: stats.procurementDedupe.duplicateGroups?.length || 0,
        duplicateGroups: (stats.procurementDedupe.duplicateGroups || []).slice(0, 5),
      } : null,
      aiCandidates: stats.aiCandidates,
      disqualifiedByAI: stats.disqualifiedByAI,
      needsValidationByAI: stats.needsValidationByAI,
      eligible: stats.eligible,
      chosen: stats.chosen,
      shortfall: stats.shortfall,
      aiDecisionBreakdown: stats.aiDecisionBreakdown,
      aiRejectionCategories: stats.aiRejectionCategories,
      aiValidationCategories: stats.aiValidationCategories,
    }, logger);

    let added = 0;
    for (const c of tierChosen) {
      const identity = c.procurement_identity || procurementIdentity(c);
      if (chosenIds.has(c.notice_id) || (identity && chosenProcurementIdentities.has(identity))) continue;
      chosenIds.add(c.notice_id);
      if (identity) chosenProcurementIdentities.add(identity);
      const soli = normalizeSolicitationNum(c.solicitation_num);
      if (soli) chosenSolicitations.add(soli);
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
  const base = resolveBaseUrl({ explicit: baseUrl });
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
    solicitation_num: c.solicitation_num || rowById.get(c.notice_id)?.solicitation_num || null,
    why_line: c.why_line,
    deep_dive_text: c.deep_dive_text,
  }));
  let delivered;
  try {
    delivered = await persistBatch({ buyerId: buyer.id, batchMonth, opportunityRows, items });
  } catch (err) {
    warnPipeline('batch_persist_error', { buyerId: buyer.id, batchMonth, error: String(err?.message || err).slice(0, 180) }, logger);
    throw err;
  }
  logPipeline('batch_persisted', {
    buyerId: buyer.id,
    batchMonth,
    chosen: chosen.length,
    inserted: delivered.inserted.length,
    skipped: delivered.skipped.length,
  }, logger);

  let batch = null;
  if (delivered.inserted.length > 0) batch = await incrementBatchesSent(buyer.id);

  let sent = null;
  if (send && delivered.inserted.length > 0) {
    if (!process.env.RESEND_API_KEY) sent = { skipped: 'RESEND_API_KEY not set' };
    else sent = await sendBatchEmail({ to: buyer.email, subject, html });
  }

  return { chosen, stats, delivered, batch, subject, html, sent };
}
