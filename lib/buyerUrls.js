// Public URLs are identifiers, never credentials. Access comes from the cookie.
export const BUYER_SESSION_KEY = 'me';
export const BUYER_ACCESS_COOKIE = 'wda_buyer_access';
export const BUYER_SESSION_SECONDS = 60 * 60 * 24 * 30;

export function isBuyerAccessToken(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export function buyerPagePath(page, key = BUYER_SESSION_KEY) {
  return key === BUYER_SESSION_KEY ? `/${page}` : `/${page}/${encodeURIComponent(key)}`;
}

export function contractSlug(title, noticeId) {
  const label = String(title || 'contract').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'contract';
  return `${label}--${encodeURIComponent(String(noticeId))}`;
}

export function contractPath(title, noticeId) {
  return `/d/${contractSlug(title, noticeId)}`;
}

export function noticeIdFromSlug(slug) {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)--(.+)$/.exec(String(slug || ''));
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[2]);
    return /^[a-zA-Z0-9_-]{1,160}$/.test(id) ? id : null;
  } catch { return null; }
}

// Never allow an access-link destination to become an open redirect. Query
// parameters are limited to the existing targeting/discovery modes.
export function safeBuyerDestination(value) {
  try {
    const url = new URL(String(value || ''), 'https://wda.invalid');
    if (url.origin !== 'https://wda.invalid' || url.hash) return '/contracts';
    if (!/^\/(?:setup|discover|start|contracts|targeting)$/.test(url.pathname)
      && !(/^\/d\/[^/]+$/.test(url.pathname) && noticeIdFromSlug(url.pathname.slice(3)))) return '/contracts';
    const query = new URLSearchParams();
    for (const key of ['review', 'update', 'targeting']) if (url.searchParams.get(key) === '1') query.set(key, '1');
    return url.pathname + (query.size ? `?${query}` : '');
  } catch { return '/contracts'; }
}

export function publicBuyerProfile(buyer = {}) {
  const { name, naics, keywords, set_asides, state, size_min, size_max } = buyer;
  return { name, naics, keywords, set_asides, state, size_min, size_max };
}
