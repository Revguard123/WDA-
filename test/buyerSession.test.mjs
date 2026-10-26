import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { NextRequest, NextResponse } from 'next/server.js';
import * as urls from '../lib/buyerUrls.js';
import * as journey from '../lib/journey.js';
import * as origins from '../lib/requestOrigin.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => imports[id] || (id.endsWith('/buyerUrls.js') ? urls : id.endsWith('/requestOrigin.js') ? origins : require(id)), module, module.exports);
  return module.exports;
}
const token = '00000000-0000-4000-8000-000000000001';
const noticeId = 'f9da97cdb8b54b24a4f6ccb443cc9c61';
const account = { id: 'fixture-buyer', access_token: token, status: 'exploring', name: 'Example', naics: ['236220'], size_min: 25000, size_max: 150000 };
const { middleware } = await load('middleware.js', { 'next/server': { NextResponse } });

test('public page URLs contain no credential and contract slugs are readable, bounded and collision-resistant', () => {
  for (const page of ['setup', 'discover', 'contracts', 'start', 'targeting']) assert.equal(urls.buyerPagePath(page), `/${page}`);
  assert.equal(urls.contractPath('Building 262 Renovation, FLETC Glynco, Georgia', noticeId), `/d/building-262-renovation-fletc-glynco-georgia--${noticeId}`);
  assert.equal(urls.contractSlug('Café & IT / Support!', noticeId), `cafe-it-support--${noticeId}`);
  assert.equal(urls.noticeIdFromSlug(urls.contractSlug('', noticeId)), noticeId);
  assert.notEqual(urls.contractSlug('Same title', 'notice-a'), urls.contractSlug('Same title', 'notice-b'));
  assert.ok(urls.contractSlug('Long '.repeat(100), noticeId).length <= 82 + noticeId.length);
  for (const bad of ['hello', '../etc', 'contract--../../bad', 'contract--%2Fbad', 'contract--%00', 'contract--%XX']) assert.equal(urls.noticeIdFromSlug(bad), null);
});

test('safe destinations reject external, protocol-relative, credential and arbitrary routes', () => {
  for (const bad of ['https://evil.test/setup', '//evil.test/contracts', '/api/activate/me', `/setup/${token}`, '/setup#bad', '/d/invalid']) assert.equal(urls.safeBuyerDestination(bad), '/contracts');
  assert.equal(urls.safeBuyerDestination('/setup?review=1&update=1&token=secret&other=bad'), '/setup?review=1&update=1');
  assert.equal(urls.safeBuyerDestination(urls.contractPath('Title', noticeId)), urls.contractPath('Title', noticeId));
});

test('cookie resolver accepts only a valid credential or the reserved session key, not arbitrary public slugs', async () => {
  let cookie = token;
  const { resolveBuyerAccessToken } = await load('lib/buyerSession.js', {
    'next/headers': { cookies: () => ({ get: (name) => name === urls.BUYER_ACCESS_COOKIE && cookie ? { value: cookie } : undefined }) },
  });
  assert.equal(await resolveBuyerAccessToken('me'), token);
  assert.equal(await resolveBuyerAccessToken(token), token);
  assert.equal(await resolveBuyerAccessToken('building-renovation'), null);
  cookie = undefined;
  assert.equal(await resolveBuyerAccessToken('me'), null);
  cookie = 'invalid';
  assert.equal(await resolveBuyerAccessToken('me'), null);
});

test('legacy email links exchange credentials and preserve targeting modes without caching or referrer leakage', () => {
  for (const path of [`/setup/${token}?targeting=1&update=1`, `/contracts/${token}`, `/discover/${token}?update=1`, `/start/${token}`, `/targeting/${token}`, `/d/${token}/${noticeId}`]) {
    const response = middleware(new NextRequest(`https://wda.test${path}`));
    assert.equal(response.status, 303);
    const next = new URL(response.headers.get('location'));
    assert.equal(next.pathname, '/auth/access');
    assert.equal(next.searchParams.get('token'), token);
    assert.ok(!next.searchParams.get('next').includes(token));
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  const mode = new URL(middleware(new NextRequest(`https://wda.test/setup/${token}?update=1`)).headers.get('location'));
  assert.equal(mode.searchParams.get('next'), '/setup?update=1');
});

test('clean URLs and both member entry routes stay private; internal session aliases cannot leak back into the address bar', () => {
  for (const path of ['/', '/portal', '/access', '/setup', '/contracts', urls.contractPath('Title', noticeId)]) {
    const response = middleware(new NextRequest(`https://wda.test${path}`));
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  const source = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
  assert.match(source, /matcher: \['\/',/);
  const response = middleware(new NextRequest('https://wda.test/setup/me?update=1'));
  assert.equal(response.headers.get('location'), 'https://wda.test/setup?update=1');
});

test('session-authorized mutations reject cross-site origins while same-origin requests and legacy bearer clients still work', () => {
  for (const path of ['/api/profile/me', '/api/activate/me', '/api/discover/me/select', '/api/discover/me/conversation']) {
    const make = (headers) => middleware(new NextRequest(`https://wda.test${path}`, { method: 'POST', headers }));
    assert.equal(make({ origin: 'https://evil.test' }).status, 403);
    assert.equal(make({ 'sec-fetch-site': 'cross-site' }).status, 403);
    assert.equal(make({ origin: 'https://wda.test' }).status, 200);
  }
  assert.equal(middleware(new NextRequest(`https://wda.test/api/profile/${token}`, { method: 'PUT' })).status, 200);
});

async function accessHandler({ buyer = account, delivery = null } = {}) {
  const reads = [];
  const route = await load('app/auth/access/route.js', {
    'next/server': { NextResponse },
    '../../../lib/buyers.js': { getBuyerByToken: async (key) => { reads.push(['buyer', key]); return buyer; } },
    '../../../lib/deliveries.js': { getDeliveryForBuyer: async (...args) => { reads.push(['delivery', ...args]); return delivery; } },
  });
  return { get: (query) => route.GET(new Request(`https://wda.test/auth/access?${new URLSearchParams(query)}`)), reads };
}

test('valid magic links set an HTTP-only SameSite cookie and redirect to clean URLs; production cookies require HTTPS', async () => {
  const handler = await accessHandler();
  const response = await handler.get({ token, next: '/setup?update=1' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://wda.test/setup?update=1');
  const cookie = response.cookies.get(urls.BUYER_ACCESS_COOKIE);
  assert.equal(cookie.value, token);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'lax');
  assert.equal(cookie.path, '/');
  assert.equal(cookie.maxAge, urls.BUYER_SESSION_SECONDS);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal((await handler.get({ token })).cookies.get(urls.BUYER_ACCESS_COOKIE).secure, true);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

test('invalid or unknown access links do not set or replace an existing session', async () => {
  const handler = await accessHandler({ buyer: null });
  for (const key of ['not-a-token', 'me', token]) {
    const response = await handler.get({ token: key, next: '/setup' });
    assert.equal(response.headers.get('location'), 'https://wda.test/access');
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.deepEqual(handler.reads, [['buyer', token]]);
});

test('logout is POST-only, clears exactly the browser access cookie and returns to a clean signed-out entry without touching buyer records', async () => {
  const route = await load('app/auth/logout/route.js', { 'next/server': { NextResponse } });
  assert.equal(route.GET, undefined);
  for (const headers of [{ origin: 'https://wda.test' }, {}]) {
    const response = await route.POST(new Request('https://wda.test/auth/logout?next=https://evil.test', { method: 'POST', headers: { ...headers, cookie: `${urls.BUYER_ACCESS_COOKIE}=${token}; unrelated=keep` } }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://wda.test/portal?logged_out=1');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const cookies = response.cookies.getAll();
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].name, urls.BUYER_ACCESS_COOKIE);
    assert.equal(cookies[0].value, '');
    assert.equal(cookies[0].path, '/');
    assert.equal(cookies[0].maxAge, 0);
    assert.equal(cookies[0].expires.getTime(), 0);
    assert.equal(cookies[0].httpOnly, true);
    assert.equal(cookies[0].sameSite, 'lax');
    assert.equal(response.headers.get('clear-site-data'), null, 'Do not clear appearance preferences or unrelated browser data');
  }
  const source = readFileSync(new URL('../app/auth/logout/route.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"].*(?:buyers|supabase|deliveries)|\.update\(|\.delete\(/);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const response = await route.POST(new Request('https://wda.test/auth/logout', { method: 'POST' }));
    assert.equal(response.cookies.get(urls.BUYER_ACCESS_COOKIE).secure, true);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

test('cross-site logout requests cannot clear or replace the current browser session', async () => {
  const route = await load('app/auth/logout/route.js', { 'next/server': { NextResponse } });
  for (const headers of [{ origin: 'https://evil.test' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }, { origin: 'https://wda.test', 'sec-fetch-site': 'cross-site' }]) {
    const response = await route.POST(new Request('https://wda.test/auth/logout', { method: 'POST', headers }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('location'), null);
  }
});

test('logout accepts the browser-facing host despite an internal localhost URL and redirects back to that same host', async () => {
  const route = await load('app/auth/logout/route.js', { 'next/server': { NextResponse } });
  for (const [host, protocol] of [['127.0.0.1:3000', 'http'], ['192.0.2.10:3000', 'http'], ['[::1]:3000', 'http'], ['wda.test', 'https']]) {
    const origin = `${protocol}://${host}`;
    const response = await route.POST(new Request('http://localhost:3000/auth/logout', {
      method: 'POST', headers: { host, origin, 'x-forwarded-proto': protocol, 'sec-fetch-site': 'same-origin' },
    }));
    assert.equal(response.status, 303, host);
    assert.equal(response.headers.get('location'), `${origin}/portal?logged_out=1`);
    assert.equal(response.cookies.get(urls.BUYER_ACCESS_COOKIE).maxAge, 0);
  }
});

test('native private logout forms can send Origin null but still require same-origin document navigation', async () => {
  const route = await load('app/auth/logout/route.js', { 'next/server': { NextResponse } });
  const headers = { host: 'localhost:3000', origin: 'null', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  const accepted = await route.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST', headers }));
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), 'http://localhost:3000/portal?logged_out=1');
  assert.equal(accepted.cookies.get(urls.BUYER_ACCESS_COOKIE).maxAge, 0);
  for (const extra of [
    { 'sec-fetch-site': '' }, { 'sec-fetch-site': 'same-site' }, { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-mode': '' }, { 'sec-fetch-mode': 'cors' },
    { 'sec-fetch-dest': '' }, { 'sec-fetch-dest': 'iframe' },
    { origin: 'https://evil.test' },
  ]) {
    const rejected = await route.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST', headers: { ...headers, ...extra } }));
    assert.equal(rejected.status, 403, JSON.stringify(extra));
    assert.equal(rejected.headers.get('set-cookie'), null);
  }
  for (const path of ['/api/profile/me', '/api/activate/me', '/api/discover/me/select']) {
    assert.equal(middleware(new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers })).status, 403);
  }
});

test('public-host validation rejects spoofed forwarded hosts, protocol/port mismatches and malformed origins', async () => {
  const route = await load('app/auth/logout/route.js', { 'next/server': { NextResponse } });
  for (const extra of [
    { origin: 'https://evil.test', 'x-forwarded-host': 'evil.test' },
    { origin: 'http://localhost:3000' },
    { origin: 'https://wda.test:8443' },
    { origin: 'http://wda.test' },
    { origin: 'https://wda.test', 'sec-fetch-site': 'cross-site' },
    { origin: 'null' }, { origin: '' }, { origin: 'https://wda.test/path' },
    { origin: 'https://wda.test@evil.test' },
    { host: 'wda.test, evil.test', origin: 'https://wda.test' },
    { 'x-forwarded-proto': 'https, http', origin: 'https://wda.test' },
  ]) {
    const response = await route.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST',
      headers: { host: 'wda.test', 'x-forwarded-proto': 'https', ...extra },
    }));
    assert.equal(response.status, 403, JSON.stringify(extra));
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('location'), null);
  }
});

test('cookie mutation middleware uses the same host-aware origin validation without changing bearer clients', () => {
  for (const path of ['/api/profile/me', '/api/activate/me', '/api/discover/me/select']) {
    const request = (origin) => new NextRequest(`http://localhost:3000${path}`, { method: 'POST',
      headers: { host: '127.0.0.1:3000', origin },
    });
    assert.equal(middleware(request('http://127.0.0.1:3000')).status, 200);
    assert.equal(middleware(request('http://localhost:3000')).status, 403);
    assert.equal(middleware(request('https://evil.test')).status, 403);
  }
  assert.equal(origins.requestOrigin(new Request('https://WDA.test:443/')), 'https://wda.test');
});

test('legacy deep dives resolve only the authenticated buyer delivery before redirecting to its canonical title slug', async () => {
  const handler = await accessHandler({ delivery: { notice_id: noticeId, opportunity: { title: 'Building renovation' } } });
  const response = await handler.get({ token, next: urls.contractPath('contract', noticeId) });
  assert.equal(response.headers.get('location'), `https://wda.test/d/building-renovation--${noticeId}`);
  assert.deepEqual(handler.reads, [['buyer', token], ['delivery', account.id, noticeId]]);
  assert.equal((await handler.get({ token, next: '//evil.test/steal' })).headers.get('location'), 'https://wda.test/contracts');
});

test('buyer/profile persistence resolves cookie authorization on the server, including activation and Discovery callers', async () => {
  let cookie = token;
  const queries = [];
  const client = { from: (table) => {
    const query = { select() { return query; }, eq(field, value) { queries.push([table, field, value]); return query; },
      update() { return query; }, maybeSingle: async () => ({ data: account, error: null }) };
    return query;
  } };
  const buyers = await load('lib/buyers.js', {
    './supabase.js': { getServiceClient: async () => client },
    './buyerTiers.js': {},
    './buyerSession.js': { resolveBuyerAccessToken: async () => cookie },
  });
  assert.equal((await buyers.getBuyerByToken('me')).id, account.id);
  assert.equal((await buyers.updateBuyerProfile('me', { naics: ['236220'] })).id, account.id);
  assert.deepEqual(queries, [['buyers', 'access_token', token], ['buyers', 'access_token', token]]);
  cookie = null;
  assert.equal(await buyers.getBuyerByToken('me'), null);
  assert.equal(await buyers.updateBuyerProfile('me', {}), null);
  assert.equal(queries.length, 2, 'Absent sessions must not read or mutate a buyer');
});

test('profile whitelist excludes account keys; state redirects use clean paths for session routes', () => {
  assert.ok(!JSON.stringify(urls.publicBuyerProfile(account)).includes(token));
  assert.equal(urls.publicBuyerProfile(account).size_min, 25000);
  const buyer = { ...account, access_token: 'me' };
  assert.deepEqual(journey.setupStateForBuyer({ ...buyer, status: 'active' }), { redirect: '/contracts' });
  assert.deepEqual(journey.startStateForBuyer({ ...buyer, naics: [] }), { redirect: '/setup' });
});
