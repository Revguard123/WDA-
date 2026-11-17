import { capabilityContextQuestion, CAPABILITY_CONTEXT_KEYS } from './capabilityContext.js';
import { monthlyBudgetQuestion, unresolvedBudgetMessage } from './intakeEvidence.js';
import { workDirectionQuestion, unsupportedWorkMessage } from './workPreferences.js';

export const DISCOVERY_CONTEXT_KEYS = [...CAPABILITY_CONTEXT_KEYS, 'work_direction', 'rental_scope', 'preferred_work', 'contract_budget_confirmation', 'contract_budget_total'];

export function discoveryClarificationQuestion(profile = {}) {
  const direction = workDirectionQuestion(profile);
  if (direction) return direction;
  if (unsupportedWorkMessage(profile)) return null;
  return monthlyBudgetQuestion(profile) || (profile.adaptive_answers?.work_direction ? null : capabilityContextQuestion(profile));
}

export function refreshSavedClarification(recommendations, profile = {}) {
  if (!['needs_clarification', 'no_recommendation'].includes(recommendations?.status)) return recommendations;
  const unsupported = !workDirectionQuestion(profile) && unsupportedWorkMessage(profile);
  if (unsupported) return { status: 'no_recommendation', message: unsupported };
  const question = discoveryClarificationQuestion(profile);
  const budgetMessage = !question && unresolvedBudgetMessage(profile);
  return question ? { ...recommendations, status: 'needs_clarification', questions: [question] } : budgetMessage ? { status: 'no_recommendation', message: budgetMessage } : recommendations;
}
