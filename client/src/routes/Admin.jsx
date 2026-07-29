import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { relTime } from '../lib/format.js';
import PageHeader from '../components/PageHeader.jsx';

const TIERS = ['HOT', 'WARM', 'NURTURE', 'COLD'];
const BANDS = ['A', 'A-', 'B', 'B-', 'C', 'D', 'U'];
const SORTS = [
  { key: 'score', label: 'Score' },
  { key: 'lastSeen', label: 'Last seen' },
  { key: 'createdAt', label: 'Joined' },
  { key: 'coursePct', label: 'Course %' },
  { key: 'minutes', label: 'Minutes' },
];

const TIER_CHIP = {
  HOT: 'bg-danger-soft text-danger',
  WARM: 'bg-warning-soft text-warning',
  NURTURE: 'bg-brand/10 text-brand',
  COLD: 'bg-slate-100 text-slate-500',
};

const shortDate = (input) =>
  input
    ? new Date(input).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '-';

// Human names for the checkpoint unlock ids carried in event payloads.
const CHECKPOINT_NAMES = { 'unlock-operator': 'Foundation', 'unlock-portfolio': 'Portfolio' };

// Humanized timeline labels per event type.
const EVENT_LABELS = {
  page_view: (p) => `Viewed ${p.path || 'a page'}`,
  heartbeat: () => 'Active on the platform',
  lesson_open: (p) => `Opened lesson${p.lessonId ? `: ${p.lessonId}` : ''}`,
  module_open: (p) => `Opened module${p.moduleId ? `: ${p.moduleId}` : ''}`,
  lesson_complete: (p) => `Completed lesson${p.lessonId ? `: ${p.lessonId}` : ''}`,
  lesson_uncomplete: (p) => `Unmarked lesson${p.lessonId ? `: ${p.lessonId}` : ''}`,
  resource_click: (p) => `Clicked resource${p.label ? `: ${p.label}` : ''}`,
  vault_asset_open: (p) => `Opened checklist${p.slug ? `: ${p.slug}` : ''}`,
  kit_open: (p) => `Opened kit${p.slug ? `: ${p.slug}` : ''}`,
  vault_search: (p) => `Searched the toolkit${p.q ? ` for "${p.q}"` : ''}`,
  tool_state: (p) => `Used ${p.tool || 'a tool'}`,
  deal_saved: (p) => `Saved a deal${p.label ? `: ${p.label}` : ''}`,
  deal_deleted: () => 'Deleted a saved deal',
  listing_click: () => 'Opened a property listing',
  compare_expand: (p) => `Expanded comparison${p.strategy ? `: ${p.strategy}` : ''}`,
  quiz_completed: (p) => `Completed the readiness quiz${p.winner ? ` (${p.winner})` : ''}`,
  quiz_retake: () => 'Retook the readiness quiz',
  checkpoint_result: (p) => `Checkpoint ${p.passed ? 'passed' : 'attempted'}${p.checkpointId ? `: ${CHECKPOINT_NAMES[p.checkpointId] || p.checkpointId}` : ''}`,
  checkpoint_claimed: (p) => `Claimed checkpoint${p.lessonId ? `: ${CHECKPOINT_NAMES[p.lessonId] || p.lessonId}` : ''}`,
  checkpoint_retake: () => 'Retook a checkpoint',
  finder_trial_click: () => 'Requested the Deal Finder trial',
  calendar_click: () => 'Clicked booking link',
  video_progress: (p) => `Watched video to ${p.pct != null ? `${p.pct}%` : 'a milestone'}`,
  login: () => 'Logged in',
  signup: () => 'Created account',
};

function eventLabel(type, payload) {
  const fn = EVENT_LABELS[type];
  if (fn) return fn(payload || {});
  return type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function payloadDetail(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return Object.entries(payload)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
    .slice(0, 120);
}

function MiniBar({ pct, className = '' }) {
  return (
    <div className={`h-1 rounded-full bg-slate-100 ${className}`}>
      <div
        className="h-1 rounded-full bg-brand"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function TierChip({ tier }) {
  return (
    <span className={`badge ${TIER_CHIP[tier] || 'bg-slate-100 text-slate-500'}`}>{tier}</span>
  );
}

function LeadDrawer({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null);
    setError(false);
    api(`/admin/users/${id}`)
      .then(setData)
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const days = useMemo(() => {
    const byDay = new Map();
    for (const ev of data?.timeline || []) {
      const day = new Date(ev.created_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(ev);
    }
    return [...byDay.entries()];
  }, [data]);

  const u = data?.user;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-lg">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-bold">{u?.name || 'Loading…'}</div>
              <div className="truncate text-sm text-slate-400">{u?.email}</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          </div>
          {u && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge-brand num">Score {u.score}</span>
              <TierChip tier={u.tier} />
              <span className="badge-muted">
                {u.band?.code} · {u.band?.label}
              </span>
              {u.dfy && (
                <span title="DFY signal" aria-label="DFY signal">
                  💎
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {error ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Could not load this lead. Close and retry.
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-slate-400">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <DrawerStat value={u.lessonsDone} label="Lessons" />
                <DrawerStat value={u.checkpointsPassed} label="Checkpoints" />
                <DrawerStat value={u.dealsSaved} label="Deals" />
                <DrawerStat value={u.activeMinutes} label="Minutes" />
                <DrawerStat value={u.events7d} label="Events 7d" />
                <DrawerStat value={shortDate(u.createdAt)} label="Joined" small />
              </div>

              <section>
                <div className="eyebrow mb-2">Quiz answers</div>
                {!data.quiz ? (
                  <p className="text-sm text-slate-400">No quiz taken yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.quiz.winner && (
                      <p className="text-sm text-slate-500">
                        Profile: <span className="font-semibold text-ink">{data.quiz.winner}</span>
                      </p>
                    )}
                    {data.quiz.low_fidelity && (
                      <p className="text-xs text-warning">
                        Low-fidelity result: synced from a pre-login session, treat answers as approximate.
                      </p>
                    )}
                    {Object.entries(data.quiz.answer_labels || {}).map(([k, v]) => {
                      const obj = v && typeof v === 'object';
                      return (
                        <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="text-xs text-slate-400">{obj ? v.q || v.question || k : k}</div>
                          <div className="text-sm font-medium">{obj ? String(v.a ?? v.answer ?? '') : String(v)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="eyebrow mb-2">Timeline</div>
                {days.length === 0 ? (
                  <p className="text-sm text-slate-400">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {days.map(([day, events]) => (
                      <div key={day}>
                        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {day}
                        </div>
                        <div className="space-y-1">
                          {events.map((ev, i) => (
                            <div key={`${ev.created_at}-${i}`} className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                              <div className="num w-14 shrink-0 pt-px text-xs text-slate-400">
                                {new Date(ev.created_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm">{eventLabel(ev.event_type, ev.payload)}</div>
                                {payloadDetail(ev.payload) && (
                                  <div className="truncate text-xs text-slate-400">{payloadDetail(ev.payload)}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function DrawerStat({ value, label, small }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 text-center">
      <div className={`font-display num font-bold ${small ? 'text-sm leading-6' : 'text-lg'}`}>{value}</div>
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('');
  const [band, setBand] = useState('');
  const [sort, setSort] = useState('score');
  const [dir, setDir] = useState('desc');
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    if (!isAdmin) return;
    api('/admin/users')
      .then((d) => {
        setUsers(d.users);
        setTotal(d.total);
      })
      .catch(() => setFailed(true));
  }, [isAdmin]);

  // Stat tiles are derived client-side from the same payload as the table.
  const overview = useMemo(() => {
    if (!users) return null;
    return {
      users: total,
      active7d: users.filter((u) => u.events7d > 0).length,
      trials: users.filter((u) => u.trialRequested).length,
      quizzed: users.filter((u) => u.quizWinner).length,
      hot: users.filter((u) => u.tier === 'HOT').length,
      avgCoursePct: users.length
        ? Math.round(users.reduce((n, u) => n + u.coursePct, 0) / users.length)
        : 0,
    };
  }, [users, total]);

  const rows = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    let out = users;
    if (q) out = out.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q));
    if (tier) out = out.filter((u) => u.tier === tier);
    if (band) out = out.filter((u) => u.band?.code === band);
    const mul = dir === 'asc' ? 1 : -1;
    const val = (u) =>
      sort === 'lastSeen' ? (u.lastSeen ? Date.parse(u.lastSeen) : 0)
      : sort === 'createdAt' ? Date.parse(u.createdAt) || 0
      : sort === 'coursePct' ? u.coursePct
      : sort === 'minutes' ? u.activeMinutes
      : u.score;
    return [...out].sort((a, b) => (val(a) - val(b)) * mul || a.id - b.id);
  }, [users, query, tier, band, sort, dir]);

  const maxScore = useMemo(() => Math.max(1, ...rows.map((u) => u.score || 0)), [rows]);
  const visible = showAll ? rows : rows.slice(0, 200);

  if (!isAdmin) return <Navigate to="/" replace />;

  const loading = !failed && !users;

  return (
    <div>
      <PageHeader
        title="Admin · Lead Activity"
        subtitle="Every account ranked by engagement and financial qualification. Call from the top."
      />

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : failed ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-display font-bold">Could not load lead activity</p>
          <p className="mt-1.5 text-sm text-slate-500">Check your connection and refresh to retry.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat value={overview.users} label="Users" />
            <Stat value={overview.active7d} label="Active 7d" />
            <Stat value={overview.hot} label="HOT leads" />
            <Stat value={overview.trials} label="Trials" />
            <Stat value={overview.quizzed} label="Quizzed" />
            <Stat value={`${overview.avgCoursePct}%`} label="Avg course" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="field !w-56"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setTier('')} className={`chip ${tier === '' ? 'chip-active' : ''}`}>
                All
              </button>
              {TIERS.map((t) => (
                <button key={t} onClick={() => setTier(t)} className={`chip ${tier === t ? 'chip-active' : ''}`}>
                  {t}
                </button>
              ))}
            </div>
            <select value={band} onChange={(e) => setBand(e.target.value)} className="field !w-auto" aria-label="Band">
              <option value="">All bands</option>
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  Band {b}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="field !w-auto" aria-label="Sort by">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="btn-ghost !px-3"
              aria-label={`Direction: ${dir === 'desc' ? 'descending' : 'ascending'}`}
              title={dir === 'desc' ? 'Descending' : 'Ascending'}
            >
              {dir === 'desc' ? '↓' : '↑'}
            </button>
            <div className="num ml-auto text-sm text-slate-400">
              {rows.length} of {users.length}
            </div>
          </div>

          <div className="card !p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Lead</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Tier</th>
                    <th className="px-4 py-3 font-semibold">Band</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Trial</th>
                    <th className="px-4 py-3 font-semibold">Cal</th>
                    <th className="px-4 py-3 font-semibold">Min</th>
                    <th className="px-4 py-3 font-semibold">Last seen</th>
                    <th className="px-4 py-3 font-semibold">Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        No leads match these filters.
                      </td>
                    </tr>
                  ) : (
                    visible.map((u, i) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedId(u.id)}
                        className="cursor-pointer border-b border-slate-100 transition duration-160 ease-premium last:border-0 hover:bg-slate-50"
                      >
                        <td className="num px-4 py-3 text-slate-400">{i + 1}</td>
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="truncate font-medium text-ink">{u.name}</div>
                          <div className="truncate text-xs text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="num font-display font-bold">{u.score}</div>
                          <MiniBar pct={(u.score / maxScore) * 100} className="mt-1 w-16" />
                        </td>
                        <td className="px-4 py-3">
                          <TierChip tier={u.tier} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold">{u.band?.code}</span>
                          {u.dfy && (
                            <span className="ml-1" title="DFY signal" aria-label="DFY signal">
                              💎
                            </span>
                          )}
                          <div className="text-xs text-slate-400">{u.band?.label}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="num text-xs text-slate-500">{u.coursePct}%</div>
                          <MiniBar pct={u.coursePct} className="mt-1 w-14" />
                        </td>
                        <td className="px-4 py-3">
                          {u.trialRequested ? (
                            <span className="font-semibold text-success">✓</span>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="num px-4 py-3">
                          {u.calendarClicks > 0 ? (
                            <span className="font-semibold text-success">✓ {u.calendarClicks}</span>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="num px-4 py-3 text-slate-500">{u.activeMinutes}</td>
                        <td className="num whitespace-nowrap px-4 py-3 text-slate-500">
                          {u.lastSeen ? relTime(u.lastSeen, { compact: true }) : '-'}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-xs text-slate-500">{u.signals}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!showAll && rows.length > visible.length && (
              <div className="border-t border-slate-100 p-4 text-center">
                <button onClick={() => setShowAll(true)} className="btn-ghost !py-2 text-sm">
                  Show all {rows.length} leads
                </button>
              </div>
            )}
          </div>

          <AdminsCard />
        </>
      )}

      {selectedId != null && <LeadDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat !p-4">
      <div className="stat-value !text-xl">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// Quiet ops corner: who can see this dashboard. Root admins come from the
// server config; managed admins are flipped via POST /admin/admins.
function AdminsCard() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    return api('/admin/admins')
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function change(targetEmail, isAdmin) {
    setError('');
    setBusy(true);
    try {
      await api('/admin/admins', { method: 'POST', body: { email: targetEmail, isAdmin } });
      if (isAdmin) setEmail('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-6 max-w-xl">
      <div className="eyebrow mb-1">Admins</div>
      <p className="mb-4 text-sm text-slate-500">Who can see this dashboard.</p>

      {failed ? (
        <p className="text-sm text-slate-400">Could not load the admin list. Refresh to retry.</p>
      ) : !data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="label">Root · managed in server config</div>
            <div className="flex flex-wrap gap-1.5">
              {data.root.map((e) => (
                <span key={e} className="chip !cursor-default !py-1 text-xs">
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Managed</div>
            {data.managed.length === 0 ? (
              <p className="text-sm text-slate-400">No managed admins yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.managed.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                      <div className="truncate text-xs text-slate-400">{a.email}</div>
                    </div>
                    <button
                      onClick={() => change(a.email, false)}
                      disabled={busy}
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) change(email.trim(), true);
            }}
            className="flex gap-2"
          >
            <input
              type="email"
              className="field"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn-ghost whitespace-nowrap" disabled={busy}>
              Add admin
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
