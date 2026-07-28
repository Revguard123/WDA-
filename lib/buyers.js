// Buyer persistence. In production a buyer is created by the Kajabi grant
// webhook (Slice 6); this find-or-create helper lets the Slice 3 proof run
// end to end against a real buyer row without that wiring in place yet.

import { getServiceClient } from './supabase.js';

export async function findOrCreateBuyer({ email, name, niche = {} }) {
  const supabase = await getServiceClient();

  const { data: existing, error: selErr } = await supabase
    .from('buyers')
    .select('*')
    .eq('email', email)
    .limit(1)
    .maybeSingle();
  if (selErr) throw new Error(`buyer lookup failed: ${selErr.message}`);
  if (existing) return existing;

  const row = {
    email,
    name: name || null,
    tier: 'enlist',
    batches_owed: 1,
    naics: niche.naics || [],
    keywords: niche.keywords || [],
    set_asides: niche.set_asides || [],
    state: niche.state || null,
    size_min: niche.size_min ?? null,
    size_max: niche.size_max ?? null,
    status: 'active',
  };
  const { data: created, error: insErr } = await supabase
    .from('buyers')
    .insert(row)
    .select('*')
    .single();
  if (insErr) {
    // 23505: another request created this buyer between our lookup and insert
    // (UNIQUE(email) caught it). Re-read and return the existing row.
    if (insErr.code === '23505') {
      const { data: raced } = await supabase.from('buyers').select('*').eq('email', email).single();
      if (raced) return raced;
    }
    throw new Error(`buyer create failed: ${insErr.message}`);
  }
  return created;
}

export async function incrementBatchesSent(buyerId) {
  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from('buyers')
    .select('batches_sent, batches_owed')
    .eq('id', buyerId)
    .single();
  if (error) throw new Error(`buyer read failed: ${error.message}`);
  const next = (data.batches_sent || 0) + 1;
  const status = next >= data.batches_owed ? 'completed' : 'active';
  const { error: updErr } = await supabase
    .from('buyers')
    .update({ batches_sent: next, status })
    .eq('id', buyerId);
  if (updErr) throw new Error(`buyer update failed: ${updErr.message}`);
  return { batches_sent: next, status };
}
