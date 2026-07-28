// Resend email sender (lazy import so the package/key are only needed when
// actually sending). Injectable client for tests. Needs RESEND_API_KEY and a
// verified sending domain; the from address should live on that domain.

let cached = null;
async function getResend() {
  if (cached) return cached;
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY must be set');
  const { Resend } = await import('resend');
  cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'War Dogs Academy <contracts@wardogsacademy.com>';

export async function sendBatchEmail({ to, subject, html, from = DEFAULT_FROM }, { client } = {}) {
  const resend = client || (await getResend());
  const { data, error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend send failed: ${JSON.stringify(error)}`);
  return data;
}

export { DEFAULT_FROM };
