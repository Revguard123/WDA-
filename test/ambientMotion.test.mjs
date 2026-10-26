import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setAtmosphereThinking, ambientFrame, installAmbientMotion } from '../lib/ambientMotion.js';

test('ambient colors combine anchored morphs with iridescent, feathered aurora ribbons', () => {
  const require = createRequire(import.meta.url);
  const css = require('postcss').parse(readFileSync(new URL('../app/portal.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls((decl) => { values[decl.prop] = decl.value; }); });
    return values;
  };
  assert.equal(base('.wda-portal-glow').animation, 'wdaPortalGlow 16s linear infinite');
  assert.match(base('.wda-portal-glow')['border-radius'], /\//);
  assert.equal(base('.wda-portal-glow.is-orange')['animation-duration'], undefined);
  assert.equal(base('.wda-portal-glow.is-orange')['animation-direction'], 'reverse');
  assert.equal(base('.wda-portal-glow.is-orange').top, base('.wda-portal-glow.is-pink').top);
  const ribbon = base('.wda-portal-glow::before');
  assert.match(ribbon.background, /conic-gradient/);
  assert.match(ribbon.background, /245,46,169/);
  assert.match(ribbon.background, /255,159,88/);
  assert.match(ribbon['mask-image'], /transparent 32%/);
  assert.equal(ribbon['-webkit-mask-image'], ribbon['mask-image']);
  assert.match(ribbon.animation, /wdaAuroraRibbon 24s/);
  assert.equal(base('.wda-portal-glow.is-orange::before')['animation-direction'], 'reverse');
  let ribbonKeyframes = false;
  let reducedRibbon = false;
  css.walkAtRules('keyframes', (rule) => {
    if (rule.params === 'wdaAuroraRibbon') {
      ribbonKeyframes = true;
      assert.equal(rule.nodes[0].selector, '0%,100%');
      rule.walkDecls((decl) => {
        assert.notEqual(decl.prop, 'opacity', 'Ribbons must not flash');
        if (decl.prop === 'transform') assert.match(decl.value, /rotate.*skew.*scale/);
      });
    }
    if (rule.params !== 'wdaPortalGlow') return;
    assert.equal(rule.nodes.length, 4);
    assert.equal(rule.nodes[0].selector, '0%,100%');
    const shapes = new Set();
    rule.walkDecls((decl) => {
      if (decl.prop === 'border-radius') shapes.add(decl.value);
      assert.doesNotMatch(decl.value, /translate/);
      assert.notEqual(decl.prop, 'opacity', 'The morph must not flash or pulse brightness');
    });
    assert.equal(shapes.size, 4);
  });
  css.walkAtRules('media', (media) => {
    if (media.params === '(prefers-reduced-motion: reduce)') media.walkRules((rule) => {
      if (rule.selector.includes('.wda-portal-glow::before')) rule.walkDecls('animation', (decl) => { reducedRibbon = decl.value === 'none' && decl.important; });
    });
  });
  assert.ok(ribbonKeyframes);
  assert.ok(reducedRibbon);
});

function animation(name = 'wdaPortalGlow', playbackRate = 1) {
  return { animationName: name, playbackRate, currentTime: 2750, changes: [],
    updatePlaybackRate(rate) { this.changes.push(rate); this.playbackRate = rate; },
    cancel() { assert.fail('Must never cancel/restart the existing glow'); },
    play() { assert.fail('Must never restart the existing glow'); },
  };
}

test('thinking accelerates only ambient glows eightfold without moving their current frame', () => {
  const pink = animation(); const orange = animation(); const ribbon = animation('wdaAuroraRibbon'); const unrelated = animation('wdaDraftGlowFlow');
  const restore = setAtmosphereThinking({ getAnimations(options) { assert.deepEqual(options, { subtree: true }); return [pink, orange, ribbon, unrelated]; } }, true);
  assert.equal(pink.playbackRate, 8); assert.equal(orange.playbackRate, 8);
  assert.equal(ribbon.playbackRate, 8); assert.equal(ribbon.currentTime, 2750);
  assert.equal(pink.currentTime, 2750); assert.equal(orange.currentTime, 2750);
  assert.equal(unrelated.playbackRate, 1);
  restore();
  assert.equal(pink.playbackRate, 1); assert.equal(orange.playbackRate, 1);
  assert.equal(ribbon.playbackRate, 1);
});

test('idle, completion, errors and unmount restore the original ambient playback rate', () => {
  const glow = animation();
  const atmosphere = { getAnimations: () => [glow] };
  const finish = setAtmosphereThinking(atmosphere, true);
  finish();
  const idle = setAtmosphereThinking(atmosphere, false);
  assert.equal(glow.playbackRate, 1);
  idle();
  const custom = animation('wdaPortalGlow', .8);
  const unmount = setAtmosphereThinking({ getAnimations: () => [custom] }, true);
  unmount(); assert.equal(custom.playbackRate, .8);
});

test('reduced motion, absent workspaces and unavailable animation APIs remain safe no-ops', () => {
  const glow = animation();
  setAtmosphereThinking({ getAnimations: () => [glow] }, true, { reducedMotion: true })();
  assert.deepEqual(glow.changes, []);
  for (const atmosphere of [null, {}, { getAnimations() { throw Error('Unavailable'); } }]) {
    assert.doesNotThrow(() => setAtmosphereThinking(atmosphere, true)());
  }
  const legacy = { animationName: 'wdaPortalGlow', playbackRate: 1 };
  const restore = setAtmosphereThinking({ getAnimations: () => [legacy] }, true);
  assert.equal(legacy.playbackRate, 8); restore(); assert.equal(legacy.playbackRate, 1);
  assert.doesNotThrow(() => setAtmosphereThinking({ getAnimations: () => [{ animationName: 'wdaPortalGlow', updatePlaybackRate() { throw Error('Cancelled'); } }] }, true)());
});

test('random frames use fresh bounded shapes and movement, with no translation on mobile', () => {
  const first = ambientFrame({ random: () => .1 });
  const next = ambientFrame({ random: () => .9 });
  assert.notEqual(first.transform, next.transform);
  assert.notEqual(first.borderRadius, next.borderRadius);
  assert.match(first.transform, /translate3d\(-46\.4px,-33\.6px,0\)/);
  assert.match(next.transform, /translate3d\(46\.4px,33\.6px,0\)/);
  for (const random of [() => 0, () => .5, () => 1]) {
    assert.match(ambientFrame({ random, mobile: true }).transform, /^translate3d\(0px,0px,0\)/);
    const frame = ambientFrame({ random, ribbon: true });
    assert.match(frame.borderRadius, /\//);
    assert.doesNotMatch(frame.transform, /NaN|Infinity/);
    assert.equal(Object.hasOwn(frame, 'opacity'), false);
  }
});

function controller({ mobile = false, reduced = false, hidden = false, busy = false } = {}) {
  const media = new Map();
  const events = new Map();
  let callback;
  let nodes = [];
  let seed = 7;
  const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const doc = {
    body: {}, hidden,
    querySelectorAll: () => nodes,
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: (name) => events.delete(name),
  };
  let disconnected = false;
  const win = {
    matchMedia(query) {
      if (!media.has(query)) media.set(query, { matches: query.includes('600px') ? mobile : query.includes('reduced') ? reduced : false,
        handlers: new Set(), addEventListener(_, handler) { this.handlers.add(handler); }, removeEventListener(_, handler) { this.handlers.delete(handler); },
      });
      return media.get(query);
    },
    getComputedStyle: () => ({ transform: 'matrix(1,0,0,1,0,0)', borderRadius: '50%' }),
    MutationObserver: class { constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected = true; } },
  };
  function glow(orange = false) {
    const frames = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(5deg)' }];
    const timing = { duration: 16000, iterations: Infinity, direction: 'normal' };
    const motions = ['wdaPortalGlow', 'wdaAuroraRibbon'].map((name) => {
      const value = animation(name);
      value.handlers = new Set(); value.playState = 'running';
      value.addEventListener = (_, handler) => value.handlers.add(handler);
      value.removeEventListener = (_, handler) => value.handlers.delete(handler);
      value.play = () => { value.playState = 'running'; };
      value.pause = () => { value.playState = 'paused'; };
      value.effect = { frames, timing,
        getKeyframes: () => frames, getTiming: () => timing,
        setKeyframes(next) { this.frames = next; }, updateTiming(next) { this.timing = next; },
      };
      return value;
    });
    return { classList: { contains: (name) => name === 'is-orange' && orange }, getAnimations: () => motions,
      closest: () => ({ querySelector: () => busy ? {} : null }), motions, frames, timing };
  }
  const pink = glow(); const orange = glow(true);
  nodes = [pink, orange];
  const cleanup = installAmbientMotion(doc, win, { random });
  return { pink, orange, doc, events, cleanup, scan: () => callback(),
    get disconnected() { return disconnected; },
    remove() { nodes = []; callback(); },
    preference(query, value) { const target = media.get(query); target.matches = value; target.handlers.forEach((fn) => fn()); },
    get media() { return media; },
  };
}

test('random motion generates new nonrepeating targets at each finish, joins positions and preserves 8x speed', () => {
  const view = controller({ busy: true });
  const motion = view.pink.motions[0];
  assert.equal(motion.playbackRate, 8);
  const first = motion.effect.frames;
  const duration = motion.effect.timing.duration;
  assert.equal(motion.effect.timing.iterations, 1);
  motion.handlers.forEach((finish) => finish());
  const second = motion.effect.frames;
  assert.deepEqual(second[0], first[1]);
  assert.notDeepEqual(second[1], first[1]);
  assert.notEqual(motion.effect.timing.duration, duration);
  assert.ok(motion.effect.timing.duration >= 8000 && motion.effect.timing.duration <= 14000);
  assert.equal(motion.playbackRate, 8);
  const snapshot = motion.effect.frames;
  view.scan(); assert.equal(motion.effect.frames, snapshot, 'Chat DOM updates must not restart the motion');
  view.cleanup();
  assert.deepEqual(motion.effect.frames, view.pink.frames);
  assert.deepEqual(motion.effect.timing, view.pink.timing);
  assert.equal(motion.handlers.size, 0);
  assert.equal(view.events.size, 0);
  assert.ok(view.disconnected);
  for (const query of view.media.values()) assert.equal(query.handlers.size, 0);
});

test('mobile keeps one centered animated blob and breakpoint changes never keep desktop drift', () => {
  const view = controller({ mobile: true });
  assert.match(view.pink.motions[0].effect.frames[1].transform, /^translate3d\(0px,0px,0\)/);
  assert.equal(view.orange.motions[0].handlers.size, 0);
  view.preference('(max-width: 600px)', false);
  assert.equal(view.orange.motions[0].handlers.size, 1);
  assert.doesNotMatch(view.pink.motions[0].effect.frames[1].transform, /^translate3d\(0px,0px,0\)/);
  view.preference('(max-width: 600px)', true);
  assert.match(view.pink.motions[0].effect.frames[1].transform, /^translate3d\(0px,0px,0\)/);
  assert.equal(view.orange.motions[0].handlers.size, 0);
  const require = createRequire(import.meta.url);
  const css = require('postcss').parse(readFileSync(new URL('../app/portal.css', import.meta.url), 'utf8'));
  let centered = false; let single = false;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(max-width: 600px)') return;
    media.walkRules('.wda-portal-glow.is-pink', (rule) => {
      const values = Object.fromEntries(rule.nodes.map((decl) => [decl.prop, decl.value]));
      centered = values.left === '50%' && values.top === '50%' && values.translate === '-50% -50%';
      assert.match(values.background, /245,46,169.*255,159,88/);
    });
    media.walkDecls('display', (decl) => { if (decl.parent.selector.includes('.wda-portal-glow.is-orange') && decl.value === 'none') single = true; });
  });
  assert.ok(centered); assert.ok(single);
  view.cleanup();
});

test('random animation pauses in background tabs and honors preference changes and removed pages', () => {
  const view = controller({ hidden: true });
  assert.equal(view.pink.motions[0].playState, 'paused');
  view.doc.hidden = false; view.events.get('visibilitychange')();
  assert.equal(view.pink.motions[0].playState, 'running');
  view.doc.hidden = true; view.events.get('visibilitychange')();
  assert.equal(view.pink.motions[0].playState, 'paused');
  view.preference('(prefers-reduced-motion: reduce)', true);
  assert.equal(view.pink.motions[0].handlers.size, 0);
  assert.notEqual(view.pink.motions[0].playState, 'running', 'Preference changes must not restart a paused/hidden animation');
  view.preference('(prefers-reduced-motion: reduce)', false);
  assert.equal(view.pink.motions[0].handlers.size, 1);
  view.remove();
  assert.equal(view.pink.motions[0].handlers.size, 0);
  assert.equal(view.orange.motions[0].handlers.size, 0);
  view.cleanup();
  const reduced = controller({ reduced: true });
  assert.equal(reduced.pink.motions[0].handlers.size, 0);
  reduced.cleanup();
});
