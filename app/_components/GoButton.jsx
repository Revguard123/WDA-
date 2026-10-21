'use client';

import { useState } from 'react';
import Button from './Button.jsx';
import { buyerPagePath } from '../../lib/buyerUrls.js';

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
      window.location.href = buyerPagePath('contracts', token);
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || "We couldn't complete the search right now. Please try again."));
    }
  }

  const busy = status === 'working';

  return (
    <div className="ctc-activation">
      <Button
        variant="solid"
        onClick={go}
        disabled={busy}
        loading={busy}
        loadingText="Finding contract opportunities…"
        className="ctc-activation-primary"
      >
        Start My Contracts
      </Button>
      {busy ? (
        <div className="ctc-activation-progress" role="status" aria-live="polite">
          We're reviewing current federal opportunities against your targeting profile.
        </div>
      ) : null}
      {status === 'no_matches' ? (
        <div className="ctc-activation-result" role="status">
          <h3>No strong matches right now</h3>
          <p>
            We reviewed the available opportunities against your current targeting, but none met the requirements we use for this cycle. Your targeting is saved and no batch has been used.
          </p>
          <div className="ctc-activation-result-actions">
            <Button variant="ghost" href={buyerPagePath('setup', token)} showArrow={false}>Review Targeting</Button>
            <Button variant="outline" onClick={go}>Try Again</Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <div className="ctc-activation-result" role="alert">
          <h3>We couldn't complete the search right now</h3>
          <p>
            Please try again. Your targeting is saved and no batch has been used.
          </p>
          <div className="ctc-activation-result-actions">
            <Button variant="solid" onClick={go}>Try Again</Button>
            <Button variant="ghost" href={buyerPagePath('setup', token)} showArrow={false}>Review Targeting</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
