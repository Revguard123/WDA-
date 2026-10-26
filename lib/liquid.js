// Shared paint-only interactions: no React state, form changes or click handling.
export const LIQUID_SELECTOR = '.wda-btn, .contracts-button, .contracts-pill, [data-liquid]';

export function liquidHighlightPosition(clientX, clientY, bounds) {
  if (!bounds.width || !bounds.height) return null;
  const clamp = (value) => Math.max(0, Math.min(100, value));
  return {
    x: `${clamp((clientX - bounds.left) / bounds.width * 100).toFixed(1)}%`,
    y: `${clamp((clientY - bounds.top) / bounds.height * 100).toFixed(1)}%`,
  };
}

export function installLiquidHover(doc, win, { selector = LIQUID_SELECTOR } = {}) {
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = null;
  let pending = null;
  let active = null;
  const disabled = (surface) => surface.matches(':disabled, [aria-disabled="true"], [aria-busy="true"], .is-loading');
  const reset = () => {
    if (frame != null) win.cancelAnimationFrame(frame);
    frame = null;
    pending = null;
    active?.style.removeProperty('--liquid-x');
    active?.style.removeProperty('--liquid-y');
    active = null;
  };
  const move = (event) => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const surface = event.target.closest?.(selector);
    if (!surface || disabled(surface)) {
      reset();
      return;
    }
    const position = liquidHighlightPosition(event.clientX, event.clientY, surface.getBoundingClientRect());
    if (!position) return;
    if (active !== surface) reset();
    active = surface;
    pending = position;
    if (frame != null) return;
    frame = win.requestAnimationFrame(() => {
      frame = null;
      if (!active?.isConnected || disabled(active) || reducedMotion.matches || !pending) return;
      active.style.setProperty('--liquid-x', pending.x);
      active.style.setProperty('--liquid-y', pending.y);
      pending = null;
    });
  };
  const leave = (event) => {
    if (active && !active.contains(event.relatedTarget)) reset();
  };
  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerout', leave, { passive: true });
  reducedMotion.addEventListener('change', reset);
  return () => {
    reset();
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerout', leave);
    reducedMotion.removeEventListener('change', reset);
  };
}
