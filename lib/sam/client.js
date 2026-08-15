// Thin client for the SAM.gov Get Opportunities (public) API v2.
// Docs: https://open.gsa.gov/api/get-opportunities-public-api/
// Endpoint: GET https://api.sam.gov/opportunities/v2/search
//
// Only Solicitation ('o') and Combined Synopsis/Solicitation ('k') are pulled
// at this layer. Sources-sought ('r') and RFIs are excluded here; the AI
// disqualification pass (Slice 2) is a second line of defense.

const SAM_SEARCH_URL = 'https://api.sam.gov/opportunities/v2/search';

// ptype (procurement / notice type) codes, per the live docs.
export const NOTICE_TYPES = {
  SOLICITATION: 'o',
  COMBINED_SYNOPSIS_SOLICITATION: 'k',
  PRESOLICITATION: 'p',
  SOURCES_SOUGHT: 'r',
  SPECIAL_NOTICE: 's',
  AWARD: 'a',
};

// The notice types we consider "live solicitations" worth pulling.
export const LIVE_NOTICE_TYPES = [
  NOTICE_TYPES.SOLICITATION,
  NOTICE_TYPES.COMBINED_SYNOPSIS_SOLICITATION,
];

// Format a Date (or ISO-ish string) as MM/dd/yyyy for postedFrom / postedTo.
export function formatSamDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date for SAM: ${date}`);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Build the query string for one search call. SAM requires api_key, postedFrom,
// postedTo (MM/dd/yyyy, at most a year apart) and limit (<= 1000). ptype,
// ncode (NAICS), typeOfSetAside and state are optional narrowing filters.
export function buildSearchParams({
  apiKey,
  postedFrom,
  postedTo,
  limit = 1000,
  offset = 0,
  ptype, // string or array of notice-type codes
  naicsCode, // single NAICS string, sent as SAM's documented ncode parameter
  typeOfSetAside, // single SAM set-aside code
  state, // place-of-performance state code
} = {}) {
  if (!apiKey) throw new Error('SAM api_key is required');
  if (!postedFrom || !postedTo) throw new Error('postedFrom and postedTo are required');

  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('postedFrom', postedFrom);
  params.set('postedTo', postedTo);
  params.set('limit', String(Math.min(Number(limit) || 1000, 1000)));
  params.set('offset', String(Number(offset) || 0));

  if (ptype != null) {
    const value = Array.isArray(ptype) ? ptype.join(',') : ptype;
    if (value) params.set('ptype', value);
  }
  if (naicsCode) params.set('ncode', naicsCode);
  if (typeOfSetAside) params.set('typeOfSetAside', typeOfSetAside);
  if (state) params.set('state', state);

  return params;
}

// Perform one page of search. Returns the parsed JSON body. `fetchImpl` is
// injectable so tests can run without network access.
export async function samSearchPage(options, { fetchImpl = fetch } = {}) {
  const params = buildSearchParams(options);
  const url = `${SAM_SEARCH_URL}?${params.toString()}`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await safeText(res);
    const safeParams = new URLSearchParams(params);
    safeParams.delete('api_key');
    throw new Error(`SAM search failed (${res.status}) ${SAM_SEARCH_URL}?${safeParams.toString()}: ${body.slice(0, 300)}`);
  }
  const body = await res.json();
  return body;
}

// Page through all results for a search up to `maxRecords`. SAM returns the
// full match count in `totalRecords` and the page slice in `opportunitiesData`.
export async function samSearchAll(options, { fetchImpl = fetch, maxRecords = 1000, pageSize = 1000 } = {}) {
  const collected = [];
  let offset = 0;
  let total = Infinity;

  while (collected.length < maxRecords && offset < total) {
    const limit = Math.min(pageSize, maxRecords - collected.length);
    const body = await samSearchPage({ ...options, limit, offset }, { fetchImpl });
    const page = Array.isArray(body.opportunitiesData) ? body.opportunitiesData : [];
    total = Number.isFinite(Number(body.totalRecords)) ? Number(body.totalRecords) : page.length;
    collected.push(...page);
    if (page.length === 0) break;
    offset += page.length;
  }

  return collected.slice(0, maxRecords);
}

// The v2 `description` field is a URL to the description resource, not the text
// itself. Resolve it to plain text (best-effort; returns '' on failure so a
// missing description never aborts a batch). Some records inline the text
// already, in which case we pass it through.
export async function resolveDescriptionText(descriptionField, { apiKey, fetchImpl = fetch } = {}) {
  if (!descriptionField) return '';
  const value = String(descriptionField);
  if (!/^https?:\/\//i.test(value)) return value; // already text
  try {
    const sep = value.includes('?') ? '&' : '?';
    const url = apiKey ? `${value}${sep}api_key=${encodeURIComponent(apiKey)}` : value;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const ct = res.headers?.get?.('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await res.json();
      return body?.description || body?.body || '';
    }
    return await res.text();
  } catch {
    return '';
  }
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export { SAM_SEARCH_URL };
