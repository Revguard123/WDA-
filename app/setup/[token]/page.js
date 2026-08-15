import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import NicheForm from '../../_components/NicheForm.jsx';
import SupportCTA from '../../_components/SupportCTA.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer } from '../../../lib/discoverySessions.js';
import { discoveryTargetingReviewState } from '../../../lib/setupDiscoveryState.js';
import { UI } from '../../../lib/ui.js';
import { setupStateForBuyer } from '../../../lib/journey.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SetupPage({ params, searchParams }) {
  const { token } = params;
  const sp = (await searchParams) || {};
  const directTargeting = sp.targeting === '1';
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="setup link" />;

  const state = setupStateForBuyer(buyer, { directTargeting });
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);
  if (state.showChoice && !directTargeting && session && (session.current_step > 1 || session.status !== 'in_progress')) {
    redirect(`/discover/${token}`);
  }
  const discoveryReview = discoveryTargetingReviewState({ session, buyer });

  if (state.showChoice) {
    return (
      <Shell subtitle="Set the target before we pull contracts.">
        <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 24, color: UI.ink }}>Start Your Curated Target Contracts</h1>
          <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
            First, choose how you want to build the targeting profile we will use for your contract search.
          </p>

          <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            <a
              href={`/discover/${token}`}
              style={{ display: 'block', color: UI.text, textDecoration: 'none', border: `1px solid ${UI.line}`, borderLeft: `4px solid ${UI.pink}`, borderRadius: 8, padding: 18, background: UI.paper }}
            >
              <div style={{ color: UI.ink, fontSize: 18, fontWeight: 800 }}>Help me discover my niche</div>
              <div style={{ color: UI.muted, fontSize: 14, lineHeight: 1.5, marginTop: 5 }}>
                For students who are not sure which industry or service area they should pursue.
              </div>
            </a>

            <a
              href={`/setup/${token}?targeting=1`}
              style={{ display: 'block', color: UI.text, textDecoration: 'none', border: `1px solid ${UI.line}`, borderLeft: `4px solid ${UI.orange}`, borderRadius: 8, padding: 18, background: '#fff' }}
            >
              <div style={{ color: UI.ink, fontSize: 18, fontWeight: 800 }}>I already know my niche</div>
              <div style={{ color: UI.muted, fontSize: 14, lineHeight: 1.5, marginTop: 5 }}>
                For students who already know what type of work or industry they want to target.
              </div>
            </a>
          </div>
        </div>
        <SupportCTA pageContext="targeting_setup" />
      </Shell>
    );
  }

  return (
    <Shell subtitle="Confirm the targeting profile we should use.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, color: UI.ink }}>
          {state.hasTargeting ? 'Review Your Targeting' : 'Build Your Targeting Profile'}
        </h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          {discoveryReview
            ? 'You picked this niche from Discovery. Review the official NAICS, keywords, set-asides, service area, and contract size before you move to the explicit Start step.'
            : state.hasTargeting
            ? 'Review the industries, keywords, set-asides, service area, and contract size we should use. Confirming saves your targeting, then you will decide when to start.'
            : 'Describe the work or industry you want to target. Saving this profile will take you to the final start step before any contracts are pulled.'}
        </p>
        {discoveryReview ? (
          <div style={{ background: UI.paper, border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.pink}`, borderRadius: '0 8px 8px 0', padding: '14px 16px', margin: '14px 0 6px' }}>
            <div style={{ fontSize: 12, color: UI.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              Selected War Dogs niche
            </div>
            <div style={{ marginTop: 6, color: UI.ink, fontSize: 17, fontWeight: 800 }}>
              {discoveryReview.subindustryName || 'Selected niche'}
            </div>
            {discoveryReview.industryName ? (
              <div style={{ color: UI.muted, fontSize: 13.5, marginTop: 2 }}>{discoveryReview.industryName}</div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {discoveryReview.naics.map((n) => (
                <span key={n.code} style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, color: UI.ink, background: '#fff', border: `1px solid ${UI.line}`, borderRadius: 6, padding: '5px 10px' }}>
                  NAICS {n.code}{n.title ? ` · ${n.title}` : ''}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {!discoveryReview && !state.hasTargeting ? (
        <div style={{ margin: '2px 0 4px' }}>
          <a
            href={`/discover/${token}`}
            style={{ display: 'inline-block', color: UI.pinkDeep, fontWeight: 800, fontSize: 13.5, textDecoration: 'none', border: `1px solid ${UI.pink}`, borderRadius: 8, padding: '8px 13px' }}
          >
            Not sure what to go after? Discover your niche &rarr;
          </a>
        </div>
        ) : null}
        <NicheForm
          token={token}
          initial={discoveryReview ? { ...buyer, naics: discoveryReview.naics } : buyer}
          discoveryReview={discoveryReview}
          reviewMode={state.hasTargeting}
          ctaLabel={state.hasTargeting ? 'Confirm Targeting' : 'Save Targeting'}
          afterSaveHref={`/start/${token}`}
        />
      </div>
      <SupportCTA pageContext={state.hasTargeting ? 'targeting_review' : 'targeting_setup'} />
    </Shell>
  );
}
