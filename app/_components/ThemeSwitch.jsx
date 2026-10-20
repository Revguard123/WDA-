'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEME_KEY, resolveTheme } from '../../lib/theme.js';

// One switch for the whole app. Shared headers/sidebar offer a placement slot;
// unlisted pages without chrome retain a small, fixed fallback control.
export default function ThemeSwitch() {
  const id = useId();
  const [dark, setDark] = useState(false);
  const [slot, setSlot] = useState(null);
  const preference = useRef(null);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const mobile = window.matchMedia('(max-width: 600px)');
    const root = document.documentElement;
    function apply(preference) {
      const theme = resolveTheme(preference, system.matches);
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
      setDark(theme === 'dark');
    }
    function stored() {
      try { return window.localStorage.getItem(THEME_KEY); } catch { return preference.current; }
    }
    function place() {
      const target = mobile.matches
        ? document.querySelector('[data-theme-slot-mobile], [data-theme-slot]')
        : document.querySelector('[data-theme-slot]');
      setSlot((previous) => previous === target ? previous : target);
    }
    function sync(event) {
      if (event && event.type === 'storage' && event.key !== THEME_KEY && event.key !== null) return;
      preference.current = stored();
      apply(preference.current);
    }
    sync();
    place();
    // Handles streamed markup and client navigation without adding theme state
    // to page components or losing it when a modal/conversation is opened.
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    system.addEventListener('change', sync);
    mobile.addEventListener('change', place);
    window.addEventListener('storage', sync);
    return () => {
      observer.disconnect();
      system.removeEventListener('change', sync);
      mobile.removeEventListener('change', place);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function toggle(event) {
    const next = event.target.checked ? 'dark' : 'light';
    preference.current = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setDark(next === 'dark');
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* Still switches for this visit. */ }
  }

  const control = (
    <label className={`wda-theme-switch${slot ? '' : ' is-floating'}`} htmlFor={id} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <input id={id} type="checkbox" role="switch" aria-label="Dark mode" checked={dark} onChange={toggle} />
      <svg viewBox="0 0 69.667 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <g transform="translate(3.5 3.5)">
          <rect className="wda-theme-sky" fill="#83cbd8" rx="17.5" height="35" width="60.667" />
          <g className="wda-theme-orb" transform="translate(2.333 2.333)">
            <g className="wda-theme-sun">
              <circle fill="#f8e664" r="15.167" cy="15.167" cx="15.167" />
              <circle fill="rgba(246,254,247,.29)" r="11.667" cy="15.167" cx="15.167" />
              <circle fill="#fcf4b9" r="7" cy="15.167" cx="15.167" />
            </g>
            <g className="wda-theme-moon">
              <circle fill="#cce6ee" r="15.167" cy="15.167" cx="15.167" />
              <g fill="#a6cad0"><circle cx="20.6" cy="5.5" r="2" /><circle cx="17" cy="19" r="2" /><circle cx="10.6" cy="9.1" r="1" /><circle cx="28.7" cy="19.9" r="1" /><circle cx="10.6" cy="23.5" r="1" /><circle cx="27.7" cy="11.5" r="1.5" /></g>
            </g>
          </g>
          <path className="wda-theme-cloud" fill="#fff" transform="translate(-3469.97 -164.44)" d="M3512.81,173.815a4.463,4.463,0,0,1,2.243.62.95.95,0,0,1,.72-1.281,4.852,4.852,0,0,1,2.623.519c.034.02-.5-1.968.281-2.716a2.117,2.117,0,0,1,2.829-.274,1.821,1.821,0,0,1,.854,1.858c.063.037,2.594-.049,3.285,1.273s-.865,2.544-.807,2.626a12.192,12.192,0,0,1,2.278.892c.553.448,1.106,1.992-1.62,2.927a7.742,7.742,0,0,1-3.762-.3c-1.28-.49-1.181-2.65-1.137-2.624s-1.417,2.2-2.623,2.2a4.172,4.172,0,0,1-2.394-1.206,3.825,3.825,0,0,1-2.771.774c-3.429-.46-2.333-3.267-2.2-3.55A3.721,3.721,0,0,1,3512.81,173.815Z" />
          <g className="wda-theme-stars" fill="#def8ff" transform="translate(3.585 1.325)">
            <path transform="matrix(-1,.017,-.017,-1,24.231,3.055)" d="M.774,0,.566.559,0,.539.458.933.25,1.492l.485-.361.458.394L1.024.953,1.509.592.943.572Z" />
            <path transform="translate(22,12)" d="M1.341.529.836.472.736,0,.505.46,0,.4.4.729l-.231.46L.605.932l.4.326L.9.786Z" />
            <path transform="translate(23,29)" d="M.015,1.065.475.9l.285.365L.766.772l.46-.164L.745.494.751,0,.481.407,0,.293.285.658Z" />
            <path transform="translate(12,.388)" d="M1.161,1.6,1.059,1,1.574.722.962.607.86,0,.613.572,0,.457.446.881.2,1.454l.516-.274Z" />
            <path transform="translate(11,15)" d="M.873,1.648l.114-.62L1.579.945,1.03.62,1.144,0,.706.464.157.139.438.7,0,1.167l.592-.083Z" />
            <path transform="translate(8,28)" d="M.593,0,.638.724,0,.982l.7.211.045.724.36-.64.7.211L1.342.935,1.7.294,1.063.552Z" />
            <path transform="translate(5,6)" d="M.816,0,.5.455,0,.311.323.767l-.312.455.516-.215.323.456L.827.911,1.343.7.839.552Z" />
            <path transform="translate(2,15)" d="M1.261,0,.774.571.114.3.487.967,0,1.538.728,1.32l.372.662.047-.749.728-.218L1.215.749Z" />
          </g>
        </g>
      </svg>
      <span className="wda-theme-accessible">{dark ? 'Dark mode on' : 'Dark mode off'}</span>
    </label>
  );
  return slot ? createPortal(control, slot) : control;
}
