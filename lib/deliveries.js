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
  // Two plain reads instead of a PostgREST embedded join (the embed proved
  // unreliable against this project's schema cache).
  const { data, error } = await supabase
    .from('deliveries')
    .select('notice_id')
    .eq('buyer_id', buyerId);
  if (error) throw new Error(`delivered lookup failed: ${error.message}`);
  const noticeIds = new Set((data || []).map((d) => d.notice_id).filter(Boolean));

  const solicitations = new Set();
  if (noticeIds.size) {
    const { data: opps, error: oppErr } = await supabase
      .from('opportunities')
      .select('solicitation_num')
      .in('notice_id', [...noticeIds]);
    if (oppErr) throw new Error(`delivered solicitations lookup failed: ${oppErr.message}`);
    for (const o of opps || []) {
      if (o.solicitation_num) solicitations.add(String(o.solicitation_num).trim());
    }
  }
  return { noticeIds, solicitations };
}

// All of a buyer's delivered contracts, newest first, joined to the cached
// opportunity details. Plain reads (no PostgREST embed).
export async function listDeliveriesForBuyer(buyerId) {
  const supabase = await getServiceClient();
  const { data: dels, error } = await supabase
    .from('deliveries')
    .select('notice_id, batch_month, sent_at, why_line')
    .eq('buyer_id', buyerId)
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`deliveries list failed: ${error.message}`);
  if (!dels || dels.length === 0) return [];

  const ids = [...new Set(dels.map((d) => d.notice_id))];
  const { data: opps, error: oppErr } = await supabase
    .from('opportunities')
    .select('notice_id, title, agency, naics, set_aside_type, response_deadline, est_value, sam_url')
    .in('notice_id', ids);
  if (oppErr) throw new Error(`opportunities lookup failed: ${oppErr.message}`);
  const oppById = new Map((opps || []).map((o) => [o.notice_id, o]));

  return dels.map((d) => ({ ...(oppById.get(d.notice_id) || { notice_id: d.notice_id }), ...d }));
}

// One delivered contract for a buyer (for the Dive Deeper page): the delivery
// row (deep_dive_text, why_line) plus the opportunity details.
export async function getDeliveryForBuyer(buyerId, noticeId) {
  const supabase = await getServiceClient();
  const { data: del, error } = await supabase
    .from('deliveries')
    .select('notice_id, batch_month, sent_at, why_line, deep_dive_text')
    .eq('buyer_id', buyerId)
    .eq('notice_id', noticeId)
    .maybeSingle();
  if (error) throw new Error(`delivery lookup failed: ${error.message}`);
  if (!del) return null;

  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select('notice_id, title, agency, naics, set_aside_type, place_of_perf, response_deadline, est_value, sam_url')
    .eq('notice_id', noticeId)
    .maybeSingle();
  if (oppErr) throw new Error(`opportunity lookup failed: ${oppErr.message}`);
  return { ...del, opportunity: opp || null };
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
