import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getFeedbackConfig, sendFeedbackRequest, setSupportTransportForTests, resetSupportTransportForTests, setFeedbackTransportForTests, resetFeedbackTransportForTests } from '../lib/support.js';
import { POST } from '../app/api/support/route.js';
import { WDA_LOGO, WDA_BACKGROUND } from '../lib/email/crmEmailLayout.js';
import { resetAcknowledgementStateForTests, setAcknowledgementTransportForTests } from '../lib/supportAcknowledgement.js';

beforeEach(() => {
  resetAcknowledgementStateForTests();
  setAcknowledgementTransportForTests(async () => ({ accepted: true }));
});
afterEach(() => resetAcknowledgementStateForTests());

const env = {
  SUPPORT_SMTP_HOST: 'smtp.office365.com', SUPPORT_SMTP_PORT: '587',
  SUPPORT_SMTP_USER: 'support@example.test', SUPPORT_SMTP_APP_PASSWORD: 'test-only-password',
  SUPPORT_TO_EMAIL: 'support@example.test', FEEDBACK_TO_EMAIL: 'exe.hunain@gmail.com',
  SLACK_CTC_FEEDBACK_WEBHOOK_URL: 'https://hooks.slack.test/fixture', NODE_ENV: 'test',
};
const payload = {
  type: 'feedback', email: 'student@example.test', category: 'Niche Advisor issue',
  message: 'First line\n<script>test</script>\nPrivate page https://example.test/discover/123e4567-e89b-12d3-a456-426614174000',
  pageContext: 'discovery', pagePath: '/discover/123e4567-e89b-12d3-a456-426614174000',
  technicalContext: { browser: 'Chrome <private>', os: 'Windows', viewport: '1440x900', ignored: 'untrusted field' },
};
const metadata = { now: new Date('2026-11-14T12:00:00Z') };

test('feedback accepts email and/or Slack independently, without changing the support recipient', () => {
  assert.equal(getFeedbackConfig(env).emailTo, 'exe.hunain@gmail.com');
  assert.equal(getFeedbackConfig({ FEEDBACK_TO_EMAIL: env.FEEDBACK_TO_EMAIL }).ok, true);
  assert.equal(getFeedbackConfig({ SLACK_CTC_FEEDBACK_WEBHOOK_URL: env.SLACK_CTC_FEEDBACK_WEBHOOK_URL }).ok, true);
  assert.equal(env.SUPPORT_TO_EMAIL, 'support@example.test');
});

test('feedback recipient lists are normalized and deduplicated without losing either mailbox', () => {
  const config = getFeedbackConfig({ FEEDBACK_TO_EMAIL: ' support@wardogsacademy.com, exe.hunain@gmail.com, SUPPORT@wardogsacademy.com ' });
  assert.deepEqual(config.emailRecipients, ['support@wardogsacademy.com', 'exe.hunain@gmail.com']);
  assert.equal(config.emailTo, 'support@wardogsacademy.com, exe.hunain@gmail.com');
});

test('feedback includes both configured mailboxes in one email and leaves Slack enabled', async () => {
  const multiEnv = { ...env, FEEDBACK_TO_EMAIL: 'support@wardogsacademy.com,exe.hunain@gmail.com' };
  const emails = [], slack = [];
  const result = await sendFeedbackRequest(payload, { env: multiEnv, metadata,
    transport: async (message) => slack.push(message),
    emailTransport: async (message, config) => emails.push({ message, config }),
  });
  assert.equal(emails.length, 1);
  assert.equal(slack.length, 1);
  assert.equal(emails[0].message.to, 'support@wardogsacademy.com, exe.hunain@gmail.com');
  assert.deepEqual(emails[0].config.recipients, ['support@wardogsacademy.com', 'exe.hunain@gmail.com']);
  assert.deepEqual(result.delivered, { slack: true, email: true });
});

test('feedback sends both Slack and a CRM-styled email to Hunain using the support sender', async () => {
  const emails = [], slack = [];
  const result = await sendFeedbackRequest(payload, { env, metadata,
    transport: async (message) => { slack.push(message); },
    emailTransport: async (message, config) => { emails.push({ message, config }); },
  });
  assert.deepEqual(result, { ok: true, delivered: { slack: true, email: true } });
  assert.equal(emails.length, 1);
  assert.equal(slack.length, 1);
  const { message, config } = emails[0];
  assert.equal(message.to, 'exe.hunain@gmail.com');
  assert.equal(message.replyTo, 'student@example.test');
  assert.match(message.from, /support@example.test/);
  assert.equal(config.host, 'smtp.office365.com');
  assert.equal(config.port, 587);
  assert.match(message.subject, /CTC Beta Feedback - Niche Advisor issue - Niche Discovery/);
  assert.ok(message.html.includes(WDA_LOGO));
  assert.ok(message.html.includes(WDA_BACKGROUND));
  assert.match(message.html, /class="email-card"/);
  assert.match(message.html, /First line<br>&lt;script&gt;test&lt;\/script&gt;/);
  assert.match(message.html, /Chrome &lt;private&gt;/);
  assert.match(message.text, /Niche Advisor issue/);
  for (const body of [message.html, message.text, JSON.stringify(slack)]) {
    assert.doesNotMatch(body, /123e4567-e89b-12d3-a456-426614174000|https:\/\/example.test\/discover|untrusted field|test-only-password/);
  }
});

test('Slack failure still sends email; email failure still preserves Slack without prompting duplicate resubmissions', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (value) => warnings.push(value);
  try {
    const slackFailure = await sendFeedbackRequest(payload, { env, metadata,
      transport: async () => { throw new Error('private webhook failure'); }, emailTransport: async () => ({}),
    });
    assert.deepEqual(slackFailure.delivered, { slack: false, email: true });
    const emailFailure = await sendFeedbackRequest(payload, { env, metadata,
      transport: async () => ({}), emailTransport: async () => { throw new Error('private SMTP failure'); },
    });
    assert.deepEqual(emailFailure.delivered, { slack: true, email: false });
    assert.equal(warnings.length, 2);
    assert.doesNotMatch(JSON.stringify(warnings), /private webhook|private SMTP|test-only-password/);
  } finally { console.warn = original; }
});

test('email-only feedback works without a Slack webhook and reports real email failures', async () => {
  const emailOnly = { ...env, SLACK_CTC_FEEDBACK_WEBHOOK_URL: '' };
  const result = await sendFeedbackRequest(payload, { env: emailOnly, emailTransport: async () => ({}) });
  assert.deepEqual(result.delivered, { email: true });
  await assert.rejects(sendFeedbackRequest(payload, { env: emailOnly, emailTransport: async () => { throw new Error('SMTP unavailable'); } }), /SMTP unavailable/);
});

test('missing SMTP credentials and invalid feedback recipients cannot send an email', async () => {
  const emailOnly = { ...env, SLACK_CTC_FEEDBACK_WEBHOOK_URL: '' };
  const unexpected = async () => { throw new Error('Should never reach transport'); };
  for (const invalid of [{ ...emailOnly, SUPPORT_SMTP_APP_PASSWORD: '' }, { ...emailOnly, FEEDBACK_TO_EMAIL: 'bad\r\nBcc: elsewhere@example.test' }]) {
    await assert.rejects(sendFeedbackRequest(payload, { env: invalid, emailTransport: unexpected }), { code: 'SUPPORT_CONFIG_MISSING' });
  }
});

test('the form endpoint invokes both feedback channels while retaining its safe success response', async () => {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  let emails = 0, slack = 0;
  setSupportTransportForTests(async (message) => { assert.equal(message.to, 'exe.hunain@gmail.com'); emails++; });
  setFeedbackTransportForTests(async () => { slack++; });
  try {
    const response = await POST(new Request('http://local/api/support', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.71' }, body: JSON.stringify(payload),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(emails, 1);
    assert.equal(slack, 1);
  } finally {
    resetSupportTransportForTests(); resetFeedbackTransportForTests();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
