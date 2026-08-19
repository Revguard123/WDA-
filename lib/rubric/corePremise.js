// Runtime representation of lib/rubric/the-core-premise.docx.
// Source reference: "The core premise" DOCX says value is subtraction, not
// volume: throw out unwinnable work, then explain the few worth the student's
// time. Keep this module deterministic; do not parse the DOCX at runtime.

import { buyerQualifiesForSetAside, isFullAndOpen, SAM_TO_INTERNAL } from '../sam/setAsides.js';
import { matchStrength } from '../match/keywords.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CORE_PREMISE_RUBRIC = {
  hard_disqualifiers: [
    'expired_response_deadline',
    'set_aside_mismatch',
    'known_mandatory_license_mismatch',
    'specific_federal_past_performance_mismatch',
    'mandatory_step_missed',
    'vehicle_gated',
  ],
  positive_signals: [
    'matching_set_aside',
    'licensing_moat',
    'relevant_experience',
    'lpta_fit',
    'best_value_fit',
    'complexity_advantage',
    'broker_friendly',
    'past_performance_builder',
    'recurring_service',
    'standalone_idiq',
  ],
  risk_signals: [
    'qa_deadline_passed',
    'short_runway',
    'unknown_mandatory_qualification',
    'unclear_past_performance_substitution',
    'subcontracting_limit',
    'service_labor_standards',
    'buy_american',
    'idiq_ceiling_not_guaranteed',
  ],
};

function textOf(op = {}) {
  return `${op.title || ''}\n${op.description || ''}`.toLowerCase();
}

function add(list, id, label, evidence, source = 'solicitation') {
  if (!list.some((item) => item.id === id)) list.push({ id, label, evidence, source });
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - now.getTime()) / DAY_MS);
}

function isProductBuyer(buyer = {}) {
  const joined = `${(buyer.keywords || []).join(' ')} ${buyer.opportunity_type || ''} ${buyer.capabilities_text || ''}`.toLowerCase();
  return /product|supply|supplier|sourcing|vendor|broker|equipment|parts|materials/.test(joined);
}

function hasThinRecord(buyer = {}) {
  const text = `${buyer.experience || ''} ${(buyer.experience_types || []).join(' ')} ${buyer.past_performance || ''}`.toLowerCase();
  return !text || /brand new|new|none|no federal|thin|beginner/.test(text);
}

function confirmedQualification(buyer = {}, words = []) {
  const text = `${(buyer.qualification_categories || []).join(' ')} ${buyer.qualification_notes || ''} ${(buyer.keywords || []).join(' ')}`.toLowerCase();
  return words.some((word) => text.includes(word));
}

function missingQualification(buyer = {}, words = []) {
  const text = `${(buyer.missing_qualifications || []).join(' ')} ${buyer.qualification_gaps || ''}`.toLowerCase();
  return words.some((word) => text.includes(word));
}

export function assessCorePremise(op = {}, buyer = {}, { now = new Date() } = {}) {
  const text = textOf(op);
  const positive_signals = [];
  const risk_signals = [];
  const hard_failures = [];
  const evidence = [];
  const matched = matchStrength(op, buyer);

  const responseDays = daysUntil(op.response_deadline, now);
  if (responseDays != null && responseDays <= 0) add(hard_failures, 'expired_response_deadline', 'Expired response deadline', op.response_deadline, 'SAM structured field');
  else if (responseDays != null && responseDays <= 7) add(risk_signals, 'short_runway', 'Short runway', `${responseDays} day${responseDays === 1 ? '' : 's'} left`, 'SAM structured field');

  if (!buyerQualifiesForSetAside(op.set_aside_type, buyer.set_asides || [])) {
    add(hard_failures, 'set_aside_mismatch', 'Set-aside mismatch', op.set_aside_type || 'restricted set-aside', 'SAM structured field');
  } else if (!isFullAndOpen(op.set_aside_type)) {
    const internal = SAM_TO_INTERNAL[String(op.set_aside_type || '').trim()];
    add(positive_signals, 'matching_set_aside', 'Set-aside advantage', internal || op.set_aside_type, 'buyer profile + SAM set-aside');
  }

  if (hasAny(text, [/mandatory (site visit|pre[- ]?bid|conference)/, /site visit.*required/, /attendance.*mandatory/])) {
    if (hasAny(text, [/already occurred|has passed|closed|no late/i])) add(hard_failures, 'mandatory_step_missed', 'Mandatory step may have passed', 'mandatory site visit/pre-bid language', 'solicitation text');
    else add(risk_signals, 'unknown_mandatory_qualification', 'Verify mandatory site visit or pre-bid step', 'mandatory attendance language found', 'solicitation text');
  }

  if (hasAny(text, [/must already hold (a )?(gsa schedule|gwac|idiq|blanket purchase agreement)/, /only (existing )?(gsa|schedule|gwac|idiq) holders/, /existing contract vehicle/])) {
    add(hard_failures, 'vehicle_gated', 'Vehicle-gated opportunity', 'requires existing vehicle access', 'solicitation text');
  } else if (hasAny(text, [/\bidiq\b/, /indefinite delivery/])) {
    add(positive_signals, 'standalone_idiq', 'Standalone IDIQ is still biddable', 'IDIQ language found without vehicle-gated language', 'solicitation text');
    add(risk_signals, 'idiq_ceiling_not_guaranteed', 'IDIQ ceiling is not guaranteed revenue', 'IDIQ language found', 'solicitation text');
  }

  if (hasAny(text, [/license|required.*licensed|certification|required.*certified|clearance|bonding|bond required/])) {
    const licenseWords = ['license', 'licensed', 'certification', 'certified', 'clearance', 'bond'];
    if (missingQualification(buyer, licenseWords)) add(hard_failures, 'known_mandatory_license_mismatch', 'Known mandatory qualification mismatch', 'buyer profile says missing qualification', 'buyer profile');
    else if (confirmedQualification(buyer, licenseWords)) add(positive_signals, 'licensing_moat', 'Qualification moat', 'profile confirms related qualification', 'buyer profile + solicitation text');
    else add(risk_signals, 'unknown_mandatory_qualification', 'Verify mandatory qualification', 'license/certification/bonding language found', 'solicitation text');
  }

  if (hasAny(text, [/past performance|prior contract|ppq|past performance questionnaire/])) {
    if (hasAny(text, [/federal past performance.*required|prior federal.*required/]) && missingQualification(buyer, ['past performance', 'federal'])) {
      add(hard_failures, 'specific_federal_past_performance_mismatch', 'Specific federal past-performance mismatch', 'federal past performance appears mandatory and profile says missing', 'buyer profile + solicitation text');
    } else if (hasAny(text, [/commercial|state|local|subcontractor|teaming partner/]) || !hasThinRecord(buyer)) {
      add(positive_signals, 'relevant_experience', 'Relevant experience may count', 'past performance language may accept non-federal or partner experience', 'solicitation text + buyer profile');
    } else {
      add(risk_signals, 'unclear_past_performance_substitution', 'Verify past-performance substitution', 'past performance is mentioned but substitution is unclear', 'solicitation text');
    }
  }

  const evalMethod = evaluationMethod(text);
  if (evalMethod.method === 'lpta' && hasThinRecord(buyer)) add(positive_signals, 'lpta_fit', 'LPTA fit', 'technically acceptable / lowest price language', 'solicitation text + buyer profile');
  if (evalMethod.method === 'best_value' && !hasThinRecord(buyer)) add(positive_signals, 'best_value_fit', 'Best-value fit', 'best value / tradeoff language', 'solicitation text + buyer profile');

  if (matched.score >= 0.55) add(positive_signals, 'relevant_experience', 'Inside your selected lane', matched.matched.join(', ') || op.naics, 'buyer targeting + solicitation text');
  if (hasAny(text, [/multiple line items|various items|assorted|list of items|pricing sheet|clins|contract line item/]) && isProductBuyer(buyer)) add(positive_signals, 'broker_friendly', 'Broker-friendly line items', 'multi-item product language', 'solicitation text + buyer profile');
  if (hasAny(text, [/recurring|monthly|janitorial|custodial|maintenance|base year|option year/])) add(positive_signals, 'recurring_service', 'Recurring-service fit', 'recurring service or option-period language', 'solicitation text');
  if (hasAny(text, [/complex|multi[- ]?site|multiple locations|phased|coordinate|integration|various/]) && matched.score >= 0.35) add(positive_signals, 'complexity_advantage', 'Complex scope advantage', 'awkward/multi-part scope inside target lane', 'solicitation text + targeting');
  if (op.est_value != null && Number(op.est_value) <= 100000 && hasThinRecord(buyer)) add(positive_signals, 'past_performance_builder', 'Starter contract', 'small viable contract can build record', 'Core Premise + SAM value');

  if (hasAny(text, [/q&a|questions.*due|question deadline/]) && hasAny(text, [/questions.*closed|deadline.*passed|no further questions/])) add(risk_signals, 'qa_deadline_passed', 'Q&A deadline appears passed', 'Q&A deadline language', 'solicitation text');
  if (hasAny(text, [/52\.219-14|limitations on subcontracting/])) add(risk_signals, 'subcontracting_limit', 'Subcontracting limit may affect delivery model', 'FAR 52.219-14', 'solicitation text');
  if (hasAny(text, [/52\.222-41|service contract labor standards|wage determination/])) add(risk_signals, 'service_labor_standards', 'Wage determination may set labor floor', 'FAR 52.222-41 / wage determination', 'solicitation text');
  if (hasAny(text, [/buy american|domestic end product|american[- ]made/])) add(risk_signals, 'buy_american', 'Buy American may affect sourcing', 'Buy American language', 'solicitation text');

  evidence.push(...positive_signals.map((s) => ({ claim: s.id, source: s.source, evidence: s.evidence })));
  evidence.push(...risk_signals.map((s) => ({ claim: s.id, source: s.source, evidence: s.evidence })));

  return {
    eligibility: {
      status: hard_failures.length ? 'rejected' : risk_signals.some((s) => ['unknown_mandatory_qualification', 'unclear_past_performance_substitution'].includes(s.id)) ? 'needs_validation' : 'eligible',
      hard_failures,
    },
    student_fit: {
      niche_fit: matched.score >= 0.55 ? 'confirmed_fit' : matched.score > 0 ? 'needs_validation' : 'unknown',
      experience_fit: positive_signals.some((s) => s.id === 'relevant_experience') ? 'confirmed_fit' : 'unknown',
      fulfillment_fit: positive_signals.some((s) => ['broker_friendly', 'recurring_service', 'complexity_advantage'].includes(s.id)) ? 'confirmed_fit' : 'unknown',
      qualification_fit: hard_failures.some((s) => /qualification|license/.test(s.id)) ? 'known_mismatch' : risk_signals.some((s) => s.id === 'unknown_mandatory_qualification') ? 'needs_validation' : 'unknown',
    },
    positive_signals,
    risk_signals,
    evaluation: evalMethod,
    deadlines: { response: op.response_deadline || null, response_days: responseDays },
    structure: contractStructure(op, text),
    compliance: risk_signals.filter((s) => ['subcontracting_limit', 'service_labor_standards', 'buy_american'].includes(s.id)),
    evidence,
  };
}

export function evaluationMethod(text) {
  const factors = [];
  if (/past performance/.test(text)) factors.push('past performance');
  if (/\bprice\b/.test(text)) factors.push('price');
  if (/technical/.test(text)) factors.push('technical');
  if (/lowest price technically acceptable|\blpta\b/.test(text)) return { method: 'lpta', factors };
  if (/best value|trade[- ]?off|tradeoff/.test(text)) return { method: 'best_value', factors };
  if (/evaluation factors|basis of award/.test(text)) return { method: 'mixed', factors };
  return { method: 'unknown', factors };
}

export function contractStructure(op = {}, text = textOf(op)) {
  return {
    type: /\bidiq\b|indefinite delivery/.test(text) ? 'idiq' : /option year|base year/.test(text) ? 'base_plus_options' : 'standard',
    vehicle_gated: /must already hold (a )?(gsa schedule|gwac|idiq)|only (existing )?(gsa|schedule|gwac|idiq) holders|existing contract vehicle/.test(text),
    base_period: /base year|base period/.test(text) ? 'found_in_solicitation_text' : null,
    option_periods: /option year|option period/.test(text) ? ['found_in_solicitation_text'] : [],
    idiq_minimum: null,
    idiq_maximum: /\bidiq\b|indefinite delivery/.test(text) ? op.est_value ?? null : null,
  };
}

export function compactRubricContext(assessment = {}) {
  return {
    eligibility: assessment.eligibility,
    student_fit: assessment.student_fit,
    positive_signals: (assessment.positive_signals || []).map(({ id, label, evidence }) => ({ id, label, evidence })),
    risk_signals: (assessment.risk_signals || []).map(({ id, label, evidence }) => ({ id, label, evidence })),
    evaluation: assessment.evaluation,
    deadlines: assessment.deadlines,
    structure: assessment.structure,
    compliance: assessment.compliance,
  };
}
