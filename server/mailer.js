// Transactional email (password resets). Provider-gated: with RESEND_API_KEY
// set it sends via Resend; otherwise it logs the message so dev/local flows
// stay testable without a provider. Never throws into a request path.
export async function sendEmail({ to, subject, text }) {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) {
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return { dev: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Cashflow 2.0 Academy <onboarding@resend.dev>',
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) console.warn('[mail] send failed', res.status, (await res.text()).slice(0, 200));
    return { ok: res.ok };
  } catch (e) {
    console.warn('[mail]', e.message);
    return { ok: false };
  }
}
