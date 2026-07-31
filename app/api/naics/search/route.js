// NAICS industry search. The niche form posts a plain-English description of the
// buyer's work ("office cleaning", "commercial construction") and gets back real
// NAICS codes to pick from, so nobody needs to know what a NAICS code is.

import { suggestNaics } from '../../../../lib/ai/claude.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let query = '';
  try {
    query = String((await req.json()).query || '').trim();
  } catch {
    return Response.json({ matches: [] }, { status: 400 });
  }
  if (!query) return Response.json({ matches: [] });
  if (query.length > 200) query = query.slice(0, 200);

  try {
    const matches = await suggestNaics(query);
    return Response.json({ matches });
  } catch (err) {
    return Response.json({ error: String(err?.message || err), matches: [] }, { status: 500 });
  }
}
