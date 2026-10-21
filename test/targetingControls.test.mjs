import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleNaicsSearch, budgetStops, budgetPosition, budgetAmount, US_STATES } from '../lib/targetingControls.js';

function searchHarness(fetcher) {
  const timers = new Map();
  const states = [];
  const cache = new Map();
  let nextId = 0;
  return {
    states, cache,
    schedule(query) { return scheduleNaicsSearch(query, (state) => states.push(state), {
      fetcher, cache, setTimer(callback, delay) { assert.equal(delay, 650); timers.set(++nextId, callback); return nextId; },
      clearTimer(id) { timers.delete(id); },
    }); },
    async flush() { for (const [id, callback] of [...timers]) { timers.delete(id); await callback(); } },
  };
}
const matches = [{ code: '541519', title: 'Other Computer Related Services' }];
const response = (items = matches) => ({ ok: true, json: async () => ({ matches: items }) });

test('industry search waits for a pause, ignores short input and only sends the latest query', async () => {
  const calls = [];
  const h = searchHarness(async (...args) => { calls.push(args); return response(); });
  h.schedule(' '); h.schedule('I');
  await h.flush();
  assert.equal(calls.length, 0);
  const cancel = h.schedule('IT');
  assert.equal(h.states.at(-1).searching, true);
  assert.equal(calls.length, 0);
  cancel();
  h.schedule('IT support');
  await h.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/naics/search');
  assert.deepEqual(JSON.parse(calls[0][1].body), { query: 'IT support' });
  assert.deepEqual(h.states.at(-1), { results: matches, searching: false, error: '' });
});

test('cancelled in-flight searches cannot overwrite newer results even if the provider ignores abort', async () => {
  let resolveFirst;
  let firstSignal;
  let count = 0;
  const h = searchHarness(async (url, options) => {
    if (++count === 1) { firstSignal = options.signal; return new Promise((resolve) => { resolveFirst = resolve; }); }
    return response();
  });
  const cancel = h.schedule('cleaning');
  const oldRun = h.flush();
  cancel();
  assert.equal(firstSignal.aborted, true);
  h.schedule('IT support');
  await h.flush();
  resolveFirst(response([{ code: '561720', title: 'Old result' }]));
  await oldRun;
  assert.deepEqual(h.states.at(-1).results, matches);
  assert.equal(h.cache.has('cleaning'), false);
});

test('revisiting an equivalent query uses a bounded per-form cache instead of another provider request', async () => {
  let calls = 0;
  const h = searchHarness(async () => { calls++; return response(); });
  h.schedule('IT support'); await h.flush();
  h.schedule('  it SUPPORT  '); await h.flush();
  assert.equal(calls, 1);
  assert.deepEqual(h.states.at(-1).results, matches);
  for (let index = 0; index < 30; index++) { h.schedule(`industry ${index}`); await h.flush(); }
  assert.equal(h.cache.size, 25);
});

test('empty, malformed, network and JSON failures render safe recoverable search states', async () => {
  for (const fetcher of [async () => ({ ok: false }), async () => { throw new Error('Private provider detail'); }, async () => ({ ok: true, json: async () => { throw new Error('Unexpected JSON'); } })]) {
    const h = searchHarness(fetcher);
    h.schedule('IT'); await h.flush();
    assert.equal(h.states.at(-1).searching, false);
    assert.match(h.states.at(-1).error, /Try again or add a NAICS code/);
    assert.doesNotMatch(h.states.at(-1).error, /Private|JSON/);
  }
  const h = searchHarness(async () => response([{ code: 'fake', title: 'No' }, null, { code: 541519, title: 'Valid' }]));
  h.schedule('IT'); await h.flush();
  assert.deepEqual(h.states.at(-1).results, [{ code: '541519', title: 'Valid' }]);
  const empty = searchHarness(async () => response([]));
  empty.schedule('IT'); await empty.flush();
  assert.deepEqual(empty.states.at(-1), { results: [], searching: false, error: '' });
});

test('budget slider round-trips common amounts, leaves typed amounts uncapped and advances with one key step', () => {
  const stops = budgetStops('', '');
  for (const amount of [0, 1, 25000, 50000, 125000, 250000, 1000000, 10000000]) {
    assert.equal(budgetAmount(budgetPosition(amount, stops), stops), amount);
  }
  assert.ok(budgetAmount(1, stops) > 0, 'ArrowRight must not round back to zero');
  const expanded = budgetStops('25000000', '');
  assert.ok(expanded.at(-1) >= 25000000);
  assert.equal(budgetAmount(budgetPosition(25000000, expanded), expanded), 25000000);
  assert.equal(budgetStops('Infinity', 'bad').at(-1), 10000000);
  assert.equal(budgetPosition(-1, stops), 0);
});

test('state options have unique codes, include DC and territories and do not choose a default', () => {
  assert.equal(new Set(US_STATES.map((item) => item.code)).size, US_STATES.length);
  assert.ok(US_STATES.every((item) => /^[A-Z]{2}$/.test(item.code) && item.name));
  for (const code of ['VA', 'CA', 'DC', 'PR', 'GU']) assert.ok(US_STATES.some((item) => item.code === code));
});
