import test from 'node:test';
import assert from 'node:assert/strict';
import { runBatchForBuyer } from '../lib/pipeline.js';
import { dueContractTopUps } from '../lib/buyerDeliveryPolicy.js';

const NOW = new Date('2026-11-16T14:00:00Z');
const SAM_ID = '23e47b6a-1c4e-4140-b49c-d91dd67f4267';
const logger = { info() {}, warn() {} };
const buyer = { id: SAM_ID, status: 'active', email: 'fixture@example.test', access_token: 'fixture', batches_sent: 1, batches_owed: 12, next_batch_at: '2026-12-12T17:59:43.922+00:00' };

function fixture({ poolSize = 20, persistedLimit = Infinity } = {}) {
  const rows = Array.from({ length: poolSize }, (_, index) => ({ notice_id: `N${index}`, solicitation_num: `SOL${index}`, title: `Fixture ${index}` }));
  const calls = { curated: [], persisted: [], incremented: 0, sent: [], keys: 0 };
  const deps = {
    getDeliveredKeys: async () => { calls.keys++; return { noticeIds: new Set(['already-delivered']), solicitations: new Set(['ALREADY-DELIVERED']) }; },
    poolForNiche: async () => ({ rows, source: 'fixture' }),
    curateForBuyer: async (pool, account, aiDeps, options) => {
      calls.curated.push(options);
      const chosen = pool.filter((row) => !options.deliveredNoticeIds.has(row.notice_id)).slice(0, options.n);
      return { chosen, stats: { input: rows.length, chosen: chosen.length } };
    },
    deepDive: async () => 'Stored fixture analysis',
    persistBatch: async (options) => {
      calls.persisted.push(options);
      return { inserted: options.items.slice(0, persistedLimit).map((item) => item.notice_id), skipped: [] };
    },
    incrementBatchesSent: async () => { calls.incremented++; return { batches_sent: 2, status: 'active' }; },
    sendBatchEmail: async (message) => { calls.sent.push(message); return { id: 'fixture-email' }; },
  };
  return { deps, calls };
}

test('normal batches request ten for Sam and five for everyone else, with the regular batch counter intact', async () => {
  for (const [id, expected] of [[SAM_ID, 10], ['other-buyer', 5]]) {
    const f = fixture();
    const result = await runBatchForBuyer({ ...buyer, id }, { baseUrl: 'https://fixture.test', now: NOW, deps: f.deps, logger });
    assert.equal(f.calls.curated[0].n, expected);
    assert.equal(f.calls.curated[0].maxCandidates, Math.max(12, expected * 2));
    assert.equal(f.calls.persisted[0].batchMonth, 2);
    assert.equal(result.delivered.inserted.length, expected);
    assert.equal(f.calls.incremented, 1);
  }
});

test('the scheduled top-up uses November batch 1, never increments the monthly counter, and excludes prior deliveries', async () => {
  const f = fixture();
  const original = structuredClone(buyer);
  const [topUp] = dueContractTopUps(NOW);
  const result = await runBatchForBuyer(buyer, { baseUrl: 'https://fixture.test', now: NOW, n: 9, topUp, deps: f.deps, logger });
  assert.equal(result.chosen.length, 9);
  assert.equal(result.batch, null);
  assert.equal(f.calls.incremented, 0);
  assert.equal(f.calls.sent.length, 0);
  assert.equal(f.calls.persisted[0].batchMonth, 1);
  assert.equal(f.calls.persisted[0].topUpTarget, 10);
  assert.ok(f.calls.curated[0].deliveredNoticeIds.has('already-delivered'));
  assert.deepEqual(buyer, original);
});

test('top-ups cannot run early, for another buyer, or after the account advances a cycle', async () => {
  const [topUp] = dueContractTopUps(NOW);
  for (const options of [
    { account: buyer, now: new Date('2026-11-16T13:59:59Z') },
    { account: { ...buyer, id: 'other-buyer' }, now: NOW },
    { account: { ...buyer, batches_sent: 2 }, now: NOW },
  ]) {
    const f = fixture();
    await assert.rejects(runBatchForBuyer(options.account, { topUp, now: options.now, deps: f.deps }), /not eligible for release/);
    assert.equal(f.calls.keys, 0);
  }
});

test('November top-up searches, curates, and explains against the confirmed snapshot, not the old saved profile', async () => {
  const account = { ...buyer, naics: ['484210'], keywords: ['Moving/Relocation'],
    state: 'TX', size_min: 50000, size_max: 300000, set_asides: [] };
  const original = structuredClone(account);
  const f = fixture();
  const profiles = [];
  for (const method of ['poolForNiche', 'curateForBuyer', 'deepDive']) {
    const originalMethod = f.deps[method];
    f.deps[method] = async (...args) => {
      profiles.push({ method, profile: args[method === 'poolForNiche' ? 0 : 1] });
      return originalMethod(...args);
    };
  }
  const [topUp] = dueContractTopUps(NOW);
  await runBatchForBuyer(account, { topUp, n: 9, now: NOW, baseUrl: 'https://fixture.test', deps: f.deps, logger });
  assert.ok(profiles.some(({ method }) => method === 'deepDive'));
  for (const { profile } of profiles) {
    assert.equal(profile.naics.length, 13);
    assert.ok(profile.naics.includes('561210'));
    assert.ok(!profile.naics.includes('484210'));
    assert.deepEqual(profile.keywords, []);
    assert.equal(profile.state, null);
    assert.equal(profile.size_min, 50000);
    assert.equal(profile.size_max, 275000);
    assert.deepEqual(profile.set_asides, []);
  }
  assert.equal(f.calls.incremented, 0);
  assert.equal(f.calls.sent.length, 0);
  assert.deepEqual(account, original);

  // A later regular batch must respect the saved profile, not silently reuse
  // a historical one-off override after the customer edits their targeting.
  const normal = fixture();
  const pool = normal.deps.poolForNiche;
  normal.deps.poolForNiche = async (profile, options) => {
    assert.deepEqual(profile.naics, original.naics);
    assert.equal(profile.size_max, 300000);
    return pool(profile, options);
  };
  await runBatchForBuyer(account, { now: NOW, baseUrl: 'https://fixture.test', deps: normal.deps, logger });
});

test('quality shortfalls remain honest and do not consume another month', async () => {
  const f = fixture({ poolSize: 1 });
  const [topUp] = dueContractTopUps(NOW);
  const result = await runBatchForBuyer(buyer, { baseUrl: 'https://fixture.test', now: NOW, n: 9, topUp, deps: f.deps, logger });
  assert.equal(result.chosen.length, 1);
  assert.equal(result.stats.shortfall, 8);
  assert.equal(f.calls.incremented, 0);
  assert.equal(f.calls.curated.length, 2);
});

test('outbound emails contain only contracts actually persisted, not stale or skipped selections', async () => {
  const f = fixture({ persistedLimit: 2 });
  const result = await runBatchForBuyer(buyer, { baseUrl: 'https://fixture.test', now: NOW, send: true, deps: f.deps, logger });
  assert.equal(result.chosen.length, 2);
  assert.equal(f.calls.sent.length, 1);
  assert.match(f.calls.sent[0].subject, /2 targets/);
  assert.doesNotMatch(f.calls.sent[0].html, /Fixture 9/);
});
