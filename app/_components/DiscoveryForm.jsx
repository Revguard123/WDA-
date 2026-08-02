'use client';

import { useState } from 'react';
import { UI, SET_ASIDE_OPTIONS, BODY_FONT, DISPLAY_FONT } from '../../lib/ui.js';

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
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 800, color: UI.ink, margin: '18px 0 6px', letterSpacing: 0.2 };
const hintStyle = { fontSize: 12.5, color: UI.muted, marginTop: 5, lineHeight: 1.5 };

export default function DiscoveryForm({ token, initial = {} }) {
  const [background, setBackground] = useState('');
  const [interests, setInterests] = useState('');
  const [state, setState] = useState(initial.state || '');
  const [setAsides, setSetAsides] = useState(new Set(initial.set_asides || []));

  const [status, setStatus] = useState('idle'); // idle | thinking | done | error
  const [message, setMessage] = useState('');
  const [recs, setRecs] = useState([]);
  const [applyingIdx, setApplyingIdx] = useState(-1);

  function toggleSetAside(v) {
    setSetAsides((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  async function discover(e) {
    e.preventDefault();
    if (!background.trim() && !interests.trim() && setAsides.size === 0) {
      setStatus('error');
      setMessage('Tell us at least a little about your background or what interests you, so we can point you somewhere real.');
      return;
    }
    setStatus('thinking');
    setMessage('');
    setRecs([]);
    try {
      const res = await fetch(`/api/discover/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          background,
          interests,
          state,
          setAsides: [...setAsides],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery failed');
      const list = data.recommendations || [];
      if (list.length === 0) {
        setStatus('error');
        setMessage('We could not land on a clear niche from that. Add a bit more detail and try again.');
        return;
      }
      setRecs(list);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage('Could not run discovery right now. Please try again in a moment.');
    }
  }

  // Apply a recommendation: write its NAICS codes to the buyer's targeting, then
  // send them to the niche workshop to review before pulling contracts.
  async function useThis(rec, idx) {
    setApplyingIdx(idx);
    setMessage('');
    try {
      const codes = rec.naics.map((n) => n.code).join(', ');
      const res = await fetch(`/api/profile/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naics: codes,
          set_asides: [...setAsides],
          state,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save');
      window.location.href = `/setup/${token}`;
    } catch (err) {
      setApplyingIdx(-1);
      setStatus('error');
      setMessage(String(err.message || err));
    }
  }

  const selChipStyle = (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: active ? UI.pinkDeep : UI.text,
    border: `1px solid ${active ? UI.pink : UI.line}`,
    background: active ? '#fdeaf6' : '#fff',
    borderRadius: 8,
    padding: '7px 11px',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
  });

  const thinking = status === 'thinking';

  return (
    <div>
      <form onSubmit={discover}>
        <label style={labelStyle}>What is your background? What are you good at?</label>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          placeholder="e.g. 10 years running a landscaping crew. Comfortable with grounds work, snow removal, light construction. Based in Ohio."
        />
        <div style={hintStyle}>Trades, past jobs, industries you have worked in, equipment you own, anything you can already do well.</div>

        <label style={labelStyle}>What draws you in, or what do you want to avoid?</label>
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="e.g. I like steady recurring work over one-off projects. No IT, no medical."
        />
        <div style={hintStyle}>Optional. It helps us steer toward work you would actually want to do again and again.</div>

        <label style={labelStyle}>Set-asides you hold</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {SET_ASIDE_OPTIONS.map((o) => (
            <label key={o.value} style={selChipStyle(setAsides.has(o.value))}>
              <input type="checkbox" checked={setAsides.has(o.value)} onChange={() => toggleSetAside(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
        <div style={hintStyle}>A certification you hold shrinks the field, so we weight niches where it gives you an edge.</div>

        <label style={labelStyle}>State / service area</label>
        <input style={{ ...inputStyle, maxWidth: 120 }} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="OH" maxLength={2} />
        <div style={hintStyle}>Two-letter state where you can perform work, or leave it blank for nationwide.</div>

        <button
          type="submit"
          disabled={thinking}
          style={{
            marginTop: 24,
            width: '100%',
            background: UI.pink,
            color: '#fff',
            border: 'none',
            borderRadius: 9,
            padding: '14px 24px',
            fontSize: 16,
            fontWeight: 800,
            cursor: thinking ? 'default' : 'pointer',
            opacity: thinking ? 0.75 : 1,
          }}
        >
          {thinking ? 'Finding your niche...' : recs.length > 0 ? 'Try again with new answers' : 'Discover my niche'}
        </button>
      </form>

      {message ? (
        <div style={{ marginTop: 12, fontSize: 14, color: status === 'error' ? UI.orangeDeep : UI.pinkDeep, fontWeight: 600 }}>{message}</div>
      ) : null}

      {recs.length > 0 ? (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 20, color: UI.ink, letterSpacing: '-0.2px', marginBottom: 4 }}>
            Niches worth going after
          </div>
          <div style={{ fontSize: 13.5, color: UI.muted, lineHeight: 1.5, marginBottom: 16 }}>
            Pick one to load it into your targeting. You will land on your niche workshop to review it before we pull any
            contracts, so nothing is locked in yet.
          </div>

          {recs.map((rec, idx) => (
            <div
              key={idx}
              style={{
                background: UI.card,
                border: `1px solid ${UI.line}`,
                borderTop: `3px solid ${UI.pink}`,
                borderRadius: 10,
                padding: 20,
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: UI.ink, lineHeight: 1.3 }}>{rec.industry}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {rec.naics.map((n) => (
                  <span
                    key={n.code}
                    style={{
                      display: 'inline-block',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: UI.ink,
                      background: '#fff',
                      border: `1px solid ${UI.line}`,
                      borderRadius: 6,
                      padding: '5px 10px',
                    }}
                  >
                    NAICS {n.code} &middot; {n.title}
                  </span>
                ))}
              </div>
              {rec.explanation ? (
                <div style={{ background: UI.paper, borderLeft: `3px solid ${UI.orange}`, padding: '10px 12px', borderRadius: '0 4px 4px 0', fontSize: 14, color: UI.text, marginTop: 14, lineHeight: 1.55 }}>
                  <strong style={{ color: UI.orangeDeep }}>Why this fits you.</strong> {rec.explanation}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => useThis(rec, idx)}
                disabled={applyingIdx !== -1}
                style={{
                  marginTop: 16,
                  background: UI.pink,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '11px 18px',
                  fontSize: 14.5,
                  fontWeight: 800,
                  cursor: applyingIdx !== -1 ? 'default' : 'pointer',
                  opacity: applyingIdx !== -1 && applyingIdx !== idx ? 0.5 : 1,
                }}
              >
                {applyingIdx === idx ? 'Loading it in...' : 'Use this for my contracts'}
              </button>
              <div style={{ ...hintStyle, marginTop: 8 }}>
                This updates the industries we search for you. You can fine-tune or remove it on the next screen.
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
