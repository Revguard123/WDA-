import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRAND, EMAIL_FONT, WDA_LOGO, WDA_BACKGROUND, baseEmailLayout, renderMetaPanel, renderDetailPanel, renderButton } from '../lib/email/crmEmailLayout.js';
import { buildSupportEmail, getSupportConfig, validateSupportPayload } from '../lib/support.js';

const config = getSupportConfig({ SUPPORT_SMTP_USER: 'support@example.test', SUPPORT_SMTP_APP_PASSWORD: 'preview-only', SUPPORT_TO_EMAIL: 'support@example.test' });
function supportEmail(message = 'I need help opening my contracts.\nPlease check my portal access.') {
  const validated = validateSupportPayload({ email: 'student@example.test', message, pageContext: 'portal' });
  assert.equal(validated.ok, true);
  return buildSupportEmail(validated.value, config);
}

test('support email retains the verified CRM layout snapshot, with no orange stripe or old 640px frame', () => {
  const expected = readFileSync(new URL('./fixtures/support-email-crm.html', import.meta.url), 'utf8').trimEnd();
  assert.equal(supportEmail().html, expected);
  assert.equal(EMAIL_FONT, "'Inter', sans-serif");
  assert.equal(BRAND.canvas, '#f4f1f3');
  assert.match(expected, /width="600"/);
  assert.match(expected, /Private staff communication/);
  assert.match(expected, /crm\.wardogsacademy\.com/);
  assert.ok(expected.includes(WDA_LOGO));
  assert.ok(expected.includes(WDA_BACKGROUND));
  assert.doesNotMatch(expected, /#ff9f58|#f8f4ec|max-width:640px;|font-weight:900/);
});

test('support data remains escaped and multiline issue text uses the CRM detail panel', () => {
  const email = supportEmail('First line\n<script>alert("test")</script> & details');
  assert.ok(email.html.includes('First line<br>&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt; &amp; details'));
  assert.doesNotMatch(email.html, /<script>/);
  assert.ok(email.html.includes(renderDetailPanel('Issue', 'First line\n<script>alert("test")</script> & details')));
  assert.equal(email.replyTo, 'student@example.test');
  assert.equal(email.to, 'support@example.test');
  assert.equal(email.subject, 'War Dogs Academy Support Request - Portal');
});

test('privacy redaction protects both HTML and plain-text email after the template switch', () => {
  const email = supportEmail('Please check https://example.test/setup/123e4567-e89b-12d3-a456-426614174000 and buyer 123e4567-e89b-12d3-a456-426614174000.');
  for (const content of [email.html, email.text]) {
    assert.doesNotMatch(content, /123e4567-e89b-12d3-a456-426614174000|https:\/\/example.test\/setup/);
    assert.match(content, /redacted/);
  }
});

test('the CRM shell preserves responsive and Outlook fallback markup and escapes headings and preview text', () => {
  const html = baseEmailLayout({ eyebrow: '<support>', title: '<Request>', previewText: '<Preview>', bodyHtml: '<p>Safe pre-rendered content</p>' });
  assert.match(html, /<!doctype html>/);
  assert.match(html, /max-width:640px/);
  assert.match(html, /email-content.*padding:27px 22px 29px/s);
  assert.match(html, /v:background/);
  assert.match(html, /mso-table-lspace/);
  assert.match(html, /&lt;Request&gt;/);
  assert.match(html, /&lt;Preview&gt;/);
  assert.doesNotMatch(html, /<Request>|<Preview>|<support>/);
});

test('shared CRM metadata and button helpers retain escaped data and reject unsafe external links', () => {
  assert.equal(renderMetaPanel([]), '');
  const panel = renderMetaPanel([{ label: '<Label>', value: '<Value>' }]);
  assert.match(panel, /&lt;Label&gt;/);
  assert.match(panel, /&lt;Value&gt;/);
  const button = renderButton({ href: 'javascript:alert(1)', label: '<Open>' });
  assert.match(button, /href="#"/);
  assert.match(button, /&lt;Open&gt;/);
  assert.doesNotMatch(button, /javascript:/);
});
