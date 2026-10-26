'use client';

import { useEffect, useState } from 'react';
import Button from './Button.jsx';
import { requestAccessMotion } from '../../lib/accessMotion.js';

// One-field gate for the portal when Kajabi could not pass the member's email.
// On submit it navigates to /portal?email=..., which resolves the buyer and
// redirects straight into their contracts. No email round-trip: type and you
// are in. (Accepted tradeoff: whoever types a member's email reaches that
// member's portal.)
export default function PortalEmailForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    // Browsers can restore this form from the back/forward cache after access
    // recovery; do not leave the restored page showing a disabled submit action.
    const resetPending = () => setSubmitting(false);
    window.addEventListener('pageshow', resetPending);
    return () => window.removeEventListener('pageshow', resetPending);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (submitting) return;
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setSubmitting(true);
    try { requestAccessMotion(window.sessionStorage); } catch { /* Storage is optional. */ }
    window.location.href = `/portal?email=${encodeURIComponent(clean)}`;
  }

  return (
    <form className="wda-portal-form" onSubmit={submit} action="/portal" method="GET" aria-label="Portal access" aria-busy={submitting || undefined}>
      <label htmlFor="portal-email">
        Your email
      </label>
      <input
        type="email"
        id="portal-email"
        name="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
        placeholder="you@yourcompany.com"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="email"
        aria-describedby={`portal-email-hint${error ? ' portal-email-error' : ''}`}
        aria-invalid={error ? true : undefined}
      />
      <p id="portal-email-hint" className="wda-portal-field-hint">Use your War Dogs Academy enrollment email. No password needed.</p>
      {error ? <p id="portal-email-error" className="wda-portal-field-error" role="alert">{error}</p> : null}
      <Button type="submit" className="wda-portal-submit" disabled={submitting} loading={submitting} loadingText="Opening your portal…">Open my portal</Button>
    </form>
  );
}
