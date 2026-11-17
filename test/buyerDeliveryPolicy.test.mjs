import test from 'node:test';
import assert from 'node:assert/strict';
import { contractsPerBatch, dueContractTopUps, topUpRemaining, buyerForContractTopUp } from '../lib/buyerDeliveryPolicy.js';
import { contractsPresentationForBuyer } from '../lib/contractsPresentation.js';

const SAM_ID = '23e47b6a-1c4e-4140-b49c-d91dd67f4267';

test('only the approved buyer gets ten contracts; purchased months are untouched', () => {
  const buyer = { id: SAM_ID, batches_owed: 12, batches_sent: 1, next_batch_at: '2026-12-12T17:59:43.922+00:00' };
  const before = structuredClone(buyer);
  assert.equal(contractsPerBatch(buyer), 10);
  assert.equal(contractsPerBatch(), 5);
  assert.equal(contractsPerBatch({ id: 'another-account', name: 'Sam Kahn', tier: 'vanguard' }), 5);
  assert.deepEqual(buyer, before);
});

test('the top-up becomes due at the Monday cron slot, never earlier', () => {
  assert.deepEqual(dueContractTopUps(new Date('2026-11-14T12:00:00Z')), []);
  assert.deepEqual(dueContractTopUps(new Date('2026-11-16T13:59:59.999Z')), []);
  const [job] = dueContractTopUps(new Date('2026-11-16T14:00:00Z'));
  assert.equal(new Date(job.releaseAt).getUTCDay(), 1);
  assert.equal(job.buyerId, SAM_ID);
  assert.equal(job.batchMonth, 1);
  assert.equal(job.periodLabel, 'November 2026');
  assert.equal(job.targetCount, 10);
  assert.equal(new Date(job.releaseAt).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', hour12: false }), '16/11/2026, 19:00:00');
  assert.deepEqual(dueContractTopUps(new Date('invalid')), []);
});

test('a top-up fills only the remaining slots and cannot overfill an already complete batch', () => {
  const [job] = dueContractTopUps(new Date('2026-11-16T14:00:00Z'));
  assert.equal(topUpRemaining(job, [{ notice_id: 'existing' }]), 9);
  assert.equal(topUpRemaining(job, [{ notice_id: 'existing' }, { notice_id: 'existing' }]), 9);
  assert.equal(topUpRemaining(job, Array.from({ length: 10 }, (_, index) => ({ notice_id: String(index) }))), 0);
  assert.equal(topUpRemaining(job, Array.from({ length: 12 }, (_, index) => ({ notice_id: String(index) }))), 0);
});

test('Sam sees the correct quantity without implying that other plans were upgraded', () => {
  const buyer = { id: SAM_ID, status: 'active', batches_owed: 12, batches_sent: 1, next_batch_at: '2026-12-12T17:59:43.922+00:00' };
  const state = contractsPresentationForBuyer(buyer, { deliveryCount: 10, now: new Date('2026-11-16T14:00:00Z') });
  assert.equal(state.listTitle, "This month's 10 winnable targets");
  assert.equal(state.statusCallout.title, 'Your next 10 are on the way.');
  assert.match(state.statusCallout.body, /December 12, 2026/);
  assert.equal(contractsPresentationForBuyer({ ...buyer, id: 'different-buyer' }, { now: new Date('2026-11-16T14:00:00Z') }).statusCallout.title, 'Your next five are on the way.');
});

test('the November top-up uses the confirmed targeting without changing the saved buyer', () => {
  const [job] = dueContractTopUps(new Date('2026-11-17T12:00:00Z'));
  const buyer = { id: SAM_ID, naics: ['236411', '782710', '484210'], keywords: ['Moving/Relocation'],
    state: 'TX', size_min: 50000, size_max: 300000, set_asides: [],
    batches_owed: 12, batches_sent: 1, next_batch_at: '2026-12-12T17:59:43.922+00:00' };
  const original = structuredClone(buyer);
  const profile = buyerForContractTopUp(buyer, job);
  assert.deepEqual(profile.naics, ['561210', '236118', '236220', '332992', '332993', '332994',
    '423990', '485991', '485999', '531110', '561720', '561730', '623210']);
  assert.deepEqual(profile.keywords, []);
  assert.equal(profile.state, null);
  assert.equal(profile.size_min, 50000);
  assert.equal(profile.size_max, 275000);
  for (const key of ['id', 'set_asides', 'batches_owed', 'batches_sent', 'next_batch_at']) {
    assert.deepEqual(profile[key], buyer[key]);
  }
  profile.naics.push('not-persisted');
  assert.equal(job.targeting.naics.length, 13);
  assert.deepEqual(buyer, original);
});

test('top-up targeting cannot be supplied by a caller or applied to another account', () => {
  const [job] = dueContractTopUps(new Date('2026-11-17T12:00:00Z'));
  const profile = buyerForContractTopUp({ id: SAM_ID }, { ...job, targeting: { naics: ['wrong'] } });
  assert.equal(profile.naics[0], '561210');
  assert.throws(() => buyerForContractTopUp({ id: 'another-buyer' }, job), /not configured/);
  assert.throws(() => buyerForContractTopUp({ id: SAM_ID }, { ...job, id: 'unknown-job' }), /not configured/);
});
