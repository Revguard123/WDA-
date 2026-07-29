import { UI, DISPLAY_FONT, BODY_FONT } from '../../lib/ui.js';

// Branded page chrome for buyer-facing pages (server component).
// Light editorial header: pink+orange edge stripe, the Zuume logo on white,
// a short pink rule, then the product eyebrow. Matches the email brief.
export default function Shell({ children, maxWidth = 660, subtitle }) {
  return (
    <div style={{ background: UI.paper, minHeight: '100vh', padding: '0 0 60px', fontFamily: BODY_FONT }}>
      <div style={{ height: 4, background: UI.pink }} />
      <div style={{ height: 3, background: UI.orange }} />
      <div style={{ background: UI.card, borderBottom: `1px solid ${UI.line}`, padding: '26px 24px 22px' }}>
        <div style={{ maxWidth, margin: '0 auto', textAlign: 'center' }}>
          <img
            src="/brand/wda-logo.png"
            alt="War Dogs Academy"
            width={210}
            style={{ display: 'block', width: 210, maxWidth: '70%', height: 'auto', margin: '0 auto' }}
          />
          <div style={{ height: 3, width: 60, background: UI.pink, margin: '16px auto 0' }} />
          <div
            style={{
              color: UI.ink,
              fontSize: 12,
              letterSpacing: 3,
              textTransform: 'uppercase',
              fontWeight: 800,
              marginTop: 14,
              fontFamily: BODY_FONT,
            }}
          >
            The Target Brief
          </div>
          {subtitle ? (
            <div style={{ color: UI.muted, fontSize: 14, marginTop: 6 }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div style={{ maxWidth, margin: '0 auto', padding: '28px 24px' }}>{children}</div>
    </div>
  );
}

export function NotFound({ what = 'link' }) {
  return (
    <Shell>
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 12, borderTop: `4px solid ${UI.orange}`, padding: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: UI.ink, fontFamily: DISPLAY_FONT, letterSpacing: '-0.3px' }}>This {what} is not valid</h1>
        <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.5 }}>
          The link may have expired or been mistyped. Check the most recent email we sent you, or contact us and we will send a fresh link.
        </p>
      </div>
    </Shell>
  );
}
