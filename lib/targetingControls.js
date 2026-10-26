// UI-only helpers. No targeting, persistence or provider behavior changes here.
export function scheduleNaicsSearch(query, update, {
  fetcher = fetch, cache = new Map(), delay = 650,
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  const clean = query.trim().slice(0, 200);
  const controller = new AbortController();
  const key = clean.toLowerCase();
  let timer;
  if (clean.length < 2) {
    update({ results: [], searching: false, error: '' });
  } else if (cache.has(key)) {
    update({ results: cache.get(key), searching: false, error: '' });
  } else {
    update({ results: [], searching: true, error: '' });
    timer = setTimer(async () => {
      try {
        const response = await fetcher('/api/naics/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: clean }), signal: controller.signal,
        });
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (controller.signal.aborted) return;
        const results = (Array.isArray(data.matches) ? data.matches : [])
          .filter((item) => /^\d{6}$/.test(String(item?.code)) && typeof item?.title === 'string')
          .map((item) => ({ code: String(item.code), title: item.title }));
        cache.set(key, results);
        if (cache.size > 25) cache.delete(cache.keys().next().value);
        update({ results, searching: false, error: '' });
      } catch {
        if (!controller.signal.aborted) update({ results: [], searching: false, error: 'Search is unavailable right now. Try again or add a NAICS code below.' });
      }
    }, delay);
  }
  return () => { clearTimer(timer); controller.abort(); };
}

// More travel at common small-business amounts; typed values have no UI ceiling.
const BUDGET_STOPS = [0, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000];
export function budgetStops(min, max) {
  const highest = Math.max(...[min, max].map((value) => Number.isFinite(Number(value)) ? Number(value) : 0));
  return highest > 10000000 ? [...BUDGET_STOPS, Math.ceil(highest / 10000000) * 10000000] : BUDGET_STOPS;
}
export function budgetPosition(value, stops) {
  const number = Math.max(0, Number(value) || 0);
  const index = stops.findIndex((stop) => stop >= number);
  if (index <= 0) return index === 0 ? 0 : 1000;
  return ((index - 1 + (number - stops[index - 1]) / (stops[index] - stops[index - 1])) / (stops.length - 1)) * 1000;
}
export function budgetAmount(position, stops) {
  const scaled = Math.max(0, Math.min(1000, Number(position))) / 1000 * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  return Math.round(stops[index] + (scaled - index) * (stops[index + 1] - stops[index]));
}

export const US_STATES = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|AS:American Samoa|GU:Guam|MP:Northern Mariana Islands|PR:Puerto Rico|VI:U.S. Virgin Islands'.split('|').map((entry) => {
  const [code, name] = entry.split(':');
  return { code, name };
});
