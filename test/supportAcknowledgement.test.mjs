import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/support/route.js';
import { buildSupportAcknowledgement, getSupportConfig, validateSupportPayload, setSupportTransportForTests, resetSupportTransportForTests, setFeedbackTransportForTests, resetFeedbackTransportForTests } from '../lib/support.js';
import { resetAcknowledgementStateForTests, sendSupportAcknowledgement, setAcknowledgementTransportForTests } from '../lib/supportAcknowledgement.js';
import { WDA_BACKGROUND, WDA_LOGO } from '../lib/email/crmEmailLayout.js';

const env = {
  SUPPORT_SMTP_HOST: 'smtp.office365.com', SUPPORT_SMTP_PORT: '587',
  SUPPORT_SMTP_USER: 'support@wardogsacademy.com', SUPPORT_SMTP_APP_PASSWORD: 'fixture-secret-not-for-logs',
  SUPPORT_TO_EMAIL: 'support@wardogsacademy.com', SUPPORT_FROM_NAME: 'War Dogs Academy Support',
  FEEDBACK_TO_EMAIL: 'support@wardogsacademy.com,developer@example.test',
  SLACK_CTC_FEEDBACK_WEBHOOK_URL: 'https://hooks.slack.test/fixture', SUPPORT_ACKNOWLEDGEMENT_ENABLED: 'true',
};
const payload = { type: 'feedback', email: 'student@example.test', message: 'Private report https://example.test/discover/123e4567-e89b-12d3-a456-426614174000', category: 'Niche Advisor issue', pageContext: 'discovery', pagePath: '/discover/private-path', technicalContext: { browser: 'Sensitive browser detail' } };
let previous;
beforeEach(() => {
  previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  resetAcknowledgementStateForTests();
  globalThis.__wdaSupportRateLimit?.clear();
  // Every transport is mocked, including the independent acknowledgement.
  setSupportTransportForTests(async () => ({ accepted: true }));
  setFeedbackTransportForTests(async () => ({ ok: true }));
  setAcknowledgementTransportForTests(async () => ({ accepted: true }));
});
afterEach(() => {
  resetAcknowledgementStateForTests(); resetSupportTransportForTests(); resetFeedbackTransportForTests();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const post = (body = payload, headers = {}) => POST(new Request('http://local/api/support', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.80', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
}));

test('receipt uses the CRM student design, support sender and team signature without quoting private report data', () => {
  const valid = validateSupportPayload(payload).value;
  const receipt = buildSupportAcknowledgement(valid, getSupportConfig(env));
  assert.equal(receipt.to, payload.email);
  assert.equal(receipt.replyTo, 'support@wardogsacademy.com');
  assert.equal(receipt.from, '"War Dogs Academy Support" <support@wardogsacademy.com>');
  assert.equal(receipt.subject, 'We received your feedback - War Dogs Academy');
  assert.equal(receipt.automated, true);
  assert.ok(receipt.html.includes(WDA_LOGO));
  assert.ok(receipt.html.includes(WDA_BACKGROUND));
  assert.match(receipt.html, /width="600"/);
  assert.match(receipt.html, /class="email-card"/);
  assert.match(receipt.html, /Technical &amp; Development Team/);
  for (const content of [receipt.text, receipt.html]) {
    assert.match(content, /Niche Discovery/);
    assert.doesNotMatch(content, /123e4567|private-path|Sensitive browser|developer@example|fixture-secret|hooks\.slack|crm\.wardogsacademy/);
    assert.doesNotMatch(content, /resolved|fixed|within \d|24 hours|48 hours|ticket (?:number|created)/i);
  }
});

test('support requests receive a support-specific receipt and not a bug-fix promise', () => {
  const valid = validateSupportPayload({ ...payload, type: 'support' }).value;
  const receipt = buildSupportAcknowledgement(valid, getSupportConfig(env));
  assert.equal(receipt.subject, 'We received your support request - War Dogs Academy');
  assert.match(receipt.text, /Thanks for sending your support request/);
  assert.match(receipt.text, /reply to this email/i);
});

test('receipt SMTP envelope contains only the reporter, never the staff-recipient list', async () => {
  const sent = [];
  const result = await sendSupportAcknowledgement({ ...payload, email: ' Student@Example.Test ' }, { env, transport: async (email, config) => sent.push({ email, config }) });
  assert.deepEqual(result, { sent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email.to, 'student@example.test');
  assert.deepEqual(sent[0].config.recipients, ['student@example.test']);
  assert.equal(sent[0].config.to, 'student@example.test');
  assert.equal(sent[0].config.host, 'smtp.office365.com');
  assert.equal(sent[0].config.port, 587);
});

test('repeat reports to the same recipient have a short, case-insensitive receipt cooldown', async () => {
  let sends = 0;
  const options = { env, now: 1000, transport: async () => sends++ };
  assert.deepEqual(await sendSupportAcknowledgement(payload, options), { sent: true });
  assert.deepEqual(await sendSupportAcknowledgement({ ...payload, email: 'STUDENT@example.test', message: 'Another report' }, options), { sent: false, reason: 'recipient_cooldown' });
  assert.deepEqual(await sendSupportAcknowledgement(payload, { ...options, now: 61_001 }), { sent: true });
  assert.equal(sends, 2);
});

test('concurrent requests reserve the recipient before awaiting delivery', async () => {
  let release;
  let sends = 0;
  const first = sendSupportAcknowledgement(payload, { env, transport: async () => { sends++; await new Promise((resolve) => { release = resolve; }); } });
  const second = await sendSupportAcknowledgement(payload, { env, transport: async () => sends++ });
  assert.deepEqual(second, { sent: false, reason: 'recipient_cooldown' });
  release();
  assert.deepEqual(await first, { sent: true });
  assert.equal(sends, 1);
});

test('a failed receipt releases its reservation so a later submission may receive a receipt', async () => {
  await assert.rejects(sendSupportAcknowledgement(payload, { env, transport: async () => { throw new Error('private provider reply'); } }), /private provider reply/);
  assert.deepEqual(await sendSupportAcknowledgement(payload, { env, transport: async () => ({ accepted: true }) }), { sent: true });
});

test('configuration can disable receipts without disabling the report itself', async () => {
  let sends = 0;
  assert.deepEqual(await sendSupportAcknowledgement(payload, { env: { ...env, SUPPORT_ACKNOWLEDGEMENT_ENABLED: 'false' }, transport: async () => sends++ }), { sent: false, reason: 'disabled' });
  assert.equal(sends, 0);
  process.env.SUPPORT_ACKNOWLEDGEMENT_ENABLED = 'false';
  assert.equal((await post()).status, 200);
});

test('missing SMTP credentials skip receipts and never call a transport', async () => {
  const result = await sendSupportAcknowledgement(payload, { env: { ...env, SUPPORT_SMTP_APP_PASSWORD: '' }, transport: async () => { throw new Error('Must not send'); } });
  assert.deepEqual(result, { sent: false, reason: 'missing_smtp_config' });
});

test('invalid payloads and unsafe recipient syntax cannot send receipts', async () => {
  const transport = async () => { throw new Error('Must not send'); };
  for (const invalid of [{ ...payload, email: '' }, { ...payload, message: '' }, { ...payload, company: 'spam' }]) {
    assert.deepEqual(await sendSupportAcknowledgement(invalid, { env, transport }), { sent: false, reason: 'invalid_payload' });
  }
  for (const recipient of ['one,two@example.test', 'person;<bcc>@example.test']) {
    const result = await sendSupportAcknowledgement({ ...payload, email: recipient }, { env, transport });
    assert.equal(result.sent, false);
  }
});

test('the sending mailbox and automatic-response mailboxes never receive an automatic receipt', async () => {
  for (const recipient of ['SUPPORT@wardogsacademy.com', 'mailer-daemon@example.test', 'postmaster@example.test', 'no-reply@example.test']) {
    assert.deepEqual(await sendSupportAcknowledgement({ ...payload, email: recipient }, { env, transport: async () => { throw new Error('Must not send'); } }), { sent: false, reason: 'automated_mailbox' });
  }
});

test('the form notifies staff before sending a feedback receipt and returns the same safe response', async () => {
  const calls = [];
  setSupportTransportForTests(async (email) => { assert.equal(email.to, 'support@wardogsacademy.com, developer@example.test'); calls.push('staff-email'); });
  setFeedbackTransportForTests(async () => calls.push('staff-slack'));
  setAcknowledgementTransportForTests(async (email) => { assert.equal(email.to, payload.email); calls.push('reporter'); });
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.at(-1), 'reporter');
  assert.equal(calls.filter((call) => call === 'reporter').length, 1);
});

test('the support form also sends its receipt only after the staff email was accepted', async () => {
  const calls = [];
  setSupportTransportForTests(async () => calls.push('staff'));
  setAcknowledgementTransportForTests(async (email) => { assert.match(email.subject, /support request/); calls.push('receipt'); });
  assert.equal((await post({ ...payload, type: 'support' })).status, 200);
  assert.deepEqual(calls, ['staff', 'receipt']);
});

test('no receipt is sent if every staff channel fails', async () => {
  let receipts = 0;
  setSupportTransportForTests(async () => { throw new Error('SMTP private failure'); });
  setFeedbackTransportForTests(async () => { throw new Error('Slack private failure'); });
  setAcknowledgementTransportForTests(async () => receipts++);
  const original = console.warn;
  console.warn = () => {};
  try { assert.equal((await post()).status, 502); } finally { console.warn = original; }
  assert.equal(receipts, 0);
});

test('partial staff delivery still allows a receipt, without requiring a duplicate report', async () => {
  let receipts = 0;
  setSupportTransportForTests(async () => { throw new Error('SMTP failed'); });
  setAcknowledgementTransportForTests(async () => receipts++);
  const original = console.warn;
  console.warn = () => {};
  try { assert.equal((await post()).status, 200); } finally { console.warn = original; }
  assert.equal(receipts, 1);
});

test('receipt failure does not fail the form or leak recipient/provider/credential details', async () => {
  const warnings = [];
  setAcknowledgementTransportForTests(async () => { throw Object.assign(new Error(`${payload.email} ${env.SUPPORT_SMTP_APP_PASSWORD} private SMTP reply`), { code: 'SUPPORT_SMTP_COMMAND_FAILED' }); });
  const original = console.warn;
  console.warn = (value) => warnings.push(value);
  try {
    const response = await post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally { console.warn = original; }
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].event, 'support_acknowledgement_failed');
  assert.doesNotMatch(JSON.stringify(warnings), /student@example|fixture-secret|private SMTP/);
});

test('malformed, oversized, honeypot and cross-site submissions cannot trigger an acknowledgement', async () => {
  let receipts = 0;
  setAcknowledgementTransportForTests(async () => receipts++);
  assert.equal((await post('{bad json')).status, 400);
  assert.equal((await post({ ...payload, message: 'a'.repeat(10_001) })).status, 413);
  assert.equal((await post({ ...payload, company: 'honeypot' })).status, 400);
  assert.equal((await post(payload, { origin: 'https://unrelated.example.test' })).status, 403);
  assert.equal(receipts, 0);
});

test('per-IP rate limiting and per-recipient cooldown both remain enforced', async () => {
  let receipts = 0;
  setAcknowledgementTransportForTests(async () => receipts++);
  for (let index = 0; index < 5; index++) assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 429);
  assert.equal(receipts, 1);
});
