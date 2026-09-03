import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { advanceAdvisorConversation, ADVISOR_MAX_TURNS, ADVISOR_OPENING_ID, answersFromAdvisorMessages, cleanAdvisorMessages, fallbackAdvisorTurn, recoverAdvisorState } from '../lib/playbook/advisor.js';
import { DISCOVERY_ADVISOR_SCHEMA, adviseDiscoveryTurn, draftDiscoverySuggestion } from '../lib/ai/claude.js';

function collectOpenObjects(schema, path = '$', open = []) {
  if (!schema || typeof schema !== 'object') return open;
  if (schema.type === 'object' && schema.additionalProperties === true) open.push(path);
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) collectOpenObjects(value, `${path}.properties.${key}`, open);
  }
  if (schema.items) collectOpenObjects(schema.items, `${path}.items`, open);
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (Array.isArray(schema[key])) schema[key].forEach((value, index) => collectOpenObjects(value, `${path}.${key}[${index}]`, open));
  }
  return open;
}

function loadAnthropicKeyForLiveTest() {
  if (process.env.RUN_LIVE_CLAUDE_TESTS !== '1') return false;
  if (process.env.ANTHROPIC_API_KEY) return true;
  const envPath = new URL('../.env.local', import.meta.url);
  if (!existsSync(envPath)) return false;
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/).find((entry) => /^\s*ANTHROPIC_API_KEY\s*=/.test(entry));
  const value = line?.replace(/^\s*ANTHROPIC_API_KEY\s*=\s*/, '').replace(/^['"]|['"]$/g, '').trim();
  if (!value) return false;
  process.env.ANTHROPIC_API_KEY = value;
  return true;
}

test('rich response resolves several dimensions and skips them', async () => {
  const client = { messages: { create: async () => ({ usage: { output_tokens: 120 }, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ profile_updates: { capabilities_text: 'Commercial cleaning', opportunity_type: 'services', fulfillment_model: 'self_perform', experience_types: ['private_commercial'], geography_mode: 'single_state', state: 'GA' }, resolved_dimensions: ['capability', 'opportunity_type', 'fulfillment', 'experience', 'geography'], course_reason: 'Service delivery is clear.', assistant_message: 'Cleaning experience is a real starting point. Next, what delivery advantages do you have?', next_question: { category: 'qualifications', input_type: 'multi_choice', prompt: 'What advantages do you have?', helper: '', placeholder: '', options: [{ value: 'qualified_staff', label: 'Qualified staff' }] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({ latest_answer: 'I run a commercial cleaning company in Georgia with ten employees.', client, logger: { info() {}, error() {} } });
  assert.equal(result.answers.capabilities_text, 'Commercial cleaning');
  assert.equal(result.answers.state, 'GA');
  assert.equal(result.next_question.category, 'qualifications');
  assert.equal(result.resolved_dimensions.includes('experience'), true);
});

test('fallback asks the highest-value unresolved dimension and respects the turn budget', () => {
  const opening = fallbackAdvisorTurn({ answers: {}, resolved_dimensions: [] });
  assert.equal(opening.next_question.category, 'capability');
  assert.match(opening.assistant_message, /strongest starting position/i);
  assert.equal(opening.next_question.options.length > 0, true);
  assert.equal(fallbackAdvisorTurn({ answers: {}, resolved_dimensions: [], turn_count: ADVISOR_MAX_TURNS }).complete, true);
});

test('a fallback consumes the pending answer and never repeats the opening capability question', () => {
  const turn = fallbackAdvisorTurn({ latest_answer: 'I can provide network services', answered_category: 'capability' });
  assert.equal(turn.answers.capabilities_text, 'I can provide network services');
  assert.equal(turn.resolved_dimensions.includes('capability'), true);
  assert.notEqual(turn.next_question.category, 'capability');
});

test('fallback advisor copy stays plain and coach-like', () => {
  const turn = fallbackAdvisorTurn({ latest_answer: 'IT support', answered_category: 'capability' });
  assert.match(turn.assistant_message, /how you would get paid/i);
  assert.equal(turn.next_question.prompt, 'Would you sell products, provide services, or do both?');
});

test('advisor questions include Playbook-grounded context notes', () => {
  const turn = fallbackAdvisorTurn({
    answers: { capabilities_text: 'Commercial janitorial cleaning in Georgia' },
    resolved_dimensions: ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model'],
    latest_answer: 'Recurring services',
    answered_category: 'operating_model',
    turn_count: 8,
  });
  assert.match(turn.next_question.helper, /Advisor note:/);
  assert.match(turn.next_question.helper, /Janitorial|Cleaning|this lane/i);
  assert.match(turn.next_question.helper, /manageable delivery|fulfill cleanly/i);
});

test('advisor notes do not name an inferred niche without direct student wording', () => {
  const turn = fallbackAdvisorTurn({
    answers: { capabilities_text: 'Cleaning and facilities support' },
    resolved_dimensions: ['capability', 'opportunity_type', 'fulfillment', 'experience'],
    latest_answer: 'Commercial experience',
    answered_category: 'experience',
    turn_count: 4,
  });
  assert.match(turn.next_question.helper, /Advisor note:/);
  assert.doesNotMatch(turn.next_question.helper, /Laundry|Linen/i);
});

test('Claude advisor prompt asks for human student language', async () => {
  let systemPrompt = '';
  const client = { messages: { create: async (payload) => { systemPrompt = payload.system; return { content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ['capability'], course_reason: '', assistant_message: 'Good. Now tell me how you would get paid.', next_question: { category: 'opportunity_type', input_type: 'single_choice', prompt: 'Is this mostly products, services, or both?', helper: '', placeholder: '', options: [] }, complete: false }) }] }; } } };
  await advanceAdvisorConversation({ latest_answer: 'IT support', answered_category: 'capability', client, logger: { info() {}, error() {} } });
  assert.match(systemPrompt, /human coach/i);
  assert.match(systemPrompt, /short, simple sentences/i);
  assert.match(systemPrompt, /Avoid idioms/i);
});

test('Claude advisor structured-output schema has no open-ended objects', async () => {
  let schema;
  const client = { messages: { create: async (payload) => {
    schema = payload.output_config.format.schema;
    return { content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ['capability'], course_reason: '', assistant_message: 'Good. Now tell me how you would get paid.', next_question: { category: 'opportunity_type', input_type: 'single_choice', prompt: 'Is this mostly products, services, or both?', helper: '', placeholder: '', options: [] }, complete: false }) }] };
  } } };

  await adviseDiscoveryTurn({ profile: {}, unresolved_dimensions: ['capability'], latest_answer: 'IT support' }, { client, logger: { info() {}, error() {} } });

  assert.equal(schema.properties.profile_updates.additionalProperties, false);
  assert.ok(Object.hasOwn(schema.properties.profile_updates.properties, 'capabilities_text'));
  assert.ok(Object.hasOwn(schema.properties.profile_updates.properties, 'set_asides'));
  assert.deepEqual(collectOpenObjects(schema), []);
});

test('live Claude provider accepts the exact advisor structured-output schema without fallback', { skip: !loadAnthropicKeyForLiveTest(), timeout: 90000 }, async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ timeout: 60000 });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
    max_tokens: 1,
    system: 'Return a minimal response matching the supplied schema.',
    messages: [{ role: 'user', content: 'schema acceptance check only' }],
    output_config: { format: { type: 'json_schema', schema: DISCOVERY_ADVISOR_SCHEMA } },
  });

  assert.equal(typeof response, 'object');
  assert.notEqual(response?.type, 'error');
});

test('suggestion chips ask Claude for an editable student draft', async () => {
  let payload;
  const client = { messages: { create: async (request) => {
    payload = request;
    return { content: [{ type: 'text', text: JSON.stringify({ draft: 'I can support work nationwide if the scope can be handled remotely or through vendors.' }) }] };
  } } };
  const draft = await draftDiscoverySuggestion({ category: 'geography', question: 'Where can you deliver the work?', helper: 'Use a state code or describe your service area.', suggestion: 'Nationwide', chat_context: [{ role: 'student', content: 'I run a cleaning company in Georgia.' }] }, { client });
  assert.match(payload.system, /editable answer/);
  assert.match(payload.system, /prior chat context/);
  assert.match(payload.system, /Do not invent company details/);
  assert.match(payload.system, /industries, subindustries, or services/);
  const body = JSON.parse(payload.messages[0].content);
  assert.equal(body.suggestion, 'Nationwide');
  assert.deepEqual(body.chat_context, [{ role: 'student', content: 'I run a cleaning company in Georgia.' }]);
  assert.equal(draft, 'I can support work nationwide if the scope can be handled remotely or through vendors.');
});

test('legacy duplicate opening messages collapse while the authoritative pending question is restored', () => {
  const state = recoverAdvisorState({ messages: [{ role: 'advisor', content: 'Let’s find the lane that gives you the strongest starting position.', question: { id: ADVISOR_OPENING_ID, category: 'capability' } }, { role: 'advisor', content: 'Let’s find the lane that gives you the strongest starting position.', question: { id: ADVISOR_OPENING_ID, category: 'capability' } }] }, {});
  assert.equal(cleanAdvisorMessages(state.messages).length, 1);
  assert.equal(state.pending_question.id, ADVISOR_OPENING_ID);
});

test('advisor recovery keeps the full non-duplicate chat history', () => {
  const messages = Array.from({ length: 22 }, (_, index) => ({
    role: index % 2 ? 'student' : 'advisor',
    content: `message ${index}`,
    question: index % 2 ? undefined : { id: `q-${index}`, category: 'capability', prompt: `Question ${index}` },
  }));
  assert.equal(cleanAdvisorMessages(messages).length, 22);
  assert.equal(recoverAdvisorState({ messages }, {}).messages.length, 22);
});

test('a Claude next-question proposal cannot repeat the answered category', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: { capabilities_text: 'Network services' }, resolved_dimensions: ['capability'], course_reason: 'Clear capability.', assistant_message: 'Good.', next_question: { category: 'capability', input_type: 'text', prompt: 'Repeat?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({ latest_answer: 'Network services', answered_category: 'capability', client, logger: { info() {}, error() {} } });
  assert.equal(result.next_question.category, 'opportunity_type');
});

test('server rejects a semantically duplicate delivery question proposed as operating model', async () => {
  const logs = [];
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ['qualifications'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'operating_model', input_type: 'single_choice', prompt: "Now let's lock in how you'd actually deliver the work - solo, with a team you'd hire, or by partnering with existing techs.", helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({
    answers: { capabilities_text: 'IT support', fulfillment_model: 'self', qualification_categories: ['none_unknown'] },
    resolved_dimensions: ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model'],
    latest_answer: "We don't currently have Microsoft Certified staff, but we're evaluating certifications.",
    answered_category: 'qualifications',
    turn_count: 6,
    client,
    logger: { info(event) { logs.push(event); }, error() {} },
  });
  assert.equal(result.next_question.category, 'contract_scale');
  assert.ok(logs.some((event) => event.stage === 'advisor_question_rejected' && event.category === 'operating_model'));
});

test('one fulfillment answer can resolve delivery and operating concept so delivery is not re-asked', () => {
  const result = fallbackAdvisorTurn({
    answers: { capabilities_text: 'IT support' },
    resolved_dimensions: ['capability', 'opportunity_type'],
    latest_answer: 'My existing technicians will perform the work themselves.',
    answered_category: 'fulfillment',
    turn_count: 2,
  });
  assert.equal(result.answers.fulfillment_model, 'self');
  assert.equal(result.resolved_dimensions.includes('fulfillment'), true);
  assert.equal(result.resolved_dimensions.includes('operating_model'), true);
  assert.notEqual(result.next_question.category, 'operating_model');
});

test('contradictory delivery answer asks clarification instead of silently overwriting', async () => {
  const logs = [];
  const result = await advanceAdvisorConversation({
    answers: { capabilities_text: 'IT support', fulfillment_model: 'self' },
    resolved_dimensions: ['capability', 'fulfillment'],
    latest_answer: "We'd partner with certified IT vendors or subcontractors.",
    answered_category: 'operating_model',
    turn_count: 4,
    client: { messages: { create: async () => { throw new Error('should not call provider for contradiction clarification'); } } },
    logger: { info(event) { logs.push(event); }, error() {} },
  });
  assert.equal(result.next_question.category, 'fulfillment_clarification');
  assert.equal(result.answers.fulfillment_model, 'self');
  assert.equal(result.count_progress, false);
  assert.ok(logs.some((event) => event.stage === 'advisor_contradiction_detected' && event.field === 'fulfillment_model'));
});

test('explicit delivery correction updates fulfillment without unnecessary clarification', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ['fulfillment'], course_reason: '', assistant_message: 'Got it. Now let us move forward.', next_question: { category: 'experience', input_type: 'single_choice', prompt: 'What experience can we use?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({
    answers: { capabilities_text: 'IT support', fulfillment_model: 'self' },
    resolved_dimensions: ['capability', 'fulfillment', 'operating_model'],
    latest_answer: 'Actually, we plan to subcontract most of it.',
    answered_category: 'operating_model',
    turn_count: 4,
    client,
    logger: { info() {}, error() {} },
  });
  assert.equal(result.answers.fulfillment_model, 'existing_vendors');
  assert.notEqual(result.next_question.category, 'fulfillment_clarification');
  assert.equal(result.resolved_dimensions.includes('operating_model'), false);
});

test('hybrid delivery language resolves fulfillment and prevents another delivery question', async () => {
  const logs = [];
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ['fulfillment'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'operating_model', input_type: 'single_choice', prompt: 'Would your team do it or would partners do it?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({
    answers: { capabilities_text: 'IT support' },
    resolved_dimensions: ['capability', 'opportunity_type', 'experience', 'qualifications', 'set_asides', 'geography'],
    latest_answer: "Our team handles normal support but we'd use certified subcontractors where needed.",
    answered_category: 'fulfillment',
    turn_count: 6,
    client,
    logger: { info(event) { logs.push(event); }, error() {} },
  });
  assert.equal(result.answers.fulfillment_model, 'hybrid');
  assert.equal(result.resolved_dimensions.includes('operating_model'), true);
  assert.equal(result.next_question.category, 'contract_scale');
  assert.ok(logs.some((event) => event.stage === 'advisor_question_rejected' && event.category === 'operating_model'));
});

test('invalid Claude profile update values do not poison saved advisor answers', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: { fulfillment_model: 'broker_management', set_asides: ['small_business'] }, resolved_dimensions: ['fulfillment'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'experience', input_type: 'single_choice', prompt: 'What experience can we use?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({ latest_answer: 'I broker and manage IT contractors or staffing vendors', answered_category: 'fulfillment', client, logger: { info() {}, error() {} } });
  assert.equal(result.answers.fulfillment_model, 'existing_vendors');
  assert.deepEqual(result.answers.set_asides, []);
});

test('poisoned persisted advisor answers recover on the next conversation turn', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: {}, resolved_dimensions: ['experience'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'qualifications', input_type: 'single_choice', prompt: 'What do you already have?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({
    answers: { capabilities_text: 'IT help desk and network support', fulfillment_model: 'broker_management', set_asides: ['small_business'] },
    resolved_dimensions: ['capability', 'fulfillment'],
    latest_answer: 'Commercial IT support experience',
    answered_category: 'experience',
    turn_count: 2,
    client,
    logger: { info() {}, error() {} },
  });
  assert.equal(result.answers.fulfillment_model, '');
  assert.deepEqual(result.answers.set_asides, []);
});

test('Claude size updates must be numeric before they can override advisor answers', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: { size_min: '$25k', size_max: '150000' }, resolved_dimensions: ['contract_scale'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'interests_avoidances', input_type: 'text', prompt: 'Anything to include or avoid?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const result = await advanceAdvisorConversation({
    latest_answer: 'Not sure',
    answered_category: 'contract_scale',
    client,
    logger: { info() {}, error() {} },
  });
  assert.equal(result.answers.size_min, '');
  assert.equal(result.answers.size_max, '150000');
});

test('conflicting capability answers request one clarification without advancing progress', async () => {
  const result = await advanceAdvisorConversation({ answers: { capabilities_text: 'Network services' }, resolved_dimensions: [], latest_answer: 'Cleaning', answered_category: 'capability' });
  assert.equal(result.next_question.category, 'capability_clarification');
  assert.equal(result.count_progress, false);
});

test('advisor does not complete before contract size is asked', () => {
  const resolved = ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model'];
  const turn = fallbackAdvisorTurn({ resolved_dimensions: resolved, turn_count: resolved.length });
  assert.equal(turn.complete, false);
  assert.equal(turn.next_question.category, 'contract_scale');
});

test('fallback stores contract size selections', () => {
  const turn = fallbackAdvisorTurn({ latest_answer: '$25k to $150k', answered_category: 'contract_scale' });
  assert.equal(turn.answers.size_min, '25000');
  assert.equal(turn.answers.size_max, '150000');
  assert.equal(turn.resolved_dimensions.includes('contract_scale'), true);
});

test('contract size sentences preserve the range in the advisor profile', async () => {
  const latest = 'I can handle contracts around $25k to $100,000 right now.';
  const fallback = fallbackAdvisorTurn({ latest_answer: latest, answered_category: 'contract_scale' });
  assert.equal(fallback.answers.size_min, '25000');
  assert.equal(fallback.answers.size_max, '100000');

  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: { size_min: '', size_max: '' }, resolved_dimensions: ['contract_scale'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'interests_avoidances', input_type: 'text', prompt: 'Anything to include or avoid?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const turn = await advanceAdvisorConversation({ latest_answer: latest, answered_category: 'contract_scale', client, logger: { info() {}, error() {} } });
  assert.equal(turn.answers.size_min, '25000');
  assert.equal(turn.answers.size_max, '100000');
});

test('set-aside sentences preserve Small Business in the advisor profile', async () => {
  const latest = "Yes, I qualify as a Small Business. I haven't pursued specialized set-asides yet.";
  const fallback = fallbackAdvisorTurn({ latest_answer: latest, answered_category: 'set_asides' });
  assert.deepEqual(fallback.answers.set_asides, ['sb']);

  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ profile_updates: { set_asides: [] }, resolved_dimensions: ['set_asides'], course_reason: '', assistant_message: 'Good.', next_question: { category: 'geography', input_type: 'text', prompt: 'Where can you deliver?', helper: '', placeholder: '', options: [] }, complete: false }) }] }) } };
  const turn = await advanceAdvisorConversation({ latest_answer: latest, answered_category: 'set_asides', client, logger: { info() {}, error() {} } });
  assert.deepEqual(turn.answers.set_asides, ['sb']);
});

test('include and avoid step has friendly suggestions and separates avoid text', () => {
  const turn = fallbackAdvisorTurn({ resolved_dimensions: ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model', 'contract_scale'] });
  assert.equal(turn.next_question.category, 'interests_avoidances');
  assert.match(turn.next_question.prompt, /include or avoid/i);
  assert.ok(turn.next_question.options.some((option) => option.label === 'Avoid construction'));

  const saved = fallbackAdvisorTurn({ latest_answer: 'include cleaning, restoration; avoid waste management', answered_category: 'interests_avoidances' });
  assert.equal(saved.answers.interests, 'cleaning, restoration');
  assert.equal(saved.answers.avoid, 'waste management');

  const skipped = fallbackAdvisorTurn({ latest_answer: 'I want to focus on wastage and facilities services. Skip laundry linen services.', answered_category: 'interests_avoidances' });
  assert.equal(skipped.answers.interests, 'wastage and facilities services.');
  assert.equal(skipped.answers.avoid, 'laundry linen services.');
});

test('advisor answers can be rebuilt from chat history before an edited answer', () => {
  const rebuilt = answersFromAdvisorMessages([
    { role: 'advisor', content: 'What can you provide?', question: { category: 'capability', prompt: 'What can you provide?' } },
    { role: 'student', content: 'IT support' },
    { role: 'advisor', content: 'Where can you deliver?', question: { category: 'geography', prompt: 'Where can you deliver?' } },
  ]);
  assert.equal(rebuilt.answers.capabilities_text, 'IT support');
  assert.equal(rebuilt.resolved_dimensions.includes('capability'), true);
  assert.equal(rebuilt.resolved_dimensions.includes('geography'), false);
});

test('old prematurely complete sessions resume at missing contract size', () => {
  const resolved = ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model'];
  const state = recoverAdvisorState({ complete: true, resolved_dimensions: resolved, pending_question: null }, {});
  assert.equal(state.complete, false);
  assert.equal(state.pending_question.category, 'contract_scale');
});

test('resume does not restore an already-resolved delivery-style operating question', () => {
  const state = recoverAdvisorState({
    resolved_dimensions: ['capability', 'fulfillment', 'operating_model'],
    pending_question: { id: 'advisor-operating_model-v1', category: 'operating_model', prompt: 'Will you deliver with your team or subcontractors?', helper: '', placeholder: '', input_type: 'single_choice', options: [] },
  }, { capabilities_text: 'IT support', fulfillment_model: 'self' });
  assert.notEqual(state.pending_question.category, 'operating_model');
});
