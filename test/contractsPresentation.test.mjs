import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_CARD_BREAKDOWN_CTA,
  CONTRACT_CARD_WHY_LABEL,
  DEEP_DIVE_WHY_LABEL,
  contractsPresentationForBuyer,
} from '../lib/contractsPresentation.js';

const NOW = new Date('2026-08-11T00:00:00.000Z');

test('active buyer with batches remaining gets a between-batch state', () => {
  const state = contractsPresentationForBuyer(
    { status: 'active', batches_owed: 6, batches_sent: 1, next_batch_at: null },
    { deliveryCount: 5, now: NOW }
  );
  assert.equal(state.hasRemainingBatches, true);
  assert.equal(state.completed, false);
  assert.equal(state.showTargetingLink, true);
  assert.match(state.statusCallout.title, /next batch/i);
});

test('active buyer with future next_batch_at gets the real scheduled date', () => {
  const state = contractsPresentationForBuyer(
    { status: 'active', batches_owed: 6, batches_sent: 1, next_batch_at: '2026-09-11T00:00:00.000Z' },
    { deliveryCount: 5, now: NOW }
  );
  assert.equal(state.statusCallout.title, 'Your next five are on the way.');
  assert.match(state.statusCallout.body, /September 11, 2026/);
});

test('active buyer with null next_batch_at is not shown an invented date', () => {
  const state = contractsPresentationForBuyer(
    { status: 'active', batches_owed: 6, batches_sent: 1, next_batch_at: null },
    { deliveryCount: 5, now: NOW }
  );
  assert.ok(!/\d{4}/.test(state.statusCallout.body));
});

test('completed buyer gets archive state and historical contracts remain the list context', () => {
  const state = contractsPresentationForBuyer(
    { status: 'completed', batches_owed: 1, batches_sent: 1, next_batch_at: null },
    { deliveryCount: 3, now: NOW }
  );
  assert.equal(state.completed, true);
  assert.equal(state.listTitle, 'Your Contract Archive');
  assert.match(state.statusCallout.title, /delivery is complete/i);
  assert.match(state.statusCallout.body, /previous opportunities below/i);
});

test('active buyer retains targeting access but completed buyer does not imply another batch', () => {
  assert.equal(contractsPresentationForBuyer({ status: 'active' }).showTargetingLink, true);
  assert.equal(contractsPresentationForBuyer({ status: 'completed' }).showTargetingLink, false);
});

test('contract and deep-dive labels use the product-critical wording', () => {
  assert.equal(CONTRACT_CARD_WHY_LABEL, 'Why this is winnable for you');
  assert.equal(CONTRACT_CARD_BREAKDOWN_CTA, 'See Full Breakdown');
  assert.equal(DEEP_DIVE_WHY_LABEL, 'Why we surfaced this one');
});

test('relevant page presentation removed the old why label and old dive CTA', () => {
  const contractsPage = readFileSync('app/contracts/[token]/page.js', 'utf8');
  const deepDivePage = readFileSync('app/d/[token]/[notice_id]/page.js', 'utf8');
  assert.ok(!contractsPage.includes('Why we picked this'));
  assert.ok(!deepDivePage.includes('Why we picked this'));
  assert.ok(!contractsPage.includes('Dive Deeper'));
  assert.ok(contractsPage.includes('CONTRACT_CARD_WHY_LABEL'));
  assert.ok(deepDivePage.includes('DEEP_DIVE_WHY_LABEL'));
});

test('contract cards link each delivery to its token-scoped deep dive', () => {
  const contractsPage = readFileSync('app/contracts/[token]/page.js', 'utf8');
  const deepDivePage = readFileSync('app/d/[token]/[notice_id]/page.js', 'utf8');
  assert.ok(contractsPage.includes('href={`/d/${token}/${c.notice_id}`}'));
  assert.ok(contractsPage.includes('CONTRACT_CARD_BREAKDOWN_CTA'));
  assert.ok(deepDivePage.includes('getDeliveryForBuyer(buyer.id, noticeId)'));
  assert.ok(deepDivePage.includes('Full breakdown'));
});

test('relevant static product copy does not claim hand-picked by our team', () => {
  const files = [
    'app/layout.js',
    'lib/email/renderBatchEmail.js',
    'lib/email/renderWelcomeEmail.js',
    'lib/ai/claude.js',
  ];
  const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.ok(!/hand-picked by our team/i.test(combined));
  assert.ok(!/hand-picks/i.test(combined));
  assert.ok(!/hand-picked to/i.test(combined));
});
