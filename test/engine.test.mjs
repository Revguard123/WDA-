// Unit tests for the Slice 1 engine, run against the fixture with a mock SAM
// fetch (no network, no keys). Run: `npm test` or `node --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runEngineForNiche } from '../lib/sam/engine.js';
import { inMemoryUpsert } from '../lib/opportunities.js';
import {
  buyerQualifiesForSetAside,
  isFullAndOpen,
  SAM_TO_INTERNAL,
} from '../lib/sam/setAsides.js';
import { formatSamDate, buildSearchParams } from '../lib/sam/client.js';
import { FIXED_NOW, SAMPLE_RECORDS, makeMockSamFetch } from './fixtures/sam561720.mjs';

const NICHE = { naics: ['561720'], set_asides: ['sdvosb'], state: 'SC' };

async function runFixture(extra = {}) {
  const sink = [];
  const result = await runEngineForNiche(NICHE, {
    apiKey: 'test-key',
    fetchImpl: makeMockSamFetch(),
    upsert: inMemoryUpsert(sink),
    now: FIXED_NOW,
    minRunwayDays: 14,
    ...extra,
  });
  return { ...result, sink };
}

test('engine keeps only pursuable, in-window contracts for the SDVOSB/SC niche', async () => {
  const { rows, stats } = await runFixture();
  const keptIds = rows.map((r) => r.notice_id).sort();
  // N-0002 (full-and-open) and N-0007 (amended repost of SP-JAN-001) survive.
  assert.deepEqual(keptIds, ['N-0002', 'N-0007']);
  assert.equal(stats.kept, 2);
});

test('amended repost dedupe keeps the later-posted notice, drops the original', async () => {
  const { rows } = await runFixture();
  const ids = rows.map((r) => r.notice_id);
  assert.ok(ids.includes('N-0007'), 'keeps amended N-0007');
  assert.ok(!ids.includes('N-0001'), 'drops superseded N-0001');
});

test('sources-sought notices are never pulled (query-layer exclusion)', async () => {
  const { rows } = await runFixture();
  assert.ok(!rows.some((r) => r.notice_id === 'N-0008'));
});

test('each filter drops the expected record', async () => {
  const { stats } = await runFixture();
  assert.equal(stats.droppedClosed, 1, 'N-0005 closed');
  assert.equal(stats.droppedTightRunway, 1, 'N-0004 tight runway');
  assert.equal(stats.droppedSetAside, 1, 'N-0003 WOSB');
  assert.equal(stats.droppedGeography, 1, 'N-0006 NC');
});

test('relaxing set-aside enforcement keeps the WOSB record too', async () => {
  const { rows } = await runFixture({ enforceSetAside: false });
  assert.ok(rows.some((r) => r.notice_id === 'N-0003'), 'WOSB kept when not enforced');
});

test('kept rows are mapped into the opportunities shape', async () => {
  const { rows } = await runFixture();
  const foAndO = rows.find((r) => r.notice_id === 'N-0002');
  assert.equal(foAndO.title, 'Custodial Services, VA Clinic');
  assert.equal(foAndO.naics, '561720');
  assert.equal(foAndO.agency, 'VETERANS AFFAIRS, DEPARTMENT OF / VHA');
  assert.equal(foAndO.place_of_perf, 'Charleston, South Carolina');
  assert.equal(foAndO.sam_url, 'https://sam.gov/opp/N-0002/view');
  assert.ok(foAndO.response_deadline.startsWith('2026-08-29'));
  assert.equal(typeof foAndO.description, 'string');
  assert.ok(foAndO.raw, 'raw record preserved');
});

test('upsert receives exactly the kept rows', async () => {
  const { sink, stats } = await runFixture();
  assert.equal(sink.length, 2);
  assert.equal(stats.upserted, 2);
});

test('set-aside eligibility logic', () => {
  assert.equal(isFullAndOpen(''), true);
  assert.equal(isFullAndOpen(null), true);
  assert.equal(buyerQualifiesForSetAside('', ['sdvosb']), true, 'full-and-open always ok');
  assert.equal(buyerQualifiesForSetAside('SDVOSBC', ['sdvosb']), true);
  assert.equal(buyerQualifiesForSetAside('SDVOSBS', ['sdvosb']), true, 'sole-source variant');
  assert.equal(buyerQualifiesForSetAside('WOSB', ['sdvosb']), false);
  assert.equal(buyerQualifiesForSetAside('8A', ['8a', 'sdvosb']), true);
  assert.equal(buyerQualifiesForSetAside('ZZZ-UNKNOWN', ['sdvosb']), false, 'unknown code excluded');
  assert.equal(SAM_TO_INTERNAL.HZC, 'hubzone');
});

test('SAM date formatting is MM/dd/yyyy in UTC', () => {
  assert.equal(formatSamDate(new Date('2026-07-15T00:00:00Z')), '07/15/2026');
  assert.equal(formatSamDate(new Date('2026-01-03T23:59:59Z')), '01/03/2026');
});

test('buildSearchParams requires key and dates, clamps limit to 1000', () => {
  assert.throws(() => buildSearchParams({ postedFrom: 'x', postedTo: 'y' }), /api_key/);
  assert.throws(() => buildSearchParams({ apiKey: 'k' }), /postedFrom/);
  const p = buildSearchParams({
    apiKey: 'k',
    postedFrom: '01/01/2026',
    postedTo: '12/31/2026',
    limit: 5000,
    ptype: ['o', 'k'],
    naicsCode: '561720',
    state: 'SC',
  });
  assert.equal(p.get('limit'), '1000');
  assert.equal(p.get('ptype'), 'o,k');
  assert.equal(p.get('naicsCode'), '561720');
  assert.equal(p.get('state'), 'SC');
  assert.equal(p.get('api_key'), 'k');
});
