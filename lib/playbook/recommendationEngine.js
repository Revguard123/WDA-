import { explainPlaybookRecommendations, rankPlaybookCandidates } from '../ai/claude.js';
import {
  getAdaptiveQuestion,
  questionsForContextKeys,
  validateAdaptiveQuestionCoverage,
} from './adaptiveQuestions.js';
import { resolveAdaptiveCodes, validateAdaptiveResolverCoverage } from './adaptiveResolvers.js';
import {
  getOfficialNaicsTitle,
  isOfficialNaics2022,
  loadSubindustryNaicsMap,
} from './naicsReference.js';
import { loadPlaybook, normalizeDiscoveryProfile } from './index.js';
import { createFeedabilityChecker } from './feedability.js';
import { capabilityPriorityIndustry, normalizeCapabilityPriority, statedCapabilityLanes, agricultureRelatedCandidateNames, AGRICULTURE_COVERAGE_NOTE } from './capabilityContext.js';
import { discoveryClarificationQuestion } from './discoveryClarifications.js';
import { candidateMatchesDirection, rejectedCandidate, unsupportedWorkMessage } from './workPreferences.js';
import { monthlyBudgetQuestion, unresolvedBudgetMessage } from './intakeEvidence.js';

const FIT_VALUES = ['strong', 'moderate', 'weak', 'unknown'];
const MAX_ADAPTIVE_CLARIFICATION_ROUNDS = 3;

function safeDiscoveryLog(logger, stage, fields = {}, level = 'info') {
  const target = logger?.[level] || logger?.info;
  if (typeof target === 'function') {
    target.call(logger, { event: 'playbook_discovery_debug', stage, ...fields });
  }
}

function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

function intersects(a = [], b = []) {
  const set = new Set(b);
  return a.some((x) => set.has(x));
}

export function buildCandidateUniverse({ playbook = loadPlaybook(), mappingPayload = loadSubindustryNaicsMap() } = {}) {
  const mappings = new Map((mappingPayload.mappings || []).map((m) => [m.subindustry_id, m]));
  const candidates = [];
  for (const industry of playbook.industries || []) {
    for (const sub of industry.subindustries || []) {
      const mapping = mappings.get(sub.id);
      if (!mapping) continue;
      candidates.push({
        subindustry_id: sub.id,
        subindustry_name: sub.name,
        industry_name: industry.name,
        description: sub.description,
        broker_guidance: sub.broker_guidance,
        competition: industry.competition_level || 'unknown',
        award_method: industry.primary_award_method || '',
        market_growth: industry.market_growth || '',
        mapping_type: mapping.mapping_type,
        production_safe: mapping.production_safe === true,
        codes: mapping.codes || [],
        candidate_codes: mapping.candidate_codes || [],
        required_context: mapping.required_context || [],
        mapping_status: mapping.mapping_status,
        mapping_notes: mapping.mapping_notes || '',
      });
    }
  }
  return candidates;
}

export function validatePlaybookRecommendationFoundation({ playbook = loadPlaybook(), mappingPayload = loadSubindustryNaicsMap() } = {}) {
  const candidates = buildCandidateUniverse({ playbook, mappingPayload });
  const questionCoverage = validateAdaptiveQuestionCoverage(mappingPayload.mappings || []);
  const keys = [...new Set((mappingPayload.mappings || []).flatMap((m) => m.required_context || []))];
  const resolverCoverage = validateAdaptiveResolverCoverage(keys);
  return {
    ok: candidates.length === 130 && questionCoverage.ok && resolverCoverage.ok,
    candidates,
    questionCoverage,
    resolverCoverage,
  };
}

function candidateText(candidate) {
  return [
    candidate.subindustry_name,
    candidate.industry_name,
    candidate.description,
    candidate.broker_guidance,
  ].join(' ').toLowerCase();
}

export function preselectPlaybookCandidates(profileInput, { candidates = buildCandidateUniverse(), limit = 25 } = {}) {
  const profile = normalizeDiscoveryProfile(profileInput);
  const query = words(profile.adaptive_answers.work_direction === 'another_area' ? profile.adaptive_answers.preferred_work : [profile.capabilities_text, profile.experience_notes, profile.qualification_notes, profile.interests, profile.adaptive_answers.agriculture_work, profile.adaptive_answers.preferred_work].join(' '));
  const productish = profile.opportunity_type === 'product';
  const serviceish = profile.opportunity_type === 'service';
  const recurring = profile.operating_model === 'recurring_service';
  const volumeProduct = profile.operating_model === 'volume_product';

  const priorityIndustry = profile.adaptive_answers.work_direction ? '' : capabilityPriorityIndustry(profile);
  const agricultureOnly = profile.adaptive_answers.capability_priority === 'agriculture' || (statedCapabilityLanes(profile).length === 1 && statedCapabilityLanes(profile)[0].value === 'agriculture');
  const relatedNames = agricultureRelatedCandidateNames(profile.adaptive_answers.agriculture_work);
  const eligible = candidates.filter((c) => c.mapping_type !== 'needs_review' && (!priorityIndustry || c.industry_name === priorityIndustry)
    && !rejectedCandidate(c, profile) && candidateMatchesDirection(c, profile)
    && (!agricultureOnly || relatedNames.includes(c.subindustry_name))
    && (!/veterinar/i.test(c.subindustry_name) || /veterinar/i.test([profile.capabilities_text, profile.experience_notes, profile.qualification_notes].join(' '))));
  const ranked = eligible.map((candidate, index) => {
    const text = candidateText(candidate);
    let signal = 0;
    for (const word of query) if (text.includes(word)) signal += 1;
    if (productish && /product|supply|procurement|equipment|furniture|vehicle|ammunition|materials/i.test(candidate.industry_name + candidate.subindustry_name)) signal += 2;
    if (serviceish && /services|support|construction|healthcare|logistics|training|consulting|security|facilities/i.test(candidate.industry_name + candidate.subindustry_name)) signal += 2;
    if (recurring && /janitorial|maintenance|staffing|guard|support|laundry|landscaping|pest|facilities/i.test(text)) signal += 1;
    if (volumeProduct && /supply|procurement|equipment|consumables|parts|materials/i.test(text)) signal += 1;
    if (profile.qualification_categories.includes('technical_cyber') && /cyber|software|network|it |computer/i.test(text)) signal += 2;
    if (profile.qualification_categories.includes('healthcare_medical') && /medical|health|clinical|veterinary/i.test(text)) signal += 2;
    if (profile.qualification_categories.includes('environmental_safety') && /environmental|waste|water|energy|remediation/i.test(text)) signal += 2;
    if (profile.qualification_categories.includes('security_clearances') && /security|tactical|guard|surveillance/i.test(text)) signal += 1;
    return { candidate, signal, index };
  }).sort((a, b) => b.signal - a.signal || a.index - b.index);

  // Reserve room for every stated, supported background when comparing areas.
  // This is candidate consideration, not a claim of readiness or credentials.
  const representedIndustries = priorityIndustry || profile.adaptive_answers.work_direction ? [] : statedCapabilityLanes(profile)
    .map((lane) => capabilityPriorityIndustry({ adaptive_answers: { capability_priority: lane.value } })).filter(Boolean);
  const reserved = representedIndustries.flatMap((industry) => ranked.filter((r) => r.candidate.industry_name === industry).slice(0, 2).map((r) => r.candidate));
  const selected = [...new Set([...reserved, ...ranked.filter((r) => r.signal > 0).map((r) => r.candidate)])].slice(0, limit);
  if (selected.length >= 10) return selected;
  for (const r of ranked) {
    if (selected.includes(r.candidate)) continue;
    selected.push(r.candidate);
    if (selected.length >= Math.min(limit, 18)) break;
  }
  return selected;
}

function compactCandidateForClaude(c) {
  return {
    subindustry_id: c.subindustry_id,
    subindustry_name: c.subindustry_name,
    industry_name: c.industry_name,
    description: c.description.slice(0, 500),
    broker_guidance: c.broker_guidance.slice(0, 500),
    competition: c.competition,
    award_method: c.award_method,
    mapping_type: c.mapping_type,
    production_safe: c.production_safe,
    required_context: c.required_context,
  };
}

export function validateRankedCandidateResponse(response = {}, candidateIds = new Set()) {
  const errors = [];
  const recs = Array.isArray(response.recommendations) ? response.recommendations : [];
  if (recs.length > 8) errors.push({ path: '$.recommendations', message: 'ranking response must not contain more than 8 candidates' });
  for (const [index, rec] of recs.entries()) {
    if (!candidateIds.has(rec.subindustry_id)) errors.push({ path: `$.recommendations[${index}].subindustry_id`, message: 'unknown canonical subindustry_id' });
    if ('naics' in rec) errors.push({ path: `$.recommendations[${index}].naics`, message: 'ranking response must not include NAICS' });
    if (rec.overall_fit && !FIT_VALUES.includes(rec.overall_fit)) errors.push({ path: `$.recommendations[${index}].overall_fit`, message: 'invalid fit enum' });
    for (const key of ['capability_fit', 'fulfillment_fit', 'qualification_fit', 'geography_fit', 'operating_model_fit']) {
      if (rec[key] && !FIT_VALUES.includes(rec[key])) errors.push({ path: `$.recommendations[${index}].${key}`, message: 'invalid fit enum' });
    }
  }
  return { ok: errors.length === 0, errors };
}

function dedupeRanked(recs = []) {
  const seen = new Set();
  return recs.filter((rec) => {
    if (seen.has(rec.subindustry_id)) return false;
    seen.add(rec.subindustry_id);
    return true;
  });
}

function inferredOverallFit(rec = {}) {
  if (['strong', 'moderate', 'weak'].includes(rec.overall_fit)) return rec.overall_fit;
  const core = [rec.capability_fit, rec.fulfillment_fit, rec.geography_fit, rec.operating_model_fit];
  if (core.includes('weak')) return 'weak';
  const positive = core.filter((v) => v === 'strong' || v === 'moderate').length;
  return positive >= 3 ? 'strong' : 'moderate';
}

export function isStrongRankedCandidate(rec = {}) {
  const overall = inferredOverallFit(rec);
  if (overall !== 'strong') return false;
  for (const key of ['capability_fit', 'fulfillment_fit', 'geography_fit', 'operating_model_fit']) {
    if (rec[key] === 'weak') return false;
  }
  return true;
}

function officialNaics(codes = []) {
  return codes.filter(isOfficialNaics2022).map((code) => ({ code, title: getOfficialNaicsTitle(code) }));
}

function overlapTooHigh(a, b) {
  const A = new Set(a.naics.map((n) => n.code));
  const B = new Set(b.naics.map((n) => n.code));
  if (A.size === 0 || B.size === 0) return false;
  const overlap = [...A].filter((x) => B.has(x)).length;
  return overlap === A.size || overlap === B.size;
}

function buildRecommendation(candidate, ranked = {}, codes) {
  const naics = officialNaics(codes);
  if (naics.length === 0) return null;
  return {
    subindustry_id: candidate.subindustry_id,
    subindustry_name: candidate.subindustry_name,
    industry_name: candidate.industry_name,
    naics,
    explanation: String(ranked.explanation || '').trim() || `This fits the profile based on the supplied answers and the War Dogs source guidance for ${candidate.subindustry_name}.`,
    strengths: Array.isArray(ranked.strengths) ? ranked.strengths.slice(0, 4).map(String) : [],
    risks: Array.isArray(ranked.risks) ? ranked.risks.slice(0, 4).map(String) : [],
    validation_questions: Array.isArray(ranked.validation_questions) ? ranked.validation_questions.slice(0, 4).map(String) : [],
    competition: candidate.competition,
    mapping_type: candidate.mapping_type,
  };
}

function resolveCandidateCodes(candidate, adaptiveAnswers = {}) {
  if (candidate.mapping_type === 'needs_review') return { resolved: false, codes: [], unresolved_keys: candidate.required_context };
  if (candidate.production_safe) {
    const codes = candidate.subindustry_name === 'Utility Vehicles & Trailers' && adaptiveAnswers.work_direction === 'rentals'
      ? (candidate.codes || []).filter((code) => code === '532120') : candidate.codes || [];
    return { resolved: codes.length > 0, codes, unresolved_keys: [] };
  }
  return resolveAdaptiveCodes(candidate, adaptiveAnswers);
}

export async function recommendPlaybookNiches(profileInput, {
  adaptiveAnswers = {},
  clarificationRound = 0,
  adaptiveAttempts = {},
  ranker = rankPlaybookCandidates,
  explainer = explainPlaybookRecommendations,
  candidates = buildCandidateUniverse(),
  logger = null,
  feedabilityChecker = createFeedabilityChecker({ logger }),
} = {}) {
  let profile = normalizeDiscoveryProfile(profileInput);
  adaptiveAttempts = { ...profile.adaptive_attempts, ...adaptiveAttempts };
  adaptiveAnswers = { ...profile.adaptive_answers, ...adaptiveAnswers };
  if (adaptiveAnswers.capability_priority) {
    adaptiveAnswers.capability_priority = normalizeCapabilityPriority(adaptiveAnswers.capability_priority, profile)
      || ((adaptiveAttempts.capability_priority || 0) >= 2 ? 'compare_all' : '');
  }
  profile = normalizeDiscoveryProfile({ ...profile, adaptive_answers: adaptiveAnswers, adaptive_attempts: adaptiveAttempts });
  adaptiveAnswers = profile.adaptive_answers;
  const contextQuestion = discoveryClarificationQuestion(profile);
  if (contextQuestion) {
    return { status: 'needs_clarification', questions: [contextQuestion], preliminary_candidate_ids: [] };
  }
  const rentalMessage = unsupportedWorkMessage(profile);
  if (rentalMessage) return { status: 'no_recommendation', message: rentalMessage };
  const budgetMessage = unresolvedBudgetMessage(profile);
  if (budgetMessage) return { status: 'no_recommendation', message: budgetMessage };
  const lanes = statedCapabilityLanes(profile);
  if ((adaptiveAnswers.capability_priority === 'agriculture' || (lanes.length === 1 && lanes[0].value === 'agriculture'))
      && !agricultureRelatedCandidateNames(adaptiveAnswers.agriculture_work).length) {
    return { status: 'no_recommendation', message: `${AGRICULTURE_COVERAGE_NOTE} Your agricultural experience is saved. Edit your answers to choose another area to evaluate; we will not substitute an unrelated niche.` };
  }
  safeDiscoveryLog(logger, 'profile_normalization', {
    has_capabilities_text: Boolean(profile.capabilities_text),
    experience_type_count: profile.experience_types.length,
    qualification_category_count: profile.qualification_categories.length,
    set_aside_count: profile.set_asides.length,
  });
  safeDiscoveryLog(logger, 'candidate_construction', {
    candidate_count: candidates.length,
  });
  const preselected = preselectPlaybookCandidates(profile, { candidates });
  if (!preselected.length) return { status: 'no_recommendation', message: 'The current Playbook has no verified match for the work you selected. Your answers are saved. Edit your answers to explore another area or contact support; we will not replace it with work you ruled out.' };
  safeDiscoveryLog(logger, 'candidate_preselection', {
    candidate_count: candidates.length,
    preselected_candidate_count: preselected.length,
  });
  const candidateIds = new Set(preselected.map((c) => c.subindustry_id));
  const rankedRaw = await ranker({
    profile,
    candidates: preselected.map(compactCandidateForClaude),
  }, { logger });
  const validation = validateRankedCandidateResponse(rankedRaw, candidateIds);
  if (!validation.ok) {
    safeDiscoveryLog(logger, 'canonical_id_validation_failed', {
      validation_failure_count: validation.errors.length,
      validation_failure_reason: validation.errors.map((e) => e.message).slice(0, 4).join('; '),
    }, 'error');
    const err = new Error('Bounded Playbook ranking returned invalid candidates');
    err.validation = validation;
    throw err;
  }
  safeDiscoveryLog(logger, 'canonical_id_validation_passed', {
    returned_recommendation_id_count: Array.isArray(rankedRaw.recommendations) ? rankedRaw.recommendations.length : 0,
  });

  const byId = new Map(preselected.map((c) => [c.subindustry_id, c]));
  const ranked = dedupeRanked(rankedRaw.recommendations || []).map((r) => ({ ranked: r, candidate: byId.get(r.subindustry_id) })).filter((x) => x.candidate);
  const strongRanked = ranked.filter(({ ranked: rank }) => isStrongRankedCandidate(rank));
  safeDiscoveryLog(logger, 'strong_candidate_retention', {
    ranked_candidate_count: ranked.length,
    strong_candidate_count: strongRanked.length,
  });

  if (clarificationRound < MAX_ADAPTIVE_CLARIFICATION_ROUNDS) {
    const keys = [];
    for (const { candidate } of strongRanked.slice(0, 8)) {
      const resolved = resolveCandidateCodes(candidate, adaptiveAnswers);
      if (!resolved.resolved && candidate.mapping_type === 'context_dependent') keys.push(...resolved.unresolved_keys);
      if (keys.length >= 4) break;
    }
    const questions = questionsForContextKeys(keys).filter((question) => (adaptiveAttempts[question.key] || 0) < 2).slice(0, 1);
    if (questions.length > 0) {
      safeDiscoveryLog(logger, 'adaptive_clarification_decision', {
        question_count: questions.length,
        preliminary_candidate_count: ranked.slice(0, 5).length,
      });
      return { status: 'needs_clarification', questions, preliminary_candidate_ids: strongRanked.slice(0, 8).map((r) => r.candidate.subindustry_id) };
    }
  }
  safeDiscoveryLog(logger, 'adaptive_clarification_decision', {
    question_count: 0,
    ranked_candidate_count: strongRanked.length,
  });

  const strongCandidates = [];
  for (const { candidate, ranked: rank } of strongRanked) {
    const resolved = resolveCandidateCodes(candidate, adaptiveAnswers);
    if (!resolved.resolved) continue;
    const rec = buildRecommendation(candidate, rank, resolved.codes);
    if (!rec) continue;
    rec.__needs_explanation = !rank.explanation;
    rec.fit = { overall: inferredOverallFit(rank) };
    rec.feedability = await feedabilityChecker({ naics: rec.naics.map((n) => n.code), profile });
    strongCandidates.push(rec);
  }

  const feedableCandidates = strongCandidates.filter((rec) => rec.feedability?.status !== 'no_current_supply');
  const recommendations = [];
  for (const rec of feedableCandidates) {
    if (recommendations.some((existing) => overlapTooHigh(existing, rec))) continue;
    recommendations.push(rec);
    if (recommendations.length >= 3) break;
  }
  // A thin profile still gets one conservative, canonical starting lane. This is
  // intentionally deterministic and never bypasses official NAICS resolution.
  if (recommendations.length === 0) {
    if (strongRanked.some(({ candidate }) => !resolveCandidateCodes(candidate, adaptiveAnswers).resolved)) {
      return { status: 'no_recommendation', message: 'We still need a clear description of the work before choosing safe industry codes. Your answers are saved. Edit your answers or contact support; we will not keep asking the same question.' };
    }
    const fallbackPool = profile.adaptive_answers.work_direction ? ranked : [...ranked, ...preselected.map((candidate) => ({ candidate, ranked: {} }))];
    const seenFallbacks = new Set();
    for (const item of fallbackPool) {
      const candidate = item.candidate;
      if (!candidate || seenFallbacks.has(candidate.subindustry_id)) continue;
      seenFallbacks.add(candidate.subindustry_id);
      if (inferredOverallFit(item.ranked) === 'weak') continue;
      const resolved = resolveCandidateCodes(candidate, adaptiveAnswers);
      if (!resolved.resolved) continue;
      const rec = buildRecommendation(candidate, item.ranked, resolved.codes);
      if (!rec) continue;
      rec.__needs_explanation = true;
      rec.fit = { overall: 'moderate' };
      rec.feedability = await feedabilityChecker({ naics: rec.naics.map((n) => n.code), profile });
      recommendations.push(rec);
      break;
    }
  }
  const internalStrongCandidates = strongCandidates.map((rec) => ({
    subindustry_id: rec.subindustry_id,
    feedability: rec.feedability,
    naics: rec.naics,
  }));

  const shouldGenerateExplanations = explainer && (ranker === rankPlaybookCandidates || explainer !== explainPlaybookRecommendations);
  if (recommendations.length > 0 && shouldGenerateExplanations && recommendations.some((rec) => rec.__needs_explanation)) {
    safeDiscoveryLog(logger, 'claude_final_explanation_stage', { recommendation_count: recommendations.length });
    const allowedIds = new Set(recommendations.map((rec) => rec.subindustry_id));
    const explainedRaw = await explainer({ profile, recommendations }, { logger });
    const explained = Array.isArray(explainedRaw?.recommendations) ? explainedRaw.recommendations : [];
    const invalid = explained.find((rec) => !allowedIds.has(rec.subindustry_id));
    const naicsLeak = explained.find((rec) => 'naics' in rec);
    if (invalid || naicsLeak) {
      safeDiscoveryLog(logger, 'final_explanation_validation_failed', {
        validation_failure_reason: invalid ? 'unknown final recommendation subindustry_id' : 'explanation response must not include NAICS',
      }, 'error');
      const err = new Error('Playbook explanation returned invalid final recommendation content');
      err.validation = {
        ok: false,
        errors: [{
          path: invalid ? '$.recommendations[].subindustry_id' : '$.recommendations[].naics',
          message: invalid ? 'unknown final recommendation subindustry_id' : 'explanation response must not include NAICS',
        }],
      };
      throw err;
    }
    const byId = new Map(explained.map((rec) => [rec.subindustry_id, rec]));
    for (const rec of recommendations) {
      const content = byId.get(rec.subindustry_id);
      if (!content) continue;
      rec.explanation = content.explanation || rec.explanation;
      rec.strengths = Array.isArray(content.strengths) ? content.strengths : rec.strengths;
      rec.risks = Array.isArray(content.risks) ? content.risks : rec.risks;
      rec.validation_questions = Array.isArray(content.validation_questions) ? content.validation_questions : rec.validation_questions;
    }
    safeDiscoveryLog(logger, 'final_explanation_validation_passed', { returned_recommendation_id_count: explained.length });
  }
  for (const rec of recommendations) delete rec.__needs_explanation;

  safeDiscoveryLog(logger, 'final_recommendation_assembly', {
    status: recommendations.length === 0 ? 'no_recommendation' : 'recommended',
    recommendation_count: recommendations.length,
    internal_strong_candidate_count: strongCandidates.length,
  });
  return recommendations.length
    ? { status: 'recommended', recommendations, internal_strong_candidates: internalStrongCandidates }
    : { status: 'no_recommendation', message: 'We could not safely resolve a niche from those answers. Your answers are saved. Edit your answers to clarify the work you can deliver, or contact support.' };
}

export function resolveRecommendationForTargeting(recommendation, profileInput) {
  if (!recommendation || !recommendation.subindustry_id) throw new Error('recommendation is required');
  if (!Array.isArray(recommendation.naics) || recommendation.naics.length === 0) throw new Error('recommendation has no production-safe NAICS codes');
  const naics = recommendation.naics.map((n) => n.code).filter(isOfficialNaics2022);
  if (naics.length !== recommendation.naics.length || naics.length === 0) throw new Error('recommendation contains non-authoritative NAICS codes');
  const profile = normalizeDiscoveryProfile(profileInput || {});
  const candidate = buildCandidateUniverse().find((item) => item.subindustry_id === recommendation.subindustry_id);
  if (monthlyBudgetQuestion(profile) || profile.contract_size_basis === 'monthly_unconfirmed') throw new Error('Confirm the total contract value before applying targeting');
  if (candidate && (rejectedCandidate(candidate, profile) || !candidateMatchesDirection(candidate, profile))) throw new Error('This recommendation conflicts with the selected work preferences');
  if (profile.adaptive_answers.work_direction === 'rentals' && naics.some((code) => code !== '532120')) throw new Error('Regenerate the recommendation for the selected rental category');
  return {
    naics,
    keywords: discoveryKeywordsForTargeting(profile),
    set_asides: profile.set_asides,
    state: profile.geography_mode === 'single_state' ? profile.state : '',
    size_min: profile.size_min,
    size_max: profile.size_max,
  };
}

export function discoveryKeywordsForTargeting(profileInput = {}) {
  const profile = normalizeDiscoveryProfile(profileInput || {});
  if (profile.adaptive_answers.work_direction === 'rentals' && profile.adaptive_answers.rental_scope === 'trucks_trailers') return ['truck rental', 'utility trailer rental'];
  const seen = new Set();
  const keywords = [];
  const avoid = String(profile.avoid || '').toLowerCase();
  const keywordSources = profile.adaptive_answers.work_direction === 'another_area' ? [profile.adaptive_answers.preferred_work] : [profile.capabilities_text, profile.interests];
  for (const source of keywordSources) {
    for (const raw of String(source || '').split(/[,;.\n\r]+/)) {
      const clean = raw
        .replace(/\s+/g, ' ')
        .replace(/^(i|we)\s+(can|could|will|would|am able to|are able to)\s+(provide|deliver|manage|source|support)\s+/i, '')
        .replace(/^(i|we)\s+(want to|would like to)\s+(focus on|include|pursue)\s+/i, '')
        .replace(/\s+(i|we)\s+(already\s+)?(do|deliver|provide|manage|source).*/i, '')
        .replace(/\s+(work|contracts?)$/i, '')
        .trim();
      if (!clean || /\b(i have|i haven't|i am|we have|we haven't|not confirmed|anything requiring|this type of work)\b/i.test(clean)) continue;
      const key = clean.toLowerCase();
      if (avoid && (avoid.includes(key) || key.includes(avoid))) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      keywords.push(clean.slice(0, 100));
      if (keywords.length >= 12) return keywords;
    }
  }
  return keywords;
}
