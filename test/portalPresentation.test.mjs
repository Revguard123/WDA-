import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as journey from '../lib/journey.js';
import * as accessMotion from '../lib/accessMotion.js';
import * as buyerUrls from '../lib/buyerUrls.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}, globals = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', code)((id) => imports[id] || (id.endsWith('/ui.js') ? ui : id.endsWith('/accessMotion.js') ? accessMotion : require(id)), module, module.exports, globals.window);
  return module.exports;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = (await load('app/_components/Button.jsx')).default;
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
const PortalEmailForm = (await load('app/_components/PortalEmailForm.jsx', { './Button.jsx': asDefault(Button) })).default;
const Support = asDefault(({ sidebar, pageContext }) => React.createElement('div', { 'data-sidebar-support': sidebar, 'data-context': pageContext }, 'Send feedback / Email support'));
const RecoveryScreen = (await load('app/_components/RecoveryScreen.jsx', { './Button.jsx': asDefault(Button), './SupportCTA.jsx': Support })).default;
const PortalFrame = (await load('app/_components/PortalFrame.jsx', { './CTCIcon.jsx': asDefault(Icon), './SupportCTA.jsx': Support })).default;

async function portal({ email, loggedOut, buyer = null, cookie, sessionBuyer = null, home = false, sessionFailure, trace = {} } = {}) {
  const reads = trace.email = [];
  const sessionReads = trace.session = [];
  trace.cookies = 0;
  const page = await load('app/portal/page.js', {
    'next/navigation': { redirect: (destination) => { throw Object.assign(new Error('Redirect'), { destination }); } },
    'next/headers': { cookies: async () => { trace.cookies++; return { get: () => cookie === undefined ? undefined : { value: cookie } }; } },
    '../_components/PortalEmailForm.jsx': asDefault(PortalEmailForm),
    '../_components/PortalFrame.jsx': asDefault(PortalFrame),
    '../_components/SupportCTA.jsx': Support,
    '../_components/RecoveryScreen.jsx': asDefault(RecoveryScreen),
    '../../lib/buyers.js': {
      getBuyerByEmail: async (value) => { reads.push(value); return buyer; },
      getBuyerByToken: async (key) => { sessionReads.push(key); if (sessionFailure) throw sessionFailure; return sessionBuyer; },
    },
    '../../lib/journey.js': journey,
    '../../lib/buyerUrls.js': buyerUrls,
  });
  const entry = home ? await load('app/page.js', { './portal/page.js': asDefault(page.default) }) : page;
  return { html: renderToStaticMarkup(await entry.default({ searchParams: { email, logged_out: loggedOut } })), reads, sessionReads, trace, entry };
}

test('portal translates the visual reference into one light branded access screen without borrowed marketing claims', async () => {
  const { html, reads } = await portal();
  assert.deepEqual(reads, []);
  assert.match(html, /class="wda-portal-page"/);
  assert.match(html, /src="\/brand\/wda-logo-horizontal.png"/);
  assert.match(html, /aria-labelledby="portal-title"/);
  assert.match(html, /Your contract/);
  assert.match(html, /workspace\./);
  assert.match(html, /opportunities selected for your business/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /class="wda-portal-title-accent"/);
  assert.match(html, /class="wda-portal-underline"/);
  assert.equal((html.match(/class="wda-portal-access-card"/g) || []).length, 1);
  for (const text of ['Discover your niche', 'Refine your targeting', 'Review your contracts', 'Access your portal', 'Open my portal']) assert.ok(html.includes(text));
  assert.match(html, /href="\/access">Get a link by email/);
  assert.match(html, /data-sidebar-support="true"/);
  assert.doesNotMatch(html, /shell-brand-header|wda-setup-rail|Trustpilot|Excellent|90 Days|\$300M|David Packouz|<video|<iframe/);
});

const sessionToken = '00000000-0000-4000-8000-000000000001';

test('the homepage shares the portal entry experience without obsolete development copy or new email-query access', async () => {
  const home = await portal({ home: true, email: 'ignored@example.test' });
  const entry = await portal();
  assert.equal(home.html, entry.html);
  assert.equal(home.entry.dynamic, 'force-dynamic');
  assert.equal(home.entry.runtime, 'nodejs');
  assert.match(home.entry.metadata.title, /Contract Workspace/);
  assert.deepEqual(home.reads, []);
  assert.deepEqual(home.sessionReads, []);
  assert.equal((home.html.match(/<main\b/g) || []).length, 1);
  assert.equal((home.html.match(/<h1\b/g) || []).length, 1);
  assert.match(home.html, /href="\/" aria-label="War Dogs Academy home"/);
  assert.doesNotMatch(home.html, /Slice 1|later slices|tokenized link|previous session|ignored@example\.test/);
});

test('both entry routes resume verified cookie sessions through the existing journey using clean URLs only', async () => {
  for (const home of [false,true]) {
    for (const [status, destination] of [['exploring','/setup'],['active','/contracts'],['completed','/contracts']]) {
      const trace = {};
      await assert.rejects(portal({ home, cookie: sessionToken, sessionBuyer: { status, access_token: sessionToken }, trace }), { destination });
      assert.deepEqual(trace.session, ['me']);
      assert.deepEqual(trace.email, []);
    }
  }
});

test('missing, malformed and revoked sessions recover to the entry form without exposing credentials or querying invalid keys', async () => {
  for (const home of [false,true]) {
    const fresh = await portal({ home });
    assert.doesNotMatch(fresh.html, /wda-portal-session-note/);
    assert.deepEqual(fresh.sessionReads, []);
    for (const cookie of ['not-an-account-key', sessionToken]) {
      const expired = await portal({ home, cookie });
      assert.match(expired.html, /class="wda-portal-session-note" role="status"/);
      assert.match(expired.html, /Your previous session is no longer available/);
      assert.match(expired.html, /<form[^>]*action="\/portal"/);
      assert.deepEqual(expired.reads, []);
      assert.deepEqual(expired.sessionReads, cookie === sessionToken ? ['me'] : []);
      assert.ok(!expired.html.includes(cookie));
    }
  }
  const backendError = new Error('Fixture backend unavailable');
  await assert.rejects(portal({ home: true, cookie: sessionToken, sessionFailure: backendError }), backendError, 'An unavailable backend must not be mislabeled as an expired session');
});

test('explicit Kajabi email entry retains priority over an existing cookie and never replaces the chosen account silently', async () => {
  const trace = {};
  await assert.rejects(portal({ email: 'selected@example.test', cookie: sessionToken,
    buyer: { status: 'exploring', access_token: 'explicit-link-fixture' },
    sessionBuyer: { status: 'completed', access_token: sessionToken }, trace,
  }), { destination: '/setup/explicit-link-fixture' });
  assert.deepEqual(trace.email, ['selected@example.test']);
  assert.deepEqual(trace.session, []);
  assert.equal(trace.cookies, 0);
});

test('the portal confirms a completed browser logout without deleting work or bypassing an existing valid session', async () => {
  const signedOut = await portal({ loggedOut: '1' });
  assert.match(signedOut.html, /role="status">You are logged out on this device/);
  assert.match(signedOut.html, /Your saved profile and contracts are still here/);
  assert.match(signedOut.html, /<form[^>]*action="\/portal"/);
  assert.deepEqual(signedOut.reads, []);
  assert.deepEqual(signedOut.sessionReads, []);
  assert.doesNotMatch((await portal({ loggedOut: '0' })).html, /You are logged out/);
  await assert.rejects(portal({ loggedOut: '1', cookie: sessionToken, sessionBuyer: { status: 'active', access_token: sessionToken } }), { destination: '/contracts' });
});

test('access form retains native GET fallback, labels, email autofill and an accessible focus destination', async () => {
  const { html } = await portal();
  assert.match(html, /href="#portal-access">Skip to portal access/);
  assert.match(html, /id="portal-access"[^>]*tabindex="-1"/);
  assert.match(html, /<form[^>]*action="\/portal"[^>]*method="GET"/);
  assert.match(html, /<label for="portal-email">Your email<\/label>/);
  assert.match(html, /type="email" id="portal-email" name="email" required=""/);
  assert.match(html, /autoComplete="email"/);
  assert.match(html, /inputMode="email"/);
  assert.match(html, /aria-describedby="portal-email-hint"/);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /type="password"|aria-invalid="true"/);
});

test('entry refresh and malformed Kajabi email do not trigger buyer lookups; enrolled buyers retain state-aware routing', async () => {
  for (const email of [undefined, '', 'invalid', '{{ current_member.email }}']) {
    const result = await portal({ email });
    assert.deepEqual(result.reads, []);
    assert.match(result.html, /wda-portal-access-card/);
  }
  for (const [status, destination] of [['exploring', '/setup/private-link-fixture'], ['active', '/contracts/private-link-fixture'], ['completed', '/contracts/private-link-fixture']]) {
    await assert.rejects(portal({ email: 'fixture@example.test', buyer: { status, access_token: 'private-link-fixture' } }), { destination });
  }
  const missing = await portal({ email: 'missing@example.test' });
  assert.deepEqual(missing.reads, ['missing@example.test']);
  assert.match(missing.html, /wda-recovery-page is-account/);
});

async function formHarness() {
  const values = [];
  let cursor = 0;
  const hooks = { ...React, useEffect() {}, useState(initial) {
    const index = cursor++;
    if (!(index in values)) values[index] = initial;
    return [values[index], (value) => { values[index] = value; }];
  } };
  const location = { href: '' };
  const session = new Map();
  let pageshow;
  const component = (await load('app/_components/PortalEmailForm.jsx', {
    react: { ...hooks, useEffect(effect) { if (!pageshow) effect(); } }, './Button.jsx': asDefault(Button),
  }, { window: { location, sessionStorage: { setItem: (key, value) => session.set(key, value) }, addEventListener(name, callback) { if (name === 'pageshow') pageshow = callback; }, removeEventListener() {} } })).default;
  return {
    location,
    session,
    render() { cursor = 0; return component(); },
    restore() { pageshow(); },
    type(value) { const form = this.render(); React.Children.toArray(form.props.children).find((node) => node.type === 'input').props.onChange({ target: { value } }); },
    submit() { this.render().props.onSubmit({ preventDefault() {} }); },
  };
}

test('portal validation is recoverable and successful submit trims/encodes email while preserving the existing access flow', async () => {
  const form = await formHarness();
  form.type('invalid'); form.submit();
  let html = renderToStaticMarkup(form.render());
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-invalid="true"/);
  assert.equal(form.location.href, '');
  assert.equal(form.session.size, 0, 'Invalid email must not request the access animation');
  form.type('  member+test@example.test  ');
  html = renderToStaticMarkup(form.render());
  assert.doesNotMatch(html, /role="alert"|aria-invalid="true"/);
  form.submit();
  assert.equal(form.location.href, '/portal?email=member%2Btest%40example.test');
  assert.equal(form.session.size, 1);
  assert.match(form.session.get(accessMotion.ACCESS_MOTION_KEY), /^\d+$/);
  html = renderToStaticMarkup(form.render());
  assert.match(html, /Opening your portal/);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  form.location.href = 'already-navigated'; form.submit();
  assert.equal(form.location.href, 'already-navigated', 'Busy form must not navigate twice');
  form.restore();
  assert.doesNotMatch(renderToStaticMarkup(form.render()), /disabled=""|Opening your portal/);
});

test('ambient glows and underline remain decorative; hover effects are scoped to the button, never the card or text links', async () => {
  const { html } = await portal();
  assert.match(html, /class="wda-portal-atmosphere" aria-hidden="true"/);
  assert.match(html, /class="wda-portal-underline"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  const card = html.match(/<section id="portal-access"[^>]*>/)?.[0];
  assert.doesNotMatch(card, /data-liquid/);
  assert.match(html, /wda-btn wda-btn-solid[^>]*wda-portal-submit/);
  assert.doesNotMatch(html, /<a[^>]*data-liquid/);
  const css = readFileSync(new URL('../app/portal.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.wda-portal-access-card:hover|\.wda-portal-page:hover/);
});

test('portal styling has light surfaces, branded gradient text, native display type and responsive/reduced-motion fallbacks', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/portal.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls((decl) => { values[decl.prop] = decl.value; }); });
    return values;
  };
  assert.equal(base('.wda-portal-page').background, '#FDFBF9');
  assert.equal(base('.wda-portal-access-card')['text-align'], 'center');
  assert.equal(base('.wda-portal-card-kicker')['justify-content'], 'center');
  assert.equal(base('.wda-portal-form')['text-align'], 'left');
  assert.equal(base('.wda-portal-form label')['text-align'], 'left');
  assert.equal(base('.wda-portal-form input')['text-align'], 'left');
  assert.equal(base('.wda-portal-footer')['justify-content'], 'space-between');
  assert.equal(base('.wda-portal-footer')['flex-direction'], 'row');
  assert.equal(base('.wda-portal-help .wda-sidebar-support-actions')['justify-content'], 'flex-end');
  assert.match(base('.wda-portal-intro h1')['font-family'], /Zuume Rough/);
  assert.equal(base('.wda-portal-access-card h2').color, '#292522');
  assert.equal(base('.wda-portal-form input')['font-size'], '16px');
  assert.equal(base('.wda-portal-form .wda-portal-submit')['min-height'], '48px');
  assert.equal(base('.wda-portal-atmosphere')['pointer-events'], 'none');
  let reducedMotion = false;
  let forcedColors = false;
  let gradient = false;
  let mobile = false;
  css.walkAtRules((rule) => {
    if (rule.params === '(prefers-reduced-motion: reduce)') rule.walkDecls('animation', (decl) => { reducedMotion = decl.value === 'none'; });
    if (rule.params === '(forced-colors: active)') rule.walkDecls('-webkit-text-fill-color', (decl) => { forcedColors = decl.value === 'CanvasText'; });
    if (rule.name === 'supports') rule.walkDecls('background', (decl) => { gradient = /linear-gradient/.test(decl.value); });
    if (rule.params === '(max-width: 600px)') mobile = true;
  });
  assert.ok(reducedMotion);
  assert.ok(forcedColors);
  assert.ok(gradient);
  assert.ok(mobile);
  assert.match(readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8'), /import '\.\/portal.css'/);
});
