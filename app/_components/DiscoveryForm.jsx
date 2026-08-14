'use client';

import { useState } from 'react';
import { UI, SET_ASIDE_OPTIONS, BODY_FONT, DISPLAY_FONT } from '../../lib/ui.js';

const TOTAL_STEPS = 10;

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
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 800, color: UI.ink, margin: '16px 0 6px', letterSpacing: 0.2 };
const hintStyle = { fontSize: 12.5, color: UI.muted, marginTop: 5, lineHeight: 1.5 };

const optionStyle = (active) => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: active ? '#fdeaf6' : '#fff',
  color: active ? UI.pinkDeep : UI.text,
  border: `1px solid ${active ? UI.pink : UI.line}`,
  borderRadius: 8,
  padding: '11px 13px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: active ? 800 : 500,
  fontFamily: BODY_FONT,
});

const EMPTY_ANSWERS = {
  capabilities_text: '',
  fulfillment_model: '',
  opportunity_type: '',
  experience_types: [],
  qualification_categories: [],
  qualification_notes: '',
  geography_mode: '',
  state: '',
  operating_model: '',
  size_min: '',
  size_max: '',
  set_asides: [],
  interests: '',
  avoid: '',
  adaptive_answers: {},
};

const fulfillmentOptions = [
  ['self_perform', 'My own company or team performs the work'],
  ['existing_partners', 'I already work with vendors or subcontractors'],
  ['source_as_needed', 'I plan to source vendors as opportunities come up'],
  ['hybrid', 'A combination of these'],
  ['unknown', "I'm not sure yet"],
];
const opportunityOptions = [
  ['products', 'Supplying products'],
  ['services', 'Providing services'],
  ['both', 'Either'],
  ['unknown', 'Not sure'],
];
const experienceOptions = [
  ['federal_contracts', 'Federal government contracts'],
  ['state_local_government', 'State/local government contracts'],
  ['private_commercial', 'Private/commercial work'],
  ['industry_experience', 'Industry experience but no contract history'],
  ['new_to_area', 'Brand new to this area'],
];
const qualificationOptions = [
  ['professional_trade_licenses', 'Professional/trade licenses'],
  ['bonding_capacity', 'Bonding capacity'],
  ['security_clearances', 'Security clearances'],
  ['technical_cyber_certifications', 'Technical/cyber certifications'],
  ['healthcare_medical_credentials', 'Healthcare/medical credentials'],
  ['environmental_safety_certifications', 'Environmental/safety certifications'],
  ['specialized_equipment', 'Specialized equipment'],
  ['qualified_staff', 'Qualified staff'],
  ['regulated_product_suppliers', 'Regulated product suppliers'],
  ['other', 'Other'],
  ['none_or_unknown', 'None / not sure'],
];
const geographyOptions = [
  ['single_state', 'My state only'],
  ['multi_state', 'Several states'],
  ['nationwide', 'Nationwide'],
  ['remote', 'Remote / digital work'],
  ['vendor_dependent', 'Depends on the vendor or subcontractor'],
  ['unknown', "I'm not sure yet"],
];
const operatingOptions = [
  ['volume_products', 'Fast, higher-volume product opportunities'],
  ['recurring_services', 'Recurring long-term service contracts'],
  ['project_based', 'Project-based work'],
  ['no_preference', 'No preference'],
];

function mergeInitialAnswers(initial = {}, session = {}) {
  return {
    ...EMPTY_ANSWERS,
    set_asides: initial.set_asides || [],
    state: initial.state || '',
    ...(session.answers || {}),
  };
}

function toggleArray(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function marketLabel(feedability = {}) {
  if (feedability.status === 'sufficient_current_supply') return 'Healthy';
  if (feedability.status === 'thin_current_supply') return 'Limited';
  if (feedability.status === 'no_current_supply') return 'Unavailable right now';
  return 'Could not verify';
}

function marketHint(feedability = {}) {
  if (feedability.status === 'sufficient_current_supply') return 'Current federal opportunity supply for this targeting lane is healthy.';
  if (feedability.status === 'thin_current_supply') return 'Current live opportunity supply is limited, so this may produce fewer immediate targets.';
  if (feedability.status === 'no_current_supply') return 'Current live opportunity supply is not available for this lane right now.';
  return 'Current market availability could not be verified right now.';
}

function LoadingLabel({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span aria-hidden="true" style={{ display: 'inline-block', fontSize: 15, lineHeight: 1 }}>
        ●
      </span>
      <span>{children}</span>
    </span>
  );
}

export default function DiscoveryForm({ token, initial = {}, initialSession = null }) {
  const [answers, setAnswers] = useState(() => mergeInitialAnswers(initial, initialSession || {}));
  const [step, setStep] = useState(initialSession?.current_step || 1);
  const [status, setStatus] = useState('idle'); // idle | saving | thinking | done | error
  const [message, setMessage] = useState(initialSession ? 'Saved progress loaded.' : '');
  const [recs, setRecs] = useState(Array.isArray(initialSession?.recommendations) ? initialSession.recommendations : []);
  const [adaptiveQuestions, setAdaptiveQuestions] = useState(initialSession?.recommendations?.status === 'needs_clarification' ? initialSession.recommendations.questions || [] : []);
  const [clarificationRound, setClarificationRound] = useState(adaptiveQuestions.length ? 1 : 0);
  const [applyingIdx, setApplyingIdx] = useState(-1);

  function setField(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProgress(nextStep, nextStatus = 'in_progress', nextRecs = undefined) {
    setStatus(nextStatus === 'recommended' ? 'thinking' : 'saving');
    setMessage('');
    const res = await fetch(`/api/discover/${token}/session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers,
        current_step: nextStep,
        status: nextStatus,
        recommendations: nextRecs,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const first = data.details?.[0]?.message;
      throw new Error(first || data.error || 'Could not save discovery progress');
    }
    return data.session;
  }

  function validateCurrentStep() {
    if (step === 1 && !answers.capabilities_text.trim()) return 'Tell us what you can provide or source today.';
    if (step === 2 && !answers.fulfillment_model) return 'Choose how you would fulfill the work.';
    if (step === 3 && !answers.opportunity_type) return 'Choose the type of opportunity you want.';
    if (step === 6) {
      if (!answers.geography_mode) return 'Choose where you can support work.';
      if (answers.geography_mode === 'single_state' && !/^[A-Z]{2}$/.test(answers.state)) {
        return 'Enter a valid two-letter state.';
      }
    }
    if (step === 7 && !answers.operating_model) return 'Choose the operating model that fits you best.';
    const min = answers.size_min === '' ? null : Number(answers.size_min);
    const max = answers.size_max === '' ? null : Number(answers.size_max);
    if (step === 8 && ((min != null && (!Number.isFinite(min) || min < 0)) || (max != null && (!Number.isFinite(max) || max < 0)))) {
      return 'Contract size must be a non-negative number.';
    }
    if (step === 8 && min != null && max != null && min > max) return 'Minimum size must be less than or equal to maximum size.';
    return '';
  }

  async function continueStep() {
    const validationMessage = validateCurrentStep();
    if (validationMessage) {
      setStatus('error');
      setMessage(validationMessage);
      return;
    }
    try {
      const next = Math.min(TOTAL_STEPS, step + 1);
      await saveProgress(next);
      setStep(next);
      setStatus('idle');
      setMessage('Saved.');
    } catch (err) {
      setStatus('error');
      setMessage(String(err.message || err));
    }
  }

  async function submitFinal() {
    const validationMessage = validateCurrentStep();
    if (validationMessage) {
      setStatus('error');
      setMessage(validationMessage);
      return;
    }
    setStatus('thinking');
    setMessage(adaptiveQuestions.length > 0 ? 'Finalizing recommendations...' : 'Saving and preparing recommendations...');
    try {
      const res = await fetch(`/api/discover/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, clarification_round: clarificationRound }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery failed');
      if (data.status === 'needs_clarification') {
        setAdaptiveQuestions(data.questions || []);
        setClarificationRound(1);
        setRecs([]);
        setStatus('idle');
        setMessage('One more thing will help us safely narrow the official NAICS fit.');
        return;
      }
      if (data.status === 'no_recommendation') {
        setAdaptiveQuestions([]);
        setRecs([]);
        setStatus('error');
        setMessage(data.message || 'We could not safely resolve a recommendation from those answers yet.');
        return;
      }
      const list = data.recommendations || [];
      setAdaptiveQuestions([]);
      setRecs(list);
      setStatus(list.length ? 'done' : 'error');
      setMessage(list.length ? 'Saved. Here are your Playbook recommendations.' : 'We could not safely resolve a recommendation from those answers yet.');
    } catch (err) {
      setStatus('error');
      setMessage('Could not run discovery right now. Your answers are saved.');
    }
  }

  async function useThis(rec, idx) {
    setApplyingIdx(idx);
    setMessage('');
    try {
      const codes = (rec.naics || []).map((n) => n.code).join(', ');
      if (!codes) throw new Error('This recommendation is not ready for targeting.');
      const res = await fetch(`/api/discover/${token}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subindustry_id: rec.subindustry_id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save');
      window.location.href = `/setup/${token}`;
    } catch (err) {
      setApplyingIdx(-1);
      setStatus('error');
      setMessage(String(err.message || err));
    }
  }

  const busy = status === 'saving' || status === 'thinking';
  const singleChoice = (name, options) => (
    <div role="radiogroup" aria-label={name} style={{ display: 'grid', gap: 8 }}>
      {options.map(([value, label]) => (
        <button key={value} type="button" role="radio" aria-checked={answers[name] === value} onClick={() => setField(name, value)} style={optionStyle(answers[name] === value)}>
          {label}
        </button>
      ))}
    </div>
  );
  const multiChoice = (name, options) => (
    <div style={{ display: 'grid', gap: 8 }}>
      {options.map(([value, label]) => {
        const active = answers[name].includes(value);
        return (
          <label key={value} style={{ ...optionStyle(active), display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={active} onChange={() => setField(name, toggleArray(answers[name], value))} />
            {label}
          </label>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18, color: UI.muted, fontSize: 13, fontWeight: 800 }}>
        Step {step} of {TOTAL_STEPS}
      </div>

      <div style={{ border: `1px solid ${UI.line}`, borderRadius: 10, padding: 18, background: UI.paper }}>
        {step === 1 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>What can you confidently provide or source today?</h2>
            <label style={labelStyle} htmlFor="capabilities_text">Products, services, skills, industries, or vendor relationships</label>
            <textarea id="capabilities_text" style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={answers.capabilities_text} onChange={(e) => setField('capabilities_text', e.target.value)} />
            <div style={hintStyle}>Plain English is perfect. We will not infer certifications from this text.</div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>How would you fulfill a government contract?</h2>
            <div style={{ ...hintStyle, marginBottom: 12 }}>Vendor and subcontractor ability matters; this does not assume you personally hold every trade credential.</div>
            {singleChoice('fulfillment_model', fulfillmentOptions)}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>What type of opportunity do you want?</h2>
            {singleChoice('opportunity_type', opportunityOptions)}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>What experience do you bring?</h2>
            <div style={{ ...hintStyle, marginBottom: 12 }}>Private experience is useful context, but it is not treated as federal past performance.</div>
            {multiChoice('experience_types', experienceOptions)}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>Qualifications or delivery advantages</h2>
            {multiChoice('qualification_categories', qualificationOptions)}
            <label style={labelStyle} htmlFor="qualification_notes">Optional notes</label>
            <textarea id="qualification_notes" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={answers.qualification_notes} onChange={(e) => setField('qualification_notes', e.target.value)} />
            <div style={hintStyle}>Self-reported only. We do not verify or infer these here.</div>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>Where can you support work?</h2>
            {singleChoice('geography_mode', geographyOptions)}
            {answers.geography_mode === 'single_state' ? (
              <>
                <label style={labelStyle} htmlFor="state">Two-letter state</label>
                <input id="state" style={{ ...inputStyle, maxWidth: 120 }} value={answers.state} onChange={(e) => setField('state', e.target.value.toUpperCase())} placeholder="GA" maxLength={2} />
              </>
            ) : null}
            <div style={hintStyle}>Current contract targeting supports one state or blank/nationwide. Richer geography is saved here for the Playbook matcher phase.</div>
          </>
        ) : null}

        {step === 7 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>What operating model fits you?</h2>
            {singleChoice('operating_model', operatingOptions)}
          </>
        ) : null}

        {step === 8 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>What contract size feels comfortable?</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle} htmlFor="size_min">Minimum dollars</label>
                <input id="size_min" style={inputStyle} inputMode="numeric" value={answers.size_min} onChange={(e) => setField('size_min', e.target.value)} placeholder="Optional" />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle} htmlFor="size_max">Maximum dollars</label>
                <input id="size_max" style={inputStyle} inputMode="numeric" value={answers.size_max} onChange={(e) => setField('size_max', e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div style={hintStyle}>Leave blank if you are not sure yet.</div>
          </>
        ) : null}

        {step === 9 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>Which set-asides do you hold?</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {SET_ASIDE_OPTIONS.map((o) => {
                const active = answers.set_asides.includes(o.value);
                return (
                  <label key={o.value} style={{ ...optionStyle(active), display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={active} onChange={() => setField('set_asides', toggleArray(answers.set_asides, o.value))} />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 10 ? (
          <>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, color: UI.ink }}>What do you want to pursue or avoid?</h2>
            <label style={labelStyle} htmlFor="interests">Kinds of work you are interested in</label>
            <textarea id="interests" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={answers.interests} onChange={(e) => setField('interests', e.target.value)} />
            <label style={labelStyle} htmlFor="avoid">Anything you definitely do not want to pursue?</label>
            <textarea id="avoid" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={answers.avoid} onChange={(e) => setField('avoid', e.target.value)} />
            <div style={hintStyle}>These are preference signals. They do not override hard fit checks later.</div>
          </>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" disabled={busy || step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} style={{ background: '#fff', color: UI.text, border: `1px solid ${UI.line}`, borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 800, cursor: busy || step === 1 ? 'default' : 'pointer', opacity: busy || step === 1 ? 0.55 : 1 }}>
          Previous
        </button>
        {step < TOTAL_STEPS ? (
          <button type="button" disabled={busy} onClick={continueStep} style={{ background: UI.pink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.75 : 1 }}>
            {busy ? 'Saving...' : 'Continue'}
          </button>
        ) : (
          <button type="button" disabled={busy} aria-busy={status === 'thinking'} onClick={submitFinal} style={{ background: UI.pink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>
            {status === 'thinking' ? <LoadingLabel>Saving and preparing recommendations...</LoadingLabel> : 'Save and see recommendations'}
          </button>
        )}
      </div>

      {message ? <div style={{ marginTop: 12, fontSize: 14, color: status === 'error' ? UI.orangeDeep : UI.pinkDeep, fontWeight: 700 }}>{message}</div> : null}

      {adaptiveQuestions.length > 0 ? (
        <div style={{ marginTop: 24, background: UI.paper, border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.orange}`, borderRadius: '0 8px 8px 0', padding: 18 }}>
          <div style={{ fontFamily: DISPLAY_FONT, color: UI.ink, fontSize: 20, marginBottom: 4 }}>One more thing</div>
          <div style={{ fontSize: 13.5, color: UI.muted, lineHeight: 1.5, marginBottom: 14 }}>
            A few promising Playbook lanes need one clarification before we can safely attach official Census NAICS codes.
          </div>
          {adaptiveQuestions.map((q) => (
            <div key={q.key} style={{ marginBottom: 14 }}>
              <div style={labelStyle}>{q.prompt}</div>
              <div role="radiogroup" aria-label={q.prompt} style={{ display: 'grid', gap: 8 }}>
                {(q.options || []).map((o) => {
                  const active = answers.adaptive_answers?.[q.key] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setField('adaptive_answers', { ...(answers.adaptive_answers || {}), [q.key]: o.value })}
                      style={optionStyle(active)}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" disabled={busy} aria-busy={status === 'thinking'} onClick={submitFinal} style={{ background: UI.pink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>
            {status === 'thinking' ? <LoadingLabel>Finalizing recommendations...</LoadingLabel> : 'Finalize recommendations'}
          </button>
        </div>
      ) : null}

      {recs.length > 0 ? (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 20, color: UI.ink, letterSpacing: '-0.2px', marginBottom: 4 }}>
            Playbook recommendations
          </div>
          <div style={{ fontSize: 13.5, color: UI.muted, lineHeight: 1.5, marginBottom: 16 }}>
            These are selected from the bounded War Dogs Playbook universe and use official Census NAICS titles.
          </div>

          {recs.map((rec, idx) => (
            <div key={idx} style={{ background: UI.card, border: `1px solid ${UI.line}`, borderTop: `3px solid ${UI.pink}`, borderRadius: 10, padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: UI.ink, lineHeight: 1.3 }}>{rec.industry_name}</div>
              <div style={{ fontSize: 14, color: UI.muted, marginTop: 3 }}>{rec.subindustry_name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {(rec.naics || []).map((n) => (
                  <span key={n.code} style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, color: UI.ink, background: '#fff', border: `1px solid ${UI.line}`, borderRadius: 6, padding: '5px 10px' }}>
                    NAICS {n.code} &middot; {n.title}
                  </span>
                ))}
              </div>
              {rec.explanation ? (
                <div style={{ background: UI.paper, borderLeft: `3px solid ${UI.orange}`, padding: '10px 12px', borderRadius: '0 4px 4px 0', fontSize: 14, color: UI.text, marginTop: 14, lineHeight: 1.55 }}>
                  <strong style={{ color: UI.orangeDeep }}>Why this fits you.</strong> {rec.explanation}
                </div>
              ) : null}
              {rec.feedability ? (
                <div style={{ marginTop: 10, fontSize: 13.5, color: UI.text, lineHeight: 1.5 }}>
                  <strong>Current federal opportunity supply:</strong> {marketLabel(rec.feedability)}
                  <div style={{ color: UI.muted }}>{marketHint(rec.feedability)}</div>
                </div>
              ) : null}
              {rec.strengths && rec.strengths.length ? (
                <div style={{ marginTop: 12, fontSize: 14, color: UI.text, lineHeight: 1.55 }}>
                  <strong>Why it is worth considering:</strong> {rec.strengths.join(' ')}
                </div>
              ) : null}
              {rec.risks && rec.risks.length ? (
                <div style={{ marginTop: 8, fontSize: 14, color: UI.text, lineHeight: 1.55 }}>
                  <strong>What to watch:</strong> {rec.risks.join(' ')}
                </div>
              ) : null}
              {rec.competition ? (
                <div style={{ marginTop: 8, fontSize: 13, color: UI.muted, fontWeight: 700 }}>Competition: {rec.competition}</div>
              ) : null}
              <button type="button" onClick={() => useThis(rec, idx)} disabled={applyingIdx !== -1} style={{ marginTop: 16, background: UI.pink, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 14.5, fontWeight: 800, cursor: applyingIdx !== -1 ? 'default' : 'pointer', opacity: applyingIdx !== -1 && applyingIdx !== idx ? 0.5 : 1 }}>
                {applyingIdx === idx ? 'Loading it in...' : 'Use this niche'}
              </button>
              <div style={{ ...hintStyle, marginTop: 8 }}>
                This writes only production-safe official NAICS codes into Review Targeting. You can fine-tune or remove them next.
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {status === 'error' && recs.length === 0 ? (
        <div style={{ marginTop: 22, background: UI.paper, border: `1px solid ${UI.line}`, borderLeft: `3px solid ${UI.orange}`, borderRadius: '0 8px 8px 0', padding: 18 }}>
          <div style={{ fontFamily: DISPLAY_FONT, color: UI.ink, fontSize: 18, fontWeight: 800 }}>
            We could not find a strong enough niche match from your current answers.
          </div>
          <div style={{ color: UI.text, fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>
            Your answers are saved. You can review them or build targeting directly without fabricating a weak recommendation.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" onClick={() => setStep(1)} style={{ background: '#fff', color: UI.ink, border: `1px solid ${UI.line}`, borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Review answers
            </button>
            <a href={`/setup/${token}?targeting=1`} style={{ display: 'inline-block', background: UI.ink, color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 800 }}>
              Build targeting directly
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
