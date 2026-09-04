import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as supportPost } from '../app/api/support/route.js';
import {
  buildFeedbackSlackMessage,
  buildSupportEmail,
  getFeedbackConfig,
  getSupportConfig,
  resetFeedbackTransportForTests,
  resetSupportTransportForTests,
  sanitizeSupportMessage,
  sanitizeSupportPath,
  setFeedbackTransportForTests,
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
    ['app/access/page.js', 'pageContext="portal"'],
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
    assert.ok(source.includes('supportBar={<SupportCTA sticky'), `${file} missing sticky support bar`);
    assert.ok(source.includes(needle), `${file} missing ${needle}`);
  }
});

test('Support CTA opens modal support form and prevents double submit while sending', () => {
  const source = readFileSync('app/_components/SupportCTA.jsx', 'utf8');
  assert.ok(source.includes('CTC is currently in beta.'));
  assert.ok(source.includes("position: 'fixed'"));
  assert.ok(source.includes('collectTechnicalContext'));
  assert.ok(source.includes('Send feedback'));
  assert.ok(source.includes('Contact support'));
  assert.ok(source.includes('role="dialog"'));
  assert.ok(source.includes('Send beta feedback'));
  assert.ok(source.includes('Send support request'));
  assert.ok(source.includes("event.key === 'Escape'"));
  assert.ok(source.includes('disabled={sending}'));
  assert.ok(source.includes('maxLength={messageLimit}'));
  assert.ok(source.includes("company"));
  assert.ok(source.includes('window.location.pathname'));
  assert.ok(source.includes('window.innerWidth'));
  assert.ok(source.includes('window.screen'));
  assert.ok(source.includes('Intl.DateTimeFormat().resolvedOptions().timeZone'));
  assert.ok(source.includes('nav.language'));
  assert.ok(source.includes("Thanks, we got it. The WDA team will take a look."));
  assert.ok(!source.includes('window.location.href'));
  assert.ok(!source.includes('router.push'));
});

test('support payload validates required email, required message, and message max length', () => {
  assert.equal(validateSupportPayload({ email: '', message: 'Help', pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: '', pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: 'x'.repeat(3001), pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ email: 'student@example.com', message: 'Help', pageContext: 'portal' }).ok, true);
  assert.equal(validateSupportPayload({ type: 'feedback', email: 'student@example.com', message: 'x'.repeat(2001), pageContext: 'portal' }).ok, false);
  assert.equal(validateSupportPayload({ type: 'feedback', email: 'student@example.com', message: 'Beta issue', pageContext: 'portal' }).ok, true);
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
  const path = sanitizeSupportPath('/discover/123e4567-e89b-12d3-a456-426614174000?update=1');
  assert.equal(path, '/discover/[private-token]?update=1');
  assert.equal(sanitizeSupportPath('https://example.com/contracts/private-token'), '[private path redacted]');
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
  assert.ok(!clientSource.includes('SLACK_CTC_FEEDBACK_WEBHOOK_URL'));
  const routeSource = readFileSync('app/api/support/route.js', 'utf8');
  assert.ok(routeSource.includes('sendSupportRequest'));
  assert.ok(routeSource.includes('sendFeedbackRequest'));
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

test('valid beta feedback reaches the Slack-posting layer with redacted path', async () => {
  const previous = {
    SLACK_CTC_FEEDBACK_WEBHOOK_URL: process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
  process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL = 'https://hooks.slack.test/services/test';
  process.env.VERCEL_ENV = 'preview';
  let sent = null;
  setFeedbackTransportForTests(async (message, config) => {
    sent = { message, config };
    return { ok: true };
  });
  const res = await supportPost(new Request('http://local/api/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.21', 'user-agent': 'Unit Test Browser' },
    body: JSON.stringify({
      type: 'feedback',
      email: 'student@example.com',
      category: 'Niche Advisor issue',
      message: 'The next question is not loading after I submit my answer.',
      pageContext: 'discovery',
      pagePath: '/discover/123e4567-e89b-12d3-a456-426614174000?update=1',
      technicalContext: {
        browser: 'Chrome/Chromium',
        device: 'Desktop',
        os: 'Windows',
        viewport: '1440x900',
        screen: '1920x1080 @ 1x',
        timezone: 'America/New_York',
        language: 'en-US',
        ignored: 'not shown',
      },
    }),
  }));
  const json = await res.json();
  resetFeedbackTransportForTests();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.equal(res.status, 200);
  assert.deepEqual(json, { ok: true });
  assert.equal(sent.config.environment, 'preview');
  assert.equal(sent.message.text, 'New CTC Beta Feedback from student@example.com');
  assert.equal(sent.message.blocks[0].type, 'header');
  assert.equal(sent.message.blocks[0].text.text, '\u{1F9EA} CTC Beta Feedback');
  assert.deepEqual(sent.message.blocks.map((block) => block.type), ['header', 'section', 'divider', 'section', 'divider', 'section', 'section', 'divider', 'context']);
  const fields = sent.message.blocks[1].fields.map((field) => field.text);
  assert.ok(fields.includes('*Issue Type*\n\u{1F916} Niche Advisor issue'));
  assert.ok(fields.includes('*Environment*\nPreview'));
  assert.ok(fields.includes('*Student*\nstudent@example.com'));
  assert.ok(fields.includes('*Page*\nNiche Discovery'));
  assert.equal(sent.message.blocks[3].text.text, '*What happened*\nThe next question is not loading after I submit my answer.');
  assert.equal(sent.message.blocks[5].text.text, '*Technical context*');
  const technicalFields = sent.message.blocks[6].fields.map((field) => field.text);
  assert.ok(technicalFields.includes('*Browser*\nChrome/Chromium'));
  assert.ok(technicalFields.includes('*Device*\nDesktop'));
  assert.ok(technicalFields.includes('*Operating system*\nWindows'));
  assert.ok(technicalFields.includes('*Viewport*\n1440x900'));
  assert.ok(technicalFields.includes('*Screen*\n1920x1080 @ 1x'));
  assert.ok(technicalFields.includes('*Timezone*\nAmerica/New_York'));
  assert.ok(technicalFields.includes('*Language*\nen-US'));
  assert.ok(!JSON.stringify(sent.message).includes('not shown'));
  assert.ok(!JSON.stringify(sent.message).includes('123e4567-e89b-12d3-a456-426614174000'));
});

test('Slack feedback errors return a controlled safe error', async () => {
  const previous = {
    SLACK_CTC_FEEDBACK_WEBHOOK_URL: process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL,
  };
  process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL = 'https://hooks.slack.test/services/test';
  setFeedbackTransportForTests(async () => {
    throw new Error('Slack private webhook exploded');
  });
  const res = await supportPost(new Request('http://local/api/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.22' },
    body: JSON.stringify({ type: 'feedback', email: 'student@example.com', message: 'Help me.', pageContext: 'contracts' }),
  }));
  const json = await res.json();
  resetFeedbackTransportForTests();
  if (previous.SLACK_CTC_FEEDBACK_WEBHOOK_URL === undefined) delete process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL;
  else process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL = previous.SLACK_CTC_FEEDBACK_WEBHOOK_URL;

  assert.equal(res.status, 502);
  assert.equal(json.ok, false);
  assert.equal(json.error, "We couldn't send that feedback right now. Please try again or contact us by email.");
  assert.ok(!JSON.stringify(json).includes('Slack private webhook exploded'));
});

test('missing Slack feedback config is handled safely', () => {
  const config = getFeedbackConfig({});
  assert.equal(config.ok, false);
  assert.deepEqual(config.missing, ['SLACK_CTC_FEEDBACK_WEBHOOK_URL']);
});

test('Slack feedback message is compact and readable', () => {
  const validation = validateSupportPayload({
    type: 'feedback',
    email: 'student@example.com',
    category: 'Contract issue',
    message: 'This contract card looks wrong.',
    pageContext: 'contracts',
    pagePath: '/contracts/123e4567-e89b-12d3-a456-426614174000',
    technicalContext: {
      browser: 'Safari <Private>',
      device: 'Mobile',
      os: 'iOS/iPadOS',
      viewport: '390x844',
      screen: '390x844 @ 3x',
      timezone: 'America/New_York',
      language: 'en-US',
    },
  });
  const message = buildFeedbackSlackMessage(validation.value, { environment: 'production' }, {
    now: '2026-09-04T23:42:00Z',
    userAgent: 'Browser/1.0',
    buyerId: '8b3f0000-1111-2222-3333-44444400021c',
  });
  assert.equal(message.text, 'New CTC Beta Feedback from student@example.com');
  assert.equal(message.blocks[0].text.text, '\u{1F9EA} CTC Beta Feedback');
  assert.deepEqual(message.blocks.map((block) => block.type), ['header', 'section', 'divider', 'section', 'divider', 'section', 'section', 'divider', 'context']);
  const fields = message.blocks[1].fields.map((field) => field.text);
  assert.ok(fields.includes('*Issue Type*\n\u{1F3AF} Contract issue'));
  assert.ok(fields.includes('*Page*\nCurated Contracts'));
  assert.ok(fields.includes('*Environment*\nProduction'));
  assert.equal(message.blocks[3].text.text, '*What happened*\nThis contract card looks wrong.');
  assert.ok(message.blocks[6].fields.map((field) => field.text).includes('*Browser*\nSafari &lt;Private&gt;'));
  assert.equal(message.blocks[8].elements[0].text, 'Submitted Sep 4, 2026 \u00B7 7:42 PM ET \u2022 Buyer `8b3f...21c`');
  assert.ok(!JSON.stringify(message).includes('123e4567-e89b-12d3-a456-426614174000'));
});

test('missing support SMTP config is handled safely', () => {
  const config = getSupportConfig({});
  assert.equal(config.ok, false);
  assert.deepEqual(config.missing, ['SUPPORT_SMTP_USER', 'SUPPORT_SMTP_APP_PASSWORD', 'SUPPORT_TO_EMAIL']);
});

test('support route rate limiting still protects feedback submissions', async () => {
  const previous = {
    SLACK_CTC_FEEDBACK_WEBHOOK_URL: process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL,
  };
  process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL = 'https://hooks.slack.test/services/test';
  setFeedbackTransportForTests(async () => ({ ok: true }));
  let lastRes;
  for (let i = 0; i < 6; i += 1) {
    lastRes = await supportPost(new Request('http://local/api/support', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.23' },
      body: JSON.stringify({ type: 'feedback', email: 'student@example.com', message: `Feedback ${i}`, pageContext: 'portal' }),
    }));
  }
  resetFeedbackTransportForTests();
  if (previous.SLACK_CTC_FEEDBACK_WEBHOOK_URL === undefined) delete process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL;
  else process.env.SLACK_CTC_FEEDBACK_WEBHOOK_URL = previous.SLACK_CTC_FEEDBACK_WEBHOOK_URL;
  assert.equal(lastRes.status, 429);
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
