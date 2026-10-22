import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as buyerUrls from '../lib/buyerUrls.js';
import { liquidHighlightPosition } from '../lib/liquid.js';
import * as dialog from '../lib/dialog.js';
import * as ambientMotion from '../lib/ambientMotion.js';

// Render the real JSX in memory: no Next server, buyer data, provider calls,
// or generated source files are needed for these presentation regressions.
const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function loadComponent(filename, imports = {}, exportName = 'default') {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  const componentRequire = (id) => id.endsWith('/buyerUrls.js') ? buyerUrls : id.endsWith('/ambientMotion.js') ? ambientMotion : id === '../../lib/ui.js' ? ui : id === '../../lib/dialog.js' ? dialog :
    id === './Modal.jsx' ? { __esModule: true, default: Modal } : imports[id] || require(id);
  new Function('require', 'module', 'exports', code)(componentRequire, module, module.exports);
  return module.exports[exportName];
}
const Button = await loadComponent('app/_components/Button.jsx');
const Modal = await loadComponent('app/_components/Modal.jsx');
const ModalPanel = await loadComponent('app/_components/Modal.jsx', {}, 'ModalPanel');
const DiscoveryForm = await loadComponent('app/_components/DiscoveryForm.jsx', {
  './Button.jsx': { __esModule: true, default: Button },
});
const AnswerStarters = await loadComponent('app/_components/DiscoveryForm.jsx', {
  './Button.jsx': { __esModule: true, default: Button },
}, 'AnswerStarters');
const RecommendationLoading = await loadComponent('app/_components/DiscoveryForm.jsx', {
  './Button.jsx': { __esModule: true, default: Button },
}, 'RecommendationLoading');
const MessageActions = await loadComponent('app/_components/DiscoveryForm.jsx', {
  './Button.jsx': { __esModule: true, default: Button },
}, 'MessageActions');
const selectTtsVoice = await loadComponent('app/_components/DiscoveryForm.jsx', {
  './Button.jsx': { __esModule: true, default: Button },
}, 'selectTtsVoice');

// These integration checks travel with the Discovery rewrite, rather than
// requiring that later page to be staged with the independent workspace shell.
test('standalone Discovery keeps the same navigation silhouettes as the shared workspace', async () => {
  const Icon = await loadComponent('app/_components/CTCIcon.jsx');
  const standalone = readFileSync(new URL('../app/_components/DiscoveryForm.jsx', import.meta.url), 'utf8');
  for (const name of ['discovery', 'target']) {
    const icon = renderToStaticMarkup(React.createElement(Icon, { name }));
    for (const path of icon.matchAll(/<path d="([^"]+)"/g)) {
      assert.ok(standalone.includes(path[1]), 'Standalone Discovery keeps the same silhouettes');
    }
  }
});

test('Discovery update mode returns selected niche to editable setup update flow', () => {
  const discoverPage = readFileSync(new URL('../app/discover/[token]/page.js', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../app/_components/DiscoveryForm.jsx', import.meta.url), 'utf8');
  assert.ok(discoverPage.includes("sp.update === '1'"));
  assert.ok(discoverPage.includes('updateMode={state.updateMode}'));
  assert.ok(form.includes("window.location.href = `${buyerPagePath('setup', token)}${updateMode ? '?update=1' : ''}`"));
  assert.ok(form.includes("`${buyerPagePath('setup', token)}${updateMode ? '?update=1' : '?targeting=1'}`"));
});

test('headings use real Zuume Rough Bold while body text uses Inter', () => {
  assert.match(ui.DISPLAY_FONT, /Zuume Rough/);
  assert.match(ui.BODY_FONT, /--font-inter/);
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.match(layout, /ZuumeRough-Bold\.otf[\s\S]*?font-weight: 700;/);
  assert.doesNotMatch(layout, /Manrope|Plus_Jakarta_Sans|font-weight: 700 900|font-weight: 400 600/);
});

test('native text selection uses a high-contrast brand highlight and honors forced colors', () => {
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  const selection = layout.match(/::selection\s*\{([^}]+)\}/)?.[1];
  assert.ok(selection);
  const background = selection.match(/background-color:\s*(#[\da-f]{6})/i)?.[1];
  const foreground = selection.match(/(?:^|\s)color:\s*(#[\da-f]{6})/i)?.[1];
  const luminance = (hex) => hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
  assert.ok(background && foreground, 'Selection colors must be opaque');
  assert.ok((luminance(background) + .05) / (luminance(foreground) + .05) >= 7, 'Selected body text remains readable');
  assert.match(layout, /forced-colors: active[\s\S]*?background-color: Highlight;[\s\S]*?color: HighlightText;/);
});

function render({ complete = false, recommendations = [], messages = [], embedded = false } = {}) {
  return renderToStaticMarkup(React.createElement(DiscoveryForm, {
    token: 'local-presentation-fixture',
    embedded,
    initialSession: {
      answers: { advisor_state: { messages, pending_question: complete ? null : {
        id: 'capability', category: 'capability', placeholder: 'What work can you deliver?',
      }, turn_count: messages.length, complete } },
      recommendations,
    },
  }));
}

test('embedded Discovery keeps chat tools, composer and saved answers but omits duplicate global navigation and nested main landmarks', () => {
  const html = render({ embedded: true, messages: [{ role: 'student', content: 'We provide IT support.' }] });
  assert.match(html, /class="wda-discovery-app is-embedded"/);
  assert.match(html, /<section class="wda-conversation" aria-label="Niche Discovery conversation"/);
  assert.match(html, /aria-label="Start new chat"/);
  assert.match(html, /aria-controls="wda-saved-answers"/);
  assert.match(html, /aria-label="Your answer"/);
  assert.match(html, /We provide IT support/);
  assert.doesNotMatch(html, /<main|<header class="wda-mobile-topbar"|<aside class="wda-rail"/);
});

test('conversation renders one compact composer with the keyboard hint outside the form', () => {
  const html = render();
  assert.equal((html.match(/<textarea\b/g) || []).length, 1);
  assert.match(html, /aria-label="Your answer"/);
  assert.match(html, /placeholder="What work can you deliver\?"/);
  const form = html.match(/<form\b[^>]*class="wda-composer"[^>]*>([\s\S]*?)<\/form>/)?.[1];
  assert.ok(form);
  assert.match(form, /aria-label="Send answer"/);
  assert.doesNotMatch(form, /Enter to send/);
  assert.match(html, /<\/form><span class="wda-composer-hint">Enter to send/);
});

test('message toolbars provide copy and read aloud, with edit grouped only beneath user bubbles', () => {
  const html = render({ messages: [
    { role: 'advisor', content: 'Tell us about your business.', question: { prompt: 'What can you deliver?' } },
    { role: 'student', content: 'We deliver managed IT support.' },
  ] });
  assert.equal((html.match(/role="group" aria-label="Message actions"/g) || []).length, 2);
  assert.equal((html.match(/aria-label="Copy message"/g) || []).length, 2);
  assert.equal((html.match(/aria-label="Read aloud is not supported by this browser"/g) || []).length, 2, 'SSR does not access browser APIs or autoplay');
  const groups = [...html.matchAll(/<div class="wda-message-actions" role="group" aria-label="Message actions">([\s\S]*?)<\/div>/g)].map((match) => match[1]);
  assert.equal((groups[0].match(/<button\b/g) || []).length, 2);
  assert.doesNotMatch(groups[0], /Edit answer/);
  assert.equal((groups[1].match(/<button\b/g) || []).length, 3);
  assert.match(groups[1], /aria-label="Edit answer"/);
  assert.doesNotMatch(html, /wda-desktop-edit-btn|wda-context-menu|wda-student-bubble-wrap/);
  const calls = [];
  const actions = { copy: (...args) => calls.push(['copy', ...args]), read: (...args) => calls.push(['read', ...args]), speechAvailable: true };
  const tree = MessageActions({ index: 3, text: 'Exact message text.', actions });
  const buttons = tree.props.children[0].props.children.filter(React.isValidElement);
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((button) => button.props.type === 'button'));
  assert.equal(buttons[0].props['aria-label'], 'Copy message');
  assert.equal(buttons[1].props['aria-label'], 'Read aloud');
  buttons.forEach((button) => button.props.onClick());
  assert.deepEqual(calls, [['copy', 3, 'Exact message text.'], ['read', 3, 'Exact message text.']]);
  const active = renderToStaticMarkup(React.createElement(MessageActions, { index: 3, text: 'Exact message text.', actions: { ...actions, copiedIndex: 3, speakingIndex: 3 } }));
  assert.match(active, /aria-label="Message copied"/);
  assert.match(active, /aria-pressed="true" aria-label="Stop reading"/);
  assert.equal(MessageActions({ index: 0, text: ' ', actions }), null);
  const editable = MessageActions({ index: 3, text: 'Original answer.', actions, onEdit: (...args) => calls.push(['edit', ...args]), editDisabled: false });
  const edit = editable.props.children[0].props.children[0];
  assert.equal(edit.props['aria-label'], 'Edit answer');
  assert.equal(edit.props.disabled, false);
  edit.props.onClick();
  assert.deepEqual(calls.at(-1), ['edit', 3, 'Original answer.']);
  const locked = MessageActions({ index: 3, text: 'Original answer.', actions, onEdit() {}, editDisabled: true });
  assert.equal(locked.props.children[0].props.children[0].props.disabled, true);
});

test('only user toolbars hide on fine-pointer hover devices and remain keyboard and touch accessible', () => {
  const css = require('postcss').parse(render().match(/<style>([\s\S]*?)<\/style>/)[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  let hidden = false;
  const reveal = new Set();
  css.walkRules((rule) => {
    if (!rule.selector.includes('.wda-message-actions')) return;
    const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop,node.value]));
    assert.notEqual(values.display, 'none', 'Keyboard users must be able to tab into the toolbar');
    assert.notEqual(values.visibility, 'hidden');
    if (values.opacity === '0') {
      assert.equal(rule.parent.params, '(hover: hover) and (pointer: fine)', 'Touch browsers keep actions visible');
      assert.equal(rule.selector, '.wda-msg.student .wda-message-actions', 'Never hide advisor actions');
      assert.equal(values['pointer-events'], 'none');
      hidden = true;
    }
    if (values.opacity === '1') {
      assert.equal(values['pointer-events'], 'auto');
      rule.selectors.forEach((selector) => reveal.add(selector));
    }
  });
  assert.ok(hidden);
  assert.ok(reveal.has('.wda-msg.student .wda-msg-inner:hover .wda-message-actions'));
  assert.ok(reveal.has('.wda-msg.student .wda-msg-inner:focus-within .wda-message-actions'));
});

test('message actions use the supplied rounded speaker, overlapping squares and edit-in-a-square icon designs', () => {
  const html = renderToStaticMarkup(React.createElement(MessageActions, {
    index: 1, text: 'Example answer.', onEdit() {},
    actions: { speechAvailable: true, copy() {}, read() {} },
  }));
  const icons = Object.fromEntries([...html.matchAll(/<button\b[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)].map((match) => [match[1], match[2]]));
  assert.deepEqual(Object.keys(icons), ['Edit answer','Copy message','Read aloud']);
  for (const icon of Object.values(icons)) {
    assert.match(icon, /viewBox="0 0 24 24"/);
    assert.match(icon, /fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/);
    assert.match(icon, /aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(icon, /<img|<image|#[\da-f]{3,8}|https?:/i);
  }
  assert.match(icons['Copy message'], /<rect x="3" y="8" width="13" height="13" rx="3.5"/);
  assert.match(icons['Copy message'], /M8 8V6.5A3.5/);
  assert.match(icons['Edit answer'], /M9 5H6a3 3/);
  assert.match(icons['Edit answer'], /m16 5 3 3/);
  assert.match(icons['Read aloud'], /M7.5 8.5H3v7h4.5/);
  assert.match(icons['Read aloud'], /a5 5 0 0 1 0 7M20 4.8a10.5/);
});

async function messageActionsHarness({ speech = true, voices = [], writeText = async () => {} } = {}) {
  const original = ['window','navigator'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const spoken = [];
  let cancels = 0;
  const voiceListeners = new Set();
  const engine = {
    speak: (utterance) => spoken.push(utterance), cancel: () => { cancels += 1; },
    getVoices: () => voices,
    addEventListener: (event, handler) => { if (event === 'voiceschanged') voiceListeners.add(handler); },
    removeEventListener: (event, handler) => { if (event === 'voiceschanged') voiceListeners.delete(handler); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: speech ? { speechSynthesis: engine, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } } } : {} });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText } } });
  const slots = [];
  const cleanups = [];
  let cursor = 0;
  let effects = [];
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (index >= slots.length) slots.push(typeof initial === 'function' ? initial() : initial);
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { return hooks.useState({ current: initial })[0]; },
    useEffect(callback) {
      const ref = hooks.useRef(false);
      if (!ref.current) { ref.current = true; effects.push(() => cleanups.push(callback())); }
    },
  };
  const useActions = await loadComponent('app/_components/DiscoveryForm.jsx', { react: hooks, './Button.jsx': { __esModule: true, default: Button } }, 'useMessageActions');
  const renderActions = () => { cursor = 0; effects = []; const result = useActions(); effects.forEach((run) => run()); return result; };
  renderActions();
  return { render: renderActions, spoken, cancels: () => cancels,
    voiceListenerCount: () => voiceListeners.size,
    setVoices(next) { voices = next; voiceListeners.forEach((handler) => handler()); },
    close() {
      cleanups.forEach((cleanup) => cleanup?.());
      for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    },
  };
}

test('message actions copy exact text, confirm success and expose clipboard failure without affecting chat', async () => {
  const copied = [];
  const h = await messageActionsHarness({ writeText: async (text) => { copied.push(text); if (text === 'Denied') throw new Error('Clipboard permission denied'); } });
  try {
    await h.render().copy(2, 'A message with\na line break.');
    assert.deepEqual(copied, ['A message with\na line break.']);
    assert.equal(h.render().copiedIndex, 2);
    assert.equal(h.render().feedback.text, 'Message copied.');
    assert.equal(h.spoken.length, 0, 'Copy never triggers audio');
    await h.render().copy(3, 'Denied');
    assert.equal(h.render().copiedIndex, null);
    assert.equal(h.render().feedback.error, true);
    assert.match(h.render().feedback.text, /copy it manually/);
  } finally { h.close(); }
});

test('read aloud is opt-in, plays one message at a time, toggles stop and cleans up on completion or reset', async () => {
  const h = await messageActionsHarness();
  try {
    assert.equal(h.render().speechAvailable, true);
    assert.equal(h.spoken.length, 0, 'Loading messages must never autoplay');
    h.render().read(0, 'First message.');
    assert.equal(h.spoken[0].text, 'First message.');
    assert.equal(h.render().speakingIndex, 0);
    h.render().read(1, 'Second message.');
    assert.equal(h.render().speakingIndex, 1);
    assert.ok(h.cancels() >= 2, 'Switching messages cancels prior playback');
    h.spoken[0].onend();
    assert.equal(h.render().speakingIndex, 1, 'A stale completion must not stop the current message');
    h.render().read(1, 'Second message.');
    assert.equal(h.spoken.length, 2, 'Clicking the active speaker stops instead of queuing again');
    assert.equal(h.render().speakingIndex, null);
    h.render().read(2, 'Third message.');
    h.spoken[2].onend();
    assert.equal(h.render().speakingIndex, null);
    h.render().read(3, 'Reset this message.');
    h.render().reset();
    assert.equal(h.render().speakingIndex, null);
    h.render().read(4, 'Unavailable voice.');
    h.spoken.at(-1).onerror({ error: 'synthesis-failed' });
    assert.equal(h.render().speakingIndex, null);
    assert.equal(h.render().feedback.error, true);
    h.render().read(5, 'Stop when leaving.');
    const before = h.cancels();
    h.close();
    assert.equal(h.cancels(), before + 1, 'Unmount cancels only playback owned by this conversation');
  } finally { h.close(); }
});

test('unsupported speech is disabled gracefully and pending clipboard work is ignored after reset', async () => {
  let resolve;
  const h = await messageActionsHarness({ speech: false, writeText: () => new Promise((done) => { resolve = done; }) });
  try {
    assert.equal(h.render().speechAvailable, false);
    h.render().read(1, 'No speech engine.');
    assert.equal(h.spoken.length, 0);
    const pending = h.render().copy(1, 'Old message.');
    h.render().reset();
    resolve();
    await pending;
    assert.equal(h.render().copiedIndex, null);
    assert.equal(h.render().feedback, null);
  } finally { h.close(); }
});

test('TTS voice selection prefers natural and enhanced English voices over legacy defaults without choosing a foreign-language voice', () => {
  const legacy = { name: 'Microsoft David', lang: 'en-US', default: true };
  const google = { name: 'Google US English', lang: 'en-US' };
  const enhanced = { name: 'Samantha', lang: 'en-US', voiceURI: 'com.apple.voice.enhanced.en-US.Samantha' };
  const natural = { name: 'Microsoft Aria Online (Natural)', lang: 'en-US' };
  const foreign = { name: 'Premium Natural', lang: 'fr-FR' };
  assert.equal(selectTtsVoice([legacy, natural, foreign, enhanced, google]), natural);
  assert.equal(selectTtsVoice([legacy, enhanced, google]), enhanced);
  assert.equal(selectTtsVoice([legacy, google]), google);
  assert.equal(selectTtsVoice([legacy]), legacy);
  assert.equal(selectTtsVoice([foreign]), null);
  assert.equal(selectTtsVoice([]), null);
  assert.equal(selectTtsVoice(null), null);
  const compact = { name: 'Samantha (Compact)', lang: 'en-US' };
  assert.equal(selectTtsVoice([compact, legacy]), legacy);
  const british = { name: 'Natural UK', lang: 'en-GB' };
  assert.equal(selectTtsVoice([legacy, british]), british, 'Quality takes priority over accent');
  const american = { name: 'Natural US', lang: 'en-US' };
  assert.equal(selectTtsVoice([british, american]), american, 'Prefer US English among equivalent-quality voices');
});

test('read aloud selects newly loaded natural voices and preserves their native pitch with a conversational rate', async () => {
  const h = await messageActionsHarness();
  try {
    assert.equal(h.voiceListenerCount(), 1);
    h.render().read(0, 'Default fallback.');
    assert.equal(h.spoken[0].voice, undefined);
    assert.equal(h.spoken[0].lang, 'en-US');
    const natural = { name: 'Natural English', lang: 'en-US' };
    h.setVoices([natural]);
    assert.equal(h.spoken.length, 1, 'Voice discovery never autoplays or restarts a message');
    h.render().read(1, 'Use the natural voice.');
    assert.equal(h.spoken[1].voice, natural);
    assert.equal(h.spoken[1].lang, 'en-US');
    assert.equal(h.spoken[1].rate, .98);
    assert.equal(h.spoken[1].pitch, 1);
    h.close();
    assert.equal(h.voiceListenerCount(), 0);
  } finally { h.close(); }
});

test('message toolbars stay borderless with themed icons, touch targets and keyboard focus in both modes', () => {
  const css = require('postcss').parse(render().match(/<style>([\s\S]*?)<\/style>/)[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const values = (selector) => {
    let result = {};
    css.walkRules((rule) => {
      if (!rule.selectors.includes(selector) || rule.parent.type !== 'root') return;
      result = { ...result, ...Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop,node.value])) };
    });
    return result;
  };
  assert.equal(values('.wda-message-action').width, '44px');
  assert.equal(values('.wda-message-action').height, '44px');
  assert.equal(values('.wda-message-action').border, '0');
  assert.equal(values('.wda-message-action').background, 'transparent');
  assert.match(values('.wda-message-action').color, /var\(--theme-muted/);
  assert.match(values('.wda-message-action:focus-visible').outline, /2px solid var\(--theme-pink/);
  assert.equal(values('.wda-msg.student .wda-message-actions')['justify-content'], 'flex-end');
});

test('saved answers are hidden by default with an accessible toggle and close action', () => {
  const html = render();
  assert.match(html, /aria-expanded="false" aria-controls="wda-saved-answers"/);
  assert.match(html, /<aside[^>]*id="wda-saved-answers"[^>]*hidden=""/);
  assert.match(html, /aria-label="Close saved answers"/);
  assert.match(html, /aria-label="Start new chat"/);
  assert.match(html, /aria-label="New Chat"/);
});

test('all saved answers remain available, not just the last six', () => {
  const messages = Array.from({ length: 9 }, (_, index) => ({ role: 'student', content: `Saved capability ${index + 1}` }));
  const html = render({ messages });
  const aside = html.match(/<aside[^>]*id="wda-saved-answers"[^>]*>([\s\S]*?)<\/aside>/)?.[1];
  assert.ok(aside);
  for (let index = 1; index <= 9; index += 1) assert.ok(aside.includes(`Saved capability ${index}`));
  assert.equal((aside.match(/title="Edit this answer"/g) || []).length, 9);
  for (const row of aside.matchAll(/<button\b[^>]*class="wda-answer-row"[^>]*>/g)) {
    assert.doesNotMatch(row[0], /data-liquid|wda-btn/);
  }
});

test('completed recommendations replace the disabled composer with an edit-answers action', () => {
  const recommendations = Array.from({ length: 3 }, (_, index) => ({
    subindustry_id: `canonical-lane-${index}`, subindustry_name: `Lane ${index + 1}`,
    industry_name: 'Services', explanation: 'Grounded in your saved answers.',
    naics: [{ code: '561720', title: 'Janitorial Services' }],
  }));
  const html = render({ complete: true, recommendations });
  assert.doesNotMatch(html, /<textarea\b/);
  assert.match(html, /class="wda-complete-note"/);
  assert.match(html, /Edit your answers/);
  assert.match(html, /<\/button> to refine your recommendations, or <button type="button">start a new chat<\/button>\./);
  assert.doesNotMatch(html, /wda-complete-separator/);
  assert.equal((html.match(/Use this niche/g) || []).length, 3);
  assert.match(html, /Your recommended niches/);
});

test('existing targeting and contracts navigation keep their token-scoped destinations', () => {
  const html = render();
  assert.match(html, /href="\/setup\/local-presentation-fixture\?targeting=1"/);
  assert.match(html, /href="\/contracts\/local-presentation-fixture"/);
});

const starterOptions = [
  { value: 'self', label: 'Our own team handles it' },
  { value: 'partners', label: 'We subcontract or partner for specific needs' },
  { value: 'hybrid', label: 'We do both—core work in-house, specialists as needed' },
];

test('answer starters preserve supplied labels without generic question-mark icons or all-caps instructions', () => {
  const html = renderToStaticMarkup(React.createElement(AnswerStarters, { options: starterOptions, onDraft() {} }));
  assert.match(html, /aria-label="Answer starters"/);
  for (const option of starterOptions) assert.ok(html.includes(option.label));
  assert.equal((html.match(/class="wda-starter-number"/g) || []).length, 3);
  assert.doesNotMatch(html, /discovery-chip-icon|NEED AN EXAMPLE|Need an example/);
  assert.match(html, /Review and edit before you send/);
});

test('a starter only invokes drafting with the original label, never submits the form', () => {
  const calls = [];
  const element = AnswerStarters({ options: starterOptions, onDraft: (label) => calls.push(label) });
  const buttons = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === 'button') buttons.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(element);
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every((button) => button.props.type === 'button'));
  buttons[1].props.onClick();
  assert.deepEqual(calls, [starterOptions[1].label]);
});

test('drafting highlights the chosen starter and disables every starter to prevent duplicate requests', () => {
  const html = renderToStaticMarkup(React.createElement(AnswerStarters, {
    options: starterOptions, onDraft() {}, draftingLabel: starterOptions[1].label,
  }));
  assert.equal((html.match(/disabled=""/g) || []).length, 3);
  assert.equal((html.match(/aria-busy="true"/g) || []).length, 1);
  assert.match(html, /class="wda-suggestion is-drafting"/);
  assert.match(html, /You can edit it before sending/);
});

test('only suggestion drafting lights the whole composer, and ready/error states remove the busy glow without submitting', async () => {
  for (const status of ['drafting', 'thinking', 'idle']) {
    const View = await loadComponent('app/_components/DiscoveryForm.jsx', {
      './Button.jsx': { __esModule: true, default: Button },
      react: { ...React, useState: (initial) => React.useState(initial === 'idle' ? status : initial) },
    });
    const html = renderToStaticMarkup(React.createElement(View, { token: 'fixture', embedded: true,
      initialSession: { answers: { advisor_state: { messages: [], complete: false, pending_question: { id: 'capability', category: 'capability' } } }, recommendations: [] },
    }));
    const composer = html.match(/<form\b[^>]*class="wda-composer[^>]*>[\s\S]*?<\/form>/)?.[0];
    assert.ok(composer);
    if (status === 'drafting') {
      assert.match(composer, /class="wda-composer is-drafting"/);
      assert.match(composer, /aria-busy="true"/);
      assert.match(composer, /Preparing an answer you can edit/);
      assert.match(composer, /<textarea[^>]*disabled=""/);
      assert.match(composer, /<button[^>]*disabled=""/);
    } else assert.doesNotMatch(composer, /is-drafting/);
  }
  const css = require('postcss').parse(render().match(/<style>([\s\S]*?)<\/style>/)[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const properties = (selector) => {
    const result = {};
    css.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls((decl) => { result[decl.prop] = decl.value; }); });
    return result;
  };
  const glow = properties('.wda-discovery-app .wda-composer::before');
  assert.equal(glow.inset, '-3px');
  assert.equal(glow['pointer-events'], 'none');
  assert.equal(glow.opacity, '0');
  assert.match(glow.background, /245,46,169/);
  assert.match(glow.background, /255,159,88/);
  assert.match(glow.transition, /opacity/);
  const active = properties('.wda-discovery-app .wda-composer.is-drafting::before');
  assert.equal(active.opacity, '.65');
  assert.match(active.animation, /wdaDraftGlowFlow 2\.2s linear infinite/);
  assert.equal(glow['background-size'], '200% 100%');
  assert.equal(glow.filter, 'blur(8px)');
  const surface = properties('.wda-discovery-app .wda-composer.is-drafting::after');
  assert.equal(surface.background, 'var(--draft-surface, #FBF9F8)');
  assert.equal(surface.opacity, '1');
  assert.equal(properties('.wda-discovery-app .wda-composer.is-drafting')['border-color'], 'transparent');
  const theme = readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8');
  assert.match(theme, /\.wda-composer\.is-drafting \{ --draft-surface: var\(--theme-surface\); border-color: transparent;/);
  let reducedMotion = false;
  let forcedColors = false;
  css.walkAtRules('media', (media) => {
    if (media.params === '(prefers-reduced-motion:reduce)') media.walkDecls('animation', (decl) => { if (decl.value === 'none' && decl.important) reducedMotion = true; });
    if (media.params === '(forced-colors:active)') media.walkRules('.wda-discovery-app .wda-composer::before', (rule) => rule.walkDecls('display', (decl) => { forcedColors = decl.value === 'none'; }));
  });
  assert.ok(reducedMotion);
  assert.ok(forcedColors);
  // Existing busy-control suppression must not cancel the separate draft halo.
  const liquid = readFileSync(new URL('../app/liquid.css', import.meta.url), 'utf8');
  assert.doesNotMatch(liquid, /::before/);
});

test('chat omits advisor avatars, bylines and the current-question accent while retaining motion', () => {
  const html = render({ messages: [{ role: 'advisor', content: 'What can you deliver?' }] });
  assert.doesNotMatch(html, /wda-advisor-byline|wda-advisor-mark|wda-mascot\.png|War Dogs Advisor|is-current/);
  assert.match(html, /Niche Advisor/);
  for (const animation of ['wdaMessageEnter', 'wdaStarterEnter', 'wdaSendReady', 'wdaPanelEnter']) {
    assert.ok(html.includes(`@keyframes ${animation}`));
  }
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /animation: none!important/);
});

test('Discovery signals active thinking only during processing, drafting, editing and recommendation loading', async () => {
  for (const status of ['thinking', 'drafting', 'rewinding', 'idle']) {
    const View = await loadComponent('app/_components/DiscoveryForm.jsx', {
      './Button.jsx': { __esModule: true, default: Button },
      react: { ...React, useState: (initial) => React.useState(initial === 'idle' ? status : initial) },
    });
    const html = renderToStaticMarkup(React.createElement(View, { token: 'fixture', embedded: true }));
    const root = html.match(/<div class="wda-discovery-app is-embedded"[^>]*>/)[0];
    if (status === 'idle') assert.doesNotMatch(root, /data-thinking/);
    else assert.match(root, /data-thinking="true"/);
  }
  const LoadingView = await loadComponent('app/_components/DiscoveryForm.jsx', {
    './Button.jsx': { __esModule: true, default: Button },
    react: { ...React, useState: (initial) => React.useState(() => {
      const value = typeof initial === 'function' ? initial() : initial;
      return value === 'retry' ? 'building' : value;
    }) },
  });
  const loading = renderToStaticMarkup(React.createElement(LoadingView, { token: 'fixture', embedded: true,
    initialSession: { answers: { advisor_state: { messages: [], complete: true } } },
  }));
  assert.match(loading, /class="wda-discovery-app is-embedded" data-thinking="true"/);
  const component = readFileSync(new URL('../app/_components/DiscoveryForm.jsx', import.meta.url), 'utf8');
  assert.match(component, /const thinking = locked \|\| isAdvisorTyping \|\| recommendationStatus === 'building' \|\| isResetting/);
  assert.match(component, /closest\('\.wda-setup-main'\)\?\.querySelector\('\.wda-workspace-atmosphere'\)/);
  assert.match(component, /\[thinking, prefersReducedMotion\]/);
});

test('recommendation loading preserves three decorative cards with a calm, accessible status', () => {
  const html = renderToStaticMarkup(React.createElement(RecommendationLoading));
  assert.match(html, /aria-label="Preparing recommendations"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Preparing your shortlist/);
  assert.match(html, /class="wda-skeleton-grid" aria-hidden="true"/);
  assert.equal((html.match(/class="wda-skeleton-card"/g) || []).length, 3);
  assert.equal((html.match(/class="wda-skeleton-footer"/g) || []).length, 3);
  assert.doesNotMatch(html, /<button|<a\s|\d+%|wda-shimmer-text|data-liquid/);
  assert.match(html, /review each niche before choosing/);
});

test('recommendation cards fit their content with a consistent compact gap above the action on desktop and mobile', () => {
  const css = require('postcss').parse(render().match(/<style>([\s\S]*?)<\/style>/)[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const values = (selector) => {
    const result = {};
    css.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      rule.nodes.filter((node) => node.type === 'decl').forEach((node) => { result[node.prop] = node.value; });
    });
    return result;
  };
  const card = values('.wda-rec-card');
  assert.equal(card['min-height'], '0', 'No desktop or mobile minimum height creates dead space');
  assert.equal(card.gap, '18px');
  assert.equal(card['justify-content'], undefined);
  assert.equal(values('.wda-rec-carousel')['align-items'], 'start', 'Shorter cards must not stretch to match the tallest card');
  assert.equal(values('.wda-rec-card-bottom')['margin-top'], '0', 'No auto margin pushes the action away from the content');
  assert.equal(values('.wda-rec-card-bottom')['padding-top'], '0');
  assert.equal(values('.wda-rec-codes')['margin-bottom'], '0');
  assert.equal(values('.wda-skeleton-card')['min-height'], '310px', 'Keep mobile loading placeholders stable');
  assert.equal(values('.wda-rec-card').width, '82vw', 'Keep the mobile carousel width unchanged');
});

test('liquid highlights follow relative pointer coordinates and stay inside the surface', () => {
  const bounds = { left: 100, top: 50, width: 200, height: 100 };
  assert.deepEqual(liquidHighlightPosition(200, 100, bounds), { x: '50.0%', y: '50.0%' });
  assert.deepEqual(liquidHighlightPosition(-20, 1000, bounds), { x: '0.0%', y: '100.0%' });
  assert.equal(liquidHighlightPosition(0, 0, { ...bounds, width: 0 }), null);
  assert.equal(liquidHighlightPosition(0, 0, { ...bounds, height: 0 }), null);
});

test('liquid surfaces cover the composer, navigation and recommendation cards without adding controls', () => {
  const html = render();
  assert.match(html, /<form data-liquid="" class="wda-composer"/);
  assert.match(html, /data-liquid=""[^>]*class="wda-chat-tool"/);
  assert.match(html, /data-liquid=""[^>]*class="wda-rail-link"/);
  assert.equal((html.match(/<textarea\b/g) || []).length, 1);
  assert.match(html, /@keyframes wdaLiquidShape/);
  assert.match(html, /@keyframes wdaLiquidPanel/);
  assert.match(html, /@keyframes wdaLiquidBubble/);
  const liquidCss = readFileSync(new URL('../app/liquid.css', import.meta.url), 'utf8');
  assert.match(liquidCss, /prefers-reduced-motion: reduce/);
  assert.match(liquidCss, /display: none/);
});

test('shared buttons preserve labels, variants and busy states for both buttons and links', () => {
  for (const variant of ['solid', 'outline', 'ghost']) {
    const html = renderToStaticMarkup(React.createElement(Button, { variant, type: 'submit' }, 'Save targeting'));
    assert.match(html, new RegExp(`class="wda-btn wda-btn-${variant}`));
    assert.match(html, /type="submit"/);
    assert.match(html, /Save targeting/);
  }
  const busy = renderToStaticMarkup(React.createElement(Button, { loading: true, loadingText: 'Saving' }, 'Save'));
  assert.match(busy, /<button[^>]*disabled=""/);
  assert.match(busy, /aria-busy="true"/);
  const link = renderToStaticMarkup(React.createElement(Button, { href: '/portal', disabled: true }, 'Portal'));
  assert.match(link, /href="\/portal"/);
  assert.match(link, /aria-disabled="true"/);
  assert.match(link, /tabindex="-1"/);
});

test('disabled button links suppress navigation while enabled links keep their handler', () => {
  let handled = 0;
  let prevented = 0;
  const event = { preventDefault: () => { prevented += 1; } };
  function findLink(tree) {
    return React.Children.toArray(tree.props.children).find((child) => child.type === 'a');
  }
  findLink(Button({ href: '/portal', disabled: true, onClick: () => { handled += 1; } })).props.onClick(event);
  findLink(Button({ href: '/portal', loading: true, onClick: () => { handled += 1; } })).props.onClick(event);
  assert.equal(prevented, 2);
  assert.equal(handled, 0);
  findLink(Button({ href: '/portal', onClick: () => { handled += 1; } })).props.onClick(event);
  assert.equal(prevented, 2);
  assert.equal(handled, 1);
});

test('outbound website buttons consistently use an external-link icon rather than an internal action arrow', () => {
  for (const variant of ['solid', 'ghost', 'outline']) {
    for (const href of ['https://sam.gov/opp/fixture/view', 'http://example.test', '//example.test/library']) {
      const html = renderToStaticMarkup(React.createElement(Button, { href, variant, showArrow: false, target: '_blank', rel: 'noopener noreferrer' }, 'View Solicitation'));
      const link = html.match(/<a\b[\s\S]*?<\/a>/)[0];
      assert.match(link, /class="wda-btn-arrow is-external"/);
      assert.match(link, /d="M14 3h7v7m0-7L10 14"/);
      assert.match(link, /aria-hidden="true" focusable="false"/);
      assert.doesNotMatch(link, /d="M4\.5 12h15/);
      assert.match(link, /target="_blank" rel="noopener noreferrer"/);
      assert.equal((link.match(/<svg/g) || []).length, 1);
    }
  }
  const internal = renderToStaticMarkup(React.createElement(Button, { href: '/contracts' }, 'Contracts')).match(/<a\b[\s\S]*?<\/a>/)[0];
  assert.match(internal, /d="M4\.5 12h15/);
  assert.doesNotMatch(internal, /is-external/);
  const quiet = renderToStaticMarkup(React.createElement(Button, { href: '/setup', showArrow: false }, 'Review')).match(/<a\b[\s\S]*?<\/a>/)[0];
  assert.doesNotMatch(quiet, /<svg/);
  const busy = renderToStaticMarkup(React.createElement(Button, { href: 'https://example.test', loading: true }, 'Open')).match(/<a\b[\s\S]*?<\/a>/)[0];
  assert.match(busy, /aria-disabled="true"/);
  assert.doesNotMatch(busy, /<svg/);
});

test('shared button variants have one minimum height, explicit line height and directional motion with a reduced-motion fallback', () => {
  const style = React.Children.toArray(Button({ children: 'Continue' }).props.children).find((child) => child.type === 'style');
  const css = require('postcss').parse(style.props.children);
  let base = {}, externalMotion, reduced = false;
  css.walkRules((rule) => {
    if (rule.selector === '.wda-btn') base = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
    if (rule.selector.includes(' .wda-btn-arrow.is-external')) rule.walkDecls('transform', (decl) => { externalMotion = decl.value; });
    if (rule.parent.params === '(prefers-reduced-motion: reduce)' && rule.selector.includes('.wda-btn-arrow')) rule.walkDecls('transform', (decl) => { reduced = decl.value === 'none' && decl.important; });
  });
  assert.equal(base['min-height'], '44px');
  assert.equal(base['line-height'], '1.4');
  assert.equal(base['box-sizing'], 'border-box');
  assert.equal(externalMotion, 'translate(2px,-2px)');
  assert.equal(reduced, true);
});

test('clean popup marks sit directly above headings without an illustrated banner', () => {
  const html = renderToStaticMarkup(React.createElement(ModalPanel, {
    title: 'Start a new chat?', description: 'Your saved answers will be cleared.',
    titleId: 'popup-title', descriptionId: 'popup-description', onClose: () => {},
  }, React.createElement('div', { className: 'wda-popup-actions' },
    React.createElement(Button, {}, 'Yes, start over'),
    React.createElement(Button, { variant: 'ghost', 'data-modal-autofocus': '' }, 'Keep this chat'))));
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="popup-title" aria-describedby="popup-description"/);
  assert.match(html, /<h2[^>]*id="popup-title">Start a new chat\?/);
  assert.match(html, /id="popup-description">Your saved answers will be cleared/);
  assert.match(html, /class="wda-popup-art"[^>]*aria-hidden="true" focusable="false"/);
  assert.match(html, /aria-label="Close dialog"/);
  assert.match(html, /Keep this chat/);
  assert.match(html, /data-modal-autofocus=""/);
  assert.match(html, /<div class="wda-popup-body"><svg class="wda-popup-art"[\s\S]*?<\/svg><h2/);
  assert.match(html, /viewBox="0 0 64 64" fill="none"/);
  assert.doesNotMatch(html, /wda-popup-hero|wda-popup-art-float|wda-popup-art-shadow|<ellipse|<rect/);
});

test('form and success popup variants retain form contents and disable dismissal while busy', () => {
  const html = renderToStaticMarkup(React.createElement(ModalPanel, {
    title: 'Send beta feedback', description: 'Tell us what happened.', titleId: 't', descriptionId: 'd',
    form: true, busy: true, kind: 'feedback', onClose: () => {},
  }, React.createElement('form', {}, React.createElement('textarea', { name: 'message', defaultValue: 'My feedback' }))));
  assert.match(html, /class="wda-popup wda-popup-form"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Close dialog"/);
  assert.match(html, /<textarea name="message">My feedback<\/textarea>/);
  const success = renderToStaticMarkup(React.createElement(ModalPanel, {
    title: 'Thank you', description: 'Message received.', titleId: 't', descriptionId: 'd', kind: 'success',
  }));
  assert.match(success, /Thank you/);
  assert.notEqual(success, html);
  const css = readFileSync(new URL('../app/popups.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-height: calc\(100dvh - 28px\)/);
});

test('popup marks use both verified logo colors rather than charcoal strokes', () => {
  assert.equal(ui.UI.pink.toUpperCase(), '#F52EA9');
  assert.equal(ui.UI.orange.toUpperCase(), '#FF9F58');
  for (const kind of ['restart', 'feedback', 'success']) {
    const html = renderToStaticMarkup(React.createElement(ModalPanel, {
      title: 'Confirm', description: 'Review before continuing.', titleId: 't', descriptionId: 'd', kind,
    }));
    const artwork = html.match(/<svg class="wda-popup-art"[\s\S]*?<\/svg>/)?.[0];
    assert.ok(artwork.includes(`stroke="${ui.UI.pink}"`), `${kind}: logo pink`);
    assert.ok(artwork.includes(`stroke="${ui.UI.orange}"`), `${kind}: logo orange`);
    assert.doesNotMatch(artwork, /#262124|#19191B|#1a1a1a/);
    assert.doesNotMatch(html, /wda-popup-hero/);
  }
});
