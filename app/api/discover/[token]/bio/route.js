import { getBuyerByToken } from '../../../../../lib/buyers.js';
import { getDiscoverySessionForBuyer, saveDiscoverySessionForBuyer } from '../../../../../lib/discoverySessions.js';
import { normalizeDiscoveryAnswers } from '../../../../../lib/playbook/index.js';
import { extractDiscoveryBio } from '../../../../../lib/ai/claude.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const buyer = await getBuyerByToken(params.token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }
  const bio = String(body.bio || '').trim();
  if (!bio || bio.length > 900) return Response.json({ error: 'Enter a short description of up to 900 characters.' }, { status: 400 });
  try {
    const extracted = await extractDiscoveryBio(bio);
    const session = await getDiscoverySessionForBuyer(buyer.id);
    const answers = normalizeDiscoveryAnswers({ ...(session?.answers || {}), ...extracted });
    await saveDiscoverySessionForBuyer(buyer.id, { answers, currentStep: 2, status: 'in_progress' });
    return Response.json({ ok: true, answers });
  } catch (error) {
    console.error({ event: 'playbook_discovery_debug', stage: 'bio_extraction_failed', error_name: error?.name || 'Error', error_message: String(error?.message || '').slice(0, 160) });
    return Response.json({ error: 'Could not read that short description right now. You can use the guided questions instead.' }, { status: 500 });
  }
}
