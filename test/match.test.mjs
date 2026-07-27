// Unit tests for Slice 2 hard filters and ranking. Deterministic, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyHardFilters } from '../lib/match/filters.js';
import { rankTopN, scoreContract } from '../lib/match/ranking.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(NOW.getTime() + days * DAY).toISOString();
const pop = (code) => ({ placeOfPerformance: { state: { code } } });

const BUYER = {
  naics: ['561720'],
  keywords: ['janitorial', 'custodial', 'cleaning', 'day porter'],
  set_asides: ['sdvosb'],
  state: 'SC',
  size_min: 10_000,
  size_max: 5_000_000,
};

test('hard filters keep only pursuable rows and account for every drop', () => {
  const rows = [
    { notice_id: 'N1', set_aside_type: 'SDVOSBC', response_deadline: at(30), est_value: 200_000, raw: pop('SC'), title: 'Janitorial Services' },
    { notice_id: 'N2', set_aside_type: 'WOSB', response_deadline: at(30), est_value: null, raw: pop('SC'), title: 'x' },
    { notice_id: 'N3', set_aside_type: '', response_deadline: at(30), est_value: null, raw: pop('SC'), title: 'Custodial' },
    { notice_id: 'N4', set_aside_type: 'SDVOSBC', response_deadline: at(5), est_value: null, raw: pop('SC'), title: 'x' },
    { notice_id: 'N5', set_aside_type: 'SDVOSBC', response_deadline: at(30), est_value: null, raw: pop('NC'), title: 'x' },
    { notice_id: 'N6', set_aside_type: 'SDVOSBC', response_deadline: at(30), est_value: null, raw: pop('SC'), title: 'x' },
    { notice_id: 'N7', set_aside_type: 'SDVOSBC', response_deadline: at(30), est_value: 50_000_000, raw: pop('SC'), title: 'x' },
    { notice_id: 'N8', set_aside_type: 'SDVOSBC', response_deadline: at(30), est_value: null, raw: pop('SC'), title: 'Cleaning' },
  ];
  const { survivors, stats } = applyHardFilters(rows, BUYER, {
    now: NOW,
    minRunwayDays: 14,
    deliveredNoticeIds: new Set(['N6']),
  });
  assert.deepEqual(survivors.map((r) => r.notice_id).sort(), ['N1', 'N3', 'N8']);
  assert.equal(stats.droppedSetAside, 1); // N2
  assert.equal(stats.droppedTightRunway, 1); // N4
  assert.equal(stats.droppedGeography, 1); // N5
  assert.equal(stats.droppedRepeat, 1); // N6
  assert.equal(stats.droppedSizeBand, 1); // N7
  assert.equal(stats.survivors, 3);
});

test('null est_value passes the size band through to the AI step', () => {
  const rows = [{ notice_id: 'X', set_aside_type: 'SDVOSBC', response_deadline: at(30), est_value: null, raw: pop('SC'), title: 'Janitorial' }];
  const { survivors } = applyHardFilters(rows, BUYER, { now: NOW });
  assert.equal(survivors.length, 1);
});

test('ranking floats the on-target, sweet-spot contract to the top', () => {
  const rows = [
    { notice_id: 'onTarget', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial Services, Federal Building', description: '', response_deadline: at(30) },
    { notice_id: 'noise', naics: '561720', set_aside_type: '', title: 'Multiple Award Construction Contract', description: '', response_deadline: at(30) },
    { notice_id: 'distant', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial Services', description: '', response_deadline: at(200) },
  ];
  const { top } = rankTopN(rows, BUYER, { now: NOW, n: 5 });
  assert.equal(top[0].notice_id, 'onTarget');
  // on-target beats the NAICS-noise construction contract
  const noise = top.find((t) => t.notice_id === 'noise');
  const onTarget = top.find((t) => t.notice_id === 'onTarget');
  assert.ok(onTarget.score > noise.score);
  // distant janitorial is downranked below the sweet-spot janitorial
  const distant = top.find((t) => t.notice_id === 'distant');
  assert.ok(onTarget.score > distant.score);
});

test('runway sweet spot (21-45 days) scores above tight and distant', () => {
  const base = { naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial', description: '' };
  const sweet = scoreContract({ ...base, notice_id: 's', response_deadline: at(30) }, BUYER, { now: NOW });
  const distant = scoreContract({ ...base, notice_id: 'd', response_deadline: at(150) }, BUYER, { now: NOW });
  assert.ok(sweet.components.runway === 1.0);
  assert.ok(sweet.components.runway > distant.components.runway);
});

test('rankTopN caps at N and reports shortfall', () => {
  const rows = [
    { notice_id: 'a', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial', response_deadline: at(30) },
    { notice_id: 'b', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Custodial', response_deadline: at(30) },
  ];
  const { top, shortfall } = rankTopN(rows, BUYER, { now: NOW, n: 5 });
  assert.equal(top.length, 2);
  assert.equal(shortfall, 3); // only 2 survived, wanted 5
});

test('exact set-aside outranks full-and-open, all else equal', () => {
  const setAside = scoreContract({ notice_id: 'sa', naics: '561720', set_aside_type: 'SDVOSBC', title: 'Janitorial', response_deadline: at(30) }, BUYER, { now: NOW });
  const openC = scoreContract({ notice_id: 'fo', naics: '561720', set_aside_type: '', title: 'Janitorial', response_deadline: at(30) }, BUYER, { now: NOW });
  assert.ok(setAside.components.setAsideFit > openC.components.setAsideFit);
  assert.ok(setAside.score > openC.score);
});
