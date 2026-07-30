// Slice 5: activation (the Go button). Token-authorized.
//   - set status=active, stamp activated_at, set next_batch_at one month out
//   - trigger the first batch immediately (Slices 2+3 via the shared pipeline)
//   - (FLAGGED) enroll in the Kajabi paid offer to start the trial clock (Slice 6)
//   - idempotent: pressing Go twice must not start two trials or two batches

import { getBuyerByToken } from '../../../../lib/buyers.js';
import { getServiceClient } from '../../../../lib/supabase.js';
import { runBatchForBuyer } from '../../../../lib/pipeline.js';
import { resolveBaseUrl } from '../../../../lib/baseUrl.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function oneMonthOut(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export async function POST(req, { params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });

  // Idempotency: only the first Go activates + sends the first batch.
  if (buyer.status !== 'exploring') {
    return Response.json({ ok: true, alreadyActive: true, status: buyer.status });
  }

  // A niche is required before activation, or the batch has nothing to pull.
  // Guard so a first-timer who reaches Go without setting up cannot burn their
  // cycle on an empty pull.
  const hasNiche = Array.isArray(buyer.naics) && buyer.naics.length > 0;
  if (!hasNiche) {
    return Response.json(
      { error: 'Set up your niche first, then come back and hit Go.', needsNiche: true },
      { status: 400 }
    );
  }

  const supabase = await getServiceClient();
  const now = new Date();

  // Claim activation atomically: flip exploring -> active only if still exploring.
  const { data: claimed, error: claimErr } = await supabase
    .from('buyers')
    .update({ status: 'active', activated_at: now.toISOString(), next_batch_at: oneMonthOut(now).toISOString() })
    .eq('id', buyer.id)
    .eq('status', 'exploring')
    .select('*')
    .maybeSingle();
  if (claimErr) return Response.json({ error: claimErr.message }, { status: 500 });
  if (!claimed) return Response.json({ ok: true, alreadyActive: true }); // lost the race

  // TODO Slice 6: enroll in the Kajabi paid offer here to start the trial clock.

  // First batch, now.
  const base = resolveBaseUrl({ req });
  try {
    const result = await runBatchForBuyer(claimed, { baseUrl: base, send: true });
    return Response.json({
      ok: true,
      activated: true,
      delivered: result.delivered,
      chosen: result.chosen.length,
      shortfall: result.stats.shortfall,
      sent: result.sent,
    });
  } catch (err) {
    return Response.json({ ok: true, activated: true, batchError: String(err?.message || err) }, { status: 200 });
  }
}
