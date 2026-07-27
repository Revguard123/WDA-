// Read-only Slice 1 live proof. Runs the SAM engine for a niche and returns the
// matches as JSON, without writing to the database. Needs only SAM_API_KEY and
// the shared secret, so it is the quickest way to confirm the engine pulls real
// live contracts on the deployed system.
//
// GET /api/engine/proof?secret=<CRON_SECRET>&naics=561720&state=SC&setAside=sdvosb
// (the secret may also be passed as an Authorization: Bearer header)
//
// This endpoint is a proof/diagnostic. It does not persist anything and can be
// removed once the scheduled pipeline is proven.

import { runEngineForNiche } from '../../../../lib/sam/engine.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;
  return url.searchParams.get('secret') === secret;
}

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.SAM_API_KEY) {
    return Response.json({ error: 'SAM_API_KEY is not set on this deployment' }, { status: 500 });
  }

  const niche = {
    naics: [url.searchParams.get('naics') || '561720'],
    state: url.searchParams.get('state') || 'SC',
    set_asides: [url.searchParams.get('setAside') || 'sdvosb'].filter(Boolean),
  };

  try {
    const { rows, stats, window } = await runEngineForNiche(niche, {
      apiKey: process.env.SAM_API_KEY,
      minRunwayDays: Number(url.searchParams.get('minRunwayDays')) || 14,
      resolveDescriptions: false, // keep the proof fast and light on the API
    });
    return Response.json({
      ok: true,
      niche,
      window,
      stats,
      contracts: rows.map((r) => ({
        title: r.title,
        agency: r.agency,
        set_aside: r.set_aside_type || 'full & open',
        deadline: r.response_deadline,
        est_value: r.est_value,
        sam_url: r.sam_url,
      })),
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
