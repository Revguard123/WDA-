// Welcome email, sent when a Kajabi purchase grants a new buyer (Slice 6). It
// carries their private, no-login setup link so they can build their niche and
// hit Go. Same brand system and email-safety rules as the batch brief.
// Copy rule: no long dash characters anywhere.

import { BRAND } from './renderBatchEmail.js';

const DISPLAY = "'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// buyer: { name }
// links: { setup, logo, base }
export function buildWelcomeEmailHTML(buyer, links = {}) {
  const first = buyer?.name ? esc(buyer.name.split(' ')[0]) : 'there';
  const subject = 'Welcome to The Target Brief. Set up your niche.';
  const logoUrl = links.logo || (links.base ? `${links.base}/brand/wda-logo.png` : '');
  const setupUrl = links.setup || '#';

  const step = (n, t) =>
    `<td width="33.33%" valign="top" style="padding:0 8px;">
      <div style="font-family:${DISPLAY};font-size:17px;font-weight:800;color:${BRAND.pink};">${n}</div>
      <div style="font-family:${BODY};font-size:13px;color:${BRAND.muted};line-height:1.5;margin-top:5px;">${t}</div>
    </td>`;

  const html = `<!-- ${esc(BRAND.name)} welcome -->
  <style>
    .wda-btn:hover { background:${BRAND.pinkDeep} !important; }
    @media only screen and (max-width:600px) {
      .wda-shell { width:100% !important; }
      .wda-pad { padding-left:18px !important; padding-right:18px !important; }
      .wda-cta { display:block !important; text-align:center !important; }
    }
  </style>
<div style="background:${BRAND.paper};margin:0;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};">
    <tr><td align="center" style="padding:24px 10px;">
      <table role="presentation" class="wda-shell" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;">

        <tr><td style="background:${BRAND.pink};height:4px;font-size:0;line-height:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
        <tr><td style="background:${BRAND.orange};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:32px 28px 24px 28px;" align="center">
          ${logoUrl
            ? `<img src="${esc(logoUrl)}" width="250" alt="${esc(BRAND.name)}" style="display:block;width:250px;max-width:74%;height:auto;margin:0 auto;">`
            : `<div style="font-family:${DISPLAY};font-size:34px;font-weight:800;color:${BRAND.pink};">WAR DOGS <span style="color:${BRAND.orange};">ACADEMY</span></div>`}
          <div style="height:3px;width:66px;background:${BRAND.pink};margin:20px auto 14px auto;font-size:0;line-height:0;">&nbsp;</div>
          <div style="font-family:${BODY};font-size:14px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.ink};font-weight:800;">${esc(BRAND.product)}</div>
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:8px 28px 8px 28px;">
          <div style="font-family:${DISPLAY};font-size:27px;font-weight:800;color:${BRAND.ink};margin-bottom:10px;letter-spacing:-0.4px;">You are in, ${first}.</div>
          <div style="font-family:${BODY};color:${BRAND.text};font-size:18px;line-height:1.55;">
            Welcome to War Dogs Academy. Every month The Target Brief surfaces live federal contracts matched to your niche and explains why they are worth your time. One thing first: tell us what to go after, so your very first brief is built around you.
          </div>
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:18px 28px 26px 28px;" align="center">
          <a class="wda-btn wda-cta" href="${esc(setupUrl)}" style="display:inline-block;background:${BRAND.pink};color:#ffffff;text-decoration:none;font-family:${BODY};font-size:17px;font-weight:800;padding:15px 34px;border-radius:9px;">Set up my niche &rarr;</a>
          <div style="font-family:${BODY};font-size:12px;color:${BRAND.muted};margin-top:12px;">This is your private link. No password, no login. Just click and go.</div>
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.panel};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:24px 24px 22px 24px;">
          <div style="font-family:${BODY};font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:14px;">What happens next</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${step('01', 'Tell us your niche: your NAICS codes, set-asides, and the words that describe your work.')}
            ${step('02', 'Hit Go. We pull your first brief on the spot, matched to what you told us.')}
            ${step('03', 'Every month after, a fresh brief lands in your inbox. Never the same contract twice.')}
          </tr></table>
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-top:none;border-radius:0 0 12px 12px;padding:22px 28px 26px 28px;">
          <div style="height:3px;width:100%;background:${BRAND.orange};margin-bottom:16px;font-size:0;line-height:0;">&nbsp;</div>
          <div style="font-family:${BODY};font-size:14px;color:${BRAND.text};font-weight:600;">The War Dogs Academy team</div>
          <div style="margin-top:10px;font-family:${BODY};color:${BRAND.muted};font-size:11px;line-height:1.6;">${esc(BRAND.name)} &middot; ${esc(BRAND.product)}. You are receiving this because you just enrolled. If this was not you, reply and let us know.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html };
}
