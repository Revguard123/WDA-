import { sendBatchEmail, DEFAULT_FROM } from '../lib/email/resend.js';

const TO_EMAIL = 'exe.hunain@gmail.com';

async function main() {
  console.log('Sending test email...');
  console.log('From:', DEFAULT_FROM);
  console.log('To:', TO_EMAIL);

  const result = await sendBatchEmail({
    to: TO_EMAIL,
    subject: 'WDA CTC Email Test',
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px">
        <h2>WDA CTC Email Test</h2>
        <p>This is a test email from the Curated Target Contracts system.</p>
        <p>If you received this, the Resend sender configuration is working.</p>
      </div>
    `,
  });

  console.log('Send result:');
  console.dir(result, { depth: null });
}

main().catch((err) => {
  console.error('TEST EMAIL FAILED');
  console.error(err);
  process.exit(1);
});