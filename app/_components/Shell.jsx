import { UI, DISPLAY_FONT, BODY_FONT } from '../../lib/ui.js';

// Branded page chrome for buyer-facing pages (server component).
// Light editorial header: pink+orange edge stripe, the Zuume logo on white,
// a short pink rule, then the product eyebrow. Matches the email brief.
export default function Shell({ children, maxWidth = 660, subtitle, locked = false }) {
  return (
    <div style={{ background: UI.paper, minHeight: '100vh', height: locked ? '100dvh' : undefined, overflow: locked ? 'hidden' : 'hidden auto', padding: locked ? 0 : '0 0 60px', display: locked ? 'flex' : undefined, flexDirection: locked ? 'column' : undefined, fontFamily: BODY_FONT, maxWidth: '100%' }}>
      <style>{`.shell-brand-header{background:${UI.card};border-bottom:1px solid ${UI.line};padding:26px 24px 22px}.shell-brand-logo{display:block;width:210px;max-width:70%;height:auto;margin:0 auto}.shell-brand-rule{height:3px;width:60px;background:${UI.pink};margin:16px auto 0}.shell-brand-eyebrow{color:${UI.ink};font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-top:14px;font-family:${BODY_FONT}}.shell-brand-subtitle{color:${UI.muted};font-size:14px;margin-top:6px}@media(max-width:600px){.shell-brand-header{padding:18px 16px 14px}.shell-brand-logo{width:145px;max-width:55%}.shell-brand-rule{width:48px;margin-top:10px}.shell-brand-eyebrow{font-size:10px;letter-spacing:2.2px;margin-top:10px}.shell-brand-subtitle{font-size:12px;margin-top:5px}}`}</style>
      <div style={{ height: 4, background: UI.pink }} />
      <div style={{ height: 3, background: UI.orange }} />
      <div className="shell-brand-header">
        <div style={{ width: '100%', maxWidth, margin: '0 auto', textAlign: 'center', boxSizing: 'border-box' }}>
          <img
            src="/brand/wda-logo.png"
            alt="War Dogs Academy"
            width={210}
            className="shell-brand-logo"
          />
          <div className="shell-brand-rule" />
          <div className="shell-brand-eyebrow">
            The Target Brief
          </div>
          {subtitle ? (
            <div className="shell-brand-subtitle">{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div style={{ width: '100%', maxWidth, margin: '0 auto', padding: locked ? 0 : '28px 24px', flex: locked ? '1 1 auto' : undefined, minHeight: locked ? 0 : undefined, overflow: locked ? 'hidden' : undefined, boxSizing: 'border-box' }}>{children}</div>
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
