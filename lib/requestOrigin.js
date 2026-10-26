// Browser Origin must match the actual request authority, not Next's internal
// URL (which can stay localhost when accessed via a LAN address or IP alias).
function parseOrigin(value) {
  if (typeof value !== 'string' || !/^https?:\/\/[^\s/\\?#@,%]+$/i.test(value)) return null;
  try { return new URL(value).origin; } catch { return null; }
}

export function requestOrigin(request) {
  try {
    const url = new URL(request.url);
    const host = request.headers.get('host') ?? url.host;
    // TLS-terminating proxies must preserve Host and overwrite this header.
    // Do not trust X-Forwarded-Host or choose from comma-separated host lists.
    const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1);
    if (!/^(?:http|https)$/i.test(protocol)) return null;
    return parseOrigin(`${protocol}://${host}`);
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request, expected = requestOrigin(request), { allowPrivateFormNavigation = false } = {}) {
  if (!expected || request.headers.get('sec-fetch-site')?.toLowerCase() === 'cross-site') return false;
  const origin = request.headers.get('origin');
  // Referrer-Policy: no-referrer intentionally makes native form navigations
  // send Origin: null. Only the logout endpoint opts in, and only when the
  // browser's forbidden Fetch Metadata headers prove same-origin navigation.
  if (origin === 'null') return allowPrivateFormNavigation
    && request.method === 'POST'
    && request.headers.get('sec-fetch-site') === 'same-origin'
    && request.headers.get('sec-fetch-mode') === 'navigate'
    && request.headers.get('sec-fetch-dest') === 'document';
  // Preserve non-browser clients without Origin; other opaque/malformed origins
  // and explicit cross-site browser requests are never accepted.
  return origin === null || parseOrigin(origin) === expected;
}
