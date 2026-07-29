// Slice 7: the daily SAM sync cron. Warms the opportunities cache across the
// active buyers' niches so the monthly batch build is fast and we never hammer
// the SAM API live during a batch. Vercel Cron sends
// Authorization: Bearer <CRON_SECRET> automatically.

import { listActiveBuyers } from '../../../../lib/buyers.js';
import { runEngineForNiche } from '../../../../lib/sam/engine.js';
import { upsertOpportunities } from '../../../../lib/opportunities.js';

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
      // Cache broadly: no set-aside enforcement, skip description fetches for speed.
      const { stats } = await runEngineForNiche(niche, {
        apiKey: process.env.SAM_API_KEY,
        upsert: upsertOpportunities,
        enforceSetAside: false,
        resolveDescriptions: false,
      });
      upserted += stats.upserted;
      results.push({ niche: `${niche.naics[0]}/${niche.state || 'any'}`, kept: stats.kept, upserted: stats.upserted });
    } catch (err) {
      results.push({ niche: `${niche.naics[0]}/${niche.state || 'any'}`, error: String(err?.message || err) });
    }
  }

  return Response.json({ ok: true, ranAt: new Date().toISOString(), niches: jobs.length, upserted, results });
}
