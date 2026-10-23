import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as buyerUrls from '../lib/buyerUrls.js';
import * as presentation from '../lib/contractsPresentation.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => imports[id] || (id.endsWith('/buyerUrls.js') ? buyerUrls : id === '../../lib/ui.js' ? ui : require(id)), module, module.exports);
  return module.exports;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = (await load('app/_components/Button.jsx')).default;
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
const ArchiveIllustration = (await load('app/_components/ContractArchiveIllustration.jsx')).default;
const BetaNotice = (await load('app/_components/BetaNotice.jsx')).default;
const navigation = await load('app/_components/WorkspaceNavigation.jsx', { './CTCIcon.jsx': asDefault(Icon) });
const workspace = await load('app/_components/SetupWorkspace.jsx', { './WorkspaceNavigation.jsx': navigation, './CTCIcon.jsx': asDefault(Icon), './BetaNotice.jsx': asDefault(BetaNotice), './SupportCTA.jsx': asDefault(() => null) });
const RecoveryScreen = (await load('app/_components/RecoveryScreen.jsx', { './Button.jsx': asDefault(Button), './SupportCTA.jsx': asDefault(() => null) })).default;
const shell = await load('app/_components/Shell.jsx', { './RecoveryScreen.jsx': asDefault(RecoveryScreen) });
const token = 'local-contracts-fixture';
const buyer = { id: 'local-archive-fixture', access_token: token, email: 'archive-fixture@example.test', status: 'completed', batches_owed: 1, batches_sent: 1, naics: ['541519'] };
const contract = {
  notice_id: 'delivered-notice', title: 'Electrical maintenance', agency: 'Fixture agency', naics: '238210', set_aside_type: 'SBA', batch_month: 1,
  response_deadline: '2000-01-02T18:00:00Z', sam_url: 'https://sam.gov/opp/local-fixture/view',
  why_line: 'Recurring commercial work. Verify license and certification requirements before bidding.', deep_dive_text: '',
};
async function page({ account = buyer, deliveries = [contract], routeKey = token } = {}) {
  let deliveryReads = 0;
  const module = await load('app/contracts/[token]/page.js', {
    '../../_components/Shell.jsx': shell,
    '../../_components/SetupWorkspace.jsx': workspace,
    '../../_components/SupportCTA.jsx': asDefault(() => React.createElement('div', { 'data-support-bar': true }, 'Send feedback')),
    '../../_components/Button.jsx': asDefault(Button),
    '../../_components/CTCIcon.jsx': asDefault(Icon),
    '../../_components/ContractArchiveIllustration.jsx': asDefault(ArchiveIllustration),
    '../../../lib/buyers.js': { getBuyerByToken: async () => account },
    '../../../lib/deliveries.js': { listDeliveriesForBuyer: async () => { deliveryReads += 1; return deliveries; } },
    '../../../lib/contractsPresentation.js': presentation,
  });
  return { html: renderToStaticMarkup(await module.default({ params: { token: routeKey } })), deliveryReads };
}

test('session archive renders only clean navigation and readable breakdown slugs', async () => {
  const { html } = await page({ routeKey: 'me' });
  assert.match(html, /href="\/setup\?review=1"/);
  assert.match(html, /href="\/discover\?update=1"/);
  assert.match(html, /href="\/d\/electrical-maintenance--delivered-notice"/);
  assert.ok(!html.includes(token));
  assert.doesNotMatch(html, /href="\/(?:setup|discover|contracts)\/me/);
});

test('archive uses shared navigation with Contracts active and one products action', async () => {
  const { html } = await page();
  const rail = html.match(/<aside class="wda-setup-rail"[\s\S]*?<nav>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(rail);
  assert.match(rail, /<span[^>]*aria-current="page">[\s\S]*?<\/svg><span class="wda-nav-label">Contracts<\/span><\/span>/);
  assert.match(rail, /href="\/setup\/local-contracts-fixture\?review=1"/);
  assert.equal((html.match(/class="wda-workspace-products"/g) || []).length, 1);
  assert.match(html, /Your Contract Archive/);
  assert.match(html, /<dt>Delivered targets<\/dt><dd>1<\/dd>/);
  assert.match(html, /<dt>Status<\/dt><dd>Complete<\/dd>/);
  assert.doesNotMatch(html, /aria-label="Setup progress"/);
});

test('summary features decorative portfolio art while keeping real counts and lifecycle text accessible', async () => {
  for (const [status, label, state] of [['completed', 'Complete', 'completed'], ['active', 'Active', 'active'], ['exploring', 'Not started', 'not-started']]) {
    const { html } = await page({ account: { ...buyer, status } });
    const hero = html.match(/<section class="contracts-title-card"[\s\S]*?<\/section>/)?.[0];
    assert.ok(hero);
    assert.match(hero, /class="contracts-archive-art" aria-hidden="true"/);
    assert.match(hero, /<svg[^>]*focusable="false"/);
    assert.match(hero, /fill="#FF9F58"/);
    assert.match(hero, /fill="#C62A86"/);
    assert.match(hero, /<dt>Delivered targets<\/dt><dd>1<\/dd>/);
    assert.ok(hero.includes(`data-state="${state}"`));
    assert.ok(hero.includes(`<dt>Status</dt><dd>${label}</dd>`));
    assert.doesNotMatch(hero, /data-liquid|<button|<lottie-player|<dotlottie-player/);
  }
  const css = require('postcss').parse(readFileSync(new URL('../app/contracts.css', import.meta.url), 'utf8'));
  let responsiveSummary = false;
  let reducedMotion = false;
  css.walkAtRules('media', (media) => {
    if (media.params.includes('1000px')) media.walkRules('.contracts-title-card', (rule) => {
      rule.walkDecls('grid-template-columns', (declaration) => { if (declaration.value === 'minmax(0,1fr)') responsiveSummary = true; });
    });
    if (media.params.includes('prefers-reduced-motion: reduce')) media.walkDecls('animation', (declaration) => { if (declaration.value === 'none') reducedMotion = true; });
  });
  assert.ok(responsiveSummary);
  assert.ok(reducedMotion);
  css.walkRules((rule) => {
    if (!/^\.contracts-archive-(sheets|folder)$/.test(rule.selector)) return;
    rule.walkDecls('animation', (declaration) => assert.doesNotMatch(declaration.value, /infinite/));
  });
});

test('historical opportunities keep their delivered NAICS, analysis, warnings and destination links', async () => {
  const { html } = await page();
  assert.match(html, /NAICS 541519/); // Current profile.
  assert.match(html, /NAICS 238210/); // Historical opportunity, never relabelled to the profile.
  assert.match(html, /Your current targeting may differ/);
  assert.match(html, /Recurring commercial work/);
  assert.match(html, /Verify mandatory qualifications before bidding/);
  assert.match(html, /Matching signals/);
  assert.match(html, /Relevant experience/);
  assert.match(html, /href="\/d\/electrical-maintenance--delivered-notice"/);
  assert.match(html, /href="https:\/\/sam.gov\/opp\/local-fixture\/view"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /opens in a new tab/);
  assert.match(html, /aria-label="Full breakdown: Electrical maintenance"/);
  assert.doesNotMatch(html, /<li>Set-aside<\/li>/); // Already stated by the SBA metadata badge.
});

test('deadlines remain visible in the archive without presenting expired opportunities as open', async () => {
  const { html } = await page();
  assert.match(html, /Past recorded deadline/);
  assert.match(html, /Jan 2, 2000/);
  assert.match(html, /Check SAM.gov for the latest amendments/);
  const future = await page({ deliveries: [{ ...contract, response_deadline: '2099-01-02T18:00:00Z' }] });
  assert.match(future.html, /Response deadline/);
  assert.doesNotMatch(future.html, /Past recorded deadline/);
});

test('missing opportunity data stays honest and does not fabricate evidence, dates or external links', async () => {
  const { html } = await page({ deliveries: [{ notice_id: 'minimal-notice', batch_month: 1, response_deadline: 'invalid' }] });
  assert.match(html, /Untitled solicitation/);
  assert.match(html, /Agency not stated/);
  assert.match(html, /See solicitation/);
  assert.match(html, /Confirm the latest SAM.gov deadline and amendments/);
  assert.doesNotMatch(html, /class="contracts-evidence"|View Solicitation|Past recorded deadline|undefined|Invalid Date/);
});

test('active scheduling and newest-first delivery order remain driven by existing data', async () => {
  const { html } = await page({
    account: { ...buyer, status: 'active', batches_owed: 3, batches_sent: 1, next_batch_at: '2099-03-05T00:00:00Z' },
    deliveries: [{ ...contract, title: 'Newest delivery', notice_id: 'newer' }, { ...contract, title: 'Earlier delivery', notice_id: 'older' }],
  });
  assert.match(html, /March 5, 2099/);
  assert.match(html, /<dt>Delivered targets<\/dt><dd>2<\/dd>/);
  assert.match(html, /<dt>Status<\/dt><dd>Active<\/dd>/);
  assert.ok(html.indexOf('Newest delivery') < html.indexOf('Earlier delivery'));
});

test('empty completed, exploring and invalid-link states do not promise an unowed batch', async () => {
  const completed = await page({ deliveries: [] });
  assert.match(completed.html, /No archived opportunities available/);
  assert.doesNotMatch(completed.html, /Your next batch will appear|Your next five/);
  const exploring = await page({ account: { ...buyer, status: 'exploring' }, deliveries: [] });
  assert.match(exploring.html, /Set up your niche/);
  assert.match(exploring.html, /<dd>Not started<\/dd>/);
  const invalid = await page({ account: null });
  assert.equal(invalid.deliveryReads, 0);
  assert.match(invalid.html, /This link is not valid/);
});

test('only the buttons get liquid hover, and mobile contract actions have a single-column layout', async () => {
  const { html } = await page();
  const article = html.match(/<article[^>]*class="contracts-card"[^>]*>/)?.[0];
  assert.ok(article);
  assert.doesNotMatch(article, /data-liquid/);
  const css = require('postcss').parse(readFileSync(new URL('../app/contracts.css', import.meta.url), 'utf8'));
  let mobileActions = false;
  css.walkAtRules('media', (media) => {
    if (!media.params.includes('600px')) return;
    media.walkRules('.contracts-buttons', (rule) => {
      rule.walkDecls('grid-template-columns', () => { mobileActions = true; });
    });
  });
  assert.ok(mobileActions);
});

test('paired contract actions have identical width/height sizing and clearly distinguish internal and external destinations', async () => {
  const { html } = await page();
  const actions = html.match(/<div class="contracts-buttons">([\s\S]*?)<\/div>/)[1];
  const links = [...actions.matchAll(/<a\b[\s\S]*?<\/a>/g)].map((match) => match[0]);
  assert.equal(links.length, 2);
  assert.match(links[0], /See Full Breakdown/);
  assert.doesNotMatch(links[0], /is-external/);
  assert.match(links[1], /View Solicitation/);
  assert.match(links[1], /class="wda-btn-arrow is-external"/);
  const products = html.match(/<a[^>]*class="wda-workspace-products"[\s\S]*?<\/a>/)[0];
  assert.match(products, /d="M14 3h7v7m0-7L10 14"/);
  const css = require('postcss').parse(readFileSync(new URL('../app/contracts.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const result = {};
    css.walkRules((rule) => { if (rule.selector === selector && rule.parent.type === 'root') rule.walkDecls((decl) => { result[decl.prop] = decl.value; }); });
    return result;
  };
  assert.equal(base('.contracts-buttons').display, 'grid');
  assert.equal(base('.contracts-buttons')['grid-template-columns'], 'repeat(2,minmax(0,1fr))');
  assert.equal(base('.contracts-buttons')['grid-auto-rows'], '1fr');
  assert.equal(base('.contracts-buttons')['align-items'], 'stretch');
  assert.equal(base('.contracts-buttons .wda-btn').width, '100%');
  assert.equal(base('.contracts-buttons .wda-btn').height, '100%');
  assert.equal(base('.contracts-buttons .wda-btn')['min-height'], '44px');
  assert.equal(base('.contracts-buttons > .wda-btn:only-of-type')['grid-column'], '1 / -1');
});

test('all contract headings use real Zuume Rough Bold without changing body or control typography', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/contracts.css', import.meta.url), 'utf8'));
  const declarations = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; }));
    return values;
  };
  assert.equal(declarations('.wda-setup-content.is-contracts')['--contracts-heading-font'], "'Zuume Rough', Impact, sans-serif");
  for (const selector of ['.contracts-title', '.contracts-status h2', '.contracts-card-title', '.contracts-why h3', '.contracts-empty h2']) {
    const styles = declarations(selector);
    assert.equal(styles['font-family'], 'var(--contracts-heading-font)', selector);
    assert.equal(styles['font-weight'], '700', selector);
    assert.ok(parseFloat(styles['font-size']) >= 19 || styles['font-size'].startsWith('clamp('));
  }
  for (const selector of ['.contracts-why p', '.contracts-agency', '.contracts-buttons .wda-btn', '.contracts-metadata > span']) {
    assert.notEqual(declarations(selector)['font-family'], 'var(--contracts-heading-font)', selector);
  }
});
