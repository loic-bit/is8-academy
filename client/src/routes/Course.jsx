import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { track, trackNow } from '../lib/track.js';
import PageHeader from '../components/PageHeader.jsx';
import ContentBlocks from '../components/ContentBlocks.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import Checkpoint from '../components/Checkpoint.jsx';
import { LEVELS, TOTAL_LESSONS, levelOpen } from '../content/course.js';
import { LESSON_META } from '../content/lessonMeta.js';
import { rankFor } from '../content/checkpoints.js';

const MENTORSHIP_URL =
  import.meta.env.VITE_MENTORSHIP_URL || 'https://go.investingsection8.com/df82de5b';

const moduleMinutes = (m) => m.lessons.reduce((n, l) => n + (l.minutes || 0), 0);

function toEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const ws = url.match(/wistia\.(?:com|net)\/(?:medias|embed\/iframe|embed\/medias)\/([\w]+)/);
  if (ws) return `https://fast.wistia.net/embed/iframe/${ws[1]}?videoFoam=true`;
  return url;
}

// Lazy, once-per-page load of the YouTube iframe API. Resolves with window.YT.
let ytApiPromise = null;
function loadYouTubeApi() {
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

const VIDEO_MILESTONES = [25, 50, 75, 95];

// Quartiles fire once per lesson per session: the iframe remounts every time
// a lesson is re-expanded, but this map survives, so no duplicate events.
const firedMilestones = new Map(); // lessonId -> Set of fired milestone pcts

function VideoFrame({ video, title, lessonId }) {
  const src = toEmbed(video);
  const isYouTube = !!src && src.includes('youtube.com/embed/');
  const frameSrc = isYouTube ? `${src}${src.includes('?') ? '&' : '?'}enablejsapi=1` : src;
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isYouTube || !frameRef.current) return;
    let cancelled = false;
    let player = null;
    let interval = null;
    let fired = firedMilestones.get(lessonId);
    if (!fired) {
      fired = new Set();
      firedMilestones.set(lessonId, fired);
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    try {
      loadYouTubeApi()
        .then((YT) => {
          if (cancelled || !YT || !frameRef.current) return;
          player = new YT.Player(frameRef.current, {
            events: {
              onStateChange: (e) => {
                try {
                  if (e.data !== YT.PlayerState.PLAYING) return stopPolling();
                  if (interval) return;
                  interval = setInterval(() => {
                    try {
                      const duration = player.getDuration();
                      if (!duration) return;
                      const pct = (player.getCurrentTime() / duration) * 100;
                      for (const m of VIDEO_MILESTONES) {
                        if (pct >= m && !fired.has(m)) {
                          fired.add(m);
                          track('video_progress', { lessonId, pct: m });
                        }
                      }
                    } catch {
                      /* player gone mid-poll */
                    }
                  }, 5000);
                } catch {
                  /* never let the player break the lesson */
                }
              },
            },
          });
        })
        .catch(() => {});
    } catch {
      /* never let the player break the lesson */
    }

    return () => {
      cancelled = true;
      stopPolling();
      try {
        if (player) player.destroy();
      } catch {
        /* player already gone */
      }
    };
  }, [isYouTube, src, lessonId]);

  if (!src) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 text-center text-white/90">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="mt-3 text-sm font-semibold">Video lesson coming soon</div>
        <div className="mt-0.5 text-xs text-white/60">We are recording this module now.</div>
      </div>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-black">
      <iframe
        ref={frameRef}
        src={frameSrc}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

// Quiet mentor footnote under a lesson. Linkifies the phrase "free game plan
// call" inside the note; lessons whose meta has no mentorNote render nothing.
function MentorNote({ note, lessonId }) {
  if (!note) return null;
  const phrase = 'free game plan call';
  const i = note.lastIndexOf(phrase);
  return (
    <p className="mt-6 text-sm italic leading-relaxed text-slate-500">
      {i === -1 ? (
        note
      ) : (
        <>
          {note.slice(0, i)}
          <a
            href={MENTORSHIP_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackNow('calendar_click', { which: 'lesson-' + lessonId, href: MENTORSHIP_URL })}
            className="font-medium text-brand hover:underline"
          >
            {phrase}
          </a>
          {note.slice(i + phrase.length)}
        </>
      )}
    </p>
  );
}

function ResourceList({ resources, lessonId }) {
  if (!resources || resources.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="eyebrow mb-2">Resources</div>
      <div className="flex flex-col gap-2">
        {resources.map((r) => (
          <Link
            key={r.to + r.label}
            to={r.to}
            onClick={() => track('resource_click', { lessonId, to: r.to, kind: r.kind })}
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm transition duration-160 ease-premium hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2.5">
              <span className="text-slate-400 group-hover:text-brand">↗</span>
              <span className="font-medium text-ink">{r.label}</span>
            </span>
            {r.kind && <span className="badge-muted">{r.kind}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Course() {
  const [completed, setCompleted] = useState(new Set());
  const [openModule, setOpenModule] = useState(null);
  const [openLesson, setOpenLesson] = useState(null);
  const [checkpointOpen, setCheckpointOpen] = useState(null); // 'operator' | 'portfolio'
  const [celebrate, setCelebrate] = useState(null); // rank name just earned

  useEffect(() => {
    api('/progress')
      .then((d) => {
        const set = new Set(d.completed);
        setCompleted(set);
        // Open the first module of the member's current level by default.
        const current = LEVELS.find((lv) => levelOpen(lv, set) && lv.modules.some((m) => m.lessons.some((l) => !set.has(l.id))));
        setOpenModule((current || LEVELS[0]).modules[0].id);
      })
      .catch(() => setOpenModule(LEVELS[0].modules[0].id));
  }, []);

  async function toggle(lessonId) {
    const isDone = completed.has(lessonId);
    setCompleted((prev) => {
      const next = new Set(prev);
      isDone ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });
    try {
      if (isDone) await api(`/progress/${encodeURIComponent(lessonId)}`, { method: 'DELETE' });
      else await api('/progress', { method: 'POST', body: { lessonId } });
    } catch {
      /* optimistic; reconciles on reload */
    }
  }

  function onCheckpointPassed(cp) {
    setCompleted((prev) => new Set(prev).add(cp.id));
    setCheckpointOpen(null);
    setCelebrate(cp.toRank);
  }

  const doneCount = [...completed].filter((id) => !id.startsWith('unlock-')).length;
  const pct = Math.round((doneCount / TOTAL_LESSONS) * 100);
  const rank = rankFor(completed);

  return (
    <div>
      <PageHeader
        title="The Cashflow 2.0 Method"
        subtitle="Three levels. Each one leads into the next: believe it, do it, scale it."
      />

      {celebrate && (
        <div className="card mb-6 flex items-center justify-between gap-4 border-brand/40 bg-brand/5">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🎉</span>
            <div>
              <div className="eyebrow">Rank up</div>
              <div className="font-display text-lg font-bold">You are now a {celebrate}.</div>
              <p className="text-sm text-slate-500">The next level is open. Keep the momentum.</p>
            </div>
          </div>
          <button onClick={() => setCelebrate(null)} className="text-slate-300 hover:text-slate-500" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Progress hero */}
      <div className="card mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <ProgressRing value={pct} size={84} stroke={9} />
        <div className="flex-1">
          <div className="eyebrow mb-1">Your rank</div>
          <div className="font-display text-lg font-bold">{rank.icon} {rank.name}</div>
          <div className="mt-1 text-sm text-slate-500">{doneCount} of {TOTAL_LESSONS} lessons · level {rank.level} of 3</div>
        </div>
      </div>

      {/* Levels */}
      <div className="space-y-8">
        {LEVELS.map((lv, li) => {
          const isOpen = levelOpen(lv, completed);
          const lvLessons = lv.modules.flatMap((m) => m.lessons);
          const lvDone = lvLessons.filter((l) => completed.has(l.id)).length;
          const nextLevel = LEVELS[li + 1];
          const showCheckpointCard = lv.checkpoint && nextLevel && !levelOpen(nextLevel, completed);

          return (
            <section key={lv.key}>
              {/* Level header */}
              <div className="mb-3 flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${isOpen ? 'bg-brand/10' : 'bg-slate-100 grayscale'}`}>{lv.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="eyebrow">Level {lv.num}</span>
                    <span className="font-display font-bold">{lv.name}</span>
                    <span className="badge-muted">{isOpen ? `${lvDone}/${lvLessons.length}` : 'Locked'}</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{lv.tagline}</p>
                </div>
              </div>

              {!isOpen ? (
                <div className="card border-dashed">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔒</span>
                      <div>
                        <div className="font-display text-sm font-bold">Pass the {LEVELS[li - 1].name} checkpoint to enter</div>
                        <p className="text-xs text-slate-400">Finish the lessons below it, or fast-track: take the checkpoint cold if you already know this.</p>
                      </div>
                    </div>
                    <button onClick={() => setCheckpointOpen(lv.unlock === 'unlock-operator' ? 'operator' : 'portfolio')} className="btn-ghost shrink-0 !py-2 text-sm">
                      Take the checkpoint
                    </button>
                  </div>
                  {checkpointOpen && ((lv.unlock === 'unlock-operator' && checkpointOpen === 'operator') || (lv.unlock === 'unlock-portfolio' && checkpointOpen === 'portfolio')) && (
                    <div className="mt-4">
                      <Checkpoint ckey={checkpointOpen} onPassed={onCheckpointPassed} onClose={() => setCheckpointOpen(null)} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {lv.modules.map((m) => {
                    const isModuleOpen = openModule === m.id;
                    const moduleDone = m.lessons.filter((l) => completed.has(l.id)).length;
                    const mPct = Math.round((moduleDone / m.lessons.length) * 100);
                    return (
                      <div key={m.id} className="card !p-0 overflow-hidden">
                        <button
                          onClick={() => {
                            if (!isModuleOpen) track('module_open', { moduleId: m.id });
                            setOpenModule(isModuleOpen ? '' : m.id);
                          }}
                          className="flex w-full items-center gap-4 px-5 py-4 text-left transition duration-160 ease-premium hover:bg-slate-50/70 sm:px-6"
                        >
                          <ProgressRing value={mPct} size={46} stroke={5} className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-bold">{m.title}</div>
                            {m.tagline && <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{m.tagline}</div>}
                          </div>
                          <div className="hidden shrink-0 text-right sm:block">
                            <div className="num text-xs font-semibold text-slate-500">{moduleDone}/{m.lessons.length} done</div>
                            <div className="num text-xs text-slate-300">{moduleMinutes(m)} min</div>
                          </div>
                          <span className="shrink-0 text-lg text-slate-300">{isModuleOpen ? '−' : '+'}</span>
                        </button>

                        {isModuleOpen && (
                          <ul className="border-t border-slate-100">
                            {m.lessons.map((l) => {
                              const isDone = completed.has(l.id);
                              const isExpanded = openLesson === l.id;
                              const meta = LESSON_META[l.id] || { video: l.video || null, description: l.description, resources: l.resources };
                              return (
                                <li key={l.id} className="border-b border-slate-50 last:border-0">
                                  <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition duration-160 ease-premium hover:bg-slate-50/60 sm:px-6">
                                    <button
                                      onClick={() => {
                                        if (!isExpanded) track('lesson_open', { lessonId: l.id, moduleId: m.id, levelKey: lv.key });
                                        setOpenLesson(isExpanded ? null : l.id);
                                      }}
                                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                    >
                                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition duration-160 ${isDone ? 'bg-brand text-white' : 'border border-slate-300 text-transparent'}`}>✓</span>
                                      <span className={`truncate ${isDone ? 'text-slate-400' : 'font-medium'}`}>{l.title}</span>
                                      {l.minutes && <span className="num shrink-0 text-xs text-slate-300">{l.minutes} min</span>}
                                    </button>
                                    <span className="shrink-0 text-xs font-semibold text-brand">{isExpanded ? 'Hide' : 'Watch'}</span>
                                  </div>

                                  {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-6 sm:px-6">
                                      <VideoFrame video={meta.video} title={l.title} lessonId={l.id} />
                                      {meta.description && <p className="mt-5 leading-relaxed text-slate-600">{meta.description}</p>}
                                      <div className="mt-5">
                                        <ContentBlocks blocks={l.body || []} />
                                      </div>
                                      <ResourceList resources={meta.resources} lessonId={l.id} />
                                      <MentorNote note={meta.mentorNote} lessonId={l.id} />
                                      <div className="mt-6 border-t border-slate-200/70 pt-5">
                                        <button
                                          onClick={() => toggle(l.id)}
                                          className={isDone ? 'btn-ghost !py-2 text-sm text-brand' : 'btn-primary !py-2 text-sm'}
                                        >
                                          {isDone ? '✓ Completed (click to undo)' : 'Mark lesson complete'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}

                  {/* Checkpoint card at the end of the level */}
                  {showCheckpointCard && (
                    <div>
                      {checkpointOpen === lv.checkpoint ? (
                        <Checkpoint ckey={lv.checkpoint} onPassed={onCheckpointPassed} onClose={() => setCheckpointOpen(null)} />
                      ) : (
                        <div className="card flex flex-col items-start justify-between gap-4 border-brand/30 bg-gradient-to-br from-brand/5 to-transparent sm:flex-row sm:items-center">
                          <div className="flex items-center gap-4">
                            <span className="text-3xl">{nextLevel.icon}</span>
                            <div>
                              <div className="eyebrow">Checkpoint · rank up to {nextLevel.rank}</div>
                              <div className="font-display font-bold">Six questions stand between you and Level {nextLevel.num}.</div>
                              <p className="text-xs text-slate-500">
                                {lvDone}/{lvLessons.length} lessons done here. Pass 5 of 6 to advance. Retake any time.
                              </p>
                            </div>
                          </div>
                          <button onClick={() => setCheckpointOpen(lv.checkpoint)} className="btn-primary shrink-0 !py-2 text-sm">
                            Start the checkpoint →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
