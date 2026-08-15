import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as supportPost } from '../app/api/support/route.js';
import {
  buildSupportEmail,
  getSupportConfig,
  resetSupportTransportForTests,
  sanitizeSupportMessage,
  setSupportTransportForTests,
  SUPPORT_PAGE_CONTEXTS,
  validateSupportPayload,
} from '../lib/support.js';

const env = {
  SUPPORT_SMTP_USER: 'support-smtp@example.com',
  SUPPORT_SMTP_APP_PASSWORD: 'app-password-for-test',
  SUPPORT_TO_EMAIL: 'team@example.com',
  SUPPORT_FROM_NAME: 'War Dogs Academy Support',
};

test('Support CTA renders on required student pages with safe page contexts', () => {
  const checks = [
    ['app/portal/page.js', 'pageContext="portal"'],
    ['app/setup/[token]/page.js', "pageContext={state.hasTargeting ? 'targeting_review' : 'targeting_setup'}"],
    ['app/setup/[token]/page.js', 'pageContext="targeting_setup"'],
    ['app/discover/[token]/page.js', 'pageContext="discovery"'],
    ['app/start/[token]/page.js', 'pageContext="start"'],
    ['app/contracts/[token]/page.js', 'pageContext="contracts"'],
    ['app/d/[token]/[notice_id]/page.js', 'pageContext="deep_dive"'],
  ];
  for (const [file, needle] of checks) {
    const source = readFileSync(file, 'utf8');
    assert.ok(source.includes('SupportCTA'), file);
    assert.ok(source.includes(needle), `${file} missing ${needle}`);
  }
});

test('Support CTA opens modal support form and prevents double submit while sending', () => {
  const source = readFileSync('app/_components/SupportCTA.jsx', 'utf8');
  assert.ok(source.includes('Having trouble with this page?'));
  assert.ok(source.includes('Contact support'));
  assert.ok(source.includes('role="dialog"'));
  assert.ok(source.includes('Need help?'));
  assert.ok(source.includes('Send support request'));
  assert.ok(source.includes("event.key === 'Escape'"));
  assert.ok(source.includes('disabled={sending}'));
  assert.ok(source.includes('maxLength={3000}'));
  assert.ok(source.includes("company"));
});

test('support payload validates required email, required message, and message max length', () => {
  assert.equal(validateSupportPayload({ email: '', message: 'Help', pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: '', pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: 'x'.repeat(3001), pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: 'Help', pageContext: 'portal' }).ok, true);
});

test('valid page contexts are accepted and arbitrary page context is rejected', () => {
  for (const pageContext of Object.keys(SUPPORT_PAGE_CONTEXTS)) {
    assert.equal(validateSupportPayload({ email: 'student@example.com', message: 'Help', pageContext }).ok, true);
  }
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: 'Help', pageContext: '/setup/private-token' }).ok, false);
});

test('support email redacts buyer/access tokens, UUIDs, notice identifiers, and private URLs', () => {
  const message = sanitizeSupportMessage(
    'My page https://example.com/setup/123e4567-e89b-12d3-a456-426614174000 failed for notice ABC123DEF456 and buyer 123e4567-e89b-12d3-a456-426614174000',
  );
  assert.ok(!message.includes('https://example.com/setup/'));
  assert.ok(!message.includes('123e4567-e89b-12d3-a456-426614174000'));
  assert.ok(!message.includes('ABC123DEF456'));
  assert.ok(message.includes('[private link redacted]'));
});

test('support destination comes from env config and Reply-To uses submitted student email', () => {
  const config = getSupportConfig(env);
  assert.equal(config.ok, true);
  const validation = validateSupportPayload({ email: 'student@example.com', message: 'I need help.', pageContext: 'discovery' });
  const email = buildSupportEmail(validation.value, config);
  assert.equal(email.to, 'team@example.com');
  assert.equal(email.replyTo, 'student@example.com');
  assert.equal(email.subject, 'War Dogs Academy Support Request - Niche Discovery');
  assert.ok(email.text.includes('Student email:\nstudent@example.com'));
  assert.ok(email.text.includes('Page:\nNiche Discovery'));
  assert.ok(email.html.includes('War Dogs Academy'));
  assert.ok(email.html.includes('#f52ea9'));
  assert.ok(email.html.includes('#ff9f58'));
  assert.ok(email.html.includes('Support Request'));
  assert.ok(email.html.includes('Page context'));
});

test('SMTP credentials are server-only and not referenced by the client component', () => {
  const clientSource = readFileSync('app/_components/SupportCTA.jsx', 'utf8');
  assert.ok(!clientSource.includes('SUPPORT_SMTP_USER'));
  assert.ok(!clientSource.includes('SUPPORT_SMTP_APP_PASSWORD'));
  assert.ok(!clientSource.includes('SUPPORT_TO_EMAIL'));
  const routeSource = readFileSync('app/api/support/route.js', 'utf8');
  assert.ok(routeSource.includes('sendSupportRequest'));
});

test('successful support route submission returns safe success with mocked SMTP transport', async () => {
  const previous = {
    SUPPORT_SMTP_USER: process.env.SUPPORT_SMTP_USER,
    SUPPORT_SMTP_APP_PASSWORD: process.env.SUPPORT_SMTP_APP_PASSWORD,
    SUPPORT_TO_EMAIL: process.env.SUPPORT_TO_EMAIL,
  };
  Object.assign(process.env, env);
  let sent = null;
  setSupportTransportForTests(async (email) => {
    sent = email;
    return { ok: true };
  });
  const res = await supportPost(new Request('http://local/api/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
    body: JSON.stringify({ email: 'student@example.com', message: 'Help me on this page.', pageContext: 'start' }),
  }));
  const json = await res.json();
  resetSupportTransportForTests();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.equal(res.status, 200);
  assert.deepEqual(json, { ok: true });
  assert.equal(sent.replyTo, 'student@example.com');
  assert.equal(sent.subject, 'War Dogs Academy Support Request - Ready to Start');
});

test('SMTP failure returns generic safe error without exposing provider details', async () => {
  const previous = {
    SUPPORT_SMTP_USER: process.env.SUPPORT_SMTP_USER,
    SUPPORT_SMTP_APP_PASSWORD: process.env.SUPPORT_SMTP_APP_PASSWORD,
    SUPPORT_TO_EMAIL: process.env.SUPPORT_TO_EMAIL,
  };
  Object.assign(process.env, env);
  setSupportTransportForTests(async () => {
    throw new Error('SMTP auth exploded with private provider details');
  });
  const res = await supportPost(new Request('http://local/api/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.11' },
    body: JSON.stringify({ email: 'student@example.com', message: 'Help me.', pageContext: 'contracts' }),
  }));
  const json = await res.json();
  resetSupportTransportForTests();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.equal(res.status, 502);
  assert.equal(json.ok, false);
  assert.equal(json.error, "We could not send your request right now. Please try again.");
  assert.ok(!JSON.stringify(json).includes('SMTP auth exploded'));
});

test('missing support SMTP config is handled safely', () => {
  const config = getSupportConfig({});
  assert.equal(config.ok, false);
  assert.deepEqual(config.missing, ['SUPPORT_SMTP_USER', 'SUPPORT_SMTP_APP_PASSWORD', 'SUPPORT_TO_EMAIL']);
});

test('existing student journeys remain unaffected by Support CTA wiring', () => {
  const setupSource = readFileSync('app/setup/[token]/page.js', 'utf8');
  const discoverSource = readFileSync('app/discover/[token]/page.js', 'utf8');
  const startSource = readFileSync('app/start/[token]/page.js', 'utf8');
  assert.ok(setupSource.includes('Help me discover my niche'));
  assert.ok(discoverSource.includes('DiscoveryForm'));
  assert.ok(startSource.includes('GoButton'));
  assert.ok(!readFileSync('app/_components/SupportCTA.jsx', 'utf8').includes('/api/activate'));
});
