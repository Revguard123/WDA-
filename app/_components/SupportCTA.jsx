'use client';

import { useEffect, useState } from 'react';
import Button from './Button.jsx';
import Modal from './Modal.jsx';
import Select from './Select.jsx';
import CTCIcon from './CTCIcon.jsx';
import { UI, BODY_FONT } from '../../lib/ui.js';

const CONTEXT_LABELS = {
  portal: 'Portal',
  targeting_setup: 'Targeting Setup',
  targeting_review: 'Review Targeting',
  discovery: 'Niche Discovery',
  start: 'Ready to Start',
  contracts: 'Curated Contracts',
  deep_dive: 'Full Breakdown',
};

const FEEDBACK_CATEGORIES = [
  "Something isn't working",
  'Contract issue',
  'Niche Advisor issue',
  'Account/access issue',
  'Other',
];

const inputStyle = {
  width: '100%',
  padding: '11px 13px',
  fontSize: 15,
  border: `1px solid ${UI.line}`,
  borderRadius: 8,
  boxSizing: 'border-box',
  background: '#fff',
  color: UI.text,
  fontFamily: BODY_FONT,
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: UI.ink,
  margin: '16px 0 6px',
};

function inferBrowser(navigatorObject) {
  const ua = navigatorObject?.userAgent || '';
  const brands = navigatorObject?.userAgentData?.brands?.map((brand) => brand.brand).join(', ') || '';
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) || /Chromium/.test(brands)) return 'Chrome/Chromium';
  if (/Safari\//.test(ua)) return 'Safari';
  return brands || 'Unknown browser';
}

function inferOperatingSystem(navigatorObject) {
  const ua = navigatorObject?.userAgent || '';
  const platform = navigatorObject?.userAgentData?.platform || navigatorObject?.platform || '';
  if (/Windows/i.test(platform) || /Windows/i.test(ua)) return 'Windows';
  if (/macOS|Mac/i.test(platform) || /Mac OS X/i.test(ua)) return 'macOS';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS/iPadOS';
  if (/Android/i.test(platform) || /Android/i.test(ua)) return 'Android';
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'Linux';
  return platform || 'Unknown OS';
}

function inferDevice(windowObject, navigatorObject) {
  const ua = navigatorObject?.userAgent || '';
  const width = windowObject?.innerWidth || 0;
  const hasTouch = navigatorObject?.maxTouchPoints > 0;
  if (/Mobi|iPhone|Android/i.test(ua) || width < 700) return 'Mobile';
  if (/Tablet|iPad/i.test(ua) || (hasTouch && width < 1100)) return 'Tablet';
  return 'Desktop';
}

function collectTechnicalContext() {
  if (typeof window === 'undefined') return {};
  const nav = window.navigator;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const ratio = window.devicePixelRatio || 1;

  return {
    browser: inferBrowser(nav),
    device: inferDevice(window, nav),
    os: inferOperatingSystem(nav),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0} @ ${ratio}x`,
    timezone: tz,
    language: nav.language || '',
  };
}

export default function SupportCTA({ pageContext, compact = false, sticky = false, sidebar = false, liquid = false, initialEmail = '', supportEmail = '' }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('feedback');
  const [email, setEmail] = useState(initialEmail || '');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState("Something isn't working");
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const validContext = Object.hasOwn(CONTEXT_LABELS, pageContext) ? pageContext : 'portal';
  const sending = status === 'sending';
  const feedbackMode = mode === 'feedback';
  const messageLimit = feedbackMode ? 2000 : 3000;

  useEffect(() => {
    if (!open) return undefined;
    if (initialEmail && !email) setEmail(initialEmail);
  }, [open, initialEmail, email]);

  function close() {
    if (sending) return;
    setOpen(false);
    setError('');
    if (status === 'sent') {
      setStatus('idle');
      setMessage('');
    }
  }

  function openModal(nextMode) {
    setMode(nextMode);
    setOpen(true);
    setStatus('idle');
    setError('');
    if (initialEmail) setEmail(initialEmail);
  }

  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    setError('');
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!message.trim()) {
      setError('Tell us what you need help with.');
      return;
    }
    if (message.length > messageLimit) {
      setError(`Please keep your message under ${messageLimit} characters.`);
      return;
    }
    setStatus('sending');
    try {
      const pagePath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
      const technicalContext = feedbackMode ? collectTechnicalContext() : undefined;
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: mode, email, message, category, pageContext: validContext, pagePath, technicalContext, company }),
      });
      if (!res.ok) throw new Error('Support request failed');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError(feedbackMode ? "We couldn't send that feedback right now. Please try again or contact us by email." : "We couldn't send your request right now. Please try again.");
    }
  }

  const containerStyle = sidebar ? undefined : sticky
    ? {
        position: 'sticky',
        top: 0,
        zIndex: 900,
        width: '100%',
        flex: '0 0 auto',
        background: '#fffaf4',
        borderBottom: `1px solid ${UI.line}`,
        color: UI.muted,
        fontSize: 13,
        padding: '8px 16px',
        boxSizing: 'border-box',
        boxShadow: '0 6px 18px rgba(26,26,26,.04)',
      }
    : {
        marginTop: compact ? 0 : 26,
        textAlign: compact ? 'left' : 'center',
        color: UI.muted,
        fontSize: 13.5,
        border: `1px solid ${UI.line}`,
        borderLeft: `3px solid ${UI.pink}`,
        borderRadius: '0 12px 12px 0',
        padding: compact ? '12px 14px' : '14px 16px',
        background: compact ? UI.card : 'var(--theme-support-surface, #fffaf4)',
      };

  return (
    <div className={sidebar ? 'wda-sidebar-support' : sticky ? 'ctc-beta-support-bar' : undefined} style={containerStyle}>
      {sidebar ? (
        <div className="wda-sidebar-support-actions">
          <p className="wda-sidebar-support-label">Help & feedback</p>
          <button data-liquid={liquid ? '' : undefined} type="button" data-sidebar-hint="Send feedback" onClick={() => openModal('feedback')}><CTCIcon name="message" />Send feedback</button>
          {supportEmail ? <a data-liquid={liquid ? '' : undefined} href={`mailto:${supportEmail}`} data-sidebar-hint="Email support"><CTCIcon name="mail" />Email support</a>
            : <button data-liquid={liquid ? '' : undefined} type="button" data-sidebar-hint="Contact support" onClick={() => openModal('support')}><CTCIcon name="mail" />Contact support</button>}
        </div>
      ) : <>
      {sticky ? (
        <style>{`
          .ctc-beta-support-bar-inner{max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;line-height:1.35}
          .ctc-beta-support-actions{display:flex;align-items:center;gap:9px;white-space:nowrap}
          @media(max-width:640px){.ctc-beta-support-bar-inner{align-items:flex-start;flex-direction:column;gap:6px}.ctc-beta-support-actions{white-space:normal;flex-wrap:wrap}}
        `}</style>
      ) : null}
      <div className={sticky ? 'ctc-beta-support-bar-inner' : undefined}>
        <span>
          <strong style={{ color: UI.ink, fontWeight: 600 }}>This product is currently in beta.</strong>{' '}
          If something isn&apos;t working, please let us know.
        </span>
        <span className={sticky ? 'ctc-beta-support-actions' : undefined}>
      <button
        type="button"
        onClick={() => openModal('feedback')}
        style={{
          border: 'none',
          background: 'transparent',
          color: UI.ink,
          fontWeight: 600,
          fontSize: 13.5,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        Send feedback
      </button>
      {supportEmail ? (
        <>
          {' '}<span aria-hidden="true">|</span>{' '}
          <a href={`mailto:${supportEmail}`} style={{ color: UI.ink, fontWeight: 600 }}>
            Email support
          </a>
        </>
      ) : (
        <>
          {' '}<button
            type="button"
            onClick={() => openModal('support')}
            style={{ border: 'none', background: 'transparent', color: UI.ink, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
          Contact support
          </button>
        </>
      )}
        </span>
      </div>
      </>}

      <Modal open={open} onClose={close} busy={sending} form
        kind={status === 'sent' ? 'success' : 'feedback'}
        title={status === 'sent' ? 'Thank you for reaching out' : feedbackMode ? 'Send beta feedback' : 'Need help?'}
        description={status === 'sent' ? 'Your message is with the WDA team.' : feedbackMode
          ? "Tell us what isn't working. The WDA team will see it directly."
          : "Tell us what you're having trouble with and our support team will take a look."}>
            {status === 'sent' ? (
              <div className="wda-popup-success" role="status">
                {feedbackMode ? 'Thanks, we got it. The WDA team will take a look.' : "Your support request has been sent. We'll get back to you as soon as we can."}
                <div className="wda-popup-actions">
                  <Button variant="ghost" onClick={close} showArrow={false}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit}>
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  name="company"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
                />
                <label style={labelStyle} htmlFor="support-email">Email</label>
                <input
                  id="support-email"
                  type="email"
                  required
                  style={inputStyle}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

                {feedbackMode ? (
                  <>
                    <label style={labelStyle} htmlFor="support-category">Category</label>
                    <Select
                      id="support-category"
                      name="category"
                      value={category}
                      onChange={setCategory}
                      options={FEEDBACK_CATEGORIES}
                      disabled={sending}
                    />
                  </>
                ) : null}

                <label style={labelStyle} htmlFor="support-message">{feedbackMode ? 'What happened?' : 'What are you having trouble with?'}</label>
                <textarea
                  id="support-message"
                  required
                  maxLength={messageLimit}
                  rows={6}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 130 }}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={feedbackMode ? 'Tell us what happened and what you were trying to do.' : 'Tell us what happened and what you need help with.'}
                />
                <div style={{ marginTop: 5, fontSize: 12.5, color: UI.muted }}>{message.length}/{messageLimit}</div>

                {feedbackMode && supportEmail ? (
                  <p style={{ margin: '10px 0 0', color: UI.muted, fontSize: 13 }}>
                    Prefer email? Contact support at <a href={`mailto:${supportEmail}`} style={{ color: UI.ink, fontWeight: 600 }}>{supportEmail}</a>.
                  </p>
                ) : null}

                {error ? (
                  <div role="alert" style={{ marginTop: 12, color: UI.orangeDeep, fontSize: 13.5, fontWeight: 600 }}>
                    {error}
                  </div>
                ) : null}

                <div className="wda-popup-actions">
                  <Button
                    type="submit"
                    variant="solid"
                    disabled={sending}
                    loading={sending}
                    loadingText="Sending…"
                  >
                    {feedbackMode ? 'Send feedback' : 'Send support request'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={close}
                    disabled={sending}
                    showArrow={false}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
      </Modal>
    </div>
  );
}
