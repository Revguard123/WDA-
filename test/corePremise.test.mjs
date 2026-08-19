import test from 'node:test';
import assert from 'node:assert/strict';

import { assessCorePremise, CORE_PREMISE_RUBRIC } from '../lib/rubric/corePremise.js';

const NOW = new Date('2026-08-19T00:00:00Z');
const future = (days) => new Date(NOW.getTime() + days * 86400000).toISOString();
const buyer = {
  naics: ['561720'],
  keywords: ['janitorial', 'cleaning'],
  set_asides: ['sb'],
  state: 'GA',
};

function op(overrides = {}) {
  return {
    notice_id: 'N1',
    title: 'Janitorial services',
    description: 'Recurring janitorial services with option years.',
    naics: '561720',
    set_aside_type: 'SBA',
    response_deadline: future(30),
    est_value: 75000,
    ...overrides,
  };
}

test('core premise rubric is explicit and traceable to implementation categories', () => {
  assert.ok(CORE_PREMISE_RUBRIC.hard_disqualifiers.includes('set_aside_mismatch'));
  assert.ok(CORE_PREMISE_RUBRIC.positive_signals.includes('complexity_advantage'));
  assert.ok(CORE_PREMISE_RUBRIC.risk_signals.includes('qa_deadline_passed'));
});

test('expired response deadline is a hard failure', () => {
  const assessment = assessCorePremise(op({ response_deadline: future(-1) }), buyer, { now: NOW });
  assert.equal(assessment.eligibility.status, 'rejected');
  assert.ok(assessment.eligibility.hard_failures.some((f) => f.id === 'expired_response_deadline'));
});

test('set-aside mismatch is a hard failure but matching set-aside is a positive', () => {
  assert.ok(assessCorePremise(op({ set_aside_type: 'WOSB' }), buyer, { now: NOW }).eligibility.hard_failures.some((f) => f.id === 'set_aside_mismatch'));
  assert.ok(assessCorePremise(op(), buyer, { now: NOW }).positive_signals.some((s) => s.id === 'matching_set_aside'));
});

test('unknown license is validation, confirmed license is moat, known missing license rejects', () => {
  const licensed = op({ description: 'Contractor must hold a required cleaning license.' });
  assert.ok(assessCorePremise(licensed, buyer, { now: NOW }).risk_signals.some((s) => s.id === 'unknown_mandatory_qualification'));
  assert.ok(assessCorePremise(licensed, { ...buyer, qualification_notes: 'licensed cleaning contractor' }, { now: NOW }).positive_signals.some((s) => s.id === 'licensing_moat'));
  assert.ok(assessCorePremise(licensed, { ...buyer, missing_qualifications: ['license'] }, { now: NOW }).eligibility.hard_failures.some((f) => f.id === 'known_mandatory_license_mismatch'));
});

test('mandatory site visit already passed is hard failure and Q&A passed is a risk', () => {
  assert.ok(assessCorePremise(op({ description: 'Mandatory site visit required and has passed.' }), buyer, { now: NOW }).eligibility.hard_failures.some((f) => f.id === 'mandatory_step_missed'));
  assert.ok(assessCorePremise(op({ description: 'Q&A deadline has passed. Recurring janitorial services.' }), buyer, { now: NOW }).risk_signals.some((s) => s.id === 'qa_deadline_passed'));
});

test('past performance nuance accepts commercial/subcontractor paths and flags unclear substitution', () => {
  assert.ok(assessCorePremise(op({ description: 'Past performance questionnaire may include commercial or subcontractor experience.' }), buyer, { now: NOW }).positive_signals.some((s) => s.id === 'relevant_experience'));
  assert.ok(assessCorePremise(op({ description: 'Past performance required.' }), { ...buyer, experience: 'brand new' }, { now: NOW }).risk_signals.some((s) => s.id === 'unclear_past_performance_substitution'));
});

test('standalone IDIQ is not rejected but vehicle-gated IDIQ is rejected', () => {
  assert.equal(assessCorePremise(op({ description: 'Standalone IDIQ for cleaning task orders.' }), buyer, { now: NOW }).eligibility.status, 'eligible');
  assert.ok(assessCorePremise(op({ description: 'Only existing IDIQ holders may bid under this vehicle.' }), buyer, { now: NOW }).eligibility.hard_failures.some((f) => f.id === 'vehicle_gated'));
});

test('positive and risk course signals are detected from supported facts', () => {
  const assessment = assessCorePremise(op({ description: 'LPTA award with multiple line items, wage determination, Buy American, and complex recurring work.' }), { ...buyer, keywords: ['product sourcing'], opportunity_type: 'products', experience: 'brand new' }, { now: NOW });
  assert.ok(assessment.positive_signals.some((s) => s.id === 'lpta_fit'));
  assert.ok(assessment.positive_signals.some((s) => s.id === 'broker_friendly'));
  assert.ok(assessment.positive_signals.some((s) => s.id === 'past_performance_builder'));
  assert.ok(assessment.positive_signals.some((s) => s.id === 'complexity_advantage'));
  assert.ok(assessment.risk_signals.some((s) => s.id === 'service_labor_standards'));
  assert.ok(assessment.risk_signals.some((s) => s.id === 'buy_american'));
});
