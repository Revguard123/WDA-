import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { getSupportConfig, sendViaSmtp } from '../lib/support.js';
import { createSmtpClient } from '../lib/supportSmtp.js';

const config = getSupportConfig({ SUPPORT_SMTP_HOST: 'smtp.office365.com', SUPPORT_SMTP_PORT: '587', SUPPORT_SMTP_USER: 'fixture@example.test', SUPPORT_SMTP_APP_PASSWORD: 'test-only-password', SUPPORT_TO_EMAIL: 'fixture@example.test' });
const email = { from: 'fixture@example.test', to: 'fixture@example.test', replyTo: 'fixture@example.test', subject: 'Fixture', text: 'Test\r\n.\r\nMAIL FROM:<untrusted@example.test>', html: '<p>Test</p>' };

function fixture({ startTls = true, failAuth = false } = {}) {
  const commands = [];
  const data = [];
  let options;
  let reads = 0;
  const client = {
    connect: async () => commands.push('connect'),
    read: async () => ++reads === 1 ? '220 smtp.test ready' : '250 2.0.0 Message accepted',
    command: async (line) => {
      commands.push(line);
      if (line.startsWith('EHLO')) return startTls ? '250-smtp.test\n250 STARTTLS' : '250 smtp.test';
      if (line === 'STARTTLS') return '220 2.0.0 Ready for TLS';
      if (line === 'AUTH LOGIN') return failAuth ? '535 5.7.139 Authentication unsuccessful, SMTP AUTH is disabled' : '334 VXNlcm5hbWU6';
      if (line === Buffer.from(config.user).toString('base64')) return '334 UGFzc3dvcmQ6';
      if (line === Buffer.from(config.password).toString('base64')) return '235 2.7.0 Authentication successful';
      if (line === 'DATA') return '354 End with dot';
      if (line === 'QUIT') return '221 Bye';
      return '250 OK';
    },
    startTls: async () => commands.push('tls-upgraded'),
    writeData: (message) => data.push(message),
    end: () => commands.push('closed'),
  };
  return { commands, data, options: () => options, createClient: (value) => { options = value; return client; } };
}

test('support config reads the configured Office365 host and port and retains implicit-TLS defaults', () => {
  assert.equal(config.host, 'smtp.office365.com');
  assert.equal(config.port, 587);
  assert.equal(config.secure, false);
  assert.equal(getSupportConfig({}).host, 'smtp.gmail.com');
  assert.equal(getSupportConfig({}).port, 465);
  assert.equal(getSupportConfig({ SUPPORT_SMTP_PORT: 'invalid' }).ok, false);
});

test('port 587 negotiates STARTTLS and repeats EHLO before transmitting authentication or message content', async () => {
  const f = fixture();
  assert.deepEqual(await sendViaSmtp(email, config, f), { accepted: true });
  assert.deepEqual(f.options(), { host: config.host, port: 587 });
  assert.deepEqual(f.commands.slice(0, 6), ['connect', 'EHLO wardogsacademy.local', 'STARTTLS', 'tls-upgraded', 'EHLO wardogsacademy.local', 'AUTH LOGIN']);
  assert.equal(f.data.length, 1);
  assert.equal(f.commands.at(-1), 'closed');
  assert.match(f.data[0], /\r\n\.\.\r\nMAIL FROM/);
  assert.ok(f.data[0].endsWith('\r\n.\r\n'));
});

test('the mailer refuses authentication when STARTTLS is not offered', async () => {
  const f = fixture({ startTls: false });
  await assert.rejects(sendViaSmtp(email, config, f), { code: 'SUPPORT_SMTP_TLS_REQUIRED' });
  assert.ok(!f.commands.includes('AUTH LOGIN'));
  assert.equal(f.data.length, 0);
  assert.equal(f.commands.at(-1), 'closed');
});

test('automatic receipts carry loop-suppression headers without changing normal staff emails', async () => {
  const auto = fixture();
  await sendViaSmtp({ ...email, automated: true }, config, auto);
  assert.match(auto.data[0], /\r\nAuto-Submitted: auto-generated\r\n/);
  assert.match(auto.data[0], /\r\nX-Auto-Response-Suppress: All\r\n/);
  const normal = fixture();
  await sendViaSmtp(email, config, normal);
  assert.doesNotMatch(normal.data[0], /Auto-Submitted:|X-Auto-Response-Suppress:/);
});

test('authentication rejection exposes only safe diagnostic codes and sends no message', async () => {
  const f = fixture({ failAuth: true });
  await assert.rejects(sendViaSmtp(email, config, f), (error) => {
    assert.equal(error.smtpStage, 'auth_login');
    assert.equal(error.smtpCode, 535);
    assert.equal(error.smtpEnhancedCode, '5.7.139');
    assert.equal(error.smtpReason, 'smtp_auth_disabled');
    assert.ok(!JSON.stringify(error).includes(config.password));
    return true;
  });
  assert.equal(f.data.length, 0);
});

test('implicit TLS on port 465 does not attempt STARTTLS again', async () => {
  const f = fixture();
  await sendViaSmtp(email, { ...config, port: 465, secure: true }, f);
  assert.ok(!f.commands.includes('STARTTLS'));
  assert.equal(f.data.length, 1);
});

test('SMTP adds each feedback mailbox to the envelope before sending a single message', async () => {
  const f = fixture();
  const recipients = ['support@wardogsacademy.com', 'exe.hunain@gmail.com'];
  await sendViaSmtp({ ...email, to: recipients.join(', ') }, { ...config, to: recipients.join(', '), recipients }, f);
  assert.deepEqual(f.commands.filter((line) => line.startsWith('RCPT TO:')), recipients.map((recipient) => `RCPT TO:<${recipient}>`));
  assert.ok(f.commands.indexOf('DATA') > f.commands.indexOf('RCPT TO:<exe.hunain@gmail.com>'));
  assert.equal(f.data.length, 1);
  assert.match(f.data[0], /To: support@wardogsacademy.com, exe.hunain@gmail.com/);
});

test('SMTP does not send the message if the second feedback recipient is rejected', async () => {
  const f = fixture();
  const client = f.createClient({});
  const command = client.command;
  client.command = async (line) => line === 'RCPT TO:<second@example.test>' ? '550 5.1.1 Recipient rejected' : command(line);
  await assert.rejects(sendViaSmtp(email, { ...config, recipients: ['first@example.test', 'second@example.test'] }, { createClient: () => client }), { smtpCode: 550, smtpStage: 'rcpt_to' });
  assert.equal(f.data.length, 0);
  assert.ok(!f.commands.includes('DATA'));
  assert.equal(f.commands.at(-1), 'closed');
});

class Socket extends EventEmitter {
  constructor({ authorized = true } = {}) { super(); this.authorized = authorized; this.writes = []; }
  setEncoding() {}
  setTimeout() {}
  write(value) { this.writes.push(value); }
  destroy() { this.emit('close'); }
}

test('low-level SMTP parser preserves partial multiline replies and queues separate responses', async () => {
  const socket = new Socket();
  const client = createSmtpClient({ host: 'smtp.test', port: 465 }, { tlsConnect: () => { queueMicrotask(() => socket.emit('secureConnect')); return socket; } });
  await client.connect();
  socket.emit('data', '250-first capability\r\n250 STA');
  socket.emit('data', 'RTTLS\r\n220 Second reply\r\n');
  assert.equal(await client.read(), '250-first capability\n250 STARTTLS');
  assert.equal(await client.read(), '220 Second reply');
  client.end();
});

test('low-level client verifies the certificate and never sends AUTH on an unencrypted socket', async () => {
  const tcp = new Socket();
  const secure = new Socket({ authorized: false });
  let tlsOptions;
  const client = createSmtpClient({ host: 'smtp.test', port: 587 }, {
    tcpConnect: () => { queueMicrotask(() => tcp.emit('connect')); return tcp; },
    tlsConnect: (options) => { tlsOptions = options; queueMicrotask(() => secure.emit('secureConnect')); return secure; },
  });
  await client.connect();
  await assert.rejects(client.command('AUTH LOGIN'), /requires TLS/);
  assert.deepEqual(tcp.writes, []);
  await assert.rejects(client.startTls(), { code: 'SUPPORT_SMTP_TLS_FAILED' });
  assert.equal(tlsOptions.servername, 'smtp.test');
  assert.equal(tlsOptions.minVersion, 'TLSv1.2');
  assert.equal(tlsOptions.rejectUnauthorized, true);
  assert.equal(tlsOptions.socket, tcp);
  client.end();
});
