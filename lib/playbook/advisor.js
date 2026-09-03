import { normalizeDiscoveryAnswers, normalizeDiscoveryProfile } from './index.js';
import { preselectPlaybookCandidates } from './recommendationEngine.js';
import { adviseDiscoveryTurn } from '../ai/claude.js';

export const ADVISOR_DIMENSIONS = ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model', 'contract_scale', 'interests_avoidances'];
export const ADVISOR_MAX_TURNS = ADVISOR_DIMENSIONS.length;
export const ADVISOR_OPENING_ID = 'advisor-capability-opening-v1';

const QUESTION_INTENTS = {
  capability: 'identify the work the student can provide, manage, or source today',
  opportunity_type: 'determine whether the student expects product, service, or mixed opportunities',
  fulfillment: 'determine who will perform or source the contracted work',
  experience: 'identify usable commercial, state, local, subcontractor, federal, or industry experience',
  qualifications: 'identify existing qualifications, certifications, licenses, staff, equipment, suppliers, or unknowns',
  set_asides: 'identify federal set-asides the student currently holds',
  geography: 'identify where the student can realistically deliver',
  operating_model: 'identify whether recurring service, project, product supply, or flexible contract structures fit the business',
  contract_scale: 'identify the contract size range the student can responsibly handle',
  interests_avoidances: 'capture work preferences and work to avoid',
  fulfillment_clarification: 'resolve a conflict about who will perform or source the work',
  capability_clarification: 'resolve a conflict about the primary capability lane',
};

function question(category, prompt, helper, placeholder, input_type, options = []) {
  return { id: category === 'capability' ? ADVISOR_OPENING_ID : `advisor-${category}-v1`, category, source: 'fallback', intent: QUESTION_INTENTS[category] || '', prompt, helper, placeholder, input_type, options: options.map(([value, label]) => ({ value, label })) };
}

const FALLBACKS = {
  capability: question('capability', 'What work can you provide, manage, or source today?', 'Use plain words. A short answer is fine.', 'Tell the Niche Advisor your answer...', 'text', [['it_support', 'IT support'], ['cleaning', 'Cleaning / Facilities'], ['construction', 'Construction'], ['staffing', 'Staffing / Labor'], ['product_sourcing', 'Product sourcing'], ['not_sure', 'Not sure yet']]),
  opportunity_type: question('opportunity_type', 'Would you sell products, provide services, or do both?', 'Choose what matches how you would get paid.', '', 'single_choice', [['product', 'Products'], ['service', 'Services'], ['either', 'Either'], ['unknown', 'Not sure']]),
  fulfillment: question('fulfillment', 'Who would do the work if you won?', 'Choose your own team, subcontractors, or a mix.', '', 'single_choice', [['self', 'My own team'], ['existing_vendors', 'Subcontractors'], ['hybrid', 'Combination'], ['unknown', 'Not sure yet']]),
  experience: question('experience', 'What experience can we use?', 'Commercial, state, local, and industry work can still matter.', '', 'single_choice', [['federal_contracts', 'Federal'], ['state_local_contracts', 'State / local'], ['private_commercial', 'Commercial'], ['industry_experience', 'Industry experience'], ['brand_new', 'Brand new']]),
  qualifications: question('qualifications', 'What do you already have that helps you deliver?', 'Some solicitations care about certifications, clearances, licenses, staff, equipment, or suppliers. Only choose what you have today.', '', 'single_choice', [['licenses', 'Licenses'], ['bonding', 'Bonding'], ['qualified_staff', 'Qualified staff'], ['specialized_equipment', 'Equipment'], ['regulated_product_suppliers', 'Suppliers'], ['none_unknown', 'None / not sure']]),
  set_asides: question('set_asides', 'Do you have any federal set-asides?', 'If you are not sure, choose not sure.', '', 'single_choice', [['sb', 'Small Business'], ['sdvosb', 'SDVOSB'], ['wosb', 'WOSB'], ['8a', '8(a)'], ['hubzone', 'HUBZone'], ['unknown', 'Not sure']]),
  geography: question('geography', 'Where can you deliver the work?', 'Use a state code like GA, or describe your service area.', 'Example: GA, or explain where you can deliver', 'text', [['nationwide', 'Nationwide'], ['remote', 'Remote / digital'], ['vendor_dependent', 'Depends on vendor'], ['unknown', 'Not sure']]),
  operating_model: question('operating_model', 'What type of contract would fit your business best?', 'Choose the type you could manage most easily.', '', 'single_choice', [['recurring_service', 'Recurring services'], ['project', 'Project work'], ['volume_product', 'Product supply'], ['no_preference', 'No preference'], ['unknown', 'Not sure']]),
  contract_scale: question('contract_scale', 'What contract size would feel manageable?', 'Choose a size you could deliver well.', '', 'single_choice', [['small', 'Under $25k'], ['moderate', '$25k to $150k'], ['large', '$150k+'], ['unknown', 'Not sure']]),
  interests_avoidances: question('interests_avoidances', 'Anything you want us to include or avoid?', 'Optional, but useful. Tell me the work you prefer and anything you do not want to chase.', 'Example: include cleaning and restoration; avoid waste management', 'text', [['include_services', 'Include services I already know'], ['include_products', 'Include product sourcing'], ['avoid_construction', 'Avoid construction'], ['avoid_staffing', 'Avoid staffing'], ['avoid_none', 'Nothing to avoid'], ['not_sure', 'Not sure']]),
};

const COACHING = {
  capability: 'Let us start with what is real today. Tell me what you can do, manage, or source.',
  opportunity_type: 'Good. Now tell me how you would get paid for this work.',
  fulfillment: 'Next, tell me who would deliver the work if you won.',
  experience: 'Now tell me what experience we can use. It does not need to be federal work.',
  qualifications: 'Now tell me what you already have that helps you deliver the work.',
  set_asides: 'Set-asides only help if you really have them. Choose what is true today.',
  geography: 'Now tell me where you can deliver the work.',
  operating_model: 'Now choose the type of contract your business could handle best.',
  contract_scale: 'Now choose a contract size that feels manageable.',
  interests_avoidances: 'Last question. Tell me what you want us to look for, and what you want us to skip.',
};

function text(value, max = 420) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function safeOptions(options = []) { return Array.isArray(options) ? options.slice(0, 8).map((option) => ({ value: text(option?.value, 40), label: text(option?.label, 60) })).filter((option) => option.value && option.label) : []; }
function unresolved(resolved = []) { return ADVISOR_DIMENSIONS.filter((dimension) => !resolved.includes(dimension)); }
function inferred(answers = {}) {
  const value = normalizeDiscoveryAnswers(answers);
  const resolved = [];
  if (value.capabilities_text) resolved.push('capability');
  if (value.opportunity_type && value.opportunity_type !== 'unknown') resolved.push('opportunity_type');
  if (value.fulfillment_model && value.fulfillment_model !== 'unknown') resolved.push('fulfillment');
  if (value.experience_types.length) resolved.push('experience');
  if (value.qualification_categories.length && !value.qualification_categories.every((item) => ['none_unknown', 'none_or_unknown'].includes(item))) resolved.push('qualifications');
  if (value.set_asides.length) resolved.push('set_asides');
  if (value.geography_mode && value.geography_mode !== 'unknown') resolved.push('geography');
  if (value.operating_model && value.operating_model !== 'unknown') resolved.push('operating_model');
  if (value.size_min !== '' || value.size_max !== '') resolved.push('contract_scale');
  if (value.interests || value.avoid) resolved.push('interests_avoidances');
  return resolved;
}
function normalizeResolved(answers, resolved = []) {
  return [...new Set([...resolved, ...inferred(answers)].filter((value) => ADVISOR_DIMENSIONS.includes(value)))];
}
function dimensionHasEvidence(dimension, answers = {}) {
  const value = normalizeDiscoveryAnswers(answers);
  switch (dimension) {
    case 'capability': return Boolean(value.capabilities_text);
    case 'opportunity_type': return Boolean(value.opportunity_type && value.opportunity_type !== 'unknown');
    case 'fulfillment': return Boolean(value.fulfillment_model && value.fulfillment_model !== 'unknown');
    case 'experience': return value.experience_types.length > 0;
    case 'qualifications': return value.qualification_categories.length > 0 || Boolean(value.qualification_notes);
    case 'set_asides': return value.set_asides.length > 0;
    case 'geography': return Boolean(value.geography_mode && value.geography_mode !== 'unknown');
    case 'operating_model': return Boolean(value.operating_model && value.operating_model !== 'unknown');
    case 'contract_scale': return value.size_min !== '' || value.size_max !== '';
    case 'interests_avoidances': return Boolean(value.interests || value.avoid);
    default: return false;
  }
}
function compactAdvisorProfile(answers = {}) {
  const raw = normalizeDiscoveryAnswers(answers);
  const normalized = normalizeDiscoveryProfile(raw);
  const profile = {};
  if (raw.capabilities_text) profile.capabilities_text = raw.capabilities_text;
  if (raw.fulfillment_model) profile.fulfillment_model = normalized.fulfillment_model;
  if (raw.opportunity_type) profile.opportunity_type = normalized.opportunity_type;
  if (raw.experience_types.length) profile.experience_types = normalized.experience_types;
  if (raw.qualification_categories.length) profile.qualification_categories = normalized.qualification_categories;
  if (raw.qualification_notes) profile.qualification_notes = raw.qualification_notes;
  if (raw.geography_mode) profile.geography_mode = normalized.geography_mode;
  if (raw.state) profile.state = raw.state;
  if (raw.operating_model) profile.operating_model = normalized.operating_model;
  if (raw.size_min !== '') profile.size_min = normalized.size_min;
  if (raw.size_max !== '') profile.size_max = normalized.size_max;
  if (raw.set_asides.length) profile.set_asides = normalized.set_asides;
  if (raw.interests) profile.interests = raw.interests;
  if (raw.avoid) profile.avoid = raw.avoid;
  return profile;
}
function mapped(value, map) { return map[value] || map[value.toLowerCase()] || null; }
function canonicalFulfillment(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (['self', 'self_perform'].includes(clean)) return 'self';
  if (['existing_vendors', 'existing_partners', 'source_as_needed'].includes(clean)) return 'existing_vendors';
  if (clean === 'hybrid') return 'hybrid';
  if (clean === 'unknown') return 'unknown';
  return '';
}
function explicitCorrection(value) {
  const clean = text(value, 900);
  return /^(actually|to correct that|correction|on second thought)\b/i.test(clean)
    || /\b(instead|rather than|change that|correct that|update that|switch to|we now plan|now we plan)\b/i.test(clean);
}
function fulfillmentFromText(value) {
  const lower = text(value, 900).toLowerCase();
  if (!lower) return '';
  const self = /\b(self|self[-\s]?perform|my own|our own|own team|own staff|in-house|internal team|employees|technicians|our team|my team|we perform|we do the work|perform the work ourselves|handle .* ourselves)\b/.test(lower);
  const vendor = /\b(broker|source|sourcing|subcontract|subcontractor|subcontractors|partner|partners|vendor|vendors|staffing|outside techs|outside technicians)\b/.test(lower);
  if (self && vendor) return 'hybrid';
  if (vendor) return 'existing_vendors';
  if (self) return 'self';
  return '';
}
function operatingModelFromText(value) {
  const lower = text(value, 900).toLowerCase();
  if (!lower) return '';
  if (/\b(not sure|unsure|no preference|either|flexible)\b/.test(lower)) return 'no_preference';
  if (/\b(recurring|ongoing|long[-\s]?term|managed service|managed services|service contract|service contracts|monthly|multi[-\s]?year|sla|slas)\b/.test(lower)) return 'recurring_service';
  if (/\b(product supply|product supplies|supply contract|supply contracts|products|goods|inventory)\b/.test(lower)) return 'volume_product';
  if (/\b(one[-\s]?off|project work|project[-\s]?based|single project|projects)\b/.test(lower)) return 'project';
  return '';
}
function operatingResolvedByDeliveryText(value) {
  const lower = text(value, 900).toLowerCase();
  return /\b(existing|own|our|my|internal|in-house)\s+(employees|team|staff|technicians|techs)\b/.test(lower)
    || /\b(established|existing|certified)\s+(vendors|subcontractors|partners|network)\b/.test(lower)
    || /\b(team|employees|staff|technicians|techs).*\b(perform|handle|deliver)\b/.test(lower)
    || /\b(perform|handle|deliver).*\b(team|employees|staff|technicians|techs)\b/.test(lower);
}
function canonicalAdvisorCategory(value) {
  const raw = String(value || '').trim();
  const aliases = {
    fulfillment_model: 'fulfillment',
    experience_types: 'experience',
    qualification_categories: 'qualifications',
    qualifications_model: 'qualifications',
    set_aside: 'set_asides',
    geography_mode: 'geography',
    contract_size: 'contract_scale',
    size: 'contract_scale',
    interests: 'interests_avoidances',
  };
  return aliases[raw] || raw;
}
function semanticCategoryForQuestion(question = {}) {
  const category = canonicalAdvisorCategory(question.category);
  const wording = `${question.prompt || ''} ${question.helper || ''} ${question.intent || ''}`.toLowerCase();
  if (category === 'fulfillment') return 'fulfillment';
  if (category === 'operating_model' && /\b(who|deliver|delivery|perform|solo|team|hire|partner|vendor|subcontract|broker|source|staff)\b/.test(wording)) return 'fulfillment';
  return category;
}
function questionMatchesCategory(question = {}, categoryInput = '') {
  const category = canonicalAdvisorCategory(categoryInput || question.category);
  const wording = `${question.prompt || ''} ${question.helper || ''}`.toLowerCase();
  if (!wording.trim()) return false;
  const patterns = {
    capability: /\b(work|service|services|product|products|provide|manage|source|capabilit|offer|deliver)\b/,
    opportunity_type: /\b(product|products|service|services|sell|provide|supply|both)\b/,
    fulfillment: /\b(who|perform|performs|performing|deliver|delivers|delivery|team|staff|employee|employees|vendor|vendors|partner|partners|subcontract|contractor|source|sourcing|hybrid|in[-\s]?house)\b/,
    experience: /\b(experience|past performance|performed|delivered|worked|work history|client|clients|federal|commercial|state|local|subcontract)\b/,
    qualifications: /\b(qualification|qualified|certification|certified|license|licensed|bonding|bonded|clearance|staff|equipment|supplier|credential|technician)\b/,
    set_asides: /\b(set[-\s]?aside|small business|sdvosb|vosb|wosb|edwosb|8\s*\(?a\)?|hubzone|veteran|women[-\s]?owned)\b/,
    geography: /\b(where|location|locations|state|states|nationwide|remote|region|area|geograph|service area|travel)\b/,
    operating_model: /\b(recurring|ongoing|long[-\s]?term|project|one[-\s]?off|product supply|supply contract|contract type|service contract|managed service|monthly|multi[-\s]?year)\b/,
    contract_scale: /\b(size|value|range|budget|dollar|\$|thousand|million|manageable|contract amount)\b/,
    interests_avoidances: /\b(want|interested|interest|prefer|focus|pursue|avoid|skip|exclude|do not want|don't want|chase)\b/,
  };
  return patterns[category] ? patterns[category].test(wording) : true;
}
function isDuplicateQuestion(question = {}, resolved = [], answers = {}) {
  const category = question.category || '';
  const semantic = semanticCategoryForQuestion(question);
  if (resolved.includes(category) || resolved.includes(semantic)) return { duplicate: true, reason: 'already_resolved', category: semantic || category };
  const cleanAnswers = normalizeDiscoveryAnswers(answers);
  if (semantic === 'fulfillment' && cleanAnswers.fulfillment_model) return { duplicate: true, reason: 'known_fulfillment', category: semantic };
  return { duplicate: false, reason: '', category: semantic || category };
}
function safeAdvisorLog(logger, stage, payload = {}, level = 'info') {
  logger?.[level]?.({ event: 'playbook_discovery_debug', stage, ...payload });
}
function deliveryClarificationTurn(answers, resolved, previous, incoming, logger) {
  safeAdvisorLog(logger, 'advisor_contradiction_detected', { field: 'fulfillment_model', previous, incoming });
  return {
    answers,
    resolved_dimensions: resolved,
    assistant_message: "You mentioned your own team earlier, but now you're describing vendors or subcontractors. Which model should I use for this lane?",
    next_question: {
      id: 'advisor-fulfillment-clarification-v1',
      category: 'fulfillment_clarification',
      intent: QUESTION_INTENTS.fulfillment_clarification,
      prompt: 'Which best describes how you want to pursue these contracts?',
      helper: '',
      placeholder: '',
      input_type: 'single_choice',
      options: [
        { value: 'self', label: 'Mostly our own team' },
        { value: 'existing_vendors', label: 'Mostly subcontractors/vendors' },
        { value: 'hybrid', label: 'Hybrid, our team plus partners' },
      ],
    },
    complete: false,
    fallback: true,
    count_progress: false,
  };
}
function setAsidesFromText(value) {
  const lower = text(value, 900).toLowerCase();
  if (/\b(not sure|none|no specialized|haven't pursued|have not pursued)\b/.test(lower) && !/\bsmall business\b|\bsb\b/.test(lower)) return [];
  return [
    [/\bsmall business\b|\bsb\b/, 'sb'],
    [/\bsdvosb\b|service[-\s]?disabled veteran/, 'sdvosb'],
    [/\bvosb\b|veteran[-\s]?owned/, 'vosb'],
    [/\bedwosb\b/, 'edwosb'],
    [/\bwosb\b|women[-\s]?owned/, 'wosb'],
    [/\b8\s*\(?a\)?\b/, '8a'],
    [/\bhubzone\b/, 'hubzone'],
  ].filter(([pattern]) => pattern.test(lower)).map(([, code]) => code);
}
function moneyFromText(value) {
  const match = String(value || '').toLowerCase().match(/\$?\s*(\d+(?:[.,]\d+)?)\s*(k|thousand)?/);
  if (!match) return null;
  const number = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(number)) return null;
  return Math.round(number * (match[2] ? 1000 : 1));
}
function contractSizeFromText(value) {
  const lower = text(value, 900).toLowerCase();
  if (/\b(not sure|unsure|no range|unknown)\b/.test(lower)) return { size_min: '', size_max: '' };
  if (/under|up to|below|less than|max(?:imum)?/.test(lower)) return { size_min: '', size_max: String(moneyFromText(lower) || '') };
  if (/\+|above|over|more than|at least|min(?:imum)?/.test(lower)) return { size_min: String(moneyFromText(lower) || ''), size_max: '' };
  const numbers = [...lower.matchAll(/\$?\s*(\d+(?:[.,]\d+)?)\s*(k|thousand)?/g)]
    .map((match) => Math.round(Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1)))
    .filter(Number.isFinite);
  if (numbers.length >= 2) return { size_min: String(Math.min(...numbers)), size_max: String(Math.max(...numbers)) };
  if (numbers[0]) return numbers[0] <= 25000 ? { size_min: '', size_max: String(numbers[0]) } : { size_min: String(numbers[0]), size_max: '' };
  return null;
}
function fallbackUpdate(answers, category, answer) {
  const value = text(answer, 900);
  if (!value) return normalizeDiscoveryAnswers(answers);
  const lowerValue = value.toLowerCase();
  const single = {
    opportunity_type: { Products: 'product', products: 'product', Services: 'service', services: 'service', Either: 'either', either: 'either', 'Not sure': 'unknown', unknown: 'unknown' },
    fulfillment: { 'My own team': 'self', self: 'self', Subcontractors: 'existing_vendors', existing_vendors: 'existing_vendors', Combination: 'hybrid', hybrid: 'hybrid', 'Not sure yet': 'unknown', unknown: 'unknown' },
    operating_model: { 'Recurring services': 'recurring_service', recurring_service: 'recurring_service', 'Project work': 'project', project: 'project', 'Product supply': 'volume_product', volume_product: 'volume_product', 'No preference': 'no_preference', no_preference: 'no_preference', 'Not sure': 'unknown', unknown: 'unknown' },
  };
  const lists = {
    experience: { Federal: 'federal_contracts', 'State / local': 'state_local_contracts', Commercial: 'private_commercial', 'Industry experience': 'industry_experience', 'Brand new': 'brand_new' },
    qualifications: { Licenses: 'licenses', Bonding: 'bonding', 'Qualified staff': 'qualified_staff', Equipment: 'specialized_equipment', Suppliers: 'regulated_product_suppliers', 'None / not sure': 'none_unknown' },
    set_asides: { 'Small Business': 'sb', SDVOSB: 'sdvosb', WOSB: 'wosb', '8(a)': '8a', HUBZone: 'hubzone', 'Not sure': 'unknown' },
  };
  const contractSizes = { 'Under $25k': { size_min: '', size_max: '25000' }, 'Start small': { size_min: '', size_max: '25000' }, '$25k to $150k': { size_min: '25000', size_max: '150000' }, Moderate: { size_min: '25000', size_max: '150000' }, '$150k+': { size_min: '150000', size_max: '' }, 'Comfortable with larger work': { size_min: '150000', size_max: '' }, 'Not sure': { size_min: '', size_max: '' }, unknown: { size_min: '', size_max: '' } };
  const geography = /^[A-Z]{2}$/i.test(value) ? { geography_mode: 'single_state', state: value.toUpperCase() } : mapped(value, { Nationwide: { geography_mode: 'nationwide', state: '' }, nationwide: { geography_mode: 'nationwide', state: '' }, 'Remote / digital': { geography_mode: 'remote', state: '' }, remote: { geography_mode: 'remote', state: '' }, 'Depends on vendor': { geography_mode: 'vendor_dependent', state: '' }, vendor_dependent: { geography_mode: 'vendor_dependent', state: '' }, 'Not sure': { geography_mode: 'unknown', state: '' }, unknown: { geography_mode: 'unknown', state: '' } });
  const fulfillmentFromSentence = ['fulfillment', 'fulfillment_clarification'].includes(category) ? fulfillmentFromText(value) : null;
  const listValue = lists[category] ? mapped(value, lists[category]) : null;
  const parsedSetAsides = category === 'set_asides' ? setAsidesFromText(value) : [];
  const interestAvoidance = parseInterestAvoidance(value);
  const updates = category === 'capability' ? { capabilities_text: value }
    : category === 'interests_avoidances' ? interestAvoidance
    : category === 'geography' ? (geography || { geography_mode: 'unknown', state: '' })
    : category === 'contract_scale' ? (contractSizes[value] || contractSizes[value.toLowerCase()] || contractSizeFromText(value) || { size_min: '', size_max: '' })
    : category === 'fulfillment_clarification' ? { fulfillment_model: fulfillmentFromSentence || mapped(value, single.fulfillment) || 'unknown' }
    : category === 'fulfillment' ? { fulfillment_model: fulfillmentFromSentence || mapped(value, single.fulfillment) || 'unknown' }
    : category === 'operating_model' ? { operating_model: mapped(value, single.operating_model) || operatingModelFromText(value) || 'unknown' }
    : category === 'opportunity_type' ? { opportunity_type: mapped(value, single.opportunity_type) || 'unknown' }
    : lists[category] ? { [category === 'qualifications' ? 'qualification_categories' : category === 'set_asides' ? 'set_asides' : 'experience_types']: category === 'set_asides' ? (parsedSetAsides.length ? parsedSetAsides : listValue && listValue !== 'unknown' ? [listValue] : []) : listValue && listValue !== 'unknown' ? [listValue] : [] }
    : {};
  return normalizeDiscoveryAnswers({ ...answers, ...updates });
}

function parseInterestAvoidance(value) {
  const clean = text(value, 900);
  const lower = clean.toLowerCase();
  if (lower === 'nothing to avoid') return { interests: '', avoid: '' };
  if (lower === 'not sure') return { interests: '', avoid: '' };
  if (/\b(avoid|skip|exclude|do not want|don't want|do not chase|don't chase)\b/i.test(clean)) {
    const [includePart, ...avoidParts] = clean.split(/\b(?:avoid|skip|exclude|do not want|don't want|do not chase|don't chase)\b:?/i);
    return {
      interests: includePart.replace(/^(include|focus on|i want to focus on|we want to focus on):?/i, '').replace(/[;/,-]\s*$/, '').trim(),
      avoid: avoidParts.join(' ').trim(),
    };
  }
  return { interests: clean, avoid: '' };
}
function cleanPersistedAdvisorAnswers(rawAnswers = {}) {
  const answers = normalizeDiscoveryAnswers(rawAnswers);
  const allowedValues = {
    fulfillment_model: ['self', 'self_perform', 'existing_vendors', 'existing_partners', 'source_as_needed', 'hybrid', 'unknown'],
    opportunity_type: ['product', 'products', 'service', 'services', 'either', 'both', 'unknown'],
    geography_mode: ['single_state', 'multi_state', 'nationwide', 'remote', 'vendor_dependent', 'unknown'],
    operating_model: ['volume_product', 'volume_products', 'recurring_service', 'recurring_services', 'project', 'project_based', 'no_preference', 'unknown'],
    experience_types: ['federal_contracts', 'state_local_contracts', 'state_local_government', 'private_commercial', 'industry_experience', 'brand_new', 'new_to_area'],
    qualification_categories: ['licenses', 'professional_trade_licenses', 'bonding', 'bonding_capacity', 'security_clearances', 'technical_cyber', 'technical_cyber_certifications', 'healthcare_medical', 'healthcare_medical_credentials', 'environmental_safety', 'environmental_safety_certifications', 'specialized_equipment', 'qualified_staff', 'regulated_product_suppliers', 'other', 'none_unknown', 'none_or_unknown'],
    set_asides: ['sb', 'sdvosb', 'vosb', 'wosb', 'edwosb', '8a', 'hubzone'],
  };
  const scalarAliases = {
    fulfillment_model: { self_perform: 'self', existing_partners: 'existing_vendors' },
    opportunity_type: { products: 'product', services: 'service', both: 'either' },
    geography_mode: {},
    operating_model: { volume_products: 'volume_product', recurring_services: 'recurring_service', project_based: 'project' },
  };
  for (const key of ['fulfillment_model', 'opportunity_type', 'geography_mode', 'operating_model']) {
    const raw = String(answers[key] || '').trim().toLowerCase();
    if (!raw) { answers[key] = ''; continue; }
    if (!allowedValues[key].includes(raw)) { answers[key] = ''; continue; }
    answers[key] = scalarAliases[key][raw] || raw;
  }
  for (const key of ['experience_types', 'qualification_categories', 'set_asides']) {
    answers[key] = answers[key].map((item) => String(item).trim().toLowerCase()).filter((item) => allowedValues[key].includes(item));
  }
  if (answers.geography_mode === 'single_state' && !/^[A-Z]{2}$/.test(answers.state)) {
    answers.geography_mode = '';
    answers.state = '';
  }
  for (const key of ['size_min', 'size_max']) {
    if (answers[key] !== '' && (!Number.isFinite(Number(answers[key])) || Number(answers[key]) < 0)) answers[key] = '';
  }
  if (answers.size_min !== '' && answers.size_max !== '' && Number(answers.size_min) > Number(answers.size_max)) {
    answers.size_min = '';
    answers.size_max = '';
  }
  return answers;
}
function sanitizeUpdates(updates = {}) {
  const allowed = ['capabilities_text', 'fulfillment_model', 'opportunity_type', 'experience_types', 'qualification_categories', 'qualification_notes', 'geography_mode', 'state', 'operating_model', 'size_min', 'size_max', 'set_asides', 'interests', 'avoid'];
  const allowedValues = {
    fulfillment_model: ['self', 'self_perform', 'existing_vendors', 'existing_partners', 'source_as_needed', 'hybrid', 'unknown'],
    opportunity_type: ['product', 'products', 'service', 'services', 'either', 'both', 'unknown'],
    geography_mode: ['single_state', 'multi_state', 'nationwide', 'remote', 'vendor_dependent', 'unknown'],
    operating_model: ['volume_product', 'volume_products', 'recurring_service', 'recurring_services', 'project', 'project_based', 'no_preference', 'unknown'],
    experience_types: ['federal_contracts', 'state_local_contracts', 'state_local_government', 'private_commercial', 'industry_experience', 'brand_new', 'new_to_area'],
    qualification_categories: ['licenses', 'professional_trade_licenses', 'bonding', 'bonding_capacity', 'security_clearances', 'technical_cyber', 'technical_cyber_certifications', 'healthcare_medical', 'healthcare_medical_credentials', 'environmental_safety', 'environmental_safety_certifications', 'specialized_equipment', 'qualified_staff', 'regulated_product_suppliers', 'other', 'none_unknown', 'none_or_unknown'],
    set_asides: ['sb', 'sdvosb', 'vosb', 'wosb', 'edwosb', '8a', 'hubzone'],
  };
  const cleanSize = (value) => {
    if (value == null || String(value).trim() === '') return '';
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? String(number) : '';
  };
  return Object.fromEntries(allowed.filter((key) => {
    if (!Object.hasOwn(updates, key)) return false;
    const value = updates[key];
    if (value == null) return false;
    if (key === 'size_min' || key === 'size_max') return cleanSize(value) !== '';
    if (Array.isArray(value)) return value.some((item) => allowedValues[key]?.includes(String(item).trim().toLowerCase()) ?? String(item).trim() !== '');
    if (allowedValues[key]) return allowedValues[key].includes(String(value).trim().toLowerCase());
    return String(value).trim() !== '';
  }).map((key) => {
    const value = updates[key];
    if (key === 'size_min' || key === 'size_max') return [key, cleanSize(value)];
    if (Array.isArray(value) && allowedValues[key]) return [key, value.map((item) => String(item).trim().toLowerCase()).filter((item) => allowedValues[key].includes(item))];
    if (allowedValues[key]) {
      const raw = String(value).trim().toLowerCase();
      const scalarAliases = {
        fulfillment_model: { self_perform: 'self', existing_partners: 'existing_vendors' },
        opportunity_type: { products: 'product', services: 'service', both: 'either' },
        geography_mode: {},
        operating_model: { volume_products: 'volume_product', recurring_services: 'recurring_service', project_based: 'project' },
      };
      return [key, scalarAliases[key]?.[raw] || raw];
    }
    return [key, value];
  }));
}
function deliveryDimensionsFromAnswer(category, answer) {
  const dimensions = [];
  if (['fulfillment', 'fulfillment_clarification'].includes(category) && fulfillmentFromText(answer)) dimensions.push('fulfillment');
  return dimensions;
}
function applyServerDerivedUpdates(answers, category, answer, logger = null) {
  const updates = {};
  const fulfillment = ['fulfillment', 'fulfillment_clarification'].includes(category) ? fulfillmentFromText(answer) : '';
  if (fulfillment) updates.fulfillment_model = fulfillment;
  const merged = normalizeDiscoveryAnswers({ ...answers, ...updates });
  const resolved = deliveryDimensionsFromAnswer(category, answer);
  return { answers: merged, resolved_dimensions: resolved };
}
function selectNextQuestion({ proposed = {}, remaining = [], resolved = [], answers = {}, logger = null } = {}) {
  const fallbackCategory = remaining[0] || 'interests_avoidances';
  const proposedCategory = canonicalAdvisorCategory(proposed?.category);
  const canonicalProposed = { ...proposed, category: proposedCategory };
  const duplicate = proposedCategory ? isDuplicateQuestion(canonicalProposed, resolved, answers) : { duplicate: true, reason: 'missing_category', category: '' };
  const semanticMatch = proposedCategory ? questionMatchesCategory(canonicalProposed, proposedCategory) : false;
  const accepted = proposedCategory && remaining.includes(proposedCategory) && !duplicate.duplicate && semanticMatch;
  if (accepted) return { category: proposedCategory, use_proposed_copy: true, question: canonicalProposed };
  const reason = duplicate.duplicate
    ? duplicate.reason
    : proposedCategory && !remaining.includes(proposedCategory)
      ? 'not_unresolved'
      : proposedCategory && !semanticMatch
        ? 'semantic_mismatch'
        : 'missing_category';
  safeAdvisorLog(logger, 'advisor_question_rejected', {
    category: String(proposed?.category || ''),
    canonical_category: proposedCategory || '',
    reason,
  });
  const alternative = remaining.find((category) => !isDuplicateQuestion(FALLBACKS[category], resolved, answers).duplicate);
  return { category: alternative || fallbackCategory, use_proposed_copy: false, question: null };
}
function advisorNote(category, profileInput = {}) {
  const profile = normalizeDiscoveryProfile(profileInput);
  const profileText = [profile.capabilities_text, profile.interests].join(' ').toLowerCase();
  const candidate = profile.capabilities_text ? preselectPlaybookCandidates(profile).find((item) => {
    if (item.mapping_type === 'needs_review') return false;
    const words = item.subindustry_name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5 && !['services', 'service', 'support'].includes(word));
    const matches = words.filter((word) => profileText.includes(word));
    return matches.length >= 2 || (words[0] && profileText.includes(words[0]));
  }) : null;
  const lane = candidate ? candidate.subindustry_name : 'this lane';
  const service = profile.opportunity_type === 'product' ? 'product supply' : profile.opportunity_type === 'service' ? 'service work' : 'this field';
  const notes = {
    capability: 'Start with work you can actually perform, manage, or source. The Playbook rewards specific, deliverable capability over broad interest.',
    opportunity_type: `For ${lane}, choose the way you would really get paid: ${service}, products, or both.`,
    fulfillment: `For ${lane}, the safest answer is the delivery model you can prove today: your team, vendors, or a mix.`,
    experience: `For ${lane}, commercial or local work still counts if it proves you can deliver similar work.`,
    qualifications: `For ${lane}, only claim licenses, staff, equipment, or suppliers you already have. Unknown is safer than guessing.`,
    set_asides: 'Set-asides narrow the field only when they are real. Small Business is useful; specialized set-asides should be selected only if you hold them.',
    geography: `For ${lane}, pick the area you can support without stretching delivery. Local service work usually starts tighter than remote or vendor-led work.`,
    operating_model: `For ${lane}, recurring work favors steady crews/vendors; project work favors flexible delivery; product supply favors reliable sourcing.`,
    contract_scale: `For ${lane}, start with a size you could fulfill cleanly. The rubric favors manageable delivery over chasing the biggest number.`,
    interests_avoidances: `For ${lane}, include work you want more of and avoid work that would weaken delivery or pull you outside the Playbook fit.`,
  };
  return notes[category] || '';
}
function withAdvisorNote(question, profileInput) {
  if (!question) return question;
  const note = advisorNote(question.category, profileInput);
  if (!note || String(question.helper || '').includes(note)) return question;
  return { ...question, helper: [question.helper, `Advisor note: ${note}`].filter(Boolean).join(' ') };
}

export function cleanAdvisorMessages(messages = []) {
  const seen = new Set();
  return (Array.isArray(messages) ? messages : []).filter((message) => {
    if (message?.role !== 'advisor') return true;
    const content = String(message.content || '');
    const id = message.question?.id || (content.includes('strongest starting position') ? ADVISOR_OPENING_ID : '');
    if (!id && content.includes('keep this practical and narrow the next useful point')) return false;
    if (!id || !seen.has(id)) { if (id) seen.add(id); return true; }
    return false;
  });
}
export function recoverAdvisorState(raw = {}, answers = {}) {
  const resolved = normalizeResolved(answers, raw.resolved_dimensions || []);
  const remaining = unresolved(resolved);
  const complete = remaining.length === 0;
  const rawPending = raw.pending_question || null;
  const category = canonicalAdvisorCategory(rawPending?.category);
  let pending = null;
  let messages = cleanAdvisorMessages(raw.messages);
  if (!complete && rawPending?.adaptive_key) {
    pending = rawPending;
  } else if (!complete && category && category.endsWith('_clarification')) {
    pending = { ...rawPending, category };
  } else if (!complete && remaining.length === 1) {
    // Claude is allowed to own the final question too. Preserve a persisted Claude question
    // when its category and wording actually match the one remaining dimension. Only repair
    // old/bad sessions whose visible prompt drifted away from the stored category.
    const finalCategory = remaining[0];
    const rawCategory = canonicalAdvisorCategory(rawPending?.category);
    const rawIsUsable = rawPending
      && rawCategory === finalCategory
      && questionMatchesCategory(rawPending, finalCategory);
    if (rawIsUsable) {
      pending = {
        ...FALLBACKS[finalCategory],
        ...rawPending,
        id: rawPending.id || FALLBACKS[finalCategory]?.id,
        category: finalCategory,
        intent: QUESTION_INTENTS[finalCategory] || FALLBACKS[finalCategory]?.intent || '',
        source: rawPending.source || 'claude',
      };
    } else {
      pending = withAdvisorNote({ ...FALLBACKS[finalCategory], source: 'fallback' }, answers);
      const lastAdvisorIndex = [...messages].map((message, index) => ({ message, index })).reverse()
        .find(({ message }) => message?.role === 'advisor' && canonicalAdvisorCategory(message?.question?.category) === finalCategory)?.index;
      if (Number.isInteger(lastAdvisorIndex)) {
        messages = messages.map((message, index) => index === lastAdvisorIndex
          ? { ...message, content: COACHING[finalCategory] || 'Good. One last detail will keep this grounded.', question: pending }
          : message);
      }
    }
  } else if (!complete && category && ADVISOR_DIMENSIONS.includes(category) && !resolved.includes(category)) {
    const recoveredQuestion = { ...FALLBACKS[category], ...rawPending, id: rawPending.id || FALLBACKS[category]?.id, category, intent: rawPending.intent || QUESTION_INTENTS[category] || '' };
    pending = rawPending?.source === 'claude' || questionMatchesCategory(recoveredQuestion, category)
      ? { ...recoveredQuestion, source: rawPending?.source || 'claude' }
      : withAdvisorNote({ ...FALLBACKS[category], source: 'fallback' }, answers);
  } else if (!complete) {
    pending = withAdvisorNote(FALLBACKS[remaining[0]], answers);
  }
  return { messages, resolved_dimensions: resolved, turn_count: Math.max(0, Number(raw.turn_count) || 0), pending_question: pending, complete, last_answer_question_id: raw.last_answer_question_id || null };
}

export function answersFromAdvisorMessages(messages = []) {
  let answers = normalizeDiscoveryAnswers({});
  let resolved = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role !== 'student') continue;
    const questionMessage = [...messages.slice(0, index)].reverse().find((item) => item?.role === 'advisor' && item.question?.category);
    const category = canonicalAdvisorCategory(questionMessage?.question?.category);
    if (!category) continue;
    answers = fallbackUpdate(answers, category, message.content);
    resolved = normalizeResolved(answers, [...resolved, category]);
  }
  return { answers, resolved_dimensions: resolved };
}

export function fallbackAdvisorTurn({ answers = {}, resolved_dimensions = [], latest_answer = '', answered_category = '', turn_count = 0 } = {}) {
  const cleanAnswers = cleanPersistedAdvisorAnswers(answers);
  const fallbackMerged = fallbackUpdate(cleanAnswers, answered_category, latest_answer);
  const derived = applyServerDerivedUpdates(fallbackMerged, answered_category, latest_answer);
  const merged = derived.answers;
  const resolved = normalizeResolved(merged, [...resolved_dimensions, ...derived.resolved_dimensions, ...(answered_category && ADVISOR_DIMENSIONS.includes(answered_category) ? [answered_category] : [])]);
  const remaining = unresolved(resolved);
  const category = remaining[0] || 'interests_avoidances';
  const opening = !latest_answer && turn_count === 0 && resolved.length === 0;
  return { answers: merged, resolved_dimensions: resolved, assistant_message: turn_count >= ADVISOR_MAX_TURNS ? 'I have enough to build a responsible starting lane. I am matching it against the War Dogs playbook now.' : opening ? "Let's find the lane that gives you the strongest starting position." : COACHING[category] || 'Good. Let us narrow the next useful point.', next_question: withAdvisorNote(FALLBACKS[category], merged), complete: remaining.length === 0, fallback: true };
}

export async function advanceAdvisorConversation({ answers = {}, resolved_dimensions = [], latest_answer = '', answered_category = '', turn_count = 0, client, logger = console } = {}) {
  const cleanAnswers = cleanPersistedAdvisorAnswers(answers);
  const canonicalAnsweredCategory = canonicalAdvisorCategory(answered_category);
  const priorResolved = normalizeResolved(cleanAnswers, resolved_dimensions);
  const beforeRemaining = unresolved(priorResolved);

  if (beforeRemaining.length === 0) {
    return {
      ...fallbackAdvisorTurn({ answers: cleanAnswers, resolved_dimensions: ADVISOR_DIMENSIONS, latest_answer, answered_category: canonicalAnsweredCategory, turn_count }),
      complete: true,
      next_question: null,
    };
  }

  const incomingFulfillment = ['fulfillment', 'fulfillment_clarification'].includes(canonicalAnsweredCategory) ? fulfillmentFromText(latest_answer) : '';
  const previousFulfillment = canonicalFulfillment(cleanAnswers.fulfillment_model);
  if (incomingFulfillment && previousFulfillment && previousFulfillment !== 'unknown' && incomingFulfillment !== previousFulfillment && !explicitCorrection(latest_answer)) {
    return deliveryClarificationTurn(cleanAnswers, priorResolved, previousFulfillment, incomingFulfillment, logger);
  }

  if (canonicalAnsweredCategory === 'capability' && cleanAnswers.capabilities_text && text(cleanAnswers.capabilities_text, 900).toLowerCase() !== text(latest_answer, 900).toLowerCase() && !explicitCorrection(latest_answer)) {
    return {
      answers: cleanAnswers,
      resolved_dimensions: priorResolved,
      assistant_message: 'You mentioned two different starting lanes. Which one should I evaluate first?',
      next_question: {
        id: 'advisor-capability-clarification-v1',
        category: 'capability_clarification',
        prompt: 'Which is your main starting lane?',
        helper: '',
        placeholder: '',
        input_type: 'single_choice',
        options: [
          { value: 'existing', label: text(cleanAnswers.capabilities_text, 80) },
          { value: 'latest', label: text(latest_answer, 80) },
          { value: 'both', label: 'Compare both' },
        ],
      },
      complete: false,
      fallback: true,
      count_progress: false,
    };
  }

  if (canonicalAnsweredCategory === 'capability_clarification') {
    return fallbackAdvisorTurn({ answers: cleanAnswers, resolved_dimensions: priorResolved, latest_answer, answered_category: 'capability', turn_count });
  }

  if (canonicalAnsweredCategory === 'fulfillment_clarification') {
    const turn = fallbackAdvisorTurn({ answers: cleanAnswers, resolved_dimensions: priorResolved, latest_answer, answered_category: canonicalAnsweredCategory, turn_count });
    return { ...turn, count_progress: false };
  }

  try {
    // Claude receives only real stored facts, not normalized defaults such as an unanswered geography
    // being represented as nationwide. This keeps unknown/unasked fields distinct from resolved answers.
    const allowedBeforeExtraction = beforeRemaining.filter((dimension) => dimension !== canonicalAnsweredCategory);
    const response = await adviseDiscoveryTurn({
      profile: compactAdvisorProfile(cleanAnswers),
      unresolved_dimensions: allowedBeforeExtraction,
      answered_category: canonicalAnsweredCategory,
      latest_answer: text(latest_answer, 900),
      turn_count,
      max_turns: ADVISOR_MAX_TURNS,
    }, { client, logger });

    const baseline = fallbackUpdate(cleanAnswers, canonicalAnsweredCategory, latest_answer);
    const derived = applyServerDerivedUpdates(baseline, canonicalAnsweredCategory, latest_answer, logger);
    let merged = normalizeDiscoveryAnswers({ ...derived.answers, ...sanitizeUpdates(response.profile_updates) });

    if (incomingFulfillment && previousFulfillment && previousFulfillment !== 'unknown' && incomingFulfillment !== previousFulfillment && explicitCorrection(latest_answer)) {
      merged.fulfillment_model = incomingFulfillment;
      safeAdvisorLog(logger, 'advisor_contradiction_detected', { field: 'fulfillment_model', previous: previousFulfillment, incoming: incomingFulfillment, resolution: 'explicit_correction' });
    }
    if (canonicalAnsweredCategory === 'set_asides' && baseline.set_asides.length && !merged.set_asides.length) merged.set_asides = baseline.set_asides;
    if (canonicalAnsweredCategory === 'contract_scale' && (baseline.size_min || baseline.size_max) && !merged.size_min && !merged.size_max) {
      merged.size_min = baseline.size_min;
      merged.size_max = baseline.size_max;
    }

    // The question the student actually answered is always resolved, including a deliberate
    // "not sure" answer. Additional dimensions are resolved only when Claude explicitly marks
    // them AND the merged profile contains supporting evidence. A placeholder "unknown" alone
    // can never silently resolve an unasked dimension.
    const directResolved = ADVISOR_DIMENSIONS.includes(canonicalAnsweredCategory) ? [canonicalAnsweredCategory] : [];
    const serverResolvedSeed = [...priorResolved, ...derived.resolved_dimensions, ...directResolved];
    const serverResolved = normalizeResolved(merged, serverResolvedSeed);
    const trustedClaudeResolved = (Array.isArray(response.resolved_dimensions) ? response.resolved_dimensions : [])
      .map(canonicalAdvisorCategory)
      .filter((dimension) => ADVISOR_DIMENSIONS.includes(dimension))
      .filter((dimension) => serverResolved.includes(dimension) || dimensionHasEvidence(dimension, merged));
    const nextResolved = [...new Set([...serverResolved, ...trustedClaudeResolved])];

    if (trustedClaudeResolved.length) {
      safeAdvisorLog(logger, 'advisor_cross_dimension_resolution', { resolved: trustedClaudeResolved.filter((dimension) => !directResolved.includes(dimension)) });
    }

    const afterRemaining = unresolved(nextResolved);
    const complete = afterRemaining.length === 0;

    if (response.complete === true && !complete) {
      safeAdvisorLog(logger, 'advisor_completion_deferred', {
        remaining_dimensions: afterRemaining,
        reason: 'server_still_requires_dimension',
      });
    }

    if (complete) {
      return {
        answers: merged,
        resolved_dimensions: nextResolved,
        assistant_message: text(response.assistant_message, 420) || 'I have enough to build your starting lanes. I am matching your answers against the War Dogs Playbook now.',
        next_question: null,
        complete: true,
        fallback: false,
      };
    }

    const selection = selectNextQuestion({ proposed: response.next_question, remaining: afterRemaining, resolved: nextResolved, answers: merged, logger });
    const nextCategory = selection.category;
    const fallbackQuestion = FALLBACKS[nextCategory];
    if (!fallbackQuestion) throw new Error(`No fallback question configured for ${nextCategory}`);

    if (selection.use_proposed_copy) {
      const proposed = selection.question || response.next_question || {};
      const proposedOptions = safeOptions(proposed.options);
      const nextQuestion = {
        ...fallbackQuestion,
        ...proposed,
        id: fallbackQuestion.id,
        category: nextCategory,
        intent: QUESTION_INTENTS[nextCategory] || fallbackQuestion.intent || '',
        prompt: text(proposed.prompt, 360) || fallbackQuestion.prompt,
        helper: text(proposed.helper, 220) || fallbackQuestion.helper,
        placeholder: text(proposed.placeholder, 120) || fallbackQuestion.placeholder,
        options: proposedOptions.length ? proposedOptions : fallbackQuestion.options,
        source: 'claude',
      };
      return {
        answers: merged,
        resolved_dimensions: nextResolved,
        assistant_message: text(response.assistant_message, 420) || COACHING[nextCategory] || 'Good. Now we narrow the next useful point.',
        next_question: nextQuestion,
        complete: false,
        fallback: false,
      };
    }

    // Claude is dynamically constrained to allowed categories, so reaching this branch should be rare.
    // Do not make a second provider call. A deterministic fallback is faster and prevents a 6s turn
    // from becoming a 12s turn when Claude proposes a newly-resolved semantic duplicate.
    return {
      answers: merged,
      resolved_dimensions: nextResolved,
      assistant_message: COACHING[nextCategory] || 'Good. Now we narrow the next useful point.',
      next_question: withAdvisorNote({ ...fallbackQuestion, source: 'fallback' }, merged),
      complete: false,
      fallback: true,
    };
  } catch (error) {
    logger?.error?.({ event: 'playbook_discovery_debug', stage: 'advisor_turn_failed', error_name: error?.name || 'Error', error_message: text(error?.message, 180) });
    return fallbackAdvisorTurn({ answers: cleanAnswers, resolved_dimensions: priorResolved, latest_answer, answered_category: canonicalAnsweredCategory, turn_count });
  }
}
