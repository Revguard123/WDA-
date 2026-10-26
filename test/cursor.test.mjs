import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CURSOR_HOTSPOT, CURSOR_SCALE, CURSOR_PALETTE, CURSOR_STATES, CURSOR_FRAME_COUNT, CURSOR_FRAME_MS, cursorValue, installThemeCursor } from '../lib/cursor.js';

const require = createRequire(import.meta.url);
const css = require('postcss').parse(readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8'));
const palettes = {};
for (const [name, selector] of [['light', ':root'], ['dark', ':root[data-theme="dark"]']]) {
  const values = {};
  css.walkRules(selector, (rule) => rule.walkDecls((decl) => { values[decl.prop] = decl.value; }));
  palettes[name] = { pink: values['--theme-pink'], orange: values['--theme-orange'] };
}
const decode = (value) => decodeURIComponent(value.match(/^url\("data:image\/svg\+xml,([^"]+)"\)/)[1]);

test('borderless SVG uses one rounded arrow, tilted further left, with a fixed hotspot and unclipped smooth curves', () => {
  let paths;
  for (const palette of Object.values(palettes)) {
    for (const interactive of [false, true]) {
      const value = cursorValue(palette, interactive);
      const svg = decode(value);
      assert.match(svg, /width="23" height="24" viewBox="0 0 34 36"/);
      assert.match(svg, /shape-rendering="geometricPrecision"/);
      assert.match(svg, /transform="rotate\(-12 5 4\)"/);
      assert.deepEqual(CURSOR_HOTSPOT, [3, 3]);
      assert.equal((svg.match(/<path /g) || []).length, 1);
      const currentPaths = [...svg.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
      if (!paths) paths = currentPaths;
      else assert.deepEqual(currentPaths, paths, 'Theme/hover must not move the shape or click point');
      assert.match(value, new RegExp(`\\) ${CURSOR_HOTSPOT.join(' ')},${interactive ? 'pointer' : 'auto'}$`));
      assert.ok(CURSOR_HOTSPOT[0] >= 0 && CURSOR_HOTSPOT[0] < 34);
      assert.ok(CURSOR_HOTSPOT[1] >= 0 && CURSOR_HOTSPOT[1] < 36);
      assert.doesNotMatch(svg, /stroke|filter|crispEdges/);
      // Every Bezier control point is in bounds after rotation, so the curved
      // silhouettes (inside their control-point hulls) cannot be cropped.
      for (const path of currentPaths) {
        const points = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
        for (let index = 0; index < points.length; index += 2) {
          const dx = points[index] - 5, dy = points[index + 1] - 4;
          const angle = -12 * Math.PI / 180;
          const x = 5 + dx * Math.cos(angle) - dy * Math.sin(angle);
          const y = 4 + dx * Math.sin(angle) + dy * Math.cos(angle);
          assert.ok(x >= 0 && x < 34 && y >= 0 && y < 36, `Unclipped control point: ${x},${y}`);
        }
      }
      assert.ok(svg.includes(`stop-color="${interactive ? palette.orange : palette.pink}"`));
      assert.ok(svg.includes(`stop-color="${interactive ? palette.pink : palette.orange}"`));
      assert.doesNotMatch(svg, /<script|<image|http[^:]*:\/\/(?!www\.w3\.org)/);
    }
  }
});

test('palette strings are escaped as data, never SVG attributes or scripts', () => {
  const svg = decode(cursorValue({ pink: '"/><script>bad()</script>', orange: 'a&b"' }));
  assert.doesNotMatch(svg, /<script>|fill="a&b"/);
  assert.match(svg, /&quot;\/&gt;&lt;script&gt;/);
  assert.match(svg, /stop-color="a&amp;b&quot;"/);
  for (const state of Object.keys(CURSOR_STATES)) {
    const asset = decode(cursorValue({ pink: '"/><script>bad()</script>', orange: 'a&b"' }, state));
    assert.doesNotMatch(asset, /<script>|stop-color="a&b"/);
    assert.match(asset, /&quot;\/&gt;&lt;script&gt;/);
    assert.doesNotMatch(asset, /var\(--cursor-end\)/);
  }
  assert.match(decode(cursorValue({ pink: '#123456', orange: '$&' })), /stop-color="\$&amp;"/);
});

test('every semantic cursor has theme-aware smooth vectors, correct native fallback and a bounded tool hotspot', () => {
  const images = new Set();
  const properties = new Set();
  for (const [state, { property, fallback, width, height, viewWidth, viewHeight, hotspot }] of Object.entries(CURSOR_STATES)) {
    properties.add(property);
    for (const palette of Object.values(palettes)) {
      const value = cursorValue(palette, state);
      const svg = decode(value);
      assert.match(svg, new RegExp(`width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}"`));
      assert.equal(width, Math.ceil(viewWidth * CURSOR_SCALE));
      assert.equal(height, Math.ceil(viewHeight * CURSOR_SCALE));
      assert.ok(width <= 32 && height <= 30, 'All tools stay compact, including their state badges');
      assert.ok(hotspot[0] >= 0 && hotspot[0] < width && hotspot[1] >= 0 && hotspot[1] < height);
      assert.ok(value.endsWith(` ${hotspot.join(' ')},${fallback}`));
      assert.ok(svg.includes(`stop-color="${palette.pink}"`) && svg.includes(`stop-color="${palette.orange}"`));
      assert.match(svg, /shape-rendering="geometricPrecision"/);
      assert.doesNotMatch(svg, /undefined|NaN|<script|<image|<animate|filter=/);
      images.add(svg);
      if (['wait','progress','disabled','help','copy'].includes(state)) {
        assert.deepEqual(hotspot, CURSOR_HOTSPOT);
        const pointerGroup = svg.match(/<g transform="rotate\(-12 5 4\)[\s\S]*?<\/g>/)[0];
        assert.equal((pointerGroup.match(/<path /g) || []).length, 1);
        assert.doesNotMatch(pointerGroup, /stroke=/, 'Only state symbols may have strokes; the original pointer stays borderless');
      }
    }
  }
  assert.equal(properties.size, Object.keys(CURSOR_STATES).length);
  assert.ok(images.size >= (Object.keys(CURSOR_STATES).length - 1) * 2, 'Tools must have recognizable distinct silhouettes');
  assert.equal(cursorValue(palettes.light, 'unrecognized'), cursorValue(palettes.light));
  assert.equal(cursorValue(palettes.light, 'constructor'), cursorValue(palettes.light));
});

function harness({ prior = false, fine = true, reduced = false, hidden = false, focused = true, noMedia = false, noTimer = false } = {}) {
  const values = new Map(prior ? [['--wda-cursor', 'saved-cursor']] : []);
  const priorities = new Map(prior ? [['--wda-cursor', 'important']] : []);
  const root = { dataset: { theme: 'light' }, style: {
    getPropertyValue: (key) => values.get(key) || '', getPropertyPriority: (key) => priorities.get(key) || '',
    setProperty: (key, value, priority = '') => { values.set(key, value); priorities.set(key, priority); },
    removeProperty: (key) => { values.delete(key); priorities.delete(key); },
  } };
  const events = () => {
    const listeners = new Map();
    return { listeners, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name), fire: (name) => listeners.get(name)?.() };
  };
  const pointer = { matches: fine, ...events() };
  const motion = { matches: reduced, ...events() };
  const doc = { documentElement: root, hidden, hasFocus: () => focused, ...events() };
  const timers = new Map();
  let timerID = 0;
  const win = {
    ...events(),
    matchMedia: noMedia ? undefined : (query) => query.includes('prefers-reduced-motion') ? motion : pointer,
    setInterval: noTimer ? undefined : (fn, delay) => { assert.equal(delay, CURSOR_FRAME_MS); timers.set(++timerID, fn); return timerID; },
    clearInterval: (id) => timers.delete(id),
  };
  const cleanup = installThemeCursor(doc, win);
  return { root, values, priorities, cleanup, pointer, motion, doc, win, timers,
    tick() { [...timers.values()].forEach((fn) => fn()); },
    change() { root.dataset.theme = 'dark'; },
    visibility(value) { doc.hidden = value; doc.fire('visibilitychange'); },
    preference(media, value) { media.matches = value; media.fire('change'); },
  };
}

test('both themes keep the requested bright dark-mode palette for every cursor state, with complete cleanup', () => {
  const view = harness();
  assert.deepEqual(CURSOR_PALETTE, palettes.dark);
  assert.equal(view.values.size, Object.keys(CURSOR_STATES).length);
  const lightFrame = [...view.values];
  view.change();
  assert.deepEqual([...view.values], lightFrame, 'Theme toggling must not reset the gradient or darken the palette');
  assert.match(decode(view.values.get('--wda-cursor')), /#FF78C7/);
  assert.match(decode(view.values.get('--wda-cursor-action')), /#FFB477/);
  for (const { property } of Object.values(CURSOR_STATES)) {
    assert.match(decode(view.values.get(property)), /#FF78C7/);
    assert.match(decode(view.values.get(property)), /#FFB477/);
    assert.doesNotMatch(decode(view.values.get(property)), /#C81E86|#C05F0E/);
  }
  view.cleanup();
  assert.equal(view.values.size, 0);
  assert.equal(view.timers.size, 0);
  for (const source of [view.pointer,view.motion,view.doc,view.win]) assert.equal(source.listeners.size, 0);
  const prior = harness({ prior: true }); prior.cleanup();
  assert.equal(prior.values.get('--wda-cursor'), 'saved-cursor');
  assert.equal(prior.priorities.get('--wda-cursor'), 'important');
  assert.equal(prior.values.has('--wda-cursor-action'), false);
  for (const options of [{ noMedia: true }, { noTimer: true }]) {
    const staticCursor = harness(options);
    assert.equal(staticCursor.timers.size, 0);
    assert.equal(staticCursor.values.size, Object.keys(CURSOR_STATES).length);
    staticCursor.cleanup();
  }
});

test('native frames move only the gradient, form a seamless loop and leave pointer geometry and hotspots stationary', () => {
  const view = harness();
  const first = new Map(view.values);
  assert.equal(view.timers.size, 1);
  view.tick();
  for (const { property, hotspot, fallback } of Object.values(CURSOR_STATES)) {
    assert.notEqual(view.values.get(property), first.get(property));
    const before = decode(first.get(property));
    const after = decode(view.values.get(property));
    assert.equal(before.replace(/gradientTransform="[^"]+"/, ''), after.replace(/gradientTransform="[^"]+"/, ''));
    assert.ok(view.values.get(property).endsWith(` ${hotspot.join(' ')},${fallback}`));
  }
  for (let index = 1; index < CURSOR_FRAME_COUNT; index++) view.tick();
  assert.deepEqual([...view.values], [...first], 'The last frame wraps exactly to the original gradient');
  assert.equal(cursorValue(CURSOR_PALETTE, false, 1), cursorValue(CURSOR_PALETTE, false, 0));
  assert.equal(cursorValue(CURSOR_PALETTE, false, NaN), cursorValue(CURSOR_PALETTE, false, 0));
  assert.equal(cursorValue(CURSOR_PALETTE, false, -.25), cursorValue(CURSOR_PALETTE, false, .75));
  view.cleanup();
});

test('gradient motion pauses in hidden/unfocused tabs and for coarse, high-contrast or reduced-motion preferences', () => {
  const view = harness();
  view.tick();
  const moving = view.values.get('--wda-cursor');
  view.visibility(true);
  view.tick();
  assert.equal(view.timers.size, 0);
  assert.equal(view.values.get('--wda-cursor'), moving);
  view.visibility(false);
  assert.equal(view.timers.size, 1);
  view.win.fire('blur');
  assert.equal(view.timers.size, 0);
  view.win.fire('focus');
  assert.equal(view.timers.size, 1);
  view.preference(view.motion, true);
  assert.equal(view.timers.size, 0);
  assert.equal(view.values.get('--wda-cursor'), cursorValue(CURSOR_PALETTE));
  view.preference(view.motion, false);
  view.preference(view.pointer, false);
  assert.equal(view.timers.size, 0);
  view.preference(view.pointer, true);
  assert.equal(view.timers.size, 1);
  view.cleanup();
  for (const options of [{ fine: false }, { reduced: true }, { hidden: true }, { focused: false }]) {
    const staticCursor = harness(options);
    assert.equal(staticCursor.timers.size, 0);
    staticCursor.cleanup();
  }
});

test('custom cursors apply only to fine-pointer normal-contrast devices and preserve text/disabled semantics', () => {
  const cursorCss = readFileSync(new URL('../app/cursor.css', import.meta.url), 'utf8');
  assert.match(cursorCss, /hover: hover.*pointer: fine.*forced-colors: none.*prefers-contrast: no-preference/);
  assert.match(cursorCss, /cursor: var\(--wda-cursor, auto\)/);
  assert.match(cursorCss, /cursor: var\(--wda-cursor-action, pointer\) !important/);
  assert.match(cursorCss, /textarea:not\(:disabled\)/);
  assert.match(cursorCss, /cursor: var\(--wda-cursor-text, text\) !important/);
  assert.match(cursorCss, /button:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
  assert.doesNotMatch(cursorCss, /cursor:\s*none/);
  const script = readFileSync(new URL('../lib/cursor.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /pointermove|requestAnimationFrame|setTimeout|fetch\(/);
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.match(layout, /import '\.\/cursor.css'/);
  const shared = readFileSync(new URL('../app/_components/LiquidInteractions.jsx', import.meta.url), 'utf8');
  assert.match(shared, /installThemeCursor\(document, window\)/);
  assert.match(shared, /removeCursor\(\)/);
});

test('themed loading overrides disabled, action and text cursors, including nested content, without hiding the OS pointer', () => {
  const cursorCss = readFileSync(new URL('../app/cursor.css', import.meta.url), 'utf8');
  const parsed = require('postcss').parse(cursorCss);
  const rules = [];
  parsed.walkRules((rule) => {
    const cursor = rule.nodes.find((node) => node.prop === 'cursor');
    if (!cursor) return;
    rules.push({ selector: rule.selector, value: cursor.value });
    assert.match(cursor.value, /^var\(--wda-cursor/);
    if (rule.selector !== 'html, body') assert.ok(cursor.important);
  });
  const disabled = rules.findIndex((rule) => rule.value.includes('--wda-cursor-disabled'));
  const progress = rules.findIndex((rule) => rule.value.includes('--wda-cursor-progress'));
  const text = rules.findIndex((rule) => rule.value.includes('--wda-cursor-text'));
  assert.ok(progress > disabled && disabled > text);
  assert.match(rules[progress].selector, /\[aria-busy="true"\] \*/);
  assert.match(rules[progress].selector, /\.is-loading \*.*\.is-busy \*/);
  assert.match(rules[disabled].selector, /:disabled.*\[aria-disabled="true"\] \*/);
  assert.match(cursorCss, /input\[type="range"\]:not\(:disabled\).*--wda-cursor-ew-resize/);
  for (const state of Object.keys(CURSOR_STATES).filter((state) => !['default','action','disabled'].includes(state))) {
    assert.ok(cursorCss.includes(`[data-cursor="${state}"]`), `${state} supports explicit opt-in`);
  }
  const emailForm = readFileSync(new URL('../app/_components/AccessForm.jsx', import.meta.url), 'utf8');
  assert.match(emailForm, /aria-busy=\{status === 'sending' \|\| undefined\}/);
});
