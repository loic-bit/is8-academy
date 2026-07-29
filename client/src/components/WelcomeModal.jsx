import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { track } from '../lib/track.js';

// Drop a Wistia URL here when the onboarding video is recorded, e.g.
// 'https://fast.wistia.com/medias/xxxxxxxxxx'. Renders only when set.
const WELCOME_VIDEO = null;

const DISMISS_KEY = 'is8_welcome_seen';

function toWistiaEmbed(url) {
  const m = (url || '').match(/wistia\.(?:com|net)\/(?:medias|embed\/iframe)\/([\w]+)/);
  return m ? `https://fast.wistia.net/embed/iframe/${m[1]}?videoFoam=true` : url;
}

export default function WelcomeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(DISMISS_KEY);
    } catch {}
    if (seen) return;
    api('/quiz/me')
      .then((d) => {
        if (!d.result) {
          setOpen(true);
          track('welcome_modal', { action: 'shown' });
        }
      })
      .catch(() => {});
  }, []);

  const close = (action) => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    track('welcome_modal', { action });
    setOpen(false);
  };

  if (!open) return null;
  const firstName = user?.name?.split(' ')[0] || 'investor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => close('dismissed')} aria-hidden />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        {WELCOME_VIDEO && (
          <div className="aspect-video w-full bg-slate-900">
            <iframe
              src={toWistiaEmbed(WELCOME_VIDEO)}
              title="Welcome to the Academy"
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}
        <div className="p-6 sm:p-8">
          <div className="eyebrow mb-1">🎉 You're in</div>
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">
            Welcome, {firstName}. Three things before you dive in.
          </h2>
          <ol className="mb-6 space-y-4 text-[15px]">
            <li className="flex gap-3">
              <span className="text-lg">📞</span>
              <div>
                <span className="font-semibold">My team is going to call you.</span>{' '}
                <span className="text-slate-600">
                  It will look like a random number. Answer it: a real person will point you to the
                  right starting spot and answer every question you have.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-lg">📋</span>
              <div>
                <span className="font-semibold">Fill out the onboarding form first.</span>{' '}
                <span className="text-slate-600">
                  Two minutes. It reads your capital, your experience, and your goal, and hands you
                  your investor profile with your first three moves. It also means when we talk, we
                  already know exactly how to help you instead of guessing.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-lg">🎓</span>
              <div>
                <span className="font-semibold">Then start Level 1.</span>{' '}
                <span className="text-slate-600">
                  The course opens up level by level as you go. Every lesson is short on purpose.
                </span>
              </div>
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/quiz" onClick={() => close('form_cta')} className="btn-primary">
              Fill out the onboarding form →
            </Link>
            <button
              onClick={() => close('dismissed')}
              className="text-sm font-semibold text-slate-400 hover:text-slate-600"
            >
              I'll explore first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
