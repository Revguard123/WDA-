import test from 'node:test';
import assert from 'node:assert/strict';

import { createFeedabilityChecker } from '../lib/playbook/feedability.js';

const profile = {
  geography_mode: 'single_state',
  state: 'GA',
  set_asides: ['sb'],
  size_min: null,
  size_max: null,
};

function rows(count) {
  return Array.from({ length: count }, (_, i) => ({
    notice_id: `n-${i}`,
    solicitation_num: `s-${i}`,
    naics: '561720',
    set_aside_type: 'SBA',
    place_of_perf: 'Atlanta, GA',
    response_deadline: '2099-01-01T00:00:00.000Z',
    est_value: null,
  }));
}

test('feedability >=5 is sufficient_current_supply from cache', async () => {
  let liveCalls = 0;
  const check = createFeedabilityChecker({
    cacheReader: async () => rows(5),
    engineRunner: async () => { liveCalls += 1; return { rows: rows(0), stats: {} }; },
    upsert: null,
    now: new Date('2026-08-11T00:00:00Z'),
  });
  const result = await check({ naics: ['561720'], profile });
  assert.equal(result.status, 'sufficient_current_supply');
  assert.equal(result.eligible_live_count, 5);
  assert.equal(liveCalls, 0);
});

test('feedability 1-4 is thin_current_supply from live verification', async () => {
  const check = createFeedabilityChecker({
    cacheReader: async () => [],
    engineRunner: async () => ({ rows: rows(4), stats: {} }),
    upsert: null,
    now: new Date('2026-08-11T00:00:00Z'),
  });
  const result = await check({ naics: ['561720'], profile });
  assert.equal(result.status, 'thin_current_supply');
  assert.equal(result.eligible_live_count, 4);
});

test('feedability 0 is no_current_supply', async () => {
  const check = createFeedabilityChecker({
    cacheReader: async () => [],
    engineRunner: async () => ({ rows: [], stats: {} }),
    upsert: null,
    now: new Date('2026-08-11T00:00:00Z'),
  });
  const result = await check({ naics: ['561720'], profile });
  assert.equal(result.status, 'no_current_supply');
  assert.equal(result.eligible_live_count, 0);
});

test('SAM failure returns unknown and does not throw', async () => {
  const check = createFeedabilityChecker({
    cacheReader: async () => { throw new Error('SAM down'); },
    engineRunner: async () => ({ rows: [], stats: {} }),
    upsert: null,
    now: new Date('2026-08-11T00:00:00Z'),
  });
  const result = await check({ naics: ['561720'], profile });
  assert.equal(result.status, 'unknown');
  assert.equal(result.eligible_live_count, null);
});

test('feedability lookups are deduplicated by NAICS/geography/set-asides', async () => {
  let liveCalls = 0;
  const check = createFeedabilityChecker({
    cacheReader: async () => [],
    engineRunner: async () => {
      liveCalls += 1;
      return { rows: rows(1), stats: {} };
    },
    upsert: null,
    now: new Date('2026-08-11T00:00:00Z'),
  });
  await check({ naics: ['561720'], profile });
  await check({ naics: ['561720'], profile });
  assert.equal(liveCalls, 1);
});

test('state geography is hard and nationwide is unrestricted in feedability niche', async () => {
  const seen = [];
  const check = createFeedabilityChecker({
    cacheReader: async (niche) => { seen.push(niche); return rows(5); },
    engineRunner: async () => ({ rows: [], stats: {} }),
    upsert: null,
    now: new Date('2026-08-11T00:00:00Z'),
  });
  await check({ naics: ['561720'], profile });
  await check({ naics: ['561720'], profile: { ...profile, geography_mode: 'nationwide', state: 'GA' } });
  assert.equal(seen[0].state, 'GA');
  assert.equal(seen[1].state, '');
});

