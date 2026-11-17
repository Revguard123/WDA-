import { getBuyerById } from './buyers.js';
import { listDeliveriesForBatch } from './deliveries.js';
import { runBatchForBuyer } from './pipeline.js';
import { dueContractTopUps, topUpRemaining } from './buyerDeliveryPolicy.js';

// Generate on release day, not ahead of time: unreleased contracts cannot leak
// through the archive, deep links, counts, or an early customer email.
export async function runScheduledTopUps({ now = new Date(), baseUrl, deps = {} } = {}) {
  const readBuyer = deps.getBuyerById || getBuyerById;
  const readDeliveries = deps.listDeliveriesForBatch || listDeliveriesForBatch;
  const runBatch = deps.runBatchForBuyer || runBatchForBuyer;
  const results = [];
  for (const job of dueContractTopUps(now)) {
    try {
      const buyer = await readBuyer(job.buyerId);
      if (!buyer) throw new Error('Scheduled top-up buyer not found');
      // Never create a first activation, revive an account, or backfill an old
      // cycle after the account has moved on to another monthly batch.
      if (buyer.status !== 'active' || Number(buyer.batches_sent) !== job.batchMonth) continue;
      const deliveries = await readDeliveries(buyer.id, job.batchMonth);
      const remaining = topUpRemaining(job, deliveries);
      if (!remaining) continue;
      const result = await runBatch(buyer, {
        baseUrl,
        send: false, // Portal-only top-up; no extra customer email was requested.
        now,
        n: remaining,
        topUp: job,
      });
      results.push({
        buyer_id: buyer.id, job: job.id,
        delivered: result.delivered.inserted.length,
        shortfall: Math.max(0, remaining - result.delivered.inserted.length),
      });
    } catch (error) {
      results.push({ buyer_id: job.buyerId, job: job.id, error: String(error?.message || error) });
    }
  }
  return results;
}
