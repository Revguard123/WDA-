// A single rounded, slimmer silhouette, tilted slightly further left. Position
// remains native, so animating its fill never adds a delayed pointer follower.
export const CURSOR_SCALE = 2 / 3;
const pointerTip = [5, 4];
export const CURSOR_HOTSPOT = pointerTip.map((coordinate) => Math.round(coordinate * CURSOR_SCALE));
export const CURSOR_PALETTE = Object.freeze({ pink: '#FF78C7', orange: '#FFB477' });
export const CURSOR_FRAME_COUNT = 90;
export const CURSOR_FRAME_MS = 50;
const bodyPath = 'M7.5 3.1C5.2 1.6 3.3 3 3.7 5.7L6.4 28.7C6.7 31.5 9.7 32.1 11.3 29.8L17.4 21.4C18 20.5 19 20 20.1 20.1L27.1 20.5C30.1 20.7 31.3 17 28.7 15.2L7.5 3.1Z';
const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));

// Hotspots belong to the actual pointer tip, text stem or tool center, never
// the corner of an icon. Keep the native equivalent if an asset cannot load.
// Keep vector coordinates unchanged; scale every tool and hotspot together.
const desktopCursor = (property, fallback, viewWidth, viewHeight, tip = pointerTip) => ({
  property, fallback, viewWidth, viewHeight,
  width: Math.ceil(viewWidth * CURSOR_SCALE), height: Math.ceil(viewHeight * CURSOR_SCALE),
  hotspot: tip.map((coordinate) => Math.round(coordinate * CURSOR_SCALE)),
});
export const CURSOR_STATES = Object.freeze({
  default: desktopCursor('--wda-cursor', 'auto', 34, 36),
  action: desktopCursor('--wda-cursor-action', 'pointer', 34, 36),
  wait: desktopCursor('--wda-cursor-wait', 'wait', 48, 44),
  progress: desktopCursor('--wda-cursor-progress', 'progress', 48, 44),
  disabled: desktopCursor('--wda-cursor-disabled', 'not-allowed', 48, 44),
  text: desktopCursor('--wda-cursor-text', 'text', 20, 32, [10, 16]),
  grab: desktopCursor('--wda-cursor-grab', 'grab', 32, 36, [16, 16]),
  grabbing: desktopCursor('--wda-cursor-grabbing', 'grabbing', 32, 36, [16, 16]),
  move: desktopCursor('--wda-cursor-move', 'move', 32, 32, [16, 16]),
  'ew-resize': desktopCursor('--wda-cursor-ew-resize', 'ew-resize', 32, 32, [16, 16]),
  'ns-resize': desktopCursor('--wda-cursor-ns-resize', 'ns-resize', 32, 32, [16, 16]),
  'nesw-resize': desktopCursor('--wda-cursor-nesw-resize', 'nesw-resize', 32, 32, [16, 16]),
  'nwse-resize': desktopCursor('--wda-cursor-nwse-resize', 'nwse-resize', 32, 32, [16, 16]),
  'zoom-in': desktopCursor('--wda-cursor-zoom-in', 'zoom-in', 32, 32, [13, 13]),
  'zoom-out': desktopCursor('--wda-cursor-zoom-out', 'zoom-out', 32, 32, [13, 13]),
  help: desktopCursor('--wda-cursor-help', 'help', 48, 44),
  copy: desktopCursor('--wda-cursor-copy', 'copy', 48, 44),
});

const pointer = `<g transform="rotate(-12 5 4)"><path fill="url(#brand)" d="${bodyPath}"/></g>`;
const stroke = 'fill="none" stroke="url(#brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const horizontalResize = '<path d="M4 16h24M10 10l-6 6 6 6M22 10l6 6-6 6"/>';

function stateShape(state) {
  if (state === 'default' || state === 'action') return pointer;
  if (state === 'wait' || state === 'progress') {
    // An open, segmented brand ring distinguishes a working control.
    return `${pointer}<g ${stroke}><path opacity=".3" d="M38 26a7 7 0 1 1-7 7"/><path d="M31 33a7 7 0 0 1 7-7"/><path d="M45 33a7 7 0 0 1-7 7"/></g>`;
  }
  if (state === 'disabled') return `${pointer}<g ${stroke}><circle cx="38" cy="33" r="7"/><path d="m33 28 10 10"/></g>`;
  if (state === 'text') return `<path ${stroke} d="M10 5v22M5 5h10M5 27h10"/>`;
  if (state === 'copy') return `${pointer}<g ${stroke}><path d="M38 27v12M32 33h12"/></g>`;
  if (state === 'help') return `${pointer}<g ${stroke}><path d="M34 29c0-5 8-5 8 0 0 3-4 3-4 6"/><path d="M38 39h.01"/></g>`;
  if (state === 'grab' || state === 'grabbing') {
    const hand = state === 'grab'
      ? 'M8 20V10c0-3 4-3 4 0V6c0-3 4-3 4 0v2c0-3 4-3 4 0v3c0-3 4-3 4 0v9c0 7-3 11-9 11-4 0-6-2-8-5l-4-6c-2-3 1-5 3-3l5 5'
      : 'M8 18v-5c0-3 4-3 4 0v-2c0-3 4-3 4 0v1c0-3 4-3 4 0v2c0-3 4-3 4 0v7c0 7-3 10-9 10-4 0-6-2-8-5l-3-5c-2-3 1-5 3-3l4 4';
    return `<path ${stroke} d="${hand}"/>`;
  }
  if (state.startsWith('zoom-')) return `<g ${stroke}><circle cx="13" cy="13" r="9"/><path d="m20 20 9 9M9 13h8${state === 'zoom-in' ? 'M13 9v8' : ''}"/></g>`;
  if (state === 'move') return `<g ${stroke}>${horizontalResize}<path d="M16 4v24M10 10l6-6 6 6M10 22l6 6 6-6"/></g>`;
  const angle = { 'ew-resize': 0, 'ns-resize': 90, 'nesw-resize': -45, 'nwse-resize': 45 }[state];
  return `<g ${stroke} transform="rotate(${angle} 16 16)">${horizontalResize}</g>`;
}

export function cursorValue({ pink, orange }, variant = false, phase = 0) {
  // Retain the original boolean API while exposing semantic tool variants.
  const state = typeof variant === 'string' && Object.hasOwn(CURSOR_STATES, variant) ? variant : variant === true ? 'action' : 'default';
  const interactive = state === 'action';
  const { width, height, viewWidth, viewHeight, hotspot, fallback } = CURSOR_STATES[state];
  const start = xml(interactive ? orange : pink);
  const end = xml(interactive ? pink : orange);
  const normalizedPhase = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;
  const angle = (normalizedPhase * 360).toFixed(3);
  // A rotating, continuous pink/peach ribbon is baked into each native frame.
  // SVG animation inside CSS cursor images is not consistently supported.
  const gradient = `<defs><linearGradient id="brand" x1="0" y1="0" x2="${viewWidth}" y2="${viewHeight}" gradientUnits="userSpaceOnUse" gradientTransform="rotate(${angle} ${viewWidth / 2} ${viewHeight / 2})"><stop stop-color="${start}"/><stop offset=".5" stop-color="${end}"/><stop offset="1" stop-color="${start}"/></linearGradient></defs>`;
  const shape = stateShape(state);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" shape-rendering="geometricPrecision">${gradient}${shape}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot.join(' ')},${fallback}`;
}

export function installThemeCursor(doc, win) {
  const root = doc.documentElement;
  const properties = Object.values(CURSOR_STATES).map(({ property }) => property);
  const previous = properties.map((key) => [key, root.style.getPropertyValue(key), root.style.getPropertyPriority(key)]);
  // Keep the requested bright dark-mode palette identical in both themes.
  // Cache assets by phase; no pointer tracking, React rerenders or network work.
  const frames = new Map();
  let frame = 0;
  let timer = null;
  let disposed = false;
  let focused = doc.hasFocus?.() ?? true;
  function paint(index) {
    if (!frames.has(index)) frames.set(index, Object.entries(CURSOR_STATES).map(([state, { property }]) => [property, cursorValue(CURSOR_PALETTE, state, index / CURSOR_FRAME_COUNT)]));
    for (const [property, value] of frames.get(index)) root.style.setProperty(property, value);
  }
  paint(0);
  const finePointer = win.matchMedia?.('(hover: hover) and (pointer: fine) and (forced-colors: none) and (prefers-contrast: no-preference)');
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const stop = () => {
    if (timer !== null) win.clearInterval(timer);
    timer = null;
  };
  const sync = () => {
    const animate = !disposed && finePointer?.matches && !reducedMotion?.matches && !doc.hidden && focused && win.setInterval;
    if (!animate) {
      stop();
      if (reducedMotion?.matches) { frame = 0; paint(0); }
      return;
    }
    if (timer === null) timer = win.setInterval(() => {
      frame = (frame + 1) % CURSOR_FRAME_COUNT;
      paint(frame);
    }, CURSOR_FRAME_MS);
  };
  const focus = () => { focused = true; sync(); };
  const blur = () => { focused = false; sync(); };
  finePointer?.addEventListener('change', sync);
  reducedMotion?.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('focus', focus);
  win.addEventListener('blur', blur);
  sync();
  return () => {
    disposed = true;
    stop();
    finePointer?.removeEventListener('change', sync);
    reducedMotion?.removeEventListener('change', sync);
    doc.removeEventListener('visibilitychange', sync);
    win.removeEventListener('focus', focus);
    win.removeEventListener('blur', blur);
    frames.clear();
    for (const [key, value, priority] of previous) {
      if (value) root.style.setProperty(key, value, priority);
      else root.style.removeProperty(key);
    }
  };
}
