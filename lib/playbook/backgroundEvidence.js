// These are explicit biographical statements, not eligibility checks. In
// particular an RN license does not establish a staffing company, federal past
// performance, an active state registration, or permission for every service.
export function explicitBackgroundUpdates(answers = {}) {
  const source = [answers.capabilities_text, answers.experience_notes, answers.qualification_notes].filter(Boolean).join('. ');
  const affirmative = (source.match(/[^.!?;]+[.!?;]?/g) || [])
    .filter((sentence) => !sentence.endsWith('?')
      && !/\b(not|never|no|don't|haven't|without|neither|expired|inactive|revoked|unsure|maybe|might|need to|want to)\b/i.test(sentence)).join(' ');
  const updates = {};
  const experience = (answers.experience_types || []).filter((value) => !['brand_new', 'new_to_area'].includes(value));
  if (/\b(owned and operated|own(?:ed)? (?:a |my |our )?(?:business|company|handyman service)|run (?:a |my |our )?(?:business|company)|private (?:work|clients)|(?:have|has|with) commercial (?:work|clients|experience))\b/i.test(affirmative)) {
    updates.experience_types = [...new Set([...experience, 'private_commercial', 'industry_experience'])];
  } else if (/\b(?:worked|working|experience) in (?:pediatric|nursing|emergency medicine|telemedicine|the medical field)\b/i.test(affirmative)) {
    updates.experience_types = [...new Set([...experience, 'industry_experience'])];
  }
  if (/\b(?:holds?|have|has) (?:an? )?(?:active )?(?:rn|registered nurse|nursing) licen[cs]e\b/i.test(affirmative)) {
    updates.qualification_categories = [...new Set([...(answers.qualification_categories || []).filter((value) => value !== 'none_unknown'), 'licenses', 'healthcare_medical'])];
  }
  return updates;
}
