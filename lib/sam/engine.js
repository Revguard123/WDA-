// Slice 1 engine: query SAM.gov for a niche, filter to real live solicitations
// the buyer could actually pursue, and upsert the matches into `opportunities`.
//
// This is the proof point for the whole product. The test harness
// (scripts/prove-slice1.mjs) runs it for NAICS 561720 / SDVOSB / SC and prints
// the titles, deadlines and SAM URLs that come back.
//
// Design note on set-asides: we query SAM by NAICS (plus state and notice type)
// WITHOUT a typeOfSetAside filter, then decide eligibility in code. Passing
// typeOfSetAside to the API would exclude full-and-open contracts, which the
// buyer is also eligible for. Code-side filtering keeps both.

import {
  LIVE_NOTICE_TYPES,
  formatSamDate,
  samSearchAll,
  resolveDescriptionText,
} from './client.js';
import { mapRecordToRow, parseDeadline, derivePlaceOfPerformanceStateCode } from './mapRecord.js';
import { buyerQualifiesForSetAside } from './setAsides.js';
import { geographyEligibility } from './geography.js';
import { dedupeOpportunitiesByProcurement } from '../procurementIdentity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Merge records from several searches, deduping by notice_id and by
// solicitation_num (amended reposts). When two notice_ids share a
// solicitation_num, keep the one posted most recently.
function dedupeRecords(records) {
  return dedupeOpportunitiesByProcurement(records).rows;
}

// Run the engine for one niche.
//
// niche: { naics: string[], set_asides: string[], state?: string,
//          keywords?: string[], size_min?, size_max? }
// options:
//   apiKey        - SAM api key (required for live runs)
//   fetchImpl     - fetch to use (injectable for tests)
//   upsert        - async (rows) => number, persists opportunities (optional)
//   now           - Date, the clock (defaults to real now; injectable)
//   lookbackDays  - how far back to search postedFrom (default 365, SAM max ~1yr)
//   minRunwayDays - drop contracts due sooner than this many days (default 14)
//   maxPerNaics   - cap records pulled per NAICS/type search (default 1000)
//   resolveDescriptions - fetch description text for kept rows (default true)
//   enforceSetAside - drop set-asides the buyer does not hold (default true).
//                     The per-niche proof enforces this so the output only shows
//                     pursuable contracts; the broad daily sync (Slice 7) can
//                     pass false to cache widely and let Slice 2 be the
//                     authoritative per-buyer set-aside filter.
export async function runEngineForNiche(niche, options = {}) {
  const {
    apiKey,
    fetchImpl = fetch,
    upsert,
    now = new Date(),
    lookbackDays = 364,
    minRunwayDays = 14,
    maxPerNaics = 1000,
    resolveDescriptions = true,
    enforceSetAside = true,
  } = options;

  const naicsList = (niche?.naics || []).filter(Boolean);
  const held = niche?.set_asides || [];
  const state = niche?.state || null;

  const postedTo = formatSamDate(now);
  const postedFrom = formatSamDate(new Date(now.getTime() - lookbackDays * DAY_MS));

  const stats = {
    naicsSearched: naicsList.length,
    rawPulled: 0,
    afterDedupe: 0,
    droppedClosed: 0,
    droppedTightRunway: 0,
    droppedSetAside: 0,
    droppedGeography: 0,
    kept: 0,
    upserted: 0,
  };

  // 1) Pull raw records: one search per (NAICS, live notice type).
  const rawRecords = [];
  for (const naicsCode of naicsList) {
    for (const ptype of LIVE_NOTICE_TYPES) {
      const page = await samSearchAll(
        { apiKey, postedFrom, postedTo, ptype, naicsCode, state },
        { fetchImpl, maxRecords: maxPerNaics },
      );
      rawRecords.push(...page);
    }
  }
  stats.rawPulled = rawRecords.length;

  // 2) Dedupe by notice_id + solicitation_num (amended reposts).
  const deduped = dedupeRecords(rawRecords);
  stats.afterDedupe = deduped.length;

  // 3) Filter: closed / tight runway / set-aside eligibility / geography.
  const minDeadline = new Date(now.getTime() + minRunwayDays * DAY_MS);
  const survivors = [];
  for (const rec of deduped) {
    const deadline = parseDeadline(rec);
    if (deadline && deadline.getTime() <= now.getTime()) {
      stats.droppedClosed += 1;
      continue;
    }
    if (deadline && deadline.getTime() < minDeadline.getTime()) {
      stats.droppedTightRunway += 1;
      continue;
    }
    if (enforceSetAside && !buyerQualifiesForSetAside(rec.typeOfSetAside, held)) {
      stats.droppedSetAside += 1;
      continue;
    }
    if (state) {
      const recState = derivePlaceOfPerformanceStateCode(rec);
      const geo = geographyEligibility(
        {
          ...rec,
          place_of_perf: recState || rec.placeOfPerformance?.streetAddress || rec.description || '',
        },
        state,
      );
      if (!geo.eligible) {
        stats.droppedGeography += 1;
        continue;
      }
    }
    survivors.push(rec);
  }
  stats.kept = survivors.length;

  // 4) Resolve description text (source for the AI passes in Slice 2/3).
  const rows = [];
  for (const rec of survivors) {
    let descriptionText;
    if (resolveDescriptions) {
      descriptionText = await resolveDescriptionText(rec.description, { apiKey, fetchImpl });
    }
    rows.push(mapRecordToRow(rec, { descriptionText }));
  }

  // 5) Upsert into opportunities cache (if a persister was provided).
  if (upsert && rows.length) {
    stats.upserted = (await upsert(rows)) || rows.length;
  }

  return { rows, stats, window: { postedFrom, postedTo } };
}

// Resolve description text for a bounded set of candidate rows, in place. Cached
// rows carry the SAM description URL in their `description` field (the daily
// sync does not fetch text, for speed and quota); this fetches the real text
// only for the finalists a batch actually needs, then stores it back on the
// row so the AI passes and deep-dive can read it. resolveDescriptionText passes
// through anything that is already text, so it is safe to call on live rows too.
export async function resolveDescriptionsForRows(rows = [], { apiKey, fetchImpl = fetch } = {}) {
  await Promise.all(
    (rows || []).map(async (row) => {
      if (!row) return;
      const source = row.description || row.raw?.description || null;
      // Skip when we already have resolved prose (heuristic: not a URL).
      if (source && !/^https?:\/\//i.test(String(source))) {
        row.description = String(source);
        return;
      }
      try {
        row.description = await resolveDescriptionText(source, { apiKey, fetchImpl });
      } catch {
        row.description = '';
      }
    }),
  );
  return rows;
}
