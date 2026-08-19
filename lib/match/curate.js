// Slice 2 assembler: turn a pool of cached opportunity rows into a buyer's
// curated top five. Pipeline (per the build spec):
//   1. hard filters (set-aside, size band, geography, runway, no-repeats)
//   2. AI disqualification pass (Claude reads each survivor)
//   3. ranking (Appendix B) -> top five
//   4. why-line for each chosen contract
//
// The AI steps are injected (disqualify, writeWhyLine) so this can be unit
// tested with fakes and run in production with the Claude-backed versions from
// lib/ai/claude.js.

import { applyHardFilters } from './filters.js';
import { rankTopN } from './ranking.js';
import { dedupeOpportunitiesByProcurement, procurementIdentity } from '../procurementIdentity.js';
import { assessCorePremise } from '../rubric/corePremise.js';

const REASON_CATEGORIES = [
  'scope_mismatch',
  'mandatory_qualification',
  'certification_license',
  'clearance',
  'bonding',
  'geography',
  'set_aside',
  'contract_size',
  'product_service_mismatch',
  'past_performance',
  'insufficient_buyer_evidence',
  'other',
];

export function normalizeDisqualificationCategory(value, reason = '') {
  const clean = String(value || '').toLowerCase().trim();
  if (REASON_CATEGORIES.includes(clean)) return clean;
  const text = String(reason || '').toLowerCase();
  if (/past performance|prior experience/.test(text)) return 'past_performance';
  if (/certif|credential|license|licensed/.test(text)) return 'certification_license';
  if (/clearance|classified/.test(text)) return 'clearance';
  if (/bond/.test(text)) return 'bonding';
  if (/geograph|location|place|outside.*service area/.test(text)) return 'geography';
  if (/set-aside|set aside/.test(text)) return 'set_aside';
  if (/size|value|financial|capacity/.test(text)) return 'contract_size';
  if (/product|manufactur|supply|service mismatch/.test(text)) return 'product_service_mismatch';
  if (/uncertain|not stated|no evidence|not provide|does not specify|unknown|silent/.test(text)) return 'insufficient_buyer_evidence';
  if (/scope|outside|unrelated|does not match|not match|mismatch|specialized capability/.test(text)) return 'scope_mismatch';
  return 'other';
}

function emptyCategoryCounts() {
  return Object.fromEntries(REASON_CATEGORIES.map((category) => [category, 0]));
}

// deps:
//   disqualify(op, buyer) => Promise<{ disqualified, reason }>
//   writeWhyLine(op, buyer) => Promise<string>
//   resolveDescriptions(candidates) => Promise<void> (optional): fetch and store
//     description text on the capped candidate rows before the AI pass. Lets a
//     batch read a description-less pool from the cache and spend SAM calls on
//     only the finalists.
// options: now, minRunwayDays, deliveredNoticeIds, deliveredSolicitations, n, weights
export async function curateForBuyer(rows, buyer, deps = {}, options = {}) {
  const { disqualify, writeWhyLine, resolveDescriptions } = deps;
  const { n = 5 } = options;

  const stats = { input: rows.length, afterHardFilters: 0, disqualifiedByAI: 0, needsValidationByAI: 0, eligible: 0, chosen: 0, shortfall: 0 };

  // 0) Collapse SAM notice/version records for the same procurement before any
  // candidate can reach AI review or final ranking.
  const { rows: procurementRows, stats: procurementDedupe } = dedupeOpportunitiesByProcurement(rows);
  stats.procurementDedupe = procurementDedupe;

  // 1) Hard filters.
  const { survivors, stats: filterStats } = applyHardFilters(procurementRows, buyer, options);
  stats.afterHardFilters = survivors.length;
  stats.hardFilter = filterStats;

  // 1b) Pre-rank cheaply and cap the AI pass to the strongest candidates. We
  // only need five, and the AI pass is the expensive step; running it on every
  // survivor wastes calls and risks rate limits. maxCandidates defaults to a
  // generous multiple of n so ranking still has room after disqualification.
  const { maxCandidates = Math.max(n * 4, 20) } = options;
  let candidates = survivors;
  if (maxCandidates && survivors.length > maxCandidates) {
    const byId = new Map(survivors.map((op) => [op.notice_id, op]));
    const pre = rankTopN(survivors, buyer, { ...options, n: maxCandidates });
    candidates = pre.top.map((t) => byId.get(t.notice_id)).filter(Boolean);
  }
  stats.aiCandidates = candidates.length;

  // 1c) Resolve description text for just these candidates (bounded SAM calls).
  // The AI passes below read op.description, so this must run before them.
  if (resolveDescriptions && candidates.length) {
    try {
      await resolveDescriptions(candidates);
      stats.descriptionsResolved = candidates.length;
    } catch {
      stats.descriptionsResolved = 0;
    }
  }

  for (const op of candidates) op.rubric_assessment = assessCorePremise(op, buyer, { now: options.now || new Date() });
  const rubricRejected = candidates.filter((op) => op.rubric_assessment?.eligibility?.status === 'rejected');
  candidates = candidates.filter((op) => op.rubric_assessment?.eligibility?.status !== 'rejected');
  stats.disqualifiedByRubric = rubricRejected.length;
  stats.rubricRejectionCategories = rubricRejected.reduce((acc, op) => {
    for (const fail of op.rubric_assessment?.eligibility?.hard_failures || []) acc[fail.id] = (acc[fail.id] || 0) + 1;
    return acc;
  }, {});

  // 2) AI disqualification pass (concurrent). A thrown call is treated as
  // "disqualified" so a single API hiccup never lets a bad contract through.
  const verdicts = await Promise.all(
    candidates.map(async (op) => {
      if (!disqualify) return { op, disqualified: false, reason: 'no disqualifier configured' };
      try {
        const v = await disqualify(op, buyer);
        const decision = ['eligible', 'needs_validation', 'disqualified'].includes(v.decision)
          ? v.decision
          : v.disqualified === true
            ? 'disqualified'
            : 'eligible';
        return {
          op,
          decision,
          disqualified: decision === 'disqualified' || (v.disqualified === true && decision !== 'needs_validation'),
          reason_category: normalizeDisqualificationCategory(v.reason_category, v.reason),
          reason: v.reason || '',
        };
      } catch (err) {
        return {
          op,
          decision: 'disqualified',
          disqualified: true,
          reason_category: 'other',
          reason: `disqualifier error: ${String(err?.message || err)}`,
        };
      }
    }),
  );
  const eligible = verdicts.filter((v) => !v.disqualified).map((v) => v.op);
  stats.disqualifiedByAI = verdicts.length - eligible.length;
  stats.needsValidationByAI = verdicts.filter((v) => v.decision === 'needs_validation' && !v.disqualified).length;
  stats.eligible = eligible.length;
  stats.aiDecisionBreakdown = verdicts.reduce((acc, v) => {
    acc[v.decision] = (acc[v.decision] || 0) + 1;
    return acc;
  }, { eligible: 0, needs_validation: 0, disqualified: 0 });
  stats.aiRejectionCategories = emptyCategoryCounts();
  for (const v of verdicts) {
    if (v.disqualified) stats.aiRejectionCategories[v.reason_category] = (stats.aiRejectionCategories[v.reason_category] || 0) + 1;
  }
  stats.aiValidationCategories = emptyCategoryCounts();
  for (const v of verdicts) {
    if (v.decision === 'needs_validation' && !v.disqualified) {
      stats.aiValidationCategories[v.reason_category] = (stats.aiValidationCategories[v.reason_category] || 0) + 1;
    }
  }

  // Audit trail: why each survivor was kept or dropped by the AI pass.
  const auditVerdicts = verdicts.map((v) => ({
    notice_id: v.op.notice_id,
        title: v.op.title,
        description_chars: (v.op.description || '').length,
        naics: v.op.naics || null,
        rubric_status: v.op.rubric_assessment?.eligibility?.status || null,
        decision: v.decision,
    disqualified: v.disqualified,
    reason_category: v.reason_category,
    reason: v.reason,
  }));

  // 3) Ranking -> top N.
  const { top, shortfall } = rankTopN(eligible, buyer, options);
  stats.chosen = top.length;
  stats.shortfall = shortfall;

  // 4) Why-line for each chosen contract.
  const byNoticeId = new Map(eligible.map((op) => [op.notice_id, op]));
  const chosen = await Promise.all(
    top.map(async (t) => {
      const op = byNoticeId.get(t.notice_id);
      let why = '';
      if (writeWhyLine && op) {
        try {
          why = await writeWhyLine(op, buyer);
        } catch {
          why = '';
        }
      }
      return {
        notice_id: t.notice_id,
        solicitation_num: op?.solicitation_num || null,
        procurement_identity: procurementIdentity(op),
        title: op?.title || null,
        agency: op?.agency || null,
        set_aside_type: op?.set_aside_type || null,
        naics: op?.naics || null,
        response_deadline: op?.response_deadline || null,
        est_value: op?.est_value ?? null,
        sam_url: op?.sam_url || null,
        score: t.score,
        components: t.components,
        matchedKeywords: t.matchedKeywords,
        rubric_assessment: op?.rubric_assessment || null,
        why_line: why,
      };
    }),
  );

  const uniqueChosen = [];
  const chosenIdentities = new Set();
  for (const item of chosen) {
    const identity = item.procurement_identity || procurementIdentity(item);
    if (identity && chosenIdentities.has(identity)) continue;
    if (identity) chosenIdentities.add(identity);
    uniqueChosen.push(item);
  }
  stats.finalProcurementIdentities = uniqueChosen.length;
  stats.finalProcurementDuplicatesDropped = chosen.length - uniqueChosen.length;
  stats.chosen = uniqueChosen.length;
  stats.shortfall = Math.max(0, n - uniqueChosen.length);

  return { chosen: uniqueChosen, stats, verdicts: auditVerdicts };
}
