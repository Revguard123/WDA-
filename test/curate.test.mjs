// Unit test for the Slice 2 curate pipeline, with the Claude steps faked so it
// runs with no key and no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { curateForBuyer } from '../lib/match/curate.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(NOW.getTime() + days * DAY).toISOString();
const pop = (code) => ({ placeOfPerformance: { state: { code } } });

const BUYER = {
  naics: ['561720'],
  keywords: ['janitorial', 'custodial', 'cleaning'],
  set_asides: ['sdvosb'],
  state: 'SC',
};

function rows() {
  return [
    { notice_id: 'A', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial Services', description: 'janitorial', response_deadline: at(30), raw: pop('SC') },
    { notice_id: 'B', naics: '561720', set_aside_type: '', title: 'Custodial Services', description: 'custodial cleaning', response_deadline: at(30), raw: pop('SC') },
    { notice_id: 'C', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Construction Contract', description: 'building construction', response_deadline: at(30), raw: pop('SC') },
    { notice_id: 'D', naics: '561720', set_aside_type: 'WOSB', title: 'Janitorial (WOSB)', description: 'x', response_deadline: at(30), raw: pop('SC') },
    { notice_id: 'E', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial (tight)', description: 'x', response_deadline: at(3), raw: pop('SC') },
  ];
}

// Fake AI: disqualify anything whose title mentions construction.
const fakeDisqualify = async (op) => ({
  disqualified: /construction/i.test(op.title || ''),
  reason: /construction/i.test(op.title || '') ? 'outside the buyer capability' : 'fits',
});
const fakeWhyLine = async (op) => `Fits because ${op.title} matches the janitorial niche.`;

test('curate runs hard filters, AI disqualification, ranking, and why-lines', async () => {
  const { chosen, stats } = await curateForBuyer(
    rows(),
    BUYER,
    { disqualify: fakeDisqualify, writeWhyLine: fakeWhyLine },
    { now: NOW, minRunwayDays: 14, n: 5 },
  );

  // D dropped by set-aside, E dropped by runway -> 3 survive hard filters (A,B,C)
  assert.equal(stats.afterHardFilters, 3);
  // C disqualified by AI (construction)
  assert.equal(stats.disqualifiedByAI, 1);
  assert.equal(stats.eligible, 2);
  // only 2 eligible, wanted 5
  assert.equal(stats.chosen, 2);
  assert.equal(stats.shortfall, 3);

  const ids = chosen.map((c) => c.notice_id).sort();
  assert.deepEqual(ids, ['A', 'B']);
  // A (exact set-aside) should outrank B (full-and-open), all else equal
  assert.equal(chosen[0].notice_id, 'A');
  // why-lines attached, no long dash
  for (const c of chosen) {
    assert.ok(c.why_line.length > 0);
    assert.ok(!c.why_line.includes('—'));
    assert.ok(typeof c.score === 'number');
  }
});

test('a thrown disqualifier call drops that contract rather than passing it through', async () => {
  const throwing = async (op) => {
    if (op.notice_id === 'B') throw new Error('api timeout');
    return { disqualified: false, reason: 'fits' };
  };
  const { chosen, stats } = await curateForBuyer(
    rows().filter((r) => ['A', 'B'].includes(r.notice_id)),
    BUYER,
    { disqualify: throwing, writeWhyLine: fakeWhyLine },
    { now: NOW, n: 5 },
  );
  assert.equal(stats.disqualifiedByAI, 1);
  assert.deepEqual(chosen.map((c) => c.notice_id), ['A']);
});
