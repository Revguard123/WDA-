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

const MAX_NAICS = 5;

export default function NicheForm({ token, initial = {}, ctaLabel = 'Save', afterSaveHref, activateAfterSave = false }) {
  const [name, setName] = useState(initial.name || '');
  // NAICS as a list of { code, title }. Initial codes have no title yet.
  const [naicsList, setNaicsList] = useState((initial.naics || []).map((c) => ({ code: String(c), title: '' })));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  const [keywords, setKeywords] = useState((initial.keywords || []).join(', '));
  const [setAsides, setSetAsides] = useState(new Set(initial.set_asides || []));
  const [state, setState] = useState(initial.state || '');
  const [sizeMin, setSizeMin] = useState(initial.size_min ?? '');
  const [sizeMax, setSizeMax] = useState(initial.size_max ?? '');
  const [status, setStatus] = useState('idle'); // idle | saving | activating | saved | error
  const [message, setMessage] = useState('');

  const full = naicsList.length >= MAX_NAICS;

  function addNaics(code, title) {
    const clean = String(code).replace(/\D/g, '');
    if (!/^\d{6}$/.test(clean)) return;
    setNaicsList((prev) => {
      if (prev.length >= MAX_NAICS) return prev;
      if (prev.some((n) => n.code === clean)) return prev;
      return [...prev, { code: clean, title: title || '' }];
    });
  }

  function removeNaics(code) {
    setNaicsList((prev) => prev.filter((n) => n.code !== code));
  }

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const res = await fetch('/api/naics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.matches || []);
      if (!data.matches || data.matches.length === 0) {
        setSearchError('No matches. Try a simpler word, like "construction" or "cleaning".');
      }
    } catch (err) {
      setSearchError('Could not search right now. You can type a NAICS code directly below.');
    } finally {
      setSearching(false);
    }
  }

  function addManual() {
    const clean = manualCode.replace(/\D/g, '');
    if (!/^\d{6}$/.test(clean)) return;
    addNaics(clean, '');
    setManualCode('');
  }

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
    if (naicsList.length === 0) {
      setStatus('error');
      setMessage('Add at least one industry above so we know what work to look for.');
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
          naics: naicsList.map((n) => n.code).join(', '),
          keywords,
          set_asides: [...setAsides],
          state,
          size_min: sizeMin,
          size_max: sizeMax,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');

      if (activateAfterSave) {
        setStatus('activating');
        setMessage('Saved. Pulling your first contracts now, this takes up to a minute...');
        const act = await fetch(`/api/activate/${token}`, { method: 'POST' });
        const actData = await act.json().catch(() => ({}));
        if (!act.ok) {
          setStatus('error');
          setMessage(actData.error || 'Could not start your contracts. Please try again.');
          return;
        }
        window.location.href = `/contracts/${token}`;
        return;
      }

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

  const busy = status === 'saving' || status === 'activating';
  const buttonLabel =
    status === 'saving' ? 'Saving...' : status === 'activating' ? 'Pulling your first contracts...' : ctaLabel;

  return (
    <form onSubmit={save}>
      <label style={labelStyle}>Your name or company</label>
      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Facility Services" />

      {/* Industry search -> NAICS */}
      <label style={labelStyle}>What kind of work do you do?</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={inputStyle}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doSearch();
            }
          }}
          placeholder="e.g. office cleaning, commercial construction, IT support"
          disabled={full}
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={searching || full || !query.trim()}
          style={{
            flexShrink: 0,
            background: UI.pink,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0 18px',
            fontSize: 14,
            fontWeight: 800,
            cursor: searching || full ? 'default' : 'pointer',
            opacity: searching || full || !query.trim() ? 0.6 : 1,
          }}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>
      <div style={hintStyle}>
        Just describe your work in plain words. We will find the right industry codes for you. Pick up to {MAX_NAICS}.
      </div>

      {/* Search results */}
      {results.length > 0 ? (
        <div style={{ marginTop: 10, border: `1px solid ${UI.line}`, borderRadius: 8, overflow: 'hidden' }}>
          {results.map((r) => {
            const already = naicsList.some((n) => n.code === r.code);
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => addNaics(r.code, r.title)}
                disabled={already || full}
                style={{
                  display: 'flex',
                  width: '100%',
                  textAlign: 'left',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  background: already ? UI.panel : '#fff',
                  border: 'none',
                  borderBottom: `1px solid ${UI.line}`,
                  padding: '11px 13px',
                  cursor: already || full ? 'default' : 'pointer',
                  fontFamily: BODY_FONT,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, color: UI.ink, fontWeight: 600 }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: UI.muted }}>NAICS {r.code}</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: already ? UI.muted : UI.pink }}>
                  {already ? 'Added' : '+ Add'}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {searchError ? <div style={{ ...hintStyle, color: UI.orangeDeep, fontWeight: 600 }}>{searchError}</div> : null}

      {/* Selected NAICS */}
      {naicsList.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12.5, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>
            Your industries ({naicsList.length}/{MAX_NAICS})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {naicsList.map((n) => (
              <span
                key={n.code}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: UI.text,
                  border: `1px solid ${UI.pink}`,
                  background: '#fdeaf6',
                  borderRadius: 8,
                  padding: '7px 8px 7px 11px',
                }}
              >
                <span>
                  <strong style={{ color: UI.ink }}>{n.title || `NAICS ${n.code}`}</strong>
                  {n.title ? <span style={{ color: UI.muted }}> &middot; {n.code}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeNaics(n.code)}
                  aria-label={`Remove ${n.code}`}
                  style={{ border: 'none', background: 'transparent', color: UI.pinkDeep, fontSize: 16, lineHeight: 1, cursor: 'pointer', fontWeight: 800 }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Pro option: enter a code directly */}
      <div style={{ marginTop: 10 }}>
        {showManual ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, maxWidth: 160 }}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addManual();
                }
              }}
              placeholder="e.g. 236220"
              inputMode="numeric"
              maxLength={6}
              disabled={full}
            />
            <button
              type="button"
              onClick={addManual}
              disabled={full || !/^\d{6}$/.test(manualCode.replace(/\D/g, ''))}
              style={{ background: UI.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: full || !/^\d{6}$/.test(manualCode.replace(/\D/g, '')) ? 0.6 : 1 }}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            style={{ border: 'none', background: 'transparent', color: UI.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            Already know your NAICS code? Add it directly
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
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
          The whole idea of the course is to own one niche: learn how buyers in it talk, learn what a good price looks
          like, and win it again and again. Two or three related industries keeps you focused and still gives us plenty
          to pull from.
        </div>
      </div>

      <label style={labelStyle}>Keywords / capabilities <span style={{ color: UI.muted, fontWeight: 600 }}>(optional)</span></label>
      <input style={inputStyle} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="renovation, repair, HVAC, day porter" />
      <div style={hintStyle}>
        Comma separated. Optional, but it sharpens how we rank your matches. It never shrinks your list, so more detail
        only helps.
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
        Two-letter state where you can perform work, or leave it blank for nationwide. The tighter you draw your area,
        the fewer contracts open up in it. Blank casts the widest net.
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
        disabled={busy}
        style={{
          marginTop: 24,
          width: '100%',
          background: activateAfterSave ? UI.pink : UI.ink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px 24px',
          fontSize: 16,
          fontWeight: 800,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.75 : 1,
        }}
      >
        {buttonLabel}
      </button>
      {message ? (
        <div style={{ marginTop: 12, fontSize: 14, color: status === 'error' ? UI.orangeDeep : UI.pinkDeep, fontWeight: 600 }}>{message}</div>
      ) : null}
    </form>
  );
}
