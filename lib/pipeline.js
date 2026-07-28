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

// Run one batch for a buyer.
// options: { baseUrl, send, minRunwayDays, n }
export async function runBatchForBuyer(buyer, options = {}) {
  const { baseUrl, send = false, minRunwayDays = 14, n = 5 } = options;

  // Exclude already-delivered so batches backfill fresh contracts.
  const deliveredKeys = await getDeliveredKeys(buyer.id);

  const { rows } = await runEngineForNiche(buyer, {
    apiKey: process.env.SAM_API_KEY,
    minRunwayDays,
    resolveDescriptions: true,
  });

  const { chosen, stats } = await curateForBuyer(
    rows,
    buyer,
    { disqualify: disqualifyContract, writeWhyLine: whyLine },
    {
      minRunwayDays,
      n,
      maxCandidates: 12,
      deliveredNoticeIds: deliveredKeys.noticeIds,
      deliveredSolicitations: deliveredKeys.solicitations,
    },
  );

  // Deep-dive per chosen contract.
  const rowById = new Map(rows.map((r) => [r.notice_id, r]));
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
  };
  const { subject, html } = buildBatchEmailHTML(buyer, chosen, links, { shortfall: stats.shortfall });

  // Persist under the never-repeat guard, then bump the batch counter.
  const batchMonth = (buyer.batches_sent || 0) + 1;
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
