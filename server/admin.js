// Admin analytics API. Registered through registerAdminRoutes(app, deps) so
// the caller's wrapAsync-patched verb methods cover these async handlers too
// (an express.Router would silently escape that safety net).
//
// GET /api/admin/users returns EVERY decorated account in one payload;
// filtering/sorting is owned by the client (one implementation, not two).
// Overview totals are likewise derived client-side from the same payload.
import { pool } from './db.js';
import {
  scoreRow,
  qualBand,
  dfySignal,
  tierFor,
  signalsFor,
  COURSE_TOTAL_LESSONS,
  UNLOCK_PREFIX,
} from './scoring.js';

// One aggregate row per user. Each source table is scanned ONCE (grouped
// joins), never per-user: correlated subqueries here turned O(users x events)
// and fell over past ~1k accounts.
const USERS_AGG_SQL = `
  SELECT
    u.id, u.name, u.email, u.created_at, u.is_admin,
    GREATEST(u.last_seen, ev.last_event, cp.last_progress) AS last_seen,
    COALESCE(cp.lessons_done, 0) AS lessons_done,
    COALESCE(cp.checkpoints_passed, 0) AS checkpoints_passed,
    COALESCE(sd.deals_saved, 0) AS deals_saved,
    (tr.user_id IS NOT NULL) AS trial_requested,
    q.winner AS quiz_winner,
    q.answers AS quiz_answers,
    q.low_fidelity AS quiz_low_fidelity,
    COALESCE(ev.events_7d, 0) AS events_7d,
    COALESCE(ev.events_30d, 0) AS events_30d,
    COALESCE(ev.event_counts, '{}'::jsonb) AS event_counts
  FROM users u
  LEFT JOIN (
    SELECT user_id,
           max(mx) AS last_event,
           sum(n7)::bigint AS events_7d,
           sum(n30)::bigint AS events_30d,
           jsonb_object_agg(event_type, n) AS event_counts
    FROM (
      SELECT user_id, event_type, count(*) AS n, max(created_at) AS mx,
             count(*) FILTER (WHERE created_at > now() - interval '7 days') AS n7,
             count(*) FILTER (WHERE created_at > now() - interval '30 days') AS n30
      FROM events GROUP BY user_id, event_type
    ) per_type
    GROUP BY user_id
  ) ev ON ev.user_id = u.id
  LEFT JOIN (
    SELECT user_id,
           count(*) FILTER (WHERE lesson_id NOT LIKE '${UNLOCK_PREFIX}%') AS lessons_done,
           count(*) FILTER (WHERE lesson_id LIKE '${UNLOCK_PREFIX}%') AS checkpoints_passed,
           max(completed_at) AS last_progress
    FROM course_progress GROUP BY user_id
  ) cp ON cp.user_id = u.id
  LEFT JOIN (
    SELECT user_id, count(*) AS deals_saved FROM saved_deals GROUP BY user_id
  ) sd ON sd.user_id = u.id
  LEFT JOIN (
    SELECT DISTINCT user_id FROM trial_requests WHERE product = 'dealfinder'
  ) tr ON tr.user_id = u.id
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, winner, answers, low_fidelity
    FROM quiz_results ORDER BY user_id, created_at DESC
  ) q ON q.user_id = u.id
`;

function decorate(row) {
  const band = qualBand(row.quiz_answers, row.quiz_low_fidelity);
  const score = scoreRow(row);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    lastSeen: row.last_seen,
    score,
    tier: tierFor({ score, band, row }),
    band,
    dfy: dfySignal(row.quiz_answers),
    quizWinner: row.quiz_winner || null,
    lessonsDone: Number(row.lessons_done) || 0,
    coursePct: Math.min(
      100,
      Math.round(((Number(row.lessons_done) || 0) / COURSE_TOTAL_LESSONS) * 100)
    ),
    checkpointsPassed: Number(row.checkpoints_passed) || 0,
    dealsSaved: Number(row.deals_saved) || 0,
    trialRequested: !!row.trial_requested,
    calendarClicks: Number(row.event_counts?.calendar_click) || 0,
    // Heartbeats fire every 2 visible-active minutes; count x2 = minutes.
    activeMinutes: (Number(row.event_counts?.heartbeat) || 0) * 2,
    events7d: Number(row.events_7d) || 0,
    signals: signalsFor(row),
  };
}

export function registerAdminRoutes(app, { authRequired, adminRequired, isAdminEmail }) {
  app.get('/api/admin/users', authRequired, adminRequired, async (_req, res) => {
    const { rows } = await pool.query(USERS_AGG_SQL);
    // Admin accounts are operators, not leads: their own testing activity
    // must never rank at the top of the sales call list.
    const users = rows
      .filter((r) => !isAdminEmail(r.email) && !r.is_admin)
      .map(decorate)
      .sort((a, b) => b.score - a.score || a.id - b.id);
    res.json({ users: users.slice(0, 2000), total: users.length });
  });

  app.get('/api/admin/users/:id', authRequired, adminRequired, async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await pool.query(`${USERS_AGG_SQL} WHERE u.id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const user = decorate(rows[0]);

    const [events, progress, quiz] = await Promise.all([
      pool.query(
        `SELECT event_type, payload, session_id, created_at FROM events
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 300`,
        [id]
      ),
      pool.query(
        `SELECT lesson_id, completed_at FROM course_progress
         WHERE user_id = $1 ORDER BY completed_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT answers, answer_labels, totals, winner, low_fidelity, created_at
         FROM quiz_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [id]
      ),
    ]);

    res.json({
      user,
      timeline: events.rows,
      progress: progress.rows,
      quiz: quiz.rows[0] || null,
    });
  });
}
