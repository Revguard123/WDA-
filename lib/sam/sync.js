import { LIVE_NOTICE_TYPES, SamApiError, SamNetworkError } from './client.js';
import { normalizeSearchState } from './geography.js';
import { runEngineForNiche } from './engine.js';

function requestBudget(value) {
  if (value == null) return { limit: 0, reason: 'missing' };
  if (String(value).trim() === '') return { limit: 0, reason: 'blank' };
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) {
    return { limit: 0, reason: 'invalid_configuration' };
  }
  return { limit, reason: limit === 0 ? 'zero' : null };
}

export function dailySyncRequestLimit(value) {
  return requestBudget(value).limit;
}

class SyncBudgetError extends Error {
  constructor() { super('Daily SAM warming request budget reached'); this.name = 'SyncBudgetError'; }
}

class SyncPersistenceError extends Error {
  constructor() { super('SAM opportunity cache write failed'); this.name = 'SyncPersistenceError'; }
}

export function collectSyncSearches(buyers) {
  const jobs = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;
  for (const buyer of buyers) {
    let state;
    try { state = normalizeSearchState(buyer.state); }
    catch { invalid.push({ error: 'Invalid SAM state: expected a two-letter state code', failure_type: 'malformed_input' }); continue; }
    for (const value of buyer.naics || []) {
      const naics = String(value ?? '').trim();
      if (!naics) continue;
      if (!/^\d{6}$/.test(naics)) {
        invalid.push({ error: 'Invalid SAM NAICS: expected six digits', failure_type: 'malformed_input' });
        continue;
      }
      for (const ptype of LIVE_NOTICE_TYPES) {
        const key = `${naics}|${state || ''}|${ptype}`;
        if (seen.has(key)) { duplicates += 1; continue; }
        seen.add(key);
        jobs.push({ naics, state, ptype });
      }
    }
  }
  return { jobs, invalid, duplicates };
}

// Budget is local to this cache-warming run. Every external page consumes one
// unit; activation/monthly do not use this wrapper or inherit its ceiling.
export async function runDailySamSync(buyers, {
  apiKey, upsert, maxRequests, fetchImpl = fetch, now = new Date(), logger = console,
} = {}) {
  const { limit, reason } = requestBudget(maxRequests);
  if (limit === 0) {
    logger.warn?.({ event: 'sam_sync_warming_disabled', reason,
      configuration: 'SAM_DAILY_SYNC_MAX_REQUESTS', request_count: 0,
      message: 'Daily cache warming disabled; configure a positive integer request budget. Student live SAM paths remain enabled.' });
  }
  const { jobs, invalid, duplicates } = collectSyncSearches(buyers);
  let requests = 0;
  let quotaError = null;
  const results = [...invalid];
  const boundedFetch = async (...args) => {
    if (quotaError) throw quotaError;
    if (requests >= limit) throw new SyncBudgetError();
    requests += 1;
    return fetchImpl(...args);
  };
  let upserted = 0;
  let quotaAt = null;
  const persist = upsert ? async (rows) => {
    try { return await upsert(rows); }
    catch { throw new SyncPersistenceError(); }
  } : undefined;
  if (duplicates) logger.info?.({ event: 'sam_sync_duplicate_search_removed', count: duplicates });
  for (const job of jobs) {
    const search = { naics: job.naics, state: job.state, ptype: job.ptype };
    if (quotaError || requests >= limit) {
      results.push({ ...search, skipped: quotaError ? 'quota_exhausted' : 'request_budget' });
      continue;
    }
    const requestsBefore = requests;
    try {
      const { stats } = await runEngineForNiche({ naics: [job.naics], state: job.state }, {
        apiKey, upsert: persist, fetchImpl: boundedFetch, now, noticeTypes: [job.ptype],
        enforceSetAside: false, resolveDescriptions: false, minRunwayDays: 0,
      });
      upserted += stats.upserted;
      results.push({ ...search, attempted: true, kept: stats.kept, upserted: stats.upserted });
    } catch (err) {
      if (err instanceof SyncBudgetError) {
        results.push({ ...search, attempted: requests > requestsBefore, skipped: 'request_budget' });
        continue;
      }
      const failure_type = err instanceof SamApiError ? (err.quotaExhausted ? 'quota_exhausted' : 'http_error')
        : err instanceof SamNetworkError ? 'network_error'
          : err instanceof SyncPersistenceError ? 'persistence_error'
            : err instanceof TypeError ? 'malformed_input' : 'request_error';
      // Do not emit arbitrary provider/network messages: they can contain URLs
      // with credentials. HTTP classification and search identity are sufficient.
      results.push({ ...search, attempted: requests > requestsBefore, error: err instanceof SamApiError ? err.message : 'SAM warming search or cache write failed', failure_type });
      if (err instanceof SamApiError && err.quotaExhausted) {
        quotaError = err;
        quotaAt = new Date().toISOString();
        logger.warn?.({ event: 'sam_quota_exhausted', at: quotaAt, status: err.status, code: err.code, next_access_time: err.nextAccessTime });
      }
    }
  }
  const summary = {
    ranAt: now.toISOString(), searches: jobs.length, upserted,
    request_count: requests, max_requests: limit,
    warming_status: limit === 0 ? 'disabled' : 'enabled', disabled_reason: reason,
    attempted_count: results.filter((r) => r.attempted).length,
    successful_count: results.filter((r) => !r.error && !r.skipped).length,
    failed_count: results.filter((r) => r.error).length,
    skipped_due_to_quota_count: results.filter((r) => r.skipped === 'quota_exhausted').length,
    skipped_due_to_budget_count: results.filter((r) => r.skipped === 'request_budget').length,
    quota_exhausted: Boolean(quotaError), quota_exhausted_at: quotaAt,
    next_access_time: quotaError?.nextAccessTime || null,
    duplicate_searches_removed: duplicates,
  };
  logger.info?.({ event: 'sam_sync_complete', ...summary });
  return { ok: true, ...summary, results };
}

export function syncAlert(result) {
  const failures = result.results.filter((r) => r.error);
  if (!result.quota_exhausted && !failures.length) return null;
  return {
    subject: result.quota_exhausted ? 'Daily SAM sync: quota exhausted' : `Daily SAM sync: ${failures.length} search/input failures`,
    summary: `Cache warming at ${result.ranAt}: ${result.successful_count} searches completed, ${result.failed_count} failed, ${result.skipped_due_to_quota_count} skipped after quota exhaustion, ${result.skipped_due_to_budget_count} deferred by budget. The cache may be incomplete; this is not a student delivery failure report.`,
    rows: [
      ...(result.quota_exhausted ? [`Quota exhausted at ${result.quota_exhausted_at}; next access: ${result.next_access_time || 'not supplied'}`] : []),
      ...failures.slice(0, 10).map((r) => `${r.naics || 'invalid input'}/${r.state || 'any'}/${r.ptype || '-'}: ${r.failure_type}: ${r.error}`),
    ],
  };
}
