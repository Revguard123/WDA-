// Slice 2 ranking. Scores the contracts that survive the hard filters and the
// AI disqualification pass, then returns the top N. Deterministic and
// explainable: every contract carries its component scores. Defaults follow
// Appendix B (confirmed with James):
//   - deadline runway: favor 21 to 45 days out; downrank very tight/very distant
//   - match strength: stronger NAICS + keyword matches rank higher
//   - winnability: favor recompetes and smaller ceilings over crowded megas
//   - set-aside fit: an exact set-aside for the buyer ranks above full-and-open

import { matchStrength } from './keywords.js';
import { isFullAndOpen } from '../sam/setAsides.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_WEIGHTS = {
  match: 0.4,
  runway: 0.25,
  setAsideFit: 0.2,
  winnability: 0.15,
  rubric: 0.2,
};

// Runway score: 1.0 in the 21..45 day sweet spot, tapering to 0 for very tight
// (<= 14, though those are usually already filtered) or very distant (>= ~120).
function runwayScore(row, now) {
  if (!row.response_deadline) return 0.5; // unknown deadline: neutral
  const dl = new Date(row.response_deadline).getTime();
  if (Number.isNaN(dl)) return 0.5;
  const days = (dl - now.getTime()) / DAY_MS;
  if (days <= 14) return 0.1;
  if (days < 21) return 0.6 + ((days - 14) / 7) * 0.4; // 14->0.6 up to 21->1.0
  if (days <= 45) return 1.0; // sweet spot
  if (days <= 120) return 1.0 - ((days - 45) / 75) * 0.7; // 45->1.0 down to 120->0.3
  return 0.2;
}

// Set-aside fit: an exact set-aside reserved for the buyer's status means less
// competition, so it ranks above a full-and-open contract, all else equal.
function setAsideFitScore(row) {
  return isFullAndOpen(row.set_aside_type) ? 0.6 : 1.0;
}

// Winnability: favor smaller ceilings and recompetes over crowded mega-contracts.
// Value is often unknown on fresh solicitations (neutral). Text signals of a
// recompete / follow-on nudge it up.
function winnabilityScore(row) {
  let score = 0.5;
  const v = row.est_value != null ? Number(row.est_value) : null;
  if (v != null && Number.isFinite(v)) {
    // Smaller ceilings score higher on a soft log curve.
    if (v <= 100_000) score = 0.9;
    else if (v <= 1_000_000) score = 0.75;
    else if (v <= 10_000_000) score = 0.5;
    else score = 0.3;
  }
  const text = `${row.title || ''} ${row.description || ''}`.toLowerCase();
  if (/\b(recompete|re-compete|follow[- ]?on|incumbent)\b/.test(text)) {
    score = Math.min(1, score + 0.1);
  }
  return score;
}

function rubricScore(row) {
  const assessment = row.rubric_assessment;
  if (!assessment) return 0.5;
  const positives = assessment.positive_signals || [];
  const risks = assessment.risk_signals || [];
  let score = 0.5 + Math.min(0.35, positives.length * 0.07) - Math.min(0.25, risks.length * 0.04);
  if (positives.some((s) => ['matching_set_aside', 'licensing_moat', 'lpta_fit', 'best_value_fit'].includes(s.id))) score += 0.12;
  if (risks.some((s) => ['short_runway', 'unknown_mandatory_qualification'].includes(s.id))) score -= 0.08;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

// Score one contract for one buyer. Returns the composite plus the breakdown.
export function scoreContract(row, buyer = {}, options = {}) {
  const { now = new Date(), weights = DEFAULT_WEIGHTS } = options;
  const match = matchStrength(row, buyer);
  const components = {
    match: match.score,
    runway: Number(runwayScore(row, now).toFixed(4)),
    setAsideFit: setAsideFitScore(row),
    winnability: Number(winnabilityScore(row).toFixed(4)),
    rubric: rubricScore(row),
  };
  const activeWeightTotal = Object.keys(components).reduce((sum, key) => sum + (weights[key] || 0), 0) || 1;
  const total = Object.entries(components).reduce((sum, [key, value]) => sum + value * ((weights[key] || 0) / activeWeightTotal), 0);

  return {
    notice_id: row.notice_id,
    score: Number(total.toFixed(4)),
    components,
    matchedKeywords: match.matched,
  };
}

// Rank contracts for a buyer and return the top N (default 5), highest first.
// Ties break by earlier deadline (more urgent) then notice_id for stability.
export function rankTopN(rows, buyer = {}, options = {}) {
  const { n = 5, now = new Date(), weights = DEFAULT_WEIGHTS } = options;
  const scored = rows.map((row) => ({ row, ...scoreContract(row, buyer, { now, weights }) }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.row.response_deadline ? new Date(a.row.response_deadline).getTime() : Infinity;
    const db = b.row.response_deadline ? new Date(b.row.response_deadline).getTime() : Infinity;
    if (da !== db) return da - db;
    return String(a.notice_id).localeCompare(String(b.notice_id));
  });

  return {
    ranked: scored,
    top: scored.slice(0, n),
    shortfall: Math.max(0, n - scored.length),
  };
}
