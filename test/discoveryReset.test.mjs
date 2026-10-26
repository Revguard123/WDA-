import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as advisor from '../lib/playbook/advisor.js';
import { prepareDiscoverySessionSave, publicDiscoverySession } from '../lib/discoverySessions.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const filename = 'app/api/discover/[token]/conversation/route.js';
const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
  filename, jsc: { parser: { syntax: 'ecmascript' }, target: 'es2020' }, module: { type: 'commonjs' },
});

function harness({ authorized = true } = {}) {
  const selected = { subindustry_id: 'old-niche', subindustry_name: 'Old selected niche' };
  let row = {
    buyer_id: 'fixture-buyer', status: 'selected', current_step: 6,
    recommendations: [selected], selected_recommendation: selected,
    answers: { capabilities_text: 'Old saved capabilities', advisor_state: {
      messages: [{ role: 'advisor', content: 'Old question' }, { role: 'student', content: 'Old saved answer' }],
      pending_question: null, resolved_dimensions: [], turn_count: 4, complete: true,
    } },
  };
  const writes = [];
  let reads = 0;
  const forbidden = () => { throw new Error('Reset/resume must not call an AI provider'); };
  const imports = {
    '../../../../../lib/buyers.js': { getBuyerByToken: async () => authorized ? { id: 'fixture-buyer' } : null },
    '../../../../../lib/discoverySessions.js': {
      publicDiscoverySession,
      getDiscoverySessionForBuyer: async (buyerId) => { assert.equal(buyerId, 'fixture-buyer'); reads++; return row; },
      saveDiscoverySessionForBuyer: async (buyerId, input) => {
        assert.equal(buyerId, 'fixture-buyer');
        writes.push(input);
        row = { ...row, ...prepareDiscoverySessionSave({ buyerId, ...input }) };
        return row;
      },
    },
    '../../../../../lib/ai/claude.js': { draftDiscoverySuggestion: forbidden },
    '../../../../../lib/playbook/advisor.js': { ...advisor, advanceAdvisorConversation: forbidden },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => {
    if (!(id in imports)) throw new Error(`Unexpected route dependency: ${id}`);
    return imports[id];
  }, module, module.exports);
  return {
    writes, get row() { return row; }, get reads() { return reads; },
    post: (body) => module.exports.POST(new Request('https://wda.test/api/discover/me/conversation', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), { params: { token: 'me' } }),
  };
}

test('reset persists an empty shortlist and clears selection; refreshing cannot restore the previous niche', async () => {
  const state = harness();
  const response = await state.post({ start: true, reset: true });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.writes[0].recommendations, []);
  assert.equal(state.writes[0].selectedRecommendation, null);
  assert.deepEqual(state.row.recommendations, []);
  assert.equal(state.row.selected_recommendation, null);
  assert.equal(result.session.status, 'in_progress');
  assert.equal(result.session.current_step, 1);
  assert.equal(result.complete, false);
  assert.deepEqual(result.session.recommendations, []);
  assert.equal(result.session.selected_recommendation, null);
  assert.ok(!JSON.stringify(result).includes('Old saved'));
  assert.ok(!('buyer_id' in result.session));
  assert.equal(result.advisor_state.messages.length, 1);
  assert.ok(result.advisor_state.pending_question?.id);

  const resumed = await state.post({ start: true });
  assert.equal(resumed.status, 200);
  const refreshed = await resumed.json();
  assert.equal(state.writes.length, 1, 'Resuming must not rewrite or duplicate the opening question');
  assert.deepEqual(refreshed.session.recommendations, []);
  assert.equal(refreshed.session.selected_recommendation, null);
  assert.equal(refreshed.advisor_state.pending_question.id, result.advisor_state.pending_question.id);
});

test('ordinary resume keeps existing recommendations and selection without resetting saved work', async () => {
  const state = harness();
  const response = await state.post({ start: true });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(state.writes.length, 0);
  assert.equal(result.session.recommendations[0].subindustry_id, 'old-niche');
  assert.equal(result.session.selected_recommendation.subindustry_id, 'old-niche');
});

test('a missing buyer cannot read or reset another session', async () => {
  const state = harness({ authorized: false });
  assert.equal((await state.post({ start: true, reset: true })).status, 404);
  assert.equal(state.reads, 0);
  assert.equal(state.writes.length, 0);
});
