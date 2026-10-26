import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installLiquidHover, LIQUID_SELECTOR } from '../lib/liquid.js';

function harness(options) {
  const listeners = new Map();
  const media = { matches: false, addEventListener: (_, fn) => { media.change = fn; }, removeEventListener: () => { media.change = null; } };
  const frames = new Map();
  let nextFrame = 0;
  const doc = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const win = {
    matchMedia: () => media,
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  const cleanup = installLiquidHover(doc, win, options);
  function surface() {
    const values = new Map();
    return {
      values, isConnected: true, disabled: false,
      matches() { return this.disabled; },
      closest(selector) { assert.equal(selector, options?.selector || LIQUID_SELECTOR); return this; },
      contains(node) { return node === this; },
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 100 }),
      style: { setProperty: (name, value) => values.set(name, value), removeProperty: (name) => values.delete(name) },
    };
  }
  const move = (target, x = 200, y = 100, pointerType = 'mouse') => listeners.get('pointermove')({ target, clientX: x, clientY: y, pointerType });
  const flush = () => { const queue = [...frames.values()]; frames.clear(); queue.forEach((fn) => fn()); };
  return { listeners, media, frames, cleanup, surface, move, flush };
}

test('delegation covers dynamically inserted buttons and uses only the latest pointer in a frame', () => {
  const h = harness();
  const button = h.surface(); // Created after installation, like a feedback modal.
  h.move({ closest: () => button }, 110, 60);
  h.move(button, 250, 125);
  assert.equal(h.frames.size, 1);
  assert.equal(button.values.size, 0);
  h.flush();
  assert.equal(button.values.get('--liquid-x'), '75.0%');
  assert.equal(button.values.get('--liquid-y'), '75.0%');
  assert.deepEqual([...h.listeners.keys()], ['pointermove', 'pointerout']); // No click, input or key interception.
  h.cleanup();
});

test('sidebar reflections use independent pointer coordinates without opting the rail into button effects', () => {
  const h = harness({ selector: '.is-workspace .wda-setup-rail' });
  const rail = h.surface();
  const navLink = {};
  rail.contains = (node) => node === rail || node === navLink;
  h.move(rail, 130, 80);
  h.flush();
  assert.equal(rail.values.get('--liquid-x'), '15.0%');
  assert.equal(rail.values.get('--liquid-y'), '30.0%');
  h.listeners.get('pointerout')({ relatedTarget: navLink });
  assert.equal(rail.values.size, 2);
  h.move(rail, 290, 145);
  h.media.matches = true;
  h.media.change();
  assert.equal(h.frames.size, 0);
  assert.equal(rail.values.size, 0);
  h.cleanup();
  assert.equal(h.listeners.size, 0);
  const shared = readFileSync(new URL('../app/_components/LiquidInteractions.jsx', import.meta.url), 'utf8');
  assert.match(shared, /selector: '\.is-workspace \.wda-setup-rail'/);
  assert.match(shared, /removeSidebarHover\(\)/);
});

test('touch, reduced motion and disabled controls never schedule liquid paints', () => {
  const h = harness();
  const button = h.surface();
  h.move(button, 200, 100, 'touch');
  h.media.matches = true;
  h.move(button);
  h.media.matches = false;
  button.disabled = true;
  h.move(button);
  assert.equal(h.frames.size, 0);
  assert.equal(button.values.size, 0);
  h.cleanup();
});

test('detached or newly disabled controls are not painted by a queued frame', () => {
  for (const change of [(button) => { button.isConnected = false; }, (button) => { button.disabled = true; }]) {
    const h = harness();
    const button = h.surface();
    h.move(button);
    change(button);
    h.flush();
    assert.equal(button.values.size, 0);
    h.cleanup();
  }
});

test('leaving or switching controls clears pointer position without changing element contents', () => {
  const h = harness();
  const first = h.surface();
  const second = h.surface();
  h.move(first);
  h.flush();
  h.listeners.get('pointerout')({ relatedTarget: first });
  assert.equal(first.values.size, 2); // Movement within a button is not leaving it.
  h.move(second);
  assert.equal(first.values.size, 0);
  h.flush();
  assert.equal(second.values.size, 2);
  h.listeners.get('pointerout')({ relatedTarget: null });
  assert.equal(second.values.size, 0);
  h.cleanup();
});

test('preference changes and unmount cancel pending work and remove all subscriptions', () => {
  const h = harness();
  const button = h.surface();
  h.move(button);
  h.flush();
  h.move(button);
  h.media.matches = true;
  h.media.change();
  assert.equal(h.frames.size, 0);
  assert.equal(button.values.size, 0);
  h.media.matches = false;
  h.move(button);
  h.cleanup();
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.media.change, null);
});

test('inline text controls do not schedule paint and cancel any pending surface highlight', () => {
  const h = harness();
  const inlineControl = { closest: (selector) => {
    assert.ok(!selector.split(',').map((part) => part.trim()).includes('button'));
    assert.ok(!selector.includes('[role="button"]'));
    return null; // Plain text buttons/links have no surface class or opt-in attribute.
  } };
  h.move(inlineControl);
  assert.equal(h.frames.size, 0);
  const button = h.surface();
  h.move(button);
  assert.equal(h.frames.size, 1);
  h.move(inlineControl);
  h.flush();
  assert.equal(button.values.size, 0);
  h.cleanup();
});

test('CSS sheen uses the same opt-in surfaces as pointer tracking, retaining plain-button focus rings', () => {
  const css = readFileSync(new URL('../app/liquid.css', import.meta.url), 'utf8');
  const sheenSelectors = [...css.matchAll(/:where\(([^)]+)\)[^{]*::after\s*\{/g)];
  assert.ok(sheenSelectors.length >= 4);
  const normalize = (selector) => selector.split(',').map((part) => part.trim()).sort();
  for (const [, selector] of sheenSelectors) assert.deepEqual(normalize(selector), normalize(LIQUID_SELECTOR));
  assert.match(css, /:where\(button,[^)]*\):focus-visible\s*\{[^}]*outline:/);
});

test('a nested button owns its highlight and the card sheen is suppressed without a fade', () => {
  const h = harness();
  const card = h.surface();
  const button = h.surface();
  card.contains = (node) => node === card || node === button;
  h.move(card);
  h.flush();
  assert.equal(card.values.size, 2);
  h.listeners.get('pointerout')({ relatedTarget: button });
  h.move({ closest: () => button }); // Event from the arrow/label inside the button.
  h.flush();
  assert.equal(card.values.size, 0);
  assert.equal(button.values.size, 2);
  const css = readFileSync(new URL('../app/liquid.css', import.meta.url), 'utf8');
  const parentRule = css.match(/:has\(:where\(button, a\[href\], \[role="button"\]\):is\(:hover, :focus-visible\)\)::after\s*\{([^}]+)\}/)?.[1];
  assert.ok(parentRule, 'Nested actions suppress ancestor hover and keyboard-focus glow');
  assert.match(parentRule, /opacity:\s*0/);
  assert.match(parentRule, /transition:\s*none/);
  h.move(card);
  h.flush();
  assert.equal(button.values.size, 0);
  assert.equal(card.values.size, 2);
  h.cleanup();
});
