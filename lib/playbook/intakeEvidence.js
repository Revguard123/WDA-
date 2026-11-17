// Pure evidence helpers shared by resume, conversation and recommendations.
// Never treat an advisor summary as a fact supplied by the student.
export function lastStudentAnswer(messages = [], category) {
  let pendingCategory = '';
  let answer = '';
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role === 'advisor') pendingCategory = message.question?.category || '';
    if (message?.role === 'student' && (message.question_category || pendingCategory) === category) answer = String(message.content || '').trim();
  }
  return answer;
}

const SET_ASIDES = [
  ['sb', /\bsmall business\b|\bsb\b/i],
  ['sdvosb', /\bsdvosb\b|\bservice[-\s]?disabled veteran(?:[-\s]owned)?\b/i],
  ['vosb', /\bvosb\b|\bveteran[-\s]owned\b/i],
  ['edwosb', /\bedwosb\b|\beconomically disadvantaged women[-\s]owned\b/i],
  ['wosb', /\b(?:wosb|wsob)\b|\bwomen[-\s]owned\b/i],
  ['8a', /\b8\s*\(?a\b\)?/i],
  ['hubzone', /\bhubzone\b/i],
];

export function currentSetAsidesFromText(value = '') {
  const current = new Set();
  for (const sentence of String(value).replaceAll('\u2019', "'").split(/[.;\n]/)) {
    let conditional = false;
    for (const clause of sentence.split(/,|\b(?:but|however|and|except)\b/i)) {
      if (/\b(?:currently|already|today|right now|only)\b/i.test(clause)) conditional = false;
      if (/\b(if|could|would|will|might|may|plan|planning|intend|hope|pending|apply|applying|applied|future|want)\b/i.test(clause)) conditional = true;
      // Qualification/eligibility by itself is not a held specialized status.
      if (conditional || /\b(not|never|don't|haven't|didn't|can't|cannot|without|no|none|expired|revoked|inactive|lapsed|formerly|previously)\b/i.test(clause)) continue;
      for (const [code, pattern] of SET_ASIDES) {
        if (!pattern.test(clause)) continue;
        if (code !== 'sb' && /\b(?:qualify|eligible)\b/i.test(clause) && !/\b(?:hold|have|certified|approved)\b/i.test(clause)) continue;
        if (['vosb', 'sdvosb', 'wosb', 'edwosb'].includes(code) && !new RegExp(`\\b${code === 'wosb' ? '(?:wosb|wsob)' : code}\\b`, 'i').test(clause)
            && !/\b(?:certified|certification|approved|hold|status)\b/i.test(clause)) continue;
        if (code === 'vosb' && /service[-\s]?disabled/i.test(clause)) continue;
        if (code === 'wosb' && /economically disadvantaged/i.test(clause)) continue;
        current.add(code);
      }
    }
  }
  return SET_ASIDES.map(([code]) => code).filter((code) => current.has(code));
}

function amount(value, unit = '') {
  const number = Number(String(value).replace(/[$,\s]/g, ''));
  const scale = /^(?:m|million)$/i.test(unit) ? 1_000_000 : /^(?:k|thousand)$/i.test(unit) ? 1000 : 1;
  return Number.isFinite(number) ? Math.round(number * scale) : null;
}

export function contractAmountFromText(value = '') {
  const source = String(value).replaceAll('\u2013', '-').replaceAll('\u2014', '-');
  const period = /\b(?:per|a|each)\s+month\b|\bmonthly\b|\/\s*(?:mo|month)\b/i.test(source) ? 'monthly'
    : /\b(?:per|a|each)\s+year\b|\bannual(?:ly)?\b|\/\s*(?:yr|year)\b/i.test(source) ? 'annual' : 'total';
  const range = source.match(/(\$?\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?\s*(?:-|to|through)\s*(\$?\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?\b/i);
  if (range) {
    const leftUnit = range[2] || (amount(range[1]) < 1000 ? range[4] : '');
    const rightUnit = range[4] || (amount(range[3]) < 1000 ? range[2] : '');
    const left = amount(range[1], leftUnit), right = amount(range[3], rightUnit);
    if (left > 0 && right > 0) return { min: Math.min(left, right), max: Math.max(left, right), period };
  }
  // Single amounts need currency, a scale, or an explicit billing period, not
  // unrelated counts such as "two employees" or "7 months".
  const single = source.match(/(\$\s*\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?\b|\b(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)\b/i);
  if (!single) return null;
  const number = amount(single[1] || single[3], single[2] || single[4]);
  if (!(number > 0)) return null;
  const upper = /\b(under|up to|below|less than|maximum|max)\b/i.test(source);
  const lower = /\b(over|above|at least|minimum|min)\b|\+/.test(source);
  return { min: upper ? null : number, max: lower ? null : number, period };
}

export function contractBudgetEvidence(answers = {}) {
  const notes = String(answers.contract_size_notes || lastStudentAnswer(answers.advisor_state?.messages, 'contract_scale')).trim().slice(0, 900);
  return { notes, range: contractAmountFromText(notes) };
}

export function monthlyBudgetChoice(value = '') {
  const text = String(value).trim().toLowerCase();
  if (['annual_total', 'enter_total', 'leave_open'].includes(text)) return text;
  if (/\b(?:not sure|unsure)\b|\bleave\b.*\b(?:open|blank)\b/.test(text)) return 'leave_open';
  if (/\b(?:not|don't|do not|maybe|could|would|unsure)\b/.test(text)) return '';
  if (/\b(?:use|confirm)\b.*\b12[-\s]?month\b/.test(text)) return 'annual_total';
  if (/\b(?:different|another|enter)\b.*\btotal\b/.test(text)) return 'enter_total';
  return '';
}

export function contractBudgetUpdates(answers = {}) {
  const { notes, range } = contractBudgetEvidence(answers);
  if (!notes) return {};
  const updates = { contract_size_notes: notes };
  if (!range || range.period !== 'monthly') return { ...updates, contract_size_basis: range?.period || 'unspecified' };
  const choice = monthlyBudgetChoice(answers.adaptive_answers?.contract_budget_confirmation);
  const enteredOpen = choice === 'enter_total' && monthlyBudgetChoice(answers.adaptive_answers?.contract_budget_total) === 'leave_open';
  const total = choice === 'annual_total' ? { min: range.min == null ? null : range.min * 12, max: range.max == null ? null : range.max * 12 }
    : choice === 'enter_total' && !enteredOpen ? contractAmountFromText(answers.adaptive_answers?.contract_budget_total) : null;
  const confirmed = total && total.period !== 'monthly';
  const leftOpen = choice === 'leave_open' || enteredOpen;
  return { ...updates, size_min: confirmed && total.min != null ? String(total.min) : '', size_max: confirmed && total.max != null ? String(total.max) : '',
    contract_size_basis: confirmed ? 'total' : leftOpen ? 'unspecified' : 'monthly_unconfirmed' };
}

const dollars = (number) => `$${Number(number).toLocaleString('en-US')}`;
function rangeLabel(range, multiplier = 1) {
  return range.min == null ? `up to ${dollars(range.max * multiplier)}` : range.max == null ? `at least ${dollars(range.min * multiplier)}`
    : range.min === range.max ? dollars(range.min * multiplier) : `${dollars(range.min * multiplier)} to ${dollars(range.max * multiplier)}`;
}

export function monthlyBudgetQuestion(answers = {}) {
  const { range } = contractBudgetEvidence(answers);
  if (!range || range.period !== 'monthly') return null;
  const choice = monthlyBudgetChoice(answers.adaptive_answers?.contract_budget_confirmation);
  if (!choice && (answers.adaptive_attempts?.contract_budget_confirmation || 0) >= 2) return null;
  if (!choice) return { key: 'contract_budget_confirmation',
    prompt: `You mentioned ${rangeLabel(range)} per month. What total contract value should we use?`,
    helper: `For a 12-month contract, that would be ${rangeLabel(range, 12)}. We will not apply that total unless you confirm it.`,
    options: [{ value: 'annual_total', label: `Use ${rangeLabel(range, 12)} for a 12-month contract` }, { value: 'enter_total', label: 'I will enter a different total contract value' }, { value: 'leave_open', label: 'Not sure - leave the size range open' }],
  };
  if (choice === 'enter_total') {
    if (monthlyBudgetChoice(answers.adaptive_answers?.contract_budget_total) === 'leave_open') return null;
    const total = contractAmountFromText(answers.adaptive_answers?.contract_budget_total);
    if ((!total || total.period === 'monthly') && (answers.adaptive_attempts?.contract_budget_total || 0) < 2) {
      return { key: 'contract_budget_total', prompt: 'What total contract value range could you handle over the whole contract?', helper: 'Enter a total, not a monthly payment. You can say "leave it open" if you are unsure.', options: [] };
    }
  }
  return null;
}

export function unresolvedBudgetMessage(profile = {}) {
  return profile.contract_size_basis === 'monthly_unconfirmed' && !monthlyBudgetQuestion(profile)
    ? 'Your monthly amount is saved, but we still need a confirmed total contract value or your choice to leave the size range open. Edit that answer or contact support; we will not keep repeating the question or silently apply a different budget.' : '';
}
