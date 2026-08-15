import { playbookIdForName } from './schema.js';
import naicsReference from './naics/naics_2022_reference.json' with { type: 'json' };
import subindustryMap from './naics/subindustry_naics_map.json' with { type: 'json' };

const REFERENCE_SOURCE = 'lib/playbook/naics/naics_2022_reference.json';
const MAP_SOURCE = 'lib/playbook/naics/subindustry_naics_map.json';

export const NAICS_REFERENCE_CLASSIFICATION = 'AUTHORITATIVE_REFERENCE_ALREADY_EXISTS';
export const NAICS_MAPPING_TYPES = ['direct', 'multi_code', 'context_dependent', 'needs_review'];
export const NAICS_REVIEW_STATUSES = ['machine_proposed'];

let cachedReference = null;
let cachedMap = null;

export function loadNaics2022Reference() {
  if (!cachedReference) cachedReference = naicsReference;
  return cachedReference;
}

export function loadSubindustryNaicsMap() {
  if (!cachedMap) cachedMap = subindustryMap;
  return cachedMap;
}

function cleanCode(code) {
  return String(code || '').trim();
}

export function isOfficialNaics2022(code) {
  const clean = cleanCode(code);
  return /^\d{6}$/.test(clean) && Boolean(loadNaics2022Reference().records[clean]);
}

export function getOfficialNaics2022(code) {
  const clean = cleanCode(code);
  return isOfficialNaics2022(clean) ? loadNaics2022Reference().records[clean] : null;
}

export function getOfficialNaicsTitle(code) {
  return getOfficialNaics2022(code)?.title || null;
}

export function listOfficialNaics2022() {
  const ref = loadNaics2022Reference();
  return Object.keys(ref.records).sort().map((code) => ref.records[code]);
}

export function validateNaicsMappings(codes = []) {
  const list = Array.isArray(codes) ? codes : [codes];
  const seen = new Set();
  const records = [];
  const errors = [];
  list.forEach((item, index) => {
    const code = cleanCode(typeof item === 'object' && item ? item.code : item);
    if (!/^\d{6}$/.test(code)) {
      errors.push({ path: `$[${index}]`, message: 'NAICS code must be exactly six digits' });
      return;
    }
    if (seen.has(code)) {
      errors.push({ path: `$[${index}]`, message: 'duplicate NAICS code' });
      return;
    }
    seen.add(code);
    const official = getOfficialNaics2022(code);
    if (!official) {
      errors.push({ path: `$[${index}]`, message: 'NAICS code is not in the authoritative 2022 reference' });
      return;
    }
    records.push({ code: official.code, title: official.title, source: official.source });
  });
  return { ok: errors.length === 0, errors, records };
}

export function getNaicsReferenceStatus() {
  const ref = loadNaics2022Reference();
  return {
    classification: NAICS_REFERENCE_CLASSIFICATION,
    installed: true,
    evidence: [
      `${ref.metadata.record_count} official six-digit National Industry records loaded from ${ref.metadata.workbook_filename}.`,
      `Runtime source is ${REFERENCE_SOURCE}; the application does not parse the workbook at runtime.`,
      `Subindustry mapping source is ${MAP_SOURCE}.`,
      'Titles are returned from the Census reference, not caller input.',
    ],
    metadata: ref.metadata,
  };
}

export function validateSubindustryNaicsMap(playbook) {
  const payload = loadSubindustryNaicsMap();
  const mappings = payload.mappings || [];
  const errors = [];
  const canonical = [];
  for (const industry of playbook?.industries || []) {
    for (const subindustry of industry.subindustries || []) {
      canonical.push({
        id: playbookIdForName(`${industry.name} ${subindustry.name}`),
        name: subindustry.name,
        industry: industry.name,
      });
    }
  }
  const canonicalIds = new Set(canonical.map((s) => s.id));
  const seenIds = new Set();
  const seenNames = new Set();
  const approvedWords = /human[_ -]?reviewed|client[_ -]?approved|expert[_ -]?verified|war dogs[_ -]?approved/i;

  if (mappings.length !== canonical.length) {
    errors.push({ path: '$.mappings', message: `expected ${canonical.length} mappings, found ${mappings.length}` });
  }

  mappings.forEach((mapping, index) => {
    const path = `$.mappings[${index}]`;
    if (!canonicalIds.has(mapping.subindustry_id)) errors.push({ path: `${path}.subindustry_id`, message: 'not a canonical Playbook sub-industry id' });
    if (seenIds.has(mapping.subindustry_id)) errors.push({ path: `${path}.subindustry_id`, message: 'duplicate sub-industry id' });
    seenIds.add(mapping.subindustry_id);
    const nameKey = `${mapping.industry_name} > ${mapping.subindustry_name}`.toLowerCase();
    if (seenNames.has(nameKey)) errors.push({ path: `${path}.subindustry_name`, message: 'duplicate sub-industry name' });
    seenNames.add(nameKey);
    if (!NAICS_MAPPING_TYPES.includes(mapping.mapping_type)) errors.push({ path: `${path}.mapping_type`, message: 'invalid mapping type' });
    if (!NAICS_REVIEW_STATUSES.includes(mapping.review_status)) errors.push({ path: `${path}.review_status`, message: 'invalid review status' });
    if (approvedWords.test(String(mapping.review_status || '')) || approvedWords.test(String(mapping.mapping_notes || ''))) {
      errors.push({ path, message: 'mapping must not be marked human-reviewed/client-approved/expert-verified' });
    }
    const codes = Array.isArray(mapping.codes) ? mapping.codes : [];
    const codeSet = new Set();
    if (codes.length > 5) errors.push({ path: `${path}.codes`, message: 'must not contain more than 5 codes' });
    codes.forEach((code, codeIndex) => {
      if (codeSet.has(code)) errors.push({ path: `${path}.codes[${codeIndex}]`, message: 'duplicate code within mapping' });
      codeSet.add(code);
      if (!isOfficialNaics2022(code)) errors.push({ path: `${path}.codes[${codeIndex}]`, message: 'code is not in authoritative reference' });
    });
    const titles = Array.isArray(mapping.official_titles) ? mapping.official_titles : [];
    const candidates = Array.isArray(mapping.candidate_codes) ? mapping.candidate_codes : [];
    const candidateTitles = Array.isArray(mapping.candidate_titles) ? mapping.candidate_titles : [];
    codes.forEach((code, codeIndex) => {
      const title = getOfficialNaicsTitle(code);
      if (titles[codeIndex] !== title) errors.push({ path: `${path}.official_titles[${codeIndex}]`, message: 'title must match authoritative reference' });
    });
    candidates.forEach((code, candidateIndex) => {
      if (!isOfficialNaics2022(code)) errors.push({ path: `${path}.candidate_codes[${candidateIndex}]`, message: 'candidate code is not in authoritative reference' });
      const title = getOfficialNaicsTitle(code);
      if (candidateTitles[candidateIndex] !== title) errors.push({ path: `${path}.candidate_titles[${candidateIndex}]`, message: 'candidate title must match authoritative reference' });
    });
    const shouldBeProductionSafe = ['direct', 'multi_code'].includes(mapping.mapping_type) && codes.length > 0;
    if (mapping.production_safe !== shouldBeProductionSafe) {
      errors.push({ path: `${path}.production_safe`, message: 'must reflect whether canonical codes are production-safe' });
    }
    if (['context_dependent', 'needs_review'].includes(mapping.mapping_type) && codes.length > 0) {
      errors.push({ path: `${path}.codes`, message: 'context-dependent and needs-review mappings must not expose production-safe canonical codes' });
    }
    if (mapping.mapping_type === 'direct' && codes.length === 0) {
      errors.push({ path: `${path}.codes`, message: 'direct mappings must contain at least one official code' });
    }
    if (mapping.mapping_type === 'context_dependent') {
      const required = Array.isArray(mapping.required_context) ? mapping.required_context : [];
      if (candidates.length === 0 && required.length === 0) {
        errors.push({ path, message: 'context-dependent mappings must expose candidate codes and/or required context' });
      }
    }
  });

  for (const id of canonicalIds) {
    if (!seenIds.has(id)) errors.push({ path: '$.mappings', message: `missing mapping for ${id}` });
  }

  return { ok: errors.length === 0, errors, counts: countMappingsByType(mappings), mappings };
}

export function countMappingsByType(mappings = loadSubindustryNaicsMap().mappings || []) {
  return NAICS_MAPPING_TYPES.reduce((acc, type) => {
    acc[type] = mappings.filter((mapping) => mapping.mapping_type === type).length;
    return acc;
  }, {});
}
