export const PLAYBOOK_EXPECTED_INDUSTRIES = 13;
export const PLAYBOOK_EXPECTED_SUBINDUSTRIES = 130;
export const PLAYBOOK_VERSION = '2026-08-v1';

export const CURRENT_CTC_SET_ASIDES = ['sb', 'sdvosb', 'vosb', 'wosb', 'edwosb', '8a', 'hubzone'];

export const FULFILLMENT_MODELS = ['self', 'existing_vendors', 'source_as_needed', 'hybrid', 'unknown'];
export const OPPORTUNITY_TYPES = ['product', 'service', 'either', 'unknown'];
export const EXPERIENCE_TYPES = [
  'federal_contracts',
  'state_local_contracts',
  'private_commercial',
  'industry_experience',
  'brand_new',
];
export const QUALIFICATION_CATEGORIES = [
  'licenses',
  'bonding',
  'security_clearances',
  'technical_cyber',
  'healthcare_medical',
  'environmental_safety',
  'specialized_equipment',
  'qualified_staff',
  'regulated_product_suppliers',
  'other',
  'none_unknown',
];
export const GEOGRAPHY_MODES = ['single_state', 'multi_state', 'nationwide', 'remote', 'vendor_dependent', 'unknown'];
export const OPERATING_MODELS = ['volume_product', 'recurring_service', 'project', 'no_preference', 'unknown'];

export const COMPATIBILITY_VALUES = ['confirmed_fit', 'needs_validation', 'incompatible'];
export const FIT_VALUES = ['strong', 'moderate', 'weak', 'unknown'];
export const MARKET_COMPETITION_VALUES = ['low', 'medium', 'high', 'unknown'];

const FULFILLMENT_ALIASES = {
  self_perform: 'self',
  existing_partners: 'existing_vendors',
};
const OPPORTUNITY_TYPE_ALIASES = {
  products: 'product',
  services: 'service',
  both: 'either',
};
const EXPERIENCE_ALIASES = {
  state_local_government: 'state_local_contracts',
  new_to_area: 'brand_new',
};
const QUALIFICATION_ALIASES = {
  professional_trade_licenses: 'licenses',
  bonding_capacity: 'bonding',
  technical_cyber_certifications: 'technical_cyber',
  healthcare_medical_credentials: 'healthcare_medical',
  environmental_safety_certifications: 'environmental_safety',
  none_or_unknown: 'none_unknown',
};
const OPERATING_MODEL_ALIASES = {
  volume_products: 'volume_product',
  recurring_services: 'recurring_service',
  project_based: 'project',
};

function cleanString(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slug(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function requireNonEmptyString(errors, value, path) {
  if (!cleanString(value)) addError(errors, path, 'must be a non-empty string');
}

function assertAllowed(errors, value, allowed, path) {
  if (!allowed.includes(value)) {
    addError(errors, path, `must be one of: ${allowed.join(', ')}`);
  }
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => cleanString(v)).filter(Boolean);
}

function canonicalValue(value, allowed, aliases = {}) {
  // Enum-like discovery values are case-insensitive at the application boundary.
  // Persisted/AI values may arrive as "Services" or "Self_Perform"; normalize
  // before alias mapping so validation never rejects a semantically valid value.
  const clean = cleanString(value).toLowerCase();
  const mapped = aliases[clean] || clean;
  return allowed.includes(mapped) ? mapped : null;
}

export function normalizeDiscoveryAnswers(rawAnswers = {}) {
  const answers = rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers) ? rawAnswers : {};
  return {
    capabilities_text: cleanString(answers.capabilities_text ?? answers.background),
    fulfillment_model: cleanString(answers.fulfillment_model),
    opportunity_type: cleanString(answers.opportunity_type),
    experience_types: arrayOfStrings(answers.experience_types),
    qualification_categories: arrayOfStrings(answers.qualification_categories),
    qualification_notes: cleanString(answers.qualification_notes),
    geography_mode: cleanString(answers.geography_mode),
    state: cleanString(answers.state).toUpperCase(),
    operating_model: cleanString(answers.operating_model),
    size_min: answers.size_min ?? '',
    size_max: answers.size_max ?? '',
    set_asides: arrayOfStrings(answers.set_asides ?? answers.setAsides).map((v) => v.toLowerCase()),
    interests: cleanString(answers.interests),
    avoid: cleanString(answers.avoid),
    adaptive_answers: answers.adaptive_answers && typeof answers.adaptive_answers === 'object' && !Array.isArray(answers.adaptive_answers)
      ? answers.adaptive_answers
      : {},
    advisor_state: answers.advisor_state && typeof answers.advisor_state === 'object' && !Array.isArray(answers.advisor_state)
      ? answers.advisor_state
      : {},
  };
}

export function playbookIdForName(name) {
  return slug(name);
}

export function normalizeIndustry(industry = {}) {
  const name = cleanString(industry.name);
  return {
    id: playbookIdForName(name),
    name,
    competition_level: cleanString(industry.competition_level).toLowerCase(),
    market_growth: cleanString(industry.market_growth),
    primary_award_method: cleanString(industry.primary_award_method),
    market_value_usd: industry.market_value_usd ?? null,
    summary: cleanString(industry.summary),
    detailed_description: cleanString(industry.detailed_description),
    broker_guidance: cleanString(industry.broker_guidance),
    source_file: cleanString(industry.source_file),
    subindustries: (industry.subindustries || []).map((sub) => normalizeSubIndustry(sub, name)),
  };
}

export function normalizeSubIndustry(subindustry = {}, industryName = '') {
  const name = cleanString(subindustry.name);
  return {
    id: playbookIdForName(`${industryName} ${name}`),
    name,
    industry: cleanString(industryName),
    description: cleanString(subindustry.description),
    broker_guidance: cleanString(subindustry.broker_guidance),
    source_file: cleanString(subindustry.source_file),
  };
}

export function validatePlaybookDataset(dataset, {
  expectedIndustries = PLAYBOOK_EXPECTED_INDUSTRIES,
  expectedSubindustries = PLAYBOOK_EXPECTED_SUBINDUSTRIES,
} = {}) {
  const errors = [];
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    return { ok: false, errors: [{ path: '$', message: 'dataset must be an object' }] };
  }
  if (!Array.isArray(dataset.industries)) {
    return { ok: false, errors: [{ path: '$.industries', message: 'must be an array' }] };
  }

  if (dataset.industries.length !== expectedIndustries) {
    addError(errors, '$.industries', `expected exactly ${expectedIndustries} industries, found ${dataset.industries.length}`);
  }

  const industryNames = new Map();
  const subindustryNames = new Map();
  let subindustryCount = 0;

  dataset.industries.forEach((industry, industryIndex) => {
    const industryPath = `$.industries[${industryIndex}]`;
    requireNonEmptyString(errors, industry.name, `${industryPath}.name`);
    requireNonEmptyString(errors, industry.description ?? industry.summary, `${industryPath}.summary`);
    requireNonEmptyString(errors, industry.broker_guidance, `${industryPath}.broker_guidance`);

    const industryName = cleanString(industry.name);
    if (/^(new industry|untitled)$/i.test(industryName)) {
      addError(errors, `${industryPath}.name`, 'placeholder industry names are not allowed');
    }
    if (/Industries \(1\)/i.test(cleanString(industry.source_file))) {
      addError(errors, `${industryPath}.source_file`, 'duplicate Industries (1) export tree is not allowed');
    }
    if (industryName) {
      const seen = industryNames.get(industryName.toLowerCase());
      if (seen != null) addError(errors, `${industryPath}.name`, `duplicate industry name also seen at $.industries[${seen}].name`);
      else industryNames.set(industryName.toLowerCase(), industryIndex);
    }

    if (!Array.isArray(industry.subindustries)) {
      addError(errors, `${industryPath}.subindustries`, 'must be an array');
      return;
    }

    industry.subindustries.forEach((subindustry, subIndex) => {
      subindustryCount += 1;
      const subPath = `${industryPath}.subindustries[${subIndex}]`;
      requireNonEmptyString(errors, subindustry.name, `${subPath}.name`);
      requireNonEmptyString(errors, subindustry.description, `${subPath}.description`);
      requireNonEmptyString(errors, subindustry.broker_guidance, `${subPath}.broker_guidance`);

      const subName = cleanString(subindustry.name);
      if (/^(new industry|untitled)$/i.test(subName)) {
        addError(errors, `${subPath}.name`, 'placeholder sub-industry names are not allowed');
      }
      if (/Industries \(1\)/i.test(cleanString(subindustry.source_file))) {
        addError(errors, `${subPath}.source_file`, 'duplicate Industries (1) export tree is not allowed');
      }
      if (subName) {
        const key = subName.toLowerCase();
        const seen = subindustryNames.get(key);
        if (seen) addError(errors, `${subPath}.name`, `duplicate sub-industry name also seen at ${seen}`);
        else subindustryNames.set(key, `${subPath}.name`);
      }
    });
  });

  if (subindustryCount !== expectedSubindustries) {
    addError(errors, '$.industries[*].subindustries', `expected exactly ${expectedSubindustries} sub-industries, found ${subindustryCount}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      industries: dataset.industries.length,
      subindustries: subindustryCount,
      uniqueSubindustries: subindustryNames.size,
    },
  };
}

export function assertValidPlaybookDataset(dataset, options) {
  const result = validatePlaybookDataset(dataset, options);
  if (!result.ok) {
    const details = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`War Dogs Playbook dataset validation failed: ${details}`);
  }
  return result;
}

export function normalizeDiscoveryProfile(input = {}) {
  const normalizedAnswers = normalizeDiscoveryAnswers(input);
  const setAsides = arrayOfStrings(input.set_asides ?? input.setAsides)
    .map((v) => v.toLowerCase())
    .map((v) => canonicalValue(v, CURRENT_CTC_SET_ASIDES) || v)
    .filter((v, index, arr) => CURRENT_CTC_SET_ASIDES.includes(v) && arr.indexOf(v) === index);
  const state = normalizedAnswers.state;
  const explicitMode = canonicalValue(normalizedAnswers.geography_mode, GEOGRAPHY_MODES);
  const geographyMode = explicitMode
    || (state
      ? 'single_state'
      : 'nationwide');

  return {
    capabilities_text: normalizedAnswers.capabilities_text,
    fulfillment_model: canonicalValue(normalizedAnswers.fulfillment_model, FULFILLMENT_MODELS, FULFILLMENT_ALIASES) || 'unknown',
    opportunity_type: canonicalValue(normalizedAnswers.opportunity_type, OPPORTUNITY_TYPES, OPPORTUNITY_TYPE_ALIASES) || 'unknown',
    experience_types: normalizedAnswers.experience_types
      .map((v) => canonicalValue(v, EXPERIENCE_TYPES, EXPERIENCE_ALIASES))
      .filter(Boolean),
    qualification_categories: normalizedAnswers.qualification_categories
      .map((v) => canonicalValue(v, QUALIFICATION_CATEGORIES, QUALIFICATION_ALIASES))
      .filter(Boolean),
    qualification_notes: normalizedAnswers.qualification_notes,
    geography_mode: geographyMode,
    state: geographyMode === 'single_state' && /^[A-Z]{2}$/.test(state) ? state : '',
    operating_model: canonicalValue(normalizedAnswers.operating_model, OPERATING_MODELS, OPERATING_MODEL_ALIASES) || 'unknown',
    size_min: normalizedAnswers.size_min === '' || normalizedAnswers.size_min == null ? null : Number(normalizedAnswers.size_min),
    size_max: normalizedAnswers.size_max === '' || normalizedAnswers.size_max == null ? null : Number(normalizedAnswers.size_max),
    set_asides: setAsides,
    interests: normalizedAnswers.interests,
    avoid: normalizedAnswers.avoid,
    adaptive_answers: normalizedAnswers.adaptive_answers,
  };
}

export function validateNormalizedDiscoveryProfile(profile = {}) {
  const errors = [];
  assertAllowed(errors, profile.fulfillment_model, FULFILLMENT_MODELS, '$.fulfillment_model');
  assertAllowed(errors, profile.opportunity_type, OPPORTUNITY_TYPES, '$.opportunity_type');
  assertAllowed(errors, profile.geography_mode, GEOGRAPHY_MODES, '$.geography_mode');
  assertAllowed(errors, profile.operating_model, OPERATING_MODELS, '$.operating_model');
  arrayOfStrings(profile.experience_types).forEach((v, i) => assertAllowed(errors, v, EXPERIENCE_TYPES, `$.experience_types[${i}]`));
  arrayOfStrings(profile.qualification_categories).forEach((v, i) => assertAllowed(errors, v, QUALIFICATION_CATEGORIES, `$.qualification_categories[${i}]`));
  arrayOfStrings(profile.set_asides).forEach((v, i) => assertAllowed(errors, v, CURRENT_CTC_SET_ASIDES, `$.set_asides[${i}]`));
  if (profile.geography_mode === 'single_state' && !/^[A-Z]{2}$/.test(profile.state || '')) {
    addError(errors, '$.state', 'single_state geography requires a two-letter state');
  }
  for (const key of ['size_min', 'size_max']) {
    if (profile[key] != null && (!Number.isFinite(profile[key]) || profile[key] < 0)) {
      addError(errors, `$.${key}`, 'must be null or a non-negative number');
    }
  }
  if (profile.size_min != null && profile.size_max != null && profile.size_min > profile.size_max) {
    addError(errors, '$.size_min', 'must be less than or equal to size_max');
  }
  return { ok: errors.length === 0, errors };
}

export function validateDiscoveryAnswers(rawAnswers = {}) {
  const answers = normalizeDiscoveryAnswers(rawAnswers);
  const errors = [];
  const fulfillment = canonicalValue(answers.fulfillment_model, FULFILLMENT_MODELS, FULFILLMENT_ALIASES);
  const opportunity = canonicalValue(answers.opportunity_type, OPPORTUNITY_TYPES, OPPORTUNITY_TYPE_ALIASES);
  const geography = canonicalValue(answers.geography_mode, GEOGRAPHY_MODES);
  const operating = canonicalValue(answers.operating_model, OPERATING_MODELS, OPERATING_MODEL_ALIASES);

  if (answers.fulfillment_model && !fulfillment) addError(errors, '$.fulfillment_model', 'unsupported fulfillment model');
  if (answers.opportunity_type && !opportunity) addError(errors, '$.opportunity_type', 'unsupported opportunity type');
  if (answers.geography_mode && !geography) addError(errors, '$.geography_mode', 'unsupported geography mode');
  if (answers.operating_model && !operating) addError(errors, '$.operating_model', 'unsupported operating model');
  answers.experience_types.forEach((v, i) => {
    if (!canonicalValue(v, EXPERIENCE_TYPES, EXPERIENCE_ALIASES)) addError(errors, `$.experience_types[${i}]`, 'unsupported experience type');
  });
  answers.qualification_categories.forEach((v, i) => {
    if (!canonicalValue(v, QUALIFICATION_CATEGORIES, QUALIFICATION_ALIASES)) addError(errors, `$.qualification_categories[${i}]`, 'unsupported qualification category');
  });
  answers.set_asides.forEach((v, i) => {
    if (!CURRENT_CTC_SET_ASIDES.includes(v)) addError(errors, `$.set_asides[${i}]`, 'unsupported set-aside');
  });
  if ((geography || answers.geography_mode) === 'single_state' && !/^[A-Z]{2}$/.test(answers.state)) {
    addError(errors, '$.state', 'single-state geography requires a valid two-letter state');
  }

  const profile = normalizeDiscoveryProfile(answers);
  const profileValidation = validateNormalizedDiscoveryProfile(profile);
  errors.push(...profileValidation.errors);
  return { ok: errors.length === 0, errors, answers, normalized_profile: profile };
}

export function validateCandidateEvidence(candidate = {}) {
  const errors = [];
  requireNonEmptyString(errors, candidate.industry, '$.industry');
  requireNonEmptyString(errors, candidate.subindustry, '$.subindustry');
  assertAllowed(errors, candidate.compatibility, COMPATIBILITY_VALUES, '$.compatibility');
  assertAllowed(errors, candidate.capability_fit, FIT_VALUES, '$.capability_fit');
  assertAllowed(errors, candidate.fulfillment_fit, FIT_VALUES, '$.fulfillment_fit');
  assertAllowed(errors, candidate.qualification_fit, FIT_VALUES, '$.qualification_fit');
  assertAllowed(errors, candidate.geography_fit, FIT_VALUES, '$.geography_fit');
  assertAllowed(errors, candidate.operating_model_fit, FIT_VALUES, '$.operating_model_fit');
  assertAllowed(errors, candidate.market_competition, MARKET_COMPETITION_VALUES, '$.market_competition');
  for (const key of ['positive_signals', 'risks', 'validation_questions']) {
    if (!Array.isArray(candidate[key])) addError(errors, `$.${key}`, 'must be an array');
  }
  return { ok: errors.length === 0, errors };
}
