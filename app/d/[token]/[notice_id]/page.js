import Shell, { NotFound } from '../../../_components/Shell.jsx';
import SupportCTA from '../../../_components/SupportCTA.jsx';
import { getBuyerByToken } from '../../../../lib/buyers.js';
import { getDeliveryForBuyer } from '../../../../lib/deliveries.js';
import { UI } from '../../../../lib/ui.js';
import { DEEP_DIVE_WHY_LABEL } from '../../../../lib/contractsPresentation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmtDeadline(iso) {
  if (!iso) return 'See solicitation';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'See solicitation';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function DiveDeeperPage({ params }) {
  const { token, notice_id: noticeId } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="link" />;

  const record = await getDeliveryForBuyer(buyer.id, noticeId);
  if (!record) return <NotFound what="contract" />;
  const opp = record.opportunity || {};
  const paragraphs = String(record.deep_dive_text || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  const chip = (label, value) => (
    <span style={{ display: 'inline-block', background: UI.paper, border: `1px solid ${UI.line}`, borderRadius: 4, padding: '3px 8px', margin: '0 6px 6px 0', fontSize: 12, color: UI.muted }}>
      {label}: <strong style={{ color: UI.text }}>{value}</strong>
    </span>
  );

  return (
    <Shell>
      <div style={{ marginBottom: 12 }}>
        <a href={`/contracts/${token}`} style={{ color: UI.muted, fontSize: 14, textDecoration: 'none' }}>&larr; Back to your contracts</a>
      </div>
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: UI.ink, lineHeight: 1.3 }}>{opp.title || 'Solicitation'}</h1>
        <div style={{ fontSize: 13, color: UI.muted, marginBottom: 14 }}>{opp.agency || 'Agency not stated'}</div>
        <div>
          {chip('NAICS', opp.naics || 'n/a')}
          {chip('Set-aside', opp.set_aside_type || 'Full and open')}
          {chip('Place', opp.place_of_perf || 'n/a')}
          {chip('Due', fmtDeadline(opp.response_deadline))}
        </div>

        {record.why_line ? (
          <div style={{ background: UI.paper, borderLeft: `3px solid ${UI.green}`, padding: '10px 12px', borderRadius: '0 4px 4px 0', fontSize: 14, color: UI.text, margin: '10px 0 6px', lineHeight: 1.5 }}>
            <strong style={{ color: UI.green }}>{DEEP_DIVE_WHY_LABEL}.</strong> {record.why_line}
          </div>
        ) : null}

        <h2 style={{ fontSize: 16, color: UI.ink, margin: '22px 0 8px' }}>Full breakdown</h2>
        <p style={{ color: UI.muted, fontSize: 14, lineHeight: 1.55, margin: '0 0 14px' }}>
          A plain-English read on why this opportunity fits, what to watch for, and a sensible first move before you spend time on the paperwork.
        </p>
        {paragraphs.length ? (
          paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 15, color: UI.text, lineHeight: 1.65, margin: '0 0 14px' }}>{p}</p>
          ))
        ) : (
          <p style={{ color: UI.muted, fontSize: 15 }}>The detailed breakdown for this contract is being prepared.</p>
        )}

        {opp.sam_url ? (
          <a href={opp.sam_url} style={{ display: 'inline-block', marginTop: 8, background: UI.ink, color: '#fff', textDecoration: 'none', fontWeight: 600, padding: '11px 18px', borderRadius: 8, fontSize: 15 }}>
            View the full solicitation on SAM.gov
          </a>
        ) : null}
      </div>
      <SupportCTA pageContext="deep_dive" />
    </Shell>
  );
}
