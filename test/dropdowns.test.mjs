import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const source = readFileSync(new URL('../app/_components/Select.jsx', import.meta.url), 'utf8');
const { code } = await swc.transform(source, {
  filename: 'Select.jsx', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
  module: { type: 'commonjs' },
});
function load(hooks = React) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => id === 'react' ? hooks : require(id), module, module.exports);
  return module.exports.default;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const categories = ["Something isn't working", 'Contract issue', 'Niche Advisor issue', 'Account/access issue', 'Other'];

function harness({ options = categories, popover = false, disabled = false } = {}) {
  const slots = [], pending = [], changes = [], listeners = new Map(), windowListeners = new Map();
  let cursor = 0, tree;
  const view = { innerWidth: 400, innerHeight: 600,
    addEventListener: (name, handler) => windowListeners.set(name, handler),
    removeEventListener: (name) => windowListeners.delete(name) };
  const doc = { defaultView: view, addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name) => listeners.delete(name) };
  const button = { ownerDocument: doc, focusCount: 0, focus() { this.focusCount++; doc.activeElement = this; },
    getBoundingClientRect: () => ({ left: 20, top: 520, bottom: 568, width: 360 }) };
  let scrollCalls = 0;
  const panel = { style: {}, dataset: {}, attributes: {}, scrollHeight: 240, offsetWidth: 360,
    setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
    querySelector: () => ({ scrollIntoView: () => { scrollCalls++; } }),
    matches: () => !!panel.shown,
  };
  if (popover) { panel.showPopover = () => { panel.shown = true; }; panel.hidePopover = () => { panel.shown = false; }; }
  const root = { contains: (target) => [root, button, panel].includes(target) };
  const hooks = { ...React,
    useId: () => 'test-id',
    useState(initial) { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(effect, deps) { const index = cursor++; const old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        pending.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const Component = load(hooks);
  const props = { id: 'category', name: 'category', value: typeof options[0] === 'string' ? options[0] : options[0]?.value ?? '', options, disabled,
    onChange(value) { changes.push(value); props.value = value; }, 'aria-label': 'Category' };
  function render() {
    cursor = 0; tree = Component(props);
    for (const node of nodes(tree)) {
      if (!node.ref) continue;
      node.ref.current = node.props.className === 'wda-select' ? root : node.props.role === 'combobox' ? button : panel;
    }
    while (pending.length) pending.shift()();
    return tree;
  }
  const trigger = () => nodes(tree).find((node) => node.props?.role === 'combobox');
  function key(key, modifiers = {}) {
    const event = { key, prevented: false, stopped: false, ...modifiers,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    trigger().props.onKeyDown(event); render(); return event;
  }
  render();
  return { props, render, trigger, key, changes, panel, button, root, listeners, windowListeners, view,
    nodes: () => nodes(tree), tree: () => tree, scrollCalls: () => scrollCalls,
    click() { trigger().props.onClick(); render(); },
    option(index) { return nodes(tree).find((node) => node.props?.['data-index'] === index); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('shared select renders a labelled, unique combobox and named form value, never a native select', () => {
  const Select = load();
  const html = renderToStaticMarkup(React.createElement('div', null,
    React.createElement(Select, { name: 'category', options: categories, value: categories[0], onChange() {}, 'aria-label': 'Category' }),
    React.createElement(Select, { options: categories, value: categories[1], onChange() {}, 'aria-label': 'Another category' })));
  assert.doesNotMatch(html, /<select|<option/);
  assert.match(html, /role="combobox" aria-haspopup="listbox" aria-expanded="false"/);
  assert.match(html, /type="hidden" name="category" value="Something isn&#x27;t working"/);
  assert.match(html, /aria-label="Category"/);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, 2);
});

test('keyboard exploration leaves the value unchanged; Enter commits and cannot submit a form', () => {
  const h = harness();
  assert.equal(h.key('Enter').prevented, true);
  assert.equal(h.trigger().props['aria-expanded'], true);
  h.key('ArrowDown'); h.key('ArrowDown');
  assert.equal(h.trigger().props['aria-activedescendant'], 'category-options-2');
  assert.deepEqual(h.changes, []);
  assert.ok(h.scrollCalls() >= 3);
  assert.equal(h.key('Enter').prevented, true);
  assert.deepEqual(h.changes, [categories[2]]);
  assert.equal(h.trigger().props['aria-expanded'], false);
  assert.equal(h.nodes().find((node) => node.type === 'input').props.value, categories[2]);
  h.cleanup();
});

test('Escape cancels, Home/End reach list boundaries, and Tab commits without trapping focus', () => {
  const h = harness();
  h.key('ArrowDown'); h.key('End');
  const escape = h.key('Escape');
  assert.equal(escape.prevented, true); assert.equal(escape.stopped, true);
  assert.deepEqual(h.changes, []);
  h.key('ArrowUp'); h.key('End'); h.key('Home');
  assert.equal(h.trigger().props['aria-activedescendant'], 'category-options-0');
  h.key('End');
  assert.equal(h.key('Tab').prevented, false);
  assert.deepEqual(h.changes, ['Other']);
  assert.equal(h.button.focusCount, 0);
  h.cleanup();
});

test('typeahead supports multi-letter search, repeated-letter cycling and skips disabled choices', () => {
  const h = harness({ options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', disabled: true }, { value: 'br', label: 'Bravo' }, { value: 'c', label: 'Contract' }, { value: 'cl', label: 'Cleaning' }] });
  h.key('b');
  assert.equal(h.trigger().props['aria-activedescendant'], 'category-options-2');
  h.key('Escape'); h.key('c'); h.key('c');
  assert.equal(h.trigger().props['aria-activedescendant'], 'category-options-4');
  h.key('Escape'); h.key('c'); h.key('o'); h.key('n');
  assert.equal(h.trigger().props['aria-activedescendant'], 'category-options-3');
  h.key('Escape'); h.key('Home'); h.key('ArrowDown');
  assert.equal(h.trigger().props['aria-activedescendant'], 'category-options-2');
  h.cleanup();
});

test('pointer choices retain focus, outside click cancels, blur commits and cleanup removes listeners', () => {
  const h = harness();
  h.click();
  h.option(2).props.onPointerMove(); h.render();
  h.listeners.get('pointerdown')({ target: {} }); h.render();
  assert.equal(h.trigger().props['aria-expanded'], false);
  assert.deepEqual(h.changes, []);
  h.click();
  let prevented = false;
  h.option(1).props.onPointerDown({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  h.option(1).props.onClick(); h.render();
  assert.deepEqual(h.changes, [categories[1]]);
  assert.equal(h.button.focusCount, 1);
  h.click(); h.key('End');
  h.tree().props.onBlur({ currentTarget: h.root, relatedTarget: {} }); h.render();
  assert.deepEqual(h.changes, [categories[1], 'Other']);
  h.cleanup(); assert.equal(h.listeners.size, 0);
});

test('disabled, empty and all-disabled controls cannot open or change value', () => {
  for (const settings of [{ disabled: true }, { options: [] }, { options: [{ value: 'a', label: 'Alpha', disabled: true }] }]) {
    const h = harness(settings);
    h.click(); h.key('Enter'); h.key('ArrowDown');
    assert.equal(h.trigger().props.disabled, true);
    assert.equal(h.trigger().props['aria-expanded'], false);
    assert.deepEqual(h.changes, []);
    h.cleanup();
  }
});

test('top-layer menu remains inside its dialog DOM, flips above, clamps width and follows viewport changes', () => {
  const h = harness({ popover: true });
  h.click();
  assert.equal(h.panel.attributes.popover, 'manual');
  assert.equal(h.panel.shown, true);
  assert.equal(h.panel.dataset.topLayer, 'true');
  assert.equal(h.panel.dataset.placement, 'above');
  assert.equal(h.panel.style.width, '360px');
  assert.equal(h.panel.style.top, '272px');
  assert.equal(h.root.contains(h.panel), true);
  h.view.innerWidth = 200;
  h.windowListeners.get('resize')();
  assert.equal(h.panel.style.width, '176px');
  h.key('Escape');
  assert.equal(h.panel.shown, false);
  assert.equal(h.listeners.size, 0); assert.equal(h.windowListeners.size, 0);
  h.cleanup();
});

test('fallback and failed popover use an in-flow list; selection still works without the Popover API', () => {
  for (const fail of [false, true]) {
    const h = harness();
    if (fail) h.panel.showPopover = () => { throw new Error('Unsupported'); };
    h.click();
    assert.equal(h.panel.dataset.topLayer, undefined);
    assert.equal(h.panel.attributes.popover, undefined);
    h.key('End'); h.key(' ');
    assert.deepEqual(h.changes, ['Other']);
    h.cleanup();
  }
});

test('global menu CSS covers feedback and targeting, supports theme/accessibility modes, and leaves no native dropdowns', () => {
  const css = readFileSync(new URL('../app/dropdowns.css', import.meta.url), 'utf8');
  require('postcss').parse(css);
  assert.match(css, /:root\[data-theme="dark"\] \{[\s\S]*--dropdown-surface: rgba\(40, 36, 45, \.94\)/);
  assert.match(css, /:is\(\.wda-select-menu,\.targeting-dropdown\)[\s\S]*border: 0/);
  assert.match(css, /\.wda-select-menu \{\s*position: relative/);
  assert.match(css, /\.wda-select-menu\[data-top-layer="true"\] \{ position: fixed/);
  assert.match(css, /min-height: 46px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8'), /import '\.\/dropdowns\.css'/);
  const files = readdirSync(new URL('../app/', import.meta.url), { recursive: true }).filter((file) => /\.(jsx|js)$/.test(file));
  for (const file of files) {
    assert.doesNotMatch(readFileSync(new URL(`../app/${file.replaceAll('\\', '/')}`, import.meta.url), 'utf8'), /<select\b|<option\b/, file);
  }
});
