import Shell, { NotFound } from '../../_components/Shell.jsx';
import NicheForm from '../../_components/NicheForm.jsx';
import SetupWorkspace from '../../_components/SetupWorkspace.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { UI } from '../../../lib/ui.js';
import { buyerPagePath, publicBuyerProfile } from '../../../lib/buyerUrls.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TargetingPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="targeting link" />;

  return (
    <Shell maxWidth="100%" hideHeader locked>
      <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} supportEmail={process.env.SUPPORT_TO_EMAIL || ''} pageContext="targeting_review" activePage="targeting" updateMode discoveryHref={buyerPagePath('discover', token) + (buyer.status === 'exploring' ? '' : '?update=1')}>
      <div className="targeting-page-panel" style={{ padding: 28 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, color: UI.ink }}>Update your targeting</h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          Change your niche any time. Updates apply to your next cycle. Saving does not pull new contracts now,
          and your current cycle stays locked so nothing you are working on disappears.
        </p>
        <NicheForm token={token} initial={publicBuyerProfile(buyer)} ctaLabel="Save targeting" />
      </div>
      <div style={{ marginTop: 18, fontSize: 14, color: UI.muted }}>
        <a href={buyerPagePath('contracts', token)} style={{ color: UI.ink, fontWeight: 600 }}>Back to your contracts</a>
      </div>
      </SetupWorkspace>
    </Shell>
  );
}
