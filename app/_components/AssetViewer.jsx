import { UI, BODY_FONT } from '../../lib/ui.js';

// A minimal, unlisted asset page: branded chrome, the infographic shown large,
// and a Download button. Used for the hidden sales one-pagers. No login, no
// navigation into the rest of the app. Pages that use this set robots noindex.
export default function AssetViewer({ src, downloadName, eyebrow, title }) {
  const btn = {
    background: UI.pink,
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 800,
    borderRadius: 10,
    display: 'inline-block',
    fontFamily: BODY_FONT,
  };
  return (
    <div style={{ minHeight: '100vh', background: '#0b0b0d', color: '#fff', fontFamily: BODY_FONT, padding: '0 0 64px' }}>
      <div style={{ height: 4, background: UI.pink }} />
      <div style={{ height: 3, background: UI.orange }} />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <img
            src="/brand/wda-logo.png"
            alt="War Dogs Academy"
            width={160}
            style={{ width: 160, maxWidth: '52%', height: 'auto', display: 'block' }}
          />
          <a href={src} download={downloadName} style={{ ...btn, fontSize: 14, padding: '11px 18px' }}>
            Download
          </a>
        </div>

        {eyebrow ? (
          <div style={{ color: UI.pink, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', fontSize: 12, marginBottom: 12 }}>
            {eyebrow}
          </div>
        ) : null}

        <img
          src={src}
          alt={title || 'War Dogs Academy'}
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid #23232a', boxShadow: '0 24px 70px rgba(0,0,0,0.55)' }}
        />

        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <a href={src} download={downloadName} style={{ ...btn, fontSize: 15.5, padding: '14px 30px' }}>
            Download the one-pager
          </a>
        </div>
      </div>
    </div>
  );
}
