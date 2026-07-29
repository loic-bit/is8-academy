import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../lib/api.js';
import { track, trackNow } from '../lib/track.js';
import PageHeader from '../components/PageHeader.jsx';
import { QUIZ, PROFILES, scoreQuiz } from '../content/quiz.js';

const STORE_KEY = 'is8_quiz_result';

const MENTORSHIP_URL =
  import.meta.env.VITE_MENTORSHIP_URL || 'https://go.investingsection8.com/df82de5b';

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    return null;
  }
};

export default function Quiz() {
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(readStored);

  useEffect(() => {
    if (result) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(result));
      } catch {
        /* storage blocked */
      }
    }
  }, [result]);

  function answer(qid, idx) {
    const next = { ...answers, [qid]: idx };
    setAnswers(next);
    if (step < QUIZ.length - 1) {
      setStep(step + 1);
    } else {
      const { winner, totals } = scoreQuiz(next);
      setResult({ winner, at: new Date().toISOString() });
      const answerLabels = {};
      for (const question of QUIZ) {
        const opt = question.options[next[question.id]];
        if (!opt) continue;
        answerLabels[question.id] = { q: question.q, a: opt.label };
      }
      // Raw fetch on purpose: the api() helper hard-redirects to /login on a
      // 401 and must never fire mid-quiz. keepalive survives a quick tab close.
      fetch('/api/quiz', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ winner, answers: next, answerLabels, totals }),
      }).catch(() => {});
    }
  }

  function retake() {
    track('quiz_retake', {});
    setAnswers({});
    setStep(0);
    setResult(null);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  }

  if (result) {
    const p = PROFILES[result.winner] || PROFILES.builder;
    return (
      <div>
        <PageHeader back={{ to: '/vault', label: 'Toolkit' }} title="Your investor profile" subtitle="Based on your capital, time, risk tolerance, and goals." />
        <div className="card mx-auto max-w-2xl">
          <div className="mb-4 flex items-center gap-4">
            <span className="text-5xl">{p.icon}</span>
            <div>
              <div className="eyebrow">You are a</div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{p.name}</h2>
            </div>
          </div>
          <p className="font-display font-bold">{p.headline}</p>
          <p className="mt-2 leading-relaxed text-slate-600">{p.desc}</p>
          <div className="mt-5">
            <div className="eyebrow mb-2">Your next three moves</div>
            <ol className="space-y-2 text-sm text-slate-600">
              {p.plan.map((step2, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{i + 1}</span>
                  <span className="leading-relaxed">{step2}</span>
                </li>
              ))}
            </ol>
          </div>
          {result.winner === 'accelerator' && (
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              Or skip a step:{' '}
              <a
                href={MENTORSHIP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackNow('calendar_click', { which: 'quiz-results-accelerator', href: MENTORSHIP_URL })}
                className="font-medium text-brand hover:underline"
              >
                book the free game plan call →
              </a>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            {p.links.map((l) => (
              <Link key={l.to} to={l.to} className="btn-primary !py-2 text-sm">{l.label} →</Link>
            ))}
            <button onClick={retake} className="btn-ghost !py-2 text-sm">Retake the quiz</button>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-slate-400">
          Educational guidance based on your answers, not financial advice.
        </p>
      </div>
    );
  }

  const q = QUIZ[step];
  const pct = Math.round((step / QUIZ.length) * 100);

  return (
    <div>
      <PageHeader
        back={{ to: '/vault', label: 'Toolkit' }}
        title="Investor Readiness Quiz"
        subtitle="Eight quick questions. Get your investor profile and the exact next moves that fit your situation."
      />
      <div className="card mx-auto max-w-2xl">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Question {step + 1} of {QUIZ.length}</span>
          <span className="num">{pct}%</span>
        </div>
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-brand transition-all duration-280 ease-premium" style={{ width: `${pct}%` }} />
        </div>
        <h2 className="font-display text-lg font-bold">{q.q}</h2>
        <div className="mt-5 space-y-2.5">
          {q.options.map((o, i) => (
            <button
              key={i}
              onClick={() => answer(q.id, i)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-medium transition duration-160 ease-premium hover:border-brand hover:bg-brand/5"
            >
              {o.label}
            </button>
          ))}
        </div>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="mt-5 text-xs font-semibold text-slate-400 hover:text-slate-600">
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
