import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CURRENT_CTC_SET_ASIDES,
  getCanonicalIndustry,
  getCanonicalSubIndustry,
  getNaicsReferenceStatus,
  getSubIndustryGuidance,
  listCanonicalIndustries,
  listSubIndustriesForIndustry,
  loadPlaybook,
  normalizeDiscoveryProfile,
  validateCandidateEvidence,
  validateNaicsMappings,
  validateNormalizedDiscoveryProfile,
  validatePlaybookDataset,
} from '../lib/playbook/index.js';

const SOURCE = JSON.parse(readFileSync('lib/playbook/war_dogs_playbook_source.json', 'utf8'));

test('playbook dataset has exactly 13 canonical industries', () => {
  const result = validatePlaybookDataset(SOURCE);
  assert.equal(result.ok, true);
  assert.equal(result.counts.industries, 13);
});

test('playbook dataset has exactly 130 unique sub-industries', () => {
  const result = validatePlaybookDataset(SOURCE);
  assert.equal(result.ok, true);
  assert.equal(result.counts.subindustries, 130);
  assert.equal(result.counts.uniqueSubindustries, 130);
});

test('every canonical sub-industry has description and broker guidance', () => {
  const playbook = loadPlaybook({ dataset: SOURCE });
  for (const industry of playbook.industries) {
    for (const subindustry of industry.subindustries) {
      assert.ok(subindustry.description, `${subindustry.name} missing description`);
      assert.ok(subindustry.broker_guidance, `${subindustry.name} missing broker guidance`);
    }
  }
});

test('duplicate Notion export artifacts are absent', () => {
  const result = validatePlaybookDataset(SOURCE);
  assert.equal(result.ok, true);
  for (const industry of SOURCE.industries) {
    assert.doesNotMatch(industry.name, /^(New Industry|Untitled)$/i);
    assert.doesNotMatch(industry.source_file || '', /Industries \(1\)/);
    for (const subindustry of industry.subindustries) {
      assert.doesNotMatch(subindustry.name, /^(New Industry|Untitled)$/i);
      assert.doesNotMatch(subindustry.source_file || '', /Industries \(1\)/);
    }
  }
});

test('invalid dataset records fail validation with the exact record path', () => {
  const broken = structuredClone(SOURCE);
  broken.industries[0].subindustries[0].broker_guidance = '';
  const result = validatePlaybookDataset(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === '$.industries[0].subindustries[0].broker_guidance'));
});

test('canonical industry lookup works', () => {
  const industry = getCanonicalIndustry('Operations & Facilities Support');
  assert.equal(industry.name, 'Operations & Facilities Support');
  assert.equal(listCanonicalIndustries().length, 13);
});

test('canonical sub-industry lookup works and exposes source guidance', () => {
  const subindustry = getCanonicalSubIndustry('Janitorial & Cleaning Services');
  assert.equal(subindustry.industry, 'Operations & Facilities Support');
  const subs = listSubIndustriesForIndustry('Operations & Facilities Support');
  assert.ok(subs.some((s) => s.name === 'Janitorial & Cleaning Services'));
  const guidance = getSubIndustryGuidance('Janitorial & Cleaning Services');
  assert.equal(guidance.subindustry, 'Janitorial & Cleaning Services');
  assert.ok(guidance.description);
  assert.ok(guidance.broker_guidance);
  assert.ok(guidance.primary_award_method);
});

test('current v1 Discovery payload normalizes without throwing', () => {
  const profile = normalizeDiscoveryProfile({
    background: 'Commercial cleaning operations.',
    interests: 'Recurring facility work.',
    state: 'ga',
    setAsides: ['sb'],
  });
  assert.equal(profile.capabilities_text, 'Commercial cleaning operations.');
  assert.equal(profile.interests, 'Recurring facility work.');
  assert.equal(profile.geography_mode, 'single_state');
  assert.equal(profile.state, 'GA');
  assert.deepEqual(profile.set_asides, ['sb']);
  assert.equal(validateNormalizedDiscoveryProfile(profile).ok, true);
});

test('missing and unknown qualifications remain unknown', () => {
  const profile = normalizeDiscoveryProfile({
    background: 'I can source vendors.',
    qualification_categories: ['not-a-real-category'],
  });
  assert.deepEqual(profile.qualification_categories, []);
  assert.equal(profile.fulfillment_model, 'unknown');
  assert.equal(profile.opportunity_type, 'unknown');
  assert.equal(profile.operating_model, 'unknown');
});

test('set-aside values remain compatible with current CTC values', () => {
  const profile = normalizeDiscoveryProfile({
    setAsides: [...CURRENT_CTC_SET_ASIDES, 'made-up'],
  });
  assert.deepEqual(profile.set_asides, CURRENT_CTC_SET_ASIDES);
});

test('normalized geography preserves blank/nationwide versus explicit state distinctions', () => {
  const blank = normalizeDiscoveryProfile({ state: '' });
  assert.equal(blank.geography_mode, 'nationwide');
  assert.equal(blank.state, '');

  const explicit = normalizeDiscoveryProfile({ state: 'ga' });
  assert.equal(explicit.geography_mode, 'single_state');
  assert.equal(explicit.state, 'GA');
});

test('candidate evidence schema rejects unsupported enum values', () => {
  const valid = {
    industry: 'Operations & Facilities Support',
    subindustry: 'Janitorial & Cleaning Services',
    compatibility: 'needs_validation',
    capability_fit: 'unknown',
    fulfillment_fit: 'unknown',
    qualification_fit: 'unknown',
    geography_fit: 'unknown',
    operating_model_fit: 'unknown',
    market_competition: 'high',
    positive_signals: [],
    risks: [],
    validation_questions: [],
  };
  assert.equal(validateCandidateEvidence(valid).ok, true);
  assert.equal(validateCandidateEvidence({ ...valid, compatibility: 'great_fit' }).ok, false);
});

test('NAICS reference plug-in point reports authoritative local reference installed', () => {
  const status = getNaicsReferenceStatus();
  assert.equal(status.classification, 'AUTHORITATIVE_REFERENCE_ALREADY_EXISTS');
  assert.equal(status.installed, true);
  assert.equal(validateNaicsMappings(['561720']).ok, true);
});
