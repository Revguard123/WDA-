// Unit tests for Slice 2 keyword matching. Uses opportunity titles modeled on
// real SAM.gov results (including the two off-target survivors from the Slice 1
// live proof) to prove the matcher separates on-target work from NAICS noise.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreKeywords, matchStrength, normalizeText } from '../lib/match/keywords.js';

const BUYER = {
  naics: ['561720'],
  keywords: ['janitorial', 'custodial', 'cleaning', 'day porter', 'facility maintenance'],
};

test('phrase matching is word-boundary, not substring', () => {
  const t = normalizeText('We provide day-porter and janitorial services.');
  assert.equal(t, ' we provide day porter and janitorial services ');
  // "art" must not match inside "start"
  const s = scoreKeywords({ title: 'Startup support', description: '' }, ['art']);
  assert.equal(s.matched.length, 0);
});

test('title hits weigh more than body hits', () => {
  const titleHit = scoreKeywords({ title: 'Janitorial Services', description: '' }, ['janitorial']);
  const bodyHit = scoreKeywords({ title: 'Base Support', description: 'janitorial work' }, ['janitorial']);
  assert.equal(titleHit.weighted, 2);
  assert.equal(bodyHit.weighted, 1);
});

test('plural/singular tolerance', () => {
  const s = scoreKeywords({ title: 'Custodial and cleaning services', description: '' }, ['service', 'cleaning']);
  assert.ok(s.matched.includes('service'), 'service matches services');
  assert.ok(s.matched.includes('cleaning'));
});

test('multi-word phrase matches only when contiguous', () => {
  const hit = scoreKeywords({ title: 'Facility maintenance contract', description: '' }, ['facility maintenance']);
  const miss = scoreKeywords({ title: 'Facility and grounds maintenance', description: '' }, ['facility maintenance']);
  assert.equal(hit.matched.length, 1);
  assert.equal(miss.matched.length, 0);
});

test('on-target janitorial solicitation scores near 1.0', () => {
  const op = { naics: '561720', title: 'Custodial Services, VA Clinic', description: 'Day porter and janitorial services.' };
  const m = matchStrength(op, BUYER);
  assert.ok(m.score >= 0.9, `expected high score, got ${m.score}`);
  assert.equal(m.naicsExact, 1);
});

test('off-target NAICS-noise contract scores low (NAICS floor only)', () => {
  // The real Slice 1 survivors: right NAICS tag, no janitorial keywords.
  const construction = { naics: '561720', title: 'JB Charleston Multiple Award Construction Contract', description: '' };
  const engineering = { naics: '561720', title: 'NIWC-Atlantic CCOP Engineering Support and Technical Support', description: '' };
  const c = matchStrength(construction, BUYER);
  const e = matchStrength(engineering, BUYER);
  assert.ok(c.score <= 0.4 && c.score > 0, `construction should be low, got ${c.score}`);
  assert.ok(e.score <= 0.4 && e.score > 0, `engineering should be low, got ${e.score}`);
});

test('on-target ranks strictly above NAICS-noise', () => {
  const onTarget = matchStrength(
    { naics: '561720', title: 'Janitorial Services, Federal Building', description: '' },
    BUYER,
  );
  const noise = matchStrength(
    { naics: '561720', title: 'Multiple Award Construction Contract', description: '' },
    BUYER,
  );
  assert.ok(onTarget.score > noise.score);
});

test('no keywords falls back to NAICS tag', () => {
  const m = matchStrength({ naics: '561720', title: 'Anything' }, { naics: ['561720'], keywords: [] });
  assert.equal(m.score, 1);
  const off = matchStrength({ naics: '238220', title: 'Anything' }, { naics: ['561720'], keywords: [] });
  assert.equal(off.score, 0);
});
