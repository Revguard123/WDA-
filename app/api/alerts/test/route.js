// Test hook for ops alerting. Sends one sample alert so you can confirm alerts
// arrive and land in the inbox (not spam). Secret-protected with CRON_SECRET,
// same as the other operational endpoints.
//
// GET /api/alerts/test?secret=<CRON_SECRET>&to=you@example.com
//   to  optional; defaults to ALERT_EMAIL. One of the two must be present.

import { sendOpsAlert } from '../../../../lib/alerts.js';

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

  const to = url.searchParams.get('to') || process.env.ALERT_EMAIL || null;
  if (!to) return Response.json({ error: 'no recipient: pass ?to= or set ALERT_EMAIL' }, { status: 400 });

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

  return Response.json({ ok: true, to, result });
}
