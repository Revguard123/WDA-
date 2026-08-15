import { getBuyerByToken } from '../../../../../lib/buyers.js';
import {
  getDiscoverySessionForBuyer,
  publicDiscoverySession,
  saveDiscoverySessionForBuyer,
} from '../../../../../lib/discoverySessions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validationResponse(error) {
  const details = error?.validation?.errors || [];
  return Response.json({ error: 'invalid discovery answers', details }, { status: 400 });
}

export async function GET(req, { params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });

  try {
    const session = await getDiscoverySessionForBuyer(buyer.id);
    return Response.json({ ok: true, session: publicDiscoverySession(session) });
  } catch {
    return Response.json({ error: 'could not load discovery session' }, { status: 500 });
  }
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

  try {
    const session = await saveDiscoverySessionForBuyer(buyer.id, {
      answers: body.answers || {},
      currentStep: body.current_step,
      status: body.status || 'in_progress',
      recommendations: body.recommendations,
      selectedRecommendation: body.selected_recommendation,
    });
    return Response.json({ ok: true, session: publicDiscoverySession(session) });
  } catch (err) {
    if (err?.validation) return validationResponse(err);
    if (err?.code === 'DISCOVERY_SESSION_TABLE_MISSING') {
      return Response.json({ error: 'discovery session storage is not available yet' }, { status: 503 });
    }
    return Response.json({ error: 'could not save discovery session' }, { status: 500 });
  }
}
