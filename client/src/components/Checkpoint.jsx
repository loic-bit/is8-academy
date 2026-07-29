import { useState } from 'react';
import { api } from '../lib/api.js';
import { track, trackNow } from '../lib/track.js';
import { CHECKPOINTS } from '../content/checkpoints.js';

const MENTORSHIP_URL =
  import.meta.env.VITE_MENTORSHIP_URL || 'https://go.investingsection8.com/df82de5b';

// Level checkpoint quiz. Pass 5/6 → POST the unlock pseudo-lesson to
// course_progress → caller updates its completed set and celebrates.
export default function Checkpoint({ ckey, onPassed, onClose }) {
  const cp = CHECKPOINTS[ckey];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!cp) return null;

  const total = cp.questions.length;

  // Single source of truth for the score; pick() needs it before state commits.
  const scoreOf = (arr) => arr.reduce((n, a, i) => n + (a === cp.questions[i].correct ? 1 : 0), 0);

  function pick(idx) {
    const next = [...answers];
    next[step] = idx;
    setAnswers(next);
    if (step < total - 1) setStep(step + 1);
    else {
      setDone(true);
      const s = scoreOf(next);
      track('checkpoint_result', { checkpointId: cp.id, score: s, total, passed: s >= cp.passMark, answers: next });
    }
  }

  const score = scoreOf(answers);
  const passed = score >= cp.passMark;
  const wrong = cp.questions.map((q, i) => ({ q, i, picked: answers[i] })).filter((x) => x.picked !== x.q.correct);

  async function claim() {
    setSaving(true);
    try {
      await api('/progress', { method: 'POST', body: { lessonId: cp.id } });
      onPassed(cp);
    } catch {
      /* surface stays; retry available */
    } finally {
      setSaving(false);
    }
  }

  function retake() {
    track('checkpoint_retake', { checkpointId: cp.id });
    setStep(0);
    setAnswers([]);
    setDone(false);
  }

  if (done) {
    return (
      <div className="card border-brand/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow mb-1">{cp.title}</div>
            <h3 className="font-display text-lg font-bold">
              {passed ? `You passed: ${score} of ${total}.` : `${score} of ${total}. You need ${cp.passMark}.`}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500" aria-label="Close">✕</button>
        </div>

        {wrong.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="eyebrow">What to remember</div>
            {wrong.map(({ q, i }) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-medium">{q.q}</div>
                <div className="mt-1 text-xs text-slate-400">Correct: {q.options[q.correct]}</div>
                <p className="mt-1.5 leading-relaxed text-slate-600">{q.teach}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {passed ? (
            <button onClick={claim} disabled={saving} className="btn-primary">
              {saving ? 'Ranking up…' : `Claim your rank: ${cp.toRank} →`}
            </button>
          ) : (
            <button onClick={retake} className="btn-primary">Try again</button>
          )}
          {!passed && (
            <button onClick={onClose} className="btn-ghost">Keep studying first</button>
          )}
        </div>

        {passed && (
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            If you want your first deal planned with my team beside you, the game plan call is free.{' '}
            <a
              href={MENTORSHIP_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackNow('calendar_click', { which: 'checkpoint-pass', href: MENTORSHIP_URL })}
              className="font-medium text-brand hover:underline"
            >
              Book it anytime →
            </a>
          </p>
        )}
      </div>
    );
  }

  const q = cp.questions[step];
  return (
    <div className="card border-brand/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">{cp.title} · {step + 1} of {total}</div>
          <h3 className="font-display text-lg font-bold">{q.q}</h3>
        </div>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500" aria-label="Close">✕</button>
      </div>
      <div className="mt-4 space-y-2.5">
        {q.options.map((o, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium transition duration-160 ease-premium hover:border-brand hover:bg-brand/5"
          >
            {o}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="mt-4 text-xs font-semibold text-slate-400 hover:text-slate-600">← Back</button>
      )}
    </div>
  );
}
