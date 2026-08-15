import { test } from 'node:test';
import assert from 'node:assert/strict';

import { activateBuyer, isIncompleteFirstActivation } from '../lib/activation.js';

const token = '00000000-0000-0000-0000-000000000001';
const future = '2026-09-11T00:00:00.000Z';

function buyer(overrides = {}) {
  return {
    id: 1,
    access_token: token,
    email: 'buyer@example.com',
    status: 'exploring',
    batches_sent: 0,
    batches_owed: 6,
    naics: ['236220'],
    next_batch_at: null,
    ...overrides,
  };
}

function okBatch(extra = {}) {
  return {
    chosen: [{ notice_id: 'N1' }],
    stats: { shortfall: 4 },
    delivered: { inserted: ['N1'], skipped: [] },
    batch: { batches_sent: 1, status: 'active' },
    sent: { skipped: 'test' },
    ...extra,
  };
}

function depsFor(initialBuyer, overrides = {}) {
  const calls = {
    run: 0,
    claim: 0,
    rollback: 0,
    count: 0,
    increment: 0,
    logs: [],
    warns: [],
  };
  const deps = {
    getBuyerByToken: async () => initialBuyer,
    claimBuyerForActivation: async (b) => {
      calls.claim += 1;
      return { ...b, status: 'active', activated_at: b.activated_at || '2026-08-11T00:00:00.000Z', next_batch_at: b.next_batch_at || future };
    },
    rollbackIncompleteActivation: async () => {
      calls.rollback += 1;
    },
    runBatchForBuyer: async () => {
      calls.run += 1;
      return okBatch();
    },
    countDeliveriesForBuyer: async () => {
      calls.count += 1;
      return 0;
    },
    incrementBatchesSent: async () => {
      calls.increment += 1;
      return { batches_sent: 1, status: 'active' };
    },
    resolveBaseUrl: () => 'http://localhost:3000',
    logger: {
      info: (entry) => calls.logs.push(entry),
      warn: (entry) => calls.warns.push(entry),
    },
    ...overrides,
  };
  return { deps, calls };
}

test('normal exploring buyer activation succeeds', async () => {
  const { deps, calls } = depsFor(buyer());
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.outcome, 'success');
  assert.equal(result.body.activated, true);
  assert.deepEqual(result.body.delivered.inserted, ['N1']);
  assert.equal(calls.claim, 1);
  assert.equal(calls.run, 1);
});

test('smaller valid first batch succeeds and does not trigger recovery retry', async () => {
  const { deps, calls } = depsFor(buyer(), {
    runBatchForBuyer: async () => {
      calls.run += 1;
      return okBatch({
        chosen: [{ notice_id: 'N1' }, { notice_id: 'N2' }],
        stats: { shortfall: 3 },
        delivered: { inserted: ['N1', 'N2'], skipped: [] },
        batch: { batches_sent: 1, status: 'active' },
      });
    },
  });
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.outcome, 'success');
  assert.equal(result.body.chosen, 2);
  assert.equal(result.body.shortfall, 3);
  assert.equal(calls.rollback, 0);
  assert.equal(calls.increment, 0);
});

test('concurrent activation remains idempotent when the claim is already taken', async () => {
  const { deps, calls } = depsFor(buyer(), {
    claimBuyerForActivation: async () => {
      calls.claim += 1;
      return null;
    },
  });
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.alreadyActive, true);
  assert.equal(calls.run, 0);
});

test('already-active buyer with a successful prior batch does not regenerate first batch', async () => {
  const { deps, calls } = depsFor(buyer({ status: 'active', batches_sent: 1 }));
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.alreadyActive, true);
  assert.equal(calls.claim, 0);
  assert.equal(calls.run, 0);
});

test('completed buyer does not reactivate', async () => {
  const { deps, calls } = depsFor(buyer({ status: 'completed', batches_sent: 1, batches_owed: 1 }));
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.alreadyActive, true);
  assert.equal(result.body.status, 'completed');
  assert.equal(calls.run, 0);
});

test('simulated first-batch failure leaves buyer recoverable with a retryable error', async () => {
  const { deps, calls } = depsFor(buyer(), {
    runBatchForBuyer: async () => {
      calls.run += 1;
      throw new Error('SAM secret detail should not leak');
    },
  });
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 503);
  assert.equal(result.body.outcome, 'retryable_system_error');
  assert.equal(result.body.retryable, true);
  assert.match(result.body.error, /couldn't complete the search/i);
  assert.ok(!String(result.body.error).includes('SAM secret detail'));
  assert.equal(calls.rollback, 1);
  assert.equal(calls.warns.some((entry) => entry.event === 'activation_batch_failed'), true);
});

test('retry after simulated first-batch failure succeeds for active incomplete buyer', async () => {
  const incomplete = buyer({ status: 'active', batches_sent: 0, activated_at: '2026-08-11T00:00:00.000Z', next_batch_at: future });
  assert.equal(isIncompleteFirstActivation(incomplete), true);
  const { deps, calls } = depsFor(incomplete);
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.recovered, true);
  assert.equal(calls.claim, 1);
  assert.equal(calls.run, 1);
});

test('retry does not duplicate partial deliveries and repairs the missing counter', async () => {
  const { deps, calls } = depsFor(buyer({ status: 'active', batches_sent: 0 }), {
    runBatchForBuyer: async () => {
      calls.run += 1;
      return okBatch({ chosen: [], delivered: { inserted: [], skipped: ['N1'] }, batch: null });
    },
    countDeliveriesForBuyer: async () => {
      calls.count += 1;
      return 1;
    },
  });
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.recovered, true);
  assert.equal(calls.increment, 1);
  assert.equal(calls.rollback, 0);
});

test('batches_sent does not increment twice for an already successful active buyer', async () => {
  const { deps, calls } = depsFor(buyer({ status: 'active', batches_sent: 1 }));
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.body.alreadyActive, true);
  assert.equal(calls.increment, 0);
  assert.equal(calls.run, 0);
});

test('next_batch_at remains intact during successful recovery', async () => {
  let seen;
  const { deps } = depsFor(buyer({ status: 'active', batches_sent: 0, next_batch_at: future }), {
    runBatchForBuyer: async (claimed) => {
      seen = claimed.next_batch_at;
      return okBatch();
    },
  });
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(seen, future);
});

test('zero eligible opportunities returns explicit no_matches outcome instead of 503', async () => {
  const { deps, calls } = depsFor(buyer(), {
    runBatchForBuyer: async () => {
      calls.run += 1;
      return okBatch({ chosen: [], delivered: { inserted: [], skipped: [] }, batch: null });
    },
  });
  const result = await activateBuyer({ token, req: {}, deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.outcome, 'no_matches');
  assert.equal(result.body.retryable, true);
  assert.equal(result.body.activated, false);
  assert.equal(calls.rollback, 1);
  assert.equal(calls.increment, 0);
  assert.deepEqual(result.body.delivered.inserted, []);
  assert.equal(calls.logs.some((entry) => entry.event === 'activation_no_matches'), true);
});
