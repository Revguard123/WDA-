import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { currentSetAsidesFromText, contractAmountFromText, monthlyBudgetQuestion } from '../lib/playbook/intakeEvidence.js';
import { discoveryClarificationQuestion } from '../lib/playbook/discoveryClarifications.js';
import { candidateMatchesDirection, rejectedCandidate } from '../lib/playbook/workPreferences.js';
import { getAdaptiveQuestion } from '../lib/playbook/adaptiveQuestions.js';
import { normalizeAdaptiveAnswer, resolveAdaptiveCodes } from '../lib/playbook/adaptiveResolvers.js';
import { normalizeDiscoveryAnswers, normalizeDiscoveryProfile } from '../lib/playbook/index.js';
import { ADVISOR_DIMENSIONS, advanceAdvisorConversation, fallbackAdvisorTurn } from '../lib/playbook/advisor.js';
import { buildCandidateUniverse, preselectPlaybookCandidates, recommendPlaybookNiches, resolveRecommendationForTargeting } from '../lib/playbook/recommendationEngine.js';
import { prepareDiscoverySessionSave, publicDiscoverySession, serializeDiscoverySession } from '../lib/discoverySessions.js';
import { adaptiveProgressForSubmission } from '../lib/playbook/adaptiveProgress.js';
import { normalizeCapabilityPriority } from '../lib/playbook/capabilityContext.js';
import { explicitBackgroundUpdates } from '../lib/playbook/backgroundEvidence.js';

const monthly = 'This is new to me and I am not sure yet, but an equipment rental contract of 20-30k per month could work.';
const conditional = 'Only small business, but if I bring my partner in I could add WSOB. Nothing else applies.';
const fleet = buildCandidateUniverse().find((candidate) => candidate.subindustry_name === 'Vehicle Fleet Management');
const utility = buildCandidateUniverse().find((candidate) => candidate.subindustry_name === 'Utility Vehicles & Trailers');
const fit = { overall_fit: 'strong', capability_fit: 'strong', fulfillment_fit: 'strong', qualification_fit: 'unknown', geography_fit: 'unknown', operating_model_fit: 'strong' };
const feedabilityChecker = async () => ({ status: 'unknown' });
const fixture = () => ({ status: 'in_progress', current_step: 6, updated_at: '2026-11-16T23:30:00Z',
  answers: {
    capabilities_text: 'Engine rebuilding, selling rebuilt engines, rental cars and equipment rentals.',
    fulfillment_model: 'self', opportunity_type: 'either', experience_types: ['private_commercial'],
    geography_mode: 'nationwide', operating_model: 'recurring_service',
    interests: 'Equipment rentals and product supply.', avoid: 'mechanical repair work contracts, managing external repair shops',
    set_asides: ['sb', 'wosb'], size_min: '', size_max: '',
    adaptive_answers: { maintenance_vs_management_consulting: 'I do not want to do any more hands on maintenance work.' },
    advisor_state: { complete: true, resolved_dimensions: ADVISOR_DIMENSIONS, pending_question: null, turn_count: 8,
      messages: [
        { role: 'advisor', question: { category: 'capability' } }, { role: 'student', content: 'Engine rebuilding, rental cars and equipment rentals.' },
        { role: 'advisor', question: { category: 'set_asides' } }, { role: 'student', content: conditional, question_category: 'set_asides' },
        { role: 'advisor', question: { category: 'contract_scale' } }, { role: 'student', content: monthly, question_category: 'contract_scale' },
        { role: 'advisor', content: "Got it. Let's lock down your state focus.", question: null },
      ],
    },
  },
  normalized_profile: { set_asides: ['sb', 'wosb'], size_min: null, size_max: null },
  recommendations: { status: 'needs_clarification', questions: [getAdaptiveQuestion('maintenance_vs_management_consulting')], preliminary_candidate_ids: [fleet.subindustry_id] },
});

test('an old blocked session resumes with a work-preference question, correct status evidence and preserved history without mutating the row', () => {
  const row = fixture();
  const before = structuredClone(row);
  const session = serializeDiscoverySession(row);
  assert.equal(session.recommendations.questions[0].key, 'work_direction');
  assert.ok(session.recommendations.questions[0].options.some((option) => option.value === 'rentals'));
  assert.deepEqual(session.answers.set_asides, ['sb']);
  assert.deepEqual(session.normalized_profile.set_asides, ['sb']);
  assert.equal(session.answers.contract_size_notes, monthly);
  assert.equal(session.answers.contract_size_basis, 'monthly_unconfirmed');
  assert.equal(session.updated_at, before.updated_at);
  assert.deepEqual(session.answers.advisor_state.messages, before.answers.advisor_state.messages);
  assert.deepEqual(row, before);
});

test('an earlier exhausted-loop recovery screen can also resume without resetting the conversation', () => {
  const row = fixture();
  row.recommendations = { status: 'no_recommendation', message: 'The previous clarification could not be resolved.' };
  const session = serializeDiscoverySession(row);
  assert.equal(session.recommendations.status, 'needs_clarification');
  assert.equal(session.recommendations.questions[0].key, 'work_direction');
  assert.deepEqual(session.answers.advisor_state.messages, row.answers.advisor_state.messages);
});

test('Neither is a real option and produces no guessed maintenance/consulting codes', () => {
  const question = getAdaptiveQuestion('maintenance_vs_management_consulting');
  assert.ok(question.options.some((option) => option.value === 'neither'));
  for (const answer of ['neither', 'Neither / explore another area', 'Neither of these options fits.', 'I do not want to do any more hands on maintenance work.']) {
    assert.equal(normalizeAdaptiveAnswer(question.key, answer), 'neither');
    assert.deepEqual(resolveAdaptiveCodes(fleet, { [question.key]: answer }).codes, []);
  }
});

test('declined work redirects before ranking, even if the caller resets its round counter', async () => {
  let calls = 0;
  const result = await recommendPlaybookNiches(fixture().answers, { clarificationRound: 0, ranker: async () => { calls++; throw new Error('Premature ranking'); } });
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.questions[0].key, 'work_direction');
  assert.equal(calls, 0);
});

test('explicit repair exclusions remove fleet maintenance from the candidate universe before model ranking', () => {
  const profile = normalizeDiscoveryProfile(fixture().answers);
  assert.equal(rejectedCandidate(fleet, profile), true);
  assert.equal(preselectPlaybookCandidates(profile).some((candidate) => candidate.subindustry_id === fleet.subindustry_id), false);
});

test('a rejection in student history is preserved even when an old model omitted the avoid field', () => {
  const profile = normalizeDiscoveryAnswers({ capabilities_text: 'Vehicle maintenance and equipment rentals', advisor_state: { messages: [{ role: 'student', content: 'I want to leave automotive repair behind and I do not want mechanical repair contracts.' }] } });
  assert.match(profile.avoid, /mechanical repair/);
  assert.equal(rejectedCandidate(fleet, profile), true);
});

test('choosing rentals asks for rental scope, never maintenance versus consulting', () => {
  const profile = normalizeDiscoveryAnswers({ ...fixture().answers, adaptive_answers: { work_direction: 'rentals' } });
  const question = discoveryClarificationQuestion(profile);
  assert.equal(question.key, 'rental_scope');
  assert.ok(question.options.some((option) => option.value === 'passenger_cars'));
  assert.match(question.helper, /not every passenger-car or equipment rental/);
});

test('an unsupported rental category stops honestly instead of mapping passenger cars or forklifts to fleet maintenance', async () => {
  for (const scope of ['passenger_cars', 'other_equipment', 'unknown']) {
    const result = await recommendPlaybookNiches({ ...fixture().answers, adaptive_answers: { work_direction: 'rentals', rental_scope: scope } }, { ranker: () => { throw new Error('Unsupported category must not rank'); } });
    assert.equal(result.status, 'no_recommendation');
    assert.match(result.message, /will not replace it with fleet maintenance or consulting/);
  }
});

test('product-supply direction cannot receive a fleet-maintenance candidate or unranked fallback filler', async () => {
  const profile = { ...fixture().answers, contract_size_notes: '$25k to $150k total', adaptive_answers: { work_direction: 'product_supply' } };
  const candidates = preselectPlaybookCandidates(profile);
  assert.ok(candidates.length);
  assert.ok(candidates.every((candidate) => candidate.industry_name === 'Product Supply & Procurement'));
  assert.equal(candidateMatchesDirection(fleet, normalizeDiscoveryProfile(profile)), false);
  const result = await recommendPlaybookNiches(profile, { ranker: async () => ({ recommendations: [] }), feedabilityChecker });
  assert.equal(result.status, 'no_recommendation');
});

test('a newly selected work direction overrides an old industry priority without erasing the old background', () => {
  const profile = { ...fixture().answers, contract_size_notes: '$25k total', adaptive_answers: { capability_priority: 'facilities', work_direction: 'product_supply' } };
  assert.equal(discoveryClarificationQuestion(normalizeDiscoveryAnswers(profile)), null);
  const candidates = preselectPlaybookCandidates(profile);
  assert.ok(candidates.length);
  assert.ok(candidates.every((candidate) => candidate.industry_name === 'Product Supply & Procurement'));
  assert.match(profile.capabilities_text, /Engine rebuilding/);
});

test('an unknown new area cannot silently fall back to old repair work', async () => {
  const result = await recommendPlaybookNiches({ ...fixture().answers, adaptive_answers: { work_direction: 'another_area', preferred_work: 'I am not sure yet.' } }, { ranker: () => { throw new Error('No actual work described'); } });
  assert.equal(result.status, 'no_recommendation');
  assert.match(result.message, /will not fill the shortlist with unrelated work/);
});

test('monthly amount parsing preserves shared suffixes and distinguishes monthly from total values', () => {
  assert.deepEqual(contractAmountFromText(monthly), { min: 20000, max: 30000, period: 'monthly' });
  assert.deepEqual(contractAmountFromText('$20k-$30k/month'), { min: 20000, max: 30000, period: 'monthly' });
  assert.deepEqual(contractAmountFromText('$25k to $100,000 total'), { min: 25000, max: 100000, period: 'total' });
  assert.deepEqual(contractAmountFromText('Up to $25k per month'), { min: null, max: 25000, period: 'monthly' });
  assert.equal(contractAmountFromText('7 months and 2 employees'), null);
});

test('monthly ranges are saved but never silently treated as annual or total targeting amounts', () => {
  const profile = normalizeDiscoveryAnswers({ contract_size_notes: monthly, size_min: '20000', size_max: '30000' });
  assert.equal(profile.contract_size_notes, monthly);
  assert.equal(profile.size_min, '');
  assert.equal(profile.size_max, '');
  assert.equal(profile.contract_size_basis, 'monthly_unconfirmed');
  const question = monthlyBudgetQuestion(profile);
  assert.equal(question.key, 'contract_budget_confirmation');
  assert.match(question.helper, /\$240,000 to \$360,000/);
  assert.match(question.helper, /unless you confirm/);
});

test('only an explicit twelve-month confirmation applies the annualized total', () => {
  const confirmed = normalizeDiscoveryAnswers({ contract_size_notes: monthly, adaptive_answers: { contract_budget_confirmation: 'annual_total' } });
  assert.equal(confirmed.size_min, '240000');
  assert.equal(confirmed.size_max, '360000');
  assert.equal(confirmed.contract_size_basis, 'total');
  assert.equal(monthlyBudgetQuestion(confirmed), null);
  const denied = normalizeDiscoveryAnswers({ contract_size_notes: monthly, adaptive_answers: { contract_budget_confirmation: 'Do not use the 12-month amount.' } });
  assert.equal(denied.size_max, '');
  assert.equal(denied.contract_size_basis, 'monthly_unconfirmed');
});

test('students can enter another total or explicitly leave the range open', () => {
  const different = normalizeDiscoveryAnswers({ contract_size_notes: monthly, adaptive_answers: { contract_budget_confirmation: 'enter_total', contract_budget_total: '$75k to $125k for the whole contract' } });
  assert.equal(different.size_min, '75000');
  assert.equal(different.size_max, '125000');
  assert.equal(monthlyBudgetQuestion(different), null);
  for (const answers of [{ contract_budget_confirmation: 'leave_open' }, { contract_budget_confirmation: 'enter_total', contract_budget_total: 'Not sure - leave it open' }]) {
    const open = normalizeDiscoveryAnswers({ contract_size_notes: monthly, adaptive_answers: answers });
    assert.equal(open.size_min, ''); assert.equal(open.size_max, '');
    assert.equal(open.contract_size_basis, 'unspecified');
    assert.equal(monthlyBudgetQuestion(open), null);
  }
});

test('unclear monthly answers stop after bounded attempts rather than silently widening or looping', async () => {
  const profile = { capabilities_text: 'Truck rental', contract_size_notes: monthly,
    adaptive_answers: { work_direction: 'rentals', rental_scope: 'trucks_trailers', contract_budget_confirmation: 'enter_total', contract_budget_total: '$25k monthly' },
    adaptive_attempts: { contract_budget_total: 2 } };
  const result = await recommendPlaybookNiches(profile, { ranker: () => { throw new Error('Unconfirmed budget must not rank'); } });
  assert.equal(result.status, 'no_recommendation');
  assert.match(result.message, /confirmed total contract value/);
  assert.match(result.message, /will not keep repeating/);
});

test('conditional, pending and negative specialized statuses cannot become held statuses', () => {
  for (const value of [conditional, 'Small Business, WOSB pending.', 'Small business. I am eligible for WOSB.', 'Small business. I do not hold WOSB.', 'Only Small Business. If my partner joins I could add WOSB and HUBZone.']) assert.deepEqual(currentSetAsidesFromText(value), ['sb'], value);
  assert.deepEqual(currentSetAsidesFromText('I currently hold WOSB and HUBZone.'), ['wosb', 'hubzone']);
  assert.deepEqual(currentSetAsidesFromText('None except Small Business'), ['sb']);
  assert.deepEqual(currentSetAsidesFromText('SDVOSB'), ['sdvosb']);
  for (const value of ['I never held WOSB.', 'I will get WOSB.', 'My WOSB is expired.', 'We are women-owned but have not applied for certification.', 'I start work at 8am.']) assert.deepEqual(currentSetAsidesFromText(value), [], value);
  assert.deepEqual(currentSetAsidesFromText('We are certified women-owned.'), ['wosb']);
});

test('the model cannot add a hypothetical WOSB over the deterministic current-status evidence', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: { set_asides: ['sb', 'wosb'] }, resolved_dimensions: ['set_asides'], assistant_message: 'Now contract size.', next_question: { category: 'contract_scale', prompt: 'What contract size can you handle?', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({ answers: { capabilities_text: 'IT support' }, answered_category: 'set_asides', latest_answer: conditional, client, logger: { info() {}, error() {} } });
  assert.deepEqual(result.answers.set_asides, ['sb']);
  assert.equal(result.answers.set_aside_notes, conditional);
});

test('the fallback captures a monthly example and asks for confirmation without a provider call', () => {
  const result = fallbackAdvisorTurn({ answered_category: 'contract_scale', latest_answer: monthly, answers: { capabilities_text: 'IT support' } });
  assert.equal(result.complete, false);
  assert.equal(result.next_question.category, 'contract_budget_confirmation_clarification');
  assert.equal(result.answers.size_max, '');
});

test('completion never announces a new state-focus question without a question object', async () => {
  const answers = { capabilities_text: 'IT support', size_max: '25000' };
  const resolved = ADVISOR_DIMENSIONS.filter((dimension) => dimension !== 'contract_scale');
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ADVISOR_DIMENSIONS, assistant_message: "Let's lock down your state focus.", next_question: null, complete: true }) }] }) } };
  const result = await advanceAdvisorConversation({ answers, resolved_dimensions: resolved, answered_category: 'contract_scale', latest_answer: 'Under $25k', client, logger: { info() {}, error() {} } });
  assert.equal(result.complete, true);
  assert.equal(result.next_question, null);
  assert.doesNotMatch(result.assistant_message, /state focus/);
});

test('a confirmed truck/trailer rental yields only its rental code and rental keywords, not manufacturing or repair', async () => {
  const profile = { ...fixture().answers, adaptive_answers: { work_direction: 'rentals', rental_scope: 'trucks_trailers', contract_budget_confirmation: 'annual_total' } };
  const result = await recommendPlaybookNiches(profile, { candidates: [utility, fleet], ranker: async ({ candidates }) => {
    assert.deepEqual(candidates.map((candidate) => candidate.subindustry_id), [utility.subindustry_id]);
    return { recommendations: [{ subindustry_id: utility.subindustry_id, explanation: 'Confirmed truck/trailer rental scope.', ...fit }] };
  }, feedabilityChecker });
  assert.equal(result.status, 'recommended');
  assert.deepEqual(result.recommendations[0].naics.map((item) => item.code), ['532120']);
  const targeting = resolveRecommendationForTargeting(result.recommendations[0], profile);
  assert.deepEqual(targeting.naics, ['532120']);
  assert.deepEqual(targeting.keywords, ['truck rental', 'utility trailer rental']);
  assert.deepEqual(targeting.set_asides, ['sb']);
  assert.equal(targeting.size_min, 240000);
  assert.equal(targeting.size_max, 360000);
});

test('old excluded recommendations and unconfirmed monthly budgets cannot bypass safety through selection', () => {
  assert.throws(() => resolveRecommendationForTargeting({ subindustry_id: fleet.subindustry_id, naics: [{ code: '811111' }] }, { ...fixture().answers, contract_size_notes: '$25k to $150k total' }), /conflicts/);
  assert.throws(() => resolveRecommendationForTargeting({ subindustry_id: utility.subindustry_id, naics: [{ code: '532120' }] }, { contract_size_notes: monthly }), /Confirm the total/);
});

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const filename = 'app/api/discover/[token]/route.js';
const { code } = await swc.transform(readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript' }, target: 'es2020' }, module: { type: 'commonjs' } });

function harness() {
  let row = fixture();
  const imports = {
    '../../../../lib/buyers.js': { getBuyerByToken: async () => ({ id: 'anonymous-fixture' }) },
    '../../../../lib/discoverySessions.js': { publicDiscoverySession, getDiscoverySessionForBuyer: async () => serializeDiscoverySession(row), saveDiscoverySessionForBuyer: async (buyerId, input) => { row = { ...row, ...prepareDiscoverySessionSave({ buyerId, ...input }) }; return serializeDiscoverySession(row); } },
    '../../../../lib/playbook/recommendationEngine.js': { recommendPlaybookNiches: (profile, options) => recommendPlaybookNiches(profile, { ...options, candidates: [fleet, utility], feedabilityChecker, ranker: async () => ({ recommendations: [{ subindustry_id: utility.subindustry_id, explanation: 'Confirmed rental scope.', ...fit }] }) }) },
    '../../../../lib/playbook/index.js': { normalizeDiscoveryAnswers },
    '../../../../lib/playbook/adaptiveProgress.js': { adaptiveProgressForSubmission },
    '../../../../lib/playbook/adaptiveResolvers.js': { normalizeAdaptiveAnswer },
    '../../../../lib/playbook/capabilityContext.js': { normalizeCapabilityPriority },
    '../../../../lib/playbook/backgroundEvidence.js': { explicitBackgroundUpdates },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', code)((id) => { assert.ok(id in imports, `Unexpected route dependency ${id}`); return imports[id]; }, module, module.exports, { info() {}, error() {} });
  return { get row() { return row; }, post: (key, value) => module.exports.POST(new Request('https://wda.test/api/discover/fixture', { method: 'POST', body: JSON.stringify({ answers: { ...row.answers, adaptive_answers: { ...row.answers.adaptive_answers, [key]: value } }, clarification_round: 0 }) }), { params: { token: 'fixture' } }) };
}

test('the real route resumes an old blocked session through preference, scope and budget confirmation without resetting history', async () => {
  const state = harness();
  const history = structuredClone(state.row.answers.advisor_state.messages);
  const direction = await (await state.post('work_direction', 'rentals')).json();
  assert.equal(direction.questions[0].key, 'rental_scope');
  const scope = await (await state.post('rental_scope', 'trucks_trailers')).json();
  assert.equal(scope.questions[0].key, 'contract_budget_confirmation');
  const result = await (await state.post('contract_budget_confirmation', 'annual_total')).json();
  assert.equal(result.status, 'recommended');
  assert.deepEqual(result.recommendations[0].naics.map((item) => item.code), ['532120']);
  assert.deepEqual(state.row.answers.set_asides, ['sb']);
  assert.equal(state.row.answers.size_max, '360000');
  assert.deepEqual(state.row.answers.advisor_state.messages, history);
  for (const key of ['work_direction', 'rental_scope', 'contract_budget_confirmation']) assert.equal(state.row.answers.adaptive_attempts[key], 1);
});
