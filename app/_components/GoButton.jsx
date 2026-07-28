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
        setMessage('Your trial is already active. Redirecting to your contracts...');
      } else {
        const n = data.delivered?.inserted?.length ?? 0;
        setMessage(n > 0
          ? `Trial started. We pulled ${n} target${n === 1 ? '' : 's'} for you. Redirecting...`
          : 'Trial started. Nothing cleared our screen this moment; we will keep watching. Redirecting...');
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
          background: UI.green,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '14px 26px',
          fontSize: 16,
          fontWeight: 800,
          cursor: status === 'working' ? 'default' : 'pointer',
          opacity: status === 'working' || status === 'done' ? 0.75 : 1,
        }}
      >
        {status === 'working' ? 'Starting your trial...' : 'Yes, start my free trial'}
      </button>
      {message ? (
        <div style={{ marginTop: 14, fontSize: 15, color: status === 'error' ? UI.amber : UI.green }}>{message}</div>
      ) : null}
    </div>
  );
}
