import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import GoButton from '../../_components/GoButton.jsx';
import SetupWorkspace from '../../_components/SetupWorkspace.jsx';
import Button from '../../_components/Button.jsx';
import NicheFocusIllustration from '../../_components/NicheFocusIllustration.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer } from '../../../lib/discoverySessions.js';
import { discoveryTargetingReviewState } from '../../../lib/setupDiscoveryState.js';
import { getOfficialNaicsTitle } from '../../../lib/playbook/naicsReference.js';
import { SET_ASIDE_OPTIONS } from '../../../lib/ui.js';
import { startStateForBuyer } from '../../../lib/journey.js';
import { buyerPagePath } from '../../../lib/buyerUrls.js';

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
  return `$${numeric.toLocaleString('en-US')}`;
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

function SummaryRow({ label, children, wide = false }) {
  return (
    <section className={`ctc-start-field${wide ? ' is-wide' : ''}`}>
      <h3>{label}</h3>
      <div className="ctc-start-value">{children}</div>
    </section>
  );
}

export default async function StartPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="start link" />;

  const state = startStateForBuyer({ ...buyer, access_token: token });
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);
  const discoveryReview = discoveryTargetingReviewState({ session, buyer });
  const naics = discoveryReview?.naics?.length ? discoveryReview.naics : normalizeNaics(buyer.naics);
  const keywords = Array.isArray(buyer.keywords) ? buyer.keywords.filter(Boolean) : [];
  const setAsides = Array.isArray(buyer.set_asides) ? buyer.set_asides.filter(Boolean) : [];
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';

  return (
    <Shell maxWidth="100%" hideHeader locked>
      <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} supportEmail={supportEmail} pageContext="start" discoveryHref={buyerPagePath('discover', token)} setupStep={2} contentClassName="ctc-start-page" mainLabel="Start your contract search">
      <header className="ctc-flow-intro">
        <p className="wda-setup-eyebrow">Curated Target Contracts</p>
        <h1>Ready to Start</h1>
        <p>
          When you start, War Dogs Academy will evaluate current federal opportunities against your targeting profile
          and pull the strongest contract opportunities for this cycle.
        </p>
      </header>
      <div className="ctc-start-columns">
        <section className="ctc-start-summary ctc-flow-panel" aria-labelledby="start-profile-title">
          <header className="ctc-start-summary-heading"><h2 id="start-profile-title">Your targeting at a glance</h2><span>Saved profile</span></header>
          <div className="ctc-start-fields">
          {discoveryReview ? (
            <SummaryRow label="Selected War Dogs niche" wide>
              <p className="ctc-start-niche">{discoveryReview.subindustryName || 'Selected niche'}</p>
              {discoveryReview.industryName ? <p className="ctc-start-industry">{discoveryReview.industryName}</p> : null}
            </SummaryRow>
          ) : null}
          <SummaryRow label="Industries / NAICS" wide>
            <ul className="ctc-start-naics">{naics.map((n) => <li key={n.code}><span>NAICS {n.code}</span>{n.title ? <span>{n.title}</span> : null}</li>)}</ul>
          </SummaryRow>
          <SummaryRow label="Capabilities / Keywords" wide>
            {keywords.length ? <ul className="ctc-start-keywords">{keywords.map((keyword, index) => <li key={index}>{keyword}</li>)}</ul> : 'No keywords set'}
          </SummaryRow>
          <SummaryRow label="Service Area">
            {buyer.state ? buyer.state : 'Nationwide'}
          </SummaryRow>
          <SummaryRow label="Contract Size">
            {contractSizeLabel(buyer.size_min, buyer.size_max)}
          </SummaryRow>
          <SummaryRow label="Set-Asides" wide>
            {setAsides.length ? setAsides.map(setAsideLabel).join(', ') : 'No set-asides selected'}
          </SummaryRow>
          </div>
          <footer className="ctc-start-summary-footer"><p>Need to fine-tune anything?</p><Button href={buyerPagePath('setup', token)} variant="ghost" showArrow={false}>Review targeting again</Button></footer>
        </section>
        <aside className="ctc-start-action ctc-flow-panel" aria-labelledby="start-search-title">
          <NicheFocusIllustration />
          <p className="ctc-flow-kicker">Your next step</p>
          <h2 id="start-search-title">Put your targeting to work.</h2>
          <p className="ctc-flow-muted">We’ll look for opportunities that fit your business—not just fill a list.</p>
          <ol className="ctc-start-expectations"><li>Review current federal opportunities</li><li>Apply your targeting and eligibility</li><li>Surface the strongest available matches</li></ol>
          <GoButton token={token} />
          <p className="ctc-start-cycle-note">After activation, targeting edits still apply to future cycles. This cycle stays locked once contracts are pulled.</p>
        </aside>
      </div>
      </SetupWorkspace>
    </Shell>
  );
}
