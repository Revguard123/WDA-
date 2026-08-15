import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyHardFilters } from '../lib/match/filters.js';
import { geographyEligibility } from '../lib/sam/geography.js';
import { runEngineForNiche } from '../lib/sam/engine.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const deadline = '2026-08-15T17:00:00.000Z';
const buyer = { state: 'GA', set_asides: ['sb'], size_min: null, size_max: null };
const pop = (code) => ({ placeOfPerformance: { state: { code } } });
const row = (notice_id, code, extra = {}) => ({
  notice_id,
  solicitation_num: notice_id,
  set_aside_type: 'SBA',
  response_deadline: deadline,
  est_value: null,
  raw: code ? pop(code) : {},
  title: 'Janitorial services',
  description: 'janitorial cleaning',
  ...extra,
});

test('GA-targeted buyer plus GA place of performance is eligible', () => {
  const { survivors, stats } = applyHardFilters([row('GA1', 'GA')], buyer, { now: NOW });
  assert.deepEqual(survivors.map((r) => r.notice_id), ['GA1']);
  assert.equal(stats.droppedGeography, 0);
});

test('GA-targeted buyer plus SD place of performance is excluded', () => {
  const { survivors, stats } = applyHardFilters([row('SD1', 'SD')], buyer, { now: NOW });
  assert.equal(survivors.length, 0);
  assert.equal(stats.droppedGeography, 1);
});

test('GA-targeted buyer plus AL place of performance is excluded', () => {
  const { survivors, stats } = applyHardFilters([row('AL1', 'AL')], buyer, { now: NOW });
  assert.equal(survivors.length, 0);
  assert.equal(stats.droppedGeography, 1);
});

test('blank buyer.state does not restrict geography', () => {
  const { survivors } = applyHardFilters([row('SD1', 'SD'), row('AL1', 'AL')], { ...buyer, state: '' }, { now: NOW });
  assert.deepEqual(survivors.map((r) => r.notice_id).sort(), ['AL1', 'SD1']);
});

test('unknown opportunity geography is handled conservatively for a state-targeted buyer', () => {
  const { survivors, stats } = applyHardFilters([row('UNK', null, { place_of_perf: null })], buyer, { now: NOW });
  assert.equal(survivors.length, 0);
  assert.equal(stats.droppedGeography, 1);
  assert.deepEqual(geographyEligibility(row('UNK', null, { place_of_perf: null }), 'GA'), {
    eligible: false,
    reason: 'unknown',
  });
});

test('issuing agency location is not confused with place of performance', () => {
  const agencyInGaButPopSd = row('AGENCY-GA-POP-SD', 'SD', {
    agency: 'Department Office, Atlanta, GA',
    place_of_perf: 'Rapid City, SD',
  });
  const { survivors } = applyHardFilters([agencyInGaButPopSd], buyer, { now: NOW });
  assert.equal(survivors.length, 0);
});

test('explicit nationwide place of performance can qualify for a state-targeted buyer', () => {
  const nationwide = row('US1', null, { raw: {}, place_of_perf: 'Nationwide' });
  const { survivors } = applyHardFilters([nationwide], buyer, { now: NOW });
  assert.deepEqual(survivors.map((r) => r.notice_id), ['US1']);
});

test('engine applies the same conservative geography rule before caching rows', async () => {
  const records = [
    {
      _ptype: 'o',
      noticeId: 'GA',
      solicitationNumber: 'GA',
      title: 'Janitorial Georgia',
      naicsCode: '561720',
      typeOfSetAside: 'SBA',
      placeOfPerformance: { city: { name: 'Atlanta' }, state: { code: 'GA', name: 'Georgia' } },
      responseDeadLine: deadline,
      postedDate: '2026-07-01',
      description: 'cleaning',
    },
    {
      _ptype: 'o',
      noticeId: 'SD',
      solicitationNumber: 'SD',
      title: 'Janitorial South Dakota',
      naicsCode: '561720',
      typeOfSetAside: 'SBA',
      placeOfPerformance: { city: { name: 'Rapid City' }, state: { code: 'SD', name: 'South Dakota' } },
      responseDeadLine: deadline,
      postedDate: '2026-07-01',
      description: 'cleaning',
    },
    {
      _ptype: 'o',
      noticeId: 'UNK',
      solicitationNumber: 'UNK',
      title: 'Janitorial Unknown',
      naicsCode: '561720',
      typeOfSetAside: 'SBA',
      responseDeadLine: deadline,
      postedDate: '2026-07-01',
      description: 'cleaning',
    },
  ];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const ptype = u.searchParams.get('ptype');
    const matched = records.filter((r) => r._ptype === ptype);
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ totalRecords: matched.length, opportunitiesData: matched }),
      text: async () => JSON.stringify({ totalRecords: matched.length, opportunitiesData: matched }),
    };
  };
  const { rows, stats } = await runEngineForNiche(
    { naics: ['561720'], set_asides: ['sb'], state: 'GA' },
    { apiKey: 'test', fetchImpl, now: NOW, minRunwayDays: 14, resolveDescriptions: false }
  );
  assert.deepEqual(rows.map((r) => r.notice_id), ['GA']);
  assert.equal(stats.droppedGeography, 2);
});
