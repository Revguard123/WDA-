'use client';

import { useState, useEffect, useRef } from 'react';
import Button from './Button.jsx';

export default function AccessForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);

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
    if (inFlight.current) return;
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setStatus('error');
      setMessage('Enter a valid email address.');
      return;
    }
    inFlight.current = true;
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setStatus('done');
      setMessage(data.message || 'Check your inbox for your private link.');
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || err));
    } finally {
      inFlight.current = false;
    }
  }

  if (status === 'done') {
    return (
      <div className="wda-access-success" role="status" aria-live="polite">
        <h3>Check your inbox.</h3>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <form className="wda-portal-form" onSubmit={submit} aria-label="Email my access link" aria-busy={status === 'sending' || undefined}>
      <label htmlFor="access-email">
        Your email
      </label>
      <input
        type="email"
        id="access-email"
        name="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status === 'error') { setStatus('idle'); setMessage(''); } }}
        placeholder="you@yourcompany.com"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="email"
        disabled={status === 'sending'}
        aria-invalid={status === 'error' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || undefined}
        aria-describedby={`access-email-hint${status === 'error' ? ' access-email-error' : ''}`}
      />
      <p className="wda-portal-field-hint" id="access-email-hint">
        We will email your private link to this address. No password needed.
      </p>
      {status === 'error' && message ? <p className="wda-portal-field-error" id="access-email-error" role="alert">{message}</p> : null}
      <Button
        className="wda-portal-submit"
        type="submit"
        disabled={status === 'sending'}
        loading={status === 'sending'}
        loadingText="Sending your link…"
      >
        Email me my link
      </Button>
    </form>
  );
}
