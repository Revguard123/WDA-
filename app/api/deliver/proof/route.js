// Slice 3/4 live proof/trigger. Finds-or-creates a buyer and runs the shared
// batch pipeline (pull -> curate -> deep-dive -> render -> persist with the
// never-repeat guard -> increment -> optional send). Run it twice with the same
// buyer to see repeats excluded.
//
// GET /api/deliver/proof?secret=<CRON_SECRET>&naics=236220&state=VA&setAside=sb
//     &keywords=construction,renovation,repair&buyerEmail=you@example.com&send=0

import { findOrCreateBuyer } from '../../../../lib/buyers.js';
import { runBatchForBuyer } from '../../../../lib/pipeline.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;
  return url.searchParams.get('secret') === secret;
}

const DEFAULT_KEYWORDS = ['construction', 'renovation', 'building', 'repair', 'facility', 'alteration'];

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  for (const k of ['SAM_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[k]) return Response.json({ error: `${k} not set` }, { status: 500 });
  }

  const setAside = url.searchParams.get('setAside');
  const keywordsParam = url.searchParams.get('keywords');
  const minRunwayDays = Number(url.searchParams.get('minRunwayDays')) || 14;
  const buyerEmail = url.searchParams.get('buyerEmail') || 'demo-buyer@wardogsacademy.com';
  const wantSend = url.searchParams.get('send') === '1';

  const niche = {
    naics: [url.searchParams.get('naics') || '236220'],
    state: url.searchParams.get('state') || 'VA',
    set_asides: setAside ? [setAside] : ['sb'],
    keywords: keywordsParam ? keywordsParam.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_KEYWORDS,
  };

  try {
    const buyer = await findOrCreateBuyer({ email: buyerEmail, name: url.searchParams.get('name'), niche });
    const result = await runBatchForBuyer(buyer, { baseUrl: url.origin, send: wantSend, minRunwayDays });

    return Response.json({
      ok: true,
      buyer: { id: buyer.id, email: buyer.email, access_token: buyer.access_token },
      curationStats: result.stats,
      chosen: result.chosen.map((c) => ({ notice_id: c.notice_id, title: c.title, why_line: c.why_line, deep_dive_chars: (c.deep_dive_text || '').length })),
      delivered: result.delivered,
      batch: result.batch,
      emailSubject: result.subject,
      emailHtml: result.html,
      sent: result.sent,
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
