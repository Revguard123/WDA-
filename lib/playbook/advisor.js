import { normalizeDiscoveryAnswers, normalizeDiscoveryProfile, loadPlaybook } from './index.js';
import { preselectPlaybookCandidates } from './recommendationEngine.js';
import { adviseDiscoveryTurn } from '../ai/claude.js';

export const ADVISOR_DIMENSIONS = ['capability', 'opportunity_type', 'fulfillment', 'experience', 'qualifications', 'set_asides', 'geography', 'operating_model', 'contract_scale', 'interests_avoidances'];
export const ADVISOR_MAX_TURNS = ADVISOR_DIMENSIONS.length;
export const ADVISOR_OPENING_ID = 'advisor-capability-opening-v1';

function question(category, prompt, helper, placeholder, input_type, options = []) {
  return { id: category === 'capability' ? ADVISOR_OPENING_ID : `advisor-${category}-v1`, category, prompt, helper, placeholder, input_type, options: options.map(([value, label]) => ({ value, label })) };
}

const FALLBACKS = {
  capability: question('capability', 'What work can you provide, manage, or source today?', 'Use plain words. A short answer is fine.', 'Tell the Niche Advisor your answer...', 'text', [['it_support', 'IT support'], ['cleaning', 'Cleaning / Facilities'], ['construction', 'Construction'], ['staffing', 'Staffing / Labor'], ['product_sourcing', 'Product sourcing'], ['not_sure', 'Not sure yet']]),
  opportunity_type: question('opportunity_type', 'Would you sell products, provide services, or do both?', 'Choose what matches how you would get paid.', '', 'single_choice', [['product', 'Products'], ['service', 'Services'], ['either', 'Either'], ['unknown', 'Not sure']]),
  fulfillment: question('fulfillment', 'Who would do the work if you won?', 'Choose your own team, subcontractors, or a mix.', '', 'single_choice', [['self', 'My own team'], ['existing_vendors', 'Subcontractors'], ['hybrid', 'Combination'], ['unknown', 'Not sure yet']]),
  experience: question('experience', 'What experience can we use?', 'Commercial, state, local, and industry work can still matter.', '', 'single_choice', [['federal_contracts', 'Federal'], ['state_local_contracts', 'State / local'], ['private_commercial', 'Commercial'], ['industry_experience', 'Industry experience'], ['brand_new', 'Brand new']]),
  qualifications: question('qualifications', 'What do you already have that helps you deliver?', 'Only choose things you have today.', '', 'single_choice', [['licenses', 'Licenses'], ['bonding', 'Bonding'], ['qualified_staff', 'Qualified staff'], ['specialized_equipment', 'Equipment'], ['regulated_product_suppliers', 'Suppliers'], ['none_unknown', 'None / not sure']]),
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
  return [value.capabilities_text && 'capability', value.opportunity_type && 'opportunity_type', value.fulfillment_model && 'fulfillment', value.experience_types.length && 'experience', value.qualification_categories.length && 'qualifications', value.set_asides.length && 'set_asides', value.geography_mode && 'geography', value.operating_model && 'operating_model', (value.size_min !== '' || value.size_max !== '') && 'contract_scale', (value.interests || value.avoid) && 'interests_avoidances'].filter(Boolean);
}
function normalizeResolved(answers, resolved = []) { return [...new Set([...resolved, ...inferred(answers)].filter((value) => ADVISOR_DIMENSIONS.includes(value)))]; }
function mapped(value, map) { return map[value] || map[value.toLowerCase()] || null; }
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
  const listValue = lists[category] ? mapped(value, lists[category]) : null;
  const parsedSetAsides = category === 'set_asides' ? setAsidesFromText(value) : [];
  const interestAvoidance = parseInterestAvoidance(value);
  const updates = category === 'capability' ? { capabilities_text: value }
    : category === 'interests_avoidances' ? interestAvoidance
    : category === 'geography' ? (geography || { geography_mode: 'unknown', state: '' })
    : category === 'contract_scale' ? (contractSizes[value] || contractSizes[value.toLowerCase()] || contractSizeFromText(value) || { size_min: '', size_max: '' })
    : single[category] ? { [category === 'fulfillment' ? 'fulfillment_model' : category]: mapped(value, single[category]) || 'unknown' }
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
function courseContext(profile) {
  const playbook = loadPlaybook();
  const candidates = preselectPlaybookCandidates(profile).slice(0, 5).map((candidate) => ({ industry: candidate.industry_name, subindustry: candidate.subindustry_name, description: candidate.description.slice(0, 180), broker_guidance: candidate.broker_guidance.slice(0, 180), competition: candidate.competition, award_method: candidate.award_method }));
  return { global_guidance: playbook.global_guidance, relevant_candidates: candidates };
}
function sanitizeUpdates(updates = {}) {
  const allowed = ['capabilities_text', 'fulfillment_model', 'opportunity_type', 'experience_types', 'qualification_categories', 'qualification_notes', 'geography_mode', 'state', 'operating_model', 'size_min', 'size_max', 'set_asides', 'interests', 'avoid'];
  return Object.fromEntries(allowed.filter((key) => {
    if (!Object.hasOwn(updates, key)) return false;
    const value = updates[key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== '';
  }).map((key) => [key, updates[key]]));
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
  const complete = resolved.length === ADVISOR_DIMENSIONS.length;
  const category = raw.pending_question?.category;
  const pending = raw.pending_question?.adaptive_key ? raw.pending_question : !complete && category && !resolved.includes(category) ? withAdvisorNote({ ...FALLBACKS[category], ...raw.pending_question, id: raw.pending_question.id || FALLBACKS[category]?.id }, answers) : complete ? null : withAdvisorNote(FALLBACKS[unresolved(resolved)[0]], answers);
  return { messages: cleanAdvisorMessages(raw.messages), resolved_dimensions: resolved, turn_count: Math.max(0, Number(raw.turn_count) || 0), pending_question: pending, complete, last_answer_question_id: raw.last_answer_question_id || null };
}

export function answersFromAdvisorMessages(messages = []) {
  let answers = normalizeDiscoveryAnswers({});
  let resolved = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role !== 'student') continue;
    const questionMessage = [...messages.slice(0, index)].reverse().find((item) => item?.role === 'advisor' && item.question?.category);
    const category = questionMessage?.question?.category;
    if (!category) continue;
    answers = fallbackUpdate(answers, category, message.content);
    resolved = normalizeResolved(answers, [...resolved, category]);
  }
  return { answers, resolved_dimensions: resolved };
}

export function fallbackAdvisorTurn({ answers = {}, resolved_dimensions = [], latest_answer = '', answered_category = '', turn_count = 0 } = {}) {
  const merged = fallbackUpdate(answers, answered_category, latest_answer);
  const resolved = normalizeResolved(merged, [...resolved_dimensions, ...(answered_category ? [answered_category] : [])]);
  const remaining = unresolved(resolved);
  const category = remaining[0] || 'interests_avoidances';
  const opening = !latest_answer && turn_count === 0 && resolved.length === 0;
  return { answers: merged, resolved_dimensions: resolved, assistant_message: turn_count >= ADVISOR_MAX_TURNS ? 'I have enough to build a responsible starting lane. I am matching it against the War Dogs playbook now.' : opening ? "Let's find the lane that gives you the strongest starting position." : COACHING[category] || 'Good. Let us narrow the next useful point.', next_question: withAdvisorNote(FALLBACKS[category], merged), complete: remaining.length === 0 || turn_count >= ADVISOR_MAX_TURNS, fallback: true };
}

export async function advanceAdvisorConversation({ answers = {}, resolved_dimensions = [], latest_answer = '', answered_category = '', turn_count = 0, client, logger = console } = {}) {
  const priorResolved = normalizeResolved(answers, resolved_dimensions);
  const remaining = unresolved(priorResolved);
  if (turn_count >= ADVISOR_MAX_TURNS || remaining.length === 0) return fallbackAdvisorTurn({ answers, resolved_dimensions: ADVISOR_DIMENSIONS, latest_answer, answered_category, turn_count: ADVISOR_MAX_TURNS });
  if (answered_category === 'capability' && answers.capabilities_text && text(answers.capabilities_text, 900).toLowerCase() !== text(latest_answer, 900).toLowerCase() && !/\b(actually|instead|rather|change)\b/i.test(latest_answer)) {
    return { answers: normalizeDiscoveryAnswers(answers), resolved_dimensions: priorResolved, assistant_message: 'You mentioned two different starting lanes. Which one should I evaluate first?', next_question: { id: 'advisor-capability-clarification-v1', category: 'capability_clarification', prompt: 'Which is your main starting lane?', helper: '', placeholder: '', input_type: 'single_choice', options: [{ value: 'existing', label: text(answers.capabilities_text, 80) }, { value: 'latest', label: text(latest_answer, 80) }, { value: 'both', label: 'Compare both' }] }, complete: false, fallback: true, count_progress: false };
  }
  if (answered_category === 'capability_clarification') return fallbackAdvisorTurn({ answers, resolved_dimensions: priorResolved, latest_answer, answered_category: 'capability', turn_count });
  try {
    const profile = normalizeDiscoveryProfile(answers);
    const response = await adviseDiscoveryTurn({ profile, unresolved_dimensions: remaining, answered_category, latest_answer: text(latest_answer, 900), turn_count, max_turns: ADVISOR_MAX_TURNS, course_context: courseContext(profile) }, { client, logger });
    const baseline = fallbackUpdate(answers, answered_category, latest_answer);
    const merged = normalizeDiscoveryAnswers({ ...baseline, ...sanitizeUpdates(response.profile_updates) });
    if (answered_category === 'set_asides' && baseline.set_asides.length && !merged.set_asides.length) {
      merged.set_asides = baseline.set_asides;
    }
    if (answered_category === 'contract_scale' && (baseline.size_min || baseline.size_max) && !merged.size_min && !merged.size_max) {
      merged.size_min = baseline.size_min;
      merged.size_max = baseline.size_max;
    }
    const nextResolved = normalizeResolved(merged, [...priorResolved, ...(response.resolved_dimensions || []), ...(answered_category ? [answered_category] : [])]);
    const afterRemaining = unresolved(nextResolved);
    const nextCategory = afterRemaining.includes(response.next_question?.category) ? response.next_question.category : afterRemaining[0] || 'interests_avoidances';
    const complete = (response.complete === true && afterRemaining.length === 0) || turn_count + 1 >= ADVISOR_MAX_TURNS;
    const nextQuestion = { ...FALLBACKS[nextCategory], ...response.next_question, id: FALLBACKS[nextCategory].id, category: nextCategory, prompt: text(response.next_question?.prompt, 360) || FALLBACKS[nextCategory].prompt, helper: text(response.next_question?.helper, 220) || FALLBACKS[nextCategory].helper, placeholder: text(response.next_question?.placeholder, 120) || FALLBACKS[nextCategory].placeholder, options: safeOptions(response.next_question?.options).length ? safeOptions(response.next_question.options) : FALLBACKS[nextCategory].options };
    return { answers: merged, resolved_dimensions: complete ? ADVISOR_DIMENSIONS : nextResolved, assistant_message: text(response.assistant_message, 420) || COACHING[nextCategory] || 'Good. Now we narrow the next useful point.', next_question: withAdvisorNote(nextQuestion, merged), complete, fallback: false };
  } catch (error) {
    logger?.error?.({ event: 'playbook_discovery_debug', stage: 'advisor_turn_failed', error_name: error?.name || 'Error', error_message: text(error?.message, 180) });
    return fallbackAdvisorTurn({ answers, resolved_dimensions: priorResolved, latest_answer, answered_category, turn_count });
  }
}
