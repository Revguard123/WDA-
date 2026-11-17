import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { normalizeAdaptiveAnswer, resolveAdaptiveCodes } from '../lib/playbook/adaptiveResolvers.js';
import { adaptiveProgressForSubmission } from '../lib/playbook/adaptiveProgress.js';
import { capabilityContextQuestion } from '../lib/playbook/capabilityContext.js';
import { explicitBackgroundUpdates } from '../lib/playbook/backgroundEvidence.js';
import { ADVISOR_DIMENSIONS, advanceAdvisorConversation, fallbackAdvisorTurn, recoverAdvisorState, answersFromAdvisorMessages } from '../lib/playbook/advisor.js';
import { normalizeDiscoveryAnswers, normalizeDiscoveryProfile } from '../lib/playbook/index.js';
import { buildCandidateUniverse, preselectPlaybookCandidates, recommendPlaybookNiches } from '../lib/playbook/recommendationEngine.js';
import { prepareDiscoverySessionSave, publicDiscoverySession } from '../lib/discoverySessions.js';

const mixed = {
  capabilities_text: 'We provide handyman maintenance and repairs. A team member has experience in the medical field and holds an RN license. We both have agricultural experience.',
  experience_types: ['brand_new'],
  qualification_categories: ['licenses'],
};
const history = 'We are new to federal contracting. One of us has owned and operated a handyman service for four years. The other has worked in pediatric ICU, emergency medicine and telemedicine.';
const facilityDraft = "Based on our handyman and maintenance work, I'd say we're broad facility support. We handle general upkeep and repairs across different areas rather than specializing in one equipment type.";
const universe = buildCandidateUniverse();
const facility = universe.find((candidate) => candidate.subindustry_name === 'Facilities Maintenance & Repair');
const strong = { overall_fit: 'strong', capability_fit: 'strong', fulfillment_fit: 'strong', qualification_fit: 'unknown', geography_fit: 'unknown', operating_model_fit: 'strong' };
const rankFacility = async () => ({ recommendations: [{ subindustry_id: facility.subindustry_id, explanation: 'General maintenance work.', ...strong }] });
const noProvider = { messages: { create: async () => { throw new Error('This clarification must not call a provider'); } } };
const quiet = { info() {}, error() {} };
const noFeedLookup = async () => ({ status: 'unknown' });

test('saved conversational facility answer resolves without changing allowed official codes', () => {
  assert.ok(facility);
  assert.equal(normalizeAdaptiveAnswer('facility_support_vs_equipment_repair', facilityDraft), 'facility_support');
  assert.deepEqual(resolveAdaptiveCodes(facility, { facility_support_vs_equipment_repair: facilityDraft }).codes, ['561210']);
  assert.deepEqual(resolveAdaptiveCodes(facility, { facility_support_vs_equipment_repair: 'BROAD FACILITY SUPPORT' }).codes, ['561210']);
});

test('ambiguous, negated or uncertain classification sentences do not choose industry codes', () => {
  for (const answer of ['not broad facility support', 'Maybe equipment repair', "We don't provide equipment repair", 'Broad facility support or equipment repair', 'not sure']) {
    assert.equal(resolveAdaptiveCodes(facility, { facility_support_vs_equipment_repair: answer }).resolved, false, answer);
  }
});

test('repeat submissions consume real persisted attempts even if the key or text is unchanged', () => {
  let row = { answers: {}, recommendations: { status: 'needs_clarification', questions: [{ key: 'facility_support_vs_equipment_repair' }] } };
  for (let index = 1; index <= 3; index++) {
    const result = adaptiveProgressForSubmission(row, { clarification_round: 0, answers: { adaptive_attempts: {}, adaptive_answers: { facility_support_vs_equipment_repair: 'unsure' } } });
    assert.equal(result.clarificationRound, index);
    row.answers.adaptive_attempts = result.attempts;
    row.answers.adaptive_answers = { facility_support_vs_equipment_repair: 'unsure' };
  }
});

test('legacy attempts recover safely; a retry without an answer does not consume another attempt', () => {
  const row = { answers: { adaptive_answers: { facility_support_vs_equipment_repair: facilityDraft } } };
  assert.equal(adaptiveProgressForSubmission(row, { retry: true }).clarificationRound, 1);
  row.recommendations = { status: 'needs_clarification', questions: [{ key: 'facility_support_vs_equipment_repair' }] };
  assert.equal(adaptiveProgressForSubmission(row, { answers: row.answers, retry: true }).clarificationRound, 1);
  assert.equal(adaptiveProgressForSubmission({ answers: { adaptive_attempts: { capability_priority: 2, agriculture_work: 1 } } }).clarificationRound, 0);
});

test('mixed backgrounds ask a priority question before any provider can anchor on handyman work', async () => {
  const result = await advanceAdvisorConversation({ latest_answer: mixed.capabilities_text, answered_category: 'capability', client: noProvider, logger: quiet });
  assert.equal(result.next_question.category, 'capability_priority_clarification');
  assert.deepEqual(result.next_question.options.map((option) => option.value), ['healthcare', 'facilities', 'agriculture', 'compare_all']);
  assert.match(result.next_question.helper, /no dedicated agriculture lane/i);
  assert.equal(result.answers.capabilities_text, mixed.capabilities_text);
  assert.ok(result.answers.qualification_categories.includes('healthcare_medical'));
  assert.equal(result.complete, false);
});

test('priority choice keeps other backgrounds and resumes the unresolved conversation', async () => {
  const result = await advanceAdvisorConversation({ answers: mixed, resolved_dimensions: ['capability'], latest_answer: 'Nursing / healthcare', answered_category: 'capability_priority_clarification', client: noProvider, logger: quiet });
  assert.equal(result.answers.adaptive_answers.capability_priority, 'healthcare');
  assert.equal(result.answers.capabilities_text, mixed.capabilities_text);
  assert.equal(result.next_question.category, 'opportunity_type');
  assert.equal(result.count_progress, false);
});

test('a generated priority draft may mention other backgrounds without losing its explicit selected option', async () => {
  const draft = "I'd like to start with nursing, while keeping our handyman and agricultural experience saved for later.";
  const result = await advanceAdvisorConversation({ answers: mixed, resolved_dimensions: ['capability'], latest_answer: draft, selected_option: 'healthcare', answered_category: 'capability_priority_clarification', client: noProvider, logger: quiet });
  assert.equal(result.answers.adaptive_answers.capability_priority, 'healthcare');
  assert.equal(result.answers.capabilities_text, mixed.capabilities_text);
  assert.equal(result.next_question.category, 'opportunity_type');
  const rebuilt = answersFromAdvisorMessages([
    { role: 'advisor', question: { category: 'capability' } }, { role: 'student', content: mixed.capabilities_text },
    { role: 'advisor', question: { category: 'capability_priority_clarification' } }, { role: 'student', content: draft, selected_option: 'healthcare' },
  ]);
  assert.equal(rebuilt.answers.adaptive_answers.capability_priority, 'healthcare');
});

test('two unclear priority answers compare the stated areas instead of looping indefinitely', async () => {
  const first = await advanceAdvisorConversation({ answers: mixed, resolved_dimensions: ['capability'], latest_answer: 'unsure', answered_category: 'capability_priority_clarification', client: noProvider, logger: quiet });
  const second = await advanceAdvisorConversation({ answers: first.answers, resolved_dimensions: first.resolved_dimensions, latest_answer: 'unsure', answered_category: first.next_question.category, client: noProvider, logger: quiet });
  assert.equal(second.answers.adaptive_answers.capability_priority, 'compare_all');
  assert.equal(second.next_question.category, 'agriculture_work_clarification');
  assert.notEqual(first.next_question.id, second.next_question.id);
});

test('comparing backgrounds asks what agricultural work actually means, without inventing a lane', () => {
  const result = fallbackAdvisorTurn({ answers: mixed, latest_answer: 'Compare all these areas', answered_category: 'capability_priority_clarification', resolved_dimensions: ['capability'] });
  assert.equal(result.next_question.category, 'agriculture_work_clarification');
  assert.equal(result.next_question.input_type, 'text');
  assert.match(result.next_question.helper, /no dedicated agriculture lane/);
  assert.equal(result.answers.capabilities_text, mixed.capabilities_text);
});

test('new-to-federal answer preserves commercial ownership and nursing work history', () => {
  const result = fallbackAdvisorTurn({ answers: { ...mixed, adaptive_answers: { capability_priority: 'healthcare' } }, latest_answer: history, answered_category: 'experience' });
  assert.equal(result.answers.experience_notes, history);
  assert.deepEqual(result.answers.experience_types.sort(), ['industry_experience', 'private_commercial']);
  assert.equal(result.answers.experience_types.includes('federal_contracts'), false);
  assert.ok(result.answers.qualification_categories.includes('healthcare_medical'));
});

test('negative commercial or licensing statements do not create experience or credentials', () => {
  const result = fallbackAdvisorTurn({ answers: { capabilities_text: 'We have no commercial experience. We do not have an RN license.' }, latest_answer: 'Brand new', answered_category: 'experience' });
  assert.deepEqual(result.answers.experience_types, ['brand_new']);
  assert.deepEqual(result.answers.qualification_categories, []);
});

test('expired, hypothetical and question-form credentials are not asserted as held', () => {
  for (const statement of ['We have an RN license that expired.', 'Do we need to have an RN license?', 'We might have an RN license.', 'We do not have an RN license.']) {
    assert.deepEqual(explicitBackgroundUpdates({ qualification_notes: statement }), {}, statement);
  }
});

test('legacy saved work history is available without resetting or mutating the stored object', () => {
  const messages = [{ role: 'advisor', question: { category: 'experience' } }, { role: 'student', content: history }];
  const stored = { ...mixed, advisor_state: { messages } };
  const before = structuredClone(stored);
  assert.equal(normalizeDiscoveryAnswers(stored).experience_notes, history);
  assert.equal(normalizeDiscoveryProfile(stored).experience_notes, history);
  assert.deepEqual(stored, before);
});

test('editing and rebuilding the chat preserves priority, work history and all capability backgrounds', () => {
  const messages = [
    { role: 'advisor', question: { category: 'capability' } }, { role: 'student', content: mixed.capabilities_text },
    { role: 'advisor', question: { category: 'capability_priority_clarification' } }, { role: 'student', content: 'Nursing / healthcare' },
    { role: 'advisor', question: { category: 'experience' } }, { role: 'student', content: history },
  ];
  const rebuilt = answersFromAdvisorMessages(messages);
  assert.equal(rebuilt.answers.adaptive_answers.capability_priority, 'healthcare');
  assert.equal(rebuilt.answers.experience_notes, history);
  assert.equal(rebuilt.answers.capabilities_text, mixed.capabilities_text);
  assert.ok(rebuilt.answers.experience_types.includes('private_commercial'));
});

test('an old completed profile with no priority recovers a clarification without erasing history', () => {
  const messages = [{ role: 'student', content: mixed.capabilities_text }];
  const result = recoverAdvisorState({ complete: true, resolved_dimensions: ADVISOR_DIMENSIONS, messages }, mixed);
  assert.equal(result.complete, false);
  assert.equal(result.pending_question.category, 'capability_priority_clarification');
  assert.deepEqual(result.messages, messages);
});

test('student confusion reopens priority without marking the unanswered dimension resolved', async () => {
  const result = await advanceAdvisorConversation({ answers: { ...mixed, adaptive_answers: { capability_priority: 'facilities' } }, resolved_dimensions: ['capability', 'experience'], latest_answer: 'I am lost. None of this seems to fit.', answered_category: 'opportunity_type', client: noProvider, logger: quiet });
  assert.equal(result.next_question.category, 'capability_priority_clarification');
  assert.equal(result.resolved_dimensions.includes('opportunity_type'), false);
  assert.match(result.assistant_message, /earlier answers are still saved/i);
});

test('healthcare priority restricts the shortlist to healthcare while keeping other facts saved', () => {
  const profile = { ...mixed, adaptive_answers: { capability_priority: 'healthcare' } };
  const candidates = preselectPlaybookCandidates(profile);
  assert.ok(candidates.some((candidate) => /Medical Staffing|Telemedicine/.test(candidate.subindustry_name)));
  assert.ok(candidates.every((candidate) => candidate.industry_name === 'Healthcare & Medical Services'));
  assert.ok(candidates.every((candidate) => !/Veterinar/.test(candidate.subindustry_name)));
  assert.equal(profile.capabilities_text, mixed.capabilities_text);
});

test('comparison shortlist retains both healthcare and facilities and never treats farming as veterinary experience', () => {
  const candidates = preselectPlaybookCandidates({ ...mixed, adaptive_answers: { capability_priority: 'compare_all', agriculture_work: 'Growing vegetables and raising livestock.' } });
  assert.ok(candidates.some((candidate) => candidate.industry_name === 'Healthcare & Medical Services'));
  assert.ok(candidates.some((candidate) => candidate.industry_name === 'Operations & Facilities Support'));
  assert.ok(candidates.every((candidate) => !/Veterinar/.test(candidate.subindustry_name)));
  assert.ok(candidates.length <= 25);
});

test('recommendation entry also asks priority for a legacy mixed profile before ranking', async () => {
  const result = await recommendPlaybookNiches(mixed, { ranker: () => { throw new Error('Premature ranking'); } });
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.questions[0].key, 'capability_priority');
});

test('unsupported agriculture returns an honest limitation, not an unrelated niche', async () => {
  for (const profile of [
    { ...mixed, adaptive_answers: { capability_priority: 'agriculture', agriculture_work: 'Growing crops and raising livestock.' } },
    { capabilities_text: 'Agricultural experience growing crops.', adaptive_answers: { agriculture_work: 'Growing vegetables.' } },
  ]) {
    const result = await recommendPlaybookNiches(profile, { ranker: () => { throw new Error('No supported lane'); } });
    assert.equal(result.status, 'no_recommendation');
    assert.match(result.message, /no dedicated agriculture lane/);
  }
});

test('only actual related agricultural work can preselect an existing supported service', () => {
  const profile = { ...mixed, adaptive_answers: { capability_priority: 'agriculture', agriculture_work: 'We perform grounds maintenance and mowing.' } };
  assert.deepEqual(preselectPlaybookCandidates(profile).map((candidate) => candidate.subindustry_name), ['Landscaping & Grounds Maintenance']);
  for (const details of ['We do not do landscaping.', 'We want to start landscaping.', 'Raising livestock.']) {
    assert.deepEqual(preselectPlaybookCandidates({ ...profile, adaptive_answers: { ...profile.adaptive_answers, agriculture_work: details } }), []);
  }
});

test('a repeated unresolved code question stops before another identical prompt or guessed code', async () => {
  const result = await recommendPlaybookNiches({ capabilities_text: 'Handyman maintenance services.' }, {
    candidates: [facility], ranker: rankFacility, feedabilityChecker: noFeedLookup,
    adaptiveAnswers: { facility_support_vs_equipment_repair: 'unsure' },
    adaptiveAttempts: { facility_support_vs_equipment_repair: 2 }, clarificationRound: 2,
  });
  assert.equal(result.status, 'no_recommendation');
  assert.match(result.message, /will not keep asking the same question/);
});

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const filename = 'app/api/discover/[token]/route.js';
const { code } = await swc.transform(readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript' }, target: 'es2020' }, module: { type: 'commonjs' } });

async function routeHarness(row, authorized = true) {
  const writes = [];
  const imports = {
    '../../../../lib/buyers.js': { getBuyerByToken: async () => authorized ? { id: 'anonymous-fixture' } : null },
    '../../../../lib/discoverySessions.js': {
      publicDiscoverySession,
      getDiscoverySessionForBuyer: async () => structuredClone(row),
      saveDiscoverySessionForBuyer: async (buyerId, input) => { writes.push(input); row = { ...row, ...prepareDiscoverySessionSave({ buyerId, ...input }) }; return row; },
    },
    '../../../../lib/playbook/recommendationEngine.js': { recommendPlaybookNiches: (profile, options) => recommendPlaybookNiches(profile, { ...options, candidates: [facility], ranker: rankFacility, feedabilityChecker: noFeedLookup }) },
    '../../../../lib/playbook/index.js': { normalizeDiscoveryAnswers },
    '../../../../lib/playbook/adaptiveProgress.js': { adaptiveProgressForSubmission },
    '../../../../lib/playbook/adaptiveResolvers.js': { normalizeAdaptiveAnswer },
    '../../../../lib/playbook/capabilityContext.js': await import('../lib/playbook/capabilityContext.js'),
    '../../../../lib/playbook/backgroundEvidence.js': { explicitBackgroundUpdates },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', code)((id) => {
    assert.ok(id in imports, `Unmocked route dependency ${id}`);
    return imports[id];
  }, module, module.exports, quiet);
  return {
    writes, get row() { return row; },
    post: (body) => module.exports.POST(new Request('https://example.test/api/discover/fixture', { method: 'POST', body: JSON.stringify(body) }), { params: { token: 'fixture' } }),
  };
}

test('real recommendation route stops repeated uncertain answers using stored counters, not caller rounds', async () => {
  const harness = await routeHarness({ answers: { capabilities_text: 'Handyman maintenance services.' } });
  let response = await (await harness.post({})).json();
  assert.equal(response.status, 'needs_clarification');
  for (let attempt = 1; attempt <= 2; attempt++) {
    response = await (await harness.post({ answers: { adaptive_answers: { facility_support_vs_equipment_repair: 'unsure' }, adaptive_attempts: {} }, clarification_round: 0 })).json();
    assert.equal(harness.row.answers.adaptive_attempts.facility_support_vs_equipment_repair, attempt);
  }
  assert.equal(response.status, 'no_recommendation');
  assert.equal(harness.row.status, 'in_progress');
  assert.equal(harness.row.recommendations.status, 'no_recommendation');
});

test('real route recovers a legacy draft to a canonical answer and preserves the conversational text', async () => {
  const harness = await routeHarness({ answers: { capabilities_text: 'Handyman maintenance services.', adaptive_answers: { facility_support_vs_equipment_repair: facilityDraft } }, recommendations: { status: 'needs_clarification', questions: [{ key: 'facility_support_vs_equipment_repair' }] } });
  const response = await harness.post({ retry: true });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'recommended');
  assert.equal(harness.row.answers.adaptive_answers.facility_support_vs_equipment_repair, 'facility_support');
  assert.equal(harness.row.answers.adaptive_answer_notes.facility_support_vs_equipment_repair, facilityDraft);
  assert.equal(result.recommendations[0].naics[0].code, '561210');
});

test('classification endpoint keeps the buyer authorization check and does not save an unknown buyer', async () => {
  const harness = await routeHarness({}, false);
  assert.equal((await harness.post({})).status, 404);
  assert.equal(harness.writes.length, 0);
});

test('legacy mixed-profile retry recovers commercial work history and asks priority without a reset', async () => {
  const messages = [{ role: 'advisor', question: { category: 'experience' } }, { role: 'student', content: history }];
  const harness = await routeHarness({ answers: { ...mixed, advisor_state: { messages, complete: true, resolved_dimensions: ADVISOR_DIMENSIONS } } });
  const result = await (await harness.post({ retry: true })).json();
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.questions[0].key, 'capability_priority');
  assert.equal(harness.row.answers.experience_notes, history);
  assert.equal(harness.row.answers.experience_types.includes('brand_new'), false);
  assert.ok(harness.row.answers.experience_types.includes('private_commercial'));
  assert.deepEqual(harness.row.answers.advisor_state.messages, messages);
  assert.equal(harness.row.answers.capabilities_text, mixed.capabilities_text);
});

test('context fields and attempts survive the session save/read normalization boundary', () => {
  const saved = prepareDiscoverySessionSave({ buyerId: 'anonymous-fixture', answers: { ...mixed, experience_notes: history,
    adaptive_answers: { capability_priority: 'healthcare' }, adaptive_answer_notes: { capability_priority: 'Nursing / healthcare' }, adaptive_attempts: { capability_priority: 1, invalid: Infinity },
  } });
  const session = publicDiscoverySession(saved);
  assert.equal(session.answers.experience_notes, history);
  assert.equal(session.answers.adaptive_answer_notes.capability_priority, 'Nursing / healthcare');
  assert.deepEqual(session.answers.adaptive_attempts, { capability_priority: 1 });
  assert.equal(capabilityContextQuestion(session.answers), null);
});
