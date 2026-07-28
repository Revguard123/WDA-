// Slice 3 delivery write with the never-repeat guard. The UNIQUE (buyer_id,
// notice_id) constraint on deliveries is the hard lock (Section 4 of the spec);
// this code adds the belt-and-suspenders layers on top of it:
//   - exclude notice_ids AND solicitation_nums already delivered to the buyer
//   - if the DB constraint still trips (a race), fail loud rather than send a dup

import { getServiceClient } from './supabase.js';
import { upsertOpportunities } from './opportunities.js';

// Pure helper: given the buyer's already-delivered keys, split the chosen items
// into fresh (safe to send) and repeats (must be dropped). Exported for testing.
export function partitionRepeats(items, delivered = {}) {
  const seenNotice = delivered.noticeIds instanceof Set ? delivered.noticeIds : new Set(delivered.noticeIds || []);
  const seenSoli = delivered.solicitations instanceof Set ? delivered.solicitations : new Set(delivered.solicitations || []);
  const fresh = [];
  const repeats = [];
  for (const item of items) {
    const soli = item.solicitation_num ? String(item.solicitation_num).trim() : '';
    if (seenNotice.has(item.notice_id) || (soli && seenSoli.has(soli))) repeats.push(item);
    else fresh.push(item);
  }
  return { fresh, repeats };
}

// The notice_ids and solicitation_nums already delivered to a buyer. Used both
// as a Slice 2 matching exclusion (so batches backfill fresh contracts) and as
// the pre-insert repeat check here.
export async function getDeliveredKeys(buyerId, client) {
  const supabase = client || (await getServiceClient());
  const { data, error } = await supabase
    .from('deliveries')
    .select('notice_id, opportunities(solicitation_num)')
    .eq('buyer_id', buyerId);
  if (error) throw new Error(`delivered lookup failed: ${error.message}`);
  const noticeIds = new Set();
  const solicitations = new Set();
  for (const d of data || []) {
    if (d.notice_id) noticeIds.add(d.notice_id);
    const soli = d.opportunities?.solicitation_num;
    if (soli) solicitations.add(String(soli).trim());
  }
  return { noticeIds, solicitations };
}

// Persist a batch for a buyer.
// buyerId, batchMonth: number
// opportunityRows: full opportunities rows for the chosen contracts (FK targets)
// items: [{ notice_id, solicitation_num, why_line, deep_dive_text }]
// Returns { inserted: [notice_id], skipped: [notice_id] }.
export async function persistBatch({ buyerId, batchMonth, opportunityRows, items }) {
  const supabase = await getServiceClient();

  // Cache the opportunities first so the deliveries FK is satisfiable.
  if (opportunityRows?.length) await upsertOpportunities(opportunityRows);

  // Belt-and-suspenders: drop anything already in this buyer's history.
  const delivered = await getDeliveredKeys(buyerId, supabase);
  const { fresh, repeats } = partitionRepeats(items, delivered);

  if (fresh.length === 0) {
    return { inserted: [], skipped: repeats.map((r) => r.notice_id) };
  }

  const rows = fresh.map((it) => ({
    buyer_id: buyerId,
    notice_id: it.notice_id,
    batch_month: batchMonth,
    why_line: it.why_line || null,
    deep_dive_text: it.deep_dive_text || null,
  }));

  const { data, error } = await supabase.from('deliveries').insert(rows).select('notice_id');
  if (error) {
    // 23505 = unique_violation: the hard lock caught a repeat we did not filter.
    // Fail loud per the spec rather than risk sending a duplicate.
    if (error.code === '23505') {
      throw new Error(`NEVER-REPEAT LOCK TRIPPED for buyer ${buyerId}: ${error.message}. Batch not sent.`);
    }
    throw new Error(`deliveries insert failed: ${error.message}`);
  }

  return { inserted: (data || []).map((d) => d.notice_id), skipped: repeats.map((r) => r.notice_id) };
}
