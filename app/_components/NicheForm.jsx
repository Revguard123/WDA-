'use client';

import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';
import CTCIcon from './CTCIcon.jsx';
import { UI, SET_ASIDE_OPTIONS, BODY_FONT } from '../../lib/ui.js';
import { scheduleNaicsSearch, budgetStops, budgetPosition, budgetAmount, US_STATES } from '../../lib/targetingControls.js';

const inputStyle = {
  width: '100%',
  padding: '11px 13px',
  fontSize: 14,
  border: '1px solid var(--theme-border, #E6E1DB)',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: 'var(--theme-inset, #F8F8F8)',
  color: UI.text,
  fontFamily: BODY_FONT,
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: UI.text, margin: '0 0 8px' };
const hintStyle = { fontSize: 12, color: UI.muted, marginTop: 8, lineHeight: 1.7 };

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
  return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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

export function SummarySection({ id, title, children, editHint, editor, editing, reviewMode, readOnly, onEdit }) {
  const order = ['industries', 'keywords', 'serviceArea', 'setAsides', 'size'].indexOf(id) + (reviewMode ? 1 : 2);
  return (
    <section className={`targeting-summary-section targeting-section-${id}`} aria-labelledby={`targeting-title-${id}`}>
      <div className="targeting-section-heading">
        <div>
          <span className="targeting-section-number" aria-hidden="true">{String(order).padStart(2, '0')}</span>
          <h2 id={`targeting-title-${id}`}>{title}</h2>
        </div>
        {editHint ? <p className="targeting-summary-hint">{editHint}</p> : null}
      </div>
      <div className="targeting-section-body">
        {!editing ? <div className="targeting-section-overview">
          <div className="targeting-section-summary">{children}</div>
          {!readOnly ? (
          <button
            data-liquid=""
            className="targeting-edit"
            type="button"
            onClick={() => onEdit(id)}
            aria-label={`Edit ${title}`}
            aria-controls={`targeting-editor-${id}`}
            aria-expanded={false}
          >
            <CTCIcon name="edit" />Edit
          </button>
          ) : null}
        </div> : null}
        <div id={`targeting-editor-${id}`} className="targeting-section-editor" hidden={!editing}>
          {editing ? editor : null}
        </div>
      </div>
    </section>
  );
}

export default function NicheForm({ token, initial = {}, ctaLabel = 'Save', afterSaveHref, discoveryReview = null, reviewMode = false, readOnly = false, updateMode = false, expandedEditors = false, editHref, editLabel = 'Update for Future Batches' }) {
  const [name, setName] = useState(initial.name || '');
  // NAICS as a list of { code, title }. Initial codes have no title yet.
  const [naicsList, setNaicsList] = useState(normalizeInitialNaics(initial.naics));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const searchCache = useRef(new Map());
  const searchInput = useRef(null);
  const stateInput = useRef(null);
  const [searchRevision, setSearchRevision] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [editSections, setEditSections] = useState({
    industries: !reviewMode || (expandedEditors && !readOnly),
    keywords: !reviewMode || (expandedEditors && !readOnly),
    setAsides: !reviewMode || (expandedEditors && !readOnly),
    serviceArea: !reviewMode || (expandedEditors && !readOnly),
    size: !reviewMode || (expandedEditors && !readOnly),
  });

  const [keywords, setKeywords] = useState((initial.keywords || []).join(', '));
  const [setAsides, setSetAsides] = useState(new Set(initial.set_asides || []));
  const [state, setState] = useState(initial.state || '');
  const [singleState, setSingleState] = useState(Boolean(initial.state));
  const [stateOpen, setStateOpen] = useState(false);
  const [activeState, setActiveState] = useState(-1);
  const [stateFilter, setStateFilter] = useState('');
  const [sizeMin, setSizeMin] = useState(initial.size_min ?? '');
  const [sizeMax, setSizeMax] = useState(initial.size_max ?? '');
  const [sliderCeiling, setSliderCeiling] = useState(() => budgetStops(initial.size_min, initial.size_max).at(-1));
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [message, setMessage] = useState('');

  const full = naicsList.length >= MAX_NAICS;

  useEffect(() => {
    if (readOnly || !editSections.industries || full) return;
    return scheduleNaicsSearch(query, ({ results: matches, searching: pending, error }) => {
      setResults(matches);
      setSearching(pending);
      setSearchError(error);
      setActiveResult(-1);
    }, { cache: searchCache.current });
  }, [query, readOnly, editSections.industries, full, searchRevision]);

  useEffect(() => {
    const ceiling = budgetStops(sizeMin, sizeMax).at(-1);
    setSliderCeiling((previous) => Math.max(previous, ceiling));
  }, [sizeMin, sizeMax]);

  useEffect(() => {
    const id = stateOpen && activeState >= 0 ? `state-option-${activeState}`
      : searchOpen && activeResult >= 0 ? `naics-option-${results.filter((item) => !naicsList.some((selected) => selected.code === item.code))[activeResult]?.code}` : null;
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [stateOpen, activeState, searchOpen, activeResult, results, naicsList]);

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
    if (singleState && !/^[A-Z]{2}$/.test(state)) {
      setStatus('error');
      setMessage('Enter a two-letter state abbreviation, or choose Nationwide.');
      return;
    }
    if (rangeInvalid) {
      setStatus('error');
      setMessage('Use positive amounts or zero, and keep the maximum at or above the minimum. Leave either field blank for no limit.');
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

  const busy = status === 'saving';
  const keywordItems = keywordsList(keywords);
  const setAsideItems = [...setAsides];
  const serviceAreaLabel = state ? state : 'Nationwide';

  function editSection(section) {
    setEditSections((prev) => ({ ...prev, [section]: true }));
  }

  const selectableResults = results.filter((item) => !naicsList.some((selected) => selected.code === item.code));
  const stateOptions = US_STATES.filter((item) => !stateFilter || item.code.includes(stateFilter.toUpperCase()) || item.name.toUpperCase().startsWith(stateFilter.toUpperCase()));
  const stops = budgetStops(sliderCeiling, 0);
  const minPosition = budgetPosition(sizeMin, stops);
  const maxPosition = sizeMax === '' || sizeMax == null ? 1000 : budgetPosition(sizeMax, stops);
  const rangeInvalid = (sizeMin !== '' && (!Number.isFinite(Number(sizeMin)) || Number(sizeMin) < 0))
    || (sizeMax !== '' && (!Number.isFinite(Number(sizeMax)) || Number(sizeMax) < 0))
    || (sizeMin !== '' && sizeMax !== '' && Number(sizeMin) > Number(sizeMax));

  const naicsEditor = (
    <>
      <label htmlFor="targeting-naics-query" style={labelStyle}>{discoveryReview ? 'Find an industry or NAICS code' : 'What kind of work do you do?'}</label>
      <div className="targeting-combobox" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setSearchOpen(false); setActiveResult(-1); }
      }}>
      <div className="targeting-search-field">
        <CTCIcon name="search" />
        <input
          id="targeting-naics-query"
          ref={searchInput}
          aria-describedby="targeting-naics-hint"
          role="combobox" aria-autocomplete="list" autoComplete="off"
          aria-expanded={searchOpen && query.trim().length >= 2 && !full}
          aria-controls="targeting-naics-options"
          aria-activedescendant={searchOpen && selectableResults[activeResult] ? `naics-option-${selectableResults[activeResult].code}` : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResults([]); setSearchError(''); setSearching(e.target.value.trim().length >= 2); setSearchOpen(true); setActiveResult(-1); }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); setActiveResult(-1); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault(); setSearchOpen(true);
              setActiveResult((index) => Math.max(0, Math.min(selectableResults.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const item = searchOpen ? selectableResults[activeResult] : null;
              if (item) { addNaics(item.code, item.title); setActiveResult(-1); }
            }
          }}
          placeholder="Search by work type or industry code"
          maxLength={200}
          disabled={full}
        />
        {searching && !full ? <span className="targeting-search-spinner" aria-hidden="true" /> : query ? <button className="targeting-search-clear" type="button" aria-label="Clear industry search" onClick={() => { setQuery(''); setResults([]); setSearching(false); setSearchOpen(false); searchInput.current?.focus(); }}>×</button> : null}
      </div>
      {searchOpen && query.trim().length >= 2 && !full ? (
        <div className="targeting-dropdown">
          <div className="targeting-dropdown-heading" role="status" aria-live="polite">{searching ? 'Finding industries…' : searchError ? 'Search unavailable' : results.length ? `${results.length} matching industries` : 'No matching industries'}</div>
          <div id="targeting-naics-options" role="listbox" aria-label="Industry search results" aria-multiselectable="true" aria-busy={searching}>
          {results.map((r) => {
            const already = naicsList.some((n) => n.code === r.code);
            return (
              <div key={r.code} id={`naics-option-${r.code}`} role="option" aria-selected={already} aria-disabled={already}
                className={`targeting-dropdown-option${selectableResults[activeResult]?.code === r.code ? ' is-active' : ''}`}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => setActiveResult(selectableResults.findIndex((item) => item.code === r.code))}
                onClick={() => { if (!already) { addNaics(r.code, r.title); setActiveResult(-1); } }}>
                <span><strong>{r.title}</strong><small>NAICS {r.code}</small></span>
                <span className="targeting-option-action">{already ? <><CTCIcon name="check" />Added</> : '+ Add'}</span>
              </div>
            );
          })}
          </div>
          {!searching && !results.length ? <p className="targeting-dropdown-empty">{searchError || 'Try a broader description, such as “IT support” or “office cleaning”.'}</p> : null}
          {searchError ? <div className="targeting-search-recovery"><button className="targeting-inline-action" type="button" onClick={() => setSearchRevision((value) => value + 1)}>Try search again</button><button className="targeting-text-button" type="button" onClick={() => { setShowManual(true); setSearchOpen(false); }}>Enter a NAICS code instead</button></div> : null}
          <div className="targeting-dropdown-footer">Use ↑ ↓ to browse · Enter to add · Esc to close</div>
        </div>
      ) : null}
      </div>
      <div id="targeting-naics-hint" style={hintStyle}>{full ? `You have selected ${MAX_NAICS} industries. Remove one to add another.` : discoveryReview
        ? 'Your Discovery industry codes are already selected. Search to refine them, up to five in total.'
        : 'Type at least two characters to find industry codes. Choose up to five.'}</div>

      {naicsList.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12.5, color: UI.muted, fontWeight: 600, marginBottom: 6 }}>
            Your industries ({naicsList.length}/{MAX_NAICS})
          </div>
          <div className="targeting-selected-naics">
            {naicsList.map((n) => (
              <span
                key={n.code}
                className="targeting-naics-chip"
              >
                <span>
                  <strong>{n.title || `NAICS ${n.code}`}</strong>
                  {n.title ? <span style={{ color: UI.muted }}> &middot; {n.code}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeNaics(n.code)}
                  aria-label={`Remove ${n.code}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="targeting-manual">
        {showManual ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              aria-label="Six-digit NAICS code"
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
            <Button showArrow={false}
              onClick={addManual}
              disabled={full || !/^\d{6}$/.test(manualCode.replace(/\D/g, ''))}
            >
              Add
            </Button>
          </div>
        ) : (
          <button
            className="targeting-inline-action"
            type="button"
            onClick={() => setShowManual(true)}
          >
            <span aria-hidden="true">+</span> Enter a NAICS code
          </button>
        )}
      </div>

      {!reviewMode ? (
        <div className="targeting-industry-tip">
          <strong>
            Two or three is the sweet spot.
          </strong>
          <p>
            The whole idea of the course is to own one niche: learn how buyers in it talk, learn what a good price looks
            like, and win it again and again. Two or three related industries keeps you focused and still gives us plenty
            to pull from.
          </p>
        </div>
      ) : null}
    </>
  );

  const keywordEditor = (
    <>
      <label className="targeting-field-label" htmlFor="targeting-keywords">Keywords / capabilities (optional)</label>
      <textarea id="targeting-keywords" style={inputStyle} rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="renovation, repair, HVAC, day porter" />
      <div style={hintStyle}>
        Comma separated. Optional, but it sharpens how we rank your matches. It never shrinks your list, so more detail only helps.
      </div>
    </>
  );

  const setAsideEditor = (
    <>
      <div className="targeting-options targeting-eligibility">
        {SET_ASIDE_OPTIONS.map((o) => (
          <label key={o.value}>
            <input type="checkbox" checked={setAsides.has(o.value)} onChange={() => toggleSetAside(o.value)} />
            <span className="targeting-checkbox-mark" aria-hidden="true"><CTCIcon name="check" /></span>
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <div style={hintStyle}>We only send you set-asides you actually qualify for, plus full-and-open work.</div>
    </>
  );

  const serviceAreaEditor = (
    <>
      <div className="targeting-service-options" role="group" aria-label="Service area">
        <button data-liquid="" type="button" aria-pressed={!singleState} onClick={() => { setSingleState(false); setState(''); }}>
          Nationwide
        </button>
        <button data-liquid="" type="button" aria-pressed={singleState} onClick={() => setSingleState(true)}>
          Single state
        </button>
      </div>
      {singleState ? <div className="targeting-state-field">
        <label className="targeting-field-label" htmlFor="targeting-state">Select your state</label>
        <div className="targeting-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setStateOpen(false); }}>
          <div className="targeting-state-input">
            <input id="targeting-state" ref={stateInput} value={state} onChange={(e) => { setState(e.target.value.toUpperCase()); setStateFilter(e.target.value); setStateOpen(true); setActiveState(-1); }}
              role="combobox" aria-autocomplete="list" aria-expanded={stateOpen} aria-controls="targeting-state-options"
              aria-activedescendant={stateOpen && stateOptions[activeState] ? `state-option-${activeState}` : undefined}
              placeholder="State code, e.g. VA" maxLength={2} required pattern="[A-Za-z]{2}" aria-describedby="targeting-area-hint" autoComplete="off"
              onFocus={() => { setStateFilter(''); setStateOpen(true); setActiveState(US_STATES.findIndex((item) => item.code === state)); }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') { event.preventDefault(); setStateOpen(false); }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault(); setStateOpen(true);
                  setActiveState((index) => Math.max(0, Math.min(stateOptions.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (stateOpen && stateOptions[activeState]) { setState(stateOptions[activeState].code); setStateOpen(false); }
                }
              }} />
            <span className="targeting-state-name" aria-hidden="true">{US_STATES.find((item) => item.code === state)?.name}</span>
            <button data-liquid="" type="button" className="targeting-dropdown-toggle" aria-label={stateOpen ? 'Close state choices' : 'Show state choices'} aria-expanded={stateOpen} aria-controls="targeting-state-options"
              onClick={() => { setStateFilter(''); setStateOpen(!stateOpen); setActiveState(-1); if (!stateOpen) stateInput.current?.focus(); }}><CTCIcon name="chevron" /></button>
          </div>
          {stateOpen ? <div className="targeting-dropdown">
            <div className="targeting-dropdown-heading">Choose a state or territory</div>
            <div id="targeting-state-options" role="listbox" aria-label="States and territories">
              {stateOptions.map((item, index) => <div key={item.code} id={`state-option-${index}`} role="option" aria-selected={item.code === state}
                className={`targeting-dropdown-option${index === activeState ? ' is-active' : ''}`}
                onPointerDown={(event) => event.preventDefault()} onPointerMove={() => setActiveState(index)}
                onClick={() => { setState(item.code); setStateOpen(false); }}>
                <span>{item.name}<small>{item.code}</small></span>{item.code === state ? <CTCIcon name="check" /> : null}
              </div>)}
            </div>
            {!stateOptions.length ? <p className="targeting-dropdown-empty">No match. Enter a two-letter state code.</p> : null}
          </div> : null}
        </div>
      </div> : null}
      <div id="targeting-area-hint" style={hintStyle}>{singleState ? 'Opportunities will stay within this state.' : 'Search opportunities across all states. No state filter is applied.'}</div>
    </>
  );

  const sizeEditor = (
    <>
    <div className="targeting-budget-summary" aria-live="polite"><span>Preferred range</span><strong>{contractSizeLabel(sizeMin, sizeMax)}</strong></div>
    <div className={`targeting-budget-slider${rangeInvalid ? ' is-invalid' : ''}`} role="group" aria-label="Contract budget range"
      style={{ '--budget-start': `${minPosition / 10}%`, '--budget-end': `${maxPosition / 10}%` }}>
      <div className="targeting-budget-track" aria-hidden="true"><span /></div>
      <input type="range" className="targeting-budget-thumb targeting-budget-thumb-min" aria-label="Minimum contract value slider" min="0" max="1000" step="1" value={minPosition} style={{ zIndex: minPosition >= 999 ? 3 : undefined }}
        aria-describedby="targeting-budget-hint"
        aria-valuetext={sizeMin === '' ? 'No minimum' : moneyLabel(sizeMin)}
        onChange={(event) => { const amount = budgetAmount(event.target.value, stops); setSizeMin(String(sizeMax !== '' && Number.isFinite(Number(sizeMax)) ? Math.min(amount, Number(sizeMax)) : amount)); }} />
      <input type="range" className="targeting-budget-thumb targeting-budget-thumb-max" aria-label="Maximum contract value slider" min="0" max="1000" step="1" value={maxPosition}
        aria-describedby="targeting-budget-hint"
        aria-valuetext={sizeMax === '' ? 'No maximum' : moneyLabel(sizeMax)}
        onChange={(event) => setSizeMax(String(Math.max(budgetAmount(event.target.value, stops), Number(sizeMin) || 0)))} />
    </div>
    <div className="targeting-budget-scale" aria-hidden="true"><span>$0</span><span>{moneyLabel(stops[stops.length - 1])}</span></div>
    <div className="targeting-range">
      <div>
        <label htmlFor="targeting-min" style={labelStyle}>Minimum</label>
        <div className="targeting-currency"><span aria-hidden="true">$</span><input id="targeting-min" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} placeholder="No minimum" inputMode="decimal" aria-describedby="targeting-budget-hint" aria-invalid={rangeInvalid || undefined} /></div>
      </div>
      <div>
        <label htmlFor="targeting-max" style={labelStyle}>Maximum</label>
        <div className="targeting-currency"><span aria-hidden="true">$</span><input id="targeting-max" value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} placeholder="No maximum" inputMode="decimal" aria-describedby="targeting-budget-hint" aria-invalid={rangeInvalid || undefined} /></div>
      </div>
    </div>
    <div className="targeting-budget-footer"><small id="targeting-budget-hint">{rangeInvalid ? 'Check your amounts. Maximum must be at least the minimum; both must be zero or greater.' : 'Drag to explore, or type an exact amount. Blank means no limit.'}</small>
      <button type="button" className="targeting-text-button" disabled={sizeMin === '' && sizeMax === ''} onClick={() => { setSizeMin(''); setSizeMax(''); }}>Clear range</button></div>
    </>
  );

  return (
    <form className="targeting-form" onSubmit={save}>
      <div className="targeting-form-heading">
        <h2>Profile details</h2>
        <div className="targeting-form-heading-actions">
          {!readOnly ? <span className="targeting-form-heading-status">Changes apply after saving</span> : null}
          {readOnly && editHref ? <Button href={editHref}><CTCIcon name="edit" />{editLabel}</Button> : null}
        </div>
      </div>
      {!reviewMode ? (
        <div className="targeting-build-grid">
          <SummarySection id="business" title="Your Business" editing editor={<>
            <label htmlFor="targeting-name" style={labelStyle}>Your name or company</label>
            <input id="targeting-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Facility Services" autoComplete="organization" />
          </>} />
          <SummarySection id="industries" title="Industries / NAICS" editing editor={naicsEditor} />
          <SummarySection id="keywords" title="Capabilities / Keywords" editing editor={keywordEditor} />
          <SummarySection id="serviceArea" title="Service Area" editing editor={serviceAreaEditor} />
          <SummarySection id="size" title="Contract Size" editing editor={sizeEditor} />
          <SummarySection id="setAsides" title="Set-Asides" editing editor={setAsideEditor} />
        </div>
      ) : (
        <div className="targeting-review-grid">
          <SummarySection id="industries" title="Industries / NAICS" editHint={discoveryReview ? 'Authoritative NAICS resolved from your selected Discovery niche.' : 'These are the industry codes we will search against.'} editor={naicsEditor} editing={editSections.industries} reviewMode={reviewMode} readOnly={readOnly} onEdit={editSection}>
            <ul className="targeting-industry-list">
              {naicsList.map((n) => (
                <li key={n.code}><span className="targeting-industry-code">{n.code}</span><span>{n.title || 'NAICS industry'}</span></li>
              ))}
            </ul>
          </SummarySection>
          <SummarySection id="keywords" title="Capabilities / Keywords" editHint={discoveryReview ? 'Pulled from your Discovery capabilities and positive interests.' : 'These sharpen matching without narrowing your eligible universe.'} editor={keywordEditor} editing={editSections.keywords} reviewMode={reviewMode} readOnly={readOnly} onEdit={editSection}>
            {keywordItems.length > 0 ? (
              <ul className="targeting-detail-list">
                {keywordItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 14, color: UI.muted }}>No keywords set.</div>
            )}
          </SummarySection>
          <SummarySection id="serviceArea" title="Service Area" editHint="Nationwide searches broadly. A selected state stays specific." editor={serviceAreaEditor} editing={editSections.serviceArea} reviewMode={reviewMode} readOnly={readOnly} onEdit={editSection}>
            <div className="targeting-summary-value">{serviceAreaLabel}</div>
          </SummarySection>
          <SummarySection id="size" title="Contract Size" editHint="Leave either end blank if you do not want a minimum or maximum." editor={sizeEditor} editing={editSections.size} reviewMode={reviewMode} readOnly={readOnly} onEdit={editSection}>
            <div className="targeting-summary-value">{contractSizeLabel(sizeMin, sizeMax)}</div>
          </SummarySection>
          <SummarySection id="setAsides" title="Set-Asides" editHint="Your selected eligibility, alongside full-and-open opportunities." editor={setAsideEditor} editing={editSections.setAsides} reviewMode={reviewMode} readOnly={readOnly} onEdit={editSection}>
            {setAsideItems.length > 0 ? (
              <ul className="targeting-detail-list">
                {setAsideItems.map((item) => (
                  <li key={item}>{setAsideLabel(item)}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 14, color: UI.muted }}>No set-asides selected.</div>
            )}
          </SummarySection>
        </div>
      )}

      <div className="targeting-form-footer">
        <p>{readOnly ? 'Your saved targeting profile.' : updateMode ? 'Applies to future batches only.' : 'Next: choose when to start your contracts.'}</p>
        <Button type="submit" disabled={busy} loading={busy} loadingText="Saving…">{ctaLabel}</Button>
      </div>
      {message ? (
        <div className="targeting-message" role={status === 'error' ? 'alert' : 'status'}>{message}</div>
      ) : null}
    </form>
  );
}
