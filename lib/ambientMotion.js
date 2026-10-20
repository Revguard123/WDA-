const ambientNames = new Set(['wdaPortalGlow', 'wdaAuroraRibbon']);

// Speed up the existing ambient animation without changing its current position
// or restarting it. Only the main pane's portal glows participate.
export function setAtmosphereThinking(atmosphere, thinking, { reducedMotion = false } = {}) {
  if (reducedMotion || !atmosphere?.getAnimations) return () => {};
  let animations;
  try { animations = atmosphere.getAnimations({ subtree: true }); } catch { return () => {}; }
  const changes = [];
  function rate(animation, value) {
    try {
      if (animation.updatePlaybackRate) animation.updatePlaybackRate(value);
      else animation.playbackRate = value;
    } catch { /* A cancelled decoration must never interrupt the conversation. */ }
  }
  for (const animation of animations) {
    if (!ambientNames.has(animation.animationName)) continue;
    const original = Number.isFinite(animation.playbackRate) ? animation.playbackRate : 1;
    rate(animation, thinking ? 8 : 1);
    changes.push(() => rate(animation, original));
  }
  return () => changes.forEach((restore) => restore());
}

// Every leg gets a fresh shape, trajectory and duration rather than replaying a
// random-looking loop. Bounds preserve legibility and keep mobile centered.
export function ambientFrame({ random = Math.random, mobile = false, ribbon = false } = {}) {
  const between = (min, max) => Number((min + random() * (max - min)).toFixed(2));
  const radii = Array.from({ length: 4 }, () => between(32, 68));
  const complement = (radius) => Number((100 - radius).toFixed(2));
  return {
    borderRadius: `${radii[0]}% ${complement(radii[0])}% ${radii[1]}% ${complement(radii[1])}% / ${radii[2]}% ${radii[3]}% ${complement(radii[3])}% ${complement(radii[2])}%`,
    transform: `translate3d(${mobile ? 0 : between(-58, 58)}px,${mobile ? 0 : between(-42, 42)}px,0) rotate(${between(ribbon ? -32 : -16, ribbon ? 32 : 16)}deg) skew(${between(-7, 7)}deg,${between(-5, 5)}deg) scale(${between(.88, 1.12)},${between(.88, 1.12)})`,
  };
}

export function installAmbientMotion(doc, win, { random = Math.random } = {}) {
  const records = new Map();
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = win.matchMedia('(forced-colors: active)');
  const mobile = win.matchMedia('(max-width: 600px)');
  const blocked = () => reduced.matches || forced.matches;

  function restore(animation, record) {
    animation.removeEventListener('finish', record.next);
    try {
      animation.effect.setKeyframes(record.frames);
      animation.effect.updateTiming(record.timing);
      if (record.paused && animation.playState === 'paused' && !doc.hidden && !blocked()) animation.play();
    } catch { /* Detached/cancelled decorations need no further work. */ }
  }

  function scan() {
    const seen = new Set();
    if (!blocked()) {
      for (const node of doc.querySelectorAll('.wda-workspace-atmosphere .wda-portal-glow, .wda-portal-atmosphere .wda-portal-glow')) {
        if (mobile.matches && node.classList.contains('is-orange')) continue;
        let animations;
        try { animations = node.getAnimations({ subtree: true }); } catch { continue; }
        for (const animation of animations) {
          if (!ambientNames.has(animation.animationName)) continue;
          seen.add(animation);
          if (records.has(animation) || !animation.effect?.setKeyframes || !animation.addEventListener) continue;
          const ribbon = animation.animationName === 'wdaAuroraRibbon';
          try {
            const style = win.getComputedStyle(node, ribbon ? '::before' : null);
            const record = { frames: animation.effect.getKeyframes(), timing: animation.effect.getTiming(), paused: false,
              target: { transform: style.transform === 'none' ? 'translate3d(0px,0px,0) rotate(0deg) skew(0deg,0deg) scale(1,1)' : style.transform, borderRadius: style.borderRadius },
            };
            record.next = () => {
              try {
                const start = record.target;
                record.target = ambientFrame({ random, mobile: mobile.matches, ribbon });
                animation.effect.setKeyframes([start, record.target]);
                animation.effect.updateTiming({ duration: (ribbon ? 10000 : 8000) + random() * 6000,
                  iterations: 1, iterationStart: 0, direction: 'normal', delay: 0, endDelay: 0, fill: 'both', easing: 'cubic-bezier(.45,0,.55,1)' });
                animation.currentTime = 0;
                animation.play();
                if (doc.hidden) { animation.pause(); record.paused = true; }
              } catch { /* The static/CSS fallback remains independent of chat. */ }
            };
            animation.addEventListener('finish', record.next);
            records.set(animation, record);
            record.next();
            // Newly mounted/resized glows also inherit a currently busy chat.
            if (node.closest('.wda-setup-main')?.querySelector('.wda-discovery-app[data-thinking="true"]')) {
              if (animation.updatePlaybackRate) animation.updatePlaybackRate(8);
              else animation.playbackRate = 8;
            }
          } catch { /* Older browsers keep the CSS aurora instead. */ }
        }
      }
    }
    for (const [animation, record] of records) {
      if (!seen.has(animation)) { restore(animation, record); records.delete(animation); }
    }
  }

  function visibility() {
    for (const [animation, record] of records) {
      try {
        if (doc.hidden && animation.playState === 'running') { animation.pause(); record.paused = true; }
        else if (!doc.hidden && record.paused) { animation.play(); record.paused = false; }
      } catch { /* Navigation may have cancelled this animation. */ }
    }
  }

  function resize() {
    // Start from the CSS pose at a layout breakpoint so a desktop translation
    // cannot linger on the centered mobile blob for the rest of a long leg.
    for (const [animation, record] of records) restore(animation, record);
    records.clear();
    scan();
  }

  scan();
  const observer = new win.MutationObserver((mutations) => {
    // Typing updates the chat DOM frequently; only mounting/removing an ambient
    // surface needs another animation scan, not each streamed character.
    if (!mutations || mutations.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
      node.nodeType === 1 && (node.matches('.wda-portal-glow') || node.querySelector('.wda-portal-glow'))))) scan();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  for (const query of [reduced, forced]) query.addEventListener('change', scan);
  mobile.addEventListener('change', resize);
  doc.addEventListener('visibilitychange', visibility);
  return () => {
    observer.disconnect();
    for (const query of [reduced, forced]) query.removeEventListener('change', scan);
    mobile.removeEventListener('change', resize);
    doc.removeEventListener('visibilitychange', visibility);
    for (const [animation, record] of records) restore(animation, record);
    records.clear();
  };
}
