// Slice 2 hard filters. Cheap, deterministic checks that run BEFORE the AI
// disqualification pass, over cached `opportunities` rows for one buyer. These
// never call the network. Order and rules follow the build spec:
//   - set-aside eligibility (full-and-open OR a status the buyer holds)
//   - size band (est_value within the buyer's range; nulls pass through)
//   - geography (place of performance within the buyer's state, if set)
//   - deadline runway (drop anything due sooner than the minimum)
//   - no repeats (exclude notice_id / solicitation_num already delivered)

import { buyerQualifiesForSetAside } from '../sam/setAsides.js';
import { derivePlaceOfPerformanceStateCode } from '../sam/mapRecord.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Resolve the place-of-performance state code for a cached row. Prefer the raw
// SAM record; fall back to parsing the stored "City, State" string.
function rowStateCode(row) {
  if (row?.raw) {
    const code = derivePlaceOfPerformanceStateCode(row.raw);
    if (code) return String(code).toUpperCase();
  }
  const pop = row?.place_of_perf;
  if (typeof pop === 'string' && pop.includes(',')) {
    return pop.split(',').pop().trim().toUpperCase();
  }
  return null;
}

// Apply the hard filters to cached opportunity rows for one buyer.
//
// rows: opportunities rows (with notice_id, solicitation_num, set_aside_type,
//       est_value, response_deadline, raw, ...)
// buyer: { set_asides[], size_min, size_max, state }
// options:
//   now                  - Date clock (default real now)
//   minRunwayDays        - drop deadlines sooner than this (default 14)
//   deliveredNoticeIds   - Set of notice_ids already sent to this buyer
//   deliveredSolicitations - Set of solicitation_nums already sent (amended reposts)
export function applyHardFilters(rows, buyer = {}, options = {}) {
  const {
    now = new Date(),
    minRunwayDays = 14,
    deliveredNoticeIds = new Set(),
    deliveredSolicitations = new Set(),
  } = options;

  const held = buyer.set_asides || [];
  const minDeadline = new Date(now.getTime() + minRunwayDays * DAY_MS);

  const stats = {
    input: rows.length,
    droppedRepeat: 0,
    droppedSetAside: 0,
    droppedSizeBand: 0,
    droppedGeography: 0,
    droppedClosed: 0,
    droppedTightRunway: 0,
    survivors: 0,
  };

  const survivors = [];
  for (const row of rows) {
    // No repeats (belt-and-suspenders to the DB UNIQUE lock).
    if (deliveredNoticeIds.has(row.notice_id)) {
      stats.droppedRepeat += 1;
      continue;
    }
    if (row.solicitation_num && deliveredSolicitations.has(row.solicitation_num)) {
      stats.droppedRepeat += 1;
      continue;
    }

    // Set-aside eligibility.
    if (!buyerQualifiesForSetAside(row.set_aside_type, held)) {
      stats.droppedSetAside += 1;
      continue;
    }

    // Size band. Unknown value (null) passes through to the AI step.
    if (row.est_value != null) {
      const v = Number(row.est_value);
      if (buyer.size_min != null && v < Number(buyer.size_min)) {
        stats.droppedSizeBand += 1;
        continue;
      }
      if (buyer.size_max != null && v > Number(buyer.size_max)) {
        stats.droppedSizeBand += 1;
        continue;
      }
    }

    // Geography. Keep rows with no stated state; drop only clear mismatches.
    if (buyer.state) {
      const code = rowStateCode(row);
      if (code && code !== String(buyer.state).toUpperCase()) {
        stats.droppedGeography += 1;
        continue;
      }
    }

    // Deadline runway.
    if (row.response_deadline) {
      const dl = new Date(row.response_deadline);
      if (!Number.isNaN(dl.getTime())) {
        if (dl.getTime() <= now.getTime()) {
          stats.droppedClosed += 1;
          continue;
        }
        if (dl.getTime() < minDeadline.getTime()) {
          stats.droppedTightRunway += 1;
          continue;
        }
      }
    }

    survivors.push(row);
  }

  stats.survivors = survivors.length;
  return { survivors, stats };
}
