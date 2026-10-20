import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as journey from '../lib/journey.js';
import * as buyerUrls from '../lib/buyerUrls.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => imports[id] || (id.endsWith('/ui.js') ? ui : require(id)), module, module.exports);
  return module.exports;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = (await load('app/_components/Button.jsx')).default;
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
// Feedback is an existing client boundary; test the screen's props and placement
// here without running its transport, modal effects or provider integrations.
const Support = asDefault(({ pageContext, initialEmail }) => React.createElement('nav', { 'aria-label': 'Help', 'data-context': pageContext, 'data-email': initialEmail }, 'Send feedback / Email support'));
const RecoveryScreen = (await load('app/_components/RecoveryScreen.jsx', { './Button.jsx': asDefault(Button), './SupportCTA.jsx': Support })).default;
const PortalFrame = (await load('app/_components/PortalFrame.jsx', { './CTCIcon.jsx': asDefault(Icon), './SupportCTA.jsx': Support })).default;
const shell = await load('app/_components/Shell.jsx', { './RecoveryScreen.jsx': asDefault(RecoveryScreen) });
const render = (props) => renderToStaticMarkup(React.createElement(RecoveryScreen, props));

test('invalid-link screens share compact platform chrome, branded buttons and accessible message landmarks', () => {
  for (const what of ['link', 'setup link', 'start link', 'discovery link', 'targeting link']) {
    const html = renderToStaticMarkup(React.createElement(shell.NotFound, { what }));
    assert.ok(html.includes(`This ${what} is not valid`));
    assert.match(html, /class="wda-recovery-page is-link"/);
    assert.match(html, /<header class="wda-recovery-header"/);
    assert.match(html, /aria-label="War Dogs Academy portal"/);
    assert.match(html, /<main id="recovery-message"[^>]*aria-labelledby="recovery-title"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /Skip to message/);
    assert.match(html, /href="\/access" class="wda-btn wda-btn-solid"/);
    assert.match(html, /Get a fresh access link/);
    assert.match(html, /href="\/portal" class="wda-btn wda-btn-ghost"/);
    assert.match(html, /Send feedback \/ Email support/);
    assert.doesNotMatch(html, /shell-brand-header|CTC navigation|<iframe|<lottie-player|access_token/);
  }
});

test('missing contracts offer archive/access recovery without revealing any contract or buyer data', () => {
  const html = renderToStaticMarkup(React.createElement(shell.NotFound, { what: 'contract' }));
  assert.match(html, /is-contract/);
  assert.match(html, /This contract is not valid/);
  assert.match(html, /href="\/contracts"/);
  assert.match(html, /Back to my contracts/);
  assert.match(html, /Restore access/);
  assert.match(html, /only to the account they were delivered to/);
  assert.doesNotMatch(html, /notice_id|buyer_id|access_token|SAM.gov|contract-title/);
});

test('account errors isolate the entered address and offer clearly worded retry and email actions', () => {
  const email = 'member+retry@example.test';
  const html = render({ variant: 'account', email });
  assert.match(html, /Let’s check your email/);
  assert.match(html, /<dt>Email entered<\/dt><dd>member\+retry@example.test<\/dd>/);
  assert.match(html, /Try another email/);
  assert.match(html, /Email my access link/);
  assert.match(html, /Check for a typo/);
  assert.match(html, /data-email="member\+retry@example.test"/);
  assert.doesNotMatch(html, /expired|We sent|Email sent|Signed in/);
  const escaped = render({ variant: 'account', email: '<script>alert("unsafe")</script>@example.test' });
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
});

test('custom global 404 uses the same design without confusing a missing page with a missing account', async () => {
  const page = await load('app/not-found.js', { './_components/RecoveryScreen.jsx': asDefault(RecoveryScreen) });
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.match(html, /is-page/);
  assert.match(html, /404 \/ Page not found/);
  assert.match(html, /This page isn’t here/);
  assert.match(html, /Open my portal/);
  assert.match(html, /Get my access link/);
  assert.match(html, /may have moved/);
  assert.doesNotMatch(html, /This link is not valid|Account not found|history\.back|javascript:/);
});

async function portal({ email, buyer = null } = {}) {
  const reads = [];
  const page = await load('app/portal/page.js', {
    'next/navigation': { redirect: (destination) => { throw Object.assign(new Error('Redirect'), { destination }); } },
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '../_components/Shell.jsx': shell,
    '../_components/RecoveryScreen.jsx': asDefault(RecoveryScreen),
    '../_components/PortalFrame.jsx': asDefault(PortalFrame),
    '../_components/SupportCTA.jsx': Support,
    '../_components/PortalEmailForm.jsx': asDefault(() => React.createElement('form', { action: '/portal' })),
    '../../lib/buyers.js': { getBuyerByEmail: async (value) => { reads.push(value); return buyer; } },
    '../../lib/journey.js': journey,
    '../../lib/buyerUrls.js': buyerUrls,
  });
  return { html: renderToStaticMarkup(await page.default({ searchParams: { email } })), reads };
}

test('portal renders redesigned account-not-found state only after a lookup; existing entry and routing remain unchanged', async () => {
  const missing = await portal({ email: 'missing@example.test' });
  assert.deepEqual(missing.reads, ['missing@example.test']);
  assert.match(missing.html, /wda-recovery-page is-account/);
  assert.match(missing.html, /missing@example.test/);
  assert.doesNotMatch(missing.html, /shell-brand-header/);
  const empty = await portal();
  assert.deepEqual(empty.reads, []);
  assert.match(empty.html, /Access your portal/);
  for (const [status, destination] of [['exploring', '/setup/private-link-fixture'], ['active', '/contracts/private-link-fixture'], ['completed', '/contracts/private-link-fixture']]) {
    await assert.rejects(portal({ email: 'member@example.test', buyer: { status, access_token: 'private-link-fixture' } }), { destination });
  }
});

test('recovery surfaces use neutral responsive layouts, real brand type, touch-sized actions and reduced-motion support', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/recovery.css', import.meta.url), 'utf8'));
  const values = (selector) => {
    const result = {};
    css.walkRules(selector, (rule) => {
      if (rule.parent.type === 'root') rule.walkDecls((decl) => { result[decl.prop] = decl.value; });
    });
    return result;
  };
  assert.equal(values('.wda-recovery-page').background, '#FDFBF9');
  assert.match(values('.wda-recovery-copy h1')['font-family'], /Zuume Rough/);
  assert.match(values('.wda-recovery-copy h1').color, /wda-brand-pink-ink/);
  assert.equal(values('.wda-recovery-actions .wda-btn')['min-height'], '44px');
  assert.equal(values('.wda-recovery-header')['border-bottom'], '1px solid #EAE4DD');
  let stacks = false;
  let reducedMotion = false;
  css.walkAtRules('media', (media) => {
    if (media.params === '(max-width: 760px)') media.walkRules('.wda-recovery-layout', (rule) => rule.walkDecls('grid-template-columns', (decl) => { stacks = decl.value === 'minmax(0,1fr)'; }));
    if (media.params === '(prefers-reduced-motion: reduce)') media.walkDecls('animation', (decl) => { reducedMotion = decl.value === 'none'; });
  });
  assert.ok(stacks);
  assert.ok(reducedMotion);
  assert.match(readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8'), /import '\.\/recovery.css'/);
});

test('native recovery artwork remains decorative and never adds nested navigation or card-wide liquid effects', () => {
  const html = render({ variant: 'page' });
  const visual = html.match(/<div class="wda-recovery-visual"[\s\S]*?<\/div>/)?.[0];
  assert.match(visual, /aria-hidden="true"/);
  assert.match(visual, /focusable="false"/);
  assert.match(visual, /#FF9F58/);
  assert.match(visual, /#C42A86/);
  assert.doesNotMatch(visual, /<a|<button|data-liquid|https:/);
  assert.doesNotMatch(html, /<aside|wda-setup-rail|wda-setup-topline/);
});
