import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import GoButton from '../../_components/GoButton.jsx';
import SupportCTA from '../../_components/SupportCTA.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer } from '../../../lib/discoverySessions.js';
import { discoveryTargetingReviewState } from '../../../lib/setupDiscoveryState.js';
import { getOfficialNaicsTitle } from '../../../lib/playbook/naicsReference.js';
import { UI, SET_ASIDE_OPTIONS } from '../../../lib/ui.js';
import { startStateForBuyer } from '../../../lib/journey.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeNaics(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((code) => String(code || '').trim())
    .filter(Boolean)
    .map((code) => ({ code, title: getOfficialNaicsTitle(code) || '' }));
}

function moneyLabel(value) {
  if (value === '' || value == null) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `$${numeric.toLocaleString()}`;
}

function contractSizeLabel(min, max) {
  const minLabel = moneyLabel(min);
  const maxLabel = moneyLabel(max);
  if (minLabel && maxLabel) return `${minLabel} to ${maxLabel}`;
  if (minLabel) return `${minLabel}+`;
  if (maxLabel) return `Up to ${maxLabel}`;
  return 'No contract size range set';
}

function setAsideLabel(value) {
  return SET_ASIDE_OPTIONS.find((option) => option.value === value)?.label || value;
}

function SummaryRow({ label, children }) {
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${UI.line}` }}>
      <div style={{ fontSize: 12, color: UI.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ marginTop: 6, color: UI.ink, fontSize: 14.5, fontWeight: 600, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

export default async function StartPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="start link" />;

  const state = startStateForBuyer(buyer);
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);
  const discoveryReview = discoveryTargetingReviewState({ session, buyer });
  const naics = discoveryReview?.naics?.length ? discoveryReview.naics : normalizeNaics(buyer.naics);
  const keywords = Array.isArray(buyer.keywords) ? buyer.keywords.filter(Boolean) : [];
  const setAsides = Array.isArray(buyer.set_asides) ? buyer.set_asides.filter(Boolean) : [];
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';

  return (
    <Shell supportBar={<SupportCTA sticky pageContext="start" initialEmail={buyer.email} supportEmail={supportEmail} />}>
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 32 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 26, color: UI.ink }}>Ready to Start</h1>
        <p style={{ color: UI.text, fontSize: 16, lineHeight: 1.6, marginTop: 0 }}>
          When you start, War Dogs Academy will evaluate current federal opportunities against your targeting profile
          and pull the strongest contract opportunities for this cycle.
        </p>

        <div style={{ background: UI.paper, border: `1px solid ${UI.line}`, borderRadius: 10, padding: '4px 18px 8px', marginTop: 22 }}>
          {discoveryReview ? (
            <SummaryRow label="Selected War Dogs niche">
              {discoveryReview.subindustryName || 'Selected niche'}
              {discoveryReview.industryName ? <span style={{ color: UI.muted, fontWeight: 600 }}> · {discoveryReview.industryName}</span> : null}
            </SummaryRow>
          ) : null}
          <SummaryRow label="Industries / NAICS">
            {naics.map((n) => `NAICS ${n.code}${n.title ? ` · ${n.title}` : ''}`).join(', ')}
          </SummaryRow>
          <SummaryRow label="Capabilities / Keywords">
            {keywords.length ? keywords.join(', ') : 'No keywords set'}
          </SummaryRow>
          <SummaryRow label="Service Area">
            {buyer.state ? buyer.state : 'Nationwide'}
          </SummaryRow>
          <SummaryRow label="Set-Asides">
            {setAsides.length ? setAsides.map(setAsideLabel).join(', ') : 'No set-asides selected'}
          </SummaryRow>
          <SummaryRow label="Contract Size">
            {contractSizeLabel(buyer.size_min, buyer.size_max)}
          </SummaryRow>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <GoButton token={token} />
          <a href={`/setup/${token}`} style={{ color: UI.muted, fontSize: 15, textDecoration: 'none', fontWeight: 600 }}>
            Review targeting again
          </a>
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: UI.muted, borderTop: `1px solid ${UI.line}`, paddingTop: 16 }}>
          After activation, targeting edits still apply to future cycles. This cycle stays locked once contracts are pulled.
        </p>
      </div>
    </Shell>
  );
}
