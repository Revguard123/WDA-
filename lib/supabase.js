// Server-side Supabase client. Uses the service-role key and must never be
// imported into browser/client bundles. All engine and cron code runs
// server-side (Next.js route handlers, scripts), so this is safe there.
//
// The `@supabase/supabase-js` import is lazy so that modules which only need
// the in-memory helpers (tests, the mock proof harness) do not require the
// package to be installed.

let cached = null;

export async function getServiceClient() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  const { createClient } = await import('@supabase/supabase-js');
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // CRITICAL: force every request past Next.js's App Router fetch cache.
      // The Supabase client uses fetch under the hood, and Next caches fetch by
      // default. Without no-store, reads return stale buyer data, e.g. an
      // account that has since set its niche and activated still renders blank
      // ('my preferences and contracts disappeared'). Every DB read must be live.
      fetch: (input, init = {}) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return cached;
}
