// Slice 6 magic-link re-entry. A buyer enters their email on /access (linked from
// the Kajabi product) and we email them their private, no-login link. Always
// returns the same neutral response so the endpoint never reveals who is or is
// not a customer.

import { getBuyerByEmail } from '../../../lib/buyers.js';
import { buildAccessEmailHTML } from '../../../lib/email/renderAccessEmail.js';
import { sendBatchEmail } from '../../../lib/email/resend.js';
import { resolveBaseUrl } from '../../../lib/baseUrl.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEUTRAL = {
  ok: true,
  message: 'If that email is on file, we just sent your private link. Check your inbox.',
};

export async function POST(req) {
  let email = '';
  try {
    const body = await req.json();
    email = String(body.email || '').trim();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  // Basic shape check; do not reveal anything about membership either way.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  try {
    const buyer = await getBuyerByEmail(email);
    if (buyer && process.env.RESEND_API_KEY) {
      const base = resolveBaseUrl({ req });
      const token = buyer.access_token;
      const { subject, html } = buildAccessEmailHTML(buyer, {
        contracts: `${base}/contracts/${token}`,
        targeting: `${base}/targeting/${token}`,
        setup: `${base}/setup/${token}`,
        logo: base ? `${base}/brand/wda-logo.png` : '',
        base,
      });
      try {
        await sendBatchEmail({ to: buyer.email, subject, html });
      } catch {
        // Swallow send errors so the response stays neutral and timing-safe.
      }
    }
  } catch {
    // Never surface lookup errors here; keep the response uniform.
  }

  return Response.json(NEUTRAL);
}
