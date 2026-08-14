import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNaicsReferenceStatus,
  getOfficialNaics2022,
  getOfficialNaicsTitle,
  isOfficialNaics2022,
  listOfficialNaics2022,
  loadNaics2022Reference,
  loadPlaybook,
  loadSubindustryNaicsMap,
  validateNaicsMappings,
  validateSubindustryNaicsMap,
} from '../lib/playbook/index.js';

test('official NAICS reference loads', () => {
  const ref = loadNaics2022Reference();
  assert.equal(ref.metadata.classification_year, 2022);
  assert.equal(ref.metadata.sheet, '6-Digit Industries');
  assert.ok(ref.records['561720']);
});

test('reference contains expected large population of six-digit industries', () => {
  assert.ok(listOfficialNaics2022().length > 1000);
  assert.equal(loadNaics2022Reference().metadata.record_count, listOfficialNaics2022().length);
});

test('all reference codes are exactly six digits and unique', () => {
  const codes = listOfficialNaics2022().map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^\d{6}$/);
});

test('official title lookup works', () => {
  assert.equal(getOfficialNaicsTitle('561720'), 'Janitorial Services');
  assert.equal(getOfficialNaics2022('561720').source, 'U.S. Census Bureau 2022 NAICS');
});

test('valid official code passes', () => {
  assert.equal(isOfficialNaics2022('561720'), true);
  assert.equal(validateNaicsMappings(['561720']).records[0].title, 'Janitorial Services');
});

test('fabricated six-digit code fails', () => {
  assert.equal(isOfficialNaics2022('999999'), false);
  assert.equal(validateNaicsMappings(['999999']).ok, false);
});

test('invalid-shaped code fails', () => {
  assert.equal(isOfficialNaics2022('abc'), false);
  assert.equal(validateNaicsMappings(['abc']).ok, false);
});

test('all 130 War Dogs sub-industries have one mapping record and no extras', () => {
  const result = validateSubindustryNaicsMap(loadPlaybook());
  assert.equal(result.ok, true);
  assert.equal(result.mappings.length, 130);
});

test('every mapped code exists in official reference and max 5 codes per mapping', () => {
  const { mappings } = loadSubindustryNaicsMap();
  for (const mapping of mappings) {
    assert.ok(mapping.codes.length <= 5, mapping.subindustry_name);
    for (const code of mapping.codes) assert.equal(isOfficialNaics2022(code), true, `${mapping.subindustry_name} ${code}`);
  }
});

test('mapping titles resolve from authoritative reference', () => {
  const { mappings } = loadSubindustryNaicsMap();
  for (const mapping of mappings) {
    assert.deepEqual(mapping.official_titles, mapping.codes.map(getOfficialNaicsTitle));
    assert.deepEqual(mapping.candidate_titles || [], (mapping.candidate_codes || []).map(getOfficialNaicsTitle));
  }
});

test('not-production-safe mappings can exist without canonical codes', () => {
  const unsafe = loadSubindustryNaicsMap().mappings.filter((m) => !m.production_safe);
  assert.ok(unsafe.length >= 1);
  for (const mapping of unsafe) assert.deepEqual(mapping.codes, []);
});

test('mapping type enum is validated', () => {
  const result = validateSubindustryNaicsMap(loadPlaybook());
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.counts), ['direct', 'multi_code', 'context_dependent', 'needs_review']);
});

test('direct mappings have at least one official code', () => {
  const direct = loadSubindustryNaicsMap().mappings.filter((m) => m.mapping_type === 'direct');
  assert.ok(direct.length > 0);
  for (const mapping of direct) assert.ok(mapping.codes.length >= 1, mapping.subindustry_name);
});

test('context-dependent mappings expose candidate codes and/or required context', () => {
  const context = loadSubindustryNaicsMap().mappings.filter((m) => m.mapping_type === 'context_dependent');
  assert.ok(context.length > 0);
  for (const mapping of context) {
    assert.ok(mapping.candidate_codes.length > 0 || mapping.required_context.length > 0, mapping.subindustry_name);
  }
});

test('C1.1 corrected primary mappings are production-safe where decided', () => {
  const byName = Object.fromEntries(loadSubindustryNaicsMap().mappings.map((m) => [m.subindustry_name, m]));
  assert.deepEqual(byName['Carpentry & Woodworking'].codes, ['238350']);
  assert.deepEqual(byName['Carpentry & Woodworking'].candidate_codes, ['321911']);
  assert.equal(byName['Carpentry & Woodworking'].production_safe, true);
  assert.deepEqual(byName['Medical Staffing & Temporary Health Personnel'].codes, ['561320']);
  assert.equal(byName['Medical Staffing & Temporary Health Personnel'].production_safe, true);
  assert.deepEqual(byName['K9 Units & Security Dogs'].codes, ['561612']);
  assert.equal(byName['K9 Units & Security Dogs'].production_safe, true);
});

test('C1.1 corrected context-dependent mappings keep candidates non-canonical', () => {
  const byName = Object.fromEntries(loadSubindustryNaicsMap().mappings.map((m) => [m.subindustry_name, m]));
  assert.deepEqual(byName['Water Treatment & Wastewater Management'].codes, []);
  assert.deepEqual(byName['Water Treatment & Wastewater Management'].candidate_codes, ['221310', '221320', '237110']);
  assert.deepEqual(byName['Solar & Renewable Energy Services'].candidate_codes, ['221114', '221115', '238210', '541690']);
  assert.equal(byName['Air & Maritime Logistics'].mapping_type, 'context_dependent');
  assert.equal(byName['Air & Maritime Logistics'].candidate_codes.includes('488510'), true);
  assert.equal(byName['Firearms & Ammunition Supply'].mapping_type, 'context_dependent');
  assert.deepEqual(byName['Firearms & Ammunition Supply'].codes, []);
});

test('C1.1 corrected needs-review mappings are not production-safe', () => {
  const byName = Object.fromEntries(loadSubindustryNaicsMap().mappings.map((m) => [m.subindustry_name, m]));
  for (const name of ['Bulletproof Vests', 'Riot Gear & Protective Apparel', 'Mobile Medical Units', 'Dispute Resolution & Mediation']) {
    assert.equal(byName[name].mapping_type, 'needs_review');
    assert.equal(byName[name].production_safe, false);
    assert.deepEqual(byName[name].codes, []);
    assert.ok(byName[name].candidate_codes.length >= 1);
  }
  assert.deepEqual(byName['Fire Safety Services (Inspection, Safety Equipment)'].codes, []);
  assert.deepEqual(byName['Fire Safety Services (Inspection, Safety Equipment)'].candidate_codes, ['541350']);
  assert.equal(byName['Fire Safety Services (Inspection, Safety Equipment)'].candidate_codes.includes('423450'), false);
});

test('no mapping is marked human-reviewed or client-approved', () => {
  const forbidden = /human[_ -]?reviewed|client[_ -]?approved|expert[_ -]?verified|war dogs[_ -]?approved/i;
  for (const mapping of loadSubindustryNaicsMap().mappings) {
    assert.equal(mapping.review_status, 'machine_proposed');
    assert.doesNotMatch(mapping.review_status, forbidden);
  }
});

test('existing live Discovery behavior remains unchanged at the API boundary', async () => {
  const route = await import('../app/api/discover/[token]/route.js');
  assert.equal(typeof route.POST, 'function');
});

test('NAICS reference status reports installed authoritative reference', () => {
  const status = getNaicsReferenceStatus();
  assert.equal(status.classification, 'AUTHORITATIVE_REFERENCE_ALREADY_EXISTS');
  assert.equal(status.installed, true);
  assert.equal(status.metadata.record_count, 1012);
});
