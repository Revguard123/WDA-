import { sendSupportRequest } from '../../../lib/support.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 10_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const buckets = globalThis.__wdaSupportRateLimit || new Map();
globalThis.__wdaSupportRateLimit = buckets;

function clientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const existing = buckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  existing.count += 1;
  buckets.set(key, existing);
  return existing.count > MAX_REQUESTS_PER_WINDOW;
}

function safeError(status = 400) {
  return Response.json({ ok: false, error: 'We could not send your request right now. Please try again.' }, { status });
}

export async function POST(req) {
  if (rateLimited(req)) return safeError(429);

  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return safeError(400);
  }

  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return safeError(413);

  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return safeError(400);
  }

  try {
    await sendSupportRequest(body);
    return Response.json({ ok: true });
  } catch (err) {
    if (err?.code === 'SUPPORT_CONFIG_MISSING') {
      console.warn({
        event: 'support_request_failed',
        reason: 'missing_config',
        missing_keys: err.missing,
      });
      return safeError(503);
    }
    if (err?.code === 'SUPPORT_VALIDATION_FAILED') return safeError(400);
    console.warn({
      event: 'support_request_failed',
      reason: 'send_failed',
      error_name: err?.name || 'Error',
    });
    return safeError(502);
  }
}
