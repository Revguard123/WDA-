import { getBuyerByToken } from '../../../../lib/buyers.js';
import {
  getDiscoverySessionForBuyer,
  publicDiscoverySession,
  saveDiscoverySessionForBuyer,
} from '../../../../lib/discoverySessions.js';
import { recommendPlaybookNiches } from '../../../../lib/playbook/recommendationEngine.js';
import { normalizeDiscoveryAnswers } from '../../../../lib/playbook/index.js';
import { adaptiveProgressForSubmission } from '../../../../lib/playbook/adaptiveProgress.js';
import { normalizeAdaptiveAnswer } from '../../../../lib/playbook/adaptiveResolvers.js';
import { normalizeCapabilityPriority } from '../../../../lib/playbook/capabilityContext.js';
import { explicitBackgroundUpdates } from '../../../../lib/playbook/backgroundEvidence.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeDiscoveryLog(stage, fields = {}, level = 'info') {
  const target = console?.[level] || console?.info;
  if (typeof target === 'function') {
    target.call(console, { event: 'playbook_discovery_debug', stage, ...fields });
  }
}

export async function POST(req, { params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  let stage = 'session_lookup';
  try {
    const existing = await getDiscoverySessionForBuyer(buyer.id);
    const progress = adaptiveProgressForSubmission(existing || {}, body);
    stage = 'profile_normalization';
    const answers = normalizeDiscoveryAnswers({
      ...(existing?.answers || {}),
      ...(body.answers || {}),
      adaptive_answers: {
        ...(existing?.answers?.adaptive_answers || {}),
        ...(body.answers?.adaptive_answers || {}),
        ...(body.adaptive_answers || {}),
      },
      adaptive_attempts: progress.attempts,
      adaptive_answer_notes: { ...existing?.answers?.adaptive_answer_notes, ...body.answers?.adaptive_answer_notes },
    });
    Object.assign(answers, explicitBackgroundUpdates(answers));
    for (const [key, value] of Object.entries(answers.adaptive_answers)) {
      const canonical = key === 'capability_priority'
        ? normalizeCapabilityPriority(value, answers) || ((progress.attempts[key] || 0) >= 2 ? 'compare_all' : '')
        : normalizeAdaptiveAnswer(key, value);
      if (canonical) {
        if (!answers.adaptive_answer_notes[key]) answers.adaptive_answer_notes[key] = String(value).slice(0, 900);
        answers.adaptive_answers[key] = canonical;
      }
    }
    stage = 'recommendation_engine';
    const result = await recommendPlaybookNiches(answers, {
      adaptiveAnswers: answers.adaptive_answers,
      clarificationRound: progress.clarificationRound,
      adaptiveAttempts: progress.attempts,
      logger: console,
    });

    if (result.status === 'needs_clarification') {
      stage = 'session_recommendation_persistence';
      const session = await saveDiscoverySessionForBuyer(buyer.id, {
        answers,
        currentStep: 6,
        status: 'in_progress',
        recommendations: { status: 'needs_clarification', questions: result.questions, preliminary_candidate_ids: result.preliminary_candidate_ids },
      });
      safeDiscoveryLog('session_recommendation_persistence', {
        status: 'needs_clarification',
        question_count: result.questions.length,
      });
      return Response.json({
        status: 'needs_clarification',
        questions: result.questions,
        session: publicDiscoverySession(session),
      });
    }

    if (result.status === 'recommended') {
      stage = 'session_recommendation_persistence';
      const session = await saveDiscoverySessionForBuyer(buyer.id, {
        answers,
        currentStep: 6,
        status: 'recommended',
        recommendations: result.recommendations,
      });
      safeDiscoveryLog('session_recommendation_persistence', {
        status: 'recommended',
        recommendation_count: result.recommendations.length,
      });
      return Response.json({
        status: 'recommended',
        recommendations: result.recommendations,
        session: publicDiscoverySession(session),
      });
    }

    stage = 'session_recommendation_persistence';
    await saveDiscoverySessionForBuyer(buyer.id, {
      answers,
      currentStep: 6,
      status: 'in_progress',
      recommendations: { status: 'no_recommendation', message: result.message },
    });
    safeDiscoveryLog('session_recommendation_persistence', {
      status: 'no_recommendation',
      recommendation_count: 0,
    });
    return Response.json({
      status: 'no_recommendation',
      message: result.message || 'We could not safely resolve a recommendation from those answers yet.',
    });
  } catch (err) {
    safeDiscoveryLog('discover_route_failed', {
      failed_stage: stage,
      error_name: err?.name || 'Error',
      error_message: String(err?.message || 'Discovery recommendation failed').slice(0, 240),
      validation_failure_reason: err?.validation?.errors?.map((e) => e.message).slice(0, 4).join('; ') || undefined,
    }, 'error');
return Response.json(
  {
    error: 'Could not prepare Playbook recommendations right now. Your answers remain saved.',
    retryable: true,
  },
  { status: 500 },
);
  }
}
