import { getOfficialNaicsTitle } from './playbook/naicsReference.js';

function normalizeNaicsList(recommendation = {}, buyer = {}) {
  const recommendationNaics = Array.isArray(recommendation.naics) ? recommendation.naics : [];
  if (recommendationNaics.length > 0) {
    return recommendationNaics
      .map((n) => ({
        code: String(n?.code || '').trim(),
        title: String(n?.title || getOfficialNaicsTitle(n?.code) || '').trim(),
      }))
      .filter((n) => /^\d{6}$/.test(n.code));
  }

  return (Array.isArray(buyer.naics) ? buyer.naics : [])
    .map((code) => ({
      code: String(code || '').trim(),
      title: String(getOfficialNaicsTitle(code) || '').trim(),
    }))
    .filter((n) => /^\d{6}$/.test(n.code));
}

export function discoveryTargetingReviewState({ session, buyer } = {}) {
  const selected = session?.selected_recommendation;
  if (!selected || typeof selected !== 'object') return null;

  const naics = normalizeNaicsList(selected, buyer);
  if (naics.length === 0) return null;

  return {
    source: 'discovery',
    industryName: selected.industry_name || '',
    subindustryName: selected.subindustry_name || '',
    naics,
    feedability: selected.feedability || null,
  };
}
