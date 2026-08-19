// Magic-link re-entry email (Slice 6). Sent when a buyer asks for their private
// link from the /access page (linked from the Kajabi product). Points active
// buyers to their contracts; buyers who have not set up yet get the setup link.
// Same brand system and email-safety rules. Copy rule: no long dash characters.

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

// buyer: { name, status }
// links: { contracts, targeting, setup, logo, base }
export function buildAccessEmailHTML(buyer, links = {}) {
  const first = buyer?.name ? esc(buyer.name.split(' ')[0]) : 'there';
  const exploring = buyer?.status === 'exploring';
  const subject = exploring ? 'Your War Dogs Academy setup link' : 'Your War Dogs Academy contracts link';
  const logoUrl = links.logo || (links.base ? `${links.base}/brand/wda-logo.png` : '');
  const primaryUrl = exploring ? (links.setup || '#') : (links.contracts || '#');
  const primaryLabel = exploring ? 'Set up my niche &rarr;' : 'Open my contracts &rarr;';

  const secondary = exploring
    ? ''
    : `<div style="margin-top:14px;font-family:${BODY};font-size:14px;">
        <a href="${esc(links.targeting || '#')}" style="color:${BRAND.ink};font-weight:600;text-decoration:none;">Update your targeting</a>
      </div>`;

  const html = `<!-- ${esc(BRAND.name)} access link -->
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

        <tr><td class="wda-pad" style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:32px 28px 22px 28px;" align="center">
          ${logoUrl
            ? `<img src="${esc(logoUrl)}" width="230" alt="${esc(BRAND.name)}" style="display:block;width:230px;max-width:72%;height:auto;margin:0 auto;">`
            : `<div style="font-family:${DISPLAY};font-size:32px;font-weight:600;color:${BRAND.pink};">WAR DOGS <span style="color:${BRAND.orange};">ACADEMY</span></div>`}
          <div style="height:3px;width:60px;background:${BRAND.pink};margin:18px auto 0 auto;font-size:0;line-height:0;">&nbsp;</div>
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:8px 28px 6px 28px;">
          <div style="font-family:${DISPLAY};font-size:24px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;letter-spacing:-0.4px;">Here is your link, ${first}.</div>
          <div style="font-family:${BODY};color:${BRAND.text};font-size:16px;line-height:1.55;">
            ${exploring
              ? 'You have not built your niche yet. Pick up where you left off and get your first brief.'
              : 'This is your private, no-login link. Bookmark it so you can get back anytime.'}
          </div>
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:18px 28px 26px 28px;" align="center">
          <a class="wda-btn wda-cta" href="${esc(primaryUrl)}" style="display:inline-block;background:${BRAND.pink};color:#ffffff;text-decoration:none;font-family:${BODY};font-size:16px;font-weight:600;padding:14px 30px;border-radius:9px;">${primaryLabel}</a>
          ${secondary}
        </td></tr>

        <tr><td class="wda-pad" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-top:none;border-radius:0 0 12px 12px;padding:20px 28px 26px 28px;">
          <div style="height:3px;width:100%;background:${BRAND.orange};margin-bottom:14px;font-size:0;line-height:0;">&nbsp;</div>
          <div style="font-family:${BODY};color:${BRAND.muted};font-size:11px;line-height:1.6;">${esc(BRAND.name)} &middot; ${esc(BRAND.product)}. You requested this link. If it was not you, you can ignore this email.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html };
}
