// Single source of truth for the app's public base URL. Every buyer-facing link
// (email buttons, setup / contracts / targeting pages, dive-deeper links) is
// built from this, so the whole product can be pointed at a domain you own by
// setting ONE environment variable, APP_BASE_URL, with no code changes and no
// risk of one file disagreeing with another.
//
// Precedence, most trusted first:
//   1. explicit                        an override the caller passes in
//   2. APP_BASE_URL                    the custom domain you own (set in prod)
//   3. VERCEL_PROJECT_PRODUCTION_URL   Vercel's stable production alias, set
//                                      automatically, so links never fall back
//                                      to a throwaway branch-preview host
//   4. the incoming request origin     last resort (local dev, preview URLs)
//
// Returns a URL with no trailing slash, or '' if nothing could be resolved.
export function resolveBaseUrl({ explicit, req } = {}) {
  if (explicit) return trim(explicit);
  if (process.env.APP_BASE_URL) return trim(process.env.APP_BASE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (req) {
    try {
      return new URL(req.url).origin;
    } catch {
      // fall through to empty
    }
  }
  return '';
}

function trim(s) {
  return String(s).replace(/\/+$/, '');
}
