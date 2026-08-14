import { applyHardFilters } from '../match/filters.js';
import { readCachedOpportunities, upsertOpportunities } from '../opportunities.js';
import { runEngineForNiche } from '../sam/engine.js';

export const FEEDABILITY_STATUSES = [
  'sufficient_current_supply',
  'thin_current_supply',
  'no_current_supply',
  'unknown',
];

function statusForCount(count) {
  if (count == null) return 'unknown';
  if (count >= 5) return 'sufficient_current_supply';
  if (count >= 1) return 'thin_current_supply';
  return 'no_current_supply';
}

function uniqueCodes(codes = []) {
  return [...new Set((codes || []).map((code) => String(code || '').trim()).filter(Boolean))].sort();
}

export function discoveryFeedabilityNiche({ naics = [], profile = {} } = {}) {
  const state = profile.geography_mode === 'single_state' ? profile.state || '' : '';
  return {
    naics: uniqueCodes(naics),
    set_asides: profile.set_asides || [],
    state,
    size_min: profile.size_min ?? null,
    size_max: profile.size_max ?? null,
  };
}

function cacheKey(niche = {}) {
  return JSON.stringify({
    naics: uniqueCodes(niche.naics),
    set_asides: [...(niche.set_asides || [])].sort(),
    state: niche.state || '',
    size_min: niche.size_min ?? null,
    size_max: niche.size_max ?? null,
  });
}

export function createFeedabilityChecker({
  cacheReader = readCachedOpportunities,
  engineRunner = runEngineForNiche,
  upsert = upsertOpportunities,
  now = new Date(),
  apiKey = process.env.SAM_API_KEY,
  logger = null,
} = {}) {
  const memo = new Map();

  return async function checkFeedability({ naics = [], profile = {} } = {}) {
    const checkedNaics = uniqueCodes(naics);
    const checkedAt = new Date(now).toISOString();
    if (checkedNaics.length === 0) {
      return { status: 'no_current_supply', eligible_live_count: 0, checked_naics: [], checked_at: checkedAt };
    }

    const niche = discoveryFeedabilityNiche({ naics: checkedNaics, profile });
    const key = cacheKey(niche);
    if (memo.has(key)) return memo.get(key);

    const promise = (async () => {
      try {
        const cachedRows = await cacheReader(niche, { now });
        const cached = applyHardFilters(cachedRows, niche, { now, minRunwayDays: 14 });
        if (cached.survivors.length >= 5) {
          return {
            status: 'sufficient_current_supply',
            eligible_live_count: cached.survivors.length,
            checked_naics: checkedNaics,
            checked_at: checkedAt,
            source: 'cache',
          };
        }

        const { rows } = await engineRunner(niche, {
          apiKey,
          now,
          minRunwayDays: 14,
          resolveDescriptions: false,
          enforceSetAside: true,
          upsert,
        });
        return {
          status: statusForCount(rows.length),
          eligible_live_count: rows.length,
          checked_naics: checkedNaics,
          checked_at: checkedAt,
          source: 'live',
        };
      } catch (err) {
        logger?.warn?.({
          event: 'playbook_feedability_debug',
          stage: 'feedability_unknown',
          error_name: err?.name || 'Error',
          error_message: String(err?.message || 'Feedability check failed').slice(0, 180),
        });
        return {
          status: 'unknown',
          eligible_live_count: null,
          checked_naics: checkedNaics,
          checked_at: checkedAt,
        };
      }
    })();

    memo.set(key, promise);
    return promise;
  };
}

