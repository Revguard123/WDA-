// Slice 7: the monthly batch cron. For each active buyer whose next_batch_at is
// due and who still has batches owed, run the batch pipeline (send) and move
// next_batch_at one month out. Vercel Cron authenticates by sending
// Authorization: Bearer <CRON_SECRET> automatically when CRON_SECRET is set.

import { listActiveBuyersDue, setNextBatchAt } from '../../../../lib/buyers.js';
import { runBatchForBuyer } from '../../../../lib/pipeline.js';
import { resolveBaseUrl } from '../../../../lib/baseUrl.js';
import { sendOpsAlert } from '../../../../lib/alerts.js';

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

export function shouldAdvanceMonthlySchedule(delivered) {
  return Number(delivered || 0) > 0;
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  try {
    const base = resolveBaseUrl({ req });
    const due = await listActiveBuyersDue(now);

    const results = [];
    for (const buyer of due) {
      try {
        const r = await runBatchForBuyer(buyer, { baseUrl: base, send: true });

        const delivered = r.delivered.inserted.length;

        // Only advance the monthly schedule when a batch was actually delivered.
        // Zero-result buyers remain due so the daily cron can retry them after
        // the opportunity pool refreshes.
        if (shouldAdvanceMonthlySchedule(delivered)) {
          await setNextBatchAt(buyer.id, oneMonthOut(now));
        }

        results.push({
          buyer_id: buyer.id,
          delivered,
          shortfall: r.stats.shortfall,
          sent: !!r.sent && !r.sent.skipped,
          batchStatus: r.batch?.status || null,
        });
      } catch (err) {
        results.push({ buyer_id: buyer.id, error: String(err?.message || err) });
      }
    }

    // A buyer needs attention if their batch errored, delivered nothing, or the
    // email did not go out. Alert on any of these so a silent miss never stands.
    const problems = results.filter((r) => r.error || r.delivered === 0 || r.sent === false);
    if (problems.length) {
      await sendOpsAlert({
        subject: `Monthly cron: ${problems.length} of ${results.length} buyer(s) need attention`,
        summary: `Ran ${results.length} due buyer(s) at ${now.toISOString()}. ${problems.length} errored, delivered zero contracts, or failed to send.`,
        rows: problems.map((r) =>
          r.error
            ? `buyer ${r.buyer_id}: ERROR ${r.error}`
            : r.delivered === 0
              ? `buyer ${r.buyer_id}: delivered 0 (shortfall ${r.shortfall})`
              : `buyer ${r.buyer_id}: email not sent (delivered ${r.delivered})`
        ),
      });
    }

    return Response.json({ ok: true, ranAt: now.toISOString(), dueCount: due.length, results });
  } catch (err) {
    // Total run failure (e.g. the buyer query itself threw). Alert, then surface.
    const message = String(err?.message || err);
    await sendOpsAlert({
      subject: 'Monthly cron FAILED to run',
      summary: `The monthly batch cron threw before completing at ${now.toISOString()}. No buyers may have been processed.`,
      rows: [message],
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
