// Daily cache warmer. Student activation/monthly searches have priority and
// do not inherit this run's opt-in request ceiling.
import { listActiveBuyers } from '../../../../lib/buyers.js';
import { upsertOpportunities } from '../../../../lib/opportunities.js';
import { sendOpsAlert } from '../../../../lib/alerts.js';
import { runDailySamSync, syncAlert, dailySyncRequestLimit } from '../../../../lib/sam/sync.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && (req.headers.get('authorization') || '') === `Bearer ${secret}`;
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const ranAt = new Date().toISOString();
  let stage = 'configuration';
  try {
    const maxRequests = process.env.SAM_DAILY_SYNC_MAX_REQUESTS;
    if (dailySyncRequestLimit(maxRequests) === 0) {
      return Response.json(await runDailySamSync([], { maxRequests, now: new Date(ranAt) }));
    }
    stage = 'buyer_lookup';
    const buyers = await listActiveBuyers();
    stage = 'cache_warming';
    const result = await runDailySamSync(buyers, {
      apiKey: process.env.SAM_API_KEY, upsert: upsertOpportunities, maxRequests,
      now: new Date(ranAt),
    });
    const alert = syncAlert(result);
    if (alert) await sendOpsAlert(alert);
    return Response.json(result);
  } catch {
    const message = 'Daily SAM cache warming could not complete; check configuration and server diagnostics.';
    console.error({ event: 'sam_sync_failed', ranAt, stage });
    await sendOpsAlert({ subject: 'Daily SAM sync FAILED to run', summary: message, rows: [ranAt] });
    return Response.json({ error: message }, { status: 500 });
  }
}
