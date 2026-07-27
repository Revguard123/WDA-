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

const DAY_MS = 24 * 60 * 60 * 1000;

// Merge records from several searches, deduping by notice_id and by
// solicitation_num (amended reposts). When two notice_ids share a
// solicitation_num, keep the one posted most recently.
function dedupeRecords(records) {
  const byNotice = new Map();
  for (const rec of records) {
    const id = rec?.noticeId != null ? String(rec.noticeId) : null;
    if (!id) continue;
    if (!byNotice.has(id)) byNotice.set(id, rec);
  }

  const bySolicitation = new Map();
  const kept = [];
  for (const rec of byNotice.values()) {
    const soli = rec.solicitationNumber ? String(rec.solicitationNumber).trim() : '';
    if (!soli) {
      kept.push(rec);
      continue;
    }
    const existing = bySolicitation.get(soli);
    if (!existing) {
      bySolicitation.set(soli, rec);
    } else {
      const a = new Date(existing.postedDate || 0).getTime();
      const b = new Date(rec.postedDate || 0).getTime();
      if (b > a) bySolicitation.set(soli, rec);
    }
  }
  for (const rec of bySolicitation.values()) kept.push(rec);
  return kept;
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
    lookbackDays = 365,
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
      // Keep records with no stated place of performance (nationwide / unknown);
      // only drop when SAM gives a state and it differs from the buyer's.
      if (recState && String(recState).toUpperCase() !== String(state).toUpperCase()) {
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
