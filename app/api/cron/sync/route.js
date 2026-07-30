// Slice 7: the daily SAM sync cron. Warms the opportunities cache across the
// active buyers' niches so the monthly batch build is fast and we never hammer
// the SAM API live during a batch. Vercel Cron sends
// Authorization: Bearer <CRON_SECRET> automatically.

import { listActiveBuyers } from '../../../../lib/buyers.js';
import { runEngineForNiche } from '../../../../lib/sam/engine.js';
import { upsertOpportunities } from '../../../../lib/opportunities.js';
import { sendOpsAlert } from '../../../../lib/alerts.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`;
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const ranAt = new Date().toISOString();
  try {
    const buyers = await listActiveBuyers();

    // De-dupe the work by (naics + state): many buyers can share a niche.
    const seen = new Set();
    const jobs = [];
    for (const b of buyers) {
      for (const naics of b.naics || []) {
        const key = `${naics}|${b.state || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push({ naics: [naics], state: b.state || null });
      }
    }

    let upserted = 0;
    const results = [];
    for (const niche of jobs) {
      try {
        // Cache broadly: every open contract in the niche, no set-aside filter and
        // no runway filter (curate is authoritative per buyer and per widen tier),
        // and skip description fetches for speed. Descriptions are resolved later,
        // for finalists only.
        const { stats } = await runEngineForNiche(niche, {
          apiKey: process.env.SAM_API_KEY,
          upsert: upsertOpportunities,
          enforceSetAside: false,
          resolveDescriptions: false,
          minRunwayDays: 0,
        });
        upserted += stats.upserted;
        results.push({ niche: `${niche.naics[0]}/${niche.state || 'any'}`, kept: stats.kept, upserted: stats.upserted });
      } catch (err) {
        results.push({ niche: `${niche.naics[0]}/${niche.state || 'any'}`, error: String(err?.message || err) });
      }
    }

    // The cache feeds every monthly batch, so a broadly failing sync (SAM quota,
    // key, or outage) is worth knowing about before batch day. Alert when every
    // niche failed, or more than half did, which points at a systemic problem
    // rather than one odd niche.
    const failed = results.filter((r) => r.error);
    if (jobs.length > 0 && (failed.length === jobs.length || failed.length > jobs.length / 2)) {
      await sendOpsAlert({
        subject: `Daily SAM sync: ${failed.length} of ${jobs.length} niches failed`,
        summary: `The cache-warming sync had widespread failures at ${ranAt}. This can starve the monthly batch. Check the SAM API key and daily quota.`,
        rows: failed.slice(0, 20).map((r) => `${r.niche}: ${r.error}`),
      });
    }

    return Response.json({ ok: true, ranAt, niches: jobs.length, upserted, results });
  } catch (err) {
    const message = String(err?.message || err);
    await sendOpsAlert({
      subject: 'Daily SAM sync FAILED to run',
      summary: `The daily cache-warming sync threw before completing at ${ranAt}. The opportunities cache may be stale for the next batch.`,
      rows: [message],
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
