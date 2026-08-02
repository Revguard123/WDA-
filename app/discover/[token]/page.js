import Shell, { NotFound } from '../../_components/Shell.jsx';
import DiscoveryForm from '../../_components/DiscoveryForm.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { UI, DISPLAY_FONT } from '../../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DiscoverPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="discovery link" />;

  return (
    <Shell subtitle="Not sure what to go after? Let us point you at a winnable niche.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, color: UI.ink, fontFamily: DISPLAY_FONT, letterSpacing: '-0.3px' }}>
          Niche discovery
        </h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          Tell us a little about yourself. We will suggest a few specific industries where you have an edge and the
          competition is thinner, each with the exact code the government uses for it. Pick the one that fits and we
          will start hunting contracts in it.
        </p>
        <DiscoveryForm token={token} initial={buyer} />
      </div>

      <div style={{ marginTop: 18, fontSize: 14, color: UI.muted }}>
        Already know your niche? <a href={`/setup/${token}`} style={{ color: UI.ink, fontWeight: 700 }}>Go straight to your niche workshop</a>.
      </div>
    </Shell>
  );
}
