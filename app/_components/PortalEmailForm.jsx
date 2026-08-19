'use client';

import { useState } from 'react';
import { UI, BODY_FONT } from '../../lib/ui.js';

// One-field gate for the portal when Kajabi could not pass the member's email.
// On submit it navigates to /portal?email=..., which resolves the buyer and
// redirects straight into their contracts. No email round-trip: type and you
// are in. (Accepted tradeoff: whoever types a member's email reaches that
// member's portal.)
export default function PortalEmailForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError('Enter a valid email address.');
      return;
    }
    window.location.href = `/portal?email=${encodeURIComponent(clean)}`;
  }

  return (
    <form onSubmit={submit} action="/portal" method="GET">
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: UI.ink, margin: '0 0 6px', letterSpacing: 0.2 }}>
        Your email
      </label>
      <input
        type="email"
        name="email"
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
        Use the email on your War Dogs Academy account.
      </div>
      <button
        type="submit"
        style={{
          marginTop: 18,
          width: '100%',
          background: UI.pink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px 24px',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Open my contracts &rarr;
      </button>
      {error ? <div style={{ marginTop: 12, fontSize: 14, color: UI.orangeDeep, fontWeight: 600 }}>{error}</div> : null}
    </form>
  );
}
