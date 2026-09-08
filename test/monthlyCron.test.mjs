import test from 'node:test';
import assert from 'node:assert/strict';

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