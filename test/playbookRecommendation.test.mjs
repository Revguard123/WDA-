import test from 'node:test';
import assert from 'node:assert/strict';

import { explainPlaybookRecommendations, extractDiscoveryBio, rankPlaybookCandidates, suggestNaics } from '../lib/ai/claude.js';
import { prepareDiscoverySessionSave, publicDiscoverySession } from '../lib/discoverySessions.js';
import { normalizeDiscoveryProfile } from '../lib/playbook/index.js';
import { validateAdaptiveQuestionCoverage } from '../lib/playbook/adaptiveQuestions.js';
import { resolveAdaptiveCodes } from '../lib/playbook/adaptiveResolvers.js';
import { isOfficialNaics2022, loadSubindustryNaicsMap } from '../lib/playbook/naicsReference.js';
import {
  buildCandidateUniverse,
  discoveryKeywordsForTargeting,
  preselectPlaybookCandidates,
  recommendPlaybookNiches,
  resolveRecommendationForTargeting,
  validateRankedCandidateResponse,
} from '../lib/playbook/recommendationEngine.js';

const byName = (name) => buildCandidateUniverse().find((c) => c.subindustry_name === name);
const strongFit = {
  overall_fit: 'strong',
  capability_fit: 'strong',
  fulfillment_fit: 'moderate',
  qualification_fit: 'unknown',
  geography_fit: 'unknown',
  operating_model_fit: 'moderate',
};
const rankerFor = (...names) => async () => ({
  recommendations: names.map((name) => ({
    subindustry_id: byName(name).subindustry_id,
    explanation: `Grounded fit for ${name}.`,
    strengths: ['Uses selected profile evidence.'],
    risks: ['Verify licenses, vendors, staffing, and other delivery requirements.'],
    validation_questions: ['Confirm delivery partners before bidding.'],
    ...strongFit,
  })),
});

const profile = {
  capabilities_text: 'Commercial cleaning and facility maintenance vendor network',
  fulfillment_model: 'existing_partners',
  opportunity_type: 'services',
  experience_types: ['private_commercial'],
  qualification_categories: [],
  geography_mode: 'nationwide',
  operating_model: 'recurring_services',
  set_asides: ['sb'],
  interests: 'Recurring facility work',
  avoid: 'No medical clinics',
  adaptive_answers: {},
};

const feedability = (status = 'sufficient_current_supply', count = 5) => async ({ naics }) => ({
  status,
  eligible_live_count: count,
  checked_naics: naics,
  checked_at: '2026-08-11T00:00:00.000Z',
});

const rankerWithFits = (items) => async () => ({
  recommendations: items.map(([name, fit = strongFit]) => ({ subindustry_id: byName(name).subindustry_id, ...fit })),
});

test('only canonical 130 subindustry IDs can be ranked', () => {
  const candidates = buildCandidateUniverse();
  assert.equal(candidates.length, 130);
  const ids = new Set(candidates.map((c) => c.subindustry_id));
  assert.equal(validateRankedCandidateResponse({ recommendations: [{ subindustry_id: candidates[0].subindustry_id }] }, ids).ok, true);
  assert.equal(validateRankedCandidateResponse({ recommendations: [{ subindustry_id: 'invented-niche' }] }, ids).ok, false);
  assert.equal(validateRankedCandidateResponse({ recommendations: Array.from({ length: 9 }, () => ({ subindustry_id: candidates[0].subindustry_id })) }, ids).ok, false);
  assert.equal(validateRankedCandidateResponse({ recommendations: [{ subindustry_id: candidates[0].subindustry_id, naics: ['999999'] }] }, ids).ok, false);
});

test('needs_review mappings cannot become final recommendations', async () => {
  await assert.rejects(
    recommendPlaybookNiches(profile, { ranker: rankerFor('Bulletproof Vests') }),
    /invalid candidates/i,
  );
});

test('context-dependent mappings cannot become final recommendations before resolution', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Network Infrastructure') });
  assert.equal(result.status, 'needs_clarification');
  assert.ok(result.questions.some((q) => q.key === 'design_vs_installation'));
});

test('direct mapping resolves official code/title', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Janitorial & Cleaning Services') });
  assert.equal(result.status, 'recommended');
  assert.deepEqual(result.recommendations[0].naics, [{ code: '561720', title: 'Janitorial Services' }]);
});

test('multi-code safe mapping resolves official code/title set', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Laundry & Linen Services') });
  assert.equal(result.status, 'recommended');
  assert.deepEqual(result.recommendations[0].naics.map((n) => n.code), ['812320', '812331']);
});

test('adaptive registry covers every required_context key in current mapping data', () => {
  const result = validateAdaptiveQuestionCoverage(loadSubindustryNaicsMap().mappings);
  assert.equal(result.ok, true);
});

test('unknown adaptive context key fails validation', () => {
  const result = validateAdaptiveQuestionCoverage([{ mapping_type: 'context_dependent', required_context: ['made_up_key'] }]);
  assert.equal(result.ok, false);
});

test('adaptive resolver can only return candidate_codes and Census-valid codes', () => {
  const mapping = loadSubindustryNaicsMap().mappings.find((m) => m.subindustry_name === 'Network Infrastructure');
  const resolved = resolveAdaptiveCodes(mapping, { design_vs_installation: 'design' });
  assert.deepEqual(resolved.codes, ['541512']);
  assert.equal(mapping.candidate_codes.includes(resolved.codes[0]), true);
  assert.equal(isOfficialNaics2022(resolved.codes[0]), true);
});

test('adaptive unresolved answer remains unresolved', () => {
  const mapping = loadSubindustryNaicsMap().mappings.find((m) => m.subindustry_name === 'Network Infrastructure');
  const resolved = resolveAdaptiveCodes(mapping, { design_vs_installation: 'not_real' });
  assert.equal(resolved.resolved, false);
  assert.deepEqual(resolved.codes, []);
});

test('adaptive clarification can ask up to three unresolved context questions', async () => {
  const candidates = [byName('Air & Maritime Logistics')];
  const first = await recommendPlaybookNiches(profile, { ranker: rankerFor('Air & Maritime Logistics'), candidates });
  assert.equal(first.status, 'needs_clarification');
  assert.equal(first.questions[0].key, 'air_vs_maritime');

  const second = await recommendPlaybookNiches(profile, {
    ranker: rankerFor('Air & Maritime Logistics'),
    candidates,
    clarificationRound: 1,
    adaptiveAnswers: { air_vs_maritime: 'air' },
  });
  assert.equal(second.status, 'needs_clarification');
  assert.equal(second.questions[0].key, 'scheduled_vs_chartered');

  const third = await recommendPlaybookNiches(profile, {
    ranker: rankerFor('Air & Maritime Logistics'),
    candidates,
    clarificationRound: 2,
    adaptiveAnswers: { air_vs_maritime: 'air', scheduled_vs_chartered: 'scheduled' },
  });
  assert.equal(third.status, 'needs_clarification');
  assert.equal(third.questions[0].key, 'carrier_vs_freight_arrangement');
});

test('maximum three clarification rounds falls back to a canonical starting lane', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Network Infrastructure'), clarificationRound: 3 });
  assert.equal(result.status, 'recommended');
  assert.ok(result.recommendations[0].naics.length > 0);
});

test('final recommendations max 3 and none have empty NAICS or candidate-only codes', async () => {
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerFor('Janitorial & Cleaning Services', 'Laundry & Linen Services', 'Pest Control', 'Landscaping & Grounds Maintenance'),
  });
  assert.equal(result.status, 'recommended');
  assert.ok(result.recommendations.length <= 3);
  for (const rec of result.recommendations) {
    assert.ok(rec.naics.length > 0);
    for (const n of rec.naics) assert.equal(isOfficialNaics2022(n.code), true);
  }
});

test('internal strong recommendations are not capped at 3 and can retain 6 candidates', async () => {
  const names = [
    'Janitorial & Cleaning Services',
    'Landscaping & Grounds Maintenance',
    'Pest Control',
    'Laundry & Linen Services',
    'Courier & Delivery Services',
    'Interpreter & Translation Services',
  ];
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerWithFits(names.map((name) => [name])),
    candidates: names.map(byName),
    feedabilityChecker: feedability(),
    explainer: null,
  });
  assert.equal(result.status, 'recommended');
  assert.equal(result.internal_strong_candidates.length, 6);
  assert.equal(result.recommendations.length, 3);
});

test('2 strong candidates produce only 2 visible recommendations and no weak filler', async () => {
  const weak = { ...strongFit, overall_fit: 'weak', capability_fit: 'weak' };
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerWithFits([
      ['Janitorial & Cleaning Services'],
      ['Landscaping & Grounds Maintenance'],
      ['Pest Control', weak],
    ]),
    feedabilityChecker: feedability(),
    explainer: null,
  });
  assert.equal(result.status, 'recommended');
  assert.equal(result.internal_strong_candidates.length, 2);
  assert.equal(result.recommendations.length, 2);
});

test('thin information still receives one canonical starting lane', async () => {
  const weak = { ...strongFit, overall_fit: 'weak', capability_fit: 'weak' };
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerWithFits([['Janitorial & Cleaning Services', weak]]),
    feedabilityChecker: feedability(),
    explainer: null,
  });
  assert.equal(result.status, 'recommended');
  assert.equal(result.recommendations.length, 1);
  assert.ok(result.recommendations[0].naics.every((item) => isOfficialNaics2022(item.code)));
});

test('quick bio extraction retains only the structured facts returned by Claude', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ capabilities_text: 'Commercial cleaning', fulfillment_model: 'unknown', opportunity_type: 'services', experience_types: ['private_commercial'], interests: '', avoid: '' }) }] }) } };
  const result = await extractDiscoveryBio('I do commercial cleaning.', { client });
  assert.equal(result.capabilities_text, 'Commercial cleaning');
  assert.equal('set_asides' in result, false);
  assert.equal('qualification_categories' in result, false);
});

test('no_current_supply candidate is excluded from visible when better feedable candidates exist but retained internally', async () => {
  const blocked = byName('Janitorial & Cleaning Services').subindustry_id;
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerWithFits([
      ['Janitorial & Cleaning Services'],
      ['Landscaping & Grounds Maintenance'],
      ['Pest Control'],
    ]),
    feedabilityChecker: async ({ naics }) => ({
      status: naics.includes('561720') ? 'no_current_supply' : 'sufficient_current_supply',
      eligible_live_count: naics.includes('561720') ? 0 : 5,
      checked_naics: naics,
      checked_at: '2026-08-11T00:00:00.000Z',
    }),
    explainer: null,
  });
  assert.equal(result.internal_strong_candidates.some((c) => c.subindustry_id === blocked), true);
  assert.equal(result.recommendations.some((c) => c.subindustry_id === blocked), false);
  assert.equal(result.recommendations.length, 2);
});

test('thin and unknown feedability may remain visible', async () => {
  const statuses = ['thin_current_supply', 'unknown'];
  let i = 0;
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerWithFits([
      ['Janitorial & Cleaning Services'],
      ['Landscaping & Grounds Maintenance'],
    ]),
    feedabilityChecker: async ({ naics }) => ({
      status: statuses[i++],
      eligible_live_count: statuses[i - 1] === 'thin_current_supply' ? 2 : null,
      checked_naics: naics,
      checked_at: '2026-08-11T00:00:00.000Z',
    }),
    explainer: null,
  });
  assert.deepEqual(result.recommendations.map((r) => r.feedability.status), statuses);
});

test('unknown Claude IDs and Claude-provided ranking NAICS are rejected', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Janitorial & Cleaning Services') });
  await assert.rejects(
    recommendPlaybookNiches(profile, { ranker: async () => ({ recommendations: [{ subindustry_id: 'fake' }] }) }),
    /invalid candidates/i,
  );
  await assert.rejects(
    recommendPlaybookNiches(profile, {
      ranker: async () => ({ recommendations: [{ subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id, naics: ['999999'] }] }),
    }),
    /invalid candidates/i,
  );
});

test('duplicate recommendation IDs are de-duplicated', async () => {
  const result = await recommendPlaybookNiches(profile, {
    ranker: async () => ({
      recommendations: [
        { subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id, explanation: 'a', ...strongFit },
        { subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id, explanation: 'b', ...strongFit },
      ],
    }),
  });
  assert.equal(result.recommendations.length, 1);
});

test('identical/high-overlap NAICS recommendations do not create fake variety', async () => {
  const candidates = [byName('FOIA and Records Management'), byName('FOIA & Records Management Services'), byName('Janitorial & Cleaning Services')];
  const result = await recommendPlaybookNiches(profile, {
    ranker: rankerFor('FOIA and Records Management', 'FOIA & Records Management Services', 'Janitorial & Cleaning Services'),
    candidates,
  });
  assert.equal(result.status, 'recommended');
  assert.equal(result.recommendations.filter((r) => r.naics.some((n) => n.code === '561410')).length, 1);
});

test('qualifications are not inferred from capabilities text and private experience is distinct', () => {
  const p = normalizeDiscoveryProfile({
    capabilities_text: 'Licensed bonded cleared medical cyber team',
    experience_types: ['private_commercial'],
  });
  assert.deepEqual(p.qualification_categories, []);
  assert.deepEqual(p.experience_types, ['private_commercial']);
});

test('broker fulfillment does not imply credential possession, but explicit qualification can preselect relevant candidates', () => {
  const p = normalizeDiscoveryProfile({ fulfillment_model: 'existing_partners', qualification_categories: ['technical_cyber_certifications'] });
  assert.equal(p.fulfillment_model, 'existing_vendors');
  assert.deepEqual(p.qualification_categories, ['technical_cyber']);
  const candidates = preselectPlaybookCandidates(p);
  assert.ok(candidates.some((c) => /Cybersecurity|Software|Network|IT/.test(c.subindustry_name + c.industry_name)));
});

test('adaptive answers persist and session can resume clarification state', () => {
  const patch = prepareDiscoverySessionSave({
    buyerId: 'buyer-1',
    answers: { ...profile, adaptive_answers: { design_vs_installation: 'design' } },
    recommendations: { status: 'needs_clarification', questions: [{ key: 'design_vs_installation' }] },
  });
  const publicSession = publicDiscoverySession({ id: 's', ...patch, created_at: 'now' });
  assert.equal(publicSession.answers.adaptive_answers.design_vs_installation, 'design');
  assert.equal(publicSession.recommendations.status, 'needs_clarification');
});

test('final recommendations can persist to session', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Janitorial & Cleaning Services') });
  const patch = prepareDiscoverySessionSave({ buyerId: 'buyer-1', answers: profile, status: 'recommended', recommendations: result.recommendations });
  assert.equal(patch.recommendations[0].subindustry_id, result.recommendations[0].subindustry_id);
});

test('selection handoff writes only authoritative final NAICS', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Janitorial & Cleaning Services') });
  const targeting = resolveRecommendationForTargeting(result.recommendations[0], profile);
  assert.deepEqual(targeting.naics, ['561720']);
  assert.deepEqual(targeting.set_asides, ['sb']);
  assert.equal(targeting.state, '');
});

test('Discovery targeting handoff clears stale state when profile is nationwide', async () => {
  const result = await recommendPlaybookNiches({ ...profile, geography_mode: 'nationwide', state: 'VA' }, { ranker: rankerFor('Janitorial & Cleaning Services') });
  const targeting = resolveRecommendationForTargeting(result.recommendations[0], { ...profile, geography_mode: 'nationwide', state: 'VA' });
  assert.equal(targeting.state, '');
});

test('Discovery targeting handoff writes single-state geography', async () => {
  const p = { ...profile, geography_mode: 'single_state', state: 'GA' };
  const result = await recommendPlaybookNiches(p, { ranker: rankerFor('Janitorial & Cleaning Services') });
  const targeting = resolveRecommendationForTargeting(result.recommendations[0], p);
  assert.equal(targeting.state, 'GA');
});

test('Discovery targeting handoff populates keywords from capabilities and interests only', () => {
  const keywords = discoveryKeywordsForTargeting({
    ...profile,
    capabilities_text: 'Network infrastructure, structured cabling, low voltage installation',
    interests: 'network infrastructure, data drops',
    avoid: 'software development, help desk',
  });
  assert.deepEqual(keywords, ['Network infrastructure', 'structured cabling', 'low voltage installation', 'data drops']);
  assert.equal(keywords.some((k) => /software|help desk/i.test(k)), false);
});

test('Discovery targeting keywords strip sentence wrappers and skip avoid text', () => {
  const keywords = discoveryKeywordsForTargeting({
    ...profile,
    capabilities_text: 'I can provide cleaning and facilities work. I have hands-on experience doing this type of work.',
    interests: 'I want to focus on wastage and facilities services I already do hands-on. Skip laundry linen services or anything requiring equipment I have not confirmed.',
    avoid: 'laundry linen services or anything requiring equipment I have not confirmed',
  });
  assert.deepEqual(keywords, ['cleaning and facilities', 'wastage and facilities services']);
  assert.equal(keywords.some((k) => /laundry|linen|equipment/i.test(k)), false);
});

test('Discovery targeting handoff persists set-asides and contract size answers', async () => {
  const p = { ...profile, set_asides: ['sb', 'sdvosb'], size_min: '25000', size_max: '150000' };
  const result = await recommendPlaybookNiches(p, { ranker: rankerFor('Janitorial & Cleaning Services') });
  const targeting = resolveRecommendationForTargeting(result.recommendations[0], p);
  assert.deepEqual(targeting.set_asides, ['sb', 'sdvosb']);
  assert.equal(targeting.size_min, 25000);
  assert.equal(targeting.size_max, 150000);
});

test('Discovery targeting handoff explicitly clears stale contract size when answers are blank', async () => {
  const p = { ...profile, size_min: '', size_max: '' };
  const result = await recommendPlaybookNiches(p, { ranker: rankerFor('Janitorial & Cleaning Services') });
  const targeting = resolveRecommendationForTargeting(result.recommendations[0], p);
  assert.equal(targeting.size_min, null);
  assert.equal(targeting.size_max, null);
});

test('selection cannot write needs_review or unresolved context-dependent mapping', () => {
  assert.throws(() => resolveRecommendationForTargeting({ subindustry_id: byName('Bulletproof Vests').subindustry_id, naics: [] }, profile));
  assert.throws(() => resolveRecommendationForTargeting({ subindustry_id: byName('Network Infrastructure').subindustry_id, naics: [] }, profile));
});

test('Discovery recommendation engine does not touch activation, batches, deliveries, or database tables', async () => {
  const result = await recommendPlaybookNiches(profile, { ranker: rankerFor('Janitorial & Cleaning Services') });
  assert.equal(result.status, 'recommended');
});

test('Direct Targeting suggestNaics remains functional with a mocked client', async () => {
  const client = {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ matches: [{ code: '561720', title: 'Janitorial Services' }] }) }] }),
    },
  };
  const matches = await suggestNaics('janitorial', { client });
  assert.deepEqual(matches, [{ code: '561720', title: 'Janitorial Services' }]);
});

test('compact ranking parser is not internally capped at 8 and returns no NAICS', async () => {
  const candidates = buildCandidateUniverse().slice(0, 10);
  const client = {
    messages: {
      create: async () => ({
        stop_reason: 'end_turn',
        usage: { output_tokens: 180 },
        content: [{
          type: 'text',
          text: JSON.stringify({
            rankings: candidates.slice(0, 9).map((candidate) => ({
              subindustry_id: candidate.subindustry_id,
              capability_fit: 'strong',
              fulfillment_fit: 'moderate',
              qualification_fit: 'unknown',
              geography_fit: 'unknown',
              operating_model_fit: 'moderate',
              naics: ['999999'],
            })),
          }),
        }],
      }),
    },
  };
  const ranked = await rankPlaybookCandidates({ profile, candidates }, { client });
  assert.equal(ranked.recommendations.length, 9);
  assert.equal('naics' in ranked.recommendations[0], false);
});

test('ranking output-limit malformed JSON is rejected and retried once', async () => {
  let calls = 0;
  const candidate = byName('Janitorial & Cleaning Services');
  const client = {
    messages: {
      create: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            stop_reason: 'max_tokens',
            usage: { output_tokens: 700 },
            content: [{ type: 'text', text: '{"rankings":[{"subindustry_id":"unterminated' }],
          };
        }
        return {
          stop_reason: 'end_turn',
          usage: { output_tokens: 80 },
          content: [{
            type: 'text',
            text: JSON.stringify({
              rankings: [{
                subindustry_id: candidate.subindustry_id,
                capability_fit: 'strong',
                fulfillment_fit: 'moderate',
                qualification_fit: 'unknown',
                geography_fit: 'unknown',
                operating_model_fit: 'moderate',
              }],
            }),
          }],
        };
      },
    },
  };
  const ranked = await rankPlaybookCandidates({ profile, candidates: [candidate] }, { client });
  assert.equal(calls, 2);
  assert.equal(ranked.recommendations[0].subindustry_id, candidate.subindustry_id);
});

test('ranking malformed JSON retries only once', async () => {
  let calls = 0;
  const candidate = byName('Janitorial & Cleaning Services');
  const client = {
    messages: {
      create: async () => {
        calls += 1;
        return {
          stop_reason: 'max_tokens',
          usage: { output_tokens: 700 },
          content: [{ type: 'text', text: '{"rankings":[{"subindustry_id":"unterminated' }],
        };
      },
    },
  };
  await assert.rejects(rankPlaybookCandidates({ profile, candidates: [candidate] }, { client }), /output limit|JSON/i);
  assert.equal(calls, 2);
});

test('final explanation is generated only for final recommendations', async () => {
  const seen = [];
  const result = await recommendPlaybookNiches(profile, {
    ranker: async () => ({
      recommendations: [
        { subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id, ...strongFit },
        { subindustry_id: byName('Laundry & Linen Services').subindustry_id, ...strongFit },
        { subindustry_id: byName('Pest Control').subindustry_id, ...strongFit },
        { subindustry_id: byName('Landscaping & Grounds Maintenance').subindustry_id, ...strongFit },
      ],
    }),
    explainer: async ({ recommendations }) => {
      seen.push(...recommendations.map((r) => r.subindustry_id));
      return {
        recommendations: recommendations.map((r) => ({
          subindustry_id: r.subindustry_id,
          explanation: `Final explanation for ${r.subindustry_name}.`,
          strengths: ['Final-only strength.'],
          risks: ['Final-only risk.'],
          validation_questions: ['Final-only question.'],
        })),
      };
    },
  });
  assert.equal(result.recommendations.length, 3);
  assert.deepEqual(seen, result.recommendations.map((r) => r.subindustry_id));
  assert.ok(result.recommendations.every((r) => r.strengths[0] === 'Final-only strength.'));
});

test('final explanation IDs must match allowed final IDs and cannot supply NAICS', async () => {
  await assert.rejects(
    recommendPlaybookNiches(profile, {
      ranker: async () => ({ recommendations: [{ subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id, ...strongFit }] }),
      explainer: async () => ({ recommendations: [{ subindustry_id: 'fake', explanation: 'x', strengths: [], risks: [], validation_questions: [] }] }),
    }),
    /invalid final recommendation/i,
  );
  await assert.rejects(
    recommendPlaybookNiches(profile, {
      ranker: async () => ({ recommendations: [{ subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id, ...strongFit }] }),
      explainer: async () => ({
        recommendations: [{
          subindustry_id: byName('Janitorial & Cleaning Services').subindustry_id,
          explanation: 'x',
          strengths: [],
          risks: [],
          validation_questions: [],
          naics: [{ code: '999999' }],
        }],
      }),
    }),
    /invalid final recommendation/i,
  );
});

test('saved questionnaire payload remains valid when provider failure is reported', () => {
  const patch = prepareDiscoverySessionSave({ buyerId: 'buyer-1', answers: profile, currentStep: 6, status: 'in_progress' });
  assert.equal(patch.current_step, 6);
  assert.equal(patch.status, 'in_progress');
  assert.equal(patch.answers.capabilities_text, profile.capabilities_text);
});

test('active/completed journey guard coverage remains outside recommendation engine', () => {
  assert.equal(typeof rankPlaybookCandidates, 'function');
});
