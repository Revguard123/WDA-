// Email renderer. Builds the branded HTML brief for a buyer's batch of curated
// contracts. Email-safe: table layout, inline styles, no external CSS or
// scripts (a small <style> block adds hover niceties where clients honor it).
// All deeper views are tokenized links (buyers never log in).
//
// Brand system (from the War Dogs Academy capability-statement standards):
//   - Light surfaces: warm cream page, white cards.
//   - Pink #F52EA9 is the hero accent (logo, top-match badge, header rule).
//   - Orange #FF9F58 carries structural rules, section bars, badges.
//   - Near-black #1A1A1A ink for headlines and primary buttons.
//   - Zuume Rough grunge display lives in the logo image; email body uses a
//     heavy system stack since custom fonts do not render in most mail clients.
// Copy rule: no long dash characters anywhere.

const BRAND = {
  name: 'War Dogs Academy',
  product: 'The Target Brief',
  ink: '#1a1a1a',
  pink: '#f52ea9',
  pinkDeep: '#c81e86',
  orange: '#ff9f58',
  orangeDeep: '#c05f0e',
  paper: '#f8f4ec',
  panel: '#f3ede2',
  card: '#ffffff',
  line: '#e5e0da',
  text: '#2b2926',
  muted: '#7a7570',
  logoPath: '/brand/wda-logo.png',
};

const DISPLAY = "'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDeadline(iso) {
  if (!iso) return 'See solicitation';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'See solicitation';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function daysLeft(iso, now) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ref = now ? new Date(now) : new Date();
  const days = Math.ceil((d.getTime() - ref.getTime()) / 86400000);
  return Number.isFinite(days) ? days : null;
}

function fmtValue(v) {
  if (v == null) return 'Not stated';
  const n = Number(v);
  if (!Number.isFinite(n)) return 'Not stated';
  return `$${n.toLocaleString('en-US')}`;
}

function chip(label, value) {
  return (
    `<span style="display:inline-block;background:${BRAND.paper};border:1px solid ${BRAND.line};` +
    `border-radius:5px;padding:4px 10px;margin:0 6px 6px 0;font-size:12px;color:${BRAND.muted};` +
    `font-family:${BODY};">${esc(label)}: <strong style="color:${BRAND.text};">${esc(value)}</strong></span>`
  );
}

// One dashboard tile in the "how this cycle was built" funnel strip.
function statTile(num, label, accent) {
  return (
    `<td width="25%" align="center" style="padding:14px 6px;border-left:1px solid ${BRAND.line};">` +
    `<div style="font-family:${DISPLAY};font-size:30px;line-height:1;font-weight:800;color:${accent || BRAND.ink};">${esc(num)}</div>` +
    `<div style="font-family:${BODY};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};margin-top:7px;font-weight:700;">${esc(label)}</div>` +
    `</td>`
  );
}

function funnelStrip(stats, count) {
  if (!stats) return '';
  const scanned = stats.input;
  const screened = stats.afterHardFilters;
  const disq = stats.disqualifiedByAI;
  if ([scanned, screened, disq].every((v) => v == null)) return '';
  return `
  <tr><td style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:4px 28px 22px 28px;">
    <div style="font-family:${BODY};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:10px;">How we built your brief</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.line};border-radius:10px;border-top:3px solid ${BRAND.orange};background:${BRAND.paper};">
      <tr>
        ${statTile(scanned ?? '-', 'Reviewed', BRAND.ink).replace(`border-left:1px solid ${BRAND.line};`, '')}
        ${statTile(screened ?? '-', 'Shortlisted', BRAND.ink)}
        ${statTile(disq ?? '-', 'Disqualified', BRAND.orangeDeep)}
        ${statTile(count, 'Hand-picked', BRAND.pink)}
      </tr>
    </table>
    <div style="font-family:${BODY};font-size:12px;color:${BRAND.muted};margin-top:10px;line-height:1.5;">We went through every open contract in your niche, set aside the wrong-size, wrong-place, and closing-too-soon, then read the rest line by line and cut the ones pretending to fit. What is left is what we would chase ourselves.</div>
  </td></tr>`;
}

function card(c, links, idx, now) {
  const deepUrl = links.deepDive(c.notice_id);
  const samUrl = c.sam_url || '#';
  const rank = String(idx + 1).padStart(2, '0');
  const top = idx === 0;
  const badgeColor = top ? BRAND.pink : BRAND.orange;
  const pill = top
    ? `<span style="display:inline-block;background:${BRAND.pink};color:#ffffff;font-family:${BODY};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;border-radius:20px;">Top match</span>`
    : `<span style="display:inline-block;background:#fff3e6;color:${BRAND.orangeDeep};font-family:${BODY};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;border-radius:20px;">Strong fit</span>`;
  const dl = daysLeft(c.response_deadline, now);
  const dueText = dl != null && dl > 0
    ? `Closes ${esc(fmtDeadline(c.response_deadline))} &middot; ${dl} day${dl === 1 ? '' : 's'} left`
    : `Closes ${esc(fmtDeadline(c.response_deadline))}`;

  return `
  <tr><td class="wda-card" style="padding:0 0 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:12px;box-shadow:0 2px 8px rgba(26,26,26,0.05);">
      <tr><td style="padding:20px 22px 0 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" style="width:44px;">
            <div style="width:38px;height:38px;background:${badgeColor};border-radius:9px;text-align:center;">
              <span style="font-family:${DISPLAY};font-size:17px;font-weight:800;color:#ffffff;line-height:38px;">${rank}</span>
            </div>
          </td>
          <td valign="middle" align="right">${pill}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 22px 4px 22px;">
        <div style="font-family:${DISPLAY};font-size:19px;font-weight:800;color:${BRAND.ink};line-height:1.25;letter-spacing:-0.2px;">${esc(c.title || 'Untitled solicitation')}</div>
        <div style="font-family:${BODY};font-size:11px;color:${BRAND.muted};margin-top:6px;text-transform:uppercase;letter-spacing:0.7px;font-weight:600;">${esc(c.agency || 'Agency not stated')}</div>
      </td></tr>
      <tr><td style="padding:12px 22px 2px 22px;">
        ${chip('NAICS', c.naics || 'n/a')}
        ${chip('Set-aside', c.set_aside_type || 'Full and open')}
        ${chip('Value', fmtValue(c.est_value))}
      </td></tr>
      <tr><td style="padding:4px 22px 0 22px;">
        <div style="display:inline-block;background:#fff3e6;border:1px solid #ffd9b0;border-radius:5px;padding:5px 11px;font-family:${BODY};font-size:12px;font-weight:700;color:${BRAND.orangeDeep};">${dueText}</div>
      </td></tr>
      ${c.why_line ? `<tr><td style="padding:14px 22px 4px 22px;">
        <div style="background:${BRAND.paper};border-left:3px solid ${BRAND.orange};padding:12px 15px;border-radius:0 8px 8px 0;font-family:${BODY};font-size:14px;color:${BRAND.text};line-height:1.55;">
          <div style="color:${BRAND.orangeDeep};text-transform:uppercase;font-size:11px;letter-spacing:0.8px;font-weight:800;margin-bottom:4px;">Why we picked this</div>${esc(c.why_line)}
        </div></td></tr>` : ''}
      <tr><td style="padding:16px 22px 22px 22px;">
        <a class="wda-btn" href="${esc(deepUrl)}" style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;font-family:${BODY};font-size:14px;font-weight:700;padding:12px 22px;border-radius:7px;margin-right:8px;">Dive Deeper &rarr;</a>
        <a class="wda-btn-ghost" href="${esc(samUrl)}" style="display:inline-block;color:${BRAND.text};text-decoration:none;font-family:${BODY};font-size:14px;font-weight:600;padding:12px 18px;border:1px solid ${BRAND.line};border-radius:7px;">View on SAM.gov</a>
      </td></tr>
    </table>
  </td></tr>`;
}

function howItWorks() {
  const step = (n, t) =>
    `<td width="33.33%" valign="top" style="padding:0 8px;">
      <div style="font-family:${DISPLAY};font-size:15px;font-weight:800;color:${BRAND.pink};">${n}</div>
      <div style="font-family:${BODY};font-size:12px;color:${BRAND.muted};line-height:1.5;margin-top:4px;">${t}</div>
    </td>`;
  return `
  <tr><td style="background:${BRAND.panel};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:22px 22px 20px 22px;">
    <div style="font-family:${BODY};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:14px;">How the brief works</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${step('01', 'Our team combs SAM.gov across your NAICS codes and set-asides, every day.')}
      ${step('02', 'We read each contender and throw out anything mistagged, ineligible, or a bad fit.')}
      ${step('03', 'You get only the ones we would chase ourselves, and never the same contract twice.')}
    </tr></table>
  </td></tr>`;
}

// buyer: { name, ... }
// contracts: chosen array from curateForBuyer (best-first)
// links: { deepDive(notice_id)=>url, targeting=>url, allContracts=>url, logo=>url, base=>origin }
// meta: { shortfall, stats, cycle, periodLabel, now }
export function buildBatchEmailHTML(buyer, contracts, links, meta = {}) {
  const greetingName = buyer?.name ? esc(buyer.name.split(' ')[0]) : 'there';
  const count = contracts.length;
  const subject = count > 0
    ? `${BRAND.product}: ${count} target${count === 1 ? '' : 's'} matched to your niche`
    : `${BRAND.product}: your niche update`;

  const logoUrl = links.logo || (links.base ? `${links.base}${BRAND.logoPath}` : '');
  const cards = contracts.map((c, i) => card(c, links, i, meta.now)).join('');
  const cycleTag = meta.cycle ? ` &middot; Cycle ${String(meta.cycle).padStart(2, '0')}` : '';
  const periodTag = [meta.periodLabel, cycleTag ? cycleTag.replace(' &middot; ', '') : '']
    .filter(Boolean)
    .join(' &middot; ');

  const shortfallNote = meta.shortfall
    ? `<p style="font-family:${BODY};font-size:13px;color:${BRAND.muted};margin:10px 0 0 0;line-height:1.5;">We held the line on quality this cycle: ${count} contract${count === 1 ? '' : 's'} made the cut out of everything open in your niche. We do not pad the list with weak matches.</p>`
    : '';

  const intro = count === 1
    ? `here is your target for this cycle. Hand-picked by our team to match the niche you told us, after we went through the whole board and set aside everything that did not belong.`
    : `here ${count === 0 ? 'is your cycle update' : `are your ${count} targets for this cycle`}. Hand-picked by our team to match the niche you told us, after we went through the whole board and set aside everything that did not belong.`;

  const widenedNote = meta.widened
    ? `<tr><td style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:0 28px 18px 28px;">
        <div style="background:#fff3e6;border:1px solid #ffd9b0;border-left:3px solid ${BRAND.orange};border-radius:0 8px 8px 0;padding:11px 14px;font-family:${BODY};font-size:13px;color:${BRAND.orangeDeep};line-height:1.5;">
          <strong>Your niche ran a little light this cycle,</strong> so we widened the net (looser deadlines${meta.widened.tiers?.some((t) => t.tier === 'nationwide') ? ' and outside your home state' : ''}) to keep your brief full. Tighten or loosen anytime from your targeting page.
        </div></td></tr>`
    : '';

  const style = `
  <style>
    .wda-btn:hover { background:${BRAND.pink} !important; }
    .wda-btn-ghost:hover { border-color:${BRAND.pink} !important; color:${BRAND.pinkDeep} !important; }
    .wda-card table:hover { box-shadow:0 6px 18px rgba(245,46,169,0.14) !important; }
    @media (max-width:620px) { .wda-shell { width:100% !important; } }
  </style>`;

  const html = `<!-- ${esc(BRAND.name)} ${esc(BRAND.product)} -->${style}
<div style="background:${BRAND.paper};margin:0;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" class="wda-shell" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">

        <tr><td style="background:${BRAND.pink};height:4px;font-size:0;line-height:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
        <tr><td style="background:${BRAND.orange};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr><td style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:30px 28px 22px 28px;" align="center">
          ${logoUrl
            ? `<img src="${esc(logoUrl)}" width="230" alt="${esc(BRAND.name)}" style="display:block;width:230px;max-width:72%;height:auto;margin:0 auto;">`
            : `<div style="font-family:${DISPLAY};font-size:30px;font-weight:800;color:${BRAND.pink};letter-spacing:0.5px;">WAR DOGS <span style="color:${BRAND.orange};">ACADEMY</span></div>`}
          <div style="height:3px;width:64px;background:${BRAND.pink};margin:18px auto 14px auto;font-size:0;line-height:0;">&nbsp;</div>
          <div style="font-family:${BODY};font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.ink};font-weight:800;">${esc(BRAND.product)}</div>
          ${periodTag ? `<div style="font-family:${BODY};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};font-weight:600;margin-top:6px;">${periodTag}</div>` : ''}
        </td></tr>

        <tr><td style="background:${BRAND.card};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:6px 28px 20px 28px;">
          <div style="font-family:${DISPLAY};font-size:22px;font-weight:800;color:${BRAND.ink};margin-bottom:8px;">${greetingName},</div>
          <div style="font-family:${BODY};color:${BRAND.text};font-size:16px;line-height:1.55;">${intro}</div>
          ${shortfallNote}
        </td></tr>

        ${widenedNote}

        ${count > 0 ? funnelStrip(meta.stats, count) : ''}

        <tr><td style="background:${BRAND.paper};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:22px 16px 4px 16px;">
          <div style="padding:0 6px 12px 6px;">
            <span style="font-family:${DISPLAY};font-size:15px;font-weight:800;color:${BRAND.ink};text-transform:uppercase;letter-spacing:0.5px;">Your Targets</span>
            <span style="font-family:${BODY};font-size:13px;color:${BRAND.muted};">&nbsp; ${count} this cycle</span>
            <div style="height:3px;width:100%;background:${BRAND.orange};margin-top:8px;font-size:0;line-height:0;">&nbsp;</div>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${count > 0 ? cards : `<tr><td style="padding:12px 8px;font-family:${BODY};color:${BRAND.muted};font-size:14px;line-height:1.55;">Nothing cleared our screen in your niche this cycle. That is by design: we would rather send you nothing than send you a dud. Widen your targeting below to see more.</td></tr>`}
          </table>
        </td></tr>

        ${count > 0 ? howItWorks() : ''}

        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.line};border-top:none;border-radius:0 0 12px 12px;padding:24px 28px 26px 28px;">
          <div style="height:3px;width:100%;background:${BRAND.orange};margin-bottom:18px;font-size:0;line-height:0;">&nbsp;</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <a href="${esc(links.allContracts)}" style="display:inline-block;background:${BRAND.paper};border:1px solid ${BRAND.line};color:${BRAND.ink};font-family:${BODY};font-weight:700;text-decoration:none;font-size:13px;padding:10px 16px;border-radius:7px;margin:0 6px 6px 0;">See all your contracts</a>
              <a href="${esc(links.targeting)}" style="display:inline-block;background:${BRAND.paper};border:1px solid ${BRAND.line};color:${BRAND.ink};font-family:${BODY};font-weight:700;text-decoration:none;font-size:13px;padding:10px 16px;border-radius:7px;margin:0 6px 6px 0;">Update your targeting</a>
            </td>
          </tr></table>
          <div style="font-family:${BODY};font-size:13px;color:${BRAND.text};margin-top:16px;font-weight:600;">Curated for you by the War Dogs Academy team.</div>
          <div style="margin-top:12px;font-family:${BODY};color:${BRAND.muted};font-size:11px;line-height:1.6;">${esc(BRAND.name)} &middot; ${esc(BRAND.product)}. You receive this because you activated your niche. Targeting changes apply to next cycle.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html };
}

export { BRAND };
