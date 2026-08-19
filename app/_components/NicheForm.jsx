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
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: UI.ink, margin: '18px 0 6px', letterSpacing: 0.2 };
const hintStyle = { fontSize: 12.5, color: UI.muted, marginTop: 5, lineHeight: 1.5 };

const MAX_NAICS = 5;

function normalizeInitialNaics(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item && typeof item === 'object') {
      return { code: String(item.code || ''), title: item.title || '' };
    }
    return { code: String(item), title: '' };
  }).filter((n) => /^\d{6}$/.test(n.code));
}

function keywordsList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function moneyLabel(value) {
  if (value === '' || value == null) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `$${numeric.toLocaleString()}`;
}

function contractSizeLabel(min, max) {
  const minLabel = moneyLabel(min);
  const maxLabel = moneyLabel(max);
  if (minLabel && maxLabel) return `${minLabel} to ${maxLabel}`;
  if (minLabel) return `${minLabel}+`;
  if (maxLabel) return `Up to ${maxLabel}`;
  return 'No contract size range set';
}

function setAsideLabel(value) {
  return SET_ASIDE_OPTIONS.find((option) => option.value === value)?.label || value;
}

export default function NicheForm({ token, initial = {}, ctaLabel = 'Save', afterSaveHref, discoveryReview = null, reviewMode = false, readOnly = false }) {
  const [name, setName] = useState(initial.name || '');
  // NAICS as a list of { code, title }. Initial codes have no title yet.
  const [naicsList, setNaicsList] = useState(normalizeInitialNaics(initial.naics));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [editSections, setEditSections] = useState({
    industries: !reviewMode,
    keywords: !reviewMode,
    setAsides: !reviewMode,
    serviceArea: !reviewMode,
    size: !reviewMode,
  });

  const [keywords, setKeywords] = useState((initial.keywords || []).join(', '));
  const [setAsides, setSetAsides] = useState(new Set(initial.set_asides || []));
  const [state, setState] = useState(initial.state || '');
  const [sizeMin, setSizeMin] = useState(initial.size_min ?? '');
  const [sizeMax, setSizeMax] = useState(initial.size_max ?? '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
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
    if (readOnly) {
      if (afterSaveHref) window.location.href = afterSaveHref;
      return;
    }
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

  const busy = status === 'saving';
  const buttonLabel = status === 'saving' ? 'Saving...' : ctaLabel;
  const showNaicsSearch = editSections.industries || naicsList.length === 0;
  const keywordItems = keywordsList(keywords);
  const setAsideItems = [...setAsides];
  const serviceAreaLabel = state ? state : 'Nationwide';

  function editSection(section) {
    setEditSections((prev) => ({ ...prev, [section]: true }));
  }

  function SummarySection({ id, title, children, editHint, editor }) {
    const editing = editSections[id];
    return (
      <section className={`targeting-summary-section targeting-section-${id}`} style={{ border: `1px solid ${UI.line}`, borderRadius: 10, background: UI.paper, padding: reviewMode ? 13 : 16, marginTop: reviewMode ? 0 : 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: 600, color: UI.ink, letterSpacing: 0.2 }}>{title}</div>
            <div style={{ marginTop: 8 }}>{children}</div>
          </div>
          {!editing && !readOnly ? (
            <button
              type="button"
              onClick={() => editSection(id)}
              style={{ border: `1px solid ${UI.line}`, background: '#fff', color: UI.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer', borderRadius: 8, padding: '8px 12px', flexShrink: 0 }}
            >
              Edit
            </button>
          ) : null}
        </div>
        {editHint && !editing ? <div className="targeting-summary-hint" style={hintStyle}>{editHint}</div> : null}
        {editing ? <div style={{ marginTop: 12 }}>{editor}</div> : null}
      </section>
    );
  }

  const naicsEditor = (
    <>
      <label style={labelStyle}>{discoveryReview ? 'Edit official NAICS for this selected niche' : 'What kind of work do you do?'}</label>
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
            fontWeight: 600,
            cursor: searching || full ? 'default' : 'pointer',
            opacity: searching || full || !query.trim() ? 0.6 : 1,
          }}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>
      <div style={hintStyle}>
        {discoveryReview
          ? `Discovery loaded the authoritative NAICS for this niche. Search only if you need to fine-tune the official industry codes. Pick up to ${MAX_NAICS}.`
          : `Just describe your work in plain words. We will find the right industry codes for you. Pick up to ${MAX_NAICS}.`}
      </div>

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
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: already ? UI.muted : UI.pink }}>
                  {already ? 'Added' : '+ Add'}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {searchError ? <div style={{ ...hintStyle, color: UI.orangeDeep, fontWeight: 600 }}>{searchError}</div> : null}

      {naicsList.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12.5, color: UI.muted, fontWeight: 600, marginBottom: 6 }}>
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
                  <strong style={{ color: UI.ink, fontWeight: 600 }}>{n.title || `NAICS ${n.code}`}</strong>
                  {n.title ? <span style={{ color: UI.muted }}> &middot; {n.code}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeNaics(n.code)}
                  aria-label={`Remove ${n.code}`}
                  style={{ border: 'none', background: 'transparent', color: UI.pinkDeep, fontSize: 16, lineHeight: 1, cursor: 'pointer', fontWeight: 600 }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

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
              style={{ background: UI.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: full || !/^\d{6}$/.test(manualCode.replace(/\D/g, '')) ? 0.6 : 1 }}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            style={{ border: 'none', background: 'transparent', color: UI.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            Already know your NAICS code? Add it directly
          </button>
        )}
      </div>

      {!reviewMode ? (
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
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 600, color: UI.ink, letterSpacing: 0.2 }}>
            Two or three is the sweet spot.
          </div>
          <div style={{ fontSize: 13, color: UI.text, lineHeight: 1.55, marginTop: 5 }}>
            The whole idea of the course is to own one niche: learn how buyers in it talk, learn what a good price looks
            like, and win it again and again. Two or three related industries keeps you focused and still gives us plenty
            to pull from.
          </div>
        </div>
      ) : null}
    </>
  );

  const keywordEditor = (
    <>
      <input style={inputStyle} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="renovation, repair, HVAC, day porter" />
      <div style={hintStyle}>
        Comma separated. Optional, but it sharpens how we rank your matches. It never shrinks your list, so more detail only helps.
      </div>
    </>
  );

  const setAsideEditor = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {SET_ASIDE_OPTIONS.map((o) => (
          <label key={o.value} style={selChipStyle(setAsides.has(o.value))}>
            <input type="checkbox" checked={setAsides.has(o.value)} onChange={() => toggleSetAside(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      <div style={hintStyle}>We only send you set-asides you actually qualify for, plus full-and-open work.</div>
    </>
  );

  const serviceAreaEditor = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={() => setState('')} style={selChipStyle(!state)}>
          Nationwide
        </button>
        <button type="button" onClick={() => setState(state || 'VA')} style={selChipStyle(Boolean(state))}>
          Single state
        </button>
      </div>
      {state ? (
        <input style={{ ...inputStyle, maxWidth: 120, marginTop: 10 }} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="VA" maxLength={2} />
      ) : null}
      <div style={hintStyle}>Leave blank for nationwide. Use a two-letter state only when your service area is truly state-limited.</div>
    </>
  );

  const sizeEditor = (
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
  );

  return (
    <form onSubmit={save}>
      {reviewMode ? <style>{`.targeting-review-grid{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:12px;margin-top:14px}.targeting-section-keywords{grid-column:span 2}.targeting-summary-section{min-width:0;display:flex;flex-direction:column}.targeting-summary-section>div:first-child{flex:1 1 auto}.targeting-summary-hint{margin-top:10px!important}@media(max-width:900px){.targeting-review-grid{grid-template-columns:1fr}.targeting-section-keywords{grid-column:auto}}`}</style> : null}
      {!reviewMode ? (
        <>
          <label style={labelStyle}>Your name or company</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Facility Services" />
          {naicsEditor}
          <label style={labelStyle}>Keywords / capabilities <span style={{ color: UI.muted, fontWeight: 600 }}>(optional)</span></label>
          {keywordEditor}
          <label style={labelStyle}>Set-asides you hold</label>
          {setAsideEditor}
          <label style={labelStyle}>State / service area</label>
          <input style={{ ...inputStyle, maxWidth: 120 }} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="VA" maxLength={2} />
          <div style={hintStyle}>
            Two-letter state where you can perform work, or leave it blank for nationwide. The tighter you draw your area, the fewer contracts open up in it. Blank casts the widest net.
          </div>
          {sizeEditor}
        </>
      ) : (
        <div className="targeting-review-grid">
          <SummarySection id="industries" title="Industries / NAICS" editHint={discoveryReview ? 'Authoritative NAICS resolved from your selected Discovery niche.' : 'These are the industry codes we will search against.'} editor={naicsEditor}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {naicsList.map((n) => (
                <span key={n.code} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: UI.ink, background: '#fff', border: `1px solid ${UI.line}`, borderRadius: 8, padding: '7px 10px' }}>
                  NAICS {n.code}{n.title ? ` · ${n.title}` : ''}
                </span>
              ))}
            </div>
          </SummarySection>
          <SummarySection id="keywords" title="Capabilities / Keywords" editHint={discoveryReview ? 'Pulled from your Discovery capabilities and positive interests.' : 'These sharpen matching without narrowing your eligible universe.'} editor={keywordEditor}>
            {keywordItems.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {keywordItems.map((item) => (
                  <span key={item} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: UI.text, background: '#fff', border: `1px solid ${UI.line}`, borderRadius: 8, padding: '7px 10px' }}>{item}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: UI.muted }}>No keywords set.</div>
            )}
          </SummarySection>
          <SummarySection id="serviceArea" title="Service Area" editHint="Nationwide keeps stale state filters out of this search." editor={serviceAreaEditor}>
            <div style={{ fontSize: 15, color: UI.ink, fontWeight: 600 }}>{serviceAreaLabel}</div>
          </SummarySection>
          <SummarySection id="setAsides" title="Set-Asides" editHint="Only supported selected eligibility values are carried forward." editor={setAsideEditor}>
            {setAsideItems.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {setAsideItems.map((item) => (
                  <span key={item} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: UI.text, background: '#fff', border: `1px solid ${UI.line}`, borderRadius: 8, padding: '7px 10px' }}>{setAsideLabel(item)}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: UI.muted }}>No set-asides selected.</div>
            )}
          </SummarySection>
          <SummarySection id="size" title="Contract Size" editHint="Blank size answers clear stale minimum or maximum filters." editor={sizeEditor}>
            <div style={{ fontSize: 15, color: UI.ink, fontWeight: 600 }}>{contractSizeLabel(sizeMin, sizeMax)}</div>
          </SummarySection>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        style={{
          marginTop: 24,
          width: '100%',
          background: UI.ink,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px 24px',
          fontSize: 16,
          fontWeight: 600,
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
