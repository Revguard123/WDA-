// Persistence for the `opportunities` cache. Kept separate from the SAM client
// so the engine can be tested with an in-memory upsert and used in production
// with Supabase, without either knowing about the other.

import { getServiceClient } from './supabase.js';

// Upsert mapped opportunity rows into `opportunities`, keyed on notice_id.
// Refreshes fetched_at on every write. Returns the number of rows written.
export async function upsertOpportunities(rows) {
  if (!rows || rows.length === 0) return 0;
  const supabase = await getServiceClient();
  const payload = rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() }));
  const { error, count } = await supabase
    .from('opportunities')
    .upsert(payload, { onConflict: 'notice_id', count: 'exact' });
  if (error) throw new Error(`opportunities upsert failed: ${error.message}`);
  return count ?? rows.length;
}

// A no-persistence upsert for dry runs / local proofs. Just counts.
export function inMemoryUpsert(sink = []) {
  return async (rows) => {
    sink.push(...rows);
    return rows.length;
  };
}

// Read the cached candidate pool for a niche from `opportunities`, so a batch
// can curate without hitting the SAM search API live (the daily sync warms this
// cache). Filters to the niche's NAICS codes and to still-open deadlines. Rows
// come back in the same shape as a live engine pull (including `raw` for the
// geography filter); their `description` column holds the SAM description URL,
// which resolveDescriptionsForRows fetches on demand for the finalists.
export async function readCachedOpportunities(niche = {}, { now = new Date(), limit = 500 } = {}) {
  const naicsList = (niche.naics || []).map((n) => String(n).trim()).filter(Boolean);
  if (naicsList.length === 0) return [];
  const supabase = await getServiceClient();
  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString();
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .in('naics', naicsList)
    .or(`response_deadline.is.null,response_deadline.gt.${nowIso}`)
    .order('response_deadline', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`opportunities cache read failed: ${error.message}`);
  return data || [];
}
