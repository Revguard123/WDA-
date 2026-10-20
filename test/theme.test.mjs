import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as theme from '../lib/theme.js';

const require = createRequire(import.meta.url);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const swc = await require('next/dist/build/swc').loadBindings();

test('theme preference accepts only light/dark and otherwise follows the system', () => {
  for (const value of [null, undefined, '', 'auto', 'invalid', '<script>']) {
    assert.equal(theme.resolveTheme(value), 'light');
    assert.equal(theme.resolveTheme(value, true), 'dark');
  }
  assert.equal(theme.resolveTheme('light', true), 'light');
  assert.equal(theme.resolveTheme('dark', false), 'dark');
});

test('the head bootstrap applies the saved/system theme before paint, including when storage or media is unavailable', () => {
  for (const options of [
    { stored: null, system: true, expected: 'dark' },
    { stored: 'light', system: true, expected: 'light' },
    { stored: 'dark', system: false, expected: 'dark' },
    { stored: 'invalid', system: false, expected: 'light' },
    { blocked: true, system: true, expected: 'dark' },
    { blocked: true, mediaBlocked: true, expected: 'light' },
  ]) {
    const document = { documentElement: { dataset: {}, style: {} } };
    runInNewContext(theme.THEME_INIT_SCRIPT, {
      document,
      localStorage: { getItem(key) { assert.equal(key, theme.THEME_KEY); if (options.blocked) throw Error('Blocked'); return options.stored; } },
      matchMedia() { if (options.mediaBlocked) throw Error('Unavailable'); return { matches: options.system }; },
    });
    assert.equal(document.documentElement.dataset.theme, options.expected);
    assert.equal(document.documentElement.style.colorScheme, options.expected);
  }
  const layout = source('app/layout.js');
  assert.match(layout, /<html[^>]*suppressHydrationWarning/);
  assert.match(layout, /<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_INIT_SCRIPT/);
  assert.match(layout, /<ThemeSwitch \/>/);
  assert.match(layout, /import '\.\/theme.css'/);
});

async function harness({ preference = null, systemDark = false, blocked = false, mobile = false, hasSlot = true } = {}) {
  const values = new Map(preference === null ? [] : [[theme.THEME_KEY, preference]]);
  const root = { dataset: {}, style: {} };
  const media = new Map();
  const events = new Map();
  const target = { name: 'desktop' };
  const mobileTarget = { name: 'mobile' };
  let slotAvailable = hasSlot;
  let observerCallback;
  let disconnected = false;
  const document = { body: {}, documentElement: root,
    querySelector: (selector) => slotAvailable ? selector.includes('mobile') ? mobileTarget : target : null,
  };
  const window = {
    get localStorage() {
      if (blocked) throw Error('Blocked storage');
      return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    },
    matchMedia(query) {
      if (!media.has(query)) {
        const handlers = new Set();
        media.set(query, { matches: query.includes('color-scheme') ? systemDark : mobile, handlers,
          addEventListener: (_, handler) => handlers.add(handler), removeEventListener: (_, handler) => handlers.delete(handler),
        });
      }
      return media.get(query);
    },
    addEventListener: (type, handler) => events.set(type, handler),
    removeEventListener: (type, handler) => { if (events.get(type) === handler) events.delete(type); },
  };
  const slots = [];
  const effects = [];
  let cursor = 0;
  let dirty = false;
  const hooks = { ...React,
    useId: () => 'theme-fixture',
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      slots[index] ||= { value: initial };
      return [slots[index].value, (next) => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (value !== slots[index].value) dirty = true;
        slots[index].value = value;
      }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index]) effects.push(() => { slots[index] = { cleanup: effect(), deps }; });
    },
  };
  const { code } = await swc.transform(source('app/_components/ThemeSwitch.jsx'), {
    filename: 'ThemeSwitch.jsx', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' }, module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', 'MutationObserver', code)(
    (id) => id === 'react' ? hooks : id === 'react-dom' ? { createPortal: (child, slot) => ({ child, slot }) } : id.endsWith('/theme.js') ? theme : require(id),
    module, module.exports, window, document,
    class { constructor(callback) { observerCallback = callback; } observe() {} disconnect() { disconnected = true; } },
  );
  let tree;
  function update() {
    do { dirty = false; cursor = 0; tree = module.exports.default(); while (effects.length) effects.shift()(); } while (dirty);
    return tree.child || tree;
  }
  function system(value) {
    const query = media.get('(prefers-color-scheme: dark)'); query.matches = value;
    query.handlers.forEach((handler) => handler({ type: 'change' })); update();
  }
  update();
  return { root, values, media, events, document, system,
    render: update,
    get slot() { return tree.slot; },
    toggle(value) { React.Children.toArray(update().props.children).find((child) => child.type === 'input').props.onChange({ target: { checked: value } }); update(); },
    changeRoute(available) { slotAvailable = available; observerCallback(); update(); },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); },
    get disconnected() { return disconnected; },
  };
}

test('the supplied sun/moon switch has accessible native checkbox behavior and persists only the theme', async () => {
  const view = await harness();
  let html = renderToStaticMarkup(view.render());
  assert.match(html, /type="checkbox" role="switch" aria-label="Dark mode"/);
  for (const name of ['sky', 'sun', 'moon', 'cloud', 'stars']) assert.match(html, new RegExp(`wda-theme-${name}`));
  assert.match(html, /aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(html, /checked=""|styled-components|filter=|url\(#/);
  view.toggle(true);
  assert.equal(view.root.dataset.theme, 'dark');
  assert.equal(view.root.style.colorScheme, 'dark');
  assert.deepEqual([...view.values], [[theme.THEME_KEY, 'dark']]);
  html = renderToStaticMarkup(view.render());
  assert.match(html, /checked=""/);
  assert.match(html, /Switch to light mode/);
  view.toggle(false);
  assert.equal(view.root.dataset.theme, 'light');
  assert.equal(view.values.get(theme.THEME_KEY), 'light');
});

test('system changes apply until explicitly overridden; preferences synchronize across tabs and clear correctly', async () => {
  const view = await harness();
  view.system(true); assert.equal(view.root.dataset.theme, 'dark');
  view.toggle(false);
  view.system(true); assert.equal(view.root.dataset.theme, 'light');
  view.values.set(theme.THEME_KEY, 'dark');
  view.events.get('storage')({ type: 'storage', key: theme.THEME_KEY }); view.render();
  assert.equal(view.root.dataset.theme, 'dark');
  view.values.set(theme.THEME_KEY, 'light');
  view.events.get('storage')({ type: 'storage', key: 'unrelated' }); view.render();
  assert.equal(view.root.dataset.theme, 'dark');
  view.values.clear();
  view.events.get('storage')({ type: 'storage', key: null }); view.render();
  assert.equal(view.root.dataset.theme, 'dark');
});

test('blocked storage does not prevent switching or following the system before a manual choice', async () => {
  const view = await harness({ blocked: true });
  view.system(true); assert.equal(view.root.dataset.theme, 'dark');
  assert.doesNotThrow(() => view.toggle(false));
  view.system(true); assert.equal(view.root.dataset.theme, 'light');
  assert.equal(view.values.size, 0);
});

test('one global control relocates into desktop/mobile chrome, follows navigation, and removes its listeners on unmount', async () => {
  const view = await harness();
  assert.equal(view.slot.name, 'desktop');
  const media = view.media.get('(max-width: 600px)');
  media.matches = true; media.handlers.forEach((handler) => handler()); view.render();
  assert.equal(view.slot.name, 'mobile');
  view.changeRoute(false);
  assert.equal(view.slot, undefined);
  assert.match(renderToStaticMarkup(view.render()), /is-floating/);
  view.changeRoute(true); assert.equal(view.slot.name, 'mobile');
  view.unmount();
  assert.equal(view.events.size, 0);
  assert.ok(view.disconnected);
  for (const query of view.media.values()) assert.equal(query.handlers.size, 0);
  for (const file of ['app/_components/Shell.jsx','app/_components/RecoveryScreen.jsx','app/_components/PortalFrame.jsx']) assert.match(source(file), /data-theme-slot=/);
});

const css = require('postcss').parse(source('app/theme.css'));
function darkTokens() {
  const result = {};
  css.walkRules(':root[data-theme="dark"]', (rule) => rule.walkDecls((decl) => { result[decl.prop] = decl.value; }));
  return result;
}
function contrast(a, b) {
  function luminance(hex) {
    const channels = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test('dark palette meets normal-text contrast across page, card, raised surfaces and branded statuses', () => {
  const tokens = darkTokens();
  for (const background of ['--theme-page','--theme-surface','--theme-raised','--theme-inset']) {
    for (const foreground of ['--theme-ink','--theme-text','--theme-muted','--theme-pink','--theme-orange','--theme-error']) {
      assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `${foreground} on ${background}`);
    }
  }
  assert.ok(contrast(tokens['--theme-pink'], tokens['--theme-blush']) >= 4.5);
  assert.ok(contrast(tokens['--theme-orange'], tokens['--theme-warm']) >= 4.5);
  assert.ok(contrast('#FFFFFF', '#C81E86') >= 4.5);
});

test('theme covers every product surface without reboxing Discovery, styling image pixels or hiding keyboard focus', () => {
  const styles = source('app/theme.css');
  for (const component of ['wda-portal-page','wda-recovery-page','wda-shell','wda-setup-app','wda-setup-rail','contracts-card','ctc-flow-panel','wda-popup','wda-discovery-app','targeting-dropdown','targeting-checkbox-mark','targeting-budget-thumb']) assert.ok(styles.includes(component));
  assert.match(styles, /\.wda-theme-switch input:focus-visible \+ svg/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /forced-colors: active/);
  assert.doesNotMatch(styles, /filter:\s*invert|img\s*\{[^}]*filter|\.wda-conversation\s*\{[^}]*border-radius/);
  assert.equal((source('app/layout.js').match(/<ThemeSwitch/g) || []).length, 1);
});
