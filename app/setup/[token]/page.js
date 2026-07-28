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
          The more precisely you describe what you do, the sharper your matches. Saving here sets your targeting.
          It does not pull contracts. Your first five are pulled when you hit Go.
        </p>
        <NicheForm
          token={token}
          initial={buyer}
          ctaLabel="Save my niche"
        />
      </div>

      {exploring ? (
        <div style={{ marginTop: 20, background: '#eef6f1', border: `1px solid ${UI.green}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, color: UI.ink, fontSize: 16 }}>Ready to see your targets?</div>
          <p style={{ color: UI.text, fontSize: 14, margin: '6px 0 14px' }}>
            When your niche looks right, start your free trial and we pull your first five contracts.
          </p>
          <a href={`/start/${token}`} style={{ display: 'inline-block', background: UI.green, color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '11px 20px', borderRadius: 8, fontSize: 15 }}>
            Continue to Go
          </a>
        </div>
      ) : (
        <div style={{ marginTop: 20, fontSize: 14, color: UI.muted }}>
          Your trial is active. <a href={`/contracts/${token}`} style={{ color: UI.ink, fontWeight: 700 }}>See your contracts</a>.
        </div>
      )}
    </Shell>
  );
}
