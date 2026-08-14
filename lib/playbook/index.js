import {
  assertValidPlaybookDataset,
  normalizeIndustry,
  playbookIdForName,
} from './schema.js';
import playbookSource from './war_dogs_playbook_source.json' with { type: 'json' };

const CANONICAL_DATASET = playbookSource;

let cachedPlaybook = null;

function readCanonicalDataset() {
  return CANONICAL_DATASET;
}

export function loadPlaybook({ dataset } = {}) {
  if (!dataset && cachedPlaybook) return cachedPlaybook;
  const source = dataset || readCanonicalDataset();
  const validation = assertValidPlaybookDataset(source);
  const industries = source.industries.map(normalizeIndustry);
  const byIndustryKey = new Map();
  const bySubindustryKey = new Map();

  for (const industry of industries) {
    byIndustryKey.set(industry.id, industry);
    byIndustryKey.set(industry.name.toLowerCase(), industry);
    for (const subindustry of industry.subindustries) {
      bySubindustryKey.set(subindustry.id, subindustry);
      bySubindustryKey.set(subindustry.name.toLowerCase(), subindustry);
    }
  }

  const playbook = {
    dataset_name: source.dataset_name,
    source: source.source,
    canonical_source_note: source.canonical_source_note,
    derivation_policy: source.derivation_policy,
    global_guidance: source.global_guidance || {},
    validation,
    industries,
    byIndustryKey,
    bySubindustryKey,
  };
  if (!dataset) cachedPlaybook = playbook;
  return playbook;
}

export function listCanonicalIndustries() {
  return loadPlaybook().industries.map(({ subindustries, ...industry }) => ({
    ...industry,
    subindustry_count: subindustries.length,
  }));
}

export function getCanonicalIndustry(nameOrId) {
  const key = String(nameOrId || '').trim();
  if (!key) return null;
  const playbook = loadPlaybook();
  return playbook.byIndustryKey.get(key.toLowerCase()) || playbook.byIndustryKey.get(playbookIdForName(key)) || null;
}

export function listSubIndustriesForIndustry(nameOrId) {
  const industry = getCanonicalIndustry(nameOrId);
  return industry ? industry.subindustries : [];
}

export function getCanonicalSubIndustry(nameOrId) {
  const key = String(nameOrId || '').trim();
  if (!key) return null;
  const playbook = loadPlaybook();
  return playbook.bySubindustryKey.get(key.toLowerCase()) || playbook.bySubindustryKey.get(playbookIdForName(key)) || null;
}

export function getSubIndustryGuidance(nameOrId) {
  const subindustry = getCanonicalSubIndustry(nameOrId);
  if (!subindustry) return null;
  const industry = getCanonicalIndustry(subindustry.industry);
  return {
    industry: subindustry.industry,
    subindustry: subindustry.name,
    market_competition: industry?.competition_level || 'unknown',
    primary_award_method: industry?.primary_award_method || '',
    description: subindustry.description,
    broker_guidance: subindustry.broker_guidance,
    industry_broker_guidance: industry?.broker_guidance || '',
    global_guidance: loadPlaybook().global_guidance,
  };
}

export {
  assertValidPlaybookDataset,
  validatePlaybookDataset,
  normalizeDiscoveryAnswers,
  normalizeDiscoveryProfile,
  validateDiscoveryAnswers,
  validateNormalizedDiscoveryProfile,
  validateCandidateEvidence,
  CURRENT_CTC_SET_ASIDES,
  PLAYBOOK_VERSION,
} from './schema.js';

export {
  getNaicsReferenceStatus,
  isOfficialNaics2022,
  getOfficialNaics2022,
  getOfficialNaicsTitle,
  listOfficialNaics2022,
  loadNaics2022Reference,
  loadSubindustryNaicsMap,
  validateNaicsMappings,
  validateSubindustryNaicsMap,
  countMappingsByType,
  NAICS_REFERENCE_CLASSIFICATION,
} from './naicsReference.js';
