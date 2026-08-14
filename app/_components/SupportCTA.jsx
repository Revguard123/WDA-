'use client';

import { useEffect, useId, useState } from 'react';
import { UI, BODY_FONT, DISPLAY_FONT } from '../../lib/ui.js';

const CONTEXT_LABELS = {
  portal: 'Portal',
  targeting_setup: 'Targeting Setup',
  targeting_review: 'Review Targeting',
  discovery: 'Niche Discovery',
  start: 'Ready to Start',
  contracts: 'Curated Contracts',
  deep_dive: 'Full Breakdown',
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26,26,26,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  zIndex: 1000,
};

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
  fontWeight: 800,
  color: UI.ink,
  margin: '16px 0 6px',
};

export default function SupportCTA({ pageContext }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const titleId = useId();
  const messageId = useId();
  const validContext = Object.hasOwn(CONTEXT_LABELS, pageContext) ? pageContext : 'portal';
  const sending = status === 'sending';

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape' && !sending) setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, sending]);

  function close() {
    if (sending) return;
    setOpen(false);
    setError('');
    if (status === 'sent') {
      setStatus('idle');
      setMessage('');
    }
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
    if (message.length > 3000) {
      setError('Please keep your message under 3000 characters.');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message, pageContext: validContext, company }),
      });
      if (!res.ok) throw new Error('Support request failed');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError("We couldn't send your request right now. Please try again.");
    }
  }

  return (
    <div style={{ marginTop: 26, textAlign: 'center', color: UI.muted, fontSize: 13.5 }}>
      Having trouble with this page?{' '}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStatus('idle');
          setError('');
        }}
        style={{
          border: 'none',
          background: 'transparent',
          color: UI.ink,
          fontWeight: 800,
          fontSize: 13.5,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        Contact support
      </button>

      {open ? (
        <div style={overlayStyle} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            style={{
              width: '100%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: UI.card,
              border: `1px solid ${UI.line}`,
              borderTop: `4px solid ${UI.pink}`,
              borderRadius: 12,
              boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
              padding: 24,
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <h2 id={titleId} style={{ margin: 0, color: UI.ink, fontSize: 24, fontFamily: DISPLAY_FONT }}>
                  Need help?
                </h2>
                <p id={messageId} style={{ color: UI.muted, fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 0' }}>
                  Tell us what you&apos;re having trouble with and our support team will take a look.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={sending}
                aria-label="Close support form"
                style={{ border: 'none', background: 'transparent', color: UI.muted, fontSize: 24, lineHeight: 1, cursor: sending ? 'default' : 'pointer' }}
              >
                &times;
              </button>
            </div>

            {status === 'sent' ? (
              <div style={{ background: UI.paper, border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.pink}`, borderRadius: '0 8px 8px 0', padding: '13px 14px', marginTop: 18, color: UI.text, fontSize: 14.5, lineHeight: 1.55 }}>
                Your support request has been sent. We&apos;ll get back to you as soon as we can.
                <div style={{ marginTop: 14 }}>
                  <button type="button" onClick={close} style={{ background: UI.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}>
                    Close
                  </button>
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

                <label style={labelStyle} htmlFor="support-message">What are you having trouble with?</label>
                <textarea
                  id="support-message"
                  required
                  maxLength={3000}
                  rows={6}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 130 }}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us what happened and what you were trying to do."
                />
                <div style={{ marginTop: 5, fontSize: 12.5, color: UI.muted }}>{message.length}/3000</div>

                {error ? (
                  <div role="alert" style={{ marginTop: 12, color: UI.orangeDeep, fontSize: 13.5, fontWeight: 700 }}>
                    {error}
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                  <button
                    type="submit"
                    disabled={sending}
                    style={{ background: UI.pink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 800, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.72 : 1 }}
                  >
                    {sending ? 'Sending...' : 'Send support request'}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    disabled={sending}
                    style={{ background: '#fff', color: UI.ink, border: `1px solid ${UI.line}`, borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 800, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.72 : 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

