import test from 'node:test';
import assert from 'node:assert/strict';
import { persistBatch, topUpDeliveryId } from '../lib/deliveries.js';

function memoryClient({ existingCount = 1, synchronizeBatchReads = false } = {}) {
  const deliveries = Array.from({ length: existingCount }, (_, index) => ({ id: `existing-${index}`, buyer_id: 'fixture-buyer', batch_month: 1, notice_id: `old-${index}` }));
  const opportunities = deliveries.map((delivery) => ({ notice_id: delivery.notice_id, solicitation_num: `old-sol-${delivery.notice_id}` }));
  let batchReadCount = 0;
  let releaseBatchReads;
  const batchReadsReady = new Promise((resolve) => { releaseBatchReads = resolve; });
  const client = {
    from(table) {
      const filters = [];
      let insertion;
      const builder = {
        select() { return builder; },
        eq(key, value) { filters.push((row) => row[key] === value); if (key === 'batch_month') builder.isBatchRead = true; return builder; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return builder; },
        insert(rows) { insertion = rows; return builder; },
        then(resolve, reject) {
          return (async () => {
            if (insertion) {
              const duplicates = insertion.some((row) => deliveries.some((stored) => stored.id === row.id
                || (stored.buyer_id === row.buyer_id && stored.notice_id === row.notice_id)));
              if (duplicates) return { data: null, error: { code: '23505', message: 'Duplicate delivery or occupied slot' } };
              deliveries.push(...insertion);
              return { data: insertion.map(({ notice_id }) => ({ notice_id })), error: null };
            }
            const rows = (table === 'deliveries' ? deliveries : opportunities).filter((row) => filters.every((filter) => filter(row))).map((row) => ({ ...row }));
            if (synchronizeBatchReads && builder.isBatchRead) {
              batchReadCount++;
              if (batchReadCount === 2) releaseBatchReads();
              await batchReadsReady;
            }
            return { data: rows, error: null };
          })().then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { deliveries, client, upsert: async (rows) => { opportunities.push(...rows); } };
}

function batch(prefix = 'new', count = 9) {
  const items = Array.from({ length: count }, (_, index) => ({ notice_id: `${prefix}-${index}`, solicitation_num: `${prefix}-sol-${index}`, why_line: 'Fixture analysis' }));
  return { buyerId: 'fixture-buyer', batchMonth: 1, topUpTarget: 10, items, opportunityRows: items };
}

test('top-up slot IDs are stable, scoped to buyer/cycle/slot, and valid database UUIDs', () => {
  const id = topUpDeliveryId('buyer', 1, 2);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(id, topUpDeliveryId('buyer', 1, 2));
  assert.notEqual(id, topUpDeliveryId('other-buyer', 1, 2));
  assert.notEqual(id, topUpDeliveryId('buyer', 2, 2));
  assert.notEqual(id, topUpDeliveryId('buyer', 1, 3));
});

test('persistence fills the original November cycle to ten without modifying the existing delivery', async () => {
  const f = memoryClient();
  const original = structuredClone(f.deliveries[0]);
  const result = await persistBatch(batch(), f);
  assert.equal(result.inserted.length, 9);
  assert.equal(f.deliveries.length, 10);
  assert.ok(f.deliveries.every((delivery) => delivery.batch_month === 1));
  assert.deepEqual(f.deliveries[0], original);
  assert.equal(f.deliveries[1].id, topUpDeliveryId('fixture-buyer', 1, 2));
  const repeat = await persistBatch(batch(), f);
  assert.deepEqual(repeat.inserted, []);
  assert.equal(f.deliveries.length, 10);
});

test('stale remaining counts are capped again at persistence time', async () => {
  const f = memoryClient({ existingCount: 8 });
  const result = await persistBatch(batch(), f);
  assert.equal(result.inserted.length, 2);
  assert.equal(f.deliveries.length, 10);
});

test('partial top-ups resume from the next free slot rather than starting another cycle', async () => {
  const f = memoryClient();
  await persistBatch(batch('partial', 3), f);
  assert.equal(f.deliveries.length, 4);
  const result = await persistBatch(batch('remaining', 9), f);
  assert.equal(result.inserted.length, 6);
  assert.equal(f.deliveries.length, 10);
  assert.equal(f.deliveries[4].id, topUpDeliveryId('fixture-buyer', 1, 5));
});

test('overlapping top-ups with different selections cannot over-deliver the ten-slot quota', async () => {
  const f = memoryClient({ synchronizeBatchReads: true });
  const results = await Promise.allSettled([persistBatch(batch('first'), f), persistBatch(batch('second'), f)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(f.deliveries.length, 10);
  assert.equal(new Set(f.deliveries.map((delivery) => delivery.id)).size, 10);
});

test('ordinary batches keep database-generated delivery IDs and their existing write behavior', async () => {
  const f = memoryClient();
  const input = batch('ordinary', 5);
  delete input.topUpTarget;
  input.batchMonth = 2;
  const result = await persistBatch(input, f);
  assert.equal(result.inserted.length, 5);
  assert.ok(f.deliveries.slice(1).every((delivery) => !Object.hasOwn(delivery, 'id') && delivery.batch_month === 2));
});
