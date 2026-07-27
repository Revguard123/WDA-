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

// deps:
//   disqualify(op, buyer) => Promise<{ disqualified, reason }>
//   writeWhyLine(op, buyer) => Promise<string>
// options: now, minRunwayDays, deliveredNoticeIds, deliveredSolicitations, n, weights
export async function curateForBuyer(rows, buyer, deps = {}, options = {}) {
  const { disqualify, writeWhyLine } = deps;
  const { n = 5 } = options;

  const stats = { input: rows.length, afterHardFilters: 0, disqualifiedByAI: 0, eligible: 0, chosen: 0, shortfall: 0 };

  // 1) Hard filters.
  const { survivors, stats: filterStats } = applyHardFilters(rows, buyer, options);
  stats.afterHardFilters = survivors.length;
  stats.hardFilter = filterStats;

  // 2) AI disqualification pass (concurrent). A thrown call is treated as
  // "disqualified" so a single API hiccup never lets a bad contract through.
  const verdicts = await Promise.all(
    survivors.map(async (op) => {
      if (!disqualify) return { op, disqualified: false, reason: 'no disqualifier configured' };
      try {
        const v = await disqualify(op, buyer);
        return { op, disqualified: v.disqualified === true, reason: v.reason || '' };
      } catch (err) {
        return { op, disqualified: true, reason: `disqualifier error: ${String(err?.message || err)}` };
      }
    }),
  );
  const eligible = verdicts.filter((v) => !v.disqualified).map((v) => v.op);
  stats.disqualifiedByAI = verdicts.length - eligible.length;
  stats.eligible = eligible.length;

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
        why_line: why,
      };
    }),
  );

  return { chosen, stats };
}
