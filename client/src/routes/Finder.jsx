import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { trackNow } from '../lib/track.js';
import COPY from '../content/dealfinderCopy.js';

// AI Deal Finder: the advanced-member product page. The academy now surfaces
// it as a built-in experience with a permanent 35% coupon for Academy members.
const EXTERNAL_URL =
  import.meta.env.VITE_DEALFINDER_URL ||
  'https://www.dealfinderai.org/properties?embed=1';
const COUPON_CODE = import.meta.env.VITE_DEALFINDER_COUPON || 'CASHFLOW35';
const EMBED_ENABLED =
  import.meta.env.VITE_DEALFINDER_EMBED !== 'false';
const REFERRER_SOURCE = 'cashflow20-academy';

function buildDealfinderUrl(baseUrl) {
  if (!baseUrl) return '';
  try {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set('coupon', COUPON_CODE);
    url.searchParams.set('source', REFERRER_SOURCE);
    url.searchParams.set('utm_source', REFERRER_SOURCE);
    url.searchParams.set('utm_medium', 'academy-site');
    url.searchParams.set('utm_campaign', 'dealfinder-integration');
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export default function Finder() {
  const { user } = useAuth();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const iframeRef = useRef(null);

  const couponEligible = user?.couponEligible !== false;
  const targetUrl = useMemo(() => buildDealfinderUrl(EXTERNAL_URL), []);

  useEffect(() => {
    api('/dealfinder/trial')
      .then((d) => setRequested(d.requested))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!EMBED_ENABLED || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const handleMessage = (event) => {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'resize' || typeof data.height !== 'number') return;
      iframe.style.height = `${Math.max(320, data.height)}px`;
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  async function startTrial() {
    if (EXTERNAL_URL) {
      trackNow('finder_trial_click', { via: 'external', couponEligible });
      api('/dealfinder/trial', { method: 'POST' }).catch(() => {});
      window.open(targetUrl || EXTERNAL_URL, '_blank', 'noreferrer');
      return;
    }
    setBusy(true);
    try {
      await api('/dealfinder/trial', { method: 'POST' });
      setRequested(true);
    } catch {
      /* button stays; they can retry */
    } finally {
      setBusy(false);
    }
  }

  const Cta = ({ className = '' }) =>
    requested ? (
      <div className={`rounded-lg border border-brand/30 bg-brand/5 px-5 py-3.5 text-sm font-semibold text-brand ${className}`}>
        ✓ Your access request is queued. We will activate it and email you once it is ready.
      </div>
    ) : (
      <button onClick={startTrial} disabled={busy} className={`btn-primary ${className}`}>
        {busy ? 'Opening…' : COPY.cta}
      </button>
    );

  return (
    <div>
      <div className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-slate-800 to-brand-dark p-8 text-white sm:p-12">
        <div className="eyebrow mb-2 text-brand-light">{COPY.eyebrow}</div>
        <h1 className="font-display max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{COPY.headline}</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-white/75">{COPY.subhead}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Cta />
          <div className="text-sm text-white/60">
            <span className="font-semibold text-white">{COPY.pricing.trial}</span> · {COPY.pricing.price}
          </div>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card overflow-hidden p-0">
          {EXTERNAL_URL && EMBED_ENABLED ? (
            <div className="aspect-[16/10] bg-slate-50">
              <iframe
                ref={iframeRef}
                src={targetUrl || EXTERNAL_URL}
                title="Dealfinder AI"
                className="h-full w-full border-0"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <div className="eyebrow mb-3">Built into Cashflow 2.0 Academy</div>
              <h2 className="font-display text-xl font-bold tracking-tight">Open the Dealfinder AI experience directly from the academy.</h2>
              <p className="mt-2 leading-relaxed text-slate-500">
                Academy members get a permanent 35% discount and can launch the product from here without leaving the site.
              </p>
              <Cta className="mt-6" />
            </div>
          )}
        </div>

        <div className="card flex flex-col justify-between border-brand/25 bg-brand/5">
          <div>
            <div className="eyebrow mb-3">Academy member perk</div>
            <div className="font-display num text-4xl font-bold">35% <span className="text-lg text-slate-400">off</span></div>
            <div className="mt-1 font-semibold text-brand">
              {couponEligible ? `Permanent coupon unlocked for ${user?.name?.split(' ')[0] || 'you'}` : 'Coupon available to Academy members'}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Use code <span className="font-semibold text-brand">{COUPON_CODE}</span> at checkout. It is built into the academy experience and keeps working on the Dealfinder AI plan.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <Cta className="w-full" />
            {EXTERNAL_URL && (
              <button
                onClick={() => window.open(targetUrl || EXTERNAL_URL, '_blank', 'noreferrer')}
                className="btn-ghost w-full"
              >
                Open in a new tab
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="font-display text-xl font-bold tracking-tight">{COPY.problem.h}</h2>
        <p className="mt-2 leading-relaxed text-slate-500">{COPY.problem.p}</p>
      </div>

      <div className="mb-10">
        <div className="eyebrow mb-3 text-center">How it works</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COPY.steps.map((s, i) => (
            <div key={i} className="card text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-xl">{s.icon}</div>
              <div className="font-display font-bold">{s.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="eyebrow mb-3">What you get</div>
          <ul className="space-y-2.5 text-sm">
            {COPY.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-brand">✓</span>
                <span className="leading-relaxed text-slate-600">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card flex flex-col justify-between border-brand/25 bg-brand/5">
          <div>
            <div className="eyebrow mb-3">Simple pricing</div>
            <div className="font-display num text-4xl font-bold">$25<span className="text-lg text-slate-400">/month</span></div>
            <div className="mt-1 font-semibold text-brand">{COPY.pricing.trial}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{COPY.pricing.note}</p>
          </div>
          <Cta className="mt-6 w-full" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="eyebrow mb-3">Straight answers</div>
        <div className="space-y-3">
          {COPY.faq.map((f) => (
            <div key={f.q} className="card !p-5">
              <div className="font-display text-sm font-bold">{f.q}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
