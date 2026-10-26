import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import NicheForm from '../../_components/NicheForm.jsx';
import SetupWorkspace, { SetupChoice, SetupGuide } from '../../_components/SetupWorkspace.jsx';
import CTCIcon from '../../_components/CTCIcon.jsx';
import NicheFocusIllustration from '../../_components/NicheFocusIllustration.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer } from '../../../lib/discoverySessions.js';
import { discoveryTargetingReviewState } from '../../../lib/setupDiscoveryState.js';
import { setupStateForBuyer } from '../../../lib/journey.js';
import { buyerPagePath, publicBuyerProfile } from '../../../lib/buyerUrls.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SetupPage({ params, searchParams }) {
  const { token } = params;
  const sp = (await searchParams) || {};
  const directTargeting = sp.targeting === '1';
  const reviewOnly = sp.review === '1';
  const updateMode = sp.update === '1';
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="setup link" />;
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';

  const state = setupStateForBuyer({ ...buyer, access_token: token }, { directTargeting, reviewOnly, updateMode });
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);
  const discoveryHref = `${buyerPagePath('discover', token)}${state.updateMode || buyer.status !== 'exploring' ? '?update=1' : ''}`;
  if (state.showChoice && !directTargeting && session && (session.current_step > 1 || session.status !== 'in_progress')) {
    redirect(discoveryHref);
  }
  const discoveryReview = discoveryTargetingReviewState({ session, buyer });

  if (state.showChoice) {
    return (
      <Shell maxWidth="100%" hideHeader locked>
        <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} supportEmail={supportEmail} pageContext="targeting_setup" discoveryHref={discoveryHref} updateMode={state.updateMode} readOnly={state.reviewOnly} choice>
          <SetupChoice discoveryHref={discoveryHref} directHref={`${buyerPagePath('setup', token)}?targeting=1${state.updateMode ? '&update=1' : ''}`} />
        </SetupWorkspace>
      </Shell>
    );
  }

  return (
    <Shell maxWidth="100%" hideHeader locked>
      <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} supportEmail={supportEmail} pageContext={state.hasTargeting ? 'targeting_review' : 'targeting_setup'} discoveryHref={discoveryHref} updateMode={state.updateMode} readOnly={state.reviewOnly}>
        <header className="wda-setup-intro is-split">
          <div>
          <p className="wda-setup-eyebrow">Curated Target Contracts</p>
          <h1>
          {state.hasTargeting ? 'Review Your Targeting' : 'Build Your Targeting Profile'}
        </h1>
          </div>
        <p>
          {state.reviewOnly
            ? buyer.status === 'exploring'
              ? 'View your saved targeting profile, or edit it before starting your contracts.'
              : 'View your saved targeting profile. You can update it for future batches without changing your existing contract archive.'
            : discoveryReview
            ? state.updateMode
              ? 'You picked this niche from Discovery. Saving here updates the targeting profile for future batches only. Your existing contract archive stays unchanged.'
              : 'Your niche is set. Fine-tune the profile from Discovery, then choose when to start your contract search.'
            : state.updateMode
            ? 'Update the targeting profile we should use for future batches. This will not create a new batch today.'
            : state.hasTargeting
            ? 'Check the details that shape your search. Confirming saves your profile—you’ll choose when to start next.'
            : 'Tell us what you do and where you can deliver. We’ll use this profile to find opportunities that fit.'}
        </p>
        </header>
        <div className="wda-setup-columns">
        <aside className="wda-setup-sidebar" aria-label="Your selected targeting">
        {discoveryReview ? (
          <section className="wda-setup-selected is-featured" aria-label="Selected Discovery niche">
            <NicheFocusIllustration />
            <div className="wda-setup-selected-copy">
            <div className="wda-setup-selected-label"><CTCIcon name="target" />
              Selected War Dogs niche
            </div>
            <h2>
              {discoveryReview.subindustryName || 'Selected niche'}
            </h2>
            {discoveryReview.industryName ? (
              <p>{discoveryReview.industryName}</p>
            ) : null}
            </div>
            <a href={discoveryHref} className="wda-setup-back">
              <CTCIcon name="arrow" /> Return to Discovery
            </a>
          </section>
        ) : (
          <section className="wda-setup-selected">
            <div>
              <div className="wda-setup-selected-label"><CTCIcon name="target" />Targeting profile</div>
              <h2>{buyer.name || 'Your business, your focus'}</h2>
              <p>{state.hasTargeting ? 'Your saved industries and delivery preferences.' : 'Choose the work you can deliver, then define the opportunities you want to find.'}</p>
            </div>
          </section>
        )}
        {!discoveryReview && !state.hasTargeting ? (
        <div className="wda-setup-discovery-link">
          <a className="wda-setup-back"
            href={discoveryHref}
          >
            Explore with the Niche Advisor <CTCIcon name="arrow" />
          </a>
        </div>
        ) : null}
        </aside>
        <div className="wda-setup-primary">
        <NicheForm
          token={token}
          initial={publicBuyerProfile(discoveryReview ? { ...buyer, naics: discoveryReview.naics } : buyer)}
          discoveryReview={discoveryReview}
          reviewMode={state.hasTargeting}
          readOnly={state.reviewOnly}
          updateMode={state.updateMode}
          expandedEditors={!state.reviewOnly}
          editHref={state.reviewOnly ? `${buyerPagePath('setup', token)}${buyer.status === 'exploring' ? '?targeting=1' : '?update=1'}` : undefined}
          editLabel={buyer.status === 'exploring' ? 'Edit Targeting' : 'Update for Future Batches'}
          ctaLabel={state.reviewOnly ? 'Back to Contracts' : state.updateMode ? 'Save for Future Batches' : state.hasTargeting ? 'Confirm Targeting' : 'Save Targeting'}
          afterSaveHref={buyerPagePath(state.reviewOnly || state.updateMode ? 'contracts' : 'start', token)}
        />
        <SetupGuide readOnly={state.reviewOnly} updateMode={state.updateMode} />
        </div>
        </div>
      </SetupWorkspace>
    </Shell>
  );
}
