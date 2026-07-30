import Shell from '../_components/Shell.jsx';
import AccessForm from '../_components/AccessForm.jsx';
import { UI, DISPLAY_FONT } from '../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Magic-link re-entry page. Linked from the Kajabi product so members can reach
// their contracts without a login: they enter their email, we send the link.
export default function AccessPage() {
  return (
    <Shell subtitle="Get back to your contracts.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 12, borderTop: `4px solid ${UI.orange}`, padding: 28 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, color: UI.ink, fontFamily: DISPLAY_FONT, letterSpacing: '-0.4px' }}>
          Open your contracts
        </h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
          War Dogs Academy has no logins. Enter the same email you used to sign up for War Dogs Academy and we will
          send your private link straight to your inbox. It works for your contracts, your targeting, and your setup if
          you have not started yet.
        </p>
        <div style={{ background: '#fff3e6', border: `1px solid #ffd9b0`, borderLeft: `3px solid ${UI.orange}`, borderRadius: '0 8px 8px 0', padding: '12px 15px', marginTop: 14 }}>
          <p style={{ color: UI.orangeDeep, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            Use your War Dogs Academy signup email and you can open your contracts right here. With any other email,
            this page cannot find you, and you can only reach your contracts through the links in the emails we send you.
          </p>
        </div>
        <div style={{ marginTop: 18 }}>
          <AccessForm />
        </div>
      </div>
    </Shell>
  );
}
