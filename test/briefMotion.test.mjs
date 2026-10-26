import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installBriefMotion } from '../lib/briefMotion.js';

function events() {
  const listeners = new Map();
  return {
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
    emit(name, event = {}) { for (const handler of [...(listeners.get(name) || [])]) handler(event); },
    count() { return [...listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0); },
  };
}
function attributes() {
  const values = new Map();
  return { getAttribute: (name) => values.get(name) ?? null, setAttribute: (name, value) => values.set(name, value), removeAttribute: (name) => values.delete(name) };
}
function harness({ reduced = false, supported = true, throws = false, observer = true } = {}) {
  const media = { ...events(), matches: reduced };
  let watcher;
  const doc = { activeElement: null };
  const items = [true, false].map((open) => {
    let active = null, naturalHeight = 240;
    const animations = [];
    const child = {};
    const details = { open, dataset: {} };
    const summary = { ...events(), ...attributes(), focusCount: 0, focus() { this.focusCount++; doc.activeElement = this; } };
    const content = { ...attributes(), style: { overflow: '' }, inert: false, ownerDocument: doc, firstElementChild: {},
      contains: (node) => node === child,
      getBoundingClientRect: () => ({ height: details.open ? active?.height ?? naturalHeight : 0 }),
      get scrollHeight() { return naturalHeight; },
      get opacity() { return active?.opacity ?? 1; },
    };
    if (supported) content.animate = (frames, options) => {
      if (throws) throw new Error('Animation unavailable');
      const animation = { frames, options, height: parseFloat(frames[0].height), opacity: frames[0].opacity, cancelled: false,
        cancel() { this.cancelled = true; if (active === this) active = null; },
        finish() { this.height = parseFloat(frames[1].height); this.opacity = frames[1].opacity; this.onfinish?.(); },
      };
      active = animation; animations.push(animation); return animation;
    };
    details.querySelector = (selector) => selector === 'summary' ? summary : content;
    return { details, summary, content, animations, child,
      click(overrides = {}) {
        const event = { button: 0, defaultPrevented: false, prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
        summary.emit('click', event);
        if (!event.prevented && !event.defaultPrevented && (event.button === undefined || event.button === 0)) details.open = !details.open;
        return event;
      },
      paint(height, opacity) { active.height = height; active.opacity = opacity; },
      resize(height) { naturalHeight = height; watcher?.callback([{ target: content.firstElementChild }]); },
    };
  });
  const root = { querySelectorAll: () => items.map((item) => item.details) };
  const view = { matchMedia: () => media, getComputedStyle: (node) => ({ opacity: String(node.opacity) }) };
  if (observer) view.ResizeObserver = class {
    constructor(callback) { watcher = this; this.callback = callback; this.observed = new Set(); this.disconnected = false; }
    observe(node) { this.observed.add(node); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
  };
  const cleanup = installBriefMotion(root, view);
  return { items, doc, media, cleanup, watcher: () => watcher };
}

test('opening measures full content height, fades in and restores natural auto-height on completion', () => {
  const h = harness();
  const section = h.items[1];
  assert.equal(section.details.open, false);
  assert.equal(section.click().prevented, true);
  const animation = section.animations[0];
  assert.deepEqual(animation.frames, [{ height: '0px', opacity: 0 }, { height: '240px', opacity: 1 }]);
  assert.equal(animation.options.duration, 320);
  assert.equal(section.details.open, true);
  assert.equal(section.summary.getAttribute('aria-expanded'), 'true');
  assert.equal(section.content.inert, false);
  assert.equal(section.content.style.overflow, 'hidden');
  animation.finish();
  assert.equal(section.details.open, true);
  assert.equal(section.content.style.overflow, '');
  assert.equal(section.content.getAttribute('aria-hidden'), null);
  assert.equal(section.summary.getAttribute('aria-expanded'), null, 'Native details semantics take over at rest');
  assert.equal(section.content.style.height, undefined, 'No fixed inline height can clip later wrapping');
  h.cleanup();
});

test('closing stays painted while shrinking, blocks hidden-body focus and only removes open after the exit', () => {
  const h = harness();
  const section = h.items[0];
  h.doc.activeElement = section.child;
  section.click();
  assert.equal(section.details.open, true);
  assert.equal(section.details.dataset.briefExpanded, 'false');
  assert.equal(section.summary.getAttribute('aria-expanded'), 'false');
  assert.equal(section.content.getAttribute('aria-hidden'), 'true');
  assert.equal(section.content.inert, true);
  assert.equal(h.doc.activeElement, section.summary);
  assert.deepEqual(section.animations[0].frames, [{ height: '240px', opacity: 1 }, { height: '0px', opacity: 0 }]);
  assert.equal(section.animations[0].options.duration, 240);
  section.animations[0].finish();
  assert.equal(section.details.open, false);
  assert.equal(section.content.inert, false, 'Closed native details now provide their own visibility/focus behavior');
  assert.equal(section.details.dataset.briefExpanded, undefined);
  h.cleanup();
});

test('rapid reversals start at the currently painted height/opacity and stale completions cannot close a reopened section', () => {
  const h = harness();
  const section = h.items[0];
  section.click();
  const old = section.animations[0], staleFinish = old.onfinish;
  section.paint(90, .4);
  section.click();
  assert.equal(old.cancelled, true);
  assert.deepEqual(section.animations[1].frames[0], { height: '90px', opacity: .4 });
  assert.deepEqual(section.animations[1].frames[1], { height: '240px', opacity: 1 });
  staleFinish();
  assert.equal(section.details.open, true);
  assert.equal(section.content.inert, false);
  section.paint(150, .8); section.click();
  assert.deepEqual(section.animations[2].frames[0], { height: '150px', opacity: .8 });
  section.animations[2].finish();
  assert.equal(section.details.open, false);
  h.cleanup();
});

test('sections remain independent and native keyboard-generated clicks follow the same animation path', () => {
  const h = harness();
  h.items[1].click({ button: undefined, detail: 0 });
  h.items[1].animations[0].finish();
  assert.equal(h.items[0].details.open, true);
  assert.equal(h.items[1].details.open, true);
  h.items[0].click(); h.items[0].animations[0].finish();
  assert.equal(h.items[0].details.open, false);
  assert.equal(h.items[1].details.open, true);
  h.cleanup();
});

test('reduced motion and missing animation APIs leave native toggles instant; preference changes settle running motion', () => {
  for (const settings of [{ reduced: true }, { supported: false }]) {
    const h = harness(settings);
    assert.equal(h.items[1].click().prevented, false);
    assert.equal(h.items[1].details.open, true);
    assert.equal(h.items[1].animations.length, 0);
    h.cleanup();
  }
  const h = harness();
  h.items[0].click(); h.items[1].click();
  h.media.matches = true; h.media.emit('change');
  assert.equal(h.items[0].details.open, false);
  assert.equal(h.items[1].details.open, true);
  assert.equal(h.items[0].animations[0].cancelled, true);
  h.cleanup();
});

test('opening retargets resized content without jumping, and cleanup cancels work and releases observers/listeners', () => {
  const h = harness();
  const section = h.items[1];
  section.click(); section.paint(100, .6); section.resize(360);
  assert.deepEqual(section.animations[1].frames, [{ height: '100px', opacity: .6 }, { height: '360px', opacity: 1 }]);
  h.cleanup();
  assert.equal(section.details.open, true);
  assert.equal(section.animations[1].cancelled, true);
  assert.equal(section.summary.count(), 0);
  assert.equal(section.content.style.overflow, '');
  assert.equal(h.media.count(), 0);
  assert.equal(h.watcher().disconnected, true);
});

test('animation failures settle safely, prevented clicks remain untouched, and observers are optional', () => {
  const failure = harness({ throws: true });
  failure.items[0].click();
  assert.equal(failure.items[0].details.open, false);
  assert.equal(failure.items[0].content.inert, false);
  failure.cleanup();
  const h = harness({ observer: false });
  h.items[0].click({ defaultPrevented: true });
  h.items[0].click({ button: 2 });
  assert.equal(h.items[0].animations.length, 0);
  h.items[0].click(); h.items[0].animations[0].finish();
  assert.equal(h.items[0].details.open, false);
  h.cleanup();
  assert.doesNotThrow(() => installBriefMotion(null, {})());
});

test('motion wraps existing body padding and preserves native summary markup, with reduced-motion chevrons', () => {
  const page = readFileSync(new URL('../app/d/[token]/[notice_id]/page.js', import.meta.url), 'utf8');
  assert.match(page, /<details[^>]*open=\{index === initiallyOpenIndex\}/);
  assert.match(page, /<summary className="ctc-brief-section-heading"/);
  assert.match(page, /<div className="ctc-brief-section-content"><div className="ctc-brief-section-body">/);
  const css = readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8');
  assert.match(css, /data-brief-expanded="false"/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*\}[^}]*ctc-brief-section-heading > \.ctc-icon \{ transition: none/);
});
