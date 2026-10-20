import { UI, BODY_FONT } from '../../lib/ui.js';
import RecoveryScreen from './RecoveryScreen.jsx';

// Shared chrome for buyer-facing pages. Discovery uses hideHeader + locked and
// supplies its own app header; other pages keep the existing branded header.
export default function Shell({
  children,
  maxWidth = 660,
  subtitle,
  locked = false,
  supportBar = null,
  hideHeader = false,
}) {
  const fullscreen = locked || hideHeader;
  return (
    <div className="wda-shell" style={{
      background: hideHeader ? '#FDFBF9' : UI.paper,
      minHeight: '100vh',
      height: fullscreen ? '100dvh' : undefined,
      overflow: fullscreen ? 'hidden' : 'hidden auto',
      padding: fullscreen ? 0 : '0 0 60px',
      display: fullscreen ? 'flex' : undefined,
      flexDirection: fullscreen ? 'column' : undefined,
      fontFamily: BODY_FONT,
      maxWidth: '100%',
      minWidth: 0,
    }}>
      <style>{`
        .shell-brand-header{background:${UI.card};border-bottom:1px solid ${UI.line};padding:26px 24px 22px}
        .shell-brand-logo{display:block;width:210px;max-width:70%;height:auto;margin:0 auto}
        .shell-brand-rule{height:3px;width:60px;background:${UI.pink};margin:16px auto 0}
        .shell-brand-eyebrow{color:${UI.ink};font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-top:14px;font-family:${BODY_FONT}}
        .shell-support-spacer{display:none}
        @media(max-width:600px){
          .shell-brand-header{padding:18px 16px 14px}
          .shell-brand-logo{width:145px;max-width:55%}
          .shell-brand-rule{width:48px;margin-top:10px}
          .shell-brand-eyebrow{font-size:10px;letter-spacing:2.2px;margin-top:10px}
          .shell-brand-subtitle{font-size:12px;margin-top:5px}
        }
      `}</style>
      {!hideHeader && <div style={{height:4,background:UI.pink}} />}
      {!hideHeader && <div style={{height:3,background:UI.orange}} />}
      {supportBar}
      {!hideHeader && (
        <div className="shell-brand-header">
          <span className="wda-shell-theme" data-theme-slot="" />
          <div style={{width:'100%',maxWidth,margin:'0 auto',textAlign:'center',boxSizing:'border-box'}}>
            <img src="/brand/wda-logo.png" alt="War Dogs Academy" width={210} className="shell-brand-logo" />
            <div className="shell-brand-rule" />
            <div className="shell-brand-eyebrow">The Target Brief</div>
            {subtitle ? <div className="shell-brand-subtitle">{subtitle}</div> : null}
          </div>
        </div>
      )}
      <div style={{
        width: '100%',
        maxWidth: hideHeader ? '100%' : maxWidth,
        margin: '0 auto',
        padding: fullscreen ? 0 : '28px 24px',
        flex: fullscreen ? '1 1 0%' : undefined,
        minWidth: 0,
        minHeight: fullscreen ? 0 : undefined,
        overflow: fullscreen ? 'hidden' : undefined,
        boxSizing: 'border-box',
      }}>
        {children}
      </div>
    </div>
  );
}

export function NotFound({ what = 'link' }) {
  return <RecoveryScreen variant={what === 'contract' ? 'contract' : 'link'} title={`This ${what} is not valid`} />;
}
