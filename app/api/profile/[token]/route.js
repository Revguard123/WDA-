// Save a buyer's niche profile. Token-authorized, no login. Saving NEVER
// triggers a contract pull (Rule 2): it only writes the profile and affects the
// next scheduled batch.

import { getBuyerByToken, updateBuyerProfile } from '../../../../lib/buyers.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseList(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function PUT(req, { params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const updated = await updateBuyerProfile(token, {
    naics: parseList(body.naics),
    keywords: parseList(body.keywords),
    set_asides: parseList(body.set_asides),
    state: body.state,
    size_min: body.size_min,
    size_max: body.size_max,
    name: body.name,
  });

  return Response.json({
    ok: true,
    profile: {
      naics: updated.naics,
      keywords: updated.keywords,
      set_asides: updated.set_asides,
      state: updated.state,
      size_min: updated.size_min,
      size_max: updated.size_max,
      status: updated.status,
    },
  });
}
