export const CONTRACT_CARD_WHY_LABEL = 'Why this is winnable for you';
export const CONTRACT_CARD_BREAKDOWN_CTA = 'See Full Breakdown';
export const DEEP_DIVE_WHY_LABEL = 'Why we surfaced this one';

export function formatBatchDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function contractsPresentationForBuyer(buyer = {}, { deliveryCount = 0, now = new Date() } = {}) {
  const status = buyer.status || '';
  const batchesOwed = Number(buyer.batches_owed || 0);
  const batchesSent = Number(buyer.batches_sent || 0);
  const hasRemainingBatches = status === 'active' && batchesOwed > batchesSent;

  const completed = status === 'completed';
  const showTargetingLink = status !== 'completed';
  const listTitle = completed
    ? 'Your Contract Archive'
    : deliveryCount === 5
      ? "This month's five winnable targets"
      : 'Your winnable targets';

  let statusCallout = null;
  if (completed) {
    statusCallout = {
      title: 'Your Curated Target Contracts delivery is complete',
      body: 'All contract batches included with this purchase have been delivered. You can continue reviewing your previous opportunities below.',
    };
  } else if (hasRemainingBatches) {
    const nextDate = formatBatchDate(buyer.next_batch_at);
    const nextTime = nextDate ? new Date(buyer.next_batch_at).getTime() : NaN;
    const future = Number.isFinite(nextTime) && nextTime > new Date(now).getTime();
    statusCallout = future
      ? {
          title: 'Your next five are on the way.',
          body: `Your next batch is scheduled for ${nextDate}.`,
        }
      : {
          title: 'Your next batch is on the way.',
          body: 'Additional contract batches remain with this purchase. We will show the next batch here when it is ready.',
        };
  }

  return {
    completed,
    hasRemainingBatches,
    showTargetingLink,
    listTitle,
    statusCallout,
  };
}
