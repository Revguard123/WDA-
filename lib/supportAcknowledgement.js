import { createHash } from 'node:crypto';
import { buildSupportAcknowledgement, getSupportConfig, isValidSupportEmail, sendViaSmtp, validateSupportPayload } from './support.js';

const WINDOW_MS = 60_000;
const MAX_RECIPIENTS = 5000;
// Best-effort, per-process throttling, like the form's existing IP limit. Keys
// are hashes, not email addresses; this is not a durable ticket/delivery queue.
const recent = globalThis.__wdaSupportAcknowledgements || new Map();
globalThis.__wdaSupportAcknowledgements = recent;
let testTransport = null;

export function setAcknowledgementTransportForTests(transport) {
  testTransport = transport;
}

export function resetAcknowledgementStateForTests() {
  testTransport = null;
  recent.clear();
}

export async function sendSupportAcknowledgement(payload, { env = process.env, transport = testTransport, now = Date.now() } = {}) {
  if (String(env.SUPPORT_ACKNOWLEDGEMENT_ENABLED || '').trim().toLowerCase() === 'false') return { sent: false, reason: 'disabled' };
  const validation = validateSupportPayload(payload);
  if (!validation.ok) return { sent: false, reason: 'invalid_payload' };
  const recipient = validation.value.email;
  if (/[<>,;:"\\]/.test(recipient)) return { sent: false, reason: 'invalid_recipient' };
  const config = getSupportConfig({ ...env, SUPPORT_TO_EMAIL: recipient });
  if (!config.ok || !isValidSupportEmail(config.user) || /[<>,;:"\\]/.test(config.user)) {
    return { sent: false, reason: 'missing_smtp_config' };
  }
  if (recipient === config.user.toLowerCase()
      || /^(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|postmaster)(?:@|[+._-])/i.test(recipient)) {
    return { sent: false, reason: 'automated_mailbox' };
  }
  const timestamp = Number(now);
  const key = createHash('sha256').update(recipient).digest('hex');
  for (const [entryKey, entry] of recent) if (entry.expiresAt <= timestamp) recent.delete(entryKey);
  if (recent.has(key)) return { sent: false, reason: 'recipient_cooldown' };
  if (recent.size >= MAX_RECIPIENTS) return { sent: false, reason: 'rate_limit_capacity' };
  const reservation = { expiresAt: timestamp + WINDOW_MS };
  recent.set(key, reservation); // Reserve before awaiting SMTP to prevent races.
  config.recipients = [recipient]; // Never inherit the staff-recipient list.
  try {
    const email = buildSupportAcknowledgement(validation.value, config);
    await (transport ? transport(email, config) : sendViaSmtp(email, config));
    return { sent: true };
  } catch (error) {
    if (recent.get(key) === reservation) recent.delete(key);
    throw error;
  }
}
