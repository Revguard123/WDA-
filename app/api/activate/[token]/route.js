// Slice 5: activation (the Go button). Token-authorized.
//   - set status=active, stamp activated_at, set next_batch_at one month out
//   - trigger the first batch immediately (Slices 2+3 via the shared pipeline)
//   - (FLAGGED) enroll in the Kajabi paid offer to start the trial clock (Slice 6)
//   - idempotent: pressing Go twice must not start two trials or two batches

import { activateBuyer } from '../../../../lib/activation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req, { params }) {
  const { token } = params;
  const result = await activateBuyer({ token, req });
  return Response.json(result.body, { status: result.status });
}
