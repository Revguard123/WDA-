// Niche discovery. A buyer who does not yet know what to go after answers a few
// plain-English questions; we hand that to the AI coach and get back up to 3
// winnable niches, each with a real NAICS code and a short reason. Token-gated,
// no login. This NEVER writes to the buyer or pulls contracts: it only returns
// suggestions. Applying one happens later via /api/profile.

import { getBuyerByToken } from '../../../../lib/buyers.js';
import { discoverNiches } from '../../../../lib/ai/claude.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(v, max = 800) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function POST(req, { params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const setAsides = Array.isArray(body.setAsides)
    ? body.setAsides.map((s) => String(s).trim()).filter(Boolean).slice(0, 10)
    : [];

  const profile = {
    background: clean(body.background),
    setAsides,
    state: clean(body.state, 2).toUpperCase(),
    interests: clean(body.interests),
  };

  try {
    const recommendations = await discoverNiches(profile);
    return Response.json({ recommendations });
  } catch (err) {
    return Response.json({ error: String(err?.message || err), recommendations: [] }, { status: 500 });
  }
}
