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

const SECTION_TITLES = [
  'Why we surfaced this one',
  'Your strongest advantages',
  'How the government will choose',
  'What you need to verify',
  'Important dates',
  'Contract structure and economics',
  'Delivery and compliance considerations',
  'First move',
];

function briefSections(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const sections = [];
  const escaped = SECTION_TITLES.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:^|\\n)#{0,3}\\s*(${escaped})\\s*:?\\s*\\n`, 'gi');
  const matches = [...raw.matchAll(re)];
  if (!matches.length) return [{ title: 'Full breakdown', body: raw }];
  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][1];
    const start = matches[i].index + matches[i][0].length;
    const end = matches[i + 1]?.index ?? raw.length;
    const body = raw.slice(start, end).trim();
    if (body) sections.push({ title, body });
  }
  return sections;
}

export default async function DiveDeeperPage({ params }) {
  const { token, notice_id: noticeId } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="link" />;

  const record = await getDeliveryForBuyer(buyer.id, noticeId);
  if (!record) return <NotFound what="contract" />;
  const opp = record.opportunity || {};
  const sections = briefSections(record.deep_dive_text);

  const chip = (label, value) => (
    <span style={{ display: 'inline-block', background: UI.paper, border: `1px solid ${UI.line}`, borderRadius: 4, padding: '3px 8px', margin: '0 6px 6px 0', fontSize: 12, color: UI.muted }}>
      {label}: <strong style={{ color: UI.text, fontWeight: 600 }}>{value}</strong>
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
            <strong style={{ color: UI.green, fontWeight: 600 }}>{DEEP_DIVE_WHY_LABEL}.</strong> {record.why_line}
          </div>
        ) : null}

        <h2 style={{ fontSize: 18, color: UI.ink, margin: '24px 0 8px' }}>War Dogs decision brief</h2>
        <p style={{ color: UI.muted, fontSize: 14, lineHeight: 1.55, margin: '0 0 14px' }}>
          A plain-English bid/no-bid read: why this was surfaced, what gives you an edge, what to verify, and what to do first.
        </p>
        {sections.length ? (
          sections.map((section) => (
            <section key={section.title} style={{ borderTop: `1px solid ${UI.line}`, paddingTop: 14, marginTop: 14 }}>
              <h3 style={{ margin: '0 0 7px', fontSize: 15, color: UI.ink }}>{section.title}</h3>
              {section.body.split(/\n+/).map((p, i) => (
                <p key={i} style={{ fontSize: 15, color: UI.text, lineHeight: 1.65, margin: '0 0 9px' }}>{p.replace(/^[-*]\s*/, '')}</p>
              ))}
            </section>
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
