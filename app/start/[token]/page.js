import Shell, { NotFound } from '../../_components/Shell.jsx';
import GoButton from '../../_components/GoButton.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { UI } from '../../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function StartPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="start link" />;

  const active = buyer.status !== 'exploring';

  return (
    <Shell>
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 32 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 26, color: UI.ink }}>This will start your free trial.</h1>
        <p style={{ color: UI.text, fontSize: 16, lineHeight: 1.6, marginTop: 0 }}>
          The moment you hit Go, your free trial begins and we pull your first five target contracts, hand-matched to
          everything you just told us. Ready to go to work?
        </p>

        {active ? (
          <div style={{ marginTop: 20, fontSize: 15, color: UI.green, fontWeight: 700 }}>
            Your trial is already active. <a href={`/contracts/${token}`} style={{ color: UI.ink }}>See your contracts</a>.
          </div>
        ) : (
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <GoButton token={token} />
            <a href={`/setup/${token}`} style={{ color: UI.muted, fontSize: 15, textDecoration: 'none', fontWeight: 600 }}>
              Not yet, keep exploring
            </a>
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 13, color: UI.muted, borderTop: `1px solid ${UI.line}`, paddingTop: 16 }}>
          You can keep refining your niche afterward, but your five contracts are locked for the cycle, so make it count.
        </p>
      </div>
    </Shell>
  );
}
