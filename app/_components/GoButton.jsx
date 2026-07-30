'use client';

import { useState } from 'react';
import { UI } from '../../lib/ui.js';

export default function GoButton({ token }) {
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [message, setMessage] = useState('');

  async function go() {
    setStatus('working');
    setMessage('');
    try {
      const res = await fetch(`/api/activate/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation failed');
      setStatus('done');
      if (data.alreadyActive) {
        setMessage('You are already set up. Taking you to your contracts...');
      } else {
        const n = data.delivered?.inserted?.length ?? 0;
        setMessage(n > 0
          ? `You are in. We pulled ${n} contract${n === 1 ? '' : 's'} for you. Taking you to them now...`
          : 'You are in and your niche is live. We could not match contracts to it this cycle. Try broadening your targeting, then check back. Taking you to your contracts...');
      }
      setTimeout(() => { window.location.href = `/contracts/${token}`; }, 1800);
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || err));
    }
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={status === 'working' || status === 'done'}
        style={{
          background: UI.pink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px 28px',
          fontSize: 16,
          fontWeight: 800,
          cursor: status === 'working' ? 'default' : 'pointer',
          opacity: status === 'working' || status === 'done' ? 0.75 : 1,
        }}
      >
        {status === 'working' ? 'Pulling your first contracts...' : 'Yes, start my contracts'}
      </button>
      {message ? (
        <div style={{ marginTop: 14, fontSize: 15, color: status === 'error' ? UI.orangeDeep : UI.pinkDeep }}>{message}</div>
      ) : null}
    </div>
  );
}
