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

function countCsv(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean).length;
}

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

  const naicsCount = countCsv(naics);
  const naicsTooMany = naicsCount > 5;
  const naicsNone = naicsCount === 0;

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
    if (naicsNone) {
      setStatus('error');
      setMessage('Add at least one NAICS code so we know what work to look for.');
      return;
    }
    if (naicsTooMany) {
      setStatus('error');
      setMessage('Keep it to five NAICS codes or fewer. Two or three is the sweet spot.');
      return;
    }
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

  return (
    <form onSubmit={save}>
      <label style={labelStyle}>Your name or company</label>
      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Facility Services" />

      <label style={labelStyle}>NAICS codes <span style={{ color: UI.muted, fontWeight: 600 }}>(pick 1 to 5)</span></label>
      <input
        style={{ ...inputStyle, borderColor: naicsTooMany ? UI.orangeDeep : UI.line }}
        value={naics}
        onChange={(e) => setNaics(e.target.value)}
        placeholder="236220, 561720"
      />
      <div style={hintStyle}>
        Comma separated. The industry codes for the work you do.
        {naicsCount > 0 ? (
          <span style={{ color: naicsTooMany ? UI.orangeDeep : UI.muted, fontWeight: 700 }}> You have {naicsCount} selected.</span>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 10,
          background: UI.panel,
          border: `1px solid ${UI.line}`,
          borderLeft: `3px solid ${UI.orange}`,
          borderRadius: '0 8px 8px 0',
          padding: '12px 14px',
        }}
      >
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800, color: UI.ink, letterSpacing: 0.2 }}>
          Two or three is the sweet spot.
        </div>
        <div style={{ fontSize: 13, color: UI.text, lineHeight: 1.55, marginTop: 5 }}>
          We keep this tight on purpose. The whole idea of the course is to own one niche: learn how buyers in it
          talk, learn what a good price looks like, and win it again and again. Chasing a dozen industries at once
          means you never get good at any of them. Two or three related codes keeps you focused and still gives us
          plenty to pull from.
        </div>
      </div>

      <label style={labelStyle}>Keywords / capabilities</label>
      <input style={inputStyle} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="construction, renovation, building, repair" />
      <div style={hintStyle}>
        Comma separated. Get as specific as you want. Keywords sharpen how we rank your matches, they never shrink your
        list, so more detail here only helps.
      </div>

      <label style={labelStyle}>Set-asides you hold</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {SET_ASIDE_OPTIONS.map((o) => (
          <label key={o.value} style={selChipStyle(setAsides.has(o.value))}>
            <input type="checkbox" checked={setAsides.has(o.value)} onChange={() => toggleSetAside(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      <div style={hintStyle}>We only send you set-asides you actually qualify for, plus full-and-open work.</div>

      <label style={labelStyle}>State / service area</label>
      <input style={{ ...inputStyle, maxWidth: 120 }} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="VA" maxLength={2} />
      <div style={hintStyle}>
        Two-letter state where you can perform work, or leave it blank for nationwide. Heads up: the tighter you draw
        your area, the fewer contracts open up in it, so a single state can mean a longer wait between briefs. Blank
        casts the widest net.
      </div>

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
          marginTop: 24,
          background: UI.ink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '13px 24px',
          fontSize: 15,
          fontWeight: 800,
          cursor: status === 'saving' ? 'default' : 'pointer',
          opacity: status === 'saving' ? 0.7 : 1,
        }}
      >
        {status === 'saving' ? 'Saving...' : ctaLabel}
      </button>
      {message ? (
        <div style={{ marginTop: 12, fontSize: 14, color: status === 'error' ? UI.orangeDeep : UI.pinkDeep, fontWeight: 600 }}>{message}</div>
      ) : null}
    </form>
  );
}
