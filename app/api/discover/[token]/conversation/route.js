import { getBuyerByToken } from '../../../../../lib/buyers.js';
import { getDiscoverySessionForBuyer, publicDiscoverySession, saveDiscoverySessionForBuyer } from '../../../../../lib/discoverySessions.js';
import { draftDiscoverySuggestion } from '../../../../../lib/ai/claude.js';
import { ADVISOR_MAX_TURNS, advanceAdvisorConversation, answersFromAdvisorMessages, fallbackAdvisorTurn, recoverAdvisorState } from '../../../../../lib/playbook/advisor.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function stateFor(session) {
  return recoverAdvisorState(session?.answers?.advisor_state || {}, session?.answers || {});
}

function chatContext(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message?.role === 'student' ? 'student' : 'advisor',
      content: String(message?.content || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      question: String(message?.question?.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    }))
    .filter((message) => message.content || message.question);
}

function responseState(saved) {
  const advisorState = stateFor(saved);
  return {
    advisorState,
    answers: { ...(saved?.answers || {}), advisor_state: advisorState },
  };
}

async function handleConversationPost(req, { params }) {
  const buyer = await getBuyerByToken(params.token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const session = await getDiscoverySessionForBuyer(buyer.id);
  const forceReset = body.start && body.reset === true;
  const state = forceReset
    ? { messages: [], pending_question: null, resolved_dimensions: [], turn_count: 0, complete: false, last_answer_question_id: null }
    : stateFor(session);

  const answer = String(body.answer || '').trim().slice(0, 900);
  if (!answer && !body.start && !body.draft_suggestion && !body.edit_answer) {
    return Response.json({ error: 'Please add a short answer.' }, { status: 400 });
  }

  if (body.start && !forceReset && (state.messages || []).length) {
    return Response.json({
      ok: true,
      complete: Boolean(state.complete),
      answers: { ...(session?.answers || {}), advisor_state: state },
      advisor_state: state,
      session: publicDiscoverySession(session),
    });
  }

  const pending = state.pending_question;

  if (body.draft_suggestion) {
    const currentQuestion = pending || body.current_question || {};
    if (!currentQuestion.prompt) {
      return Response.json({ error: 'There is no current question to draft for.' }, { status: 409 });
    }
    try {
      const draft = await draftDiscoverySuggestion({
        category: currentQuestion.category,
        question: currentQuestion.prompt,
        helper: currentQuestion.helper,
        suggestion: String(body.suggestion || '').trim().slice(0, 120),
        chat_context: chatContext(state.messages),
      });
      return Response.json({ ok: true, draft });
    } catch (error) {
      console.error({
        event: 'playbook_discovery_debug',
        stage: 'suggestion_draft_failed',
        error_name: error?.name || 'Error',
        error_message: String(error?.message || '').slice(0, 180),
      });
      return Response.json({ error: 'Could not draft that suggestion right now.' }, { status: 503 });
    }
  }

  if (body.edit_answer) {
    const messages = state.messages || [];
    const index = Number(body.message_index);
    const message = messages[index];
    if (!Number.isInteger(index) || !message || message.role !== 'student') {
      return Response.json({ error: 'That answer cannot be edited.' }, { status: 400 });
    }

    const questionMessage = [...messages.slice(0, index)]
      .reverse()
      .find((item) => item?.role === 'advisor' && item.question?.category);
    const question = questionMessage?.question;
    if (!question) return Response.json({ error: 'We could not find the question for that answer.' }, { status: 409 });

    const nextMessages = answer
      ? messages.map((item, itemIndex) => (itemIndex === index ? { ...item, content: answer, edited_at: new Date().toISOString() } : item))
      : messages;
    const rebuilt = answersFromAdvisorMessages(nextMessages);
    const advisorState = answer
      ? {
          ...state,
          messages: nextMessages,
          resolved_dimensions: rebuilt.resolved_dimensions,
          turn_count: Math.max(state.turn_count || 0, rebuilt.resolved_dimensions.length),
          editing_message_index: null,
        }
      : { ...state, editing_message_index: index };

    const answers = { ...(session?.answers || {}), ...rebuilt.answers, advisor_state: advisorState };
    const saved = await saveDiscoverySessionForBuyer(buyer.id, {
      answers,
      currentStep: Math.min(ADVISOR_MAX_TURNS, Math.max(1, advisorState.turn_count + 1)),
      status: 'in_progress',
      recommendations: [],
    });
    const canonical = responseState(saved);

    return Response.json({
      ok: true,
      complete: Boolean(canonical.advisorState.complete),
      editing_question: question,
      editing_answer: String(message.content || ''),
      answers: canonical.answers,
      advisor_state: canonical.advisorState,
      session: publicDiscoverySession(saved),
    });
  }

  if (!body.start && (!pending || body.question_id !== pending.id || body.question_category !== pending.category)) {
    console.warn({
      event: 'playbook_discovery_debug',
      stage: 'stale_question_rejected',
      client_question_id: String(body.question_id || '').slice(0, 100),
      server_question_id: String(pending?.id || '').slice(0, 100),
      client_question_category: String(body.question_category || '').slice(0, 80),
      server_question_category: String(pending?.category || '').slice(0, 80),
    });
    return Response.json({ error: 'That question is no longer current. Please use the latest question.' }, { status: 409 });
  }

  if (!body.start && state.last_answer_question_id === pending.id) {
    return Response.json({ error: 'That answer was already saved. Please use the latest question.' }, { status: 409 });
  }

  const existingAnswers = forceReset ? {} : session?.answers || {};
  const turn = body.start
    ? fallbackAdvisorTurn({ answers: existingAnswers, resolved_dimensions: state.resolved_dimensions, turn_count: state.turn_count })
    : await advanceAdvisorConversation({
        answers: existingAnswers,
        resolved_dimensions: state.resolved_dimensions,
        latest_answer: answer,
        answered_category: pending.category,
        turn_count: state.turn_count,
        logger: console,
      });

  const messages = [...(state.messages || [])];
  if (!body.start) {
    messages.push({
      role: 'student',
      content: answer,
      question_id: pending.id,
      question_category: pending.category,
      at: new Date().toISOString(),
    });
  }
  messages.push({
    role: 'advisor',
    content: turn.assistant_message,
    question: turn.complete ? null : turn.next_question,
    at: new Date().toISOString(),
  });

  const proposedAdvisorState = {
    messages,
    resolved_dimensions: turn.resolved_dimensions,
    turn_count: body.start ? 0 : state.turn_count + (turn.count_progress === false ? 0 : 1),
    pending_question: turn.complete ? null : turn.next_question,
    complete: turn.complete,
    last_answer_question_id: body.start ? null : pending.id,
  };
  const answers = { ...turn.answers, advisor_state: proposedAdvisorState };

  const saved = await saveDiscoverySessionForBuyer(buyer.id, {
    answers,
    currentStep: Math.min(ADVISOR_MAX_TURNS, Math.max(1, proposedAdvisorState.turn_count + 1)),
    status: 'in_progress',
  });

  // Return the same canonical state that the NEXT request will recover from storage.
  // This prevents the browser from rendering a question that the server immediately
  // considers stale on the following submit.
  const canonical = responseState(saved);
  if (proposedAdvisorState.pending_question?.id !== canonical.advisorState.pending_question?.id
      || proposedAdvisorState.pending_question?.category !== canonical.advisorState.pending_question?.category) {
    console.warn({
      event: 'playbook_discovery_debug',
      stage: 'pending_question_canonicalized',
      proposed_id: String(proposedAdvisorState.pending_question?.id || '').slice(0, 100),
      canonical_id: String(canonical.advisorState.pending_question?.id || '').slice(0, 100),
      proposed_category: String(proposedAdvisorState.pending_question?.category || '').slice(0, 80),
      canonical_category: String(canonical.advisorState.pending_question?.category || '').slice(0, 80),
    });
  }

  return Response.json({
    ok: true,
    complete: Boolean(canonical.advisorState.complete),
    answers: canonical.answers,
    advisor_state: canonical.advisorState,
    session: publicDiscoverySession(saved),
  });
}

export async function POST(req, context) {
  try {
    return await handleConversationPost(req, context);
  } catch (error) {
    const validationErrors = Array.isArray(error?.validation?.errors) ? error.validation.errors : [];
    if (validationErrors.length) {
      console.error({
        event: 'playbook_discovery_debug',
        stage: 'discovery_answers_validation_failed',
        validation_failure_count: validationErrors.length,
        validation_failure_path: String(validationErrors[0]?.path || '').slice(0, 120),
        validation_failure_reason: String(validationErrors[0]?.message || '').slice(0, 160),
      });
    }
    console.error({
      event: 'playbook_discovery_debug',
      stage: 'conversation_route_failed',
      error_name: error?.name || 'Error',
      error_message: String(error?.message || 'Discovery conversation failed').slice(0, 180),
    });
    return Response.json({ error: 'Could not continue this conversation right now.' }, { status: 503 });
  }
}
