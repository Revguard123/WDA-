import { DISCOVERY_CONTEXT_KEYS } from './discoveryClarifications.js';

export function normalizeAdaptiveAttempts(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => key.length <= 100 && Number.isFinite(value) && value >= 0)
    .map(([key, value]) => [key, Math.min(100, Math.trunc(value))]));
}

// Counters come from the saved session, never from a caller's requested round.
// A repeated answer to the same question must still consume an attempt.
export function adaptiveProgressForSubmission(existing = {}, body = {}) {
  const attempts = normalizeAdaptiveAttempts(existing.answers?.adaptive_attempts);
  for (const key of Object.keys(existing.answers?.adaptive_answers || {})) {
    if (!attempts[key]) attempts[key] = 1; // Legacy sessions have no counters.
  }
  const submitted = { ...(body.answers?.adaptive_answers || {}), ...(body.adaptive_answers || {}) };
  const pendingKey = existing.recommendations?.status === 'needs_clarification' ? existing.recommendations.questions?.[0]?.key : null;
  if (!body.retry && pendingKey && Object.hasOwn(submitted, pendingKey) && String(submitted[pendingKey] || '').trim()) {
    attempts[pendingKey] = (attempts[pendingKey] || 0) + 1;
  }
  return {
    attempts,
    clarificationRound: Object.entries(attempts).reduce((total, [key, count]) => total + (DISCOVERY_CONTEXT_KEYS.includes(key) ? 0 : count), 0),
  };
}
