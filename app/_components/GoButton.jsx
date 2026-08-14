'use client';

import { useState } from 'react';
import { UI } from '../../lib/ui.js';

export default function GoButton({ token }) {
  const [status, setStatus] = useState('idle'); // idle | working | no_matches | error
  const [message, setMessage] = useState('');

  async function go() {
    setStatus('working');
    setMessage('');
    try {
      const res = await fetch(`/api/activate/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation failed');
      if (data.outcome === 'no_matches') {
        setStatus('no_matches');
        setMessage('');
        return;
      }
      window.location.href = `/contracts/${token}`;
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || "We couldn't complete the search right now. Please try again."));
    }
  }

  const busy = status === 'working';

  return (
    <div>
      <button
        onClick={go}
        disabled={busy}
        style={{
          background: UI.pink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px 28px',
          fontSize: 16,
          fontWeight: 800,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.75 : 1,
        }}
      >
        {busy ? 'Finding your strongest contract opportunities...' : 'Start My Contracts'}
      </button>
      {busy ? (
        <div style={{ marginTop: 10, fontSize: 13.5, color: UI.muted }}>
          We're reviewing current federal opportunities against your targeting profile.
        </div>
      ) : null}
      {status === 'no_matches' ? (
        <div style={{ marginTop: 16, background: UI.paper, border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.orange}`, borderRadius: '0 8px 8px 0', padding: '12px 14px', color: UI.text }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: UI.ink }}>No strong matches right now</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 5 }}>
            We reviewed the available opportunities against your current targeting, but none met the requirements we use for this cycle. Your targeting is saved and no batch has been used.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`/setup/${token}`} style={{ display: 'inline-block', background: UI.ink, color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '9px 14px', borderRadius: 7, fontSize: 14 }}>Review Targeting</a>
            <button type="button" onClick={go} style={{ background: '#fff', color: UI.text, border: `1px solid ${UI.line}`, borderRadius: 7, padding: '9px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Try Again
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <div style={{ marginTop: 16, background: UI.paper, border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.orange}`, borderRadius: '0 8px 8px 0', padding: '12px 14px', color: UI.text }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: UI.ink }}>We couldn't complete the search right now</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 5 }}>
            Please try again. Your targeting is saved and no batch has been used.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={go} style={{ background: UI.ink, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Try Again
            </button>
            <a href={`/setup/${token}`} style={{ display: 'inline-block', color: UI.text, textDecoration: 'none', fontWeight: 700, padding: '9px 14px', border: `1px solid ${UI.line}`, borderRadius: 7, fontSize: 14 }}>Review Targeting</a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
