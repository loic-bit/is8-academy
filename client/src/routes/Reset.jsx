import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../lib/api.js';
import { AuthShell } from './Login.jsx';

export default function Reset() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [linkDead, setLinkDead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLinkDead(false);
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const d = await api('/auth/reset', { method: 'POST', body: { token, password: form.password } });
      // Same session bootstrap as auth.jsx's login(): persist the token, then a
      // hard navigation so AuthProvider re-fetches /auth/me with the new session.
      setToken(d.token);
      setDone(true);
      setTimeout(() => window.location.assign('/'), 1200);
    } catch (err) {
      setError(err.message);
      setLinkDead(true);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your Cashflow 2.0 Academy account."
    >
      {done ? (
        <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          Password updated. Logging you in…
        </p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
                {linkDead && (
                  <>
                    {' '}
                    <Link to="/forgot" className="font-semibold underline">
                      Request a new link
                    </Link>
                  </>
                )}
              </div>
            )}
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="field"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                className="field"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link to="/login" className="font-semibold text-brand">
              Back to log in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
