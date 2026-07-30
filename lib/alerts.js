// Ops alerting. Emails ALERT_EMAIL when a scheduled job hits trouble: a buyer's
// batch errored, a batch delivered zero contracts, an email failed to send, or a
// whole run fell over. This is the safety net so a silent cron failure can never
// quietly cost a customer their brief.
//
// Best-effort by design: it never throws. A broken alert path must not be able to
// take down the job it is watching, so every failure here is swallowed and
// reported in the return value instead.
//
// Config: ALERT_EMAIL (where alerts go) and optionally ALERT_FROM (defaults to
// EMAIL_FROM, then the standard sending address). If ALERT_EMAIL or the Resend
// key is unset, alerts no-op cleanly.

import { sendBatchEmail } from './email/resend.js';

const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// subject: short line. summary: one paragraph of context. rows: array of strings,
// one per problem, rendered as a monospace list.
export function renderAlertHTML({ subject, summary, rows = [] }) {
  const items = rows.length
    ? `<ul style="margin:14px 0 0;padding-left:18px;font-family:${MONO};font-size:13px;color:#2b2926;line-height:1.7;">
        ${rows.map((r) => `<li>${esc(r)}</li>`).join('')}
      </ul>`
    : '';
  return `<div style="background:#f8f4ec;padding:24px;font-family:${BODY};">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e0da;border-top:4px solid #f52ea9;border-radius:10px;padding:24px 26px;">
      <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c05f0e;font-weight:800;">War Dogs Academy &middot; Ops alert</div>
      <div style="font-size:20px;font-weight:800;color:#1a1a1a;margin-top:8px;">${esc(subject)}</div>
      <div style="font-size:15px;color:#2b2926;line-height:1.55;margin-top:12px;">${esc(summary)}</div>
      ${items}
      <div style="font-size:12px;color:#7a7570;margin-top:20px;border-top:1px solid #e5e0da;padding-top:12px;">Automated alert from the batch pipeline. Reply is not monitored.</div>
    </div>
  </div>`;
}

export async function sendOpsAlert({ subject, summary, rows = [] }, { client } = {}) {
  const to = process.env.ALERT_EMAIL;
  if (!to) return { skipped: 'ALERT_EMAIL not set' };
  if (!process.env.RESEND_API_KEY && !client) return { skipped: 'RESEND_API_KEY not set' };
  const from = process.env.ALERT_FROM || process.env.EMAIL_FROM || 'War Dogs Academy <contracts@wardogsacademy.com>';
  const html = renderAlertHTML({ subject, summary, rows });
  try {
    const data = await sendBatchEmail({ to, from, subject: `[WDA alert] ${subject}`, html }, { client });
    return { sent: true, data };
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}
