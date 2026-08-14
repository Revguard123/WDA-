// Claude-backed pieces of Slice 2: the disqualification pass and the one-line
// "why we picked this". Uses the official Anthropic SDK with structured outputs
// so the disqualification result is always valid JSON, never free text to parse
// by hand.
//
// Model: the disqualification pass is a high-volume classifier (one call per
// surviving candidate per buyer per batch), so it defaults to Claude Haiku for
// cost and speed. Override with ANTHROPIC_MODEL if you want a stronger model.
//
// Copy rule from the build spec: generated text must never use the long dash
// character. Both prompts instruct the model accordingly.

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

let cachedClient = null;
async function getAnthropic() {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY must be set');
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  cachedClient = new Anthropic();
  return cachedClient;
}

// The disqualification list, tightened for pre-freeze QA: unknown buyer
// qualifications are validation risks, not automatic hard rejections.
const DISQUALIFICATION_LIST = `Hard-disqualify the contract only if any of these are clearly true:
- The response deadline is too soon to prepare a real bid, or it is already closed or amended past its due date.
- It is reserved for a set-aside the buyer does not hold.
- It is a sources-sought notice or RFI (market research), not a live solicitation.
- The language signals a locked incumbent recompete, a named sole-source award, or a brand-name-only requirement.
- It requires a security clearance, license, certification, bonding capacity, or specific past performance that the known buyer profile explicitly cannot satisfy.
- It demands specific prior federal past performance and the known buyer profile explicitly says the buyer cannot meet it.
- It requires bid or performance bonding, or financial capacity, that clearly contradicts the buyer's stated size band or known profile.
- Its estimated value is clearly outside the buyer's stated size band.
- It requires manufacturing, products, or specialized capability outside the buyer's NAICS and keywords.
- Its place of performance is outside the area the buyer said they will service.
- It is gated behind a GWAC, schedule, or IDIQ vehicle the buyer is not on.
- A mandatory step, such as a required site visit, has already passed.

Do not hard-disqualify merely because the buyer profile is silent about a license, certification, bonding capacity, clearance, specific staffing depth, specialized equipment, or past performance. Treat those as needs_validation unless the buyer is known to lack a mandatory requirement.`;

function buyerSummary(buyer = {}) {
  const lines = [
    `NAICS codes: ${(buyer.naics || []).join(', ') || 'none stated'}`,
    `Keywords / capabilities: ${(buyer.keywords || []).join(', ') || 'none stated'}`,
    `Set-asides held: ${(buyer.set_asides || []).join(', ') || 'none (full and open only)'}`,
    `Service area / state: ${buyer.state || 'not restricted'}`,
    `Size band: ${buyer.size_min != null ? `$${buyer.size_min}` : 'no floor'} to ${buyer.size_max != null ? `$${buyer.size_max}` : 'no ceiling'}`,
  ];
  return lines.join('\n');
}

function contractSummary(op = {}) {
  return [
    `Title: ${op.title || 'n/a'}`,
    `Agency: ${op.agency || 'n/a'}`,
    `NAICS: ${op.naics || 'n/a'}`,
    `Set-aside code: ${op.set_aside_type || '(full and open)'}`,
    `Place of performance: ${op.place_of_perf || 'n/a'}`,
    `Response deadline: ${op.response_deadline || 'n/a'}`,
    `Estimated value: ${op.est_value != null ? `$${op.est_value}` : 'not stated'}`,
    '',
    'Solicitation text:',
    (op.description || '(no description text available)').slice(0, 12000),
  ].join('\n');
}

const DISQUALIFY_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['eligible', 'needs_validation', 'disqualified'] },
    disqualified: { type: 'boolean' },
    reason_category: {
      type: 'string',
      enum: [
        'scope_mismatch',
        'mandatory_qualification',
        'certification_license',
        'clearance',
        'bonding',
        'geography',
        'set_aside',
        'contract_size',
        'product_service_mismatch',
        'past_performance',
        'insufficient_buyer_evidence',
        'other',
      ],
    },
    reason: { type: 'string' },
  },
  required: ['decision', 'disqualified', 'reason_category', 'reason'],
  additionalProperties: false,
};

// Ask Claude whether this contract should be disqualified for this buyer.
// Returns { decision, disqualified, reason_category, reason }. Unknown
// qualifications should become needs_validation, not hard rejection.
export async function disqualifyContract(opportunity, buyer, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system =
    'You screen federal contract opportunities for a specific small-business buyer. ' +
    'You decide whether a contract is eligible, needs validation, or must be disqualified for this buyer. ' +
    'Use deterministic hard filters as already handled by code; focus on semantic scope and known profile contradictions. ' +
    'Preserve grounding: NAICS, keywords, set-asides, and service area are targeting inputs, not proof of licenses, bonding, clearance, certifications, staff, equipment, or past performance. ' +
    'But absence of evidence is not evidence of absence. If a solicitation mentions a license, certification, bonding, clearance, staffing depth, equipment, or past performance and the buyer profile is merely silent, choose needs_validation rather than disqualified. ' +
    'Hard-disqualify only for clear incompatibility or a known contradiction. Do not use the long dash character in your reason. Keep the reason to one short sentence.';

  const userPrompt = [
    'BUYER PROFILE',
    buyerSummary(buyer),
    '',
    'DISQUALIFICATION LIST',
    DISQUALIFICATION_LIST,
    '',
    'CONTRACT',
    contractSummary(opportunity),
    '',
    'Decide whether this contract is eligible, needs_validation, or disqualified for this buyer. Return the decision, disqualified boolean, normalized reason_category, and a one-sentence reason.',
  ].join('\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: DISQUALIFY_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text);
  const decision = ['eligible', 'needs_validation', 'disqualified'].includes(parsed.decision)
    ? parsed.decision
    : parsed.disqualified === true
      ? 'disqualified'
      : 'eligible';
  return {
    decision,
    disqualified: decision === 'disqualified' || (parsed.disqualified === true && decision !== 'needs_validation'),
    reason_category: String(parsed.reason_category || 'other').trim() || 'other',
    reason: String(parsed.reason || '').replace(/—/g, '-'),
  };
}

const WHY_SCHEMA = {
  type: 'object',
  properties: { why_line: { type: 'string' } },
  required: ['why_line'],
  additionalProperties: false,
};

// The contract-level winnability note. Two tight sentences, grounded only in
// the solicitation and the buyer's stored profile. No long dash.
export async function whyLine(opportunity, buyer, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system = [
    'You write the short "Why this is winnable for you" note that goes to one specific',
    'small-business owner about one federal contract. Write exactly two sentences, plain',
    'and concrete, using the War Dogs winnability method: opportunity-specific fit, eligibility,',
    'positioning, and obvious risks based only on known facts.',
    '',
    'Sentence 1: say what the work actually is in plain terms. Name the real scope (what gets built,',
    'serviced, supplied, or delivered), who needs it (the agency or installation), and where it is.',
    'Pull specifics from the solicitation text, not just the title.',
    '',
    'Sentence 2: explain why it is a strong target for THIS owner. Use only evidence from their',
    'stored profile and the solicitation: NAICS alignment, stated keywords/capabilities, profile-provided set-aside',
    'eligibility, geography, size band, deadline, or contract characteristics. Speak to the owner',
    'as "you" and "your". Use conditional language when the evidence is partial.',
    '',
    'Hard rules: Do not fabricate licenses, bonding capacity, military history, past performance,',
    'employees, equipment, certifications, or contract history. Do not claim human review or imply',
    'a human team personally selected this contract. Do not describe selected NAICS codes, keywords,',
    'or service areas as the buyer expertise, experience, past performance, proven capability, staff,',
    'equipment, or qualifications unless that exact evidence is explicitly present in the buyer profile.',
    'Prefer cautious phrases like "the NAICS code you chose to target," "the construction work you chose',
    'to target," "the set-aside selected in your profile," and "your Virginia service area." Use conditional language',
    'for requirements such as bonding, licenses, or past performance. Do not say "aligns perfectly."',
    'Do not just restate a NAICS number or say "aligns with your NAICS."',
    'No hype, no filler. Do not use the long dash character.',
  ].join(' ');
  const userPrompt = [
    'THE OWNER TOLD US (their niche profile)',
    buyerSummary(buyer),
    '',
    'THE CONTRACT',
    contractSummary(opportunity),
    '',
    'Write the two-sentence "Why this is winnable for you" note for this owner.',
  ].join('\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: WHY_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text);
  return String(parsed.why_line || '').replace(/—/g, '-');
}

const DEEP_DIVE_SCHEMA = {
  type: 'object',
  properties: { deep_dive: { type: 'string' } },
  required: ['deep_dive'],
  additionalProperties: false,
};

// Plain-English breakdown of one chosen contract, pre-generated at send time and
// stored so the Full Breakdown page loads instantly. Covers why we surfaced it,
// what to watch for, and what to do first.
export async function deepDive(opportunity, buyer, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system =
    'You explain why War Dogs Academy surfaced one federal contract opportunity to a specific small-business owner. ' +
    'Write three short paragraphs in plain English: (1) what the agency actually wants and why the work fits the buyer profile, ' +
    '(2) relevant competitive or set-aside considerations plus important risks, unknowns, or gating details, ' +
    '(3) a sensible first move before the buyer spends serious time on the paperwork. ' +
    'Use only known buyer/profile facts and solicitation facts. Do not fabricate licenses, bonding capacity, military history, ' +
    'past performance, employees, equipment, certifications, or contract history. Do not treat selected NAICS codes, keywords, ' +
    'set-asides, or service areas as proof of expertise, experience, proven capability, staffing, equipment, or qualifications. ' +
    'Use cautious targeting-based language and conditional language for requirements such as bonding, licenses, or past performance. ' +
    'Do not say "aligns perfectly." Do not claim human review or imply a human team personally selected this contract. ' +
    'Be concrete and practical, no fluff. Do not use the long dash character.';
  const userPrompt = [
    'BUYER PROFILE',
    buyerSummary(buyer),
    '',
    'CONTRACT',
    contractSummary(opportunity),
    '',
    'Write the three-paragraph breakdown.',
  ].join('\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: DEEP_DIVE_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text);
  return String(parsed.deep_dive || '').replace(/—/g, '-');
}

const NAICS_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['code', 'title'],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

// Map a plain-English description of a business or type of work to real 2022
// six-digit NAICS codes, so a buyer who has never heard of NAICS can just type
// what they do ("office cleaning", "paving roads") and get the right codes.
// Returns up to 6 { code, title } matches, most relevant first, validated to
// real-looking six-digit codes.
export async function suggestNaics(query, { client, model = DEFAULT_MODEL } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const anthropic = client || (await getAnthropic());
  const system =
    'You map a plain-English description of a business or type of work to the most relevant US ' +
    '2022 NAICS codes. Return up to 6 six-digit NAICS codes, most relevant first, each with its ' +
    'official NAICS title. Use only real, current six-digit codes and their official titles. Never ' +
    'invent a code. If the description is vague, return the closest common codes. Do not use the ' +
    'long dash character.';
  const userPrompt = `Business description: ${q}\n\nReturn the best-matching six-digit NAICS codes and their official titles.`;

  const res = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: NAICS_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const seen = new Set();
  return (parsed.matches || [])
    .map((m) => ({
      code: String(m.code || '').replace(/\D/g, ''),
      title: String(m.title || '').replace(/—/g, '-').trim(),
    }))
    .filter((m) => /^\d{6}$/.test(m.code) && m.title)
    .filter((m) => (seen.has(m.code) ? false : (seen.add(m.code), true)))
    .slice(0, 6);
}

const DISCOVER_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          industry: { type: 'string' },
          naics: {
            type: 'array',
            items: {
              type: 'object',
              properties: { code: { type: 'string' }, title: { type: 'string' } },
              required: ['code', 'title'],
              additionalProperties: false,
            },
          },
          explanation: { type: 'string' },
        },
        required: ['industry', 'naics', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};

const PLAYBOOK_RANK_MAX_TOKENS = 1800;
const PLAYBOOK_EXPLANATION_MAX_TOKENS = 1200;

const PLAYBOOK_RANK_SCHEMA = {
  type: 'object',
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subindustry_id: { type: 'string' },
          overall_fit: { type: 'string', enum: ['strong', 'moderate', 'weak', 'unknown'] },
          capability_fit: { type: 'string', enum: ['strong', 'moderate', 'weak', 'unknown'] },
          fulfillment_fit: { type: 'string', enum: ['strong', 'moderate', 'weak', 'unknown'] },
          qualification_fit: { type: 'string', enum: ['strong', 'moderate', 'weak', 'unknown'] },
          geography_fit: { type: 'string', enum: ['strong', 'moderate', 'weak', 'unknown'] },
          operating_model_fit: { type: 'string', enum: ['strong', 'moderate', 'weak', 'unknown'] },
        },
        required: [
          'subindustry_id',
          'overall_fit',
          'capability_fit',
          'fulfillment_fit',
          'qualification_fit',
          'geography_fit',
          'operating_model_fit',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['rankings'],
  additionalProperties: false,
};

const PLAYBOOK_EXPLANATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subindustry_id: { type: 'string' },
          explanation: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          validation_questions: { type: 'array', items: { type: 'string' } },
        },
        required: ['subindustry_id', 'explanation', 'strengths', 'risks', 'validation_questions'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};

const PLAYBOOK_FIT_VALUES = new Set(['strong', 'moderate', 'weak', 'unknown']);

function normalizePlaybookFit(value) {
  const normalized = String(value || 'unknown').toLowerCase().trim();
  return PLAYBOOK_FIT_VALUES.has(normalized) ? normalized : 'unknown';
}

function safeDiscoveryLog(logger, stage, fields = {}, level = 'info') {
  const target = logger?.[level] || logger?.info;
  if (typeof target === 'function') {
    target.call(logger, { event: 'playbook_discovery_debug', stage, ...fields });
  }
}

function responseText(res) {
  return Array.isArray(res?.content) ? res.content.find((b) => b.type === 'text')?.text || '{}' : '{}';
}

function usageFields(res, configuredMaxTokens, text) {
  return {
    stop_reason: res?.stop_reason || null,
    output_tokens: res?.usage?.output_tokens ?? null,
    max_tokens: configuredMaxTokens,
    response_character_count: String(text || '').length,
  };
}

function isOutputLimitStop(stopReason) {
  return ['max_tokens', 'model_context_window_exceeded'].includes(String(stopReason || ''));
}

function truncatedJsonError(label) {
  const err = new Error(`${label} hit output limit before producing valid JSON`);
  err.code = 'CLAUDE_OUTPUT_TRUNCATED';
  return err;
}

function parseStrictJson(text, res, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    if (isOutputLimitStop(res?.stop_reason)) throw truncatedJsonError(label);
    throw err;
  }
}

export async function rankPlaybookCandidates({ profile = {}, candidates = [] } = {}, { client, model = DEFAULT_MODEL, logger = null } = {}) {
  const anthropic = client || (await getAnthropic());
  const bounded = candidates.map((c) => ({
    subindustry_id: c.subindustry_id,
    subindustry_name: c.subindustry_name,
    industry_name: c.industry_name,
    description: c.description,
    broker_guidance: c.broker_guidance,
    competition: c.competition,
    award_method: c.award_method,
    mapping_type: c.mapping_type,
    production_safe: c.production_safe,
    required_context: c.required_context || [],
  }));
  const system = [
    'You rank War Dogs Academy niche candidates for a student profile.',
    'You may ONLY choose from the supplied candidates and must return only their subindustry_id values.',
    'Do not invent industries, sub-industries, NAICS codes, or titles.',
    'Do not provide NAICS codes. Server code resolves official Census NAICS separately.',
    'Do not fabricate licenses, bonding, clearances, certifications, equipment, staff, past performance, or federal experience.',
    'Use only explicit selected profile fields as evidence. Private/commercial experience is not federal past performance.',
    'Broker or vendor-sourcing fulfillment does not prove the student personally has regulated credentials; surface partner/license needs as risks.',
    'Treat avoid text as a strong preference constraint within the supplied candidate universe.',
    'Return compact rankings for the supplied candidates that are plausible fits. Include every genuinely strong candidate; do not add weak candidates as filler.',
    'Return only compact ranking evidence fields. Do not include explanations, strengths, risks, validation questions, NAICS, titles, descriptions, or echoed source text.',
    'Do not use the long dash character.',
  ].join(' ');
  const userPrompt = [
    'NORMALIZED STUDENT PROFILE',
    JSON.stringify(profile, null, 2),
    '',
    'BOUNDED CANONICAL WAR DOGS CANDIDATES',
    JSON.stringify(bounded, null, 2),
    '',
    'Return compact JSON with a rankings array only. Use supplied subindustry_id values only.',
  ].join('\n');

  safeDiscoveryLog(logger, 'claude_ranking_request', { candidate_count: bounded.length, max_tokens: PLAYBOOK_RANK_MAX_TOKENS, attempt: 1 });
  let res;
  try {
    res = await anthropic.messages.create({
      model,
      max_tokens: PLAYBOOK_RANK_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: PLAYBOOK_RANK_SCHEMA } },
    });
  } catch (err) {
    safeDiscoveryLog(logger, 'claude_ranking_request_failed', {
      error_name: err?.name || 'Error',
      error_message: String(err?.message || 'Claude ranking request failed').slice(0, 240),
    }, 'error');
    throw err;
  }
  let text = responseText(res);
  safeDiscoveryLog(logger, 'claude_ranking_response_metadata', usageFields(res, PLAYBOOK_RANK_MAX_TOKENS, text));
  let parsed;
  try {
    parsed = parseStrictJson(text, res, 'Claude ranking response');
  } catch (err) {
    safeDiscoveryLog(logger, 'claude_structured_response_parse_failed', {
      error_name: err?.name || 'SyntaxError',
      error_message: 'Claude ranking response was not valid JSON text.',
      retryable: true,
    }, 'error');
    safeDiscoveryLog(logger, 'claude_ranking_request', { candidate_count: bounded.length, max_tokens: PLAYBOOK_RANK_MAX_TOKENS, attempt: 2 });
    res = await anthropic.messages.create({
      model,
      max_tokens: PLAYBOOK_RANK_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: PLAYBOOK_RANK_SCHEMA } },
    });
    text = responseText(res);
    safeDiscoveryLog(logger, 'claude_ranking_response_metadata', usageFields(res, PLAYBOOK_RANK_MAX_TOKENS, text));
    parsed = parseStrictJson(text, res, 'Claude ranking response');
  }
  const parsedCount = Array.isArray(parsed.rankings) ? parsed.rankings.length : 0;
  safeDiscoveryLog(logger, 'claude_structured_response_parsed', { returned_recommendation_id_count: parsedCount });
  return {
    recommendations: (parsed.rankings || []).map((r) => ({
      subindustry_id: String(r.subindustry_id || '').trim(),
      overall_fit: normalizePlaybookFit(r.overall_fit),
      explanation: String(r.explanation || '').replace(/—/g, '-').trim(),
      strengths: Array.isArray(r.strengths) ? r.strengths.map((s) => String(s).replace(/—/g, '-').trim()).filter(Boolean).slice(0, 4) : [],
      risks: Array.isArray(r.risks) ? r.risks.map((s) => String(s).replace(/—/g, '-').trim()).filter(Boolean).slice(0, 4) : [],
      validation_questions: Array.isArray(r.validation_questions) ? r.validation_questions.map((s) => String(s).replace(/—/g, '-').trim()).filter(Boolean).slice(0, 4) : [],
      capability_fit: normalizePlaybookFit(r.capability_fit),
      fulfillment_fit: normalizePlaybookFit(r.fulfillment_fit),
      qualification_fit: normalizePlaybookFit(r.qualification_fit),
      geography_fit: normalizePlaybookFit(r.geography_fit),
      operating_model_fit: normalizePlaybookFit(r.operating_model_fit),
    })),
  };
}

export async function explainPlaybookRecommendations({ profile = {}, recommendations = [] } = {}, { client, model = DEFAULT_MODEL, logger = null } = {}) {
  const anthropic = client || (await getAnthropic());
  const allowed = recommendations.slice(0, 3).map((r) => ({
    subindustry_id: r.subindustry_id,
    subindustry_name: r.subindustry_name,
    industry_name: r.industry_name,
    competition: r.competition,
    mapping_type: r.mapping_type,
    feedability: r.feedability ? {
      status: r.feedability.status,
      eligible_live_count: r.feedability.eligible_live_count,
    } : null,
  }));
  const system = [
    'You write grounded user-facing Discovery recommendation evidence for final War Dogs Academy candidates.',
    'You may ONLY write about the supplied final subindustry_id values.',
    'Do not invent industries, sub-industries, NAICS codes, titles, licenses, bonding, clearances, certifications, equipment, staff, past performance, or federal experience.',
    'Do not provide NAICS codes or NAICS titles. Server code attaches official Census NAICS separately.',
    'If you mention market availability, use only the supplied feedability status/count and do not invent volume.',
    'Use cautious, profile-grounded language. Do not use the long dash character.',
  ].join(' ');
  const userPrompt = [
    'NORMALIZED STUDENT PROFILE',
    JSON.stringify(profile, null, 2),
    '',
    'FINAL SERVER-ELIGIBLE CANDIDATES',
    JSON.stringify(allowed, null, 2),
    '',
    'Return concise user-facing explanations only for these final candidate IDs.',
  ].join('\n');

  async function requestExplanations(attempt) {
    safeDiscoveryLog(logger, 'claude_explanation_request', { candidate_count: allowed.length, max_tokens: PLAYBOOK_EXPLANATION_MAX_TOKENS, attempt });
    const res = await anthropic.messages.create({
      model,
      max_tokens: PLAYBOOK_EXPLANATION_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: PLAYBOOK_EXPLANATION_SCHEMA } },
    });
    const text = responseText(res);
    safeDiscoveryLog(logger, 'claude_explanation_response_metadata', usageFields(res, PLAYBOOK_EXPLANATION_MAX_TOKENS, text));
    return parseStrictJson(text, res, 'Claude explanation response');
  }

  let parsed;
  try {
    parsed = await requestExplanations(1);
  } catch (err) {
    safeDiscoveryLog(logger, 'claude_explanation_parse_failed', {
      error_name: err?.name || 'SyntaxError',
      error_message: 'Claude explanation response was not valid JSON text.',
      retryable: true,
    }, 'error');
    if (err?.code === 'CLAUDE_OUTPUT_TRUNCATED' || err instanceof SyntaxError) {
      parsed = await requestExplanations(2);
    } else {
      throw err;
    }
  }

  return {
    recommendations: (parsed.recommendations || []).map((r) => ({
      subindustry_id: String(r.subindustry_id || '').trim(),
      explanation: String(r.explanation || '').replace(/â€”/g, '-').trim(),
      strengths: Array.isArray(r.strengths) ? r.strengths.map((s) => String(s).replace(/â€”/g, '-').trim()).filter(Boolean).slice(0, 4) : [],
      risks: Array.isArray(r.risks) ? r.risks.map((s) => String(s).replace(/â€”/g, '-').trim()).filter(Boolean).slice(0, 4) : [],
      validation_questions: Array.isArray(r.validation_questions) ? r.validation_questions.map((s) => String(s).replace(/â€”/g, '-').trim()).filter(Boolean).slice(0, 4) : [],
    })).slice(0, 3),
  };
}

// NICHE DISCOVERY: for a contractor who does not yet know what to go after.
// Given what they tell us about themselves, recommend up to 3 niches that fit,
// each with a plain-English industry, real NAICS code(s), and a short reason.
//
// NOTE: this framework is a v1. Tune the system prompt to the War Dogs Academy
// niche-selection methodology (from the course) once its rules are captured.
export async function discoverNiches(profile = {}, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system = [
    'You are a federal-contracting coach helping a NEW contractor choose a niche that fits them.',
    'Given what you know about them, recommend up to 3 specific niches. For each: the industry in plain',
    'English, the most relevant real six-digit NAICS code(s) with official titles, and a short explanation',
    'of why it fits THEM: relevant background, interests, certifications or set-asides, geography, and whether',
    'the work has recurring or steady-service characteristics. Favor niches where they may have relevant',
    'experience or credibility to perform. Favor niches where their certifications or set-asides may narrow the',
    'competitive field. Prefer steady, less-glamorous recurring services and specialized work over crowded,',
    'prestigious categories. Do not guarantee that an entire niche is winnable or that they will succeed.',
    'Do not treat a selected interest, NAICS code, location, or set-aside as proof of expertise, experience,',
    'past performance, staffing, equipment, licenses, bonding, or operational capability. Use cautious language.',
    'Use only real, current six-digit NAICS codes and official titles; never invent a code. Do not use the long dash character.',
  ].join(' ');

  const parts = [];
  if (profile.background) parts.push(`Background and skills: ${profile.background}`);
  if (profile.setAsides && profile.setAsides.length) parts.push(`Certifications / set-asides they hold: ${profile.setAsides.join(', ')}`);
  if (profile.state) parts.push(`Where they can work: ${profile.state}`);
  if (profile.interests) parts.push(`What draws them in or what to avoid: ${profile.interests}`);
  if (parts.length === 0) parts.push('They gave very little detail; recommend broadly accessible niches that often fit new small-business contractors.');
  const userPrompt = `${parts.join('\n')}\n\nRecommend up to 3 niches that fit with real NAICS codes and a short reason for each.`;

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: DISCOVER_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return (parsed.recommendations || [])
    .map((r) => ({
      industry: String(r.industry || '').replace(/—/g, '-').trim(),
      explanation: String(r.explanation || '').replace(/—/g, '-').trim(),
      naics: (r.naics || [])
        .map((n) => ({ code: String(n.code || '').replace(/\D/g, ''), title: String(n.title || '').replace(/—/g, '-').trim() }))
        .filter((n) => /^\d{6}$/.test(n.code) && n.title)
        .slice(0, 3),
    }))
    .filter((r) => r.industry && r.naics.length > 0)
    .slice(0, 3);
}

export { DEFAULT_MODEL, DISQUALIFICATION_LIST };
