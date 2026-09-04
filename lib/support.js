import tls from 'node:tls';

export const SUPPORT_PAGE_CONTEXTS = {
  portal: 'Portal',
  targeting_setup: 'Targeting Setup',
  targeting_review: 'Review Targeting',
  discovery: 'Niche Discovery',
  start: 'Ready to Start',
  contracts: 'Curated Contracts',
  deep_dive: 'Full Breakdown',
};

const MAX_MESSAGE_LENGTH = 3000;
const MAX_FEEDBACK_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;

const FEEDBACK_CATEGORIES = [
  "Something isn't working",
  'Contract issue',
  'Niche Advisor issue',
  'Account/access issue',
  'Other',
];

const FEEDBACK_CATEGORY_ICONS = {
  "Something isn't working": '\u{1F41B}',
  'Contract issue': '\u{1F3AF}',
  'Niche Advisor issue': '\u{1F916}',
  'Account/access issue': '\u{1F510}',
  Other: '\u{1F4A1}',
};

const TECHNICAL_CONTEXT_FIELDS = {
  browser: 'Browser',
  device: 'Device',
  os: 'Operating system',
  viewport: 'Viewport',
  screen: 'Screen',
  timezone: 'Timezone',
  language: 'Language',
};

let testTransport = null;
let testFeedbackTransport = null;

export function setSupportTransportForTests(transport) {
  testTransport = transport;
}

export function resetSupportTransportForTests() {
  testTransport = null;
}

export function setFeedbackTransportForTests(transport) {
  testFeedbackTransport = transport;
}

export function resetFeedbackTransportForTests() {
  testFeedbackTransport = null;
}

export function isValidSupportEmail(value) {
  const email = String(value || '').trim();

  return (
    email.length > 3
    && email.length <= MAX_EMAIL_LENGTH
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  );
}

export function sanitizeSupportMessage(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[private link redacted]')
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '[private identifier redacted]',
    )
    .replace(
      /\b(?:notice|solicitation)[\s#:=-]*[A-Z0-9_-]{6,}\b/gi,
      '[notice identifier redacted]',
    )
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

export function sanitizeSupportPath(value) {
  const raw = String(value || '')
    .replace(/\s+/g, '')
    .slice(0, 800);

  if (!raw || /^https?:\/\//i.test(raw)) {
    return '[private path redacted]';
  }

  return raw
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '[private-token]',
    )
    .replace(
      /\/d\/[^/?#]+\/[^/?#]+/i,
      '/d/[private-token]/[notice]',
    )
    .replace(
      /\/(contracts|discover|setup|start|targeting)\/[^/?#]+/gi,
      '/$1/[private-token]',
    )
    .slice(0, 500);
}

function sanitizeTechnicalContextValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[private link redacted]')
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '[private identifier redacted]',
    )
    .trim()
    .slice(0, 120);
}

function sanitizeTechnicalContext(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const context = {};

  for (const key of Object.keys(TECHNICAL_CONTEXT_FIELDS)) {
    const value = sanitizeTechnicalContextValue(input[key]);
    if (value) {
      context[key] = value;
    }
  }

  return context;
}

export function validateSupportPayload(input = {}) {
  const type =
    String(input.type || 'support').trim() === 'feedback'
      ? 'feedback'
      : 'support';

  const email = String(input.email || '')
    .trim()
    .toLowerCase();

  const rawMessage = String(input.message || '');

  const message = sanitizeSupportMessage(rawMessage).slice(
    0,
    type === 'feedback'
      ? MAX_FEEDBACK_LENGTH
      : MAX_MESSAGE_LENGTH,
  );

  const pageContext = String(input.pageContext || '').trim();

  const category = FEEDBACK_CATEGORIES.includes(
    String(input.category || '').trim(),
  )
    ? String(input.category || '').trim()
    : "Something isn't working";

  const pagePath = sanitizeSupportPath(input.pagePath);
  const technicalContext =
    type === 'feedback'
      ? sanitizeTechnicalContext(input.technicalContext)
      : {};

  const errors = [];

  if (!isValidSupportEmail(email)) {
    errors.push({
      field: 'email',
      message: 'Enter a valid email address.',
    });
  }

  if (!rawMessage.trim()) {
    errors.push({
      field: 'message',
      message: 'Tell us what you need help with.',
    });
  }

  if (
    rawMessage.length
    > (
      type === 'feedback'
        ? MAX_FEEDBACK_LENGTH
        : MAX_MESSAGE_LENGTH
    )
  ) {
    errors.push({
      field: 'message',
      message: `Message must be ${
        type === 'feedback'
          ? MAX_FEEDBACK_LENGTH
          : MAX_MESSAGE_LENGTH
      } characters or fewer.`,
    });
  }

  if (!Object.hasOwn(SUPPORT_PAGE_CONTEXTS, pageContext)) {
    errors.push({
      field: 'pageContext',
      message: 'Invalid page context.',
    });
  }

  if (input.company) {
    errors.push({
      field: 'company',
      message: 'Invalid request.',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    value:
      errors.length === 0
        ? {
            type,
            email,
            message,
            pageContext,
            category,
            pagePath,
            technicalContext,
          }
        : null,
  };
}

export function getSupportConfig(env = process.env) {
  const required = [
    'SUPPORT_SMTP_USER',
    'SUPPORT_SMTP_APP_PASSWORD',
    'SUPPORT_TO_EMAIL',
  ];

  const missing = required.filter(
    (key) => !String(env[key] || '').trim(),
  );

  return {
    ok: missing.length === 0,
    missing,
    user: String(env.SUPPORT_SMTP_USER || '').trim(),
    password: String(env.SUPPORT_SMTP_APP_PASSWORD || ''),
    to: String(env.SUPPORT_TO_EMAIL || '').trim(),
    fromName: String(
      env.SUPPORT_FROM_NAME || 'War Dogs Academy Support',
    ).trim(),
  };
}

export function getFeedbackConfig(env = process.env) {
  const webhookUrl = String(
    env.SLACK_CTC_FEEDBACK_WEBHOOK_URL || '',
  ).trim();

  return {
    ok: Boolean(webhookUrl),
    missing: webhookUrl
      ? []
      : ['SLACK_CTC_FEEDBACK_WEBHOOK_URL'],
    webhookUrl,
    environment: String(
      env.VERCEL_ENV || env.NODE_ENV || 'development',
    ).trim(),
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function encodeAddress(name, email) {
  const safeName = String(name || '')
    .replace(/["\r\n]/g, '')
    .trim();

  return safeName
    ? `"${safeName}" <${email}>`
    : email;
}

function escapeSlackText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatFeedbackEnvironment(value) {
  const normalized = String(
    value || 'development',
  )
    .trim()
    .toLowerCase();

  if (normalized === 'production') {
    return 'Production';
  }

  if (normalized === 'preview') {
    return 'Preview';
  }

  if (normalized === 'development') {
    return 'Development';
  }

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : 'Development';
}

function formatFeedbackCategory(value) {
  const category = String(value || '').trim();

  if (category === 'Other') {
    return `${FEEDBACK_CATEGORY_ICONS.Other} Other / suggestion`;
  }

  if (FEEDBACK_CATEGORIES.includes(category)) {
    return `${FEEDBACK_CATEGORY_ICONS[category] || '\u{1F9EA}'} ${category}`;
  }

  return '\u{1F9EA} General beta feedback';
}

function formatFeedbackSubmitted(value) {
  const date = new Date(
    value || Date.now(),
  );

  const datePart = new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    },
  ).format(date);

  const timePart = new Intl.DateTimeFormat(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    },
  ).format(date);

  return `${datePart} \u00B7 ${timePart} ET`;
}

function formatSafeBuyerReference(value) {
  const safe = String(value || '').trim();

  if (!/^[a-z0-9_-]{8,80}$/i.test(safe)) {
    return '';
  }

  return `${safe.slice(0, 4)}...${safe.slice(-3)}`;
}

export function buildSupportEmail(validPayload, config) {
  const page =
    SUPPORT_PAGE_CONTEXTS[
      validPayload.pageContext
    ];

  const subject =
    `War Dogs Academy Support Request - ${page}`;

  const text = [
    'War Dogs Academy Support Request',
    '',
    'Student email:',
    validPayload.email,
    '',
    'Page:',
    page,
    '',
    'Issue:',
    validPayload.message,
    '',
  ].join('\n');

  const html = `
    <div style="margin:0;padding:0;background:#f8f4ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2926;line-height:1.5">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px">
        <div style="height:5px;background:#f52ea9;border-radius:12px 12px 0 0"></div>
        <div style="height:3px;background:#ff9f58"></div>

        <div style="background:#ffffff;border:1px solid #e5e0da;border-top:0;border-radius:0 0 12px 12px;overflow:hidden">
          <div style="padding:26px 28px 18px;text-align:center;border-bottom:1px solid #e5e0da">
            <div style="font-size:12px;letter-spacing:2.4px;text-transform:uppercase;font-weight:600;color:#1a1a1a">
              War Dogs Academy
            </div>

            <div style="width:54px;height:3px;background:#f52ea9;margin:14px auto 0"></div>

            <h1 style="margin:16px 0 0;font-size:24px;line-height:1.2;color:#1a1a1a;font-weight:900">
              Support Request
            </h1>

            <p style="margin:8px 0 0;color:#7a7570;font-size:14px">
              A student needs help with the War Dogs Academy journey.
            </p>
          </div>

          <div style="padding:24px 28px">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:0 0 14px">
                  <div style="font-size:11px;letter-spacing:1.1px;text-transform:uppercase;font-weight:600;color:#7a7570">
                    Student email
                  </div>

                  <div style="margin-top:5px;font-size:16px;color:#1a1a1a;font-weight:600">
                    ${escapeHtml(validPayload.email)}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:14px 0;border-top:1px solid #e5e0da">
                  <div style="font-size:11px;letter-spacing:1.1px;text-transform:uppercase;font-weight:600;color:#7a7570">
                    Page context
                  </div>

                  <div style="margin-top:7px;display:inline-block;background:#f3ede2;border:1px solid #e5e0da;border-left:4px solid #ff9f58;border-radius:0 8px 8px 0;padding:8px 11px;font-size:15px;color:#1a1a1a;font-weight:600">
                    ${escapeHtml(page)}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:14px 0 0;border-top:1px solid #e5e0da">
                  <div style="font-size:11px;letter-spacing:1.1px;text-transform:uppercase;font-weight:600;color:#7a7570">
                    Issue
                  </div>

                  <div style="margin-top:9px;white-space:pre-wrap;background:#f8f4ec;border:1px solid #e5e0da;border-left:4px solid #f52ea9;border-radius:0 10px 10px 0;padding:14px 15px;font-size:15px;color:#2b2926">
                    ${escapeHtml(validPayload.message)}
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding:16px 28px;background:#f3ede2;border-top:1px solid #e5e0da;color:#7a7570;font-size:12.5px">
            Reply directly to this email to respond to the student. Private links, tokens, UUIDs, and notice identifiers are redacted before this message is sent.
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    from: encodeAddress(
      config.fromName,
      config.user,
    ),
    to: config.to,
    replyTo: validPayload.email,
    subject,
    text,
    html,
  };
}

export function buildFeedbackSlackMessage(
  validPayload,
  config,
  metadata = {},
) {
  const page =
    SUPPORT_PAGE_CONTEXTS[validPayload.pageContext]
    || 'Curated Target Contracts';

  const submitted =
    formatFeedbackSubmitted(metadata.now);

  const buyerRef =
    formatSafeBuyerReference(
      metadata.buyerId
      || metadata.buyer_id
      || validPayload.buyerId
      || validPayload.buyer_id,
    );

  const category =
    formatFeedbackCategory(validPayload.category);

  const environment =
    formatFeedbackEnvironment(config.environment);

  const studentEmail =
    escapeSlackText(validPayload.email);

  const safePage =
    escapeSlackText(page);

  const safeMessage =
    escapeSlackText(validPayload.message);

  const technicalContext =
    validPayload.technicalContext || {};

  const browser =
    technicalContext.browser || 'Unknown';

  const device =
    technicalContext.device || 'Unknown';

  const os =
    technicalContext.os || 'Unknown';

  const viewport =
    technicalContext.viewport || 'Unknown';

  const screen =
    technicalContext.screen || 'Unknown';

  const timezone =
    technicalContext.timezone || 'Unknown';

  const language =
    technicalContext.language || 'Unknown';

  const reportDetails = [
    `*Issue type:* ${escapeSlackText(category)}`,
    `*Student:* ${studentEmail}`,
    `*Page:* ${safePage}`,
    `*Environment:* ${escapeSlackText(environment)}`,
    ...(buyerRef
      ? [`*Buyer:* \`${escapeSlackText(buyerRef)}\``]
      : []),
  ].join('\n');

  const technicalDetails = [
    `*Browser:* ${escapeSlackText(browser)}`,
    `*Device:* ${escapeSlackText(device)}`,
    `*Operating system:* ${escapeSlackText(os)}`,
    `*Viewport:* ${escapeSlackText(viewport)}`,
    `*Screen:* ${escapeSlackText(screen)}`,
    `*Timezone:* ${escapeSlackText(timezone)}`,
    `*Language:* ${escapeSlackText(language)}`,
  ].join('\n');

  return {
    text: `New CTC Beta Feedback from ${validPayload.email}`,

    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'CTC Beta Feedback',
        },
      },

      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*REPORT DETAILS*\n${reportDetails}`,
        },
      },

      {
        type: 'divider',
      },

      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*WHAT HAPPENED*\n\n${safeMessage}`,
        },
      },

      {
        type: 'divider',
      },

      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*TECHNICAL CONTEXT*\n${technicalDetails}`,
        },
      },

      {
        type: 'divider',
      },

      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Submitted ${escapeSlackText(submitted)}`,
          },
        ],
      },
    ],
  };
}

function smtpLines(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .filter(Boolean);
}

function createSmtpClient({
  host = 'smtp.gmail.com',
  port = 465,
} = {}) {
  let socket;
  let buffer = '';
  const waiters = [];

  function flush() {
    while (waiters.length > 0) {
      const waiter = waiters[0];

      const lines =
        smtpLines(buffer);

      if (lines.length === 0) {
        return;
      }

      const last =
        lines[lines.length - 1];

      if (!/^\d{3} /.test(last)) {
        return;
      }

      buffer = '';

      waiters.shift();

      waiter.resolve(
        lines.join('\n'),
      );
    }
  }

  return {
    async connect() {
      socket = tls.connect({
        host,
        port,
        servername: host,
      });

      socket.setEncoding('utf8');

      socket.on(
        'data',
        (chunk) => {
          buffer += chunk;
          flush();
        },
      );

      socket.on(
        'error',
        (err) => {
          while (waiters.length) {
            waiters
              .shift()
              .reject(err);
          }
        },
      );

      await new Promise(
        (resolve, reject) => {
          socket.once(
            'secureConnect',
            resolve,
          );

          socket.once(
            'error',
            reject,
          );
        },
      );
    },

    read() {
      return new Promise(
        (resolve, reject) => {
          waiters.push({
            resolve,
            reject,
          });

          flush();
        },
      );
    },

    command(line) {
      socket.write(
        `${line}\r\n`,
      );

      return this.read();
    },

    writeData(data) {
      socket.write(data);
    },

    end() {
      if (socket) {
        socket.end();
      }
    },
  };
}

function assertSmtpOk(
  response,
  expected = /^2|^3/,
) {
  if (
    !expected.test(
      String(response || ''),
    )
  ) {
    throw new Error(
      'SMTP command failed',
    );
  }
}

function mimeMessage(email) {
  const boundary =
    `wda-support-${Date.now()}`;

  return [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Reply-To: ${email.replyTo}`,
    `Subject: ${email.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    email.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    email.html,
    '',
    `--${boundary}--`,
    '.',
    '',
  ].join('\r\n');
}

async function sendViaGmailSmtp(
  email,
  config,
) {
  const client =
    createSmtpClient();

  try {
    await client.connect();

    assertSmtpOk(
      await client.read(),
    );

    assertSmtpOk(
      await client.command(
        'EHLO wardogsacademy.local',
      ),
    );

    assertSmtpOk(
      await client.command(
        'AUTH LOGIN',
      ),
      /^334/,
    );

    assertSmtpOk(
      await client.command(
        Buffer
          .from(config.user)
          .toString('base64'),
      ),
      /^334/,
    );

    assertSmtpOk(
      await client.command(
        Buffer
          .from(config.password)
          .toString('base64'),
      ),
    );

    assertSmtpOk(
      await client.command(
        `MAIL FROM:<${config.user}>`,
      ),
    );

    assertSmtpOk(
      await client.command(
        `RCPT TO:<${config.to}>`,
      ),
    );

    assertSmtpOk(
      await client.command('DATA'),
      /^354/,
    );

    client.writeData(
      mimeMessage(email),
    );

    assertSmtpOk(
      await client.read(),
    );

    await client
      .command('QUIT')
      .catch(() => null);
  } finally {
    client.end();
  }
}

export async function sendSupportRequest(
  payload,
  {
    env = process.env,
    transport = testTransport,
  } = {},
) {
  const validation =
    validateSupportPayload(
      payload,
    );

  if (!validation.ok) {
    const err =
      new Error(
        'Invalid support request',
      );

    err.code =
      'SUPPORT_VALIDATION_FAILED';

    err.validation =
      validation;

    throw err;
  }

  const config =
    getSupportConfig(env);

  if (!config.ok) {
    const err =
      new Error(
        'Support SMTP configuration is missing',
      );

    err.code =
      'SUPPORT_CONFIG_MISSING';

    err.missing =
      config.missing;

    throw err;
  }

  const email =
    buildSupportEmail(
      validation.value,
      config,
    );

  if (transport) {
    return transport(
      email,
      config,
    );
  }

  return sendViaGmailSmtp(
    email,
    config,
  );
}

export async function sendFeedbackRequest(
  payload,
  {
    env = process.env,
    transport = testFeedbackTransport,
    metadata = {},
  } = {},
) {
  const validation =
    validateSupportPayload({
      ...payload,
      type: 'feedback',
    });

  if (!validation.ok) {
    const err =
      new Error(
        'Invalid feedback request',
      );

    err.code =
      'SUPPORT_VALIDATION_FAILED';

    err.validation =
      validation;

    throw err;
  }

  const config =
    getFeedbackConfig(env);

  if (!config.ok) {
    const err =
      new Error(
        'Slack feedback configuration is missing',
      );

    err.code =
      'SUPPORT_CONFIG_MISSING';

    err.missing =
      config.missing;

    throw err;
  }

  const slackMessage =
    buildFeedbackSlackMessage(
      validation.value,
      config,
      metadata,
    );

  if (transport) {
    return transport(
      slackMessage,
      config,
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      7000,
    );

  try {
    const response =
      await fetch(
        config.webhookUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(
              slackMessage,
            ),
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      const err =
        new Error(
          'Slack webhook rejected feedback',
        );

      err.code =
        'SUPPORT_SEND_FAILED';

      err.status =
        response.status;

      throw err;
    }

    return {
      ok: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
