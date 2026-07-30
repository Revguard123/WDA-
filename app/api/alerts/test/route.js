// Test hook for ops alerting. Sends one sample alert so you can confirm alerts
// arrive and land in the inbox (not spam). Secret-protected with CRON_SECRET,
// same as the other operational endpoints.
//
// GET /api/alerts/test?secret=<CRON_SECRET>&to=you@example.com
//   to  optional; defaults to ALERT_EMAIL. One of the two must be present.

import { sendOpsAlert, DEFAULT_ALERT_TO } from '../../../../lib/alerts.js';

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

  // Recipient precedence mirrors the real alert path: explicit ?to=, then
  // ALERT_EMAIL, then the built-in default (handled inside sendOpsAlert). A bare
  // call therefore exercises exactly what a real cron alert would send.
  const to = url.searchParams.get('to') || undefined;

  const result = await sendOpsAlert({
    to,
    subject: 'Test alert (this is only a test)',
    summary:
      'If you are reading this, ops alerting is working. Real alerts fire when a monthly batch errors, a buyer gets zero contracts, an email fails to send, or a cron run fails.',
    rows: [
      'example: buyer 00000000-0000-0000-0000-000000000000: delivered 0 (shortfall 5)',
      'example: daily SAM sync: 12 of 12 niches failed',
    ],
  });

  const resolvedTo = to || process.env.ALERT_EMAIL || DEFAULT_ALERT_TO;
  return Response.json({ ok: true, to: resolvedTo, result });
}
