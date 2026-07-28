import { UI } from '../../lib/ui.js';

// Branded page chrome for buyer-facing pages (server component).
export default function Shell({ children, maxWidth = 640, subtitle }) {
  return (
    <div style={{ background: UI.paper, minHeight: '100vh', padding: '0 0 60px' }}>
      <div style={{ background: UI.ink, padding: '20px 24px' }}>
        <div style={{ maxWidth, margin: '0 auto' }}>
          <div style={{ color: UI.gold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
            War Dogs Academy
          </div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginTop: 2 }}>Curated Target Contracts</div>
          {subtitle ? <div style={{ color: '#aab0ba', fontSize: 14, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
      </div>
      <div style={{ maxWidth, margin: '0 auto', padding: '24px' }}>{children}</div>
    </div>
  );
}

export function NotFound({ what = 'link' }) {
  return (
    <Shell>
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: UI.ink }}>This {what} is not valid</h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.5 }}>
          The link may have expired or been mistyped. Check the most recent email we sent you, or contact us and we will send a fresh link.
        </p>
      </div>
    </Shell>
  );
}
