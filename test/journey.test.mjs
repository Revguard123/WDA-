import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  discoverStateForBuyer,
  hasMeaningfulTargeting,
  portalPathForBuyer,
  setupStateForBuyer,
  startStateForBuyer,
} from '../lib/journey.js';

const token = '00000000-0000-0000-0000-000000000001';
const buyer = (status, naics = []) => ({ status, naics, access_token: token });

test('fresh exploring buyer has no meaningful targeting', () => {
  assert.equal(hasMeaningfulTargeting(buyer('exploring')), false);
});

test('exploring buyer with NAICS has meaningful targeting', () => {
  assert.equal(hasMeaningfulTargeting(buyer('exploring', ['236220'])), true);
});

test('blank NAICS values do not count as meaningful targeting', () => {
  assert.equal(hasMeaningfulTargeting(buyer('exploring', ['', '   '])), false);
});

test('portal sends exploring buyers to setup and other buyer states to contracts', () => {
  assert.equal(portalPathForBuyer(buyer('exploring')), `/setup/${token}`);
  assert.equal(portalPathForBuyer(buyer('active')), `/contracts/${token}`);
  assert.equal(portalPathForBuyer(buyer('completed')), `/contracts/${token}`);
});

test('setup shows path choice only for exploring buyers without targeting', () => {
  assert.deepEqual(setupStateForBuyer(buyer('exploring')), { hasTargeting: false, showChoice: true });
  assert.deepEqual(setupStateForBuyer(buyer('exploring'), { directTargeting: true }), {
    hasTargeting: false,
    showChoice: false,
  });
  assert.deepEqual(setupStateForBuyer(buyer('exploring', ['236220'])), {
    hasTargeting: true,
    showChoice: false,
  });
});

test('setup redirects active and completed buyers to contracts', () => {
  assert.deepEqual(setupStateForBuyer(buyer('active')), { redirect: `/contracts/${token}` });
  assert.deepEqual(setupStateForBuyer(buyer('completed')), { redirect: `/contracts/${token}` });
});

test('discovery allows exploring buyers and redirects active/completed buyers', () => {
  assert.deepEqual(discoverStateForBuyer(buyer('exploring')), { allowed: true });
  assert.deepEqual(discoverStateForBuyer(buyer('active')), { redirect: `/contracts/${token}` });
  assert.deepEqual(discoverStateForBuyer(buyer('completed')), { redirect: `/contracts/${token}` });
});

test('start requires exploring status and targeting', () => {
  assert.deepEqual(startStateForBuyer(buyer('exploring', ['236220'])), { allowed: true });
  assert.deepEqual(startStateForBuyer(buyer('exploring')), { redirect: `/setup/${token}` });
  assert.deepEqual(startStateForBuyer({ ...buyer('active', ['236220']), batches_sent: 1 }), { redirect: `/contracts/${token}` });
  assert.deepEqual(startStateForBuyer({ ...buyer('active', ['236220']), batches_sent: 0 }), { allowed: true });
  assert.deepEqual(startStateForBuyer(buyer('completed', ['236220'])), { redirect: `/contracts/${token}` });
});
