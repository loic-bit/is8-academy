// Kit (ConvertKit) v4 mirror: every Academy signup becomes a Kit subscriber,
// gets the member tag, and is enrolled in the nurture sequence. Env-gated
// no-op until KIT_API_KEY is set; fire-and-forget from the signup route so
// email infrastructure can never block account creation.
//
// Env: KIT_API_KEY (required to activate)
//      KIT_SEQUENCE_ID (optional: enroll new signups in this sequence)
//      KIT_TAG_ID (optional: apply this tag)
const BASE = 'https://api.kit.com/v4';

const headers = () => ({
  'X-Kit-Api-Key': process.env.KIT_API_KEY,
  'content-type': 'application/json',
});

export async function mirrorSignupToKit({ name, email }) {
  if (!(process.env.KIT_API_KEY || '').trim()) return; // mirror disabled
  try {
    const first = (name || '').trim().split(/\s+/)[0] || null;
    const res = await fetch(`${BASE}/subscribers`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email_address: email, first_name: first }),
    });
    const data = await res.json().catch(() => ({}));
    const id = data?.subscriber?.id;
    if (!id) {
      console.warn('[kit] subscriber create failed:', res.status);
      return;
    }
    const tagId = (process.env.KIT_TAG_ID || '').trim();
    const seqId = (process.env.KIT_SEQUENCE_ID || '').trim();
    if (tagId) {
      fetch(`${BASE}/tags/${tagId}/subscribers/${id}`, {
        method: 'POST',
        headers: headers(),
      }).catch(() => {});
    }
    if (seqId) {
      fetch(`${BASE}/sequences/${seqId}/subscribers/${id}`, {
        method: 'POST',
        headers: headers(),
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[kit] mirror error', e.message);
  }
}
