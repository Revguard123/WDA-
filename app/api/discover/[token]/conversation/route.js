import { getBuyerByToken } from '../../../../../lib/buyers.js';
import { getDiscoverySessionForBuyer, publicDiscoverySession, saveDiscoverySessionForBuyer } from '../../../../../lib/discoverySessions.js';
import { draftDiscoverySuggestion } from '../../../../../lib/ai/claude.js';
import { ADVISOR_MAX_TURNS, advanceAdvisorConversation, answersFromAdvisorMessages, fallbackAdvisorTurn, recoverAdvisorState } from '../../../../../lib/playbook/advisor.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function stateFor(session) { return recoverAdvisorState(session?.answers?.advisor_state || {}, session?.answers || {}); }
function chatContext(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message?.role === 'student' ? 'student' : 'advisor',
      content: String(message?.content || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      question: String(message?.question?.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    }))
    .filter((message) => message.content || message.question);
}

export async function POST(req, { params }) {
  const buyer = await getBuyerByToken(params.token);
  if (!buyer) return Response.json({ error: 'not found' }, { status: 404 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }
  const session = await getDiscoverySessionForBuyer(buyer.id);
  const state = stateFor(session);
  const answer = String(body.answer || '').trim().slice(0, 900);
  if (!answer && !body.start && !body.draft_suggestion && !body.edit_answer) return Response.json({ error: 'Please add a short answer.' }, { status: 400 });
  if (body.start && (state.messages || []).length) return Response.json({ ok: true, complete: Boolean(state.complete), answers: session?.answers || {}, advisor_state: state, session: publicDiscoverySession(session) });
  const pending = state.pending_question;
  if (body.draft_suggestion) {
    const currentQuestion = pending || body.current_question || {};
    if (!currentQuestion.prompt) return Response.json({ error: 'There is no current question to draft for.' }, { status: 409 });
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
      console.error({ event: 'playbook_discovery_debug', stage: 'suggestion_draft_failed', error_name: error?.name || 'Error', error_message: String(error?.message || '').slice(0, 180) });
      return Response.json({ error: 'Could not draft that suggestion right now.' }, { status: 503 });
    }
  }
  if (body.edit_answer) {
    const messages = state.messages || [];
    const index = Number(body.message_index);
    const message = messages[index];
    if (!Number.isInteger(index) || !message || message.role !== 'student') return Response.json({ error: 'That answer cannot be edited.' }, { status: 400 });
    const questionMessage = [...messages.slice(0, index)].reverse().find((item) => item?.role === 'advisor' && item.question?.category);
    const question = questionMessage?.question;
    if (!question) return Response.json({ error: 'We could not find the question for that answer.' }, { status: 409 });
    const nextMessages = answer ? messages.map((item, itemIndex) => (itemIndex === index ? { ...item, content: answer, edited_at: new Date().toISOString() } : item)) : messages;
    const rebuilt = answersFromAdvisorMessages(nextMessages);
    const advisorState = answer ? {
      ...state,
      messages: nextMessages,
      resolved_dimensions: rebuilt.resolved_dimensions,
      turn_count: Math.max(state.turn_count || 0, rebuilt.resolved_dimensions.length),
      editing_message_index: null,
    } : { ...state, editing_message_index: index };
    const answers = { ...(session?.answers || {}), ...rebuilt.answers, advisor_state: advisorState };
    const saved = await saveDiscoverySessionForBuyer(buyer.id, { answers, currentStep: Math.min(ADVISOR_MAX_TURNS, Math.max(1, advisorState.turn_count + 1)), status: 'in_progress', recommendations: [] });
    return Response.json({ ok: true, complete: Boolean(advisorState.complete), editing_question: question, editing_answer: String(message.content || ''), answers: saved.answers, advisor_state: advisorState, session: publicDiscoverySession(saved) });
  }
  if (!body.start && (!pending || body.question_id !== pending.id || body.question_category !== pending.category)) return Response.json({ error: 'That question is no longer current. Please use the latest question.' }, { status: 409 });
  if (!body.start && state.last_answer_question_id === pending.id) return Response.json({ error: 'That answer was already saved. Please use the latest question.' }, { status: 409 });
  const existingAnswers = session?.answers || {};
  const turn = body.start ? fallbackAdvisorTurn({ answers: existingAnswers, resolved_dimensions: state.resolved_dimensions, turn_count: state.turn_count }) : await advanceAdvisorConversation({ answers: existingAnswers, resolved_dimensions: state.resolved_dimensions, latest_answer: answer, answered_category: pending.category, turn_count: state.turn_count, logger: console });
  const messages = [...(state.messages || [])];
  if (!body.start) messages.push({ role: 'student', content: answer, at: new Date().toISOString() });
  messages.push({ role: 'advisor', content: turn.assistant_message, question: turn.complete ? null : turn.next_question, at: new Date().toISOString() });
  const answers = { ...turn.answers, advisor_state: { messages, resolved_dimensions: turn.resolved_dimensions, turn_count: body.start ? 0 : state.turn_count + (turn.count_progress === false ? 0 : 1), pending_question: turn.complete ? null : turn.next_question, complete: turn.complete, last_answer_question_id: body.start ? null : pending.id } };
  const saved = await saveDiscoverySessionForBuyer(buyer.id, { answers, currentStep: Math.min(ADVISOR_MAX_TURNS, Math.max(1, answers.advisor_state.turn_count + 1)), status: 'in_progress' });
  return Response.json({ ok: true, complete: turn.complete, answers: saved.answers, advisor_state: answers.advisor_state, session: publicDiscoverySession(saved) });
}
