import pg from 'pg';

const { Pool } = pg;

// Railway injects DATABASE_URL when a Postgres service is attached.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway Postgres requires SSL in production; local dev usually does not.
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

// A dropped idle connection must never crash the process. The pool replaces
// the client; in-flight queries reject and surface as a 500 on that request.
pool.on('error', (err) => {
  console.error('[db] idle client error (recovered):', err.message);
});

// Create tables on boot if they don't exist. Safe to run every start.
// Wrapped in an advisory lock: during rolling deploys two processes boot
// concurrently, and CREATE TABLE IF NOT EXISTS is not concurrency-safe
// (both can see "missing" and race the catalog insert). The lock serializes
// them; the second process then no-ops.
export async function initDb() {
  const client = await pool.connect();
  try {
    // Bounded wait: a wedged peer holding the lock must fail this boot loudly
    // (Railway restarts it) instead of hanging forever with no health check.
    await client.query("SET lock_timeout = '60s'");
    try {
      await client.query('SELECT pg_advisory_lock(824301)');
    } catch (e) {
      // Could not get the lock in time. IF NOT EXISTS makes the DDL safe to
      // attempt anyway; one retry absorbs a peer racing the catalog.
      console.warn('[db] advisory lock not acquired, running DDL unlocked:', e.message);
    }
    try {
      await runDdl(client);
    } catch (e) {
      await new Promise((r) => setTimeout(r, 2000));
      await runDdl(client);
    }
  } finally {
    // Destroy the connection instead of pooling it: session close releases
    // the advisory lock unconditionally, so it can never leak into the pool.
    client.release(true);
  }
}

async function runDdl(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS course_progress (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id    TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS saved_deals (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS trial_requests (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, product)
    );

    CREATE TABLE IF NOT EXISTS events (
      id         BIGSERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      event_type TEXT NOT NULL,
      payload    JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_events_user_time ON events (user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);

    CREATE TABLE IF NOT EXISTS quiz_results (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answers       JSONB NOT NULL DEFAULT '{}',
      answer_labels JSONB NOT NULL DEFAULT '{}',
      totals        JSONB NOT NULL DEFAULT '{}',
      winner        TEXT,
      low_fidelity  BOOLEAN NOT NULL DEFAULT false,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_results (user_id, created_at DESC);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
  `);
  console.log('[db] schema ready');
}
