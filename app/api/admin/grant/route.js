// Admin/manual grant. Does exactly what the Kajabi "offer granted" webhook does
// (create the buyer in 'exploring' and send the welcome email), but as a
// GET you can trigger by hand. Two real uses:
//   1. Demonstrate/test the new-student flow without wiring the Zap first.
//   2. Support: manually onboard someone whose webhook was missed, or comp an
//      account, without touching the database directly.
//
// Secret-protected with CRON_SECRET, same as the other operational endpoints.
//
// GET /api/admin/grant?secret=<CRON_SECRET>&email=you@example.com&name=Jane&tier=deploy

import { createOrGetGrantedBuyer } from '../../../../lib/buyers.js';
import { buildWelcomeEmailHTML } from '../../../../lib/email/renderWelcomeEmail.js';
import { sendBatchEmail } from '../../../../lib/email/resend.js';
import { resolveBaseUrl } from '../../../../lib/baseUrl.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;
  return url.searchParams.get('secret') === secret;
}

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const email = url.searchParams.get('email');
  if (!email) return Response.json({ error: 'pass ?email=' }, { status: 400 });
  const name = url.searchParams.get('name') || null;
  const tier = url.searchParams.get('tier') || 'enlist';

  let buyer;
  let created;
  try {
    ({ buyer, created } = await createOrGetGrantedBuyer({ email, name, tier }));
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }

  const base = resolveBaseUrl({ req });
  const setupUrl = `${base}/setup/${buyer.access_token}`;

  // Only email on first creation, so re-running is safe and never double-sends.
  let emailSent = null;
  if (created) {
    const { subject, html } = buildWelcomeEmailHTML(buyer, {
      setup: setupUrl,
      logo: base ? `${base}/brand/wda-logo.png` : '',
      base,
    });
    if (!process.env.RESEND_API_KEY) {
      emailSent = { skipped: 'RESEND_API_KEY not set' };
    } else {
      try {
        emailSent = await sendBatchEmail({ to: buyer.email, subject, html });
      } catch (err) {
        emailSent = { error: String(err?.message || err) };
      }
    }
  }

  return Response.json({
    ok: true,
    created,
    already_existed: !created,
    buyer_id: buyer.id,
    email: buyer.email,
    status: buyer.status,
    setup_url: setupUrl,
    email_sent: emailSent,
  });
}
