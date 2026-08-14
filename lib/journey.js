export function hasMeaningfulTargeting(buyer = {}) {
  return Array.isArray(buyer.naics) && buyer.naics.some((code) => String(code || '').trim());
}

export function portalPathForBuyer(buyer = {}) {
  const token = buyer.access_token;
  return buyer.status === 'exploring' ? `/setup/${token}` : `/contracts/${token}`;
}

export function setupStateForBuyer(buyer = {}, { directTargeting = false } = {}) {
  const token = buyer.access_token;
  if (buyer.status !== 'exploring') return { redirect: `/contracts/${token}` };

  const hasTargeting = hasMeaningfulTargeting(buyer);
  return {
    hasTargeting,
    showChoice: !hasTargeting && !directTargeting,
  };
}

export function discoverStateForBuyer(buyer = {}) {
  const token = buyer.access_token;
  if (buyer.status !== 'exploring') return { redirect: `/contracts/${token}` };
  return { allowed: true };
}

export function startStateForBuyer(buyer = {}) {
  const token = buyer.access_token;
  const incompleteFirstActivation = buyer.status === 'active' && Number(buyer.batches_sent || 0) === 0;
  if (incompleteFirstActivation && hasMeaningfulTargeting(buyer)) return { allowed: true };
  if (buyer.status !== 'exploring') return { redirect: `/contracts/${token}` };
  if (!hasMeaningfulTargeting(buyer)) return { redirect: `/setup/${token}` };
  return { allowed: true };
}
