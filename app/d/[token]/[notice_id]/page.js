import Shell, { NotFound } from '../../../_components/Shell.jsx';
import SupportCTA from '../../../_components/SupportCTA.jsx';
import SetupWorkspace from '../../../_components/SetupWorkspace.jsx';
import Button from '../../../_components/Button.jsx';
import CTCIcon from '../../../_components/CTCIcon.jsx';
import DecisionBrief from '../../../_components/DecisionBrief.jsx';
import BetaNotice from '../../../_components/BetaNotice.jsx';
import { getBuyerByToken } from '../../../../lib/buyers.js';
import { getDeliveryForBuyer } from '../../../../lib/deliveries.js';
import { DEEP_DIVE_WHY_LABEL } from '../../../../lib/contractsPresentation.js';
import { redirect } from 'next/navigation';
import { buyerPagePath, contractPath, contractSlug } from '../../../../lib/buyerUrls.js';

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

// Give long saved summaries natural paragraph breaks without rewriting claims,
// extracting inferred facts, truncating content or making another AI request.
function overviewParagraphs(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.includes('\n')) return text.split(/\n\s*\n/).filter(Boolean);
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const paragraphs = [];
  let paragraph = '';
  for (const { segment } of sentences) {
    if (paragraph && (paragraph + segment).trim().split(/\s+/).length > 60) {
      paragraphs.push(paragraph.trim());
      paragraph = '';
    }
    paragraph += segment;
  }
  if (paragraph.trim()) paragraphs.push(paragraph.trim());
  return paragraphs;
}

export default async function DiveDeeperPage({ params, canonicalSlug }) {
  const { token, notice_id: noticeId } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="link" />;

  const record = await getDeliveryForBuyer(buyer.id, noticeId);
  if (!record) return <NotFound what="contract" />;
  const opp = record.opportunity || {};
  if (canonicalSlug && canonicalSlug !== contractSlug(opp.title, noticeId)) redirect(contractPath(opp.title, noticeId));
  const sections = briefSections(record.deep_dive_text);
  const overviewIndex = sections.findIndex((section) => section.title.toLowerCase() === 'why we surfaced this one');
  const initiallyOpenIndex = overviewIndex >= 0 ? overviewIndex : 0;
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';

  return (
    <Shell maxWidth="100%" hideHeader locked>
      <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} reader activePage="contracts" discoveryHref={`${buyerPagePath('discover', token)}${buyer.status === 'exploring' ? '' : '?update=1'}`} contentClassName="ctc-breakdown-page" mainLabel="Contract full breakdown"
        sidebarFooter={<SupportCTA sidebar liquid pageContext="deep_dive" initialEmail={buyer.email} supportEmail={supportEmail} />}
        contextBar={
        <div className="ctc-reader-context">
          <nav className="ctc-reader-breadcrumb" aria-label="Breadcrumb"><ol>
            <li><a id="reader-contracts-link" href={buyerPagePath('contracts', token)}>Contracts</a></li>
            <li aria-hidden="true" className="ctc-reader-breadcrumb-divider">/</li>
            <li><span aria-current="page">Full breakdown</span></li>
          </ol></nav>
          <BetaNotice focusAfterDismissId="reader-contracts-link" />
        </div>
      }>
      <div className="ctc-breakdown-layout">
      <aside className="ctc-opportunity-card ctc-flow-panel" aria-labelledby="breakdown-title">
      <header className="ctc-breakdown-hero">
        <p className="wda-setup-eyebrow">Contract opportunity</p>
        <h1 id="breakdown-title">{opp.title || 'Solicitation'}</h1>
        <p className="ctc-breakdown-agency">{opp.agency || 'Agency not stated'}</p>
      </header>
      <div className="ctc-opportunity-card-body" tabIndex={0} role="region" aria-label="Contract summary and details">
          <dl className="ctc-breakdown-metadata" aria-label="Opportunity details">
            <div><dt>NAICS</dt><dd>{opp.naics || 'Not supplied'}</dd></div>
            <div><dt>Set-aside</dt><dd>{opp.set_aside_type || 'Full and open'}</dd></div>
            <div><dt>Location</dt><dd>{opp.place_of_perf || 'Not supplied'}</dd></div>
            <div><dt>Due</dt><dd>{fmtDeadline(opp.response_deadline)}</dd></div>
          </dl>
        {String(record.why_line || '').trim() ? (
          <section className="ctc-opportunity-overview" aria-labelledby="breakdown-overview-title">
            <h2 id="breakdown-overview-title">{DEEP_DIVE_WHY_LABEL}</h2>
            <div className="ctc-overview-copy">{overviewParagraphs(record.why_line).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          </section>
        ) : null}
      </div>
      <footer className="ctc-opportunity-card-footer">
        {opp.sam_url ? <Button href={opp.sam_url} target="_blank" rel="noopener noreferrer" ariaLabel="View the full solicitation on SAM.gov (opens in a new tab)">View on SAM.gov</Button> : null}
        <p>Confirm the latest deadlines and amendments on SAM.gov.</p>
      </footer>
      </aside>
      <article className="ctc-breakdown-document" aria-labelledby="decision-brief-title">
      <DecisionBrief>
        <header className="ctc-decision-intro"><h2 id="decision-brief-title">War Dogs decision brief</h2>
          {sections.length > 1 ? <p>Open a section to read the details.</p> : null}
        </header>
        {sections.length ? (
          sections.map((section, index) => (
            <details key={index} id={`brief-section-${index}`} className="ctc-brief-section" open={index === initiallyOpenIndex}>
              <summary className="ctc-brief-section-heading"><span className="ctc-brief-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3 id={`brief-title-${index}`}>{section.title}</h3><CTCIcon name="chevron" /></summary>
              <div className="ctc-brief-section-content"><div className="ctc-brief-section-body">
              {section.body.split(/\n+/).map((p, i) => (
                <p key={i}>{p.replace(/^[-*]\s*/, '')}</p>
              ))}
              </div></div>
            </details>
          ))
        ) : (
          <p className="ctc-brief-empty" role="status">The detailed breakdown for this contract is being prepared.</p>
        )}
      </DecisionBrief>
      <footer className="ctc-breakdown-footer">Confirm the latest deadlines, amendments, and mandatory requirements in the full solicitation before bidding.</footer>
      </article>
      </div>
      </SetupWorkspace>
    </Shell>
  );
}
