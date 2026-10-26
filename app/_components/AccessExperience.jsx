'use client';

import { useEffect, useState } from 'react';
import { ACCESS_MOTION_DURATION, consumeAccessMotion } from '../../lib/accessMotion.js';

export default function AccessExperience() {
  const [active, setActive] = useState(false);
  function finish() {
    if (document.activeElement?.closest('.wda-access-reveal')) {
      document.querySelector('.ctc-reader-breadcrumb a, .ctc-reader-breadcrumb [tabindex], .wda-setup-path, #workspace-content')?.focus({ preventScroll: true });
    }
    document.documentElement.removeAttribute('data-wda-access');
    setActive(false);
  }

  useEffect(() => {
    // Only a successfully resolved workspace can play the reveal. An account
    // error consumes the pending request silently; ordinary visits do not play.
    function check() {
      try {
        const workspace = Boolean(document.querySelector('.wda-setup-app.is-workspace, .wda-setup-app.is-path-choice'));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(forced-colors: active)').matches;
        if (consumeAccessMotion(window.sessionStorage, { workspace, reducedMotion })) setActive(true);
      } catch { /* Access and navigation must never depend on visual effects. */ }
    }
    // Wait for streamed server markup before deciding whether access succeeded.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
    else check();
    return () => document.removeEventListener('DOMContentLoaded', check);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const forced = window.matchMedia('(forced-colors: active)');
    const keydown = (event) => { if (event.key === 'Escape' || event.key === 'Tab') finish(); };
    const interact = (event) => { if (!event.target.closest('.wda-access-reveal')) finish(); };
    root.setAttribute('data-wda-access', 'revealing');
    const timer = window.setTimeout(finish, ACCESS_MOTION_DURATION);
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', interact, { passive: true });
    reduced.addEventListener('change', finish);
    forced.addEventListener('change', finish);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('pointerdown', interact);
      reduced.removeEventListener('change', finish);
      forced.removeEventListener('change', finish);
      root.removeAttribute('data-wda-access');
    };
  }, [active]);

  if (!active) return null;
  return (
    <div className="wda-access-reveal" onClick={(event) => {
      // Clicking the light bloom skips it; it must never click through to a
      // still-revealing action such as starting a contract batch.
      event.stopPropagation();
      finish();
    }}>
      <div className="wda-access-bloom" aria-hidden="true" />
      <div className="wda-access-perspective" aria-hidden="true">
        <div className="wda-access-gate">
          <span className="wda-access-plane is-back" />
          <span className="wda-access-plane is-middle" />
          <span className="wda-access-plane is-front">
            <svg viewBox="0 0 48 48" fill="none" focusable="false"><circle cx="24" cy="24" r="17" stroke="#E7D8CD" strokeWidth="1.3" /><circle cx="24" cy="24" r="9" stroke="#CB518D" strokeWidth="1.5" /><path d="M24 3v8M24 37v8M3 24h8M37 24h8" stroke="#C18351" strokeWidth="1.5" /><circle cx="24" cy="24" r="2.5" fill="#C81E86" /></svg>
            <span className="wda-access-rule" /><span className="wda-access-rule is-short" />
          </span>
        </div>
      </div>
      <p className="wda-access-caption" role="status">Your workspace is ready.</p>
      <button className="wda-access-skip" data-liquid="" type="button" onClick={finish}>Skip animation</button>
    </div>
  );
}
