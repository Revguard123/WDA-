import { getBuyerByToken, incrementBatchesSent } from './buyers.js';
import { countDeliveriesForBuyer } from './deliveries.js';
import { runBatchForBuyer } from './pipeline.js';
import { resolveBaseUrl } from './baseUrl.js';
import { getServiceClient } from './supabase.js';

export function oneMonthOut(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function hasActivationTargeting(buyer = {}) {
  return Array.isArray(buyer.naics) && buyer.naics.length > 0;
}

export function isIncompleteFirstActivation(buyer = {}) {
  return buyer.status === 'active' && Number(buyer.batches_sent || 0) === 0;
}

async function claimBuyerForActivation(buyer, now) {
  const supabase = await getServiceClient();
  const scheduleAt = oneMonthOut(now).toISOString();

  if (buyer.status === 'exploring') {
    const { data, error } = await supabase
      .from('buyers')
      .update({ status: 'active', activated_at: now.toISOString(), next_batch_at: scheduleAt })
      .eq('id', buyer.id)
      .eq('status', 'exploring')
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }

  if (isIncompleteFirstActivation(buyer)) {
    const { data, error } = await supabase
      .from('buyers')
      .update({ activated_at: buyer.activated_at || now.toISOString(), next_batch_at: buyer.next_batch_at || scheduleAt })
      .eq('id', buyer.id)
      .eq('status', 'active')
      .eq('batches_sent', 0)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }

  return null;
}

async function rollbackIncompleteActivation(buyer) {
  const supabase = await getServiceClient();
  const { error } = await supabase
    .from('buyers')
    .update({ status: 'exploring', activated_at: null, next_batch_at: null })
    .eq('id', buyer.id)
    .eq('status', 'active')
    .eq('batches_sent', 0);
  if (error) throw new Error(error.message);
}

function successBody(result, extra = {}) {
  return {
    ok: true,
    outcome: 'success',
    activated: true,
    ...extra,
    delivered: result?.delivered,
    chosen: result?.chosen?.length ?? 0,
    shortfall: result?.stats?.shortfall,
    sent: result?.sent,
  };
}

function noMatchesBody(result = {}) {
  return {
    ok: true,
    outcome: 'no_matches',
    retryable: true,
    activated: false,
    chosen: result.chosen?.length ?? 0,
    shortfall: result.stats?.shortfall,
    delivered: result.delivered || { inserted: [], skipped: [] },
    message: 'No strong matches right now',
  };
}

function retryableFailure(status = 503, extra = {}) {
  return {
    status,
    body: {
      ok: false,
      outcome: 'retryable_system_error',
      error: "We couldn't complete the search right now. Please try again.",
      retryable: true,
      ...extra,
    },
  };
}

function logActivation(event, fields = {}, logger = console) {
  logger.info?.({ event, ...fields });
}

function warnActivation(event, fields = {}, logger = console) {
  logger.warn?.({ event, ...fields });
}

export async function activateBuyer({ token, req, now = new Date(), deps = {} }) {
  const readBuyer = deps.getBuyerByToken || getBuyerByToken;
  const claimBuyer = deps.claimBuyerForActivation || claimBuyerForActivation;
  const rollback = deps.rollbackIncompleteActivation || rollbackIncompleteActivation;
  const runBatch = deps.runBatchForBuyer || runBatchForBuyer;
  const countDeliveries = deps.countDeliveriesForBuyer || countDeliveriesForBuyer;
  const bumpBatch = deps.incrementBatchesSent || incrementBatchesSent;
  const logger = deps.logger || console;
  const baseUrl = deps.resolveBaseUrl ? deps.resolveBaseUrl({ req }) : resolveBaseUrl({ req });

  const buyer = await readBuyer(token);
  if (!buyer) return { status: 404, body: { error: 'not found' } };

  if (buyer.status === 'completed') {
    return { status: 200, body: { ok: true, alreadyActive: true, status: buyer.status } };
  }

  if (buyer.status !== 'exploring' && !isIncompleteFirstActivation(buyer)) {
    return { status: 200, body: { ok: true, alreadyActive: true, status: buyer.status } };
  }

  if (!hasActivationTargeting(buyer)) {
    return {
      status: 400,
      body: { ok: false, outcome: 'validation_error', error: 'Set up your niche first, then come back and hit Go.', needsNiche: true },
    };
  }

  let claimed;
  try {
    claimed = await claimBuyer(buyer, now);
  } catch {
    warnActivation('activation_claim_failed', { buyerId: buyer.id }, logger);
    return retryableFailure(500);
  }
  if (!claimed) return { status: 200, body: { ok: true, alreadyActive: true } };
  logActivation('activation_claimed', {
    buyerId: claimed.id,
    recovered: isIncompleteFirstActivation(buyer),
    batchesSent: claimed.batches_sent || 0,
  }, logger);

  try {
    const result = await runBatch(claimed, { baseUrl, send: true, logger });
    let batch = result.batch || null;
    const inserted = result.delivered?.inserted?.length || 0;
    logActivation('activation_batch_completed', {
      buyerId: claimed.id,
      chosen: result.chosen?.length || 0,
      inserted,
      shortfall: result.stats?.shortfall,
      hardFilter: result.stats?.hardFilter,
      widened: result.stats?.widened || null,
    }, logger);

    if (!batch && Number(claimed.batches_sent || 0) === 0) {
      const existingDeliveries = await countDeliveries(claimed.id);
      if (existingDeliveries > 0) {
        batch = await bumpBatch(claimed.id, { expectedBatchesSent: 0 });
        logActivation('activation_repaired_partial_delivery', { buyerId: claimed.id, existingDeliveries }, logger);
      }
    }

    if (!batch && Number(claimed.batches_sent || 0) === 0 && inserted === 0) {
      await rollback(claimed);
      logActivation('activation_no_matches', {
        buyerId: claimed.id,
        shortfall: result.stats?.shortfall,
        hardFilter: result.stats?.hardFilter,
      }, logger);
      return { status: 200, body: noMatchesBody(result) };
    }

    return { status: 200, body: successBody({ ...result, batch }, isIncompleteFirstActivation(buyer) ? { recovered: true } : {}) };
  } catch (err) {
    warnActivation('activation_batch_failed', { buyerId: claimed.id, error: String(err?.message || err).slice(0, 180) }, logger);
    const latest = await readBuyer(token).catch(() => null);
    if (latest && Number(latest.batches_sent || 0) > 0 && latest.status !== 'exploring') {
      logActivation('activation_recovered_after_batch_failure', { buyerId: claimed.id, status: latest.status }, logger);
      return { status: 200, body: successBody(null, { recovered: true, status: latest.status }) };
    }

    try {
      const existingDeliveries = await countDeliveries(claimed.id);
      if (existingDeliveries > 0 && Number(latest?.batches_sent || 0) === 0) {
        const batch = await bumpBatch(claimed.id, { expectedBatchesSent: 0 });
        logActivation('activation_repaired_partial_delivery_after_error', { buyerId: claimed.id, existingDeliveries }, logger);
        return { status: 200, body: successBody({ batch, delivered: { inserted: [] }, chosen: [], stats: {}, sent: null }, { recovered: true }) };
      }
      await rollback(claimed);
    } catch {
      warnActivation('activation_recovery_failed', { buyerId: claimed.id }, logger);
      return retryableFailure(500);
    }

    return retryableFailure(503);
  }
}
