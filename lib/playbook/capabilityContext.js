// Keep distinct backgrounds visible without treating experience as permission
// to perform regulated work, or inventing a lane outside the Playbook.
const LANES = [
  { value: 'healthcare', label: 'Nursing / healthcare', pattern: /\b(nurs(?:e|es|ing)|rn|registered nurse|telemedicine|medical field|clinical care|pediatric icu)\b/i },
  { value: 'facilities', label: 'Handyman / facilities work', pattern: /\b(handy\s?man|maintenance|janitorial|cleaning|facilit(?:y|ies) support)\b/i },
  { value: 'agriculture', label: 'Agriculture', pattern: /\b(agricultur\w*|farm(?:ing|er|ers)?|livestock|crops?)\b/i },
  { value: 'technology', label: 'IT / technology', pattern: /\b(it support|software development|cybersecurity|network services)\b/i },
  { value: 'construction', label: 'Construction', pattern: /\b(construction|renovation|remodeling)\b/i },
  { value: 'logistics', label: 'Transport / logistics', pattern: /\b(trucking|freight|logistics|moving services)\b/i },
];

export const CAPABILITY_CONTEXT_KEYS = ['capability_priority', 'agriculture_work'];
export const AGRICULTURE_COVERAGE_NOTE = 'The current Playbook has no dedicated agriculture lane. We can assess related services only when your actual work supports them.';

export function agricultureRelatedCandidateNames(details = '') {
  const matches = [];
  const source = String(details);
  if (/\b(no|not|never|without|don't|do not|can't|cannot|unsure|want to|hope to|learning)\b/i.test(source)) return [];
  if (/\b(landscaping|grounds maintenance|mowing)\b/i.test(source)) matches.push('Landscaping & Grounds Maintenance');
  if (/\bpest control\b/i.test(source)) matches.push('Pest Control');
  if (/\b(janitorial|cleaning buildings)\b/i.test(source)) matches.push('Janitorial & Cleaning Services');
  return matches;
}

export function statedCapabilityLanes(profile = {}) {
  const source = [profile.capabilities_text, profile.experience_notes, profile.qualification_notes].filter(Boolean).join(' ');
  return LANES.filter((lane) => lane.pattern.test(source));
}

export function capabilityContextQuestion(profile = {}, adaptiveAnswers = profile.adaptive_answers || {}) {
  const lanes = statedCapabilityLanes(profile);
  const priority = normalizeCapabilityPriority(adaptiveAnswers.capability_priority, profile);
  if (lanes.length > 1 && !priority) {
    return {
      key: 'capability_priority',
      prompt: 'You have experience in several areas. Which should we evaluate first?',
      helper: lanes.some((lane) => lane.value === 'agriculture') ? AGRICULTURE_COVERAGE_NOTE : 'Your other experience will stay saved. You can also compare these areas.',
      options: [...lanes.map(({ value, label }) => ({ value, label })), { value: 'compare_all', label: 'Compare all these areas' }],
    };
  }
  if (lanes.some((lane) => lane.value === 'agriculture')
      && (!priority || priority === 'agriculture' || priority === 'compare_all')
      && !adaptiveAnswers.agriculture_work) {
    return {
      key: 'agriculture_work',
      prompt: 'What agricultural work have you actually done, and what could you deliver now?',
      helper: AGRICULTURE_COVERAGE_NOTE,
      options: [],
    };
  }
  return null;
}

export function experienceNotesFromMessages(messages = []) {
  let category = '';
  let notes = '';
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role === 'advisor') category = message.question?.category || '';
    if (message?.role === 'student' && (message.question_category || category) === 'experience') notes = String(message.content || '').slice(0, 1800);
  }
  return notes;
}

export function normalizeCapabilityPriority(value, profile = {}) {
  const clean = String(value || '').trim().toLowerCase();
  if (/^(compare_all|compare all(?: these areas)?|all|both)$/.test(clean)) return 'compare_all';
  const matches = statedCapabilityLanes(profile).filter((lane) => clean === lane.value || clean === lane.label.toLowerCase());
  if (matches.length === 1) return matches[0].value;
  if (/\b(not|don't|unsure|maybe)\b/.test(clean)) return '';
  const mentioned = statedCapabilityLanes(profile).filter((lane) => lane.pattern.test(clean));
  return mentioned.length === 1 ? mentioned[0].value : '';
}

export function capabilityContextAdvisorQuestion(context, attempts = 0) {
  return {
    id: `advisor-${context.key.replaceAll('_', '-')}-clarification-v1-${attempts}`,
    category: `${context.key}_clarification`,
    source: 'fallback',
    prompt: context.prompt,
    helper: context.helper,
    placeholder: 'Tell the Niche Advisor your answer...',
    input_type: context.options.length ? 'single_choice' : 'text',
    options: context.options,
  };
}

export function capabilityPriorityIndustry(profile = {}) {
  return {
    healthcare: 'Healthcare & Medical Services',
    facilities: 'Operations & Facilities Support',
    technology: 'Information Technology & Cybersecurity',
    construction: 'Construction, Engineering & Specialized Services',
    logistics: 'Logistics, Transportation & Supply Chain',
  }[profile.adaptive_answers?.capability_priority] || '';
}
