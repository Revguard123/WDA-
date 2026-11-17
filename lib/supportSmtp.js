import net from 'node:net';
import tls from 'node:tls';

// SMTP credentials must never leave the configured host over plain TCP.
// Port 465 starts encrypted; other ports must upgrade with STARTTLS first.
export function createSmtpClient({ host, port, timeoutMs = 15000 }, { tcpConnect = net.connect, tlsConnect = tls.connect } = {}) {
  let socket;
  let encrypted = false;
  let failure;
  let buffer = '';
  let lines = [];
  const responses = [];
  const waiters = [];
  const fail = (error) => {
    if (failure) return;
    failure = error;
    while (waiters.length) waiters.shift().reject(error);
  };
  const flush = () => {
    while (responses.length && waiters.length) waiters.shift().resolve(responses.shift());
  };
  const onData = (chunk) => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        responses.push(lines.join('\n'));
        lines = [];
      }
    }
    flush();
  };
  const onError = () => fail(Object.assign(new Error('SMTP connection failed'), { code: 'SUPPORT_SMTP_CONNECTION_FAILED' }));
  const onClose = () => fail(Object.assign(new Error('SMTP connection closed'), { code: 'SUPPORT_SMTP_CONNECTION_CLOSED' }));
  const onTimeout = () => {
    fail(Object.assign(new Error('SMTP connection timed out'), { code: 'SUPPORT_SMTP_TIMEOUT' }));
    socket.destroy();
  };
  const attach = () => {
    socket.setEncoding('utf8');
    socket.setTimeout(timeoutMs);
    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
    socket.on('timeout', onTimeout);
  };
  const connected = (event, secure) => new Promise((resolve, reject) => {
    const current = socket;
    const cleanup = () => {
      current.off(event, ready);
      current.off('error', error);
      current.off('close', closed);
    };
    const error = () => { cleanup(); reject(failure || new Error('SMTP connection failed')); };
    const closed = () => { cleanup(); reject(failure || new Error('SMTP connection closed')); };
    const ready = () => {
      cleanup();
      if (secure && !current.authorized) {
        fail(Object.assign(new Error('SMTP TLS certificate verification failed'), { code: 'SUPPORT_SMTP_TLS_FAILED' }));
        current.destroy();
        reject(failure);
        return;
      }
      encrypted = secure;
      resolve();
    };
    current.once(event, ready);
    current.once('error', error);
    current.once('close', closed);
  });
  const tlsOptions = { servername: host, minVersion: 'TLSv1.2', rejectUnauthorized: true };
  return {
    async connect() {
      const secure = port === 465;
      socket = secure ? tlsConnect({ host, port, ...tlsOptions }) : tcpConnect({ host, port });
      attach();
      await connected(secure ? 'secureConnect' : 'connect', secure);
    },
    async startTls() {
      const previous = socket;
      previous.off('data', onData);
      previous.off('error', onError);
      previous.off('close', onClose);
      previous.off('timeout', onTimeout);
      previous.setTimeout(0);
      buffer = '';
      lines = [];
      responses.length = 0;
      socket = tlsConnect({ socket: previous, ...tlsOptions });
      attach();
      await connected('secureConnect', true);
    },
    read() {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => { waiters.push({ resolve, reject }); flush(); });
    },
    command(line) {
      if (!encrypted && /^AUTH\b/i.test(line)) return Promise.reject(new Error('SMTP authentication requires TLS'));
      const response = this.read();
      socket.write(`${line}\r\n`);
      return response;
    },
    writeData(data) {
      if (!encrypted) throw new Error('SMTP message submission requires TLS');
      socket.write(data);
    },
    end() { socket?.destroy(); },
  };
}
