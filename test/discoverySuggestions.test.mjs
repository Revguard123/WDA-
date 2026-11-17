import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as advisor from '../lib/playbook/advisor.js';
import { prepareDiscoverySessionSave, publicDiscoverySession } from '../lib/discoverySessions.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const filename = 'app/api/discover/[token]/conversation/route.js';
const { code } = await swc.transform(readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript' }, target: 'es2020' }, module: { type: 'commonjs' } });
const mixed = 'We provide handyman maintenance. A team member holds an RN license and has nursing experience. We also have agricultural experience.';
const question = { key: 'facility_support_vs_equipment_repair', prompt: 'Is this broad facility support or equipment repair?', options: [{ value: 'facility_support', label: 'Broad facility support' }, { value: 'equipment_repair', label: 'Equipment repair' }] };
const draft = 'I would start with broad facility support, focusing on general upkeep and repairs rather than one equipment type.';
const quiet = { info() {}, warn() {}, error() {} };

function harness({ recommendations = { status: 'needs_clarification', questions: [question] }, failDraft = false, authorized = true } = {}) {
  let row = { answers: { capabilities_text: mixed, advisor_state: { complete: true, resolved_dimensions: advisor.ADVISOR_DIMENSIONS, messages: [{ role: 'advisor', question: { category: 'capability' } }, { role: 'student', content: mixed }] } }, recommendations, status: 'in_progress', current_step: 6 };
  const priority = advisor.recoverAdvisorState(row.answers.advisor_state, row.answers).pending_question;
  row.answers.advisor_state.messages.push({ role: 'advisor', content: 'Which background should we evaluate first?', question: priority });
  const calls = [], writes = [];
  const imports = {
    '../../../../../lib/buyers.js': { getBuyerByToken: async () => authorized ? { id: 'fixture-buyer' } : null },
    '../../../../../lib/discoverySessions.js': {
      publicDiscoverySession,
      getDiscoverySessionForBuyer: async () => structuredClone(row),
      saveDiscoverySessionForBuyer: async (buyerId, input) => { writes.push(input); row = { ...row, ...prepareDiscoverySessionSave({ buyerId, ...input }) }; return row; },
    },
    '../../../../../lib/ai/claude.js': { draftDiscoverySuggestion: async (input) => { calls.push(input); if (failDraft) throw new Error('Provider failed'); return draft; } },
    '../../../../../lib/playbook/advisor.js': advisor,
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', code)((id) => {
    assert.ok(id in imports, `Unexpected route dependency ${id}`); return imports[id];
  }, module, module.exports, quiet);
  return { calls, writes, get row() { return row; }, post: (body) => module.exports.POST(new Request('https://wda.test/api/discover/me/conversation', { method: 'POST', body: JSON.stringify(body) }), { params: { token: 'me' } }) };
}

test('adaptive suggestions draft against the displayed saved clarification, not a recovered older conversation question', async () => {
  const state = harness();
  const before = structuredClone(state.row);
  const response = await state.post({ draft_suggestion: true, suggestion: 'Broad facility support', suggestion_value: 'facility_support', current_question: { category: 'naics_clarification', adaptive_key: question.key, prompt: 'Client-supplied prompt must not override the saved prompt' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, draft });
  assert.equal(state.calls[0].question, question.prompt);
  assert.equal(state.calls[0].suggestion, 'Broad facility support');
  assert.equal(state.calls[0].selected_option, 'facility_support');
  assert.equal(state.calls[0].category, 'naics_clarification');
  assert.equal(state.writes.length, 0);
  assert.deepEqual(state.row, before);
});

test('the new priority clarification also goes through the draft provider with its canonical option', async () => {
  const state = harness({ recommendations: [] });
  const pending = advisor.recoverAdvisorState(state.row.answers.advisor_state, state.row.answers).pending_question;
  const response = await state.post({ draft_suggestion: true, suggestion: 'Nursing / healthcare', suggestion_value: 'healthcare', current_question: pending });
  assert.equal(response.status, 200);
  assert.equal(state.calls[0].category, 'capability_priority_clarification');
  assert.equal(state.calls[0].selected_option, 'healthcare');
  assert.equal(state.writes.length, 0);
});

test('old clients sending only the visible label can still draft a saved adaptive suggestion', async () => {
  const state = harness();
  const response = await state.post({ draft_suggestion: true, suggestion: 'Broad facility support', current_question: { category: 'naics_clarification' } });
  assert.equal(response.status, 200);
  assert.equal(state.calls[0].selected_option, 'facility_support');
});

test('stale question keys and unavailable options never reach the draft provider', async () => {
  const state = harness();
  for (const body of [
    { suggestion_value: 'facility_support', current_question: { category: 'naics_clarification', adaptive_key: 'old_question' } },
    { suggestion_value: 'unknown_option', current_question: { category: 'naics_clarification', adaptive_key: question.key } },
  ]) assert.equal((await state.post({ draft_suggestion: true, ...body })).status, 409);
  assert.equal(state.calls.length, 0);
  assert.equal(state.writes.length, 0);
});

test('a provider failure returns a retryable draft error, not the raw chip label or a saved answer', async () => {
  const state = harness({ failDraft: true });
  const response = await state.post({ draft_suggestion: true, suggestion_value: 'facility_support', current_question: { category: 'naics_clarification', adaptive_key: question.key } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Could not draft/);
  assert.equal(state.writes.length, 0);
});

test('submitting a generated priority draft saves its prose and selected value separately for later recovery', async () => {
  const state = harness({ recommendations: [] });
  const pending = advisor.recoverAdvisorState(state.row.answers.advisor_state, state.row.answers).pending_question;
  const prose = 'I would like to start with nursing and keep our handyman and agricultural experience saved for later.';
  const response = await state.post({ answer: prose, question_id: pending.id, question_category: pending.category, selected_option: 'healthcare' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.answers.adaptive_answers.capability_priority, 'healthcare');
  const message = result.advisor_state.messages.find((message) => message.role === 'student' && message.content === prose);
  assert.equal(message.selected_option, 'healthcare');
  assert.equal(message.content, prose);
});

test('arbitrary selection metadata is ignored rather than turning into a claimed capability', async () => {
  const state = harness({ recommendations: [] });
  const pending = advisor.recoverAdvisorState(state.row.answers.advisor_state, state.row.answers).pending_question;
  const response = await state.post({ answer: 'Nursing / healthcare', question_id: pending.id, question_category: pending.category, selected_option: 'unavailable_choice' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.answers.adaptive_answers.capability_priority, 'healthcare');
  assert.equal(Object.hasOwn(result.advisor_state.messages.at(-2), 'selected_option'), false);
});

test('editing a saved generated answer clears its old selected option before rebuilding the profile', async () => {
  const state = harness({ recommendations: [] });
  const pending = advisor.recoverAdvisorState(state.row.answers.advisor_state, state.row.answers).pending_question;
  await state.post({ answer: 'I want to start with nursing and keep our other backgrounds saved.', question_id: pending.id, question_category: pending.category, selected_option: 'healthcare' });
  const index = state.row.answers.advisor_state.messages.findIndex((message) => message.role === 'student' && message.selected_option === 'healthcare');
  assert.ok(index >= 0);
  const response = await state.post({ edit_answer: true, message_index: index, answer: 'Compare all these areas' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.answers.adaptive_answers.capability_priority, 'compare_all');
  assert.equal(Object.hasOwn(result.advisor_state.messages[index], 'selected_option'), false);
});

test('an unauthorized suggestion request cannot invoke the provider', async () => {
  const state = harness({ authorized: false });
  assert.equal((await state.post({ draft_suggestion: true })).status, 404);
  assert.equal(state.calls.length, 0);
});
