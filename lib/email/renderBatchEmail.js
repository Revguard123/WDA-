// Slice 3 email renderer. Builds the branded HTML brief for a buyer's batch of
// curated contracts. Email-safe: table layout, inline styles, no external CSS
// or scripts. All deeper views are tokenized links (buyers never log in).
//
// Copy rule: no long dash characters anywhere.

const BRAND = {
  name: 'War Dogs Academy',
  product: 'Curated Target Contracts',
  ink: '#14181f',
  panel: '#1b2029',
  gold: '#c5a253',
  paper: '#f4f5f7',
  card: '#ffffff',
  line: '#e2e5ea',
  text: '#2b3038',
  muted: '#6b7280',
  amber: '#b45309',
  green: '#2f6f4f',
};

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

function fmtValue(v) {
  if (v == null) return 'Not stated';
  const n = Number(v);
  if (!Number.isFinite(n)) return 'Not stated';
  return `$${n.toLocaleString('en-US')}`;
}

function chip(label, value) {
  return (
    `<span style="display:inline-block;background:${BRAND.paper};border:1px solid ${BRAND.line};` +
    `border-radius:4px;padding:3px 8px;margin:0 6px 6px 0;font-size:12px;color:${BRAND.muted};">` +
    `${esc(label)}: <strong style="color:${BRAND.text};">${esc(value)}</strong></span>`
  );
}

function card(c, links) {
  const deepUrl = links.deepDive(c.notice_id);
  const samUrl = c.sam_url || '#';
  return `
  <tr><td style="padding:0 0 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:8px;">
      <tr><td style="height:4px;background:${BRAND.gold};border-radius:8px 8px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:18px 20px 6px 20px;">
        <div style="font-size:17px;font-weight:700;color:${BRAND.ink};line-height:1.35;">${esc(c.title || 'Untitled solicitation')}</div>
        <div style="font-size:13px;color:${BRAND.muted};margin-top:4px;">${esc(c.agency || 'Agency not stated')}</div>
      </td></tr>
      <tr><td style="padding:10px 20px 4px 20px;">
        ${chip('NAICS', c.naics || 'n/a')}
        ${chip('Set-aside', c.set_aside_type || 'Full and open')}
        ${chip('Value', fmtValue(c.est_value))}
        <span style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;border-radius:4px;padding:3px 8px;margin:0 6px 6px 0;font-size:12px;color:${BRAND.amber};">Due: <strong>${esc(fmtDeadline(c.response_deadline))}</strong></span>
      </td></tr>
      ${c.why_line ? `<tr><td style="padding:6px 20px 4px 20px;">
        <div style="background:${BRAND.paper};border-left:3px solid ${BRAND.green};padding:10px 12px;border-radius:0 4px 4px 0;font-size:14px;color:${BRAND.text};line-height:1.5;">
          <strong style="color:${BRAND.green};">Why we picked this.</strong> ${esc(c.why_line)}
        </div></td></tr>` : ''}
      <tr><td style="padding:14px 20px 18px 20px;">
        <a href="${esc(deepUrl)}" style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;margin-right:8px;">Dive Deeper</a>
        <a href="${esc(samUrl)}" style="display:inline-block;color:${BRAND.text};text-decoration:none;font-size:14px;font-weight:600;padding:10px 14px;border:1px solid ${BRAND.line};border-radius:6px;">View on SAM.gov</a>
      </td></tr>
    </table>
  </td></tr>`;
}

// buyer: { name, ... }
// contracts: chosen array from curateForBuyer
// links: { deepDive(notice_id)=>url, targeting=>url, allContracts=>url }
// meta: { batchMonth, shortfall }
export function buildBatchEmailHTML(buyer, contracts, links, meta = {}) {
  const greetingName = buyer?.name ? esc(buyer.name.split(' ')[0]) : 'there';
  const count = contracts.length;
  const subject = count > 0
    ? `${BRAND.product}: ${count} target${count === 1 ? '' : 's'} matched to your niche`
    : `${BRAND.product}: your niche update`;

  const cards = contracts.map((c) => card(c, links)).join('');
  const shortfallNote = meta.shortfall
    ? `<p style="font-size:13px;color:${BRAND.muted};margin:4px 0 0 0;">We held the line on quality this cycle: ${count} contract${count === 1 ? '' : 's'} cleared our screen out of everything open in your niche. We do not pad the list with weak matches.</p>`
    : '';

  const html = `<!-- ${esc(BRAND.name)} ${esc(BRAND.product)} -->
<div style="background:${BRAND.paper};margin:0;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
        <tr><td style="background:${BRAND.ink};border-radius:10px 10px 0 0;padding:22px 24px;">
          <div style="color:${BRAND.gold};font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">${esc(BRAND.name)}</div>
          <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:2px;">${esc(BRAND.product)}</div>
        </td></tr>
        <tr><td style="background:${BRAND.panel};padding:16px 24px;">
          <div style="color:#e6e8ec;font-size:15px;line-height:1.5;">
            ${greetingName}, here ${count === 1 ? 'is your target' : `are your ${count === 0 ? '' : count + ' '}targets`} for this cycle, hand-matched to the niche you told us and screened by our AI against a strict disqualification list.
          </div>
          ${shortfallNote}
        </td></tr>
        <tr><td style="padding:20px 12px 6px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${count > 0 ? cards : `<tr><td style="padding:12px 8px;color:${BRAND.muted};font-size:14px;">Nothing cleared our screen in your niche this cycle. That is by design: we would rather send you nothing than send you a dud. Widen your targeting below to see more.</td></tr>`}
          </table>
        </td></tr>
        <tr><td style="padding:8px 24px 24px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.line};">
            <tr><td style="padding:16px 0 0 0;font-size:13px;color:${BRAND.muted};line-height:1.6;">
              <a href="${esc(links.allContracts)}" style="color:${BRAND.ink};font-weight:600;text-decoration:none;">See all your contracts</a>
              &nbsp;&middot;&nbsp;
              <a href="${esc(links.targeting)}" style="color:${BRAND.ink};font-weight:600;text-decoration:none;">Update your targeting</a>
              <div style="margin-top:12px;color:#9aa0aa;font-size:12px;">${esc(BRAND.name)} ${esc(BRAND.product)}. You receive this because you activated your niche. Targeting changes apply to next cycle.</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html };
}

export { BRAND };
