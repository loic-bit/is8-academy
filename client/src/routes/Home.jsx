import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import ProgressRing from '../components/ProgressRing.jsx';
import { ALL_LESSONS, TOTAL_LESSONS, LEVELS, levelOpen } from '../content/course.js';
import { rankFor } from '../content/checkpoints.js';

const TILES = [
  { to: '/course', icon: '🎓', title: 'The Course', desc: 'Three levels: believe it, do it, scale it.' },
  { to: '/vault', icon: '🧰', title: 'Toolkit', desc: 'Six calculators and quizzes, plus every checklist in six kits.' },
  { to: '/quiz', icon: '🧭', title: 'Readiness Quiz', desc: 'Your investor profile and next three moves, in two minutes.' },
  { to: '/compare', icon: '⚖️', title: 'Strategy Comparison', desc: 'Airbnb vs flips vs ADUs vs Section 8, honestly.' },
  { to: '/calculators', icon: '🧮', title: 'Deal Calculator', desc: 'Cash flow, cash-on-cash, and cap rate in seconds.' },
  { to: '/fifty-doors', icon: '🚪', title: 'Path to 50 Doors', desc: 'See how deal quality, not salary, sets your timeline.' },
];

export default function Home() {
  const { user } = useAuth();
  const [completed, setCompleted] = useState(new Set());
  const [dealsCount, setDealsCount] = useState(0);
  const [quizDone, setQuizDone] = useState(true); // assume done until we know

  useEffect(() => {
    api('/progress').then((d) => setCompleted(new Set(d.completed))).catch(() => {});
    api('/deals').then((d) => setDealsCount((d.deals || []).length)).catch(() => {});
    api('/quiz/me').then((d) => setQuizDone(!!d.result)).catch(() => {});
  }, []);

  const done = [...completed].filter((id) => !id.startsWith('unlock-')).length;
  const pct = Math.round((done / TOTAL_LESSONS) * 100);
  const rank = rankFor(completed);
  const next = ALL_LESSONS.find(
    (l) => !completed.has(l.id) && levelOpen(LEVELS.find((lv) => lv.key === l.levelKey), completed)
  );
  const firstName = user?.name?.split(' ')[0] || 'investor';

  return (
    <div>
      <div className="mb-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">Welcome back, {firstName}</div>
      <p className="mb-8 text-slate-500">Here is where you are and your next step toward owning doors.</p>

      {!quizDone && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand/5">
          <div className="min-w-0">
            <div className="eyebrow mb-1">🧭 Start here</div>
            <div className="font-display text-lg font-bold">Take the 2-minute Readiness Quiz</div>
            <p className="text-sm text-slate-500">
              It reads your capital, time, and experience, then hands you your investor profile and your first three moves.
            </p>
          </div>
          <Link to="/quiz" className="btn-primary !py-2 text-sm">Start the quiz →</Link>
        </div>
      )}

      {/* Rank + continue hero */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card flex items-center gap-5 bg-gradient-to-br from-white to-slate-50 lg:col-span-2">
          <ProgressRing value={pct} size={92} stroke={9} />
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1">{rank.icon} {rank.name} · Level {rank.level} of 3</div>
            {next ? (
              <>
                <div className="text-sm text-slate-500">Continue where you left off</div>
                <div className="truncate font-display text-lg font-bold">{next.title}</div>
                <Link to="/course" className="btn-primary mt-3 !py-2 text-sm">Resume the course →</Link>
              </>
            ) : (
              <>
                <div className="font-display text-lg font-bold">Every open lesson is done. 🎉</div>
                <div className="text-sm text-slate-500">Pass your next checkpoint to rank up, or put the plan to work.</div>
                <Link to="/course" className="btn-primary mt-3 !py-2 text-sm">Open the course →</Link>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
          <Stat value={`${done}/${TOTAL_LESSONS}`} label="Lessons done" />
          <Stat value={rank.name} label="Current rank" small />
          <Stat value={dealsCount} label="Deals saved" />
        </div>
      </div>

      {/* Quick access */}
      <div className="eyebrow mb-3">Jump back in</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="card card-hover">
            <div className="mb-3 text-2xl">{t.icon}</div>
            <h3 className="font-display font-bold">{t.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{t.desc}</p>
          </Link>
        ))}
      </div>

      {/* AI Deal Finder */}
      <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-slate-800 to-brand-dark p-6 text-white sm:p-8">
        <div className="eyebrow mb-1 text-brand-light">✨ AI Deal Finder</div>
        <h3 className="font-display text-xl font-bold tracking-tight">Never run out of deals to analyze</h3>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/75">
          It scans listings against Section 8 rents and your buy box, then hands you a ranked feed of candidates daily. 30-day free trial, then $25 a month.
        </p>
        <Link to="/finder" className="btn mt-4 bg-white text-ink hover:bg-slate-100">See how it works</Link>
      </div>

      {/* Work with us */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-brand p-6 text-white sm:p-8">
        <div className="eyebrow mb-1 text-white/70">Ready to move faster?</div>
        <h3 className="font-display text-xl font-bold tracking-tight">Get 1-on-1 help or let our team do it for you</h3>
        <p className="mt-1 max-w-xl text-sm text-white/80">
          You have the tools and the training. When you want a proven team in your corner, we map the fastest path to your next deal.
        </p>
        <Link to="/get-help" className="btn mt-4 bg-white text-brand hover:bg-slate-100">See your options</Link>
      </div>
    </div>
  );
}

function Stat({ value, label, small }) {
  return (
    <div className="stat">
      <div className={`stat-value ${small ? '!text-lg' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
