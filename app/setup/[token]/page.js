import Shell, { NotFound } from '../../_components/Shell.jsx';
import NicheForm from '../../_components/NicheForm.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { UI } from '../../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SetupPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="setup link" />;

  const exploring = buyer.status === 'exploring';

  return (
    <Shell subtitle="Tell us your niche. We match live federal contracts to it.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, color: UI.ink }}>Your niche workshop</h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          {exploring
            ? 'Describe your work and pick your industries below. When you hit the button we save your niche and pull your first five contracts right away, it takes about a minute.'
            : 'Change your niche any time. Updates apply to your next cycle; your current contracts stay put.'}
        </p>
        <div style={{ margin: '2px 0 4px' }}>
          <a
            href={`/discover/${token}`}
            style={{ display: 'inline-block', color: UI.pinkDeep, fontWeight: 800, fontSize: 13.5, textDecoration: 'none', border: `1px solid ${UI.pink}`, borderRadius: 8, padding: '8px 13px' }}
          >
            Not sure what to go after? Discover your niche &rarr;
          </a>
        </div>
        <NicheForm
          token={token}
          initial={buyer}
          ctaLabel={exploring ? 'Save & start my contracts' : 'Save my niche'}
          activateAfterSave={exploring}
        />
      </div>

      {!exploring ? (
        <div style={{ marginTop: 20, fontSize: 14, color: UI.muted }}>
          Your contracts are active. <a href={`/contracts/${token}`} style={{ color: UI.ink, fontWeight: 700 }}>See your contracts</a>.
        </div>
      ) : null}
    </Shell>
  );
}
