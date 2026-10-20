'use client';

import { useEffect, useState } from 'react';

const DISMISSAL_KEY = 'wda:reader:beta-dismissed';

export default function BetaNotice({ focusAfterDismissId }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { setDismissed(window.sessionStorage.getItem(DISMISSAL_KEY) === '1'); }
    catch { /* Storage can be disabled; dismissal still works for this view. */ }
  }, []);

  function dismiss() {
    setDismissed(true);
    try { window.sessionStorage.setItem(DISMISSAL_KEY, '1'); } catch { /* Optional persistence. */ }
    if (focusAfterDismissId) document.getElementById(focusAfterDismissId)?.focus();
  }

  if (dismissed) return null;
  return (
    <div className="ctc-reader-beta" role="note" aria-label="Beta announcement">
      <p><span>Beta</span> Your feedback helps us improve.</p>
      <button data-liquid="" type="button" onClick={dismiss} aria-label="Dismiss beta notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
