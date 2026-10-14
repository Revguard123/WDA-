// Supported tiers for new grants. Legacy buyer rows keep their existing
// entitlement; retired names must not silently create a different package.
export const BUYER_TIER_BATCHES = Object.freeze({ accelerator: 3, vanguard: 12 });

export function normalizeBuyerTier(value) {
  const tier = String(value ?? '').trim().toLowerCase();
  return Object.hasOwn(BUYER_TIER_BATCHES, tier) ? tier : null;
}

export function tierForKajabiGrant(body = {}) {
  // An explicitly supplied tier wins, including when it is invalid.
  if (body.tier != null && String(body.tier).trim()) return normalizeBuyerTier(body.tier);
  const offer = String(body.offer || body.offer_title || body.product || body.product_title || '');
  const matches = [...offer.matchAll(/\b(accelerator|vanguard)\b/gi)];
  const tiers = new Set(matches.map((match) => match[1].toLowerCase()));
  return tiers.size === 1 ? [...tiers][0] : null;
}
