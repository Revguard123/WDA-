import Shell, { NotFound } from '../../_components/Shell.jsx';
import NicheForm from '../../_components/NicheForm.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { UI } from '../../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TargetingPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="targeting link" />;

  return (
    <Shell subtitle="Refine what we send you.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, color: UI.ink }}>Update your targeting</h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          Change your niche any time. Updates apply to your next cycle. Saving does not pull new contracts now,
          and your current cycle stays locked so nothing you are working on disappears.
        </p>
        <NicheForm token={token} initial={buyer} ctaLabel="Save targeting" />
      </div>
      <div style={{ marginTop: 18, fontSize: 14, color: UI.muted }}>
        <a href={`/contracts/${token}`} style={{ color: UI.ink, fontWeight: 600 }}>Back to your contracts</a>
      </div>
    </Shell>
  );
}
