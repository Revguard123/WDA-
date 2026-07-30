'use client';

import { useState, useEffect } from 'react';
import { UI, BODY_FONT } from '../../lib/ui.js';

export default function AccessForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');

  // Pre-fill the email when it is passed in the URL (e.g. Kajabi can inject the
  // logged-in member's email into the button link), so re-entry is one click.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('email');
      if (q && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q)) setEmail(q);
    } catch {
      // no-op: fall back to an empty field
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setStatus('done');
      setMessage(data.message || 'Check your inbox for your private link.');
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || err));
    }
  }

  if (status === 'done') {
    return (
      <div style={{ background: '#fdeaf6', border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.pink}`, borderRadius: '0 10px 10px 0', padding: 20 }}>
        <div style={{ fontWeight: 800, color: UI.ink, fontSize: 16 }}>Check your inbox.</div>
        <p style={{ color: UI.text, fontSize: 14, lineHeight: 1.55, margin: '6px 0 0' }}>{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: UI.ink, margin: '0 0 6px', letterSpacing: 0.2 }}>
        Your email
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourcompany.com"
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 16,
          border: `1px solid ${UI.line}`,
          borderRadius: 8,
          boxSizing: 'border-box',
          background: '#fff',
          color: UI.text,
          fontFamily: BODY_FONT,
        }}
      />
      <div style={{ fontSize: 12.5, color: UI.muted, marginTop: 6, lineHeight: 1.5 }}>
        We will email your private link to this address. No password needed.
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        style={{
          marginTop: 18,
          width: '100%',
          background: UI.pink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px 24px',
          fontSize: 16,
          fontWeight: 800,
          cursor: status === 'sending' ? 'default' : 'pointer',
          opacity: status === 'sending' ? 0.7 : 1,
        }}
      >
        {status === 'sending' ? 'Sending...' : 'Email me my link'}
      </button>
      {status === 'error' && message ? (
        <div style={{ marginTop: 12, fontSize: 14, color: UI.orangeDeep, fontWeight: 600 }}>{message}</div>
      ) : null}
    </form>
  );
}
