'use client';

import { useEffect, useRef, useState } from 'react';
import { UI, BODY_FONT } from '../../lib/ui.js';

const emptyState = { messages: [], pending_question: null, turn_count: 0, complete: false };
const ADVISOR_TOTAL = 10;
const THINKING_LOTTIE_URL = 'https://lottie.host/embed/d600c658-5662-4e45-bdba-bf24d1abbff8/P88Xg7Vftf.lottie';
const DRAFT_LOTTIE_URL = 'https://lottie.host/embed/322a6aa2-45b8-484f-aa83-529d5134cf7f/Fs00gWaIMv.json';
const iconPaths = {
  award: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12.5-1.5 8 5-3 5 3-1.5-8" /></>,
  briefcase: <><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" /><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 12h18" /></>,
  building: <><path d="M4 21V5a2 2 0 0 1 2-2h8v18" /><path d="M14 9h4a2 2 0 0 1 2 2v10" /><path d="M8 7h2M8 11h2M8 15h2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  circle: <circle cx="12" cy="12" r="7" />,
  dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>,
  hammer: <><path d="m15 12-8 8-3-3 8-8" /><path d="m14 4 6 6" /><path d="m11 7 3-3 6 6-3 3" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.5 9a2.8 2.8 0 0 1 5 1.7c0 2-2.5 2-2.5 4" /><path d="M12 18h.01" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /></>,
  map: <><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  package: <><path d="m21 8-9-5-9 5 9 5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  truck: <><path d="M10 17H5V6h11v11h-2" /><path d="M16 9h3l3 4v4h-3" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
};
const optionIcons = { 'IT support': 'monitor', 'Cleaning / Facilities': 'building', Construction: 'hammer', 'Staffing / Labor': 'users', 'Product sourcing': 'package', Products: 'package', Services: 'briefcase', Either: 'check', 'My own team': 'users', Subcontractors: 'truck', Combination: 'users', Federal: 'building', 'State / local': 'map', Commercial: 'briefcase', 'Industry experience': 'award', 'Brand new': 'plus', Licenses: 'award', Bonding: 'shield', 'Qualified staff': 'users', Equipment: 'hammer', Suppliers: 'package', 'None / not sure': 'help', 'Small Business': 'briefcase', SDVOSB: 'shield', WOSB: 'award', '8(a)': 'check', HUBZone: 'map', Nationwide: 'globe', 'Remote / digital': 'monitor', 'Depends on vendor': 'truck', 'Recurring services': 'briefcase', 'Project work': 'hammer', 'Product supply': 'package', 'No preference': 'circle', 'Under $25k': 'dollar', '$25k to $150k': 'dollar', '$150k+': 'dollar', 'Include services I already know': 'briefcase', 'Include product sourcing': 'package', 'Avoid construction': 'hammer', 'Avoid staffing': 'users', 'Nothing to avoid': 'check', 'Not sure': 'help', 'Not sure yet': 'help' };

function initialAdvisorState(session) { return session?.answers?.advisor_state || emptyState; }
function isGenericAdvisorRow(message) { return message?.role === 'advisor' && String(message.content || '').includes('keep this practical and narrow the next useful point'); }
async function readJsonResponse(response, fallbackMessage = 'Request failed.') {
  const text = await response.text();
  if (!text) return { error: fallbackMessage };
  try {
    return JSON.parse(text);
  } catch {
    return { error: fallbackMessage };
  }
}
function customerSafeError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  const message = String(error?.message || '').trim();
  if (!message) return fallbackMessage;
  if (/failed to execute|unexpected end|json|syntaxerror|typeerror|referenceerror|networkerror|request_id|stack|response\.json|html|doctype|internal server error/i.test(message)) {
    return fallbackMessage;
  }
  return message.slice(0, 180);
}
function Icon({ name }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="discovery-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name] || iconPaths.help}</svg>;
}
function icon(label) { return <span aria-hidden="true" className="discovery-chip-icon"><Icon name={optionIcons[label] || 'help'} /></span>; }

export default function DiscoveryForm({ token, initialSession = null, supportCta = null, updateMode = false }) {
  const [state, setState] = useState(() => initialAdvisorState(initialSession));
  const [answers, setAnswers] = useState(initialSession?.answers || {});
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('chat');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [recs, setRecs] = useState(Array.isArray(initialSession?.recommendations) ? initialSession.recommendations : []);
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [applying, setApplying] = useState(-1);
  const [showBackToBottom, setShowBackToBottom] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const historyRef = useRef(null);
  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const bootstrapped = useRef(false);
  const stuckToBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const busy = status === 'thinking';
  const drafting = status === 'drafting';
  const rewinding = status === 'rewinding';
  const locked = busy || drafting || rewinding;
  const buildingRecommendations = busy && state.complete && !recs.length;
  const messages = state.messages || [];
  const latestStudent = [...messages].reverse().find((message) => message.role === 'student');
  const pendingOptimisticMessages = optimisticMessages.filter((message) => !(message.role === 'student' && messages.length > message.afterMessageCount && latestStudent?.content === message.content));
  const visibleMessages = [...messages, ...pendingOptimisticMessages].filter((message) => !isGenericAdvisorRow(message));
  const pending = state.pending_question;
  const progress = Math.min(ADVISOR_TOTAL, Math.max(1, (state.turn_count || 0) + (recs.length ? 0 : 1)));

  function scrollChatToBottom(behavior = 'smooth') {
    const el = historyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowBackToBottom(false);
    stuckToBottom.current = true;
  }

  function updateScrollState() {
    const el = historyRef.current;
    if (!el) return;
    const away = el.scrollHeight - el.scrollTop - el.clientHeight > 90;
    setShowBackToBottom(away);
    stuckToBottom.current = !away;
  }

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      requestAnimationFrame(() => scrollChatToBottom('auto'));
      return;
    }
    if (stuckToBottom.current) requestAnimationFrame(() => scrollChatToBottom('smooth'));
  }, [visibleMessages.length, busy, recs.length]);

  useEffect(() => {
    if (bootstrapped.current || mode !== 'chat' || messages.length || pending || recs.length) return;
    bootstrapped.current = true;
    setStatus('thinking');
    callConversation({ start: true }).catch((err) => setError(customerSafeError(err, 'Could not start Discovery right now. Please try again.'))).finally(() => setStatus('idle'));
  }, [mode, messages.length, pending, recs.length]);

  useEffect(() => {
    setShowSuggestions(false);
    if (locked || !pending || recs.length || (draft.trim() && editingIndex == null)) return undefined;
    const timer = setTimeout(() => setShowSuggestions(true), 3500);
    return () => clearTimeout(timer);
  }, [locked, pending?.id, pending?.prompt, recs.length, draft]);

  async function callConversation(body) {
    const response = await fetch(`/api/discover/${token}/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await readJsonResponse(response, 'Could not continue this conversation.');
    if (!response.ok) throw new Error(data.error || 'Could not continue this conversation.');
    setState(data.advisor_state);
    setAnswers(data.answers);
    return data;
  }

  async function startNewDiscovery() {
    if (locked) return;
    setMode('chat');
    setDraft('');
    setError('');
    setRecs([]);
    setOptimisticMessages([]);
    setEditingIndex(null);
    stuckToBottom.current = true;
    didInitialScroll.current = false;
    setShowBackToBottom(false);
    setAnswers({});
    setState(emptyState);
    bootstrapped.current = true;
    setStatus('thinking');
    try {
      const response = await fetch(`/api/discover/${token}/session`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: { advisor_state: emptyState }, current_step: 1, status: 'in_progress', recommendations: [] }) });
      const data = await readJsonResponse(response, 'Could not start a new discovery.');
      if (!response.ok) throw new Error(data.error || 'Could not start a new discovery.');
      await callConversation({ start: true });
    } catch (err) {
      setError(customerSafeError(err, 'Could not start a new discovery.'));
    } finally {
      setStatus('idle');
    }
  }

  async function submit(value = draft) {
    const answer = String(value || '').trim();
    if (!answer || locked) return;
    if (editingIndex != null) {
      setShowSuggestions(false);
      setStatus('thinking');
      setError('');
      try {
        const data = await callConversation({ edit_answer: true, message_index: editingIndex, answer });
        setRecs([]);
        setDraft('');
        setEditingIndex(null);
        if (!data.complete) return;
        const response = await fetch(`/api/discover/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: data.answers, clarification_round: 0 }) });
        const result = await readJsonResponse(response, 'Could not refresh recommendations.');
        if (!response.ok) throw new Error(result.error || 'Could not refresh recommendations.');
        setRecs(result.recommendations || []);
      } catch (err) {
        setError(customerSafeError(err, 'Could not update that answer right now.'));
      } finally {
        setStatus('idle');
      }
      return;
    }
    stuckToBottom.current = true;
    setShowSuggestions(false);
    setOptimisticMessages([{ role: 'student', content: answer, sending: true, afterMessageCount: messages.length }]);
    setDraft('');
    setEditingIndex(null);
    setStatus('thinking');
    setError('');
    let succeeded = false;
    try {
      if (pending?.adaptive_key) {
        const nextAnswers = { ...answers, adaptive_answers: { ...(answers.adaptive_answers || {}), [pending.adaptive_key]: answer } };
        const response = await fetch(`/api/discover/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: nextAnswers, clarification_round: 1 }) });
        const result = await readJsonResponse(response, 'Could not prepare recommendations.');
        if (!response.ok) throw new Error(result.error || 'Could not prepare recommendations.');
        setAnswers(nextAnswers);
        if (result.status === 'needs_clarification' && result.questions?.[0]) {
          const question = result.questions[0];
          setState((current) => ({ ...current, complete: false, pending_question: { category: 'naics_clarification', prompt: question.prompt, input_type: 'single_choice', options: question.options || [], adaptive_key: question.key } }));
        } else {
          setState((current) => ({ ...current, pending_question: null, complete: true }));
          setRecs(result.recommendations || []);
        }
        succeeded = true;
        return;
      }
      const data = await callConversation({ answer, question_id: pending?.id, question_category: pending?.category });
      if (!data.complete) return;
      const response = await fetch(`/api/discover/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: data.answers, clarification_round: 0 }) });
      const result = await readJsonResponse(response, 'Could not prepare recommendations.');
      if (!response.ok) throw new Error(result.error || 'Could not prepare recommendations.');
      if (result.status === 'needs_clarification' && result.questions?.[0]) {
        const question = result.questions[0];
        setState({ ...data.advisor_state, complete: false, pending_question: { category: 'naics_clarification', prompt: question.prompt, input_type: 'single_choice', options: question.options || [], adaptive_key: question.key } });
      } else {
        setRecs(result.recommendations || []);
      }
      succeeded = true;
    } catch (err) {
      setOptimisticMessages([]);
      setError(customerSafeError(err, 'Could not continue right now. Your previous answers are saved.'));
    } finally {
      if (succeeded) setOptimisticMessages([]);
      if (succeeded) setEditingIndex(null);
      setStatus('idle');
    }
  }

  async function editAnswer(index, content) {
    if (locked) return;
    setStatus('rewinding');
    setShowSuggestions(false);
    setError('');
    try {
      const response = await fetch(`/api/discover/${token}/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edit_answer: true, message_index: index }) });
      const data = await readJsonResponse(response, 'Could not edit that answer.');
      if (!response.ok) throw new Error(data.error || 'Could not edit that answer.');
      setState({ ...data.advisor_state, pending_question: data.editing_question, complete: false });
      setAnswers(data.answers);
      setRecs([]);
      setOptimisticMessages([]);
      setEditingIndex(index);
      setDraft(data.editing_answer || content || '');
      setShowSuggestions(true);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
        el.focus();
      });
    } catch (err) {
      setError(customerSafeError(err, 'Could not edit that answer right now.'));
    } finally {
      setStatus('idle');
    }
  }

  async function draftSuggestion(label) {
    if (!pending || locked) return;
    setShowSuggestions(false);
    setStatus('drafting');
    setError('');
    try {
      const response = await fetch(`/api/discover/${token}/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft_suggestion: true, suggestion: label, current_question: { category: pending.category, prompt: pending.prompt, helper: pending.helper } }) });
      const data = await readJsonResponse(response, 'Could not draft that suggestion.');
      if (!response.ok) throw new Error(data.error || 'Could not draft that suggestion.');
      setDraft(data.draft || '');
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
        el.focus();
      });
    } catch (err) {
      setError(customerSafeError(err, 'Could not draft that suggestion right now.'));
    } finally {
      setStatus('idle');
    }
  }

  async function useThis(rec, index) {
    setApplying(index);
    try {
      const response = await fetch(`/api/discover/${token}/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subindustry_id: rec.subindustry_id }) });
      if (!response.ok) throw new Error();
      window.location.href = `/setup/${token}${updateMode ? '?update=1' : ''}`;
    } catch {
      setApplying(-1);
      setError('Could not apply this niche safely.');
    }
  }

  function sendWithKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function resizeComposer(event) {
    const el = event.currentTarget;
    setDraft(el.value);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function questionForMessage(index) {
    return [...visibleMessages.slice(0, index)].reverse().find((message) => message.role === 'advisor' && message.question?.prompt)?.question?.prompt || 'Your answer';
  }

  return <div className="discovery-workspace">
    <style>{`.discovery-workspace{height:100%;overflow:hidden;background:#fbf9f6;font-family:${BODY_FONT}}.discovery-main{height:100%;margin:0;padding:18px 26px 13px;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column}.discovery-thread{position:relative;width:100%;margin:0;display:flex;min-height:0;flex:1;flex-direction:column;overflow:hidden}.discovery-icon{width:16px;height:16px;flex:0 0 auto}.discovery-header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:52px;color:#182033;font-size:13px;font-weight:600;flex:0 0 auto}.discovery-header-left{display:flex;align-items:center;gap:12px;min-width:0}.discovery-avatar{width:42px;height:42px;border:1px solid #ff9f58;border-radius:50%;padding:3px;background:#fff;object-fit:contain;flex:0 0 auto}.discovery-advisor-title{font-size:16px;font-weight:600;color:#182033}.discovery-advisor-subtitle{margin-top:2px;color:#667085;font-size:12px;font-weight:500}.discovery-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.discovery-toolbar-button,.discovery-toolbar-link,.discovery-current{display:inline-flex;align-items:center;gap:6px;border:1px solid #e6e4e2;border-radius:999px;background:#fff;padding:7px 10px;color:#3d4352;font:600 12px ${BODY_FONT};text-decoration:none;cursor:pointer}.discovery-toolbar-button{background:#f52ea9;border-color:#f52ea9;color:#fff}.discovery-toolbar-button:disabled{opacity:.65;cursor:wait}.discovery-header-right{display:flex;align-items:center;gap:16px;margin-left:auto}.discovery-progress{display:flex;gap:4px}.discovery-progress span{display:block;width:45px;height:7px;border-radius:99px;background:#e2e3e7}.discovery-progress span.is-done{background:#f52ea9}.discovery-progress-count{white-space:nowrap}.discovery-support{display:inline-flex}.discovery-support>div{margin:0!important;border:0!important;border-radius:999px!important;padding:0!important;background:transparent!important;color:#3d4352!important;font-size:12px!important}.discovery-support strong,.discovery-support span{display:none!important} .discovery-support>div>button{border:1px solid #e6e4e2!important;border-radius:999px!important;background:#fff!important;padding:7px 10px!important;color:#3d4352!important;font:600 12px ${BODY_FONT}!important;text-decoration:none!important}.discovery-history{padding:2px 11px 0;min-height:0;flex:1 1 auto;overflow-y:auto;scroll-behavior:smooth;overscroll-behavior:contain}.discovery-assistant{display:flex;gap:12px;margin:22px 0 0}.discovery-assistant-body{max-width:860px;color:#182033;font-size:17px;line-height:1.55}.discovery-copy{display:inline-block;max-width:860px;padding:15px 18px;border:1px solid #eee7dc;border-radius:18px 18px 18px 6px;background:#fffaf4;box-shadow:0 2px 7px rgba(32,24,16,.05);color:#182033}.discovery-question{margin-top:12px;font-size:20px;line-height:1.4;font-weight:600}.discovery-helper{margin-top:5px;color:#6e7380;font-size:16px}.discovery-student{display:flex;justify-content:flex-end;margin:18px 0 10px}.discovery-student-wrap{max-width:650px;text-align:right}.discovery-student-question{margin:0 6px 6px;color:#687084;font-size:12px;font-weight:600}.discovery-student-bubble{max-width:610px;padding:22px 29px 15px;border-radius:22px 22px 7px 22px;background:linear-gradient(135deg,#10182a,#222b42);box-shadow:0 3px 8px rgba(12,17,31,.16);color:#fff;font-size:17px;line-height:1.55;text-align:left}.discovery-student.is-editing .discovery-student-bubble{outline:2px solid #f52ea9;box-shadow:0 0 0 5px rgba(245,46,169,.12)}.discovery-student-meta{margin-top:8px;text-align:right;color:#c3c8d4;font-size:12px}.discovery-edit-answer{margin:6px 6px 0;border:0;background:transparent;color:#f52ea9;font:600 12px ${BODY_FONT};cursor:pointer;text-decoration:underline}.discovery-edit-answer:disabled{opacity:.5;cursor:wait}.discovery-chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px 71px}.discovery-chip{display:inline-flex;align-items:center;border:1px solid #e6e4e2;border-radius:999px;background:#fff;box-shadow:none;padding:7px 12px;color:#3d4352;font:600 13px ${BODY_FONT};cursor:pointer}.discovery-chip:hover{border-color:#f52ea9;color:#172034}.discovery-chip:disabled{opacity:.5;cursor:wait}.discovery-chip-icon{display:inline-grid;place-items:center;margin-right:6px;color:#f52ea9}.discovery-chip-icon .discovery-icon{width:14px;height:14px}.discovery-thinking{display:block;width:92px;height:42px;margin:18px 0 0 71px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:hidden;animation:none;flex:0 0 auto}.discovery-thinking iframe{display:block;width:100%;height:100%;border:0;background:transparent}.discovery-draft-loading{margin-top:auto;padding:18px 0 32px;display:flex;align-items:center;justify-content:center;gap:12px;color:#182033;font-weight:600}.discovery-draft-loading iframe{width:48px;height:48px;border:0}.discovery-draft-loading span{font-size:14px}.discovery-suggestion-label{margin:15px 0 0 71px;color:#7b8190;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.7px}.discovery-bottom-jump{position:absolute;right:20px;bottom:104px;z-index:4;border:0;border-radius:999px;padding:10px 14px;background:#111827;color:#fff;box-shadow:0 8px 20px rgba(17,24,39,.18);font:600 13px ${BODY_FONT};cursor:pointer;transition:transform .16s ease,opacity .16s ease}.discovery-bottom-jump:hover{transform:translateY(-2px);background:#f52ea9}.discovery-composer{margin-top:auto;padding-top:20px;flex:0 0 auto}.discovery-composer-box{position:relative;border:2px solid #f52ea9;border-radius:22px;box-shadow:0 3px 8px rgba(245,46,169,.12);background:#fff}.discovery-composer-leading{position:absolute;left:17px;top:13px;color:#f52ea9}.discovery-composer-leading .discovery-icon{width:18px;height:18px}.discovery-composer textarea{display:block;width:100%;min-height:72px;box-sizing:border-box;border:0;border-radius:20px;padding:20px 80px 14px 58px;resize:none;outline:none;color:#182033;font:17px ${BODY_FONT}}.discovery-composer textarea::placeholder{color:#7c8290}.discovery-composer button{position:absolute;right:13px;top:12px;width:49px;height:49px;display:grid;place-items:center;border:0;border-radius:50%;background:#f52ea9;color:#fff;cursor:pointer}.discovery-composer button .discovery-icon{width:20px;height:20px}.discovery-composer button:disabled{opacity:.55;cursor:wait}.discovery-composer-help{margin:8px 0 0 18px;color:#707583;font-size:13px}.discovery-error{margin:12px 0;color:${UI.orangeDeep};font-weight:600;flex:0 0 auto}.discovery-recommendations{margin:28px 70px 0}.discovery-card{margin-bottom:14px;padding:20px;border:1px solid #e5e0da;border-top:3px solid #f52ea9;border-radius:12px}.discovery-text-link{margin-top:14px;border:0;background:none;padding:0;color:#182033;font:600 14px ${BODY_FONT};text-decoration:underline;cursor:pointer}@media(max-width:800px){.discovery-main{padding:12px}.discovery-header{align-items:flex-start;flex-direction:column}.discovery-header-right{margin-left:0;flex-wrap:wrap}.discovery-history{padding:0}.discovery-assistant{gap:12px}.discovery-avatar{width:40px;height:40px}.discovery-assistant-body,.discovery-student-bubble{font-size:15px}.discovery-question{font-size:18px}.discovery-chips{margin-left:52px;gap:8px}.discovery-chip{padding:9px 12px;font-size:14px}.discovery-progress span{width:26px}.discovery-composer textarea{font-size:16px}.discovery-recommendations{margin-left:52px;margin-right:0}}`}</style>

    <style>{`.discovery-student-label{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0 3px 7px;color:#687084;font-size:12px;font-weight:500}.discovery-student-label span{display:inline-flex;align-items:center;gap:5px;max-width:520px;text-align:right}.discovery-student-label .discovery-icon{width:13px;height:13px}.discovery-edit-answer{display:inline-flex;align-items:center;gap:4px;margin:0;border:1px solid #f5d5e8;border-radius:999px;background:#fff7fc;padding:5px 8px;color:#d61b8d;font:600 11px ${BODY_FONT};text-decoration:none;box-shadow:0 1px 4px rgba(245,46,169,.08)}.discovery-edit-answer:hover{border-color:#f52ea9;background:#fff}.discovery-edit-answer .discovery-icon{width:12px;height:12px}.discovery-active-question{align-items:center;gap:12px;margin-top:12px}.discovery-active-question .discovery-avatar{width:38px;height:38px}.discovery-question-line{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.discovery-active-question .discovery-question{margin:0;font-size:17px;line-height:1.3;font-weight:600}.discovery-active-question .discovery-helper{margin:0;font-size:13px;font-weight:400}.discovery-draft-loading{flex-direction:column;gap:4px;font-weight:500}.discovery-draft-animation{width:110px;height:110px;display:grid;place-items:center;overflow:hidden}.discovery-draft-animation iframe{display:block;width:110px;height:110px;border:0;background:transparent}.discovery-draft-loading span{font-weight:500;color:#4f5665}.discovery-composer{padding-top:10px;padding-bottom:32px}.discovery-composer-box{border-radius:999px;box-shadow:0 2px 7px rgba(245,46,169,.1)}.discovery-composer textarea{height:46px;min-height:46px;border-radius:999px;padding:13px 58px 11px 43px;font-size:15px;line-height:20px;overflow:hidden}.discovery-composer button{right:7px;top:6px;width:34px;height:34px}.discovery-composer-help{margin-top:6px;font-size:12px}.discovery-bottom-jump{bottom:140px}@media(max-width:600px){.discovery-main{padding:9px 10px 0}.discovery-header{align-items:flex-start;gap:8px;min-height:auto;font-size:12px}.discovery-header-left{gap:8px;align-items:center;flex-wrap:wrap}.discovery-avatar{width:34px;height:34px;padding:2px}.discovery-advisor-title{font-size:14px;line-height:1.05}.discovery-advisor-subtitle{font-size:11px;margin-top:1px}.discovery-toolbar{gap:6px} .discovery-toolbar-button,.discovery-toolbar-link,.discovery-current,.discovery-support>div>button{padding:6px 9px!important;font-size:11px!important;gap:4px}.discovery-header-right{gap:9px;margin-left:0;width:100%}.discovery-progress{gap:3px}.discovery-progress span{width:28px!important;height:6px}.discovery-progress-count{font-size:12px}.discovery-history{padding:0 2px}.discovery-assistant{gap:8px;margin-top:14px}.discovery-assistant-body{font-size:14px;line-height:1.45}.discovery-copy{padding:10px 12px;border-radius:14px 14px 14px 5px}.discovery-student{margin:12px 0 8px}.discovery-student-label{font-size:10px;gap:6px}.discovery-student-label span{max-width:64vw}.discovery-edit-answer{padding:4px 7px;font-size:10px}.discovery-student-bubble{max-width:70vw;padding:14px 16px 10px;border-radius:18px 18px 6px 18px;font-size:14px;line-height:1.45}.discovery-student-meta{font-size:10px}.discovery-active-question{margin-top:8px}.discovery-active-question .discovery-avatar{width:32px;height:32px}.discovery-question-line{gap:5px}.discovery-active-question .discovery-question{font-size:16px;line-height:1.2}.discovery-active-question .discovery-helper{font-size:12px;line-height:1.35}.discovery-draft-animation,.discovery-draft-animation iframe{width:82px;height:82px}.discovery-draft-loading span{font-size:12px}.discovery-suggestion-label{margin:10px 0 0 43px;font-size:10px;letter-spacing:.6px}.discovery-chips{margin:7px 0 8px 43px;gap:6px}.discovery-chip{padding:6px 9px;font-size:12px}.discovery-chip-icon{margin-right:4px}.discovery-chip-icon .discovery-icon{width:12px;height:12px}.discovery-composer{padding-top:8px;padding-bottom:20px}.discovery-composer-box{border-radius:22px}.discovery-composer-leading{left:14px;top:12px}.discovery-composer-leading .discovery-icon{width:14px;height:14px}.discovery-composer textarea{height:42px;min-height:42px;max-height:128px;padding:11px 52px 10px 37px;font-size:14px;line-height:18px;overflow-y:auto}.discovery-composer button{right:6px;top:auto;bottom:6px;width:30px;height:30px}.discovery-composer button .discovery-icon{width:16px;height:16px}.discovery-composer-help{margin:5px 0 0 12px;font-size:10px}.discovery-bottom-jump{right:18px;bottom:118px;padding:8px 11px;font-size:12px}.discovery-thinking{width:70px;height:32px;margin-left:43px}.discovery-recommendations{margin:16px 0 0 43px}.discovery-card{padding:14px}}`}</style>
    <style>{`@keyframes wdaEditGlow{0%{background-position:0 0,0% 50%}100%{background-position:0 0,220% 50%}}.discovery-student.is-editing .discovery-student-bubble{border:3px solid transparent;background:linear-gradient(135deg,#10182a,#222b42) padding-box,linear-gradient(90deg,#f52ea9,#ff9f58,#f52ea9,#ff9f58) border-box;background-size:100% 100%,220% 100%;animation:wdaEditGlow 1.6s linear infinite;outline:none;box-shadow:0 0 0 6px rgba(245,46,169,.12),0 12px 28px rgba(245,46,169,.2)}.discovery-recommendation-loading{display:flex;align-items:center;gap:12px;margin:18px 0 0 71px;padding:13px 15px;max-width:560px;border:1px solid #eee0d7;border-radius:18px;background:#fffaf4;box-shadow:0 8px 24px rgba(26,26,26,.06);color:#182033}.discovery-recommendation-loading iframe{width:46px;height:46px;border:0;flex:0 0 auto}.discovery-loading-title{font-weight:600;font-size:14px}.discovery-loading-copy{margin-top:2px;color:#697386;font-size:13px;line-height:1.4}.discovery-recommendation-message{margin-bottom:22px}.discovery-recommendations{max-width:1120px;margin:0!important}.discovery-recommendation-intro{margin-bottom:14px}.discovery-rec-eyebrow{margin-bottom:5px;color:#c81e86;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px}.discovery-rec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:12px}.discovery-card{position:relative;margin:0;padding:18px;border:1px solid #eee0d7;border-top:0;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(26,26,26,.06)}.discovery-card:first-child{border-color:#f52ea9;box-shadow:0 14px 34px rgba(245,46,169,.12)}.discovery-rec-rank{position:absolute;right:14px;top:12px;color:#f52ea9;font-size:12px;font-weight:600}.discovery-rec-title{padding-right:36px;color:#182033;font-size:18px;font-weight:600;line-height:1.25}.discovery-rec-industry{margin-top:4px;color:#697386;font-size:13px}.discovery-rec-copy{margin:12px 0;color:#2f3543;font-size:14px;line-height:1.55}.discovery-rec-naics{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}.discovery-rec-naics span{border:1px solid #e6e4e2;border-radius:999px;background:#fbf9f6;padding:4px 8px;color:#687084;font-size:11px}.discovery-rec-button{width:100%;border:0;border-radius:999px;background:#f52ea9;color:#fff;padding:10px 14px;font:600 13px ${BODY_FONT};cursor:pointer;box-shadow:0 8px 18px rgba(245,46,169,.18)}.discovery-rec-button:disabled{opacity:.65;cursor:wait}@media(max-width:600px){.discovery-recommendation-loading{margin-left:43px;padding:10px 12px}.discovery-recommendation-loading iframe{width:38px;height:38px}.discovery-loading-title{font-size:13px}.discovery-loading-copy{font-size:12px}.discovery-rec-grid{grid-template-columns:1fr;gap:10px}.discovery-card{padding:14px;border-radius:15px}.discovery-rec-title{font-size:16px}.discovery-rec-copy{font-size:13px}.discovery-rec-button{padding:9px 12px}}`}</style>
    <style>{`.discovery-support>div{margin:0!important;border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;color:#6e7380!important;font-size:13px!important} .discovery-support>div>button{border:0!important;background:transparent!important;padding:0!important;color:#182033!important;font-size:0!important;text-decoration:underline!important;box-shadow:none!important} .discovery-support>div>button:after{content:"Contact support";font:600 13px ${BODY_FONT}}@media(max-width:600px){.discovery-support>div{font-size:0!important} .discovery-support>div>button{width:34px!important;height:34px!important;display:inline-grid!important;place-items:center!important;border:1px solid #e6e4e2!important;border-radius:999px!important;background:#fff!important;padding:0!important;text-decoration:none!important} .discovery-support>div>button:after{content:"";width:17px;height:17px;background:#182033;display:block;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M19.1 4.9l-4.3 4.3M9.2 14.8l-4.3 4.3'/%3E%3C/svg%3E") center/contain no-repeat;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M19.1 4.9l-4.3 4.3M9.2 14.8l-4.3 4.3'/%3E%3C/svg%3E") center/contain no-repeat}}`}</style>
    <main className="discovery-main">
      <div className="discovery-thread">
        <div className="discovery-header">
          <div className="discovery-header-left">
            <img src="/brand/wda-favicon.png" alt="" className="discovery-avatar" />
            <div>
              <div className="discovery-advisor-title">Niche Advisor</div>
              <div className="discovery-advisor-subtitle">War Dogs Academy</div>
            </div>
            <div className="discovery-toolbar">
              <button type="button" className="discovery-toolbar-button" disabled={locked} onClick={startNewDiscovery}><Icon name="plus" /> New</button>
              <span className="discovery-current"><Icon name="message" /> Current</span>
              <a href={`/setup/${token}${updateMode ? '?update=1' : '?targeting=1'}`} className="discovery-toolbar-link"><Icon name="target" /> Build targeting</a>
              <span className="discovery-support">{supportCta}</span>
            </div>
          </div>
          <div className="discovery-header-right">
            <div className="discovery-progress" aria-hidden="true">{[1, 2, 3, 4].map((step) => <span key={step} className={step <= Math.ceil((progress / ADVISOR_TOTAL) * 4) ? 'is-done' : ''} />)}</div>
            <span className="discovery-progress-count">{recs.length ? 'Complete' : `${progress} of ${ADVISOR_TOTAL}`}</span>
          </div>
        </div>

        <div className="discovery-history" ref={historyRef} onScroll={updateScrollState}>
          {visibleMessages.map((message, index) => message.role === 'student' ? (
            <div key={index} className={`discovery-student ${editingIndex === index ? 'is-editing' : ''}`}>
              <div className="discovery-student-wrap">
                <div className="discovery-student-label">
                  <span><Icon name="message" /> {questionForMessage(index)}</span>
                  {!message.sending ? <button type="button" className="discovery-edit-answer" disabled={locked} onClick={() => editAnswer(index, message.content)}><Icon name="edit" /> Edit</button> : null}
                </div>
                <div className="discovery-student-bubble">{message.content}<div className="discovery-student-meta">{message.sending ? 'Sending...' : 'Saved ✓'}</div></div>
              </div>
            </div>
          ) : (
            <div key={index} className="discovery-assistant"><img src="/brand/wda-favicon.png" alt="" className="discovery-avatar" /><div className="discovery-assistant-body"><div className="discovery-copy">{message.content}</div></div></div>
          ))}
          {recs.length ? <div className="discovery-assistant discovery-recommendation-message">
            <img src="/brand/wda-favicon.png" alt="" className="discovery-avatar" />
            <div className="discovery-assistant-body discovery-recommendations">
              <div className="discovery-copy discovery-recommendation-intro">
                <div className="discovery-rec-eyebrow">Niche Advisor recommendation</div>
                I narrowed this to the strongest starting lanes for you. Pick the one that feels most honest to what you can actually deliver.
              </div>
              <div className="discovery-rec-grid">
                {recs.map((rec, index) => <article key={rec.subindustry_id} className="discovery-card">
                  <div className="discovery-rec-rank">#{index + 1}</div>
                  <div className="discovery-rec-title">{rec.subindustry_name}</div>
                  <div className="discovery-rec-industry">{rec.industry_name}</div>
                  <p className="discovery-rec-copy">{rec.explanation}</p>
                  <div className="discovery-rec-naics">{(rec.naics || []).map((code) => <span key={code.code}>NAICS {code.code} · {code.title}</span>)}</div>
                  <button type="button" disabled={applying !== -1} onClick={() => useThis(rec, index)} className="discovery-rec-button discovery-chip">{applying === index ? 'Loading it in...' : 'Use this niche'}</button>
                </article>)}
              </div>
            </div>
          </div> : null}
        </div>

        {showBackToBottom ? <button type="button" className="discovery-bottom-jump" onClick={() => scrollChatToBottom()}>↓ Latest</button> : null}
        {buildingRecommendations ? <div className="discovery-recommendation-loading" aria-live="polite">
          <iframe title="Building recommendations animation" src={THINKING_LOTTIE_URL}></iframe>
          <div>
            <div className="discovery-loading-title">Building your recommendations</div>
            <div className="discovery-loading-copy">I’m matching your answers against the War Dogs Playbook and checking the safest starting lanes.</div>
          </div>
        </div> : busy ? <div className="discovery-thinking" aria-live="polite" aria-label="Advisor is thinking"><iframe title="Advisor thinking animation" src={THINKING_LOTTIE_URL} /></div> : null}

        {(!recs.length || editingIndex != null) && pending ? <>
          <div className="discovery-assistant discovery-active-question">
            <img src="/brand/wda-favicon.png" alt="" className="discovery-avatar" />
            <div className="discovery-assistant-body">
              <div className="discovery-question-line">
                <span className="discovery-question">{pending.prompt}</span>
                {pending.helper ? <span className="discovery-helper">{pending.helper}</span> : null}
              </div>
            </div>
          </div>
          {showSuggestions ? <>
            <div className="discovery-suggestion-label">Suggestions, not limits</div>
            <div className="discovery-chips">{(pending.options || []).map((option) => <button key={option.value} type="button" disabled={locked} onClick={() => draftSuggestion(option.label)} className="discovery-chip">{icon(option.label)}{option.label}</button>)}</div>
          </> : null}
        </> : null}

        {drafting ? <div className="discovery-draft-loading" aria-live="polite">
          <div className="discovery-draft-animation"><iframe title="Generating suggested answer" src={DRAFT_LOTTIE_URL}></iframe></div>
          <span>Generating an answer you can review...</span>
        </div> : null}

        {!drafting && (pending || recs.length || buildingRecommendations) ? <form className="discovery-composer" onSubmit={(event) => { event.preventDefault(); if (((!recs.length && !buildingRecommendations) || editingIndex != null)) submit(); }}>
          <div className="discovery-composer-box">
            <span className="discovery-composer-leading"><Icon name="edit" /></span>
            <textarea ref={textareaRef} rows={1} aria-label="Your answer" value={draft} maxLength={900} onChange={resizeComposer} onKeyDown={sendWithKey} disabled={(recs.length > 0 || buildingRecommendations) && editingIndex == null} placeholder={buildingRecommendations ? 'Building your recommendations...' : recs.length > 0 && editingIndex == null ? 'Recommendations are ready. Edit an earlier answer to change them.' : drafting ? 'Writing a draft you can edit...' : pending?.placeholder || 'Tell the Niche Advisor your answer...'} />
            <button type="submit" aria-label="Send answer" disabled={locked || ((recs.length > 0 || buildingRecommendations) && editingIndex == null) || !draft.trim()}><Icon name="send" /></button>
          </div>
          <div className="discovery-composer-help">Enter to send &nbsp;•&nbsp; Shift+Enter for a new line</div>
        </form> : null}

        {error ? <div aria-live="polite" className="discovery-error">{error}</div> : null}
        <div ref={endRef} />
      </div>
    </main>
  </div>;
}
