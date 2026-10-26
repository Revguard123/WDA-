'use client';

import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';
import Modal from './Modal.jsx';
import { UI, DISPLAY_FONT, BODY_FONT } from '../../lib/ui.js';
import { buyerPagePath } from '../../lib/buyerUrls.js';
import { setAtmosphereThinking } from '../../lib/ambientMotion.js';

const emptyState = { messages: [], pending_question: null, turn_count: 0, complete: false };

const iconPaths = {
  award: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12.5-1.5 8 5-3 5 3-1.5-8" /></>,
  briefcase: <><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" /><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 12h18" /></>,
  building: <><path d="M4 21V5a2 2 0 0 1 2-2h8v18" /><path d="M14 9h4a2 2 0 0 1 2 2v10" /><path d="M8 7h2M8 11h2M8 15h2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  circle: <circle cx="12" cy="12" r="7" />,
  dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
  edit: <><path d="M9 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" /><path d="m8 16 1-4 9-9a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-9 9-4 1Z" /><path d="m16 5 3 3" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>,
  hammer: <><path d="m15 12-8 8-3-3 8-8" /><path d="m14 4 6 6" /><path d="m11 7 3-3 6 6-3 3" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.5 9a2.8 2.8 0 0 1 5 1.7c0 2-2.5 2-2.5 4" /><path d="M12 18h.01" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /></>,
  map: <><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  message: <><path d="M14.2 4.2A7.5 7.5 0 0 0 3.7 14L2.4 18l4.1-1.5" /><path d="M21.5 12.5a7.5 7.5 0 1 0-4.4 6.8L22 21l-1.6-4.9a7.5 7.5 0 0 0 1.1-3.6Z" /><circle cx="11" cy="12.5" r=".65" fill="currentColor" stroke="none" /><circle cx="14" cy="12.5" r=".65" fill="currentColor" stroke="none" /><circle cx="17" cy="12.5" r=".65" fill="currentColor" stroke="none" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  package: <><path d="m21 8-9-5-9 5 9 5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  send: <><path d="M5 10l7-7m0 0l7 7m-7-7v18" /></>,
  arrowRight: <><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  target: <><path d="M12.2 19.3a9 9 0 1 1 7.1-7.1" /><path d="M10.7 16.1a5.6 5.6 0 1 1 5.4-5.4" /><path d="M9.7 12.9a2.5 2.5 0 1 1 3.2-3.2" /><path d="m11 11 3.2 10.3 2.1-3.1 3.2 3.2 2-2-3.2-3.2 3.1-2.1L11 11Z" /></>,
  truck: <><path d="M10 17H5V6h11v11h-2" /><path d="M16 9h3l3 4v4h-3" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  bell: <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />,
  mic: <><path d="M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 0 1-3-3V5a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3z" /></>,
  library: <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" />,
  tools: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  settings: <><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  copy: <><rect x="3" y="8" width="13" height="13" rx="3.5" /><path d="M8 8V6.5A3.5 3.5 0 0 1 11.5 3h6A3.5 3.5 0 0 1 21 6.5v6a3.5 3.5 0 0 1-3.5 3.5H16" /></>,
  speaker: <><path d="M7.5 8.5H3v7h4.5" /><path d="m7.5 8.5 5.1-4.2c1-.8 2.4-.1 2.4 1.2v13c0 1.3-1.4 2-2.4 1.2l-5.1-4.2Z" /><path d="M18 8.5a5 5 0 0 1 0 7M20 4.8a10.5 10.5 0 0 1 0 14.4" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  x: <path d="M18 6 6 18M6 6l12 12" />
};

function initialAdvisorState(session) { return session?.answers?.advisor_state || emptyState; }

// Voice quality has no standard Web Speech metadata. Prefer provider quality
// labels, then familiar English voices, without assuming any are installed.
export function selectTtsVoice(voices = []) {
  const english = Array.isArray(voices) ? voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice?.lang || '')) : [];
  const score = (voice) => {
    const label = `${voice.name || ''} ${voice.voiceURI || ''}`;
    let quality = /\b(natural|neural|premium)\b/i.test(label) ? 400
      : /\benhanced\b/i.test(label) ? 350
      : /^google\b/i.test(voice.name || '') ? 300
      : /\b(samantha|alex|daniel)\b/i.test(voice.name || '') ? 200 : 100;
    if (/\b(compact|espeak)\b/i.test(label)) quality -= 150;
    return quality + (/^en[-_]US$/i.test(voice.lang) ? 30 : 0) + (voice.default ? 10 : 0);
  };
  return english.reduce((best, voice) => !best || score(voice) > score(best) ? voice : best, null);
}

export function useMessageActions() {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const speechRef = useRef(null);
  const voicesRef = useRef([]);
  const copyTimer = useRef(null);
  const copyVersion = useRef(0);

  function stopReading() {
    const active = speechRef.current;
    speechRef.current = null;
    if (active) { try { active.engine.cancel(); } catch {} }
    setSpeakingIndex(null);
  }

  function reset() {
    copyVersion.current += 1;
    clearTimeout(copyTimer.current);
    setCopiedIndex(null);
    setFeedback(null);
    stopReading();
  }

  useEffect(() => {
    setSpeechAvailable(typeof window !== 'undefined' && typeof window.speechSynthesis?.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function');
    const engine = typeof window !== 'undefined' ? window.speechSynthesis : null;
    const refreshVoices = () => {
      try { voicesRef.current = engine?.getVoices?.() || []; } catch {}
    };
    refreshVoices();
    engine?.addEventListener?.('voiceschanged', refreshVoices);
    return () => {
      engine?.removeEventListener?.('voiceschanged', refreshVoices);
      copyVersion.current += 1;
      clearTimeout(copyTimer.current);
      const active = speechRef.current;
      speechRef.current = null;
      if (active) { try { active.engine.cancel(); } catch {} }
    };
  }, []);

  async function copy(index, text) {
    const version = ++copyVersion.current;
    clearTimeout(copyTimer.current);
    setCopiedIndex(null);
    setFeedback(null);
    try {
      await navigator.clipboard.writeText(text);
      if (copyVersion.current !== version) return;
      setCopiedIndex(index);
      setFeedback({ index, text: 'Message copied.' });
      copyTimer.current = setTimeout(() => { setCopiedIndex(null); setFeedback(null); }, 1800);
    } catch {
      if (copyVersion.current === version) setFeedback({ index, text: 'Could not copy. Select the message text and copy it manually.', error: true });
    }
  }

  function read(index, text) {
    const wasReading = speechRef.current?.index === index;
    stopReading();
    setFeedback(null);
    if (wasReading) return;
    if (!speechAvailable || !text.trim()) return;
    try {
      const engine = window.speechSynthesis;
      const utterance = new window.SpeechSynthesisUtterance(text);
      let voices = voicesRef.current;
      try { voices = engine.getVoices?.() || voices; } catch {}
      const voice = selectTtsVoice(voices);
      if (voice) utterance.voice = voice;
      utterance.lang = voice ? voice.lang.replace(/_/g, '-') : 'en-US';
      utterance.rate = .98;
      utterance.pitch = 1;
      const active = { index, engine, utterance };
      speechRef.current = active;
      const finish = () => {
        if (speechRef.current !== active) return;
        speechRef.current = null;
        setSpeakingIndex(null);
      };
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (speechRef.current !== active) return;
        finish();
        if (!['canceled', 'interrupted'].includes(event.error)) setFeedback({ index, text: 'Read aloud is unavailable right now. Please try again.', error: true });
      };
      engine.cancel();
      setSpeakingIndex(index);
      engine.speak(utterance);
    } catch {
      stopReading();
      setFeedback({ index, text: 'Read aloud is unavailable right now. Please try again.', error: true });
    }
  }

  return { copy, read, reset, copiedIndex, speakingIndex, speechAvailable, feedback };
}

export function MessageActions({ index, text, actions, onEdit, editDisabled = false }) {
  if (!String(text || '').trim()) return null;
  const copied = actions.copiedIndex === index;
  const speaking = actions.speakingIndex === index;
  const feedback = actions.feedback?.index === index ? actions.feedback : null;
  const readLabel = speaking ? 'Stop reading' : 'Read aloud';
  return <div className="wda-message-tools" onClick={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
    <div className="wda-message-actions" role="group" aria-label="Message actions">
      {onEdit ? <button data-liquid="" type="button" className="wda-message-action" onClick={() => onEdit(index, text)}
        disabled={editDisabled} aria-label="Edit answer" title="Edit answer">
        <Icon name="edit" />
      </button> : null}
      <button data-liquid="" type="button" className="wda-message-action" onClick={() => actions.copy(index, text)}
        aria-label={copied ? 'Message copied' : 'Copy message'} title={copied ? 'Copied' : 'Copy message'}>
        <Icon name={copied ? 'check' : 'copy'} />
      </button>
      <button data-liquid="" type="button" className="wda-message-action" onClick={() => actions.read(index, text)}
        disabled={!actions.speechAvailable} aria-pressed={speaking} aria-label={actions.speechAvailable ? readLabel : 'Read aloud is not supported by this browser'}
        title={actions.speechAvailable ? readLabel : 'Read aloud is not supported by this browser'}>
        <Icon name={speaking ? 'stop' : 'speaker'} />
      </button>
    </div>
    {feedback ? <span className={feedback.error ? 'wda-message-action-error' : 'wda-message-action-status'} role="status" aria-live="polite">{feedback.text}</span> : null}
  </div>;
}
function isGenericAdvisorRow(message) { return message?.role === 'advisor' && String(message.content || '').includes('keep this practical and narrow the next useful point'); }

function getAdvisorMessageText(message, pendingQuestion, isLatest) {
  const content = String(message?.content || '').trim();
  const q = message?.question || (isLatest ? pendingQuestion : null);
  const prompt = String(q?.prompt || '').trim();
  if (!prompt) return content;
  if (!content) return prompt;

  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const normContent = normalize(content);
  const normPrompt = normalize(prompt);

  if (normContent.includes(normPrompt)) return content;
  if (normPrompt.includes(normContent)) return prompt;

  const separator = /[.!?]$/.test(content) ? ' ' : '. ';
  return `${content}${separator}${prompt}`;
}

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

function initialRecommendationStatus(session) {
  const saved = session?.recommendations;
  if (Array.isArray(saved)) {
    if (saved.length > 0) return 'ready';
    return session?.answers?.advisor_state?.complete ? 'retry' : 'idle';
  }
  if (saved?.status === 'no_recommendation') return 'no_recommendation';
  if (saved?.status === 'needs_clarification') return 'needs_clarification';
  return session?.answers?.advisor_state?.complete ? 'retry' : 'idle';
}

function initialRecommendationMessage(session) {
  const saved = session?.recommendations;
  if (!Array.isArray(saved) && saved?.status === 'no_recommendation') {
    return String(saved.message || '').trim();
  }
  return '';
}

function Icon({ name }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="discovery-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name] || iconPaths.help}
    </svg>
  );
}

export function AnswerStarters({ options = [], onDraft, disabled = false, draftingLabel = null }) {
  return (
    <section className="wda-suggestion-wrap" aria-label="Answer starters">
      <div className="wda-suggestion-label">
        <span>A starting point, if you need one</span>
        <span>You can always write your own</span>
      </div>
      <div className="wda-suggestion-list">
        {options.map((option, index) => {
          const label = option.label || option.value;
          const isDrafting = draftingLabel === label;
          return (
            <button data-liquid="" className={`wda-suggestion${isDrafting ? ' is-drafting' : ''}`} type="button"
              key={option.value || option.label || index} disabled={disabled || draftingLabel != null}
              aria-busy={isDrafting} style={{ '--starter-order': Math.min(index, 5) }}
              onClick={() => onDraft(label)}>
              <span className="wda-starter-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="wda-starter-label">{label}</span>
              <span className="wda-starter-action" aria-hidden="true">
                {isDrafting ? <span className="wda-state-spinner" /> : <Icon name="arrowRight" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="wda-starter-note" role="status">
        {draftingLabel != null ? 'Preparing your answer. You can edit it before sending.' : 'We’ll put it into words. Review and edit before you send.'}
      </p>
    </section>
  );
}

export function RecommendationLoading() {
  return (
    <section className="wda-shimmer-wrap" aria-label="Preparing recommendations">
      <div className="wda-loading-heading" role="status" aria-live="polite">
        <span className="wda-loading-mark" aria-hidden="true"><span className="wda-state-spinner" /></span>
        <div>
          <h2>Preparing your shortlist</h2>
          <p>A focused set of niches, built around your answers.</p>
        </div>
      </div>
      <div className="wda-skeleton-carousel-wrap">
        <div className="wda-skeleton-grid" aria-hidden="true">
          {[0, 1, 2].map((card) => (
            <div className="wda-skeleton-card" key={card} style={{ '--skeleton-order': card }}>
              <div className="wda-skeleton-content">
                <div className="wda-skeleton-badge" />
                <div className="wda-skeleton-title" />
                <div className="wda-skeleton-industry" />
                <div className="wda-skeleton-lines">
                  <div className="wda-skeleton-line" />
                  <div className="wda-skeleton-line" />
                  <div className="wda-skeleton-line short" />
                </div>
                <div className="wda-skeleton-tags"><span /><span /></div>
              </div>
              <div className="wda-skeleton-footer"><div className="wda-skeleton-btn" /></div>
            </div>
          ))}
        </div>
        <div className="wda-rec-fade-right" aria-hidden="true" />
      </div>
      <p className="wda-loading-note">You’ll be able to review each niche before choosing.</p>
    </section>
  );
}

function Typewriter({
  text = '',
  enabled = true,
  speed = 14,
  punctuationPause = 75,
  onComplete,
  onTick,
  className = '',
  as = 'div',
  skip = false
}) {
  const [length, setLength] = useState(() => (enabled && !skip ? 0 : text.length));
  const isTyping = enabled && !skip && length < text.length;

  useEffect(() => {
    if (skip || !enabled) {
      setLength(text.length);
      onComplete?.();
      return;
    }
    if (length >= text.length) {
      onComplete?.();
      return;
    }

    const currentChar = text[length];
    const isPunctuation = ['.', ',', '?', '!', ':', ';'].includes(currentChar);
    const delay = isPunctuation ? punctuationPause : speed;

    const timer = setTimeout(() => {
      setLength((prev) => {
        const increment = text.length > 250 ? 3 : text.length > 120 ? 2 : 1;
        const next = Math.min(prev + increment, text.length);
        onTick?.();
        if (next >= text.length) {
          onComplete?.();
        }
        return next;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [length, text, enabled, skip, speed, punctuationPause]);

  useEffect(() => {
    if (enabled && !skip) {
      setLength(0);
    } else {
      setLength(text.length);
    }
  }, [text, enabled, skip]);

  const Tag = as;
  const displayed = isTyping ? text.slice(0, length) : text;

  return (
    <Tag className={className}>
      {displayed}
      {isTyping ? <span className="wda-typing-cursor" aria-hidden="true" /> : null}
    </Tag>
  );
}

export default function DiscoveryForm({ token, initialSession = null, supportCta = null, updateMode = false, initial = null, supportEmail = '', embedded = false }) {
  const [state, setState] = useState(() => initialAdvisorState(initialSession));
  const [answers, setAnswers] = useState(initialSession?.answers || {});
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('chat');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [recs, setRecs] = useState(Array.isArray(initialSession?.recommendations) ? initialSession.recommendations : []);
  const [recommendationStatus, setRecommendationStatus] = useState(() => initialRecommendationStatus(initialSession));
  const [recommendationMessage, setRecommendationMessage] = useState(() => initialRecommendationMessage(initialSession));
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [applying, setApplying] = useState(-1);
  const [showBackToBottom, setShowBackToBottom] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const messageActions = useMessageActions();
  const [isResetting, setIsResetting] = useState(false);
  const [skipTyping, setSkipTyping] = useState(false);
  const [isAdvisorTyping, setIsAdvisorTyping] = useState(false);
  const [draftingSuggestion, setDraftingSuggestion] = useState(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const animatedMessagesRef = useRef(new Set());
  const initialHistoryCountRef = useRef(initialAdvisorState(initialSession).messages?.length || 0);

  const historyRef = useRef(null);
  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const bootstrapped = useRef(false);
  const stuckToBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const discoveryRef = useRef(null);

  const busy = status === 'thinking';
  const drafting = status === 'drafting';
  const rewinding = status === 'rewinding';
  const locked = busy || drafting || rewinding;
  const buildingRecommendations = busy && state.complete && !recs.length;
  const thinking = locked || isAdvisorTyping || recommendationStatus === 'building' || isResetting;
  const messages = state.messages || [];
  const latestStudent = [...messages].reverse().find((message) => message.role === 'student');
  const pendingOptimisticMessages = optimisticMessages.filter((message) => !(message.role === 'student' && messages.length > message.afterMessageCount && latestStudent?.content === message.content));
  const visibleMessages = [...messages, ...pendingOptimisticMessages]
    .map((message, originalIndex) => ({ ...message, originalIndex }))
    .filter((message) => !isGenericAdvisorRow(message));
  const pending = state.pending_question;
  const canRetryRecommendations = state.complete && !pending && !recs.length && !locked && (recommendationStatus === 'idle' || recommendationStatus === 'retry' || recommendationStatus === 'failed');


  function scrollChatToBottom(behavior = 'smooth') {
    const el = historyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion ? 'auto' : behavior });
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
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const atmosphere = discoveryRef.current?.closest('.wda-setup-main')?.querySelector('.wda-workspace-atmosphere');
    return setAtmosphereThinking(atmosphere, thinking, {
      reducedMotion: prefersReducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  }, [thinking, prefersReducedMotion]);

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
    if (locked || !pending || recs.length || (draft.trim() && editingIndex == null) || isAdvisorTyping) {
      setShowSuggestions(false);
      return undefined;
    }
    setShowSuggestions(true);
  }, [locked, pending?.id, pending?.prompt, recs.length, draft, isAdvisorTyping, editingIndex]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowAnswers(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function openNewChatModal() {
    if (locked || isResetting) return;
    if (answerHistory.length === 0) {
      startNewDiscovery();
      return;
    }
    setShowNewChatModal(true);
  }

  useEffect(() => {
    if (skipTyping || prefersReducedMotion) {
      setIsAdvisorTyping(false);
      return;
    }
    const latestAdvisor = [...visibleMessages].reverse().find((m) => m.role === 'advisor');
    if (!latestAdvisor) return;
    const idx = latestAdvisor.originalIndex ?? (visibleMessages.length - 1);
    if (idx >= initialHistoryCountRef.current && !animatedMessagesRef.current.has(idx)) {
      setIsAdvisorTyping(true);
    }
  }, [visibleMessages.length, skipTyping, prefersReducedMotion]);

  function shouldAnimateAdvisor(sourceIndex, visualIndex) {
    if (skipTyping || prefersReducedMotion) return false;
    const isLatest = visualIndex === visibleMessages.length - 1;
    if (!isLatest) return false;
    if (sourceIndex < initialHistoryCountRef.current) return false;
    if (animatedMessagesRef.current.has(sourceIndex)) return false;
    return true;
  }

  async function callConversation(body) {
    const response = await fetch(`/api/discover/${token}/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await readJsonResponse(response, 'Could not continue this conversation.');
    if (!response.ok) throw new Error(data.error || 'Could not continue this conversation.');
    setState(data.advisor_state);
    setAnswers(data.answers);
    return data;
  }

  async function startNewDiscovery() {
    if (locked || isResetting) return;
    messageActions.reset();
    setIsResetting(true);
    setShowNewChatModal(false);
    setMode('chat');
    setDraft('');
    setError('');
    setRecs([]);
    setRecommendationStatus('idle');
    setRecommendationMessage('');
    setOptimisticMessages([]);
    setEditingIndex(null);
    initialHistoryCountRef.current = 0;
    animatedMessagesRef.current.clear();
    setSkipTyping(false);
    setIsAdvisorTyping(false);
    stuckToBottom.current = true;
    didInitialScroll.current = false;
    setShowBackToBottom(false);
    setAnswers({});
    setState(emptyState);
    bootstrapped.current = true;
    setStatus('thinking');
    try {
      const response = await fetch(`/api/discover/${token}/session`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: { advisor_state: emptyState },
          current_step: 1,
          status: 'in_progress',
          recommendations: [],
          selected_recommendation: null,
        }),
      });
      const data = await readJsonResponse(response, 'Could not start a new discovery.');
      if (!response.ok) throw new Error(data.error || 'Could not start a new discovery.');
      await callConversation({ start: true, reset: true });
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (err) {
      setError(customerSafeError(err, 'Could not start a new discovery.'));
    } finally {
      setStatus('idle');
      setIsResetting(false);
    }
  }

  async function submit(value = draft) {
    const answer = String(value || '').trim();
    if (!answer || locked) return;

    if (editingIndex != null) {
      setShowSuggestions(false);
      setStatus('thinking');
      setError('');
      let recommendationStarted = false;
      try {
        const data = await callConversation({
          edit_answer: true,
          message_index: editingIndex,
          answer,
        });
        setRecs([]);
        setDraft('');
        setEditingIndex(null);

        if (!data.complete) {
          setRecommendationStatus('idle');
          setRecommendationMessage('');
          return;
        }

        recommendationStarted = true;
        setRecommendationStatus('building');
        setRecommendationMessage('');
        const response = await fetch(`/api/discover/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: data.answers, clarification_round: 0 }),
        });
        const result = await readJsonResponse(response, 'Could not refresh recommendations.');
        if (!response.ok) throw new Error(result.error || 'Could not refresh recommendations.');

        if (result.status === 'needs_clarification' && result.questions?.[0]) {
          const question = result.questions[0];
          setRecommendationStatus('needs_clarification');
          setRecommendationMessage('');
          setState({
            ...data.advisor_state,
            complete: false,
            pending_question: {
              category: 'naics_clarification',
              prompt: question.prompt,
              input_type: 'single_choice',
              options: question.options || [],
              adaptive_key: question.key,
            },
          });
          return;
        }

        if (result.status === 'no_recommendation') {
          setRecs([]);
          setRecommendationStatus('no_recommendation');
          setRecommendationMessage(result.message || 'We could not safely resolve a recommendation from those answers yet.');
          setState({ ...data.advisor_state, complete: true, pending_question: null });
          return;
        }

        if (result.status === 'recommended') {
          const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
          if (!recommendations.length) throw new Error('Could not prepare recommendations.');
          setRecs(recommendations);
          setRecommendationStatus('ready');
          setRecommendationMessage('');
          setState({ ...data.advisor_state, complete: true, pending_question: null });
          return;
        }

        throw new Error('Could not refresh recommendations.');
      } catch (err) {
        if (recommendationStarted) {
          setRecommendationStatus('retry');
          setError(customerSafeError(err, 'Could not prepare your recommendations right now. Your Discovery answers are saved.'));
        } else {
          setError(customerSafeError(err, 'Could not update that answer right now.'));
        }
      } finally {
        setStatus('idle');
      }
      return;
    }

    stuckToBottom.current = true;
    setShowSuggestions(false);
    setOptimisticMessages([{
      role: 'student',
      content: answer,
      sending: true,
      afterMessageCount: messages.length,
    }]);
    setDraft('');
    setEditingIndex(null);
    setStatus('thinking');
    setError('');

    let succeeded = false;
    let recommendationStarted = false;

    try {
      if (pending?.adaptive_key) {
        const nextAnswers = {
          ...answers,
          adaptive_answers: {
            ...(answers.adaptive_answers || {}),
            [pending.adaptive_key]: answer,
          },
        };
        recommendationStarted = true;
        setRecommendationStatus('building');
        setRecommendationMessage('');
        const response = await fetch(`/api/discover/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: nextAnswers, clarification_round: 1 }),
        });
        const result = await readJsonResponse(response, 'Could not prepare recommendations.');
        if (!response.ok) throw new Error(result.error || 'Could not prepare recommendations.');
        setAnswers(nextAnswers);

        if (result.status === 'needs_clarification' && result.questions?.[0]) {
          const question = result.questions[0];
          setRecommendationStatus('needs_clarification');
          setRecommendationMessage('');
          setState((current) => ({
            ...current,
            complete: false,
            pending_question: {
              category: 'naics_clarification',
              prompt: question.prompt,
              input_type: 'single_choice',
              options: question.options || [],
              adaptive_key: question.key,
            },
          }));
          succeeded = true;
          return;
        }

        if (result.status === 'no_recommendation') {
          setRecs([]);
          setRecommendationStatus('no_recommendation');
          setRecommendationMessage(result.message || 'We could not safely resolve a recommendation from those answers yet.');
          setState((current) => ({ ...current, complete: true, pending_question: null }));
          succeeded = true;
          return;
        }

        if (result.status === 'recommended') {
          const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
          if (!recommendations.length) throw new Error('Could not prepare recommendations.');
          setRecs(recommendations);
          setRecommendationStatus('ready');
          setRecommendationMessage('');
          setState((current) => ({ ...current, complete: true, pending_question: null }));
          succeeded = true;
          return;
        }
        throw new Error('Could not prepare recommendations.');
      }

      const data = await callConversation({
        answer,
        question_id: pending?.id,
        question_category: pending?.category,
      });

      if (!data.complete) {
        return;
      }

      recommendationStarted = true;
      setRecommendationStatus('building');
      setRecommendationMessage('');
      const response = await fetch(`/api/discover/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: data.answers, clarification_round: 0 }),
      });
      const result = await readJsonResponse(response, 'Could not prepare recommendations.');
      if (!response.ok) throw new Error(result.error || 'Could not prepare recommendations.');

      if (result.status === 'needs_clarification' && result.questions?.[0]) {
        const question = result.questions[0];
        setRecommendationStatus('needs_clarification');
        setRecommendationMessage('');
        setState({
          ...data.advisor_state,
          complete: false,
          pending_question: {
            category: 'naics_clarification',
            prompt: question.prompt,
            input_type: 'single_choice',
            options: question.options || [],
            adaptive_key: question.key,
          },
        });
        succeeded = true;
        return;
      }

      if (result.status === 'no_recommendation') {
        setRecs([]);
        setRecommendationStatus('no_recommendation');
        setRecommendationMessage(result.message || 'We could not safely resolve a recommendation from those answers yet.');
        setState({ ...data.advisor_state, complete: true, pending_question: null });
        succeeded = true;
        return;
      }

      if (result.status === 'recommended') {
        const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
        if (!recommendations.length) throw new Error('Could not prepare recommendations.');
        setRecs(recommendations);
        setRecommendationStatus('ready');
        setRecommendationMessage('');
        setState({ ...data.advisor_state, complete: true, pending_question: null });
        succeeded = true;
        return;
      }

      throw new Error('Could not prepare recommendations.');
    } catch (err) {
      setOptimisticMessages([]);
      if (recommendationStarted) {
        setRecommendationStatus('retry');
        setError(customerSafeError(err, 'Could not prepare your recommendations right now. Your Discovery answers are saved.'));
      } else {
        setError(customerSafeError(err, 'Could not continue right now. Your previous answers are saved.'));
      }
    } finally {
      if (succeeded) {
        setOptimisticMessages([]);
        setEditingIndex(null);
      }
      setStatus('idle');
    }
  }

  async function retryRecommendations() {
    if (locked || recs.length || !state.complete || pending) return;
    setStatus('thinking');
    setError('');
    setRecommendationStatus('building');
    setRecommendationMessage('');
    try {
      const response = await fetch(`/api/discover/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          clarification_round: Object.keys(answers?.adaptive_answers || {}).length,
          retry: true,
        }),
      });
      const result = await readJsonResponse(response, 'Could not prepare recommendations.');
      if (!response.ok) throw new Error(result.error || 'Could not prepare recommendations.');

      if (result.status === 'needs_clarification' && result.questions?.[0]) {
        const question = result.questions[0];
        setRecommendationStatus('needs_clarification');
        setState((current) => ({
          ...current,
          complete: false,
          pending_question: {
            category: 'naics_clarification',
            prompt: question.prompt,
            input_type: 'single_choice',
            options: question.options || [],
            adaptive_key: question.key,
          },
        }));
        return;
      }

      if (result.status === 'recommended') {
        const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
        setRecs(recommendations);
        setRecommendationStatus(recommendations.length ? 'ready' : 'retry');
        setRecommendationMessage('');
        setState((current) => ({ ...current, complete: true, pending_question: null }));
        return;
      }

      if (result.status === 'no_recommendation') {
        setRecs([]);
        setRecommendationStatus('no_recommendation');
        setRecommendationMessage(result.message || 'We could not safely resolve a recommendation from those answers yet.');
        setState((current) => ({ ...current, complete: true, pending_question: null }));
        return;
      }

      throw new Error('Could not prepare recommendations.');
    } catch (err) {
      setRecommendationStatus('retry');
      setError(customerSafeError(err, 'Could not prepare your recommendations right now. Your Discovery answers are saved.'));
    } finally {
      setStatus('idle');
    }
  }

  async function editAnswer(index, content) {
    if (locked) return;
    messageActions.reset();
    setStatus('rewinding');
    setShowSuggestions(false);
    setError('');
    try {
      const response = await fetch(`/api/discover/${token}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_answer: true, message_index: index })
      });
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
    setDraftingSuggestion(label);
    setStatus('drafting');
    setError('');
    try {
      const response = await fetch(`/api/discover/${token}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_suggestion: true,
          suggestion: label,
          current_question: { category: pending.category, prompt: pending.prompt, helper: pending.helper }
        })
      });
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
      setDraftingSuggestion(null);
      setStatus('idle');
    }
  }

  async function useThis(rec, index) {
    setApplying(index);
    try {
      const response = await fetch(`/api/discover/${token}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subindustry_id: rec.subindustry_id })
      });
      if (!response.ok) throw new Error();
      window.location.href = `${buyerPagePath('setup', token)}${updateMode ? '?update=1' : ''}`;
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
    return [...messages.slice(0, index)].reverse().find((message) => message.role === 'advisor' && message.question?.prompt)?.question?.prompt || 'Your answer';
  }

  const answerHistory = messages
    .map((message, originalIndex) => ({ ...message, originalIndex }))
    .filter((message) => message.role === 'student');
  const statusLabel = buildingRecommendations || recommendationStatus === 'building'
    ? 'Preparing recommendations'
    : locked ? 'Working on your request' : recs.length ? 'Recommendations ready' : 'In progress';

  function confirmRestart() {
    openNewChatModal();
  }

  const Conversation = embedded ? 'section' : 'main';
  return (
    <div ref={discoveryRef} className={`wda-discovery-app${embedded ? ' is-embedded' : ''}`} data-thinking={thinking || undefined}>
      <style>{`
        .wda-discovery-app, .wda-discovery-app * { box-sizing: border-box; }
        .wda-discovery-app {
          --wda-paper:#FDFBF9; --wda-cream:#F6F1EB; --wda-white:#FFFFFF;
          --wda-ink:#19191B; --wda-muted:#77726E; --wda-line:#E8E2DB;
          --wda-pink:${UI.pinkDeep}; --wda-pink-soft:#FFF0F6;
          width:100%; height:100%; min-width:0; min-height:0; overflow:hidden;
          display:flex; flex-direction:column; color:var(--wda-ink);
          background:var(--wda-paper); font-family:${BODY_FONT};
          --wda-ease: cubic-bezier(.22, 1, .36, 1);
          --wda-liquid-ease: cubic-bezier(.2, .9, .25, 1.35);
          -webkit-font-smoothing:antialiased;
        }
        .wda-discovery-app button, .wda-discovery-app textarea { font-family:inherit; }
        .wda-discovery-app h1, .wda-discovery-app h2, .wda-discovery-app h3,
        .wda-discovery-app h4, .wda-discovery-app h5, .wda-discovery-app h6,
        .wda-chat-name, .wda-status-heading, .wda-side-status strong {
          font-family: ${DISPLAY_FONT};
          font-synthesis: none;
          font-weight: 700;
          letter-spacing: .02em;
        }
        .wda-support-strip { flex:0 0 auto; width:100%; min-width:0; position:relative;
          z-index:5; border-bottom:1px solid var(--wda-line); background:#FBF8F4; }
        .wda-support-strip:empty { display:none; }
        .wda-mobile-topbar {
          display: none; height: 56px; padding: 0 18px;
          background: var(--wda-white); border-bottom: 1px solid var(--wda-line);
          align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .wda-mobile-brand { display: flex; align-items: center; gap: 10px; }
        .wda-mobile-logo { height: 26px; width: auto; object-fit: contain; }
        .wda-mobile-nav { display: flex; align-items: center; gap: 8px; }
        .wda-mobile-nav-item, .wda-mobile-new-btn {
          width: 36px; height: 36px; border-radius: 9px;
          border: 1px solid var(--wda-line); background: var(--wda-white);
          color: #55504C; display: grid; place-items: center;
          cursor: pointer; text-decoration: none; transition: all .15s ease;
        }
        .wda-mobile-nav-item:hover, .wda-mobile-new-btn:hover {
          border-color: var(--wda-pink); color: var(--wda-pink); background: var(--wda-pink-soft);
        }
        .wda-mobile-nav-item.active {
          background: var(--wda-pink-soft); color: var(--wda-pink); border-color: #F4C4DE;
        }
        .wda-mobile-new-btn {
          background: var(--wda-pink); color: #fff; border-color: var(--wda-pink);
        }
        .wda-mobile-new-btn:hover { background: #AF0D6D; color: #fff; }
        .wda-rail-link:focus-visible, .wda-primary-action:focus-visible, .wda-suggestion:focus-visible,
        .wda-composer button:focus-visible { outline: 2px solid var(--wda-pink); outline-offset: 3px; }
        .wda-discovery-layout { position: relative; display: grid; grid-template-columns: 80px minmax(0,1fr);
          flex: 1 1 auto; min-height: 0; min-width: 0; }
        .wda-rail { border-right: 1px solid var(--wda-line); padding: 20px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 14px; background: var(--wda-white); }
        .wda-rail-brand { width: 44px; height: 44px; display: grid; place-items: center; margin-bottom: 6px; border-radius: 10px; }
        .wda-rail-logo { width: 32px; height: 32px; object-fit: contain; }
        .wda-rail-link { width: 62px; min-height: 58px; padding: 7px 2px; border-radius: 12px;
          border: 0; background: transparent; color: #66605C; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          font-size: 10.5px; font-weight: 600; text-align: center; text-decoration: none; }
        .wda-rail-link .discovery-icon { width: 19px; height: 19px; }
        .wda-rail-link:hover { background: var(--wda-pink-soft); color: var(--wda-pink); }
        .wda-rail-link.active { color: var(--wda-pink); background: var(--wda-pink-soft); }
        .wda-conversation { position: relative; display: flex; flex-direction: column;
          min-width: 0; min-height: 0; overflow: hidden;
          background: radial-gradient(ellipse at 50% 0%, #F8F0EA 0%, transparent 55%), var(--wda-paper); }
        .wda-chat-topline { height: 61px; flex: 0 0 auto; padding: 0 34px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          border-bottom: 1px solid rgba(232,226,219,.6); }
        .wda-advisor-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .wda-chat-caption { display: block; margin-top: 2px; color: #746D66; font-size: 11px; }
        .wda-chat-name { font-family: ${DISPLAY_FONT}; font-size: 20px; font-weight: 700; letter-spacing: .025em; color: var(--wda-pink); }
        .wda-chat-tools { display: flex; align-items: center; gap: 12px; }
        .wda-chat-tool { display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 40px; border: 0; border-radius: 10px; background: transparent;
          padding: 8px 10px; color: #59534E; font-size: 12px; cursor: pointer;
          transition: background .18s ease, color .18s ease, transform .18s var(--wda-ease); }
        .wda-chat-tool:active:not(:disabled) { transform: scale(.94); }
        .wda-chat-tool:hover, .wda-chat-tool[aria-expanded="true"] { background: var(--wda-pink-soft); color: var(--wda-pink); }
        .wda-chat-tool:disabled { opacity: .5; cursor: not-allowed; }
        .wda-chat-tool:focus-visible, .wda-side-new-btn:focus-visible, .wda-answer-row:focus-visible,
        .wda-complete-note button:focus-visible { outline: 2px solid var(--wda-pink); outline-offset: 3px; }
        .wda-session-status { display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; color: #716D67; white-space: nowrap; }
        .wda-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #2D946C; }
        .wda-chat-history { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
          padding: 24px 34px 18px; scrollbar-gutter: stable; }
        .wda-thread { width: 100%; max-width: 780px; margin: 0 auto; padding: 0 4px 12px; display: flex; flex-direction: column; gap: 24px; }
        .wda-welcome { padding: 28px 4px 20px; text-align: left; max-width: 100%; width: 100%; }
        .wda-welcome-kicker { display: block; font-size: 12px; letter-spacing: .15em; font-weight: 700;
          color: var(--wda-pink); text-transform: uppercase; margin-bottom: 12px; }
        .wda-welcome-heading { font-family: ${DISPLAY_FONT}; font-size: clamp(30px, 4vw, 42px);
          line-height: 1.18; letter-spacing: .025em; font-weight: 700; margin: 0; color: var(--wda-dark); }
        .wda-welcome-heading em { color: var(--wda-pink); font-style: normal; }
        .wda-welcome-desc { font-size: 15px; line-height: 1.65; color: #665F5B; max-width: 100%; margin: 14px 0 0; }
        .wda-msg { width: 100%; display: flex; flex-direction: column; align-items: flex-start; }
        .wda-msg.is-new { animation: wdaMessageEnter .42s var(--wda-ease) both; }
        @keyframes wdaMessageEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .wda-msg.student { align-items: flex-end; position: relative; }
        .wda-msg-inner { width: 100%; max-width: 100%; }
        .wda-msg.student .wda-msg-inner { width: auto; max-width: 85%; }
        .wda-message-actions { display: flex; align-items: center; gap: 0; margin-top: 4px; }
        .wda-msg.student .wda-message-actions { justify-content: flex-end; }
        @media (hover: hover) and (pointer: fine) {
          .wda-msg.student .wda-message-actions { opacity: 0; pointer-events: none; transition: opacity .15s ease; }
          .wda-msg.student .wda-msg-inner:hover .wda-message-actions,
          .wda-msg.student .wda-msg-inner:focus-within .wda-message-actions { opacity: 1; pointer-events: auto; }
        }
        .wda-message-action {
          display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0;
          padding: 0; border: 0; border-radius: 12px; background: transparent;
          color: var(--theme-muted,#7A7570); cursor: pointer;
          transition: background .2s ease, color .2s ease;
        }
        .wda-message-action .discovery-icon { width: 17px; height: 17px; }
        .wda-message-action:hover:not(:disabled), .wda-message-action[aria-pressed="true"] {
          background: var(--theme-blush,#FCEBF5); color: var(--theme-pink,#C81E86);
        }
        .wda-message-action:focus-visible { outline: 2px solid var(--theme-pink,#C81E86); outline-offset: 2px; }
        .wda-message-action:disabled { opacity: .45; cursor: not-allowed; }
        .wda-message-action-status { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        .wda-message-action-error { display: block; margin-top: 3px; color: var(--theme-error,#A24121); font-size: 12px; line-height: 1.5; }
        @media (prefers-reduced-motion: reduce) { .wda-message-action, .wda-message-actions { transition: none; } }
        @media (forced-colors: active) {
          .wda-message-action { color: ButtonText; }
          .wda-message-action:focus-visible { outline-color: Highlight; }
        }
        .wda-advisor-copy { font-size: 16px; line-height: 1.75; white-space: pre-wrap; color: #282725; }
        .wda-student-copy {
          font-size: 14.5px; line-height: 1.65; white-space: pre-wrap;
          color: var(--wda-ink);
          background: var(--theme-soft-surface,#F0ECE7);
          padding: 12px 18px;
          border-radius: 22px;
          border: 0;
          box-shadow: none;
          user-select: text; -webkit-user-select: text;
        }
        .wda-msg.student.is-editing .wda-student-copy {
          box-shadow: 0 0 0 2px #E4B8D1;
        }
        .wda-typing-cursor { display: inline-block; width: 2px; height: 1.15em; background: var(--wda-pink);
          vertical-align: -0.15em; margin-left: 2px; border-radius: 1px; animation: wdaCursorBlink .8s infinite; }
        @keyframes wdaCursorBlink { 0%,45% { opacity: 1; } 55%,100% { opacity: 0; } }
        .wda-msg.advisor.is-thinking { padding: 4px 0 6px; }
        .wda-msg.advisor.is-thinking .wda-msg-inner {
          padding: 0; background: transparent; border: 0; box-shadow: none;
          display: inline-flex; align-items: center; width: auto; max-width: fit-content;
        }
        .wda-typing-bubble {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px 0;
          background: transparent; border: 0; box-shadow: none;
        }
        .wda-typing-bubble .wda-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #A29A93;
          animation: wdaDotWave 1.3s infinite ease-in-out both;
        }
        .wda-typing-bubble .wda-dot:nth-child(1) { animation-delay: -0.32s; }
        .wda-typing-bubble .wda-dot:nth-child(2) { animation-delay: -0.16s; }
        .wda-typing-bubble .wda-dot:nth-child(3) { animation-delay: 0s; }
        @keyframes wdaDotWave {
          0%,80%,100%{transform:translateY(0) scale(.8);opacity:.4;border-radius:50%}
          40%{transform:translateY(-3px) scale(1.15,.9);opacity:1;background:var(--wda-pink);border-radius:44% 56% 60% 40%}
        }
        .wda-advisor-helper { margin: 10px 0 0; font-size: 13px; color: #746D68; line-height: 1.55; animation: wdaFadeIn .3s ease-out; }
        @keyframes wdaFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .wda-suggestion-wrap { display: flex; flex-direction: column; gap: 12px; margin-top: -8px; }
        .wda-suggestion-label { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;
          font-size: 12px; color: #57504B; font-weight: 500; }
        .wda-suggestion-label span:last-child { font-weight: 400; color: #7A7068; font-size: 11px; }
        .wda-suggestion-list { display: flex; flex-direction: column; gap: 8px; }
        .wda-suggestion { width: 100%; min-height: 54px; border: 0; border-radius: 12px;
          background: rgba(255,255,255,.72); padding: 12px 15px; font-size: 13px; font-weight: 450;
          color: #3B3836; cursor: pointer; display: flex; gap: 14px; align-items: center; text-align: left;
          animation: wdaStarterEnter .4s var(--wda-ease) backwards;
          animation-delay: calc(var(--starter-order, 0) * 55ms);
          transition: transform .22s var(--wda-ease), border-color .18s ease, background .18s ease, box-shadow .22s ease; }
        @keyframes wdaStarterEnter { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
        .wda-suggestion:hover:not(:disabled), .wda-suggestion:focus-visible {
          transform: translateY(-2px); border-color: #D5ACC2; background: #FFFFFF;
          box-shadow: 0 5px 14px rgba(47,30,37,.05); }
        .wda-suggestion:active:not(:disabled) { transform: translateY(0) scale(.99); }
        .wda-starter-number { font-variant-numeric: tabular-nums; font-size: 11px; letter-spacing: .04em;
          color: #93857A; flex: 0 0 22px; transition: color .18s ease; }
        .wda-starter-label { flex: 1; min-width: 0; line-height: 1.5; }
        .wda-starter-action { display: grid; place-items: center; width: 26px; height: 26px;
          color: #9A8B80; flex: 0 0 auto; transition: color .18s ease, transform .22s var(--wda-ease); }
        .wda-suggestion:hover:not(:disabled) .wda-starter-action, .wda-suggestion:focus-visible .wda-starter-action {
          color: var(--wda-pink); transform: translateX(3px); }
        .wda-suggestion:hover .wda-starter-number { color: var(--wda-pink); }
        .wda-suggestion:disabled { opacity: .55; cursor: wait; }
        .wda-suggestion.is-drafting { opacity: 1; background: #FFF7FB; border-color: #D5ACC2; }
        .wda-starter-note { margin: 0; font-size: 11px; color: #7D7269; line-height: 1.5; }
        .wda-inline-state {font-size:13.5px;display:flex;align-items:center;gap:12px;color:#746D68;
          padding:10px 0;}
        .wda-state-spinner {width:17px;height:17px;border:2px solid #F1E5ED;
          border-top-color:var(--wda-pink);border-radius:50%;animation:wdaSpin .8s linear infinite;flex-shrink:0;}
        @keyframes wdaSpin {to {transform:rotate(360deg)}}

        .wda-shimmer-text {
          background: linear-gradient(
            90deg,
            #6B645E 0%,
            #C8147E 35%,
            #FF75BF 50%,
            #C8147E 65%,
            #6B645E 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: wdaTextShimmer 2.2s infinite ease-in-out;
          font-weight: 600;
        }
        @keyframes wdaTextShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }

        .wda-shimmer-wrap {
          display: flex; flex-direction: column; gap: 18px; width: 100%;
          animation: wdaFadeIn .35s var(--wda-ease);
        }
        .wda-loading-heading { display: flex; align-items: center; gap: 13px; padding: 3px 0 0; }
        .wda-loading-mark { width: 36px; height: 36px; flex: 0 0 auto; display: grid; place-items: center;
          background: #F7EDF2; border: 1px solid #ECDCE5; border-radius: 11px; }
        .wda-loading-mark .wda-state-spinner { width: 16px; height: 16px; border-width: 1.5px; }
        .wda-loading-heading h2 { margin: 0; font-size: 26px; line-height: 1.15; color: var(--wda-pink); }
        .wda-loading-heading p { margin: 5px 0 0; font-size: 12px; color: #796E66; line-height: 1.5; }
        .wda-loading-note { margin: -8px 0 0; color: #83786F; font-size: 11px; line-height: 1.5; }
        .wda-skeleton-carousel-wrap {
          position: relative; width: 100%; overflow: hidden;
        }
        .wda-skeleton-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px;
          padding: 4px 0 14px; width: 100%;
        }
        .wda-skeleton-card {
          position: relative; overflow: hidden; display: flex; flex-direction: column;
          justify-content: space-between;
          min-width: 0; min-height: 280px;
          border: 1px solid #E9E1DA; background: linear-gradient(160deg, #FFFFFF, #FEFCFA);
          border-radius: 18px; padding: 22px;
          box-shadow: 0 2px 4px rgba(49,36,29,.015), inset 0 1px 0 #FFFFFF;
          animation: wdaSkeletonEnter .45s var(--wda-ease) backwards;
          animation-delay: calc(var(--skeleton-order, 0) * 75ms);
        }
        @keyframes wdaSkeletonEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .wda-skeleton-card :is(.wda-skeleton-badge, .wda-skeleton-title, .wda-skeleton-industry,
          .wda-skeleton-line, .wda-skeleton-tags span, .wda-skeleton-btn) {
          background: linear-gradient(105deg, #F0EBE6 25%, #FAF6F2 44%, #F0EBE6 63%);
          background-size: 240% 100%;
          animation: wdaSkeletonShimmer 2.6s ease-in-out infinite;
          animation-delay: calc(var(--skeleton-order, 0) * 120ms);
        }
        @keyframes wdaSkeletonShimmer {
          0%,15% { background-position: 120% 0; }
          85%,100% { background-position: -120% 0; }
        }
        .wda-skeleton-badge { width: 46px; height: 9px; border-radius: 4px; margin-bottom: 17px; }
        .wda-skeleton-title { width: 81%; height: 19px; border-radius: 5px; }
        .wda-skeleton-industry { width: 48%; height: 9px; border-radius: 4px; margin-top: 9px; }
        .wda-skeleton-lines { display: flex; flex-direction: column; gap: 8px; margin: 24px 0 18px; }
        .wda-skeleton-line { width: 100%; height: 8px; border-radius: 3px; }
        .wda-skeleton-line.short { width: 58%; }
        .wda-skeleton-tags { display: flex; gap: 7px; margin-bottom: 20px; }
        .wda-skeleton-tags span { display: block; width: 52px; height: 17px; border-radius: 5px; }
        .wda-skeleton-tags span:last-child { width: 68px; }
        .wda-skeleton-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #F4EFEB; }
        .wda-skeleton-btn { width: 100%; height: 36px; border-radius: 9px; }
        .wda-rec-wrap { display: flex; flex-direction: column; width: 100%; animation: wdaFadeIn .3s ease-out; }
        .wda-rec-head { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .wda-rec-head h2 { font-size: 26px; letter-spacing: .025em; margin: 0; color: var(--wda-pink); }
        .wda-rec-head p { font-size: 13px; color: #68615C; line-height: 1.55; margin: 0; }
        .wda-rec-carousel-wrap {
          position: relative; width: 100%;
        }
        .wda-rec-carousel {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px; align-items: start;
          padding: 6px 0 16px; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .wda-rec-fade-right {
          display: none;
          position: absolute; top: 0; right: 0; bottom: 16px; width: 72px;
          pointer-events: none; z-index: 2;
          background: linear-gradient(90deg, rgba(253, 251, 249, 0) 0%, rgba(253, 251, 249, 0.98) 100%);
        }
        .wda-rec-card {
          min-width: 0; min-height: 0;
          display: flex; flex-direction: column; gap: 18px;
          border: 1px solid var(--wda-line); background: var(--wda-white);
          border-radius: 16px; padding: 20px; scroll-snap-align: start;
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .wda-rec-card:hover {
          border-color: #C9C0B7; box-shadow: none;
        }
        .wda-rec-card:first-child { border-color: #E3BDD3; }
        .wda-rec-card-top { display: flex; flex-direction: column; }
        .wda-rec-title { font-size: 22px; line-height: 1.25; font-weight: 700; margin: 0; }
        .wda-rec-industry { font-size: 12px; color: #89817A; margin-top: 4px; }
        .wda-rec-detail { font-size: 13px; color: #615B56; line-height: 1.5; margin: 12px 0 10px; }
        .wda-rec-codes { font-size: 11px; color: #7D736C; line-height: 1.55; margin-bottom: 0; }
        .wda-rec-card-bottom { margin-top: 0; padding-top: 0; }
        .wda-rec-card .wda-btn { width: 100%; justify-content: space-between; }
        .wda-alert {border:1px solid #EBDCCB;background:#FFF9F0;padding:18px 20px;
          border-radius:12px;max-width:630px;line-height:1.5;}
        .wda-alert h3 {font-size:20px;margin:0 0 5px;}
        .wda-alert p {font-size:13px;color:#665D52;margin:0 0 12px;}
        .wda-alert button {border:1px solid #C6AE9D;border-radius:7px;background:#fff;
          font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer;color:#332C27;}
        .wda-error {max-width:680px;border-left:3px solid #BC493E;background:#FFF4F1;
          padding:10px 13px;color:#8E3229;font-size:13px;}
        .wda-composer-wrap {
          position: relative; flex: 0 0 auto; padding: 12px 34px 21px;
          background: linear-gradient(to bottom, rgba(253,251,249,.82), var(--wda-paper) 24%);
        }
        .wda-composer {
          display: flex; align-items: flex-end; gap: 12px;
          width: 100%; max-width: 780px; margin: 0 auto; border: 0; border-radius: 26px;
          background: #F0ECE7; padding: 10px 10px 10px 20px; box-shadow: none;
          transition: background .2s ease, border-color .2s ease, box-shadow .24s ease;
        }
        .wda-composer:hover { border-color: #DDD1C6; }
        .wda-composer:focus-within { background: #FFFFFF; border-color: #CFA1BB; box-shadow: 0 0 0 3px rgba(200,20,126,.06), 0 5px 18px rgba(47,30,37,.04); }
        .wda-composer.is-drafting { border-color: #D5ACC2; background: #FBF4F7; }
        /* Draft preparation owns the whole bar, independently of the pointer
           sheen (::after), which is intentionally hidden on busy controls. */
        .wda-discovery-app .wda-composer::before {
          content: ''; position: absolute; inset: -3px; z-index: -1;
          border-radius: inherit; pointer-events: none;
          background: linear-gradient(90deg, rgba(245,46,169,.46) 0%, rgba(255,159,88,.46) 25%, rgba(245,46,169,.46) 50%, rgba(255,159,88,.46) 75%, rgba(245,46,169,.46) 100%);
          background-size: 200% 100%; background-position: 0% 50%;
          filter: blur(8px); opacity: 0; transition: opacity .3s ease;
        }
        .wda-discovery-app .wda-composer.is-drafting {
          border-color: transparent;
          box-shadow: 0 0 18px rgba(245,46,169,.06), 0 0 18px rgba(255,159,88,.06);
        }
        .wda-discovery-app .wda-composer.is-drafting::before {
          opacity: .65; animation: wdaDraftGlowFlow 2.2s linear infinite;
        }
        /* The second layer shields the text area from color mixing. The busy
           state uses this neutral surface instead of the pointer-hover sheen. */
        .wda-discovery-app .wda-composer.is-drafting::after {
          inset: 1px; background: var(--draft-surface, #FBF9F8);
          opacity: 1; transform: none; transition: none; display: block;
        }
        @keyframes wdaDraftGlowFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        .wda-composer textarea {
          display: block; border: 0; outline: 0; background: transparent;
          flex: 1; min-width: 0; width: 100%; min-height: 24px; max-height: 132px; resize: none; font-size: 15px;
          padding: 8px 0; line-height: 1.6; color: var(--wda-ink); overflow-y: auto;
        }
        .wda-composer textarea::placeholder { color: #756E67; }
        .wda-composer-actions {
          display: flex; align-items: center; flex: 0 0 auto;
        }
        .wda-composer-hint { display: block; text-align: center; margin: 8px auto 0;
          font-size: 11px; color: #77706A; line-height: 1.4; }
        .wda-complete-note { max-width: 780px; margin: 0 auto; padding: 16px 20px 24px;
          text-align: center; color: #756E67; font-size: 12px; line-height: 1.6; }
        .wda-complete-note button { display: inline; border: 0; background: transparent; color: var(--wda-pink);
          padding: 0; margin: 0; line-height: inherit; vertical-align: baseline;
          text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .wda-complete-note button:disabled { opacity: .5; cursor: not-allowed; }
        .wda-send {
          background: var(--wda-action-fill); border: 0; color: #fff; width: 40px; height: 40px;
          display: grid; place-items: center; border-radius: 50%; cursor: pointer; flex-shrink: 0;
          transition: background .18s ease, transform .2s var(--wda-ease), box-shadow .2s ease;
        }
        .wda-send .discovery-icon { width: 19px; height: 19px; transition: transform .2s var(--wda-ease); }
        .wda-send:hover:not(:disabled) { background: var(--wda-action-hover); transform: translateY(-2px); box-shadow: 0 4px 10px rgba(200,20,126,.18); }
        .wda-send:hover:not(:disabled) .discovery-icon { transform: translateY(-2px); }
        .wda-send:active:not(:disabled) { transform: scale(.92); }
        .wda-composer.has-draft .wda-send:not(:disabled) { animation: wdaSendReady .28s var(--wda-ease); }
        @keyframes wdaSendReady { from { transform: scale(.85); } to { transform: scale(1); } }
        .wda-send:disabled:not(.is-busy) { background: #E0DAD3; color: #827A72; cursor: not-allowed; }
        .wda-send.is-busy { background: var(--wda-action-fill); cursor: wait; opacity: 1; }
        .wda-send-spinner {
          width: 17px; height: 17px; border: 2.2px solid rgba(255,255,255,0.35);
          border-top-color: #ffffff; border-radius: 50%; animation: wdaSpin .75s linear infinite;
        }
        .wda-jump {
          position: absolute; bottom: 100%; right: 34px;
          transform: translateY(-4px); background: var(--wda-pink); color: #fff; border: 0;
          border-radius: 8px; padding: 9px 12px; font-size: 12px; cursor: pointer;
        }
        .wda-side-context {
          position: absolute; top: 62px; right: 18px; bottom: 18px; z-index: 60;
          width: min(340px, calc(100% - 36px)); border: 1px solid var(--wda-line);
          border-radius: 18px; background: var(--wda-white); box-shadow: 0 12px 40px rgba(24,18,20,.09);
          padding: 22px; display: flex; flex-direction: column; gap: 18px; min-width: 0; overflow-y: auto;
          animation: wdaPanelEnter .25s var(--wda-ease) both;
        }
        @keyframes wdaPanelEnter { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        .wda-side-context[hidden] { display: none; }
        .wda-side-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .wda-side-new-btn {
          display: inline-flex; align-items: center; gap: 5px; background: var(--wda-white);
          border: 1px solid var(--wda-line); border-radius: 8px; padding: 6px 9px; font-size: 11px;
          font-weight: 700; color: var(--wda-ink); cursor: pointer; flex-shrink: 0; transition: all .15s ease;
        }
        .wda-side-new-btn .discovery-icon { width: 13px; height: 13px; }
        .wda-side-new-btn:hover { border-color: var(--wda-pink); color: var(--wda-pink); background: var(--wda-pink-soft); }
        .wda-side-new-btn:disabled { opacity: .55; cursor: not-allowed; }
        .wda-side-context h2 { font-size: 22px; font-weight: 700; letter-spacing: .025em; margin: 0; }
        .wda-side-context p { margin: 0; font-size: 12px; line-height: 1.6; color: #827B75; }
        .wda-side-status { padding: 15px; background: #fff; border: 1px solid var(--wda-line); border-radius: 12px; }
        .wda-status-heading {
          font-size: 14px; letter-spacing: .04em; text-transform: uppercase;
          color: #756E67; font-weight: 700; margin-bottom: 9px;
        }
        .wda-side-status strong { display: block; font-size: 18px; line-height: 1.35; }
        .wda-side-status span { display: block; color: #89817B; font-size: 11px; margin-top: 4px; }
        .wda-side-answers-title {
          display: flex; align-items: center; justify-content: space-between; gap: 9px;
          padding-bottom: 12px; border-bottom: 1px solid var(--wda-line);
        }
        .wda-side-answers-title span { font-size: 11px; color: #9A918A; }
        .wda-answer-list { display: flex; flex-direction: column; gap: 0; }
        .wda-answer-row {
          border: 0; background: transparent; border-bottom: 1px solid var(--wda-line);
          text-align: left; padding: 12px 0; cursor: pointer;
          transition: padding-left .18s var(--wda-ease), background .18s ease;
        }
        .wda-answer-row:hover:not(:disabled) { padding-left: 6px; background: #FCF9F6; }
        .wda-answer-row:hover .wda-answer-preview { color: var(--wda-pink); }
        .wda-answer-row:disabled { cursor: default; opacity: .6; }
        .wda-answer-label { font-size: 11px; color: #8D857F; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
        .wda-answer-preview {
          font-size: 12px; line-height: 1.45; color: #3D3935;
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-top: 4px;
        }
        .wda-side-footnote { color: #969087; font-size: 11px; line-height: 1.55; }
        .discovery-icon { width: 16px; height: 16px; flex-shrink: 0; }

        /* The branded sheen is shared globally; chat retains its spring motion. */
        .wda-chat-tool, .wda-rail-link, .wda-mobile-nav-item, .wda-mobile-new-btn {
          transition: border-radius .5s var(--wda-liquid-ease), background .25s ease,
            color .2s ease, transform .45s var(--wda-liquid-ease), box-shadow .3s ease;
        }
        @media(hover:hover) and (pointer:fine) {
          .wda-chat-tool:hover:not(:disabled), .wda-rail-link:hover, .wda-mobile-nav-item:hover {
            border-radius: 17px 11px 18px 12px; transform: translateY(-2px);
            box-shadow: 0 5px 14px rgba(54,35,44,.05);
          }
        }
        .wda-suggestion {
          transition: transform .5s var(--wda-liquid-ease), border-radius .55s var(--wda-liquid-ease),
            border-color .25s ease, background .25s ease, box-shadow .4s ease;
        }
        .wda-suggestion:hover:not(:disabled), .wda-suggestion:focus-visible {
          transform: translateY(-3px); border-radius: 17px 12px 18px 12px;
          box-shadow: 0 8px 22px rgba(95,40,67,.07), inset 0 1px 0 rgba(255,255,255,.9);
        }
        .wda-suggestion:active:not(:disabled) { transform: translateY(0) scale(.985); border-radius: 11px 16px 12px 17px; }
        .wda-starter-action { transition: transform .5s var(--wda-liquid-ease), color .2s ease; }
        .wda-suggestion:hover:not(:disabled) .wda-starter-action { transform: translateX(5px); }
        .wda-composer {
          transition: border-radius .65s var(--wda-liquid-ease), background .35s ease,
            border-color .3s ease, box-shadow .5s ease;
        }
        .wda-composer:focus-within {
          border-radius: 29px 24px 30px 24px;
          box-shadow: 0 0 0 3px rgba(200,20,126,.045), 0 8px 30px rgba(77,36,59,.08), inset 0 1px 0 #FFFFFF;
        }
        .wda-send {
          transition: transform .55s var(--wda-liquid-ease), border-radius .55s var(--wda-liquid-ease),
            background .25s ease, box-shadow .4s ease;
        }
        .wda-send:hover:not(:disabled) { transform: translateY(-3px) scale(1.07); border-radius: 43% 57% 48% 52%; }
        .wda-send:active:not(:disabled) { transform: scale(.88, .94); border-radius: 50% 42% 50% 45%; }
        .wda-loading-mark { animation: wdaLiquidShape 5s ease-in-out infinite; }
        @keyframes wdaLiquidShape {
          0%,100% { border-radius: 11px 16px 12px 17px; }
          50% { border-radius: 17px 11px 17px 11px; }
        }
        .wda-rec-card { transition: border-radius .55s var(--wda-liquid-ease), transform .55s var(--wda-liquid-ease), border-color .25s ease, box-shadow .4s ease; }
        .wda-rec-card:hover { transform: translateY(-3px); border-radius: 20px 15px 21px 16px; box-shadow: 0 9px 26px rgba(58,35,47,.065); }
        .wda-rec-card .wda-btn { transition: border-radius .5s var(--wda-liquid-ease), background .25s ease, box-shadow .3s ease; }
        .wda-rec-card .wda-btn:hover:not(:disabled) { border-radius: 15px 10px 16px 10px; }
        .wda-side-context { animation: wdaLiquidPanel .5s var(--wda-liquid-ease) backwards; }
        @keyframes wdaLiquidPanel {
          from { opacity: 0; transform: translateX(18px) scale(.98); border-radius: 28px 12px 28px 12px; }
          to { opacity: 1; transform: translateX(0) scale(1); border-radius: 18px; }
        }
        .wda-msg.student.is-new .wda-student-copy { animation: wdaLiquidBubble .65s var(--wda-liquid-ease) backwards; }
        @keyframes wdaLiquidBubble {
          from { border-radius: 30px 12px 30px 22px; background: #F5E8EF; }
          to { border-radius: 22px; background: #F0ECE7; }
        }

        @media(max-width:1130px) {
          .wda-discovery-layout { grid-template-columns: 70px minmax(0,1fr); }
          .wda-chat-history { padding: 24px 27px 18px; }
          .wda-side-context { padding: 23px 15px; }
          .wda-composer-wrap { padding: 12px 27px 18px; }
        }
        @media(max-width:880px) {
          .wda-discovery-layout { grid-template-columns: 70px minmax(0,1fr); }
          .wda-chat-topline { padding: 0 24px; }
          .wda-composer-wrap { padding: 12px 22px 18px; }
          .wda-jump { right: 22px; }
        }
        @media(max-width:600px) {
          .wda-mobile-topbar { display: flex; }
          .wda-discovery-layout { grid-template-columns: minmax(0,1fr); }
          .wda-rail { display: none; }
          .wda-chat-topline { height: 51px; padding: 0 17px; }
          .wda-chat-tools { gap: 4px; }
          .wda-advisor-identity { gap: 8px; }
          .wda-chat-caption { display: none; }
          .wda-chat-tools .wda-session-status, .wda-chat-new { display: none; }
          .wda-chat-tool { min-height: 44px; }
          .wda-chat-history { padding: 18px 16px 12px; scrollbar-gutter: auto; }
          .wda-thread { gap: 21px; }
          .wda-welcome { padding: 25px 3px 18px; }
          .wda-welcome-heading { font-size: 37px; }
          .wda-welcome-desc { font-size: 14px; }
          .wda-msg-inner { max-width: 100%; }
          .wda-msg.student .wda-msg-inner { max-width: 90%; }
          .wda-advisor-copy, .wda-student-copy { font-size: 15px; }
          .wda-advisor-helper { font-size: 12px; }
          .wda-suggestion-label span:last-child { display: none; }
          .wda-suggestion { padding: 11px 12px; gap: 9px; font-size: 13px; }
          .wda-rec-card, .wda-skeleton-card { flex: 0 0 82vw; width: 82vw; min-width: 268px; max-width: 310px; }
          .wda-skeleton-card { min-height: 310px; }
          .wda-rec-carousel, .wda-skeleton-grid { display: flex; overflow-x: auto; padding: 6px 24px 14px 2px; }
          .wda-rec-fade-right { display: block; width: 32px; }
          .wda-composer-wrap { padding: 8px 12px 13px; }
          .wda-composer { padding: 8px 8px 8px 16px; border-radius: 25px; }
          .wda-composer textarea { font-size: 16px; min-height: 24px; }
          .wda-composer-hint { font-size: 10px; }
          .wda-jump { right: 18px; }
        }
        @media(prefers-reduced-motion:reduce) {
          .wda-discovery-app *, .wda-discovery-app *::before, .wda-discovery-app *::after { animation: none!important; }
          .wda-shimmer-text { -webkit-text-fill-color: initial; background: none; animation: none; }
          .wda-discovery-app [data-liquid]:is(:hover,:active,:focus-visible),
          .wda-suggestion:hover:not(:disabled) .wda-starter-action { transform: none!important; }
          *, *::before, *::after { scroll-behavior: auto!important; transition-duration: 0ms!important; }
        }
        @media(forced-colors:active) {
          .wda-discovery-app .wda-composer::before { display: none; }
          .wda-discovery-app .wda-composer.is-drafting { box-shadow: none; outline: 2px solid Highlight; outline-offset: 2px; }
        }
      `}</style>

      {supportCta ? <div className="wda-support-strip">{supportCta}</div> : null}

      {!embedded ? <header className="wda-mobile-topbar">
        <div className="wda-mobile-brand">
          <img className="wda-mobile-logo" src="/brand/wda-logo.png" alt="War Dogs Academy" />
        </div>
        <nav aria-label="Mobile navigation" className="wda-mobile-nav">
          <span className="wda-mobile-nav-item active" aria-current="page" title="Discovery">
            <Icon name="message" />
          </span>
          <a data-liquid="" className="wda-mobile-nav-item" href={`${buyerPagePath('setup', token)}${updateMode ? '?update=1' : '?targeting=1'}`} title="Targeting">
            <Icon name="target" />
          </a>
          <a data-liquid="" className="wda-mobile-nav-item" href={buyerPagePath('contracts', token)} title="Contracts">
            <Icon name="briefcase" />
          </a>
          <button
            data-liquid=""
            className="wda-mobile-new-btn"
            type="button"
            onClick={openNewChatModal}
            disabled={locked || isResetting}
            title="Start new chat"
            aria-label="New Chat"
          >
            <Icon name="plus" />
          </button>
        </nav>
      </header> : null}

      <div className="wda-discovery-layout">
        {!embedded ? <aside className="wda-rail" aria-label="Discovery navigation">
          <div className="wda-rail-brand" title="War Dogs Academy">
            <img className="wda-rail-logo" src="/brand/wda-favicon.png" alt="War Dogs Academy" />
          </div>
          <span className="wda-rail-link active" aria-current="page"><Icon name="message" />Discovery</span>
          <a data-liquid="" className="wda-rail-link" href={`${buyerPagePath('setup', token)}${updateMode ? '?update=1' : '?targeting=1'}`}><Icon name="target" />Targeting</a>
          <a data-liquid="" className="wda-rail-link" href={buyerPagePath('contracts', token)}><Icon name="briefcase" />Contracts</a>
        </aside> : null}

        <Conversation className="wda-conversation" aria-label="Niche Discovery conversation">
          <div className="wda-chat-topline">
            <div className="wda-advisor-identity">
              <div><div className="wda-chat-name">Niche Advisor</div>
                <span className="wda-chat-caption">Find your lane. Build your next move.</span></div>
            </div>
            <div className="wda-chat-tools">
              <div className="wda-session-status" aria-live="polite">{statusLabel}</div>
              <button data-liquid="" type="button" className="wda-chat-tool" aria-expanded={showAnswers}
                aria-controls="wda-saved-answers" onClick={() => setShowAnswers((open) => !open)}>
                <Icon name="library" />Your answers
              </button>
              <button data-liquid="" type="button" className="wda-chat-tool wda-chat-new" aria-label="Start new chat"
                title="Start new chat" disabled={locked || isResetting} onClick={openNewChatModal}>
                <Icon name="plus" />
              </button>
            </div>
          </div>

          <div className="wda-chat-history" ref={historyRef} onScroll={updateScrollState} onClick={() => setSkipTyping(true)}>
            <div className="wda-thread">
              {answerHistory.length === 0 && !recs.length && !buildingRecommendations ? (
                <div className="wda-welcome">
                  <span className="wda-welcome-kicker">War Dogs Academy / Niche Discovery</span>
                  <h1 className="wda-welcome-heading">Let’s find your <em>niche.</em></h1>
                  <p className="wda-welcome-desc">Tell us what your business does. We'll ask a few questions to help you find a federal contracting niche that fits.</p>
                </div>
              ) : null}

              {visibleMessages.map((message, visualIndex) => {
                const isStudent = message.role === 'student';
                const sourceIndex = message.originalIndex ?? visualIndex;
                const isNew = sourceIndex >= initialHistoryCountRef.current;
                const messageText = isStudent ? String(message.content || '') : getAdvisorMessageText(message, pending, visualIndex === visibleMessages.length - 1);
                return isStudent ? (
                  <div
                    className={`wda-msg student${isNew ? ' is-new' : ''}${editingIndex === sourceIndex ? ' is-editing' : ''}`}
                    key={`m-${sourceIndex}`}
                  >
                    <div className="wda-msg-inner">
                      <div className="wda-student-copy">{message.content}</div>
                      <MessageActions index={sourceIndex} text={messageText} actions={messageActions} onEdit={editAnswer} editDisabled={locked || isResetting} />
                    </div>
                  </div>
                ) : (
                  <div className={`wda-msg advisor${isNew ? ' is-new' : ''}`} key={`m-${sourceIndex}`}>
                    <div className="wda-msg-inner">
                      <Typewriter
                        text={messageText}
                        enabled={shouldAnimateAdvisor(sourceIndex, visualIndex)}
                        skip={skipTyping}
                        className="wda-advisor-copy"
                        onTick={() => { if (stuckToBottom.current) scrollChatToBottom('auto'); }}
                        onComplete={() => {
                          animatedMessagesRef.current.add(sourceIndex);
                          setIsAdvisorTyping(false);
                          setShowSuggestions(true);
                          textareaRef.current?.focus();
                        }}
                      />
                      {visualIndex === visibleMessages.length - 1 && !isAdvisorTyping && (message.question?.helper || pending?.helper) ? (
                        <p className="wda-advisor-helper">{message.question?.helper || pending?.helper}</p>
                      ) : null}
                      {!(visualIndex === visibleMessages.length - 1 && isAdvisorTyping) ? <MessageActions index={sourceIndex} text={messageText} actions={messageActions} /> : null}
                    </div>
                  </div>
                );
              })}

              {busy && !buildingRecommendations ? (
                <div className="wda-msg advisor is-thinking" role="status" aria-label="Advisor is thinking">
                  <div className="wda-msg-inner">
                    <div className="wda-typing-bubble" aria-hidden="true">
                      <span className="wda-dot" />
                      <span className="wda-dot" />
                      <span className="wda-dot" />
                    </div>
                  </div>
                </div>
              ) : null}

              {!busy && (!recs.length || editingIndex != null) && (showSuggestions || drafting) && pending?.options?.length > 0 && !isAdvisorTyping ? (
                <AnswerStarters options={pending.options} onDraft={draftSuggestion}
                  disabled={locked} draftingLabel={draftingSuggestion} />
              ) : null}

              {drafting && !pending?.options?.length ? (
                <div className="wda-inline-state" role="status">
                  <span className="wda-state-spinner" />
                  <span className="wda-shimmer-text">Preparing a draft you can edit…</span>
                </div>
              ) : null}
              {buildingRecommendations ? <RecommendationLoading /> : null}

              {recs.length > 0 ? (
                <section className="wda-rec-wrap" aria-label="Your niche recommendations">
                  <div className="wda-rec-head">
                    <h2>Your recommended niches</h2>
                    <p>I narrowed this to the strongest starting lanes for you. Choose the one that best matches what you can deliver.</p>
                  </div>
                  <div className="wda-rec-carousel-wrap">
                    <div className="wda-rec-carousel">
                      {recs.map((rec, index) => (
                        <article data-liquid="" className="wda-rec-card" key={rec.subindustry_id}>
                          <span className="wda-rec-number" aria-label={`Recommendation ${index + 1}`}>#{index + 1}</span>
                          <div className="wda-rec-card-top">
                            <h3 className="wda-rec-title">{rec.subindustry_name}</h3>
                            <div className="wda-rec-industry">{rec.industry_name}</div>
                            <p className="wda-rec-detail">{rec.explanation}</p>
                            <div className="wda-rec-codes">{(rec.naics || []).map(n => `${n.code} · ${n.title}`).join('  ·  ')}</div>
                          </div>
                          <div className="wda-rec-card-bottom">
                            <Button
                              data-liquid=""
                              variant="solid"
                              disabled={applying !== -1}
                              loading={applying === index}
                              loadingText="Applying…"
                              onClick={() => useThis(rec, index)}
                            >
                              Use this niche
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {recs.length > 1 ? <div className="wda-rec-fade-right" aria-hidden="true" /> : null}
                  </div>
                </section>
              ) : null}

              {canRetryRecommendations ? (
                <div className="wda-alert" role="status">
                  <h3>Your answers are saved</h3>
                  <p>{error || 'We could not prepare the recommendations on the last attempt. You can retry without answering the questions again.'}</p>
                  <Button variant="outline" disabled={locked} onClick={retryRecommendations}>Try again</Button>
                </div>
              ) : null}
              {recommendationStatus === 'no_recommendation' && recommendationMessage ? (
                <div className="wda-alert" role="status">
                  <h3>We need a little more information</h3><p>{recommendationMessage}</p>
                  <Button variant="outline" disabled={locked} onClick={confirmRestart}>Start Discovery again</Button>
                </div>
              ) : null}
              {error && !canRetryRecommendations ? <div role="alert" className="wda-error">{error}</div> : null}
              <div ref={endRef} />
            </div>
          </div>

          {showBackToBottom ? <button type="button" className="wda-jump" onClick={() => scrollChatToBottom()}>↓ Latest message</button> : null}
          {(pending || buildingRecommendations || busy || editingIndex != null) && (!recs.length || editingIndex != null) ? (
            <div className="wda-composer-wrap">
              <form data-liquid="" className={`wda-composer${draft.trim() ? ' has-draft' : ''}${drafting ? ' is-drafting' : ''}`}
                aria-busy={busy || drafting || buildingRecommendations} onSubmit={(event) => {
                event.preventDefault();
                if ((!recs.length && !buildingRecommendations) || editingIndex != null) submit();
              }}>
                <textarea ref={textareaRef} rows={1} aria-label="Your answer" value={draft} maxLength={900}
                  onChange={resizeComposer} onKeyDown={sendWithKey}
                  disabled={drafting || ((recs.length > 0 || buildingRecommendations) && editingIndex == null)}
                  placeholder={drafting ? 'Preparing an answer you can edit…' : buildingRecommendations ? 'Preparing your recommendations…' : isAdvisorTyping ? 'Advisor is typing…' : recs.length > 0 && editingIndex == null ? 'To change your recommendations, edit an earlier answer.' : pending?.placeholder || 'Write your answer…'} />
                <div className="wda-composer-actions">
                  <button
                    data-liquid=""
                    type="submit"
                    className={`wda-send ${busy ? 'is-busy' : ''}`}
                    aria-label={busy ? 'Advisor is responding' : 'Send answer'}
                    disabled={locked || ((recs.length > 0 || buildingRecommendations) && editingIndex == null) || !draft.trim()}
                  >
                    {busy ? <div className="wda-send-spinner" aria-hidden="true" /> : <Icon name="send" />}
                  </button>
                </div>
              </form>
              <span className="wda-composer-hint">Enter to send · Shift+Enter for a new line</span>
            </div>
          ) : null}
          {recs.length > 0 && editingIndex == null ? (
            <div className="wda-complete-note">
              Your answers are saved. <button type="button" aria-controls="wda-saved-answers"
                aria-expanded={showAnswers} onClick={() => setShowAnswers(true)}>Edit your answers</button>{' to refine your recommendations, or '}
              <button type="button" disabled={locked || isResetting || applying !== -1}
                onClick={openNewChatModal}>start a new chat</button>.
            </div>
          ) : null}
        </Conversation>

        <aside id="wda-saved-answers" className="wda-side-context" aria-label="Current Discovery session" hidden={!showAnswers}>
          <div className="wda-side-header">
            <div>
              <h2>Your Discovery</h2>
              <p>Your saved answers and current session status.</p>
            </div>
            <button
              data-liquid=""
              type="button"
              className="wda-side-new-btn"
              onClick={() => setShowAnswers(false)}
              aria-label="Close saved answers"
              title="Close saved answers"
            >
              <Icon name="x" />
            </button>
          </div>
          <div className="wda-side-status">
            <div className="wda-status-heading">Session status</div>
            <strong>{statusLabel}</strong>
            <span>{answerHistory.length} {answerHistory.length === 1 ? 'answer' : 'answers'} saved in this conversation</span>
          </div>
          <div>
            <div className="wda-side-answers-title"><h2>Your answers</h2><span>{answerHistory.length}</span></div>
            {answerHistory.length ? <div className="wda-answer-list">
              {answerHistory.map((answer) => (
                <button type="button" className="wda-answer-row" key={answer.originalIndex} disabled={locked}
                  onClick={() => { setShowAnswers(false); editAnswer(answer.originalIndex, answer.content); }} title="Edit this answer">
                  <div className="wda-answer-label">{questionForMessage(answer.originalIndex)}</div>
                  <div className="wda-answer-preview">{answer.content}</div>
                </button>
              ))}
            </div> : <p style={{marginTop:14}}>Your answers will appear here as you go.</p>}
          </div>
          <div className="wda-side-footnote">You can change a previous answer at any time. Doing so may update your recommendations.</div>
        </aside>
      </div>

      <Modal open={showNewChatModal} onClose={() => setShowNewChatModal(false)} busy={isResetting}
        title="Start a new chat?" kind="restart"
        description="This will clear your current conversation and reset your saved answers so you can discover a new federal contracting lane from scratch.">
        <div className="wda-popup-actions">
          <Button variant="solid" disabled={isResetting} loading={isResetting}
            loadingText="Starting new chat…" onClick={startNewDiscovery}>
            Yes, start over
          </Button>
          <Button data-modal-autofocus="" variant="ghost" disabled={isResetting}
            onClick={() => setShowNewChatModal(false)} showArrow={false}>
            Keep this chat
          </Button>
        </div>
      </Modal>
    </div>
  );
}
