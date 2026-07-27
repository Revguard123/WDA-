// Slice 1 server surface: run the SAM engine for a niche and cache the matches.
// Guarded by CRON_SECRET so it cannot be called publicly. This is the manual
// proof/trigger endpoint; the scheduled daily sync (Slice 7) reuses runEngineForNiche.
//
// POST /api/engine/sync
//   Authorization: Bearer <CRON_SECRET>
//   body: { naics: string[], set_asides?: string[], state?: string,
//           keywords?: string[], minRunwayDays?, lookbackDays? }

import { runEngineForNiche } from '../../../../lib/sam/engine.js';
import { upsertOpportunities } from '../../../../lib/opportunities.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

export async function POST(req) {
  if (!authorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let niche;
  try {
    niche = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(niche?.naics) || niche.naics.length === 0) {
    return Response.json({ error: 'naics[] is required' }, { status: 400 });
  }

  try {
    const { rows, stats, window } = await runEngineForNiche(niche, {
      apiKey: process.env.SAM_API_KEY,
      upsert: upsertOpportunities,
      minRunwayDays: niche.minRunwayDays ?? 14,
      lookbackDays: niche.lookbackDays ?? 364,
    });
    return Response.json({
      ok: true,
      window,
      stats,
      sample: rows.slice(0, 10).map((r) => ({
        notice_id: r.notice_id,
        title: r.title,
        agency: r.agency,
        set_aside_type: r.set_aside_type,
        response_deadline: r.response_deadline,
        sam_url: r.sam_url,
      })),
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
