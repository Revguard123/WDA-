import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import DiscoveryForm from '../../_components/DiscoveryForm.jsx';
import SupportCTA from '../../_components/SupportCTA.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer, publicDiscoverySession } from '../../../lib/discoverySessions.js';
import { UI, DISPLAY_FONT } from '../../../lib/ui.js';
import { discoverStateForBuyer } from '../../../lib/journey.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DiscoverPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="discovery link" />;
  const state = discoverStateForBuyer(buyer);
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);

  return (
    <Shell subtitle="Not sure what to go after? Find the niche that fits you.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, color: UI.ink, fontFamily: DISPLAY_FONT, letterSpacing: '-0.3px' }}>
          Niche discovery
        </h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          Answer a few focused questions so we can understand what you can perform or source, where you can work, and
          what kind of contracts you actually want to pursue. You can leave and come back; your progress saves as you go.
        </p>
        <DiscoveryForm token={token} initial={buyer} initialSession={publicDiscoverySession(session)} />
      </div>

      <div style={{ marginTop: 18, fontSize: 14, color: UI.muted }}>
        Already know your niche? <a href={`/setup/${token}?targeting=1`} style={{ color: UI.ink, fontWeight: 700 }}>Build your targeting profile</a>.
      </div>
      <SupportCTA pageContext="discovery" />
    </Shell>
  );
}
