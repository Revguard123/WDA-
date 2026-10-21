import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as buyerUrls from '../lib/buyerUrls.js';
import * as journey from '../lib/journey.js';
import * as discoveryState from '../lib/setupDiscoveryState.js';
import * as controls from '../lib/targetingControls.js';

// Compile real JSX in memory, with explicit boundaries for database/network work.
const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}, globals = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  const localRequire = (id) => imports[id] || (id.endsWith('/buyerUrls.js') ? buyerUrls : id === '../../lib/ui.js' ? ui : require(id));
  new Function('require', 'module', 'exports', 'fetch', 'window', 'document', code)(localRequire, module, module.exports,
    globals.fetch || (() => { throw new Error('Unexpected network call'); }), globals.window || { location: { href: '' } }, { getElementById: () => null });
  return module.exports;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = (await load('app/_components/Button.jsx')).default;
const CTCIcon = (await load('app/_components/CTCIcon.jsx')).default;
const NicheFocusIllustration = (await load('app/_components/NicheFocusIllustration.jsx')).default;
const formImports = { './Button.jsx': asDefault(Button), './CTCIcon.jsx': asDefault(CTCIcon), '../../lib/targetingControls.js': controls };
const NicheForm = (await load('app/_components/NicheForm.jsx', formImports)).default;
const BetaNotice = (await load('app/_components/BetaNotice.jsx')).default;
const navigation = await load('app/_components/WorkspaceNavigation.jsx', { './CTCIcon.jsx': asDefault(CTCIcon) });
const workspace = await load('app/_components/SetupWorkspace.jsx', { './WorkspaceNavigation.jsx': navigation, './CTCIcon.jsx': asDefault(CTCIcon), './BetaNotice.jsx': asDefault(BetaNotice), './SupportCTA.jsx': asDefault(() => null) });
const RecoveryScreen = (await load('app/_components/RecoveryScreen.jsx', { './Button.jsx': asDefault(Button), './SupportCTA.jsx': asDefault(() => null) })).default;
const shell = await load('app/_components/Shell.jsx', { './RecoveryScreen.jsx': asDefault(RecoveryScreen) });
const token = 'local-setup-fixture';
const savedBuyer = {
  id: 'local-buyer-fixture', access_token: token, status: 'exploring', name: 'Fixture Services',
  naics: ['561720'], keywords: ['office cleaning'], set_asides: ['sb'], state: 'VA', size_min: 50000, size_max: 250000,
};
async function page({ buyer = savedBuyer, session = null, searchParams = {} } = {}) {
  const module = await load('app/setup/[token]/page.js', {
    'next/navigation': { redirect: (destination) => { throw Object.assign(new Error('Redirect'), { destination }); } },
    '../../_components/Shell.jsx': shell,
    '../../_components/NicheForm.jsx': asDefault(NicheForm),
    '../../_components/SupportCTA.jsx': asDefault(() => React.createElement('div', { 'data-support-bar': true }, 'Send feedback')),
    '../../_components/SetupWorkspace.jsx': workspace,
    '../../_components/CTCIcon.jsx': asDefault(CTCIcon),
    '../../_components/NicheFocusIllustration.jsx': asDefault(NicheFocusIllustration),
    '../../../lib/buyers.js': { getBuyerByToken: async () => buyer },
    '../../../lib/discoverySessions.js': { getDiscoverySessionForBuyer: async () => session },
    '../../../lib/setupDiscoveryState.js': discoveryState,
    '../../../lib/journey.js': journey,
  });
  return renderToStaticMarkup(await module.default({ params: { token }, searchParams }));
}

test('fresh setup focuses on exactly two paths without desktop/mobile navigation or progress chrome', async () => {
  const html = await page({ buyer: { ...savedBuyer, naics: [] } });
  assert.match(html, /Start with a clear target/);
  assert.match(html, /aria-label="Choose your targeting path"/);
  assert.doesNotMatch(html, /aria-label="CTC navigation"|aria-label="Mobile navigation"|aria-label="Setup progress"|class="wda-setup-topline|class="wda-setup-rail/);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /href="\/discover\/local-setup-fixture" class="wda-setup-path"/);
  assert.match(html, /href="\/setup\/local-setup-fixture\?targeting=1" class="wda-setup-path is-direct"/);
  assert.match(html, /Two paths. One targeting profile/);
  assert.doesNotMatch(html, /class="targeting-form"|shell-brand-header">/);
  assert.match(html, /Dismiss beta notice/);
});

test('path cards have distinct decorative exploration/alignment effects and accessible link names', async () => {
  const html = await page({ buyer: { ...savedBuyer, naics: [] } });
  const cards = [...html.matchAll(/<a href="([^"]+)" class="wda-setup-path[^"]*"[\s\S]*?<\/a>/g)].map((match) => match[0]);
  assert.equal(cards.length, 2);
  assert.match(cards[0], /aria-labelledby="setup-path-discovery-title"/);
  assert.match(cards[0], /aria-describedby="setup-path-discovery-description"/);
  assert.match(cards[0], /class="wda-path-explore-trace"/);
  assert.doesNotMatch(cards[0], /wda-path-align-left/);
  assert.match(cards[1], /aria-labelledby="setup-path-direct-title"/);
  assert.match(cards[1], /aria-describedby="setup-path-direct-description"/);
  assert.match(cards[1], /class="wda-path-align-left"/);
  assert.match(cards[1], /class="wda-path-align-rows"/);
  assert.doesNotMatch(cards[1], /wda-path-explore-trace/);
  for (const card of cards) {
    assert.match(card, /class="wda-path-visual" aria-hidden="true"/);
    assert.match(card, /<svg[^>]*focusable="false"/);
    assert.doesNotMatch(card, /data-liquid|<button|<lottie-player|<animate/);
  }
  const css = require('postcss').parse(readFileSync(new URL('../app/setup.css', import.meta.url), 'utf8'));
  let keyboardEffect = false;
  let mobileStack = false;
  let reducedPseudoMotion = false;
  css.walkRules('.wda-setup-path:focus-visible', (rule) => rule.walkDecls('--path-engaged', (declaration) => { keyboardEffect = declaration.value === '1'; }));
  css.walkAtRules('media', (media) => {
    if (media.params.includes('700px')) media.walkRules('.wda-setup-paths', (rule) => rule.walkDecls('grid-template-columns', (declaration) => { mobileStack = declaration.value === 'minmax(0,1fr)'; }));
    if (media.params.includes('prefers-reduced-motion: reduce')) media.walkRules((rule) => {
      if (!rule.selector.includes('.is-path-choice *::before')) return;
      rule.walkDecls('transition', (declaration) => { reducedPseudoMotion = declaration.value === 'none'; });
    });
  });
  assert.ok(keyboardEffect);
  assert.ok(mobileStack);
  assert.ok(reducedPseudoMotion);
});

test('direct targeting renders labelled fields and separate sections without activating contracts', async () => {
  const html = await page({ buyer: { ...savedBuyer, naics: [], state: '' }, searchParams: { targeting: '1' } });
  assert.match(html, /Build Your Targeting Profile/);
  assert.equal((html.match(/class="targeting-summary-section /g) || []).length, 6);
  for (const id of ['targeting-name', 'targeting-naics-query', 'targeting-keywords', 'targeting-min', 'targeting-max']) {
    assert.ok(html.includes(`for="${id}"`));
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /aria-pressed="true"[^>]*>Nationwide/);
  assert.doesNotMatch(html, /id="targeting-state"/);
  assert.match(html, /Save Targeting/);
  assert.match(html, /Saving your profile does not generate contracts or use a batch/);
  assert.doesNotMatch(html, /Start My Contracts|\/api\/activate/);
  assert.match(html, /aria-label="CTC navigation"/);
  assert.match(html, /aria-label="Mobile navigation"/);
});

test('Discovery review shows selected niche and all editable fields immediately', async () => {
  const html = await page({ session: { selected_recommendation: {
    subindustry_name: 'Janitorial & Cleaning Services', industry_name: 'Facilities & Support Services',
    naics: [{ code: '561720', title: 'Janitorial Services' }],
  } } });
  assert.match(html, /Review Your Targeting/);
  assert.match(html, /Janitorial &amp; Cleaning Services/);
  assert.match(html, /Janitorial Services/);
  assert.match(html, /Return to Discovery/);
  for (const id of ['targeting-naics-query', 'targeting-keywords', 'targeting-state', 'targeting-min', 'targeting-max']) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /office cleaning/);
  assert.match(html, /value="50000"/);
  assert.match(html, /value="250000"/);
  assert.match(html, /Confirm Targeting/);
});

test('only a selected Discovery niche gets the branded illustration without adding controls or loading external artwork', async () => {
  const html = await page({ session: { selected_recommendation: {
    subindustry_name: 'Janitorial & Cleaning Services', industry_name: 'Facilities & Support Services',
    naics: [{ code: '561720', title: 'Janitorial Services' }],
  } } });
  assert.match(html, /class="wda-setup-selected is-featured"/);
  assert.match(html, /class="niche-focus-visual" aria-hidden="true"/);
  assert.match(html, /class="niche-focus-art"[^>]*focusable="false"/);
  assert.match(html, /stroke="#C82584"/);
  assert.match(html, /fill="#FF9F58"/);
  assert.match(html, /href="\/discover\/local-setup-fixture" class="wda-setup-back"/);
  assert.doesNotMatch(html, /<lottie-player|<dotlottie-player|https:[^"\s]+\.json/);
  const direct = await page();
  assert.doesNotMatch(direct, /class="niche-focus-art"|wda-setup-selected is-featured/);
  const css = require('postcss').parse(readFileSync(new URL('../app/setup.css', import.meta.url), 'utf8'));
  let reducedMotion = false;
  css.walkAtRules('media', (media) => {
    if (!media.params.includes('prefers-reduced-motion: reduce')) return;
    media.walkRules((rule) => {
      if (!rule.selector.includes('.wda-setup-app *')) return;
      rule.walkDecls('animation', (declaration) => { if (declaration.value === 'none') reducedMotion = true; });
    });
  });
  assert.ok(reducedMotion, 'Decorative motion must respect reduced-motion preferences');
  css.walkRules((rule) => {
    if (!/^\.niche-focus-(brief|arrow|ring)$/.test(rule.selector)) return;
    rule.walkDecls('animation', (declaration) => assert.doesNotMatch(declaration.value, /infinite/));
  });
});

test('read-only review has no editable fields or edit actions and returns to contracts', async () => {
  const html = await page({ buyer: { ...savedBuyer, status: 'active' }, searchParams: { review: '1' } });
  assert.match(html, /Review Your Targeting/);
  assert.match(html, /Back to Contracts/);
  assert.doesNotMatch(html, /aria-label="Edit |<input|<textarea|<select|aria-label="Setup progress"/);
});

test('read-only targeting exposes a future-batch editing route for active and completed buyers', async () => {
  for (const status of ['active', 'completed']) {
    const buyer = { ...savedBuyer, status };
    const review = await page({ buyer, searchParams: { review: '1' } });
    const header = review.match(/<div class="targeting-form-heading">[\s\S]*?<\/a>/)?.[0];
    assert.ok(header, 'The edit entry point must be visible at the top of the profile');
    assert.match(header, /href="\/setup\/local-setup-fixture\?update=1"/);
    assert.match(header, /Update for Future Batches/);
    assert.doesNotMatch(review, /Read only|targeting-form-heading-status/);
    assert.doesNotMatch(review, /<input|<textarea|<select/);
    assert.match(review, /without changing your existing contract archive/);
    const edit = await page({ buyer, searchParams: { update: '1' } });
    assert.match(edit, /id="targeting-keywords"/);
    assert.match(edit, /id="targeting-min"/);
    assert.match(edit, /Save for Future Batches/);
    assert.match(edit, /Changes apply after saving/);
    assert.doesNotMatch(edit, /Read only|Update for Future Batches|Start My Contracts/);
  }
});

test('pre-activation review links to normal editing rather than the future-batch workflow', async () => {
  const review = await page({ searchParams: { review: '1' } });
  assert.match(review, /href="\/setup\/local-setup-fixture\?targeting=1"/);
  assert.match(review, /Edit Targeting/);
  assert.doesNotMatch(review, /Update for Future Batches/);
  const edit = await page({ searchParams: { targeting: '1' } });
  assert.match(edit, /id="targeting-keywords"/);
  assert.match(edit, /Confirm Targeting/);
  assert.doesNotMatch(edit, /Save for Future Batches/);
});

test('future-batch updates keep archive messaging and do not imply first-time activation', async () => {
  const html = await page({ buyer: { ...savedBuyer, status: 'active' }, searchParams: { update: '1' } });
  assert.match(html, /Save for Future Batches/);
  assert.match(html, /Your existing contract archive stays unchanged/);
  assert.match(html, /href="\/discover\/local-setup-fixture\?update=1"/);
  assert.doesNotMatch(html, /aria-label="Setup progress"|Start My Contracts/);
});

test('an empty future-batch profile can choose direct targeting without returning to the chooser', async () => {
  const buyer = { ...savedBuyer, status: 'active', naics: [] };
  const choice = await page({ buyer, searchParams: { update: '1' } });
  assert.match(choice, /href="\/setup\/local-setup-fixture\?targeting=1&amp;update=1"/);
  const direct = await page({ buyer, searchParams: { update: '1', targeting: '1' } });
  assert.match(direct, /class="targeting-form"/);
  assert.match(direct, /Save for Future Batches/);
  assert.doesNotMatch(direct, /class="wda-setup-path"/);
});

test('state-aware redirects and Discovery resume survive the visual redesign', async () => {
  await assert.rejects(page({ buyer: { ...savedBuyer, status: 'active' } }), { destination: `/contracts/${token}` });
  await assert.rejects(page({ buyer: { ...savedBuyer, naics: [] }, session: { current_step: 2, status: 'in_progress' } }), { destination: `/discover/${token}` });
  const invalid = await page({ buyer: null });
  assert.match(invalid, /This setup link is not valid/);
});

// Minimal state harness: invoke real handlers without DOM, backend calls or provider work.
// Identity assertions complement the module-level component guard in continuity tests;
// actual browser focus/visual QA still requires a browser.
async function formHarness(props, globals = {}) {
  const slots = [];
  let pendingEffects = [];
  let cursor = 0;
  const hooks = { ...React, useEffect(callback, deps) {
    if (!globals.effects) return;
    const ref = hooks.useRef({ deps: undefined, cleanup: undefined }).current;
    if (!ref.deps || deps.some((value, index) => !Object.is(value, ref.deps[index]))) {
      pendingEffects.push(() => { ref.cleanup?.(); ref.cleanup = callback(); ref.deps = deps; });
    }
  }, useRef(initial) { return hooks.useState({ current: initial })[0]; }, useState(initial) {
    const index = cursor++;
    if (index >= slots.length) slots.push(typeof initial === 'function' ? initial() : initial);
    return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  } };
  const module = await load('app/_components/NicheForm.jsx', { ...formImports, react: hooks,
    '../../lib/targetingControls.js': { ...controls, scheduleNaicsSearch: globals.scheduleNaicsSearch || controls.scheduleNaicsSearch },
  }, globals);
  const render = () => { cursor = 0; pendingEffects = []; const tree = module.default(props); pendingEffects.forEach((run) => run()); return tree; };
  function* nodes(node) {
    for (const item of React.Children.toArray(node)) {
      if (!React.isValidElement(item)) continue;
      yield item;
      if (item.type === module.SummarySection || item.type === Button) yield* nodes(item.type(item.props));
      else yield* nodes(item.props.children);
    }
  }
  const find = (tree, predicate) => [...nodes(tree)].find(predicate);
  return { render, find, section: (tree, id) => find(tree, (item) => item.type === module.SummarySection && item.props.id === id) };
}

test('review editors retain component identity through consecutive text/numeric typing and deletion', async () => {
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true });
  let tree = h.render();
  const originalSectionType = h.section(tree, 'keywords').type;
  for (const section of ['industries', 'keywords', 'serviceArea', 'setAsides', 'size']) h.section(tree, section).props.onEdit(section);
  tree = h.render();
  for (const [id, values] of [
    ['targeting-naics-query', ['n', 'ne', 'net', 'network']],
    ['targeting-keywords', ['I', 'IT', 'IT support']],
    ['targeting-state', ['', 'v', 'va']],
    ['targeting-min', ['1', '12', '125', '1250', '125', '']],
    ['targeting-max', ['9', '90', '900', '9000', '900', '']],
  ]) {
    const before = h.find(tree, (item) => (item.type === 'input' || item.type === 'textarea') && item.props.id === id);
    assert.ok(before, id);
    for (const value of values) {
      h.find(tree, (item) => (item.type === 'input' || item.type === 'textarea') && item.props.id === id).props.onChange({ target: { value } });
      tree = h.render();
      const input = h.find(tree, (item) => (item.type === 'input' || item.type === 'textarea') && item.props.id === id);
      assert.equal(input.type, before.type);
      assert.equal(input.key, before.key);
      assert.equal(input.props.value, id === 'targeting-state' ? value.toUpperCase() : value);
      assert.equal(h.section(tree, 'keywords').type, originalSectionType);
    }
  }
});

test('save keeps the existing profile PUT payload and separate start destination', async () => {
  const calls = [];
  const location = { href: '' };
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true, afterSaveHref: `/start/${token}` }, {
    window: { location }, fetch: async (url, options) => { calls.push({ url, ...options }); return { ok: true }; },
  });
  await h.render().props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/api/profile/${token}`);
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].body), {
    name: savedBuyer.name, naics: '561720', keywords: 'office cleaning', set_asides: ['sb'], state: 'VA', size_min: 50000, size_max: 250000,
  });
  assert.equal(location.href, `/start/${token}`);
});

test('future-batch editing saves only the profile and returns to contracts without activation', async () => {
  const calls = [];
  const location = { href: '' };
  const h = await formHarness({ token, initial: { ...savedBuyer, status: 'active' }, reviewMode: true, updateMode: true, expandedEditors: true, afterSaveHref: `/contracts/${token}` }, {
    window: { location }, fetch: async (url, options) => { calls.push({ url, ...options }); return { ok: true }; },
  });
  const tree = h.render();
  h.find(tree, (item) => item.props.id === 'targeting-keywords').props.onChange({ target: { value: 'updated capability' } });
  await h.render().props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/api/profile/${token}`);
  assert.equal(calls[0].method, 'PUT');
  const payload = JSON.parse(calls[0].body);
  assert.equal(payload.keywords, 'updated capability');
  assert.equal(payload.size_min, savedBuyer.size_min);
  for (const key of ['status', 'batches_sent', 'batches_owed', 'deliveries']) assert.equal(Object.hasOwn(payload, key), false);
  assert.equal(location.href, `/contracts/${token}`);
});

test('read-only submit skips persistence, while empty targeting retains its validation', async () => {
  const location = { href: '' };
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true, readOnly: true, afterSaveHref: `/contracts/${token}` }, { window: { location } });
  await h.render().props.onSubmit({ preventDefault() {} });
  assert.equal(location.href, `/contracts/${token}`);
  const empty = await formHarness({ token, initial: { naics: [] } });
  await empty.render().props.onSubmit({ preventDefault() {} });
  assert.ok(empty.find(empty.render(), (item) => item.props.role === 'alert' && item.props.children.includes('Add at least one industry')));
});

test('setup reserves branded heading color for the main title and uses neutral working surfaces', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/setup.css', import.meta.url), 'utf8'));
  const property = (selector, name) => {
    let value;
    css.walkRules((rule) => {
      if (rule.selector.split(',').map((item) => item.trim()).includes(selector)) {
        rule.walkDecls(name, (declaration) => { value = declaration.value; });
      }
    });
    return value;
  };
  assert.equal(property('.wda-setup-intro h1', 'color'), 'var(--wda-brand-pink-ink)');
  for (const selector of ['.wda-setup-path h2', '.wda-setup-selected h2', '.wda-setup-guide h2', '.targeting-section-heading h2']) {
    assert.equal(property(selector, 'color'), 'var(--setup-ink)');
  }
  assert.equal(property('.wda-setup-selected', 'background'), '#fff');
  assert.equal(property('.wda-setup-guide', 'background'), undefined);
  assert.equal(property('.targeting-detail-list', 'color'), 'var(--setup-text)');
  assert.equal(property('.targeting-summary-section', 'background'), '#fff');
  assert.equal(property('.targeting-summary-section', 'border'), '1px solid var(--setup-line)');
  assert.equal(property('.wda-setup-app', '--setup-heading-font'), "'Zuume Rough', Impact, sans-serif");
  for (const selector of ['.wda-setup-name', '.wda-setup-path h2', '.wda-setup-selected h2', '.wda-setup-guide h2', '.targeting-form-heading h2', '.targeting-section-heading h2']) {
    assert.equal(property(selector, 'font-family'), 'var(--setup-heading-font)');
    assert.equal(property(selector, 'font-weight'), '700');
  }
});

test('reference layout keeps niche context beside the profile and orders geography/size before eligibility', async () => {
  const html = await page();
  assert.equal((html.match(/class="targeting-form"/g) || []).length, 1);
  assert.match(html, /Profile details/);
  assert.match(html, /class="wda-setup-sidebar"/);
  assert.match(html, /class="targeting-naics-chip"/);
  assert.match(html, /<textarea id="targeting-keywords"/);
  assert.ok(html.indexOf('targeting-title-serviceArea') < html.indexOf('targeting-title-size'));
  assert.ok(html.indexOf('targeting-title-size') < html.indexOf('targeting-title-setAsides'));
  assert.match(html, /What happens next/);
  assert.doesNotMatch(html, /targeting-summary-chips|A focused search|A stronger starting point/);
});

test('service-area selection is explicit, stays editable when cleared and never invents a state', async () => {
  const calls = [];
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true }, {
    fetch: async (url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; },
  });
  let tree = h.render();
  h.section(tree, 'serviceArea').props.onEdit('serviceArea');
  tree = h.render();
  h.find(tree, (item) => item.props.id === 'targeting-state').props.onChange({ target: { value: '' } });
  tree = h.render();
  assert.ok(h.find(tree, (item) => item.props.id === 'targeting-state'), 'Clearing must not unmount the active editor');
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0, 'An unfinished state choice must not silently save a nationwide search');
  assert.ok(h.find(h.render(), (item) => item.props.role === 'alert'));
  h.find(tree, (item) => item.type === 'button' && item.props.children === 'Nationwide').props.onClick();
  tree = h.render();
  assert.equal(h.find(tree, (item) => item.props.id === 'targeting-state'), undefined);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls[0].state, '');
  h.find(tree, (item) => item.type === 'button' && item.props.children === 'Single state').props.onClick();
  tree = h.render();
  const input = h.find(tree, (item) => item.props.id === 'targeting-state');
  assert.equal(input.props.value, '', 'Do not preselect an arbitrary state');
  assert.equal(input.props.required, true);
  input.props.onChange({ target: { value: 'ca' } });
  await h.render().props.onSubmit({ preventDefault() {} });
  assert.equal(calls[1].state, 'CA');
});

test('industry search opens automatically, supports keyboard selection and never submits on Enter', async () => {
  let update;
  const calls = [];
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true, expandedEditors: true }, {
    effects: true, scheduleNaicsSearch(query, callback) { calls.push(query); update = callback; return () => {}; },
  });
  let tree = h.render();
  const query = () => h.find(tree, (item) => item.props.id === 'targeting-naics-query');
  query().props.onChange({ target: { value: 'IT' } });
  tree = h.render();
  assert.equal(calls.at(-1), 'IT');
  assert.equal(query().props['aria-expanded'], true);
  assert.equal(h.find(tree, (item) => item.type === Button && item.props.children === 'Search'), undefined);
  update({ results: [{ code: '561720', title: 'Already selected' }, { code: '541519', title: 'IT Services' }], searching: false, error: '' });
  tree = h.render();
  assert.equal(h.find(tree, (item) => item.props.id === 'naics-option-561720').props['aria-disabled'], true);
  query().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  tree = h.render();
  assert.equal(query().props['aria-activedescendant'], 'naics-option-541519');
  let prevented = false;
  query().props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; } });
  tree = h.render();
  assert.equal(prevented, true);
  assert.ok(h.find(tree, (item) => item.props['aria-label'] === 'Remove 541519'));
  query().props.onKeyDown({ key: 'Escape', preventDefault() {} });
  tree = h.render();
  assert.equal(query().props['aria-expanded'], false);
  assert.equal(query().props.value, 'IT');
});

test('state dropdown supports arrow keys, selection and Escape without changing input identity', async () => {
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true, expandedEditors: true });
  let tree = h.render();
  const input = () => h.find(tree, (item) => item.props.id === 'targeting-state');
  const originalType = input().type;
  input().props.onChange({ target: { value: 'ca' } });
  tree = h.render();
  assert.equal(input().props['aria-expanded'], true);
  input().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  tree = h.render();
  assert.ok(input().props['aria-activedescendant']);
  input().props.onKeyDown({ key: 'Enter', preventDefault() {} });
  tree = h.render();
  assert.equal(input().props.value, 'CA');
  assert.equal(input().props['aria-expanded'], false);
  assert.equal(input().type, originalType);
  input().props.onFocus(); tree = h.render();
  input().props.onKeyDown({ key: 'Escape', preventDefault() {} }); tree = h.render();
  assert.equal(input().props['aria-expanded'], false);
  assert.equal(input().props.value, 'CA');
});

test('industry search exposes recoverable failure and empty states, and keeps the five-industry limit', async () => {
  let update;
  let attempts = 0;
  const initial = { ...savedBuyer, naics: ['561720', '541511', '541512', '541513'] };
  const h = await formHarness({ token, initial, reviewMode: true, expandedEditors: true }, {
    effects: true, scheduleNaicsSearch(query, callback) { update = callback; attempts++; return () => {}; },
  });
  let tree = h.render();
  const input = () => h.find(tree, (item) => item.props.id === 'targeting-naics-query');
  input().props.onChange({ target: { value: 'IT' } }); tree = h.render();
  update({ results: [], searching: false, error: 'Search is unavailable right now.' }); tree = h.render();
  const previous = attempts;
  h.find(tree, (item) => item.type === 'button' && item.props.children === 'Try search again').props.onClick(); tree = h.render();
  assert.equal(attempts, previous + 1);
  update({ results: [], searching: false, error: '' }); tree = h.render();
  assert.ok(h.find(tree, (item) => item.props.className === 'targeting-dropdown-empty'));
  update({ results: [{ code: '541519', title: 'IT Services' }, { code: '611420', title: 'Computer Training' }], searching: false, error: '' }); tree = h.render();
  h.find(tree, (item) => item.props.id === 'naics-option-541519').props.onClick(); tree = h.render();
  assert.equal(input().props.disabled, true);
  assert.equal(input().props['aria-expanded'], false);
  assert.equal(h.find(tree, (item) => item.props.id === 'naics-option-611420'), undefined);
  assert.ok(h.find(tree, (item) => item.props.id === 'targeting-naics-hint').props.children.includes('Remove one'));
});

test('budget sliders and exact amounts stay synchronized, retain unbounded values and validate on save', async () => {
  const calls = [];
  const h = await formHarness({ token, initial: { ...savedBuyer, size_min: '', size_max: '' }, reviewMode: true, expandedEditors: true }, {
    fetch: async (url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; },
  });
  let tree = h.render();
  const input = (id) => h.find(tree, (item) => item.props.id === id);
  const slider = (name) => h.find(tree, (item) => item.props['aria-label'] === `${name} contract value slider`);
  assert.equal(slider('Maximum').props['aria-valuetext'], 'No maximum');
  slider('Minimum').props.onChange({ target: { value: 125 } }); tree = h.render();
  assert.equal(input('targeting-min').props.value, '25000');
  assert.equal(input('targeting-max').props.value, '');
  slider('Maximum').props.onChange({ target: { value: 500 } }); tree = h.render();
  assert.equal(input('targeting-max').props.value, '250000');
  input('targeting-max').props.onChange({ target: { value: '25000000' } }); tree = h.render();
  assert.equal(input('targeting-max').props.value, '25000000', 'Do not cap or format typed values');
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls[0].size_max, '25000000');
  input('targeting-max').props.onChange({ target: { value: '1' } }); tree = h.render();
  assert.equal(calls.length, 1, 'Typing must not persist automatically');
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1, 'Reversed ranges must not be saved');
  h.find(tree, (item) => item.type === 'button' && item.props.children === 'Clear range').props.onClick(); tree = h.render();
  assert.equal(input('targeting-min').props.value, '');
  assert.equal(input('targeting-max').props.value, '');
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.at(-1).size_min, '');
  assert.equal(calls.at(-1).size_max, '');
});

test('branded checkbox decorations preserve native checked values and selected eligibility on save', async () => {
  const calls = [];
  const h = await formHarness({ token, initial: savedBuyer, reviewMode: true, expandedEditors: true }, {
    fetch: async (url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; },
  });
  let tree = h.render();
  const checkbox = h.find(tree, (item) => item.type === 'input' && item.props.type === 'checkbox' && item.props.checked);
  assert.ok(checkbox);
  checkbox.props.onChange(); tree = h.render();
  assert.equal(h.find(tree, (item) => item.type === 'input' && item.props.type === 'checkbox' && item.props.checked), undefined);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls[0].set_asides, []);
  const html = await page();
  assert.match(html, /class="targeting-checkbox-mark" aria-hidden="true"/);
  assert.match(html, /type="checkbox" checked=""/);
});
