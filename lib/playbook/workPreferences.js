const repair = /\b(?:mechanical|automotive|equipment|vehicle)\s+(?:repair|maintenance)|\bhands[-\s]?on\s+(?:maintenance|repair)|\brepair[-\s]service\b/i;

function studentText(profile) {
  return (profile.advisor_state?.messages || []).filter((message) => message?.role === 'student').map((message) => message.content || '').join('. ');
}

export function declinesAdaptiveWork(key, value = '') {
  const text = String(value).replaceAll('\u2019', "'");
  if (/^neither$/i.test(text.trim()) || /\bneither\b|\bnone of (?:these|those|the options)\b/i.test(text)) return true;
  return key === 'maintenance_vs_management_consulting'
    && /\b(?:do not|don't|no longer|not interested|no more|avoid)\b/i.test(text)
    && /maintenance|repair/i.test(text) && !/\b(?:want|prefer|provide)\b[^.]*\bconsulting\b/i.test(text);
}

export function avoidsMechanicalRepair(profile = {}) {
  if (repair.test(profile.avoid || '')) return true;
  return studentText(profile).split(/[.!?;]/).some((sentence) => repair.test(sentence)
    && /\b(?:do not want|don't want|not interested|leave .* behind|move away|no more|no longer|avoid)\b/i.test(sentence));
}

export function hasDeclinedWork(profile = {}) {
  return Object.entries(profile.adaptive_answers || {}).some(([key, value]) => declinesAdaptiveWork(key, value));
}

export function workDirectionQuestion(profile = {}) {
  const answers = profile.adaptive_answers || {};
  const source = [profile.capabilities_text, profile.interests, studentText(profile)].join(' ');
  const rentals = /\brent(?:al|als|ing)?\b/i.test(source);
  const products = /\b(product|products|supply|selling|sell|sourcing)\b/i.test(source);
  const direction = preferenceChoice('work_direction', answers.work_direction);
  if ((hasDeclinedWork(profile) || (avoidsMechanicalRepair(profile) && (rentals || products))) && !direction) {
    return { key: 'work_direction', prompt: 'Which work would you like to explore instead?',
      helper: avoidsMechanicalRepair(profile) ? 'Your preference to move away from hands-on mechanical repair is saved. We will not substitute maintenance or consulting for rentals.' : 'You do not have to choose a type of work that does not fit. Your earlier answers stay saved.',
      options: [...(rentals ? [{ value: 'rentals', label: 'Equipment / vehicle rentals' }] : []), ...(products ? [{ value: 'product_supply', label: 'Product supply' }] : []),
        ...(rentals && products ? [{ value: 'rentals_and_products', label: 'Compare rentals and product supply' }] : []), { value: 'another_area', label: 'Explore another area' }],
    };
  }
  if (['rentals', 'rentals_and_products'].includes(direction) && !preferenceChoice('rental_scope', answers.rental_scope)) {
    return { key: 'rental_scope', prompt: 'What vehicles or equipment could you rent or source today?',
      helper: 'The current Playbook supports truck/trailer rentals, but not every passenger-car or equipment rental category. We will not guess a different industry code.',
      options: [{ value: 'trucks_trailers', label: 'Trucks / utility trailers' }, { value: 'passenger_cars', label: 'Passenger cars' }, { value: 'other_equipment', label: 'Forklifts / other equipment' }, { value: 'unknown', label: 'Not sure yet' }],
    };
  }
  if (direction === 'another_area' && !answers.preferred_work) {
    return { key: 'preferred_work', prompt: 'What work would you like to explore, and what could you actually provide, manage, or source?', helper: 'Describe it in your own words. We will check whether the current Playbook supports it.', options: [] };
  }
  return null;
}

export function preferenceChoice(key, value, profile = {}) {
  const text = String(value || '').trim().toLowerCase();
  const choices = key === 'work_direction'
    ? { rentals: 'Equipment / vehicle rentals', product_supply: 'Product supply', rentals_and_products: 'Compare rentals and product supply', another_area: 'Explore another area' }
    : { trucks_trailers: 'Trucks / utility trailers', passenger_cars: 'Passenger cars', other_equipment: 'Forklifts / other equipment', unknown: 'Not sure yet' };
  for (const [code, label] of Object.entries(choices)) if (text === code || text === label.toLowerCase()) return code;
  if (key === 'rental_scope' && /\bnot sure\b|\bunknown\b/.test(text)) return 'unknown';
  if (/\b(?:not|neither|don't|do not|avoid|rather than)\b/.test(text)) return '';
  if (key === 'work_direction') {
    const rental = /\brent(?:al|als|ing)?\b/.test(text), products = /\b(?:products?|supply|sourcing)\b/.test(text);
    if (rental && products && /\b(?:compare|both)\b/.test(text)) return 'rentals_and_products';
    if (rental !== products) return rental ? 'rentals' : 'product_supply';
    if (/\b(?:another|different|other) area\b/.test(text)) return 'another_area';
  } else {
    const matches = [[/\b(?:trucks?|trailers?)\b/, 'trucks_trailers'], [/\b(?:passenger|cars?)\b/, 'passenger_cars'], [/\b(?:forklifts?|other equipment)\b/, 'other_equipment']].filter(([pattern]) => pattern.test(text));
    if (matches.length === 1) return matches[0][1];
  }
  return '';
}

export function rejectedCandidate(candidate, profile = {}) {
  if ((candidate.required_context || []).some((key) => declinesAdaptiveWork(key, profile.adaptive_answers?.[key]))) return true;
  if (avoidsMechanicalRepair(profile) && /Vehicle Fleet Management/i.test(candidate.subindustry_name)) return true;
  const avoid = profile.avoid || '';
  const rules = [
    [/\b(?:hands[-\s]?on|all)\s+(?:maintenance|repair)\b/i, /maintenance|repair|Vehicle Fleet Management/i],
    [/\b(?:janitorial|cleaning)\b/i, /Janitorial|Cleaning/i],
    [/\b(?:landscaping|grounds maintenance)\b/i, /Landscaping|Grounds Maintenance/i],
    [/\bmedical clinics?\b/i, /Medical Clinics/i],
  ];
  return rules.some(([preference, names]) => preference.test(avoid) && names.test(candidate.subindustry_name));
}

export function candidateMatchesDirection(candidate, profile = {}) {
  const direction = profile.adaptive_answers?.work_direction;
  const product = candidate.industry_name === 'Product Supply & Procurement';
  const rental = profile.adaptive_answers?.rental_scope === 'trucks_trailers' && candidate.subindustry_name === 'Utility Vehicles & Trailers';
  return direction === 'product_supply' ? product : direction === 'rentals' ? rental : direction === 'rentals_and_products' ? product || rental : true;
}

export function unsupportedWorkMessage(profile = {}) {
  if (profile.adaptive_answers?.work_direction === 'another_area'
      && /^(?:(?:i|we)(?: am| are|'m|'re)?\s+)?(?:not sure(?: yet)?|unsure|no idea|don't know|do not know|explore another area)[.!?\s]*$/i.test(String(profile.adaptive_answers?.preferred_work || '').trim())) {
    return 'Your earlier answers are saved. We need a description of the new work you could provide, manage, or source before recommending another area. Edit that answer or contact support; we will not fill the shortlist with unrelated work.';
  }
  if (profile.adaptive_answers?.work_direction !== 'rentals' || profile.adaptive_answers?.rental_scope === 'trucks_trailers') return '';
  return 'Your rental preference is saved. The current Playbook does not have a verified mapping for that rental category. We will not replace it with fleet maintenance or consulting. Edit your answers to explore another area, use manual targeting with verified codes, or contact support.';
}
