import test from 'node:test';
import assert from 'node:assert/strict';
import { runScheduledTopUps } from '../lib/scheduledTopUps.js';

const NOW = new Date('2026-11-16T14:00:00Z');
const SAM_ID = '23e47b6a-1c4e-4140-b49c-d91dd67f4267';

function fixture({ count = 1, status = 'active', batchesSent = 1 } = {}) {
  const buyer = { id: SAM_ID, status, batches_sent: batchesSent, batches_owed: 12, next_batch_at: '2026-12-12T17:59:43.922+00:00' };
  const deliveries = Array.from({ length: count }, (_, index) => ({ notice_id: String(index) }));
  const calls = [];
  return { buyer, deliveries, calls, deps: {
    getBuyerById: async (id) => { assert.equal(id, SAM_ID); return buyer; },
    listDeliveriesForBatch: async (id, batchMonth) => { assert.equal(id, SAM_ID); assert.equal(batchMonth, 1); return deliveries; },
    runBatchForBuyer: async (account, options) => {
      calls.push({ account, options });
      const inserted = Array.from({ length: options.n }, (_, index) => `top-up-${deliveries.length + index}`);
      deliveries.push(...inserted.map((notice_id) => ({ notice_id })));
      return { delivered: { inserted }, batch: null };
    },
  } };
}

test('before Monday the scheduler performs no reads, generation, writes, or customer emails', async () => {
  const unexpected = () => { throw new Error('No work may run before release'); };
  assert.deepEqual(await runScheduledTopUps({ now: new Date('2026-11-16T13:59:59Z'), deps: { getBuyerById: unexpected, listDeliveriesForBatch: unexpected, runBatchForBuyer: unexpected } }), []);
});

test('Monday adds only nine to November batch 1 and preserves the twelve-month plan and December date', async () => {
  const f = fixture();
  const original = structuredClone(f.buyer);
  const results = await runScheduledTopUps({ now: NOW, baseUrl: 'https://fixture.test', deps: f.deps });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].options.n, 9);
  assert.equal(f.calls[0].options.topUp.batchMonth, 1);
  assert.equal(f.calls[0].options.send, false);
  assert.equal(results[0].delivered, 9);
  assert.equal(results[0].shortfall, 0);
  assert.equal(f.deliveries.length, 10);
  assert.deepEqual(f.buyer, original);
  assert.deepEqual(await runScheduledTopUps({ now: NOW, deps: f.deps }), []);
  assert.equal(f.calls.length, 1, 'A replay does not create another top-up');
});

test('completed, unactivated, and later-cycle buyers are not reactivated or rescheduled', async () => {
  for (const config of [{ status: 'exploring', batchesSent: 0 }, { status: 'completed' }, { batchesSent: 2 }]) {
    const f = fixture(config);
    assert.deepEqual(await runScheduledTopUps({ now: NOW, deps: f.deps }), []);
    assert.equal(f.calls.length, 0);
  }
});

test('partial top-ups request only what is still missing; quality shortfalls remain visible and retryable', async () => {
  const f = fixture({ count: 4 });
  f.deps.runBatchForBuyer = async (buyer, options) => {
    assert.equal(options.n, 6);
    return { delivered: { inserted: ['new1', 'new2'] } };
  };
  const results = await runScheduledTopUps({ now: NOW, deps: f.deps });
  assert.equal(results[0].delivered, 2);
  assert.equal(results[0].shortfall, 4);
});

test('scheduler surfaces failures for ops instead of consuming a new month or changing the schedule', async () => {
  const f = fixture();
  const original = structuredClone(f.buyer);
  f.deps.runBatchForBuyer = async () => { throw new Error('Provider unavailable'); };
  const results = await runScheduledTopUps({ now: NOW, deps: f.deps });
  assert.equal(results[0].error, 'Provider unavailable');
  assert.deepEqual(f.buyer, original);
});
