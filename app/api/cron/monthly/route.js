// Slice 7: the monthly batch cron. For each active buyer whose next_batch_at is
// due and who still has batches owed, run the batch pipeline (send) and move
// next_batch_at one month out. Vercel Cron authenticates by sending
// Authorization: Bearer <CRON_SECRET> automatically when CRON_SECRET is set.

import { listActiveBuyersDue, setNextBatchAt } from '../../../../lib/buyers.js';
import { runBatchForBuyer } from '../../../../lib/pipeline.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`;
}

function oneMonthOut(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const base = process.env.APP_BASE_URL || new URL(req.url).origin;
  const due = await listActiveBuyersDue(now);

  const results = [];
  for (const buyer of due) {
    try {
      const r = await runBatchForBuyer(buyer, { baseUrl: base, send: true });
      // Advance the schedule regardless of how many contracts cleared this cycle.
      await setNextBatchAt(buyer.id, oneMonthOut(now));
      results.push({
        buyer_id: buyer.id,
        delivered: r.delivered.inserted.length,
        shortfall: r.stats.shortfall,
        sent: !!r.sent && !r.sent.skipped,
        batchStatus: r.batch?.status || null,
      });
    } catch (err) {
      results.push({ buyer_id: buyer.id, error: String(err?.message || err) });
    }
  }

  return Response.json({ ok: true, ranAt: now.toISOString(), dueCount: due.length, results });
}
