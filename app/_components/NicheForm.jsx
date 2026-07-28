'use client';

import { useState } from 'react';
import { UI, SET_ASIDE_OPTIONS } from '../../lib/ui.js';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  border: `1px solid ${UI.line}`,
  borderRadius: 6,
  boxSizing: 'border-box',
  background: '#fff',
  color: UI.text,
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: UI.text, margin: '16px 0 6px' };
const hintStyle = { fontSize: 12, color: UI.muted, marginTop: 4 };

export default function NicheForm({ token, initial = {}, ctaLabel = 'Save', afterSaveHref }) {
  const [name, setName] = useState(initial.name || '');
  const [naics, setNaics] = useState((initial.naics || []).join(', '));
  const [keywords, setKeywords] = useState((initial.keywords || []).join(', '));
  const [setAsides, setSetAsides] = useState(new Set(initial.set_asides || []));
  const [state, setState] = useState(initial.state || '');
  const [sizeMin, setSizeMin] = useState(initial.size_min ?? '');
  const [sizeMax, setSizeMax] = useState(initial.size_max ?? '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [message, setMessage] = useState('');

  function toggleSetAside(v) {
    setSetAsides((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  async function save(e) {
    e.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch(`/api/profile/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          naics,
          keywords,
          set_asides: [...setAsides],
          state,
          size_min: sizeMin,
          size_max: sizeMax,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setStatus('saved');
      setMessage('Saved. Your targeting is set for the next cycle.');
      if (afterSaveHref) window.location.href = afterSaveHref;
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || err));
    }
  }

  return (
    <form onSubmit={save}>
      <label style={labelStyle}>Your name or company</label>
      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Facility Services" />

      <label style={labelStyle}>NAICS codes</label>
      <input style={inputStyle} value={naics} onChange={(e) => setNaics(e.target.value)} placeholder="236220, 561720" />
      <div style={hintStyle}>Comma separated. The industry codes for the work you do.</div>

      <label style={labelStyle}>Keywords / capabilities</label>
      <input style={inputStyle} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="construction, renovation, building, repair" />
      <div style={hintStyle}>Comma separated. Words that describe the work you actually perform.</div>

      <label style={labelStyle}>Set-asides you hold</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {SET_ASIDE_OPTIONS.map((o) => (
          <label
            key={o.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: UI.text,
              border: `1px solid ${setAsides.has(o.value) ? UI.green : UI.line}`,
              background: setAsides.has(o.value) ? '#eef6f1' : '#fff',
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={setAsides.has(o.value)} onChange={() => toggleSetAside(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      <div style={hintStyle}>We only send you set-asides you actually qualify for, plus full-and-open work.</div>

      <label style={labelStyle}>State / service area</label>
      <input style={{ ...inputStyle, maxWidth: 120 }} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="VA" maxLength={2} />
      <div style={hintStyle}>Two-letter state where you can perform work. Leave blank for nationwide.</div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Min contract size ($)</label>
          <input style={inputStyle} value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} placeholder="Optional" inputMode="numeric" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Max contract size ($)</label>
          <input style={inputStyle} value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} placeholder="Optional" inputMode="numeric" />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === 'saving'}
        style={{
          marginTop: 22,
          background: UI.ink,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '12px 22px',
          fontSize: 15,
          fontWeight: 700,
          cursor: status === 'saving' ? 'default' : 'pointer',
          opacity: status === 'saving' ? 0.7 : 1,
        }}
      >
        {status === 'saving' ? 'Saving...' : ctaLabel}
      </button>
      {message ? (
        <div style={{ marginTop: 12, fontSize: 14, color: status === 'error' ? UI.amber : UI.green }}>{message}</div>
      ) : null}
    </form>
  );
}
