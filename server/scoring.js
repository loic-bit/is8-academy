// Lead scoring: the single source of truth for engagement weights,
// qualification bands, and priority tiers. Both the admin dashboard and any
// CRM mirror MUST consume these functions so the numbers can never disagree.

// Course catalog facts the server needs. The client truth lives in
// client/src/content/course.js (not shippable into the server image), so the
// values are pinned here ONCE for all server consumers. Update BOTH places
// when the course is restructured.
export const COURSE_TOTAL_LESSONS = 45;
export const UNLOCK_PREFIX = 'unlock-';
export const VALID_UNLOCKS = new Set(['unlock-operator', 'unlock-portfolio']);
// Real lesson ids look like mal3 / mbl1 / m4l2.
export const LESSON_ID_RE = /^(ma|mb|m[1-8])l\d{1,2}$/;

// Client + server event types accepted by POST /api/events. Types not listed
// here are rejected at ingest so the events table stays queryable.
export const EVENT_TYPES = new Set([
  'page_view',
  'heartbeat',
  'lesson_open',
  'module_open',
  'lesson_complete',
  'lesson_uncomplete',
  'resource_click',
  'vault_asset_open',
  'kit_open',
  'vault_search',
  'tool_state',
  'deal_saved',
  'deal_deleted',
  'listing_click',
  'compare_expand',
  'quiz_completed',
  'quiz_retake',
  'checkpoint_result',
  'checkpoint_claimed',
  'checkpoint_retake',
  'finder_trial_click',
  'calendar_click',
  'video_progress',
  'welcome_modal',
  'login',
  'signup',
]);

// Per-event weights with per-user caps (total contribution from that type).
// High-intent actions dominate by design: a calendar click beats fifty page
// views. Tune here, redeploy, every consumer updates at once.
// finder_trial_click deliberately carries NO weight: the trial fact scores
// once from the trial_requests table (BASE.trialRequested); the event exists
// for the timeline only. One fact, one source.
const W = {
  calendar_click: { pts: 30, cap: 60 },
  checkpoint_result: { pts: 5, cap: 10 }, // attempts show effort even w/o pass
  quiz_retake: { pts: 2, cap: 4 },
  video_progress: { pts: 2, cap: 40 },
  lesson_open: { pts: 1, cap: 20 },
  resource_click: { pts: 1, cap: 10 },
  vault_asset_open: { pts: 2, cap: 20 },
  kit_open: { pts: 1, cap: 6 },
  tool_state: { pts: 1, cap: 15 },
  compare_expand: { pts: 0.5, cap: 4 },
  listing_click: { pts: 2, cap: 8 },
  page_view: { pts: 0.2, cap: 15 },
  heartbeat: { pts: 0.1, cap: 20 },
};

// Baseline weights from durable tables. These make the launch-day ranking
// real for accounts that existed before event tracking shipped.
const BASE = {
  lessonDone: 3, // course_progress rows (non-unlock)
  checkpointPassed: 15, // unlock-* rows
  dealSaved: 5,
  trialRequested: 25,
  quizCompleted: 10,
};

// row: aggregate per user (see admin.js query). Returns 0-100+ score.
export function scoreRow(row) {
  let pts = 0;
  pts += Math.min(Number(row.lessons_done) || 0, COURSE_TOTAL_LESSONS) * BASE.lessonDone;
  pts += (Number(row.checkpoints_passed) || 0) * BASE.checkpointPassed;
  pts += Math.min(Number(row.deals_saved) || 0, 6) * BASE.dealSaved;
  if (row.trial_requested) pts += BASE.trialRequested;
  if (row.quiz_winner) pts += BASE.quizCompleted;

  const counts = row.event_counts || {};
  for (const [type, cfg] of Object.entries(W)) {
    const n = Number(counts[type]) || 0;
    if (n) pts += Math.min(n * cfg.pts, cfg.cap);
  }

  // Recency multiplier: activity in the last 7 days makes the whole score
  // hotter (up to 1.5x). A dormant binge from months ago decays naturally.
  const recent = Number(row.events_7d) || 0;
  const mult = 1 + Math.min(recent, 20) / 40;
  return Math.round(pts * mult);
}

// Financial qualification from the latest full quiz answers.
// Answer indexes are quiz.js option positions (0-3):
//   capital: <10K / 10-25K / 25-60K / 60K+
//   monthly: ~0 / few hundred / 1-3K / 3K+
//   income:  unpredictable / tight / room to save / high+secure
//   drawdown: can't absorb 8K / reserves absorb / minor / budgeted
export function qualBand(answers, lowFidelity) {
  if (!answers || lowFidelity || answers.capital === undefined) {
    return { code: 'U', label: 'Unknown' };
  }
  const a = answers;
  const cap = Number(a.capital);
  const monthly = Number(a.monthly ?? 0);
  const income = Number(a.income ?? 0);
  const drawdown = Number(a.drawdown ?? 0);
  if (cap >= 2 && drawdown >= 1) return { code: 'A', label: '$25K+ ready' };
  if (cap >= 2) return { code: 'A-', label: '$25K+, thin reserves' };
  if (cap === 1 && (monthly >= 2 || income >= 2)) return { code: 'B', label: '$10-25K + saving' };
  if (cap === 1) return { code: 'B-', label: '$10-25K' };
  if (monthly >= 2) return { code: 'C', label: 'Building fast' };
  return { code: 'D', label: 'Not yet funded' };
}

// True when quiz answers signal done-for-you / high-ticket appetite.
export function dfySignal(answers) {
  if (!answers) return false;
  return Number(answers.style) === 2 || Number(answers.goal) === 2;
}

// Priority tier for the call list.
export function tierFor({ score, band, row }) {
  const counts = row.event_counts || {};
  const activeWeek = (Number(row.events_7d) || 0) > 0;
  const clickedCalendar = (Number(counts.calendar_click) || 0) > 0;
  const qualified = ['A', 'A-', 'B'].includes(band.code);

  if (clickedCalendar || row.trial_requested || (score >= 60 && activeWeek && qualified)) {
    return 'HOT';
  }
  if (score >= 30 && (activeWeek || (Number(row.events_30d) || 0) > 0)) return 'WARM';
  if (score >= 10) return 'NURTURE';
  return 'COLD';
}

// The compact "why call them" signals string used by the dashboard and CRM.
export function signalsFor(row) {
  const c = row.event_counts || {};
  const out = [];
  if (Number(c.calendar_click)) out.push(`clicked booking link x${c.calendar_click}`);
  if (row.trial_requested) out.push('AI trial requested');
  if (Number(row.checkpoints_passed) >= 2) out.push('finished both checkpoints');
  else if (Number(row.checkpoints_passed) === 1) out.push('passed checkpoint 1');
  if (row.quiz_winner) out.push(`quiz: ${row.quiz_winner}`);
  if (Number(row.deals_saved)) out.push(`${row.deals_saved} deals saved`);
  if (Number(c.video_progress)) out.push('watching videos');
  return out.slice(0, 4).join(' · ');
}
