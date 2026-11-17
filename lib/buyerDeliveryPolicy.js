// Server-owned account exceptions. These are buyer IDs, never access tokens.
// Keep the purchased number of months separate from contracts in each month.
export const DEFAULT_CONTRACTS_PER_BATCH = 5;

const SAM_BUYER_ID = '23e47b6a-1c4e-4140-b49c-d91dd67f4267';
const OVERRIDES = Object.freeze({
  [SAM_BUYER_ID]: Object.freeze({ contractsPerBatch: 10 }),
});

const TOP_UPS = Object.freeze([
  Object.freeze({
    id: 'november-2026-batch-1-top-up',
    buyerId: SAM_BUYER_ID,
    batchMonth: 1,
    targetCount: 10,
    // Monday 16 November, 19:00 Asia/Karachi: the existing daily cron slot.
    releaseAt: '2026-11-16T14:00:00.000Z',
    periodLabel: 'November 2026',
    // Sam's confirmed November 16 reply. Scope this snapshot to this top-up:
    // the older saved profile must not steer the catch-up into moving work.
    // No inferred certifications or extra keywords are added.
    targeting: Object.freeze({
      naics: Object.freeze([
        '561210', '236118', '236220', '332992', '332993', '332994',
        '423990', '485991', '485999', '531110', '561720', '561730', '623210',
      ]),
      keywords: Object.freeze([]),
      state: null,
      size_min: 50000,
      size_max: 275000,
    }),
  }),
]);

export function contractsPerBatch(buyer = {}) {
  return OVERRIDES[buyer.id]?.contractsPerBatch || DEFAULT_CONTRACTS_PER_BATCH;
}

export function dueContractTopUps(now = new Date()) {
  const at = new Date(now).getTime();
  return TOP_UPS.filter((job) => at >= new Date(job.releaseAt).getTime());
}

export function topUpRemaining(job, deliveries = []) {
  return Math.max(0, job.targetCount - new Set(deliveries.map((delivery) => delivery.notice_id)).size);
}

// Resolve only server-owned targeting, never an arbitrary caller-supplied
// profile. Preserve identity, eligibility, and billing/schedule fields.
export function buyerForContractTopUp(buyer, job) {
  const approved = TOP_UPS.find((candidate) => candidate.id === job?.id
    && candidate.buyerId === buyer.id && candidate.batchMonth === job.batchMonth);
  if (!approved) throw new Error('Top-up is not configured for this buyer');
  if (!approved.targeting) return buyer;
  return {
    ...buyer,
    ...approved.targeting,
    naics: [...approved.targeting.naics],
    keywords: [...approved.targeting.keywords],
  };
}
