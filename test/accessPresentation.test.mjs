import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const asDefault = (value) => ({ __esModule: true, default: value });
async function load(filename, imports = {}, globals = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' }, module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'fetch', code)((id) => imports[id] || (id.endsWith('/ui.js') ? ui : require(id)), module, module.exports,
    globals.window, globals.fetch || (() => { throw Error('Unexpected network access'); }));
  return module.exports;
}
const Button = (await load('app/_components/Button.jsx')).default;
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
const Support = asDefault(({ sidebar, pageContext }) => React.createElement('nav', { 'data-sidebar-support': sidebar, 'data-context': pageContext }, 'Send feedback / Email support'));
const Frame = (await load('app/_components/PortalFrame.jsx', { './CTCIcon.jsx': asDefault(Icon), './SupportCTA.jsx': Support })).default;
const AccessForm = (await load('app/_components/AccessForm.jsx', { './Button.jsx': asDefault(Button) })).default;

test('email-link recovery uses the exact shared portal frame, atmosphere, typography, theme slot and footer', async () => {
  const page = await load('app/access/page.js', { '../_components/PortalFrame.jsx': asDefault(Frame), '../_components/AccessForm.jsx': asDefault(AccessForm) });
  const html = renderToStaticMarkup(page.default());
  const portal = renderToStaticMarkup(React.createElement(Frame, null, 'Portal form'));
  for (const tag of ['header','footer']) {
    const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`);
    assert.equal(html.match(pattern)[0], portal.match(pattern)[0]);
  }
  assert.equal(html.match(/<div class="wda-portal-intro"[\s\S]*?<\/ul><\/div>/)[0], portal.match(/<div class="wda-portal-intro"[\s\S]*?<\/ul><\/div>/)[0]);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/class="wda-portal-access-card"/g) || []).length, 1);
  assert.match(html, /class="wda-portal-atmosphere" aria-hidden="true"/);
  assert.match(html, /data-theme-slot=""/);
  assert.match(html, /Email my access link/);
  assert.match(html, /Email me my link/);
  assert.match(html, /href="\/portal">Open my portal/);
  assert.match(html, /<label for="access-email">Your email<\/label>/);
  assert.match(html, /autoComplete="email"/);
  assert.match(html, /aria-describedby="access-email-hint"/);
  assert.doesNotMatch(html, /shell-brand-header|ctc-beta-support-bar|You can reach your contracts two ways|type="password"/);
  assert.doesNotMatch(html.match(/<section id="portal-access"[^>]*>/)[0], /style=/);
  assert.equal(page.runtime, 'nodejs');
  assert.equal(page.dynamic, 'force-dynamic');
});

async function formHarness({ query = '', respond } = {}) {
  const slots = [];
  const effects = [];
  let index = 0;
  const hooks = { ...React,
    useState(initial) { const current = index++; if (!(current in slots)) slots[current] = initial; return [slots[current], (value) => { slots[current] = value; }]; },
    useRef(initial) { const current = index++; return slots[current] ||= { current: initial }; },
    useEffect(effect) { const current = index++; if (!(current in slots)) { slots[current] = true; effects.push(effect); } },
  };
  const requests = [];
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const component = (await load('app/_components/AccessForm.jsx', { react: hooks, './Button.jsx': asDefault(Button) }, {
    window: { location: { search: query } },
    fetch: async (url, options) => { requests.push({ url, ...options }); return respond ? respond() : pending; },
  })).default;
  const harness = { requests, release,
    render() { index = 0; return component(); },
    html() { return renderToStaticMarkup(this.render()); },
    type(value) { React.Children.toArray(this.render().props.children).find((node) => node.type === 'input').props.onChange({ target: { value } }); },
    submit() { return this.render().props.onSubmit({ preventDefault() {} }); },
  };
  harness.render();
  effects.splice(0).forEach((effect) => effect());
  return harness;
}

test('recovery keeps valid Kajabi email prefill, validates input and posts only the trimmed email to the original endpoint', async () => {
  const form = await formHarness({ query: '?email=member%2Btest%40example.test' });
  assert.match(form.html(), /value="member\+test@example.test"/);
  form.type('invalid');
  await form.submit();
  assert.equal(form.requests.length, 0);
  assert.match(form.html(), /id="access-email-error" role="alert"/);
  assert.match(form.html(), /aria-invalid="true"/);
  form.type('  member+test@example.test  ');
  assert.doesNotMatch(form.html(), /role="alert"|aria-invalid="true"/);
  const pending = form.submit();
  const duplicate = form.submit();
  assert.equal(form.requests.length, 1);
  assert.equal(form.requests[0].url, '/api/access');
  assert.equal(form.requests[0].method, 'POST');
  assert.equal(form.requests[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(form.requests[0].body), { email: 'member+test@example.test' });
  assert.match(form.html(), /aria-busy="true"/);
  assert.match(form.html(), /Sending your link/);
  form.release({ ok: true, json: async () => ({ message: 'If that email is on file, we just sent your private link. Check your inbox.' }) });
  await Promise.all([pending,duplicate]);
  assert.match(form.html(), /class="wda-access-success" role="status" aria-live="polite"/);
  assert.match(form.html(), /If that email is on file/);
  assert.doesNotMatch(form.html(), /<form|Sending your link/);
  const invalidPrefill = await formHarness({ query: '?email={{ current_member.email }}' });
  assert.match(invalidPrefill.html(), /value=""/);
});

test('send failures stay in the shared form with a retryable error instead of claiming that an email was sent', async () => {
  for (const respond of [
    async () => ({ ok: false, json: async () => ({ error: 'Please try again.' }) }),
    async () => { throw Error('Network unavailable'); },
  ]) {
    const form = await formHarness({ respond });
    form.type('member@example.test');
    await form.submit();
    assert.match(form.html(), /role="alert"/);
    assert.match(form.html(), /Email me my link/);
    assert.doesNotMatch(form.html(), /aria-busy="true"|Check your inbox|aria-invalid="true"/);
    await form.submit();
    assert.equal(form.requests.length, 2);
  }
});
