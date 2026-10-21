import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as buyerUrls from '../lib/buyerUrls.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(file, imports = {}, globals = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' }, module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', code)(
    (id) => imports[id] || (id.endsWith('/buyerUrls.js') ? buyerUrls : require(id)), module, module.exports, globals.window, globals.document,
  );
  return module.exports;
}
const asDefault = (defaultExport) => ({ __esModule: true, default: defaultExport });
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
const navigation = await load('app/_components/WorkspaceNavigation.jsx', { './CTCIcon.jsx': asDefault(Icon) });
const Workspace = (await load('app/_components/SetupWorkspace.jsx', {
  './WorkspaceNavigation.jsx': navigation, './CTCIcon.jsx': asDefault(Icon), './BetaNotice.jsx': asDefault(() => null),
  './SupportCTA.jsx': asDefault(() => React.createElement('div', { 'data-support-fixture': true }, 'Send feedback')),
})).default;

test('mobile header has an icon-only account disclosure linked to one shared account/support panel', () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', buyerName: 'Alex', buyerEmail: 'member@example.test', discoveryHref: '/discover', children: 'Workspace content' }));
  const header = html.match(/<div class="wda-setup-mobile">([\s\S]*?)<div class="wda-setup-layout">/)[1];
  const trigger = header.match(/<button[^>]*class="wda-mobile-account-toggle"[\s\S]*?<\/button>/)[0];
  assert.match(trigger, /aria-label="Account options"/);
  assert.match(trigger, /aria-expanded="false" aria-controls="workspace-account-panel"/);
  assert.match(trigger, /wda-member-avatar-figure/);
  assert.doesNotMatch(header, /member@example|Alex|Log out/);
  assert.equal((html.match(/id="workspace-account-panel"/g) || []).length, 1);
  assert.equal((html.match(/action="\/auth\/logout" method="post"/g) || []).length, 1);
  assert.equal((html.match(/data-support-fixture="true"/g) || []).length, 1);
  const footer = html.match(/<footer class="wda-workspace-support"[\s\S]*?<\/footer>/)[0];
  assert.ok(footer.indexOf('wda-member-account') < footer.indexOf('data-support-fixture'));
  assert.ok(footer.indexOf('data-support-fixture') < footer.indexOf('wda-workspace-products'));
  assert.ok(footer.indexOf('wda-workspace-products') < footer.indexOf('wda-account-logout-form'));
  assert.match(footer, /<span class="wda-logout-label">Log out<\/span><\/button><\/form><\/footer>$/);
  assert.match(html, /aria-label="Collapse sidebar"[^>]*aria-expanded="true" aria-controls="workspace-navigation"/);
  assert.match(html, /aria-keyshortcuts="Control\+Shift\+S"/);
  assert.match(html, /<aside[^>]+><div class="wda-rail-light" aria-hidden="true"><\/div>/);
  assert.match(html, /class="wda-nav-label">Discovery/);
  assert.match(html, /class="wda-nav-label">Targeting/);
  assert.match(html, /class="wda-nav-label">Contracts/);
  assert.match(html, /<main id="workspace-content"/);
});

const css = require('postcss').parse(readFileSync(new URL('../app/workspace-navigation.css', import.meta.url), 'utf8'));

test('Discovery and Targeting use the supplied outline silhouettes in both desktop and mobile navigation', () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', discoveryHref: '/discover' }));
  for (const name of ['discovery', 'target']) {
    const icon = renderToStaticMarkup(React.createElement(Icon, { name }));
    assert.equal(html.split(icon).length - 1, 2, `${name} is shared by the header and sidebar`);
    assert.match(icon, /stroke="currentColor"/);
    assert.match(icon, /stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(icon, /<image|<img|#000|#fff/i);
  }
  const discovery = renderToStaticMarkup(React.createElement(Icon, { name: 'discovery' }));
  assert.equal((discovery.match(/<circle/g) || []).length, 3, 'Chat bubble has three ellipsis dots');
  const feedback = renderToStaticMarkup(React.createElement(Icon, { name: 'message' }));
  assert.notEqual(discovery, feedback, 'Feedback retains its existing separate icon');
});

test('expanded sidebar uses the landscape logo with flexible sizing while collapsed navigation retains its compact mark', () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', discoveryHref: '/discover' }));
  const heading = html.match(/<div class="wda-rail-heading">[\s\S]*?<\/div>/)[0];
  assert.match(heading, /class="wda-rail-wordmark" src="\/brand\/wda-logo-horizontal.png" alt="War Dogs Academy" width="238" height="32"/);
  assert.match(heading, /class="wda-rail-brand-mark" src="\/brand\/wda-favicon.png"/);
  const brand = properties('.is-workspace .wda-rail-heading .wda-reader-brand');
  assert.equal(brand.flex, '1 1 auto');
  assert.equal(brand['min-width'], '0');
  assert.equal(brand['max-width'], '144px');
  assert.equal(properties('.is-workspace[data-sidebar-collapsed="true"] .wda-reader-brand', '(min-width: 601px)').width, '32px');
});

function properties(selector, media) {
  const values = {};
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    if (media ? rule.parent.params !== media : rule.parent.type !== 'root') return;
    rule.nodes.filter((node) => node.type === 'decl').forEach((node) => { values[node.prop] = node.value; });
  });
  return values;
}

test('responsive styles replace the mobile footer with an anchored, bounded dropdown and collapse only above mobile', () => {
  const mobile = '(max-width: 600px)';
  const rail = properties(':root .wda-setup-app.is-workspace .wda-setup-rail', mobile);
  assert.equal(rail.display, 'flex');
  assert.equal(rail.visibility, 'hidden');
  assert.equal(rail['pointer-events'], 'none');
  assert.equal(rail.position, 'absolute');
  assert.equal(rail.right, '12px');
  assert.equal(rail.border, '0');
  assert.equal(rail['border-radius'], '20px');
  assert.match(rail.width, /min\(320px,calc\(100% - 24px\)\)/);
  assert.match(rail['max-height'], /100dvh/);
  assert.equal(rail.overflow, 'auto');
  assert.equal(properties(':root .wda-setup-app.is-workspace[data-account-open="true"] .wda-setup-rail', mobile).visibility, 'visible');
  assert.equal(properties('.is-workspace .wda-setup-layout', mobile)['grid-template-rows'], 'minmax(0,1fr)');
  assert.equal(properties('.is-workspace .wda-mobile-account-toggle', mobile).display, 'grid');
  const desktop = '(min-width: 601px)';
  assert.equal(properties('.is-workspace[data-sidebar-collapsed="true"] .wda-setup-layout', desktop)['grid-template-columns'], '80px minmax(0,1fr)');
  const label = properties('.is-workspace[data-sidebar-collapsed="true"] .wda-nav-label', desktop);
  assert.equal(label['max-width'], '0');
  assert.equal(label.opacity, '0');
  assert.notEqual(label.display, 'none', 'Icon-only navigation retains accessible link names');
  assert.equal(properties('.wda-sidebar-toggle').width, '44px');
  assert.equal(properties('.wda-mobile-account-toggle').width, '44px');
  assert.match(properties('.wda-sidebar-toggle:focus-visible').outline, /2px solid/);
  assert.equal(properties('.is-workspace .wda-setup-layout', '(prefers-reduced-motion: reduce)').transition, 'none');
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.ok(layout.indexOf("import './workspace-navigation.css'") > layout.indexOf("import './glass.css'"));
});

test('logout is a final full-width danger action, with an icon-only collapsed variant and red hover', () => {
  const action = properties('.is-workspace .wda-workspace-support .wda-account-logout');
  assert.equal(action.width, '100%');
  assert.equal(action.color, 'var(--theme-danger)');
  assert.equal(action.background, 'transparent');
  assert.equal(properties('.is-workspace .wda-workspace-support .wda-logout-label').display, 'inline');
  const hover = properties('.is-workspace .wda-workspace-support .wda-account-logout:hover', '(hover: hover) and (pointer: fine)');
  assert.equal(hover.color, 'var(--theme-danger-hover)');
  assert.equal(hover.background, 'var(--theme-danger-soft)');
  assert.equal(properties('.is-workspace[data-sidebar-collapsed="true"] .wda-workspace-support > .wda-account-logout-form', '(min-width: 601px)').width, '44px');
  assert.equal(properties('.is-workspace .wda-workspace-support .wda-account-logout', '(max-width: 600px)')['font-size'], '12px');
  const theme = require('postcss').parse(readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8'));
  for (const selector of [':root', ':root[data-theme="dark"]']) {
    let danger;
    theme.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls('--theme-danger', (decl) => { danger = decl.value; }); });
    assert.ok(danger, `${selector} has its own danger red`);
    assert.notEqual(danger, '#F52EA9');
  }
});

test('the main scroll surface reaches the right viewport edge at desktop, tablet and mobile widths', () => {
  const workspace = require('postcss').parse(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'));
  let layouts = 0;
  workspace.walkRules('.is-workspace .wda-setup-layout', (rule) => {
    rule.walkDecls('padding', (decl) => { layouts++; assert.equal(decl.value, '0'); });
  });
  assert.equal(layouts, 3, 'Base, tablet and mobile must not reintroduce an outside gutter');
  // Content retains its own reading gutters; the scrollbar lives outside them.
  const setup = require('postcss').parse(readFileSync(new URL('../app/setup.css', import.meta.url), 'utf8'));
  let readingGutter = false;
  setup.walkRules('.wda-setup-content', (rule) => rule.walkDecls('padding', (decl) => { if (decl.value === '32px 38px 48px') readingGutter = true; }));
  assert.equal(readingGutter, true);
});

test('account enter/exit use reversible fade/scale transitions and delayed visibility, with a motion-free fallback', () => {
  const mobile = '(max-width: 600px)';
  const closed = ':root .wda-setup-app.is-workspace .wda-setup-rail';
  const open = ':root .wda-setup-app.is-workspace[data-account-open="true"] .wda-setup-rail';
  assert.equal(properties(closed, mobile).opacity, '0');
  assert.equal(properties(open, mobile).opacity, '1');
  assert.equal(properties(closed, mobile)['transform-origin'], 'top right');
  assert.match(properties(closed, mobile).transition, /opacity \.18s.*transform \.22s.*visibility 0s linear \.22s/);
  assert.match(properties(open, mobile).transition, /transform \.3s cubic-bezier\(\.22,1,\.36,1\),visibility 0s/);
  assert.equal(properties(open, mobile)['pointer-events'], 'auto');
  for (const selector of [closed, open]) {
    assert.equal(properties(selector, '(prefers-reduced-motion: reduce)').transition, 'none');
    assert.equal(properties(selector, '(prefers-reduced-motion: reduce)').transform, 'none');
  }
  assert.match(properties('.is-workspace .wda-setup-layout', '(min-width: 601px)').transition, /grid-template-columns \.36s cubic-bezier\(\.22,1,\.36,1\)/);
  assert.match(properties('.is-workspace .wda-nav-label', '(min-width: 601px)').transition, /opacity/);
  assert.equal(properties('.is-workspace .wda-nav-label', '(prefers-reduced-motion: reduce)').transition, 'none');
});

function events() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    emit(type, event = {}) { for (const handler of [...(listeners.get(type) || [])]) handler(event); },
    count() { return [...listeners.values()].reduce((count, set) => count + set.size, 0); },
  };
}

async function harness({ saved = null, blocked = false } = {}) {
  const window = events();
  const document = events();
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (callback) => { timers.set(++timerId, callback); return timerId; };
  window.clearTimeout = (id) => timers.delete(id);
  window.innerWidth = 1000; window.innerHeight = 800;
  document.body = {};
  const mobile = { ...events(), matches: true };
  const writes = [];
  let stored = saved;
  let dialog = false;
  let focuses = 0;
  const panel = { contains: (target) => target?.inPanel === true };
  const rail = { inert: false, attributes: {}, contains: (target) => !!target?.inRail, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; } };
  const trigger = { contains: (target) => target?.isTrigger === true, focus: () => { focuses += 1; } };
  const root = { ...events(), querySelector: (selector) => selector === '#workspace-navigation' ? rail : panel };
  document.querySelector = () => dialog;
  window.matchMedia = () => mobile;
  window.localStorage = {
    getItem() { if (blocked) throw new Error('Storage blocked'); return stored; },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); writes.push([key, value]); stored = value; },
  };
  const slots = [];
  let cursor = 0;
  let effects = [];
  let context;
  const cleanups = new Set();
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (index >= slots.length) slots.push(typeof initial === 'function' ? initial() : initial); return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { return hooks.useState({ current: initial })[0]; },
    useContext() { return context; },
    useEffect(callback, deps) {
      const ref = hooks.useRef({ deps: undefined, cleanup: null });
      if (!ref.current.deps || deps.some((value, index) => !Object.is(value, ref.current.deps[index]))) {
        effects.push(() => { if (ref.current.cleanup) { ref.current.cleanup(); cleanups.delete(ref.current.cleanup); } ref.current.cleanup = callback(); ref.current.deps = deps; if (ref.current.cleanup) cleanups.add(ref.current.cleanup); });
      }
    },
  };
  const module = await load('app/_components/WorkspaceNavigation.jsx', { react: hooks, 'react-dom': { createPortal: (children) => children }, './CTCIcon.jsx': asDefault(Icon) }, { window, document });
  const render = () => {
    cursor = 0; effects = [];
    const tree = module.default({ className: 'wda-setup-app is-workspace', children: 'Content' });
    context = tree.props.value;
    tree.props.children.ref.current = root;
    const account = module.MobileAccountToggle({ children: 'Avatar' });
    account.ref.current = trigger;
    effects.forEach((run) => run());
    return { root: tree.props.children, account, sidebar: module.SidebarToggle() };
  };
  render();
  return { render, writes, window, document, mobile, rail, rootNode: root, key: module.SIDEBAR_STORAGE_KEY,
    tick() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    setStored(value) { stored = value; }, setDialog(value) { dialog = value; }, focuses: () => focuses,
    close() { for (const cleanup of cleanups) cleanup(); cleanups.clear(); },
  };
}

test('sidebar toggles, restores and synchronizes its own preference without depending on storage availability', async () => {
  const h = await harness({ saved: '1' });
  try {
    let view = h.render();
    assert.equal(view.root.props['data-sidebar-collapsed'], true);
    assert.equal(view.sidebar.props['aria-label'], 'Expand sidebar');
    view.sidebar.props.onClick();
    view = h.render();
    assert.equal(view.root.props['data-sidebar-collapsed'], undefined);
    assert.equal(view.sidebar.props['aria-expanded'], true);
    assert.deepEqual(h.writes, [[h.key, '0']]);
    h.setStored('1');
    h.window.emit('storage', { key: 'unrelated' });
    assert.equal(h.render().root.props['data-sidebar-collapsed'], undefined);
    h.window.emit('storage', { key: h.key });
    assert.equal(h.render().root.props['data-sidebar-collapsed'], true);
    h.close();
    assert.equal(h.window.count(), 0);
    assert.equal(h.mobile.count(), 0);
  } finally { h.close(); }
  const blocked = await harness({ blocked: true });
  try { blocked.render().sidebar.props.onClick(); assert.equal(blocked.render().root.props['data-sidebar-collapsed'], true); } finally { blocked.close(); }
});

test('Ctrl+Shift+S toggles and persists the desktop sidebar without repeat, editor, modal or mobile conflicts', async () => {
  const h = await harness();
  try {
    h.mobile.matches = false; h.mobile.emit('change'); h.render();
    let prevented = 0;
    const press = (overrides = {}) => h.document.emit('keydown', { key: 'S', ctrlKey: true, shiftKey: true, preventDefault() { prevented++; }, ...overrides });
    press();
    assert.equal(h.render().root.props['data-sidebar-collapsed'], true);
    press({ key: 's' });
    assert.equal(h.render().root.props['data-sidebar-collapsed'], undefined);
    assert.equal(prevented, 2);
    assert.deepEqual(h.writes, [[h.key, '1'], [h.key, '0']]);
    for (const overrides of [{ repeat: true }, { defaultPrevented: true }, { isComposing: true }, { ctrlKey: false }, { shiftKey: false }, { altKey: true }, { metaKey: true }, { target: { closest: () => ({}) } }]) press(overrides);
    h.setDialog(true); press(); h.setDialog(false);
    h.mobile.matches = true; press();
    assert.equal(prevented, 2);
    assert.equal(h.render().root.props['data-sidebar-collapsed'], undefined);
    h.close();
    assert.equal(h.document.count(), 0);
  } finally { h.close(); }
});

test('toggle tooltip presents a shortcut on hover/focus, supports hover transfer and Escape, and stays out of the rail layout', async () => {
  const h = await harness();
  try {
    h.mobile.matches = false; h.mobile.emit('change');
    const button = { getBoundingClientRect: () => ({ right: 180, top: 20, height: 44 }) };
    let view = h.render();
    view.sidebar.props.onPointerEnter({ pointerType: 'mouse', currentTarget: button });
    view = h.render();
    let hint = view.root.props.children[1];
    assert.equal(hint.props.role, 'tooltip');
    assert.equal(hint.props['data-open'], true);
    assert.equal(hint.props.style.left, 190);
    assert.equal(view.sidebar.props['aria-describedby'], 'workspace-sidebar-hint');
    assert.match(renderToStaticMarkup(hint), /Toggle sidebar.*<kbd>Ctrl\+Shift\+S<\/kbd>/);
    view.sidebar.props.onPointerLeave();
    hint.props.onPointerEnter(); h.tick();
    assert.equal(h.render().root.props.children[1].props['data-open'], true);
    hint.props.onPointerLeave(); h.tick();
    assert.equal(h.render().root.props.children[1].props['aria-hidden'], true);
    h.render().sidebar.props.onFocus({ currentTarget: button }); h.render();
    h.document.emit('keydown', { key: 'Escape' });
    assert.equal(h.render().root.props.children[1].props['data-open'], undefined);
    h.render().sidebar.props.onFocus({ currentTarget: button }); h.render();
    h.window.emit('resize');
    assert.equal(h.render().root.props.children[1].props['data-open'], undefined);
    h.close(); assert.equal(h.document.count(), 0); assert.equal(h.window.count(), 0);
  } finally { h.close(); }
  assert.equal(properties('.wda-sidebar-hint').position, 'fixed');
  assert.match(properties('.wda-sidebar-hint').transform, /-50%/);
  assert.equal(properties('.wda-sidebar-hint', '(prefers-reduced-motion: reduce)').transition, 'none');
});

test('desktop rail uses natural height with only real overflow, no nested collapsed scroll, and a fitting theme toggle', () => {
  const desktop = '(min-width: 601px)';
  assert.equal(properties('.is-workspace .wda-setup-rail', desktop)['overflow-y'], 'auto');
  assert.equal(properties('.is-workspace .wda-rail-heading', desktop)['flex-shrink'], '0');
  assert.equal(properties('.is-workspace[data-sidebar-collapsed="true"] .wda-setup-rail nav', desktop).overflow, 'visible');
  assert.equal(properties('.is-workspace[data-sidebar-collapsed="true"] .wda-workspace-appearance [data-theme-slot]', desktop)['min-width'], '48px');
  assert.equal(properties('.is-workspace[data-sidebar-collapsed="true"] .wda-workspace-appearance .wda-theme-switch', desktop).width, '48px');
});

test('collapsed account, appearance, navigation and support controls carry descriptive tooltip metadata', () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', buyerName: 'Alex', buyerEmail: 'member@example.test', discoveryHref: '/discover' }));
  for (const label of ['Your account', 'Appearance', 'Discovery', 'Targeting', 'Contracts', 'Back to my products', 'Log out']) {
    assert.ok(html.includes(`data-sidebar-hint="${label}"`), label);
  }
  assert.match(html, /role="group" aria-label="Your account" tabindex="0"/);
  assert.match(html, /data-sidebar-hint-detail="Alex · member@example.test"/);
  assert.match(html, /data-sidebar-hint="Log out"[^>]*data-sidebar-hint-tone="danger"/);
  const support = readFileSync(new URL('../app/_components/SupportCTA.jsx', import.meta.url), 'utf8');
  for (const label of ['Send feedback', 'Email support', 'Contact support']) assert.ok(support.includes(`data-sidebar-hint="${label}"`));
});

function hintedControl(label, { detail = '', tone = '', theme = null } = {}) {
  const attributes = { 'data-sidebar-hint': label, 'data-sidebar-hint-detail': detail, 'data-sidebar-hint-tone': tone, 'aria-describedby': 'existing-help' };
  const control = { inRail: true,
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; },
    removeAttribute: (name) => { delete attributes[name]; },
    getBoundingClientRect: () => ({ right: 64, top: 500, height: 44 }),
    closest: () => control,
    contains: (target) => target === control || (!!theme && target === theme),
    querySelector: () => theme,
  };
  if (theme) theme.closest = () => control;
  return control;
}

test('every collapsed icon gets a hover/focus label outside clipping, while preserving descriptions and click behavior', async () => {
  const h = await harness({ saved: '1' });
  try {
    h.mobile.matches = false; h.mobile.emit('change'); h.render();
    for (const label of ['Discovery', 'Targeting', 'Contracts', 'Send feedback', 'Email support', 'Back to my products', 'Log out']) {
      const control = hintedControl(label, { tone: label === 'Log out' ? 'danger' : '' });
      h.rootNode.emit('pointerover', { type: 'pointerover', pointerType: 'mouse', target: control });
      let view = h.render();
      const hint = view.root.props.children[1];
      const html = renderToStaticMarkup(hint);
      assert.ok(html.includes(`<span>${label}</span>`));
      assert.doesNotMatch(html, /<kbd>/, 'Only the sidebar toggle advertises a shortcut');
      assert.equal(view.sidebar.props['aria-describedby'], undefined, 'Unrelated toggle does not describe another control');
      assert.equal(control.getAttribute('aria-describedby'), 'existing-help workspace-sidebar-hint');
      if (label === 'Log out') assert.equal(hint.props['data-tone'], 'danger');
      h.rootNode.emit('click', { target: control, preventDefault() { throw new Error('Do not intercept original actions'); } });
      h.render();
      assert.equal(control.getAttribute('aria-describedby'), 'existing-help');
      h.rootNode.emit('focusin', { type: 'focusin', target: control }); h.render();
      h.rootNode.emit('focusout', { type: 'focusout', target: control, relatedTarget: {} });
      assert.equal(h.render().root.props.children[1].props['aria-hidden'], true);
    }
    const profile = hintedControl('Your account', { detail: 'Alex · member@example.test' });
    h.rootNode.emit('focusin', { type: 'focusin', target: profile });
    assert.match(renderToStaticMarkup(h.render().root.props.children[1]), /Alex · member@example.test/);
    h.document.emit('keydown', { key: 'Escape' }); h.render();
    assert.equal(profile.getAttribute('aria-describedby'), 'existing-help');
    h.render().sidebar.props.onClick(); h.render();
    assert.equal(h.rootNode.count(), 0, 'Expanded navigation no longer needs icon-only hints');
    h.close(); assert.equal(h.rootNode.count(), 0);
  } finally { h.close(); }
});

test('native event delegation includes the portalled theme switch, tracks its next mode, and ignores mobile/modal interactions', async () => {
  const h = await harness({ saved: '1' });
  try {
    const input = hintedControl('switch'); input.checked = false;
    const appearance = hintedControl('Appearance', { theme: input });
    h.rootNode.emit('pointerover', { type: 'pointerover', target: appearance });
    assert.equal(h.render().root.props.children[1], null, 'No desktop tooltip on mobile');
    h.mobile.matches = false; h.mobile.emit('change'); h.render();
    h.rootNode.emit('focusin', { type: 'focusin', target: input });
    assert.match(renderToStaticMarkup(h.render().root.props.children[1]), /Switch to dark mode/);
    input.checked = true;
    h.rootNode.emit('change', { type: 'change', target: input });
    assert.match(renderToStaticMarkup(h.render().root.props.children[1]), /Switch to light mode/);
    assert.equal(input.getAttribute('aria-describedby'), 'existing-help workspace-sidebar-hint');
    h.document.emit('keydown', { key: 'Escape' }); h.render();
    h.setDialog(true);
    h.rootNode.emit('focusin', { type: 'focusin', target: input });
    assert.equal(h.render().root.props.children[1].props['aria-hidden'], true);
    h.close();
    assert.equal(input.getAttribute('aria-describedby'), 'existing-help');
  } finally { h.close(); }
});

test('mobile account disclosure supports Escape, outside click, keyboard exit and resize without interfering with support dialogs', async () => {
  const h = await harness();
  try {
    const open = () => { h.render().account.props.onClick(); return h.render(); };
    let view = open();
    assert.equal(view.account.props['aria-expanded'], true);
    assert.equal(view.root.props['data-account-open'], true);
    h.document.emit('pointerdown', { target: { inPanel: true } });
    assert.equal(h.render().account.props['aria-expanded'], true);
    h.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopPropagation() {} });
    assert.equal(h.render().account.props['aria-expanded'], false);
    assert.equal(h.focuses(), 1);
    open();
    h.setDialog(true);
    h.document.emit('keydown', { key: 'Escape', preventDefault() { throw new Error('Do not intercept modal Escape'); } });
    h.document.emit('focusin', { target: {} });
    assert.equal(h.render().account.props['aria-expanded'], true);
    h.setDialog(false);
    h.document.emit('pointerdown', { target: {} });
    assert.equal(h.render().account.props['aria-expanded'], false);
    open();
    h.document.emit('focusin', { target: {} });
    assert.equal(h.render().account.props['aria-expanded'], false);
    open();
    h.mobile.matches = false;
    h.mobile.emit('change');
    assert.equal(h.render().account.props['aria-expanded'], false);
    open();
    h.render().root.props.onClick({ target: { closest: () => ({}) } });
    assert.equal(h.render().account.props['aria-expanded'], false);
    h.close();
    assert.equal(h.document.count(), 0);
  } finally { h.close(); }
});

test('closing immediately makes the fading mobile panel inert, rapid reopening restores it, and desktop is never hidden', async () => {
  const h = await harness();
  try {
    assert.equal(h.rail.inert, true);
    assert.equal(h.rail.attributes['aria-hidden'], 'true');
    h.render().account.props.onClick(); h.render();
    assert.equal(h.rail.inert, false);
    assert.equal(h.rail.attributes['aria-hidden'], undefined);
    h.render().account.props.onClick(); h.render();
    assert.equal(h.rail.inert, true);
    h.render().account.props.onClick(); h.render();
    assert.equal(h.rail.inert, false, 'No delayed close callback can disable a newly reopened panel');
    h.mobile.matches = false; h.mobile.emit('change'); h.render();
    assert.equal(h.rail.inert, false);
    assert.equal(h.rail.attributes['aria-hidden'], undefined);
    h.mobile.matches = true; h.mobile.emit('change'); h.render();
    assert.equal(h.rail.inert, true);
    h.close();
    assert.equal(h.rail.inert, false);
    assert.equal(h.rail.attributes['aria-hidden'], undefined);
    assert.equal(h.mobile.count(), 0);
    assert.equal(h.document.count(), 0);
  } finally { h.close(); }
});
