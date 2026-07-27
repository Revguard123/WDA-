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
