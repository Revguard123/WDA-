// Unit tests for ops alerting. The alert path is a safety net for silent cron
// failures, so its two load-bearing guarantees are locked here: it no-ops
// cleanly when unconfigured, and it never throws (a broken alert must not take
// down the job it is watching).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sendOpsAlert, renderAlertHTML, DEFAULT_ALERT_TO } from '../lib/alerts.js';

const ENV_KEYS = ['ALERT_EMAIL', 'ALERT_FROM', 'EMAIL_FROM', 'RESEND_API_KEY'];

function withEnv(vars, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  return Promise.resolve(fn()).finally(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

// A fake Resend client matching the shape sendBatchEmail expects.
function fakeClient(sink) {
  return {
    emails: {
      send: async (payload) => {
        sink.push(payload);
        return { data: { id: 'fake-id' }, error: null };
      },
    },
  };
}

test('falls back to the default recipient when ALERT_EMAIL is not set', async () => {
  await withEnv({}, async () => {
    const sink = [];
    const res = await sendOpsAlert({ subject: 's', summary: 'x' }, { client: fakeClient(sink) });
    assert.equal(res.sent, true);
    assert.equal(sink.length, 1);
    assert.equal(sink[0].to, DEFAULT_ALERT_TO);
  });
});

test('ALERT_EMAIL overrides the default recipient', async () => {
  await withEnv({ ALERT_EMAIL: 'someone-else@wardogsacademy.com' }, async () => {
    const sink = [];
    await sendOpsAlert({ subject: 's', summary: 'x' }, { client: fakeClient(sink) });
    assert.equal(sink[0].to, 'someone-else@wardogsacademy.com');
  });
});

test('sends to ALERT_EMAIL with a prefixed subject when configured', async () => {
  await withEnv({ ALERT_EMAIL: 'ops@wardogsacademy.com', ALERT_FROM: 'WDA <contracts@wardogsacademy.com>' }, async () => {
    const sink = [];
    const res = await sendOpsAlert(
      { subject: 'Monthly cron: 1 buyer needs attention', summary: 'context', rows: ['buyer abc: delivered 0'] },
      { client: fakeClient(sink) }
    );
    assert.equal(res.sent, true);
    assert.equal(sink.length, 1);
    assert.equal(sink[0].to, 'ops@wardogsacademy.com');
    assert.equal(sink[0].subject, '[WDA alert] Monthly cron: 1 buyer needs attention');
    assert.match(sink[0].html, /buyer abc: delivered 0/);
  });
});

test('never throws when the send fails; returns the error instead', async () => {
  await withEnv({ ALERT_EMAIL: 'ops@wardogsacademy.com' }, async () => {
    const throwingClient = { emails: { send: async () => { throw new Error('resend down'); } } };
    const res = await sendOpsAlert({ subject: 's', summary: 'x' }, { client: throwingClient });
    assert.match(res.error, /resend down/);
  });
});

test('renderAlertHTML escapes injected content and lists rows', () => {
  const html = renderAlertHTML({ subject: 'S', summary: 'a <b> c', rows: ['x & y'] });
  assert.match(html, /a &lt;b&gt; c/);
  assert.match(html, /x &amp; y/);
});
