import { createSmtpClient } from './supportSmtp.js';
import { BRAND as EMAIL_BRAND, EMAIL_FONT, baseEmailLayout, renderMetaPanel, renderDetailPanel } from './email/crmEmailLayout.js';

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
  const host = String(env.SUPPORT_SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(env.SUPPORT_SMTP_PORT || 465);
  const required = [
    'SUPPORT_SMTP_USER',
    'SUPPORT_SMTP_APP_PASSWORD',
    'SUPPORT_TO_EMAIL',
  ];

  const missing = required.filter(
    (key) => !String(env[key] || '').trim(),
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535) missing.push('SUPPORT_SMTP_PORT');

  return {
    ok: missing.length === 0,
    missing,
    host,
    port,
    secure: port === 465,
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
  const emailRecipients = [...new Set(String(env.FEEDBACK_TO_EMAIL || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const emailTo = emailRecipients.join(', ');
  const configured = Boolean(webhookUrl || emailTo);

  return {
    ok: configured,
    missing: configured
      ? []
      : ['SLACK_CTC_FEEDBACK_WEBHOOK_URL', 'FEEDBACK_TO_EMAIL'],
    webhookUrl,
    emailTo,
    emailRecipients,
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

  const html = baseEmailLayout({
    audience: 'staff',
    eyebrow: 'CTC support',
    title: 'Support Request',
    previewText: `New support request from ${validPayload.email}`,
    bodyHtml: `
      <p style="margin:0 0 20px;font-family:${EMAIL_FONT};font-size:13px;line-height:21px;font-weight:400;color:${EMAIL_BRAND.text};">
        A student needs help with the War Dogs Academy journey.
      </p>
      ${renderMetaPanel([
        { label: 'Student email', value: validPayload.email },
        { label: 'Page context', value: page },
      ])}
      ${renderDetailPanel('Issue', validPayload.message)}`,
    footerNote: 'Reply directly to this email to respond to the student. Private links, tokens, UUIDs, and notice identifiers are redacted before this message is sent.',
  });

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

export function buildSupportAcknowledgement(validPayload, config) {
  const feedback = validPayload.type === 'feedback';
  const description = feedback ? 'feedback' : 'support request';
  const title = `We received your ${description}`;
  const paragraphs = [
    'Hi there,',
    `Thanks for sending your ${description} about Curated Target Contracts. Your message has reached the War Dogs Academy Technical & Development Team.`,
    "We'll review what you shared and follow up if we need more information or have an update. You don't need to submit the same report again.",
    "To add details or a screenshot, reply to this email. Please don't include passwords or private access links.",
  ];
  const page = SUPPORT_PAGE_CONTEXTS[validPayload.pageContext] || 'Curated Target Contracts';
  return {
    from: encodeAddress(config.fromName, config.user),
    to: validPayload.email,
    replyTo: config.user,
    subject: `${title} - War Dogs Academy`,
    automated: true,
    text: [...paragraphs.flatMap((paragraph) => [paragraph, '']), `Page: ${page}`, '', 'Best regards,', 'Technical & Development Team', 'War Dogs Academy', '', 'This is an automatic confirmation that your message was received.'].join('\n'),
    html: baseEmailLayout({
      audience: 'student', eyebrow: feedback ? 'CTC feedback' : 'CTC support', title,
      previewText: 'Your message has reached the War Dogs Academy Technical & Development Team.',
      bodyHtml: `${paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-family:${EMAIL_FONT};font-size:13px;line-height:21px;font-weight:400;color:${EMAIL_BRAND.text};">${escapeHtml(paragraph)}</p>`).join('\n')}
        ${renderMetaPanel([{ label: 'Page', value: page }])}
        <p style="margin:24px 0 0;font-family:${EMAIL_FONT};font-size:13px;line-height:21px;color:${EMAIL_BRAND.text};">Best regards,<br>Technical &amp; Development Team<br>War Dogs Academy</p>`,
      footerNote: 'This is an automatic confirmation that your message was received.',
    }),
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

export function buildFeedbackEmail(validPayload, smtpConfig, feedbackConfig, metadata = {}) {
  const page = SUPPORT_PAGE_CONTEXTS[validPayload.pageContext] || 'Curated Target Contracts';
  const category = validPayload.category || "Something isn't working";
  const environment = formatFeedbackEnvironment(feedbackConfig.environment);
  const submitted = formatFeedbackSubmitted(metadata.now);
  const technicalRows = Object.entries(TECHNICAL_CONTEXT_FIELDS)
    .filter(([key]) => validPayload.technicalContext?.[key])
    .map(([key, label]) => ({ label, value: validPayload.technicalContext[key] }));
  const rows = [
    { label: 'Category', value: category },
    { label: 'Student email', value: validPayload.email },
    { label: 'Page', value: page },
    { label: 'Environment', value: environment },
    { label: 'Submitted', value: submitted },
    { label: 'Page path', value: validPayload.pagePath },
  ];
  return {
    from: encodeAddress(smtpConfig.fromName, smtpConfig.user),
    to: smtpConfig.to,
    replyTo: validPayload.email,
    subject: `CTC Beta Feedback - ${category} - ${page}`,
    text: ['CTC Beta Feedback', '', ...rows.map(({ label, value }) => `${label}: ${value}`), '', 'What happened:', validPayload.message,
      ...(technicalRows.length ? ['', 'Technical context:', ...technicalRows.map(({ label, value }) => `${label}: ${value}`)] : [])].join('\n'),
    html: baseEmailLayout({
      audience: 'staff', eyebrow: 'CTC feedback', title: 'Beta Feedback',
      previewText: `New CTC feedback from ${validPayload.email}`,
      bodyHtml: `<p style="margin:0 0 20px;font-family:${EMAIL_FONT};font-size:13px;line-height:21px;font-weight:400;color:${EMAIL_BRAND.text};">A student submitted feedback through Curated Target Contracts.</p>
        ${renderMetaPanel(rows)}${renderDetailPanel('What happened', validPayload.message)}
        ${technicalRows.length ? renderMetaPanel(technicalRows) : ''}`,
      footerNote: 'Reply directly to this email to respond to the student. Private links and identifiers are redacted before this message is sent.',
    }),
  };
}


function assertSmtpOk(
  response,
  expected = /^2|^3/,
  stage = 'command',
) {
  if (
    !expected.test(
      String(response || ''),
    )
  ) {
    const error = new Error(`SMTP command failed at ${stage}`);
    error.code = 'SUPPORT_SMTP_COMMAND_FAILED';
    error.smtpStage = stage;
    error.smtpCode = Number(String(response || '').match(/^\d{3}/)?.[0]) || null;
    error.smtpEnhancedCode = String(response || '').match(/\b[245]\.\d{1,3}\.\d{1,3}\b/)?.[0] || null;
    // Keep credentials and raw provider replies out of both responses and logs.
    error.smtpReason = /SmtpClientAuthentication.*disabled|SMTP AUTH.*disabled|basic authentication.*disabled/i.test(String(response)) ? 'smtp_auth_disabled' : 'command_rejected';
    throw error;
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
    ...(email.automated ? ['Auto-Submitted: auto-generated', 'X-Auto-Response-Suppress: All'] : []),
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
  ].join('\r\n').replace(/^\./gm, '..') + '\r\n.\r\n';
}

export async function sendViaSmtp(
  email,
  config,
  { createClient = createSmtpClient } = {},
) {
  const recipients = config.recipients || [config.to];
  if (!recipients.length || recipients.some((email) => !isValidSupportEmail(email))) {
    throw Object.assign(new Error('SMTP recipients are missing or invalid'), { code: 'SUPPORT_CONFIG_MISSING', missing: ['SUPPORT_TO_EMAIL'] });
  }
  const client =
    createClient({ host: config.host, port: config.port });

  try {
    await client.connect();

    assertSmtpOk(
      await client.read(),
      /^220/,
      'greeting',
    );

    const hello = await client.command('EHLO wardogsacademy.local');
    assertSmtpOk(hello, /^250/, 'ehlo');
    if (!config.secure) {
      if (!/\bSTARTTLS\b/i.test(hello)) throw Object.assign(new Error('SMTP server does not offer required STARTTLS'), { code: 'SUPPORT_SMTP_TLS_REQUIRED' });
      assertSmtpOk(await client.command('STARTTLS'), /^220/, 'starttls');
      await client.startTls();
      assertSmtpOk(await client.command('EHLO wardogsacademy.local'), /^250/, 'ehlo_tls');
    }

    assertSmtpOk(
      await client.command(
        'AUTH LOGIN',
      ),
      /^334/,
      'auth_login',
    );

    assertSmtpOk(
      await client.command(
        Buffer
          .from(config.user)
          .toString('base64'),
      ),
      /^334/,
      'auth_user',
    );

    assertSmtpOk(
      await client.command(
        Buffer
          .from(config.password)
          .toString('base64'),
      ),
      /^235/,
      'auth_password',
    );

    assertSmtpOk(
      await client.command(
        `MAIL FROM:<${config.user}>`,
      ),
    );

    // All recipients must be accepted before DATA; a rejected address cannot
    // leave the form reporting success after delivering to only one mailbox.
    for (const recipient of recipients) {
      assertSmtpOk(await client.command(`RCPT TO:<${recipient}>`), /^25[01]/, 'rcpt_to');
    }

    assertSmtpOk(
      await client.command('DATA'),
      /^354/,
    );

    client.writeData(
      mimeMessage(email),
    );

    assertSmtpOk(
      await client.read(),
      /^250/,
      'message',
    );

    await client
      .command('QUIT')
      .catch(() => null);
    return { accepted: true };
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

  return sendViaSmtp(
    email,
    config,
  );
}

export async function sendFeedbackRequest(
  payload,
  {
    env = process.env,
    transport = testFeedbackTransport,
    emailTransport = testTransport,
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
        'Feedback delivery configuration is missing',
      );

    err.code =
      'SUPPORT_CONFIG_MISSING';

    err.missing =
      config.missing;

    throw err;
  }

  const channels = [];
  if (config.webhookUrl) {
    channels.push({ name: 'slack', send: () => postFeedbackToSlack(buildFeedbackSlackMessage(validation.value, config, metadata), config, transport) });
  }
  if (config.emailTo) {
    channels.push({ name: 'email', send: async () => {
      const smtpConfig = getSupportConfig({ ...env, SUPPORT_TO_EMAIL: config.emailTo });
      smtpConfig.recipients = config.emailRecipients;
      if (config.emailRecipients.some((email) => !isValidSupportEmail(email))) smtpConfig.missing.push('FEEDBACK_TO_EMAIL');
      if (smtpConfig.missing.length) {
        throw Object.assign(new Error('Feedback SMTP configuration is missing or invalid'), { code: 'SUPPORT_CONFIG_MISSING', missing: smtpConfig.missing });
      }
      const email = buildFeedbackEmail(validation.value, smtpConfig, config, metadata);
      return emailTransport ? emailTransport(email, smtpConfig) : sendViaSmtp(email, smtpConfig);
    } });
  }

  const results = await Promise.allSettled(channels.map((channel) => channel.send()));
  const delivered = Object.fromEntries(channels.map((channel, index) => [channel.name, results[index].status === 'fulfilled']));
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length === results.length) throw failures[0].reason;
  // If one destination accepted the feedback, acknowledge it rather than ask
  // the student to resubmit and duplicate the already-successful notification.
  if (failures.length) console.warn({ event: 'feedback_partial_delivery', delivered });
  return { ok: true, delivered };
}

async function postFeedbackToSlack(slackMessage, config, transport) {
  if (transport) return transport(slackMessage, config);

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
