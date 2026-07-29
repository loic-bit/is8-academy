import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initDb } from './db.js';
import { mirrorLeadToAirtable } from './airtable.js';
import { mirrorSignupToKit } from './kit.js';
import { EVENT_TYPES, LESSON_ID_RE, VALID_UNLOCKS, UNLOCK_PREFIX } from './scoring.js';
import { registerAdminRoutes } from './admin.js';
import { sendEmail } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

// Refuse to boot in production with the insecure fallback secret — a missing
// JWT_SECRET in prod would let anyone forge login tokens.
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || JWT_SECRET === 'dev-insecure-secret-change-me')
) {
  console.error('[server] FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Baseline security headers on every response.
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Tiny in-memory rate limiter for auth endpoints (single-instance service).
// key -> array of attempt timestamps within the window.
const rlBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (rlBuckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  rlBuckets.set(key, arr);
  if (rlBuckets.size > 10000) rlBuckets.clear(); // crude memory bound
  return arr.length <= max;
}
const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

// Route any async handler's rejection into Express instead of crashing the
// process (Node kills on unhandled rejection). Applied at registration time.
const wrapAsync = (fn) =>
  typeof fn === 'function' && fn.constructor.name === 'AsyncFunction'
    ? (req, res, next) => fn(req, res, next).catch(next)
    : fn;
for (const m of ['get', 'post', 'patch', 'delete', 'put']) {
  const orig = app[m].bind(app);
  app[m] = (path, ...handlers) => orig(path, ...handlers.map(wrapAsync));
}

// ── Auth helpers ────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Admin truth, evaluated per request (never baked into the 30-day JWT):
// ADMIN_EMAILS env = root admins; users.is_admin = admins managed from the
// /admin UI (see /api/admin/admins).
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

// Root admins come from env (cannot be removed in-app); additional admins
// are managed from the /admin UI via users.is_admin. Checked per request.
const isRootAdmin = (email) => ADMIN_EMAILS.has(String(email || '').toLowerCase());

async function isAdminUser(user) {
  if (!user?.email) return false;
  if (isRootAdmin(user.email)) return true;
  const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [user.id]);
  return !!rows[0]?.is_admin;
}

async function adminRequired(req, res, next) {
  if (await isAdminUser(req.user)) return next();
  res.status(403).json({ error: 'Forbidden' });
}

// Fire-and-forget server-side event. Analytics must never fail a request.
function recordEvent(userId, type, payload = {}, sessionId = null) {
  pool
    .query(
      'INSERT INTO events (user_id, event_type, payload, session_id) VALUES ($1, $2, $3, $4)',
      [userId, type, payload, sessionId]
    )
    .catch((e) => console.warn('[events]', e.message));
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// ── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Auth routes ─────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    if (!rateLimit(`signup:${clientIp(req)}`, 20, 60 * 60_000)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash]
    );
    const user = rows[0];

    // Mirror to CRM + email list — fire and forget, never blocks signup.
    mirrorLeadToAirtable({ name, email });
    mirrorSignupToKit({ name, email });
    recordEvent(user.id, 'signup', {});

    res.json({
      token: signToken(user),
      user: { ...publicUser(user), isAdmin: isRootAdmin(email) },
    });
  } catch (e) {
    console.error('[signup]', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    if (!rateLimit(`login:${clientIp(req)}:${email}`, 10, 15 * 60_000)) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    recordEvent(user.id, 'login', {});
    res.json({
      token: signToken(user),
      user: { ...publicUser(user), isAdmin: isRootAdmin(user.email) || !!user.is_admin },
    });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Password reset ────────────────────────────────────────────────────────
// Token = short-lived JWT bound to a slice of the CURRENT password hash, so
// it is single-use by construction: once the password changes, the binding
// no longer matches and the token dies. No extra table needed.
app.post('/api/auth/forgot', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email required.' });
  if (!rateLimit(`forgot:${clientIp(req)}:${email}`, 5, 60 * 60_000)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  const { rows } = await pool.query('SELECT id, name, password FROM users WHERE email = $1', [
    email,
  ]);
  if (rows[0]) {
    const u = rows[0];
    const token = jwt.sign(
      { id: u.id, purpose: 'pwreset', h: u.password.slice(-12) },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const base =
      process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const link = `${base}/reset?token=${encodeURIComponent(token)}`;
    sendEmail({
      to: email,
      subject: 'Reset your Cashflow 2.0 Academy password',
      text: `Hey ${u.name.split(' ')[0]},\n\nSomeone (hopefully you) asked to reset your Academy password. This link works for 1 hour:\n\n${link}\n\nIf you didn't ask for this, ignore this email. Your password stays unchanged and your account is safe.\n\nCashflow 2.0 Academy`,
    });
  }
  // Same response whether or not the account exists: no email enumeration.
  res.json({ ok: true });
});

app.post('/api/auth/reset', async (req, res) => {
  const token = (req.body.token || '').trim();
  const password = req.body.password || '';
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
    if (claims.purpose !== 'pwreset') throw new Error('wrong purpose');
  } catch {
    return res.status(400).json({ error: 'This reset link is invalid or expired.' });
  }
  const { rows } = await pool.query('SELECT id, name, email, password FROM users WHERE id = $1', [
    claims.id,
  ]);
  const user = rows[0];
  if (!user || user.password.slice(-12) !== claims.h) {
    return res.status(400).json({ error: 'This reset link is invalid or expired.' });
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);
  recordEvent(user.id, 'login', { via: 'password_reset' });
  res.json({ token: signToken(user), user: { ...publicUser(user), isAdmin: isAdminUser(user) } });
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, is_admin FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Unauthorized' });
  const { is_admin, ...u } = rows[0];
  res.json({ user: { ...u, isAdmin: isRootAdmin(u.email) || !!is_admin } });
});

// ── Course progress ───────────────────────────────────────────────────────
app.get('/api/progress', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT lesson_id FROM course_progress WHERE user_id = $1',
    [req.user.id]
  );
  res.json({ completed: rows.map((r) => r.lesson_id) });
});

app.post('/api/progress', authRequired, async (req, res) => {
  const lessonId = (req.body.lessonId || '').trim();
  if (!lessonId) return res.status(400).json({ error: 'lessonId required' });
  // Only real lesson ids and the two known checkpoint unlocks may be written:
  // fabricated ids would otherwise inflate lesson counts and game the lead score.
  if (!LESSON_ID_RE.test(lessonId) && !VALID_UNLOCKS.has(lessonId)) {
    return res.status(400).json({ error: 'Unknown lessonId' });
  }
  await pool.query(
    `INSERT INTO course_progress (user_id, lesson_id) VALUES ($1, $2)
     ON CONFLICT (user_id, lesson_id) DO NOTHING`,
    [req.user.id, lessonId]
  );
  recordEvent(
    req.user.id,
    lessonId.startsWith(UNLOCK_PREFIX) ? 'checkpoint_claimed' : 'lesson_complete',
    { lessonId }
  );
  res.json({ ok: true });
});

// Un-mark a lesson (toggle a completed lesson back to not-done). The event
// row is the only surviving history once the progress row is deleted.
app.delete('/api/progress/:lessonId', authRequired, async (req, res) => {
  await pool.query('DELETE FROM course_progress WHERE user_id = $1 AND lesson_id = $2', [
    req.user.id,
    req.params.lessonId,
  ]);
  recordEvent(req.user.id, 'lesson_uncomplete', { lessonId: req.params.lessonId });
  res.json({ ok: true });
});

// ── Saved deals (from calculators / analyzer) ─────────────────────────────
app.get('/api/deals', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, label, data, created_at FROM saved_deals WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ deals: rows });
});

app.post('/api/deals', authRequired, async (req, res) => {
  const label = (req.body.label || 'Untitled deal').trim();
  const data = req.body.data || {};
  const { rows } = await pool.query(
    'INSERT INTO saved_deals (user_id, label, data) VALUES ($1, $2, $3) RETURNING id, label, data, created_at',
    [req.user.id, label, data]
  );
  recordEvent(req.user.id, 'deal_saved', { label, hasListingUrl: !!data.listingUrl });
  res.json({ deal: rows[0] });
});

app.patch('/api/deals/:id', authRequired, async (req, res) => {
  const label = (req.body.label || '').trim();
  if (!label) return res.status(400).json({ error: 'label required' });
  const { rows } = await pool.query(
    'UPDATE saved_deals SET label = $1 WHERE id = $2 AND user_id = $3 RETURNING id, label, data, created_at',
    [label, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ deal: rows[0] });
});

app.delete('/api/deals/:id', authRequired, async (req, res) => {
  await pool.query('DELETE FROM saved_deals WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  res.json({ ok: true });
});

// ── AI Deal Finder trial requests ─────────────────────────────────────────
app.get('/api/dealfinder/trial', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT created_at FROM trial_requests WHERE user_id = $1 AND product = 'dealfinder'",
    [req.user.id]
  );
  res.json({ requested: !!rows[0], at: rows[0]?.created_at || null });
});

app.post('/api/dealfinder/trial', authRequired, async (req, res) => {
  await pool.query(
    `INSERT INTO trial_requests (user_id, product) VALUES ($1, 'dealfinder')
     ON CONFLICT (user_id, product) DO NOTHING`,
    [req.user.id]
  );
  // Let the sales team see the raised hand in the CRM. Fire and forget.
  mirrorLeadToAirtable({
    name: req.user.name,
    email: req.user.email,
    source: 'AI Deal Finder Trial',
  });
  recordEvent(req.user.id, 'finder_trial_click', { via: 'in_app' });
  res.json({ ok: true });
});

// ── Event ingest (batched, first-party analytics) ─────────────────────────
app.post('/api/events', authRequired, async (req, res) => {
  const incoming = Array.isArray(req.body.events) ? req.body.events.slice(0, 25) : [];
  const rows = [];
  for (const e of incoming) {
    const type = String(e?.type || '');
    if (!EVENT_TYPES.has(type)) continue;
    // Arrays must not reach the jsonb param: node-pg serializes JS arrays as
    // Postgres array literals, which rejects the INSERT and loses the batch.
    let payload =
      e?.payload && typeof e.payload === 'object' && !Array.isArray(e.payload) ? e.payload : {};
    let json = JSON.stringify(payload);
    if (json.length > 4000) json = JSON.stringify({ truncated: true });
    const sid = e?.sessionId ? String(e.sessionId).slice(0, 64) : null;
    rows.push([req.user.id, type, json, sid]);
  }
  if (rows.length) {
    const values = rows
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(', ');
    await pool.query(
      `INSERT INTO events (user_id, event_type, payload, session_id) VALUES ${values}`,
      rows.flat()
    );
    // Denormalized recency for the admin list. Batching (>=8s between client
    // flushes) is the throttle; no in-memory bookkeeping to leak.
    pool
      .query('UPDATE users SET last_seen = now() WHERE id = $1', [req.user.id])
      .catch(() => {});
  }
  res.json({ ok: true, accepted: rows.length });
});

// ── Readiness Quiz results (the financial qualification signal) ───────────
app.get('/api/quiz/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT winner, answers, totals, low_fidelity, created_at FROM quiz_results
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  );
  res.json({ result: rows[0] || null });
});

app.post('/api/quiz', authRequired, async (req, res) => {
  const winner = (req.body.winner || '').toString().slice(0, 40);
  const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const answerLabels =
    req.body.answerLabels && typeof req.body.answerLabels === 'object' ? req.body.answerLabels : {};
  const totals = req.body.totals && typeof req.body.totals === 'object' ? req.body.totals : {};
  const lowFidelity = !!req.body.lowFidelity;
  if (!winner) return res.status(400).json({ error: 'winner required' });
  await pool.query(
    `INSERT INTO quiz_results (user_id, answers, answer_labels, totals, winner, low_fidelity)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.user.id, answers, answerLabels, totals, winner, lowFidelity]
  );
  recordEvent(req.user.id, 'quiz_completed', { winner, lowFidelity });
  res.json({ ok: true });
});

// ── Admin management (add/remove dashboard admins from the /admin UI) ────
app.get('/api/admin/admins', authRequired, adminRequired, async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email FROM users WHERE is_admin = true ORDER BY name'
  );
  res.json({
    root: [...ADMIN_EMAILS],
    managed: rows.filter((r) => !isRootAdmin(r.email)),
  });
});

app.post('/api/admin/admins', authRequired, adminRequired, async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const makeAdmin = !!req.body.isAdmin;
  if (!email) return res.status(400).json({ error: 'Email required.' });
  if (isRootAdmin(email)) {
    return res.status(400).json({ error: 'Root admins are managed in the server config.' });
  }
  if (!makeAdmin && email === (req.user.email || '').toLowerCase()) {
    return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  }
  const { rows } = await pool.query(
    'UPDATE users SET is_admin = $1 WHERE email = $2 RETURNING id, name, email',
    [makeAdmin, email]
  );
  if (!rows[0]) {
    return res
      .status(404)
      .json({ error: 'No account with that email. They need to sign up first.' });
  }
  recordEvent(req.user.id, 'login', { adminChange: email, isAdmin: makeAdmin });
  res.json({ ok: true, user: rows[0] });
});

// ── Admin analytics API (registered via patched verbs, above the SPA
//    catch-all; real protection lives here, the client gate is UX only) ────
registerAdminRoutes(app, {
  authRequired,
  adminRequired,
  isAdminEmail: (email) => ADMIN_EMAILS.has(String(email || '').toLowerCase()),
});

// ── Static frontend (production build) + SPA fallback ─────────────────────
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

// Final safety net: async route errors land here as a 500, never a crash.
app.use((err, _req, res, _next) => {
  console.error('[api]', err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Boot ────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  })
  .catch((e) => {
    console.error('[server] failed to init db', e);
    process.exit(1);
  });
