import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as motion from '../lib/accessMotion.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const storage = () => {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test('the access motion request stores only a short-lived timestamp and is consumed exactly once', () => {
  const session = storage();
  motion.requestAccessMotion(session, 1000);
  assert.deepEqual([...session.values], [[motion.ACCESS_MOTION_KEY, '1000']]);
  assert.equal(motion.consumeAccessMotion(session, { workspace: true, now: 2000 }), true);
  assert.equal(motion.consumeAccessMotion(session, { workspace: true, now: 2000 }), false);
});

test('failed access, reduced motion, old timestamps, future timestamps and malformed requests cannot trigger a reveal', () => {
  for (const options of [
    { workspace: false, now: 2000 },
    { workspace: true, reducedMotion: true, now: 2000 },
    { workspace: true, now: 1000 + motion.ACCESS_MOTION_TTL },
    { workspace: true, now: 999 },
  ]) {
    const session = storage(); motion.requestAccessMotion(session, 1000);
    assert.equal(motion.consumeAccessMotion(session, options), false);
    assert.equal(session.values.size, 0);
  }
  const session = storage(); session.setItem(motion.ACCESS_MOTION_KEY, 'invalid');
  assert.equal(motion.consumeAccessMotion(session, { workspace: true }), false);
  assert.doesNotThrow(() => motion.requestAccessMotion({ setItem() { throw new Error('Blocked'); } }));
  assert.equal(motion.consumeAccessMotion({ getItem() { throw new Error('Blocked'); } }), false);
});

async function harness({ workspace = true, pending = true, reducedMotion = false, forcedColors = false, loading = false, blockedStorage = false } = {}) {
  const session = storage();
  if (pending) motion.requestAccessMotion(session);
  const slots = [];
  const effects = [];
  let cursor = 0;
  let dirty = false;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: initial };
      return [slots[index].value, (value) => { if (value !== slots[index].value) dirty = true; slots[index].value = value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
        effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, effect, cleanup: effect() }; });
      }
    },
  };
  const attributes = new Map();
  const events = new Map();
  const timers = new Map();
  const mediaEvents = new Map();
  let focused = 0;
  const document = {
    readyState: loading ? 'loading' : 'complete',
    activeElement: null,
    documentElement: { setAttribute: (key, value) => attributes.set(key, value), removeAttribute: (key) => attributes.delete(key) },
    querySelector: (selector) => selector.includes('.ctc-reader-breadcrumb') ? { focus() { focused++; } } : workspace ? {} : null,
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: (name, handler) => { if (events.get(name) === handler) events.delete(name); },
  };
  const window = {
    get sessionStorage() { if (blockedStorage) throw new Error('Storage blocked'); return session; },
    matchMedia: (query) => ({ matches: query.includes('forced-colors') ? forcedColors : reducedMotion,
      addEventListener: (_, handler) => mediaEvents.set(query, handler), removeEventListener: () => mediaEvents.delete(query) }),
    setTimeout: (handler, duration) => { assert.equal(duration, motion.ACCESS_MOTION_DURATION); timers.set(1, handler); return 1; },
    clearTimeout: (id) => timers.delete(id),
  };
  const filename = 'app/_components/AccessExperience.jsx';
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' }, module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', code)((id) => id === 'react' ? hooks : id.endsWith('/accessMotion.js') ? motion : require(id), module, module.exports, window, document);
  const Component = module.exports.default;
  let tree;
  function update() {
    do {
      dirty = false; cursor = 0; tree = Component();
      while (effects.length) effects.shift()();
    } while (dirty);
    return tree;
  }
  update();
  return { session, attributes, events, timers, mediaEvents, document,
    render: update, get tree() { return tree; }, get focused() { return focused; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    replayMountEffect() { slots[1].cleanup?.(); slots[1].cleanup = slots[1].effect(); update(); },
  };
}

test('verified workspace gets decorative 3D planes and one finite light bloom without changing access', async () => {
  const view = await harness();
  const html = renderToStaticMarkup(view.tree);
  assert.match(html, /class="wda-access-reveal"/);
  for (const layer of ['is-back', 'is-middle', 'is-front']) assert.ok(html.includes(layer));
  assert.match(html, /class="wda-access-bloom" aria-hidden="true"/);
  assert.match(html, /Your workspace is ready/);
  assert.match(html, /Skip animation/);
  assert.equal(view.attributes.get('data-wda-access'), 'revealing');
  assert.equal(view.timers.size, 1);
  assert.doesNotMatch(html, /role="dialog"|aria-modal|inert|access_token/);
  view.timers.get(1)(); view.render();
  assert.equal(view.tree, null);
  assert.equal(view.attributes.size, 0);
  assert.equal(view.timers.size, 0);
});

test('ordinary visits, account errors, reduced-motion settings and blocked storage do not play the cinematic reveal', async () => {
  for (const options of [{ pending: false }, { workspace: false }, { reducedMotion: true }, { forcedColors: true }, { blockedStorage: true }]) {
    const view = await harness(options);
    assert.equal(view.tree, null);
    assert.equal(view.attributes.size, 0);
    assert.equal(view.timers.size, 0);
  }
});

test('skip, keyboard interaction, pointer interaction and preference changes end the reveal immediately', async () => {
  for (const action of ['skip', 'Escape', 'Tab', 'pointer', 'bloom', 'preference']) {
    const view = await harness();
    if (action === 'skip') {
      view.document.activeElement = { closest: () => ({}) };
      React.Children.toArray(view.tree.props.children).find((node) => node.type === 'button').props.onClick();
    } else if (action === 'bloom') {
      let stopped = false;
      view.tree.props.onClick({ stopPropagation() { stopped = true; } });
      assert.ok(stopped, 'Clicking the reveal must not trigger an action behind it');
    } else if (action === 'pointer') view.events.get('pointerdown')({ target: { closest: () => null } });
    else if (action === 'preference') [...view.mediaEvents.values()][0]();
    else view.events.get('keydown')({ key: action });
    view.render();
    assert.equal(view.tree, null, action);
    assert.equal(view.attributes.size, 0);
    assert.equal(view.timers.size, 0);
    if (action === 'skip') assert.equal(view.focused, 1);
  }
});

test('streaming markup is checked only after DOM ready and effect replay cannot strand an overlay', async () => {
  const streaming = await harness({ loading: true });
  assert.equal(streaming.tree, null);
  assert.ok(streaming.events.has('DOMContentLoaded'));
  streaming.events.get('DOMContentLoaded')(); streaming.render();
  assert.notEqual(streaming.tree, null);
  const strict = await harness();
  strict.replayMountEffect();
  assert.notEqual(strict.tree, null);
  assert.equal(strict.timers.size, 1);
  strict.unmount();
  assert.equal(strict.attributes.size, 0);
  assert.equal(strict.timers.size, 0);
  assert.equal(strict.events.size, 0);
});

test('the light bloom never loops, overlay has a finite fallback, and reduced motion bypasses all perspective effects', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/access-motion.css', import.meta.url), 'utf8'));
  let perspective = false;
  let safeOverlay = false;
  let reduced = false;
  css.walkDecls((decl) => {
    if (decl.prop === 'animation') assert.doesNotMatch(decl.value, /infinite/);
    if (decl.prop === 'perspective') perspective = true;
    if (decl.parent.selector === '.wda-access-reveal' && decl.prop === 'pointer-events') safeOverlay = decl.value === 'auto';
  });
  css.walkAtRules('media', (media) => {
    if (media.params.includes('prefers-reduced-motion')) media.walkRules('.wda-access-reveal', (rule) => rule.walkDecls('display', (decl) => { reduced = decl.value === 'none'; }));
  });
  assert.ok(perspective);
  assert.ok(safeOverlay);
  assert.ok(reduced);
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.match(layout, /<AccessExperience \/>/);
  assert.match(layout, /import '\.\/access-motion.css'/);
});
