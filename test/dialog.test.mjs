import test from 'node:test';
import assert from 'node:assert/strict';
import { containDialog } from '../lib/dialog.js';

function fixture() {
  const handlers = new Map();
  const doc = {
    body: { style: { overflow: 'auto' } },
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: (name) => handlers.delete(name),
  };
  const element = () => ({
    disabled: false, hidden: false, tabIndex: 0, isConnected: true, focusCount: 0,
    getAttribute: () => null, getClientRects: () => [1],
    focus() { doc.activeElement = this; this.focusCount += 1; },
  });
  const opener = element();
  const close = element();
  const input = element();
  const confirm = element();
  const cancel = element();
  const dialog = { ...element(), querySelectorAll: () => [close, input, confirm, cancel],
    querySelector: () => cancel, contains: (target) => [dialog, close, input, confirm, cancel].includes(target) };
  doc.activeElement = opener;
  let closed = 0;
  const options = { busy: false, onClose: () => { closed += 1; } };
  const cleanup = containDialog(dialog, doc, () => options);
  const key = (key, shiftKey = false, target = doc.activeElement) => {
    const event = { key, shiftKey, target, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    handlers.get('keydown')(event);
    return event;
  };
  return { doc, handlers, opener, close, input, confirm, cancel, dialog, options, key, cleanup, closed: () => closed };
}

test('opening prefers the safe action, locks scroll and restores focus/scroll on close', () => {
  const h = fixture();
  assert.equal(h.doc.activeElement, h.cancel);
  assert.equal(h.doc.body.style.overflow, 'hidden');
  h.cleanup();
  assert.equal(h.doc.body.style.overflow, 'auto');
  assert.equal(h.doc.activeElement, h.opener);
  assert.equal(h.handlers.size, 0);
});

test('Tab and Shift+Tab wrap within the popup and skip disabled controls', () => {
  const h = fixture();
  assert.equal(h.key('Tab').prevented, true);
  assert.equal(h.doc.activeElement, h.close);
  h.cancel.disabled = true;
  assert.equal(h.key('Tab', true).prevented, true);
  assert.equal(h.doc.activeElement, h.confirm);
  h.cleanup();
});

test('Escape closes once, but remains contained without dismissal during submission', () => {
  const h = fixture();
  const event = h.key('Escape');
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(h.closed(), 1);
  h.options.busy = true;
  h.key('Escape');
  assert.equal(h.closed(), 1);
  h.cleanup();
});

test('typing and updated callbacks do not refocus or replace an active input', () => {
  const h = fixture();
  h.input.focus();
  const count = h.input.focusCount;
  h.key('a'); h.key('b'); h.key('c');
  let replacementCalled = false;
  h.options.onClose = () => { replacementCalled = true; };
  assert.equal(h.doc.activeElement, h.input);
  assert.equal(h.input.focusCount, count);
  h.key('Escape');
  assert.equal(replacementCalled, true);
  h.cleanup();
});

test('programmatic focus outside the dialog is brought back to a safe action', () => {
  const h = fixture();
  h.handlers.get('focusin')({ target: h.opener });
  assert.equal(h.doc.activeElement, h.cancel);
  h.cleanup();
});

test('Escape lets an open dropdown close first, then dismisses its containing dialog', () => {
  const h = fixture();
  h.input.closest = () => h.input;
  const first = h.key('Escape', false, h.input);
  assert.equal(first.prevented, false);
  assert.equal(first.stopped, false);
  assert.equal(h.closed(), 0);
  h.input.closest = () => null;
  assert.equal(h.key('Escape', false, h.input).prevented, true);
  assert.equal(h.closed(), 1);
  h.cleanup();
});
