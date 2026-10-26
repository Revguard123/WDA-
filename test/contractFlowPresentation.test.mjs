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
import * as naicsReference from '../lib/playbook/naicsReference.js';
import * as presentation from '../lib/contractsPresentation.js';
import * as briefMotion from '../lib/briefMotion.js';

// Actual server-page JSX and shared components; only I/O boundaries are mocked.
const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}, globals = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'window', code)((id) => imports[id] || (id.endsWith('/buyerUrls.js') ? buyerUrls : id === '../../lib/ui.js' ? ui : require(id)), module, module.exports,
    globals.fetch || (() => { throw new Error('Unexpected provider/network call'); }), globals.window || { location: { href: '' } });
  return module.exports;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = (await load('app/_components/Button.jsx')).default;
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
const DecisionBrief = (await load('app/_components/DecisionBrief.jsx', { '../../lib/briefMotion.js': briefMotion })).default;
const BetaNotice = (await load('app/_components/BetaNotice.jsx')).default;
const Illustration = (await load('app/_components/NicheFocusIllustration.jsx')).default;
const GoButton = (await load('app/_components/GoButton.jsx', { './Button.jsx': asDefault(Button) })).default;
const RecoveryScreen = (await load('app/_components/RecoveryScreen.jsx', { './Button.jsx': asDefault(Button), './SupportCTA.jsx': asDefault(() => null) })).default;
const shell = await load('app/_components/Shell.jsx', { './RecoveryScreen.jsx': asDefault(RecoveryScreen) });
const Support = asDefault(() => React.createElement('div', { 'data-support-bar': true }, 'Send feedback'));
const navigation = await load('app/_components/WorkspaceNavigation.jsx', { './CTCIcon.jsx': asDefault(Icon) });
const workspace = await load('app/_components/SetupWorkspace.jsx', { './WorkspaceNavigation.jsx': navigation, './CTCIcon.jsx': asDefault(Icon), './BetaNotice.jsx': asDefault(BetaNotice), './SupportCTA.jsx': Support });
const token = 'local-flow-fixture';
const buyer = { id: 'local-flow-buyer', access_token: token, status: 'exploring', naics: ['236220'], keywords: ['General contracting', 'Project management'], state: 'GA', set_asides: ['sb'], size_min: 25000, size_max: 150000 };
const record = {
  why_line: 'Stored explanation: evaluate licensing and site access requirements.',
  deep_dive_text: '# Why we surfaced this one\nStored opportunity analysis.\n\n## What you need to verify\n- Confirm the site visit.\nCheck mandatory qualifications.',
  opportunity: { title: 'Building renovation', agency: 'Fixture agency', naics: '236220', set_aside_type: 'SBA', place_of_perf: 'Georgia', response_deadline: '2099-11-09T17:00:00Z', sam_url: 'https://sam.gov/opp/local-flow-fixture/view' },
};
async function startPage({ account = buyer, session = null, routeKey = token } = {}) {
  const page = await load('app/start/[token]/page.js', {
    'next/navigation': { redirect: (destination) => { throw Object.assign(new Error('Redirect'), { destination }); } },
    '../../_components/Shell.jsx': shell,
    '../../_components/SetupWorkspace.jsx': workspace,
    '../../_components/SupportCTA.jsx': Support,
    '../../_components/Button.jsx': asDefault(Button),
    '../../_components/CTCIcon.jsx': asDefault(Icon),
    '../../_components/NicheFocusIllustration.jsx': asDefault(Illustration),
    '../../_components/GoButton.jsx': asDefault(GoButton),
    '../../../lib/buyers.js': { getBuyerByToken: async () => account },
    '../../../lib/discoverySessions.js': { getDiscoverySessionForBuyer: async () => session },
    '../../../lib/setupDiscoveryState.js': discoveryState,
    '../../../lib/playbook/naicsReference.js': naicsReference,
    '../../../lib/ui.js': ui,
    '../../../lib/journey.js': journey,
  });
  return renderToStaticMarkup(await page.default({ params: { token: routeKey } }));
}
async function breakdownPage({ account = buyer, delivery = record, routeKey = token, canonicalSlug } = {}) {
  const reads = [];
  const page = await load('app/d/[token]/[notice_id]/page.js', {
    'next/navigation': { redirect: (destination) => { throw Object.assign(new Error('Redirect'), { destination }); } },
    '../../../_components/Shell.jsx': shell,
    '../../../_components/SetupWorkspace.jsx': workspace,
    '../../../_components/SupportCTA.jsx': Support,
    '../../../_components/Button.jsx': asDefault(Button),
    '../../../_components/CTCIcon.jsx': asDefault(Icon),
    '../../../_components/DecisionBrief.jsx': asDefault(DecisionBrief),
    '../../../_components/BetaNotice.jsx': asDefault(BetaNotice),
    '../../../../lib/buyers.js': { getBuyerByToken: async () => account },
    '../../../../lib/deliveries.js': { getDeliveryForBuyer: async (...args) => { reads.push(args); return delivery; } },
    '../../../../lib/contractsPresentation.js': presentation,
  });
  return { html: renderToStaticMarkup(await page.default({ params: { token: routeKey, notice_id: 'local-notice' }, canonicalSlug })), reads };
}

test('clean breakdown and start routes keep navigation token-free and preserve buyer delivery authorization', async () => {
  const account = { ...buyer, access_token: 'private-cookie-only-credential' };
  const { html, reads } = await breakdownPage({ account, routeKey: 'me', canonicalSlug: 'building-renovation--local-notice' });
  assert.deepEqual(reads, [[buyer.id, 'local-notice']]);
  assert.match(html, /href="\/contracts"/);
  assert.match(html, /href="\/setup\?review=1"/);
  assert.ok(!html.includes(account.access_token));
  await assert.rejects(breakdownPage({ routeKey: 'me', canonicalSlug: 'old-title--local-notice' }), { destination: '/d/building-renovation--local-notice' });
  const denied = await breakdownPage({ routeKey: 'me', delivery: null });
  assert.match(denied.html, /This contract is not valid/);
  assert.deepEqual(denied.reads, [[buyer.id, 'local-notice']]);
  assert.doesNotMatch(denied.html, /Building renovation|Stored opportunity analysis/);
  const start = await startPage({ account, routeKey: 'me' });
  assert.match(start, /href="\/setup"/);
  assert.ok(!start.includes(account.access_token));
  await assert.rejects(startPage({ routeKey: 'me', account: { ...buyer, status: 'completed' } }), { destination: '/contracts' });
});

test('start uses shared CTC chrome, the final progress step, all targeting fields and one explicit activation action', async () => {
  const html = await startPage();
  assert.match(html, /aria-label="CTC navigation"/);
  assert.match(html, /data-support-bar="true"/);
  assert.match(html, /aria-label="Start your contract search"/);
  assert.match(html, /class="is-current" aria-current="step"><span>03<\/span>Start contracts/);
  assert.match(html, /Ready to Start/);
  assert.match(html, /Your targeting at a glance/);
  for (const value of ['236220', 'Commercial and Institutional Building Construction', 'General contracting', 'Project management', 'GA', 'Small Business', '$25,000 to $150,000']) assert.ok(html.includes(value), value);
  assert.equal((html.match(/Start My Contracts/g) || []).length, 1);
  assert.match(html, /href="\/setup\/local-flow-fixture"/);
  assert.doesNotMatch(html, /<div class="shell-brand-header"|<input|<textarea/);
});

test('start preserves selected Discovery context, defaults and the original lifecycle gates', async () => {
  const selected = await startPage({ session: { selected_recommendation: { subindustry_name: 'General Construction', industry_name: 'Construction', naics: [{ code: '236220', title: 'Commercial and Institutional Building Construction' }] } } });
  assert.match(selected, /Selected War Dogs niche/);
  assert.match(selected, /General Construction/);
  const defaults = await startPage({ account: { ...buyer, state: null, keywords: [], set_asides: [], size_min: null, size_max: null } });
  for (const text of ['Nationwide', 'No keywords set', 'No set-asides selected', 'No contract size range set']) assert.ok(defaults.includes(text));
  await assert.rejects(startPage({ account: { ...buyer, status: 'completed' } }), { destination: `/contracts/${token}` });
  await assert.rejects(startPage({ account: { ...buyer, naics: [] } }), { destination: `/setup/${token}` });
  const retry = await startPage({ account: { ...buyer, status: 'active', batches_sent: 0 } });
  assert.match(retry, /Start My Contracts/);
  assert.match(await startPage({ account: null }), /This start link is not valid/);
});

test('full breakdown preserves stored analysis and buyer-scoped lookup with real metadata and safe source links', async () => {
  const { html, reads } = await breakdownPage();
  assert.deepEqual(reads, [[buyer.id, 'local-notice']]);
  for (const value of ['Building renovation', 'Fixture agency', 'Stored explanation', 'Stored opportunity analysis', 'Confirm the site visit', 'Check mandatory qualifications', '236220', 'SBA', 'Georgia', 'Nov 9, 2099']) assert.ok(html.includes(value), value);
  assert.match(html, /aria-label="Contract full breakdown"/);
  assert.match(html, /href="\/contracts\/local-flow-fixture"/);
  assert.match(html, /aria-label="Opportunity details"/);
  assert.doesNotMatch(html, /ctc-breakdown-sidebar|In this breakdown|ctc-breakdown-columns/);
  for (const index of [0, 1]) {
    assert.ok(html.includes(`id="brief-section-${index}"`));
  }
  const expanders = [...html.matchAll(/<details\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(expanders.length, 2);
  assert.match(expanders[0], /\bopen=/, 'Why we surfaced this one should be visible on arrival');
  assert.doesNotMatch(expanders[1], /\bopen=/);
  assert.match(html, /href="https:\/\/sam.gov\/opp\/local-flow-fixture\/view"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<div class="shell-brand-header"|aria-label="Setup progress"/);
});

test('reader separates global navigation, breadcrumb context and support from the single summary card', async () => {
  const { html } = await breakdownPage({ routeKey: 'me' });
  assert.match(html, /class="wda-setup-app is-workspace is-reader"/);
  assert.match(html, /<nav class="ctc-reader-breadcrumb" aria-label="Breadcrumb">/);
  assert.match(html, /id="reader-contracts-link" href="\/contracts">Contracts<\/a>/);
  assert.match(html, /<span aria-current="page">Full breakdown<\/span>/);
  assert.match(html, /Dismiss beta notice/);
  assert.doesNotMatch(html, /wda-setup-topline|contracts-toolbar|Back to your contracts|ctc-beta-support-bar/);
  const rail = html.match(/<aside class="wda-setup-rail"[\s\S]*?<\/aside>/)?.[0];
  for (const label of ['Discovery', 'Targeting', 'Contracts']) assert.ok(rail.includes(label));
  assert.match(rail, /<a href="\/contracts" data-sidebar-hint="Contracts" aria-current="location">/);
  assert.match(rail, /data-liquid/);
  assert.equal((html.match(/class="wda-workspace-support"/g) || []).length, 1, 'Only one support instance on desktop and mobile');
  assert.match(html, /<footer class="wda-workspace-support"[^>]*>[\s\S]*?data-support-bar="true"/);
  assert.equal((html.match(/class="ctc-opportunity-card ctc-flow-panel"/g) || []).length, 1);
  assert.match(html, /<article class="ctc-breakdown-document"/);
  assert.doesNotMatch(html, /class="ctc-breakdown-document ctc-flow-panel"/);
});

test('sticky left context owns the title, overview, metadata and source action without duplicating them in the report', async () => {
  const { html } = await breakdownPage();
  const card = html.match(/<aside class="ctc-opportunity-card ctc-flow-panel"[\s\S]*?<\/aside>/)?.[0];
  const report = html.match(/<article class="ctc-breakdown-document"[\s\S]*?<\/article>/)?.[0];
  assert.ok(card);
  assert.ok(report);
  assert.ok(html.indexOf(card) < html.indexOf(report), 'Context should come first when the mobile layout stacks');
  const sourceAction = card.match(/<a[^>]*href="https:\/\/sam.gov[^>]*>[\s\S]*?<\/a>/)[0];
  assert.match(sourceAction, /class="wda-btn-arrow is-external"/);
  for (const value of ['Building renovation', 'Stored explanation', 'Opportunity overview', '236220', 'Georgia', 'Nov 9, 2099', 'View on SAM.gov']) assert.ok(card.includes(value), value);
  assert.match(card, /class="ctc-opportunity-card-body" tabindex="0" role="region"/);
  assert.match(card, /class="ctc-opportunity-card-footer"/);
  assert.match(report, /War Dogs decision brief/);
  assert.match(report, /<details/);
  assert.doesNotMatch(report, /Stored explanation|View on SAM.gov|Building renovation/);
  const css = require('postcss').parse(readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => {
      if (rule.parent.type !== 'root') return;
      rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
    });
    return values;
  };
  assert.equal(base('.ctc-opportunity-card').position, 'sticky');
  assert.equal(base('.ctc-opportunity-card').top, '20px');
  assert.ok(base('.ctc-opportunity-card')['max-height'].includes('100dvh'));
  assert.equal(base('.ctc-opportunity-card-body')['overflow-y'], 'auto');
  assert.equal(base('.ctc-opportunity-card-footer')['flex-shrink'], '0');
  let stacks = false;
  let releasesSticky = false;
  css.walkAtRules('media', (media) => {
    if (!media.params.includes('max-width: 1000px')) return;
    media.walkRules('.ctc-breakdown-layout', (rule) => rule.walkDecls('grid-template-columns', (declaration) => { stacks = declaration.value === 'minmax(0,1fr)'; }));
    media.walkRules('.ctc-opportunity-card', (rule) => rule.walkDecls('position', (declaration) => { releasesSticky = declaration.value === 'static'; }));
  });
  assert.ok(stacks);
  assert.ok(releasesSticky);
});

test('missing/incomplete breakdowns remain truthful, and unstructured provider text stays escaped and readable', async () => {
  const missing = await breakdownPage({ delivery: { deep_dive_text: '', opportunity: {} } });
  for (const value of ['Solicitation', 'Agency not stated', 'Not supplied', 'See solicitation', 'being prepared']) assert.ok(missing.html.includes(value));
  assert.doesNotMatch(missing.html, /href="https:\/\/sam.gov|aria-label="Brief sections"|Invalid Date|undefined/);
  const unstructured = await breakdownPage({ delivery: { opportunity: {}, deep_dive_text: '<script>alert(1)</script>\nOriginal text' } });
  assert.match(unstructured.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(unstructured.html, /Original text/);
  assert.match(unstructured.html, /<details\b[^>]*\bopen=""/);
  assert.doesNotMatch(unstructured.html, /<script>|aria-label="Brief sections"/);
  const invalidBuyer = await breakdownPage({ account: null });
  assert.equal(invalidBuyer.reads.length, 0);
  assert.match(invalidBuyer.html, /This link is not valid/);
  assert.match((await breakdownPage({ delivery: null })).html, /This contract is not valid/);
});

test('long reports keep every section available without rendering the entire report expanded', async () => {
  const titles = ['Why we surfaced this one', 'Your strongest advantages', 'How the government will choose', 'What you need to verify', 'Important dates', 'Contract structure and economics', 'Delivery and compliance considerations', 'First move'];
  const text = titles.map((title, index) => `## ${title}\nOriginal detailed content ${index}.\nAdditional original paragraph ${index}.`).join('\n\n');
  const { html } = await breakdownPage({ delivery: { ...record, deep_dive_text: text } });
  const expanders = [...html.matchAll(/<details\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(expanders.length, 8);
  assert.equal(expanders.filter((tag) => /\bopen=/.test(tag)).length, 1);
  assert.match(expanders[0], /\bopen=/);
  assert.doesNotMatch(expanders[3], /\bopen=/);
  assert.doesNotMatch(expanders[7], /\bopen=/, 'First move stays collapsed on arrival');
  for (let index = 0; index < titles.length; index++) {
    assert.ok(html.includes(titles[index]));
    assert.ok(html.includes(`Original detailed content ${index}.`));
    assert.ok(html.includes(`Additional original paragraph ${index}.`));
  }
  assert.equal((html.match(/class="ctc-breakdown-document"/g) || []).length, 1);
  assert.doesNotMatch(html, /Opportunity context and navigation|plain-English bid\/no-bid/);
});

test('the last collapsed brief row has the same spacing to its divider as every other row', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8'));
  const declarations = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => rule.walkDecls((decl) => { values[decl.prop] = decl.value; }));
    return values;
  };
  assert.equal(declarations('.ctc-brief-section-heading').padding, '12px 0');
  const footer = declarations('.ctc-breakdown-footer');
  assert.equal(footer['margin-top'], '0', 'Footer margin must not add height above the final row divider');
  assert.equal(footer['padding-top'], '12px', 'Keep the disclaimer spacing below its divider');
  assert.equal(footer['border-top'], declarations('.ctc-brief-section')['border-top']);
});

test('opportunity overview is plain editorial content with natural paragraph breaks and no inferred facts', async () => {
  const first = `The agency needs ${Array(35).fill('renovation').join(' ')}.`;
  const second = `Your business offers ${Array(35).fill('capabilities').join(' ')}.`;
  const saved = first + ' ' + second;
  const { html } = await breakdownPage({ delivery: { ...record, why_line: saved } });
  const overview = html.match(/<section class="ctc-opportunity-overview"[\s\S]*?<\/section>/)?.[0];
  assert.ok(overview);
  assert.match(overview, /<h2 id="breakdown-overview-title">Opportunity overview<\/h2>/);
  const paragraphs = [...overview.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
  assert.deepEqual(paragraphs, [first, second]);
  assert.equal(paragraphs.join(' '), saved);
  assert.doesNotMatch(overview, /Why we surfaced|blockquote|ctc-breakdown-why|<strong|data-liquid/);
  const blank = await breakdownPage({ delivery: { ...record, why_line: '   ' } });
  assert.doesNotMatch(blank.html, /class="ctc-opportunity-overview"/);
  const css = require('postcss').parse(readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8'));
  css.walkRules('.ctc-opportunity-overview', (rule) => {
    rule.walkDecls((declaration) => assert.doesNotMatch(declaration.prop, /border-left|background|box-shadow/));
  });
});

async function activationHarness(fetcher) {
  const slots = [];
  let cursor = 0;
  const hooks = { ...React, useState(initial) {
    const index = cursor++;
    if (index >= slots.length) slots.push(initial);
    return [slots[index], (value) => { slots[index] = value; }];
  } };
  const location = { href: '' };
  const component = (await load('app/_components/GoButton.jsx', { './Button.jsx': asDefault(Button), react: hooks }, { fetch: fetcher, window: { location } })).default;
  const render = () => { cursor = 0; return component({ token }); };
  const activate = (tree) => React.Children.toArray(tree.props.children).find((child) => child.type === Button);
  return { render, activate, location };
}

test('activation retains POST, busy/disabled state and direct success navigation without a count flash', async () => {
  const calls = [];
  let resolve;
  const h = await activationHarness((...args) => { calls.push(args); return new Promise((done) => { resolve = done; }); });
  const pending = h.activate(h.render()).props.onClick();
  assert.deepEqual(calls, [[`/api/activate/${token}`, { method: 'POST' }]]);
  assert.equal(h.activate(h.render()).props.disabled, true);
  assert.equal(h.activate(h.render()).props.loading, true);
  resolve({ ok: true, json: async () => ({ outcome: 'success' }) });
  await pending;
  assert.equal(h.location.href, `/contracts/${token}`);
});

test('no-match and provider failure remain distinct, retryable and free of raw technical errors', async () => {
  for (const [response, title, role] of [
    [{ ok: true, json: async () => ({ outcome: 'no_matches' }) }, 'No strong matches right now', 'status'],
    [{ ok: false, json: async () => ({ error: 'PRIVATE_PROVIDER_ERROR' }) }, "We couldn&#x27;t complete the search right now", 'alert'],
  ]) {
    const h = await activationHarness(async () => response);
    await h.activate(h.render()).props.onClick();
    const html = renderToStaticMarkup(h.render());
    assert.ok(html.includes(title));
    assert.ok(html.includes(`role="${role}"`));
    assert.match(html, /Review Targeting/);
    assert.match(html, /Try Again/);
    assert.doesNotMatch(html, /PRIVATE_PROVIDER_ERROR/);
    assert.equal(h.location.href, '');
    assert.equal(h.activate(h.render()).props.disabled, false);
  }
});

test('start stacks on mobile, breakdown stays compact, headings use Zuume and archive empty states stay separated', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8'));
  let stacked = false;
  let headings = false;
  let compactWidth = false;
  css.walkRules((rule) => {
    if (rule.selector.includes(':is(h1,h2,h3)')) rule.walkDecls('font-family', (declaration) => { headings = declaration.value.includes('Zuume Rough'); });
    if (rule.selector === '.wda-setup-content.ctc-breakdown-page') rule.walkDecls('max-width', (declaration) => { compactWidth = parseFloat(declaration.value) <= 1320; });
  });
  css.walkAtRules('media', (media) => {
    if (!media.params.includes('950px')) return;
    media.walkRules((rule) => {
      if (!rule.selector.includes('.ctc-start-columns')) return;
      rule.walkDecls('grid-template-columns', (declaration) => { stacked = declaration.value === 'minmax(0,1fr)'; });
    });
  });
  assert.ok(headings);
  assert.ok(stacked);
  assert.ok(compactWidth);
  const contracts = require('postcss').parse(readFileSync(new URL('../app/contracts.css', import.meta.url), 'utf8'));
  let separated = false;
  contracts.walkRules((rule) => {
    if (!rule.selector.includes('.contracts-title-card + .contracts-empty')) return;
    rule.walkDecls('margin-top', (declaration) => { separated = parseFloat(declaration.value) >= 20; });
  });
  assert.ok(separated);
});
