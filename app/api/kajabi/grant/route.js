// Slice 6 inbound: the Kajabi grant webhook. When a customer buys the offer,
// Kajabi (via Zapier, or a native outgoing webhook) POSTs here. We create the
// buyer in 'exploring' and email them their private setup link. Buyers never
// log in; the tokenized link is their whole front door.
//
// Auth: a shared secret in the `x-webhook-secret` header, an `Authorization:
// Bearer <secret>` header, or a `?secret=` query param. Set KAJABI_WEBHOOK_SECRET
// in the environment and configure the same value on the Zapier/Kajabi side.
//
// Idempotent: a replayed or duplicate webhook returns the existing buyer and
// does not send a second welcome email.

import { createOrGetGrantedBuyer } from '../../../../lib/buyers.js';
import { buildWelcomeEmailHTML } from '../../../../lib/email/renderWelcomeEmail.js';
import { sendBatchEmail } from '../../../../lib/email/resend.js';
import { resolveBaseUrl } from '../../../../lib/baseUrl.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req, url) {
  const secret = process.env.KAJABI_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;
  if ((req.headers.get('x-webhook-secret') || '') === secret) return true;
  return url.searchParams.get('secret') === secret;
}

// Pull an email out of the various shapes Kajabi / Zapier might send.
function pickEmail(body) {
  return (
    body.email ||
    body.member_email ||
    body.customer_email ||
    body.member?.email ||
    body.customer?.email ||
    body.contact?.email ||
    null
  );
}

function pickName(body) {
  if (body.name) return body.name;
  const first = body.first_name || body.member?.first_name || body.customer?.first_name || '';
  const last = body.last_name || body.member?.last_name || body.customer?.last_name || '';
  const joined = `${first} ${last}`.trim();
  return joined || null;
}

// Map a Kajabi offer/product name to an internal tier. Default is 'enlist'
// (a single brief). An offer whose name mentions deploy / annual / 6 becomes
// 'deploy' (six briefs). Override directly with body.tier if you send it.
function pickTier(body) {
  if (body.tier === 'enlist' || body.tier === 'deploy') return body.tier;
  const offer = String(body.offer || body.offer_title || body.product || body.product_title || '').toLowerCase();
  if (/deploy|annual|6|six|year/.test(offer)) return 'deploy';
  return 'enlist';
}

export async function POST(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body = {};
  try {
    body = await req.json();
  } catch {
    // Some webhook senders post form-encoded; fall back to query params.
    body = Object.fromEntries(url.searchParams.entries());
  }

  const email = pickEmail(body);
  if (!email) return Response.json({ error: 'missing email' }, { status: 400 });
  const name = pickName(body);
  const tier = pickTier(body);

  let buyer;
  let created;
  try {
    ({ buyer, created } = await createOrGetGrantedBuyer({ email, name, tier }));
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }

  const base = resolveBaseUrl({ req });
  const setupUrl = `${base}/setup/${buyer.access_token}`;

  // Only email on first grant, so a replayed webhook does not double-send.
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
    buyer_id: buyer.id,
    email: buyer.email,
    tier: buyer.tier,
    setup_url: setupUrl,
    email_sent: emailSent,
  });
}
