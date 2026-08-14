import { getBuyerByToken, updateBuyerProfile } from '../../../../../lib/buyers.js';
import {
  getDiscoverySessionForBuyer,
  publicDiscoverySession,
  saveDiscoverySessionForBuyer,
} from '../../../../../lib/discoverySessions.js';
import { resolveRecommendationForTargeting } from '../../../../../lib/playbook/recommendationEngine.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const session = await getDiscoverySessionForBuyer(buyer.id);
    const recommendations = Array.isArray(session?.recommendations) ? session.recommendations : [];
    const recommendation = recommendations.find((r) => r.subindustry_id === body.subindustry_id);
    if (!recommendation) return Response.json({ error: 'recommendation not found' }, { status: 404 });

    const targeting = resolveRecommendationForTargeting(recommendation, session.answers);
    const updated = await updateBuyerProfile(token, targeting);
    const saved = await saveDiscoverySessionForBuyer(buyer.id, {
      answers: session.answers,
      currentStep: session.current_step,
      status: 'selected',
      recommendations,
      selectedRecommendation: recommendation,
    });

    return Response.json({
      ok: true,
      selected: recommendation,
      session: publicDiscoverySession(saved),
      profile: {
        naics: updated.naics,
        set_asides: updated.set_asides,
        state: updated.state,
      },
    });
  } catch {
    return Response.json({ error: 'Could not apply this recommendation safely.' }, { status: 400 });
  }
}
