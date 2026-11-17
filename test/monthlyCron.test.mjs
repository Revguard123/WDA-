import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runScheduledTopUps } from '../lib/scheduledTopUps.js';

import {
  shouldAdvanceMonthlySchedule,
} from '../app/api/cron/monthly/route.js';

test('monthly cron does not advance schedule when zero contracts are delivered', () => {
  assert.equal(
    shouldAdvanceMonthlySchedule(0),
    false,
  );
});

test('monthly cron advances schedule after at least one contract is delivered', () => {
  assert.equal(
    shouldAdvanceMonthlySchedule(1),
    true,
  );

  assert.equal(
    shouldAdvanceMonthlySchedule(5),
    true,
  );
});

test('the authenticated daily cron processes a November top-up without advancing Sam or changing other batch sizes', async () => {
  const require = createRequire(import.meta.url);
  const swc = await require('next/dist/build/swc').loadBindings();
  const { code } = await swc.transform(readFileSync('app/api/cron/monthly/route.js', 'utf8'), {
    filename: 'route.js', jsc: { parser: { syntax: 'ecmascript' }, target: 'es2020' }, module: { type: 'commonjs' },
  });
  const sam = { id: '23e47b6a-1c4e-4140-b49c-d91dd67f4267', status: 'active', batches_sent: 1, batches_owed: 12, next_batch_at: '2026-12-12T17:59:43.922+00:00' };
  const original = structuredClone(sam);
  const scheduled = [];
  const calls = [];
  const deps = {
    getBuyerById: async () => sam,
    listDeliveriesForBatch: async () => [{ notice_id: 'original' }],
    runBatchForBuyer: async (buyer, options) => {
      calls.push({ buyer, options });
      return { delivered: { inserted: Array.from({ length: options.n }, (_, index) => `extra-${index}`) } };
    },
  };
  const imports = {
    '../../../../lib/buyers.js': { listActiveBuyersDue: async () => [{ id: 'other-due-buyer' }], setNextBatchAt: async (id) => scheduled.push(id) },
    '../../../../lib/pipeline.js': { runBatchForBuyer: async (buyer, options) => {
      assert.equal(buyer.id, 'other-due-buyer');
      assert.equal(options.n, undefined, 'Other buyers retain the pipeline default');
      return { delivered: { inserted: ['A', 'B', 'C', 'D', 'E'] }, stats: { shortfall: 0 }, sent: { id: 'fixture' }, batch: { status: 'active' } };
    } },
    '../../../../lib/baseUrl.js': { resolveBaseUrl: () => 'https://fixture.test' },
    '../../../../lib/alerts.js': { sendOpsAlert: async () => { throw new Error('No alert expected'); } },
    '../../../../lib/scheduledTopUps.js': { runScheduledTopUps: (options) => runScheduledTopUps({ ...options, deps }) },
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-11-16T14:00:00Z'])); }
  }
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', 'Date', code)(
    (id) => { if (!imports[id]) throw new Error(`Unexpected import ${id}`); return imports[id]; }, module, module.exports, { env: { CRON_SECRET: 'fixture-secret' } }, FixedDate,
  );
  const unauthorized = await module.exports.GET(new Request('https://fixture.test/api/cron/monthly'));
  assert.equal(unauthorized.status, 401);
  assert.equal(calls.length, 0);
  const response = await module.exports.GET(new Request('https://fixture.test/api/cron/monthly', { headers: { authorization: 'Bearer fixture-secret' } }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.topUps[0].delivered, 9);
  assert.equal(calls[0].options.topUp.batchMonth, 1);
  assert.deepEqual(scheduled, ['other-due-buyer']);
  assert.deepEqual(sam, original);
});
