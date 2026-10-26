import Shell, { NotFound } from '../../_components/Shell.jsx';
import SetupWorkspace from '../../_components/SetupWorkspace.jsx';
import Button from '../../_components/Button.jsx';
import ContractArchiveIllustration from '../../_components/ContractArchiveIllustration.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { listDeliveriesForBuyer } from '../../../lib/deliveries.js';
import { buyerPagePath, contractPath } from '../../../lib/buyerUrls.js';
import { CONTRACT_CARD_BREAKDOWN_CTA, CONTRACT_CARD_WHY_LABEL, contractEvidenceChips, contractVerifyItems, contractsPresentationForBuyer } from '../../../lib/contractsPresentation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function recordedDeadline(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return { text: 'See solicitation', past: false, valid: false };
  return {
    text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    past: date.getTime() < Date.now(),
    valid: true,
  };
}

export default async function ContractsPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="link" />;
  const deliveries = await listDeliveriesForBuyer(buyer.id);
  const presentation = contractsPresentationForBuyer(buyer, { deliveryCount: deliveries.length });
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';
  const discoveryHref = buyerPagePath('discover', token) + (buyer.status === 'exploring' ? '' : '?update=1');

  return (
    <Shell maxWidth="100%" hideHeader locked>
      <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} supportEmail={supportEmail} pageContext="contracts" discoveryHref={discoveryHref} activePage="contracts" header={
        <div className="contracts-toolbar">
          <div className="contracts-toolbar-actions">
            <Button href={`${buyerPagePath('setup', token)}?review=1`} variant="ghost" showArrow={false}>Review targeting</Button>
            <Button href={`${buyerPagePath('discover', token)}?update=1`} variant="ghost" showArrow={false}>Change niche for future batches</Button>
          </div>
        </div>
      }>
        <section className="contracts-title-card" aria-labelledby="contracts-title">
          <div className="contracts-title-main">
            <ContractArchiveIllustration />
            <div className="contracts-title-copy">
            <p className="contracts-account">Account: <span>{buyer.email}</span></p>
            <h1 id="contracts-title" className="contracts-title">{presentation.listTitle}</h1>
            <p className="contracts-subtitle">Matched to your niche and ranked around how strong each opportunity is for you. Here is the why on each.</p>
            </div>
          </div>
          <dl className="contracts-summary">
            <div className="contracts-summary-count"><dt>Delivered targets</dt><dd>{deliveries.length}</dd></div>
            <div className="contracts-summary-state" data-state={presentation.completed ? 'completed' : buyer.status === 'active' ? 'active' : 'not-started'}><dt>Status</dt><dd>{presentation.completed ? 'Complete' : buyer.status === 'active' ? 'Active' : 'Not started'}</dd></div>
          </dl>
        </section>

        {presentation.statusCallout ? (
          <section className="contracts-status" aria-label="Delivery status">
            <h2>{presentation.statusCallout.title}</h2>
            <p>{presentation.statusCallout.body}</p>
          </section>
        ) : null}

        {buyer.naics && buyer.naics.length > 0 ? (
          <section className="contracts-targeting" aria-label="Current targeting">
            <div className="contracts-targeting-profile">
              <span className="contracts-targeting-label">{presentation.completed ? 'Current targeting' : 'Industries we are searching for you'}</span>
              <div className="contracts-profile-chips">{buyer.naics.map((code) => <span key={code}>NAICS {code}</span>)}</div>
            </div>
            <p>Refine your next search: <a href={`${buyerPagePath('setup', token)}?review=1`}>review your targeting</a> or <a href={`${buyerPagePath('discover', token)}?update=1`}>explore a new niche</a>.</p>
            {presentation.completed ? <p className="contracts-history-note">Your current targeting may differ from the targeting used for earlier deliveries.</p> : null}
          </section>
        ) : null}

        {deliveries.length === 0 ? (
          <section className="contracts-empty" aria-label="No delivered contracts">
            <h2>{presentation.completed ? 'No archived opportunities available' : 'No contracts yet'}</h2>
            {buyer.status === 'exploring' ? <p>Set your targeting before starting your contract search. <a href={buyerPagePath('setup', token)}>Set up your niche</a>.</p>
              : <p>{presentation.completed ? 'There are no saved opportunities to display in this archive.' : 'Delivered opportunities will appear here.'}</p>}
          </section>
        ) : (
          <div className="contracts-list">
            {deliveries.map((c, index) => {
              // Badges describe persisted analysis, not new verification or a new search.
              const evidence = contractEvidenceChips(c).filter((chip) => chip !== 'Set-aside');
              const verify = contractVerifyItems(c);
              const deadline = recordedDeadline(c.response_deadline);
              return (
                <article key={c.notice_id} className="contracts-card" aria-labelledby={'contract-title-' + index}>
                  <div className="contracts-card-main">
                    <div className="contracts-metadata" aria-label="Opportunity details">
                      <span>{c.naics ? 'NAICS ' + c.naics : 'NAICS not supplied'}</span>
                      <span>{c.set_aside_type || 'Full and open'}</span>
                      {c.batch_month != null ? <span>Batch {c.batch_month}</span> : null}
                    </div>
                    <h2 id={'contract-title-' + index} className="contracts-card-title">{c.title || 'Untitled solicitation'}</h2>
                    <p className="contracts-agency">{c.agency || 'Agency not stated'}</p>
                    <div className="contracts-why">
                      <h3>{CONTRACT_CARD_WHY_LABEL}</h3>
                      <p>{c.why_line || 'Open the full breakdown to review the available opportunity details.'}</p>
                    </div>
                    <p className="contracts-verify"><strong>Verify:</strong> {verify.length ? verify.join(' ') : 'Review the full solicitation and confirm eligibility before bidding.'}</p>
                  </div>
                  <aside className="contracts-card-side" aria-label="Matching signals and actions">
                    {evidence.length ? <div className="contracts-evidence">
                      <span className="contracts-side-label">Matching signals</span>
                      <ul>{evidence.map((chip) => <li key={chip}>{chip}</li>)}</ul>
                    </div> : null}
                    <div className="contracts-deadline">
                      <span className="contracts-side-label">{deadline.past ? 'Past recorded deadline' : 'Response deadline'}</span>
                      {deadline.valid ? <time dateTime={c.response_deadline}>{deadline.text}</time> : <span>{deadline.text}</span>}
                      {deadline.past ? <small>Check SAM.gov for the latest amendments.</small> : null}
                    </div>
                    <div className="contracts-buttons">
                      <Button href={contractPath(c.title, c.notice_id)} ariaLabel={'Full breakdown: ' + (c.title || 'Untitled solicitation')}>{CONTRACT_CARD_BREAKDOWN_CTA}</Button>
                      {c.sam_url ? <Button href={c.sam_url} variant="ghost" showArrow={false} className="contracts-secondary"
                        target="_blank" rel="noopener noreferrer" ariaLabel={'View solicitation: ' + (c.title || 'Untitled solicitation') + ' (opens in a new tab)'}>View Solicitation</Button> : null}
                    </div>
                  </aside>
                </article>
              );
            })}
          </div>
        )}
      </SetupWorkspace>
    </Shell>
  );
}
