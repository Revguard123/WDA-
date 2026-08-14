import { derivePlaceOfPerformanceStateCode } from './mapRecord.js';

const NATIONWIDE_RE = /\b(nationwide|national|various|multiple locations|contiguous united states|continental united states|conus|united states)\b/i;

function normalizeState(v) {
  const s = String(v || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : '';
}

export function isNationwidePlace(value) {
  return NATIONWIDE_RE.test(String(value || ''));
}

export function placeOfPerformanceState(rowOrRecord = {}) {
  if (rowOrRecord?.raw) {
    const code = derivePlaceOfPerformanceStateCode(rowOrRecord.raw);
    if (code) return normalizeState(code);
  }
  const rawCode = derivePlaceOfPerformanceStateCode(rowOrRecord);
  if (rawCode) return normalizeState(rawCode);

  const pop = rowOrRecord?.place_of_perf;
  if (typeof pop === 'string' && pop.includes(',')) {
    return normalizeState(pop.split(',').pop());
  }
  return '';
}

export function geographyEligibility(rowOrRecord = {}, buyerState) {
  const state = normalizeState(buyerState);
  if (!state) return { eligible: true, reason: 'unrestricted' };

  const popText = rowOrRecord?.place_of_perf || rowOrRecord?.placeOfPerformance?.streetAddress || rowOrRecord?.description || '';
  if (isNationwidePlace(popText)) return { eligible: true, reason: 'nationwide' };

  const popState = placeOfPerformanceState(rowOrRecord);
  if (!popState) return { eligible: false, reason: 'unknown' };
  if (popState === state) return { eligible: true, reason: 'state-match' };
  return { eligible: false, reason: 'state-mismatch', state: popState };
}
