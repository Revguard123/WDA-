import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYBOOK_VERSION,
  normalizeDiscoveryAnswers,
  normalizeDiscoveryProfile,
  validateDiscoveryAnswers,
} from '../lib/playbook/index.js';
import {
  getDiscoverySessionForBuyer,
  prepareDiscoverySessionSave,
  publicDiscoverySession,
  saveDiscoverySessionForBuyer,
} from '../lib/discoverySessions.js';
import { discoverStateForBuyer } from '../lib/journey.js';

const buyerId = 'buyer-1';

const structuredAnswers = {
  capabilities_text: 'We can source janitorial vendors with recurring staffing.',
  fulfillment_model: 'existing_partners',
  opportunity_type: 'services',
  experience_types: ['private_commercial', 'new_to_area'],
  qualification_categories: ['qualified_staff'],
  qualification_notes: 'Vendors have local crews.',
  geography_mode: 'single_state',
  state: 'ga',
  operating_model: 'recurring_services',
  size_min: '1000',
  size_max: '250000',
  set_asides: ['sb'],
  interests: 'Facility services',
  avoid: 'Cybersecurity',
  adaptive_answers: { future: 'kept' },
};

function createFakeClient(initialRow = null) {
  const calls = [];
  let row = initialRow;
  const builder = {
    select() { calls.push(['select']); return this; },
    eq(key, value) { calls.push(['eq', key, value]); return this; },
    upsert(value) {
      calls.push(['upsert', value]);
      row = { id: row?.id || 'session-1', created_at: row?.created_at || 'created', ...value };
      return this;
    },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve({ data: row, error: null }); },
    single() { calls.push(['single']); return Promise.resolve({ data: row, error: null }); },
  };
  return {
    calls,
    get row() { return row; },
    from(table) { calls.push(['from', table]); return builder; },
  };
}

test('v1 payload normalization still works', () => {
  const profile = normalizeDiscoveryProfile({
    background: 'Commercial cleaning',
    interests: 'Recurring work',
    state: 'ga',
    setAsides: ['sb'],
  });
  assert.equal(profile.capabilities_text, 'Commercial cleaning');
  assert.equal(profile.geography_mode, 'single_state');
  assert.equal(profile.state, 'GA');
  assert.deepEqual(profile.set_asides, ['sb']);
});

test('new structured payload normalization works', () => {
  const profile = normalizeDiscoveryProfile(structuredAnswers);
  assert.equal(profile.fulfillment_model, 'existing_vendors');
  assert.equal(profile.opportunity_type, 'service');
  assert.deepEqual(profile.experience_types, ['private_commercial', 'brand_new']);
  assert.deepEqual(profile.qualification_categories, ['qualified_staff']);
  assert.equal(profile.operating_model, 'recurring_service');
});

test('invalid fulfillment model rejected', () => {
  assert.equal(validateDiscoveryAnswers({ fulfillment_model: 'bad' }).ok, false);
});

test('invalid opportunity type rejected', () => {
  assert.equal(validateDiscoveryAnswers({ opportunity_type: 'bad' }).ok, false);
});

test('invalid geography mode rejected', () => {
  assert.equal(validateDiscoveryAnswers({ geography_mode: 'planetary' }).ok, false);
});

test('single-state geography requires valid state', () => {
  assert.equal(validateDiscoveryAnswers({ geography_mode: 'single_state', state: '' }).ok, false);
  assert.equal(validateDiscoveryAnswers({ geography_mode: 'single_state', state: 'G' }).ok, false);
});

test('blank/nationwide geography remains valid', () => {
  const result = validateDiscoveryAnswers({ geography_mode: 'nationwide', state: '' });
  assert.equal(result.ok, true);
  assert.equal(result.normalized_profile.geography_mode, 'nationwide');
  assert.equal(result.normalized_profile.state, '');
});

test('size_min greater than size_max rejected', () => {
  assert.equal(validateDiscoveryAnswers({ size_min: '50', size_max: '10' }).ok, false);
});

test('unsupported set-aside rejected', () => {
  assert.equal(validateDiscoveryAnswers({ set_asides: ['sb', 'fake'] }).ok, false);
});

test('raw answers survive normalization', () => {
  const raw = normalizeDiscoveryAnswers(structuredAnswers);
  assert.equal(raw.fulfillment_model, 'existing_partners');
  assert.equal(raw.opportunity_type, 'services');
  assert.equal(raw.adaptive_answers.future, 'kept');
});

test('no qualifications are inferred from capabilities text', () => {
  const profile = normalizeDiscoveryProfile({ capabilities_text: 'Licensed bonded cleared medical cyber team' });
  assert.deepEqual(profile.qualification_categories, []);
});

test('Discovery session loads saved progress', async () => {
  const client = createFakeClient({
    id: 'session-1',
    buyer_id: buyerId,
    answers: structuredAnswers,
    normalized_profile: normalizeDiscoveryProfile(structuredAnswers),
    current_step: 6,
    status: 'in_progress',
    playbook_version: PLAYBOOK_VERSION,
  });
  const session = await getDiscoverySessionForBuyer(buyerId, { client });
  assert.equal(session.current_step, 6);
  assert.equal(session.answers.capabilities_text, structuredAnswers.capabilities_text);
});

test('save updates current step and persists Playbook version', async () => {
  const client = createFakeClient();
  const session = await saveDiscoverySessionForBuyer(buyerId, { answers: structuredAnswers, currentStep: 6 }, { client });
  assert.equal(session.current_step, 6);
  assert.equal(session.playbook_version, PLAYBOOK_VERSION);
  assert.equal(client.row.playbook_version, PLAYBOOK_VERSION);
});

test('refresh/resume returns saved answers without access token', () => {
  const publicSession = publicDiscoverySession({
    id: 'session-1',
    buyer_id: buyerId,
    access_token: 'should-not-leak',
    answers: structuredAnswers,
    normalized_profile: normalizeDiscoveryProfile(structuredAnswers),
    current_step: 6,
    status: 'in_progress',
    playbook_version: PLAYBOOK_VERSION,
  });
  assert.equal(publicSession.current_step, 6);
  assert.equal(publicSession.answers.interests, structuredAnswers.interests);
  assert.equal('buyer_id' in publicSession, false);
  assert.equal('access_token' in publicSession, false);
});

test('final step persists completed questionnaire profile as recommended state', () => {
  const patch = prepareDiscoverySessionSave({
    buyerId,
    answers: structuredAnswers,
    currentStep: 6,
    status: 'recommended',
    recommendations: [],
  });
  assert.equal(patch.status, 'recommended');
  assert.equal(patch.current_step, 6);
  assert.equal(patch.normalized_profile.fulfillment_model, 'existing_vendors');
});

test('Discovery save does not activate buyer, increment batches, or create deliveries', async () => {
  const client = createFakeClient();
  await saveDiscoverySessionForBuyer(buyerId, { answers: structuredAnswers, currentStep: 2 }, { client });
  const tables = client.calls.filter((c) => c[0] === 'from').map((c) => c[1]);
  assert.deepEqual(tables, ['discovery_sessions']);
});

test('active/completed route guards remain unchanged', () => {
  assert.equal(discoverStateForBuyer({ status: 'active', access_token: 'tok' }).redirect, '/contracts/tok');
  assert.equal(discoverStateForBuyer({ status: 'completed', access_token: 'tok' }).redirect, '/contracts/tok');
  assert.equal(discoverStateForBuyer({ status: 'exploring', access_token: 'tok' }).redirect, undefined);
});

test('current legacy Discovery recommendation behavior remains compatible', () => {
  const legacy = {
    background: structuredAnswers.capabilities_text,
    interests: `${structuredAnswers.interests} Avoid: ${structuredAnswers.avoid}`,
    state: structuredAnswers.state.toUpperCase(),
    setAsides: structuredAnswers.set_asides,
  };
  const profile = normalizeDiscoveryProfile(legacy);
  assert.equal(profile.capabilities_text, structuredAnswers.capabilities_text);
  assert.deepEqual(profile.set_asides, ['sb']);
  assert.equal(profile.state, 'GA');
});
