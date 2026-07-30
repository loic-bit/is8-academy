import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { trackNow } from '../lib/track.js';
import COPY from '../content/dealfinderCopy.js';

// AI Deal Finder: the advanced-member product page. The academy surfaces it
// as a fullscreen embedded app (permanent 35% coupon for Academy members)
// rather than a marketing page, so members land straight in the product.
// Signup is self-serve on DealFinder's side — no admin activation to wait on.
const EXTERNAL_URL =
  import.meta.env.VITE_DEALFINDER_URL ||
  'https://www.dealfinderai.org/properties?embed=1';
const HOMEPAGE_URL =
  import.meta.env.VITE_DEALFINDER_HOME_URL ||
  'https://www.dealfinderai.org/';
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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef(null);

  const targetUrl = useMemo(() => buildDealfinderUrl(EXTERNAL_URL), []);
  const homeUrl = useMemo(() => buildDealfinderUrl(HOMEPAGE_URL), []);
  // `user.couponEligible` is hardcoded true server-side for every member, so
  // it can't tell us who actually has a provisioned DealFinder account. Until
  // there's a real activation signal, send everyone to the homepage (with the
  // discount overlay) instead of the login-gated properties feed.
  const shouldEmbed = false;

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

  function startTrial() {
    trackNow('finder_trial_click', { via: 'external' });
    api('/dealfinder/trial', { method: 'POST' }).catch(() => {});
    window.open(targetUrl || EXTERNAL_URL, '_blank', 'noreferrer');
  }

  async function copyCoupon() {
    try {
      await navigator.clipboard.writeText(COUPON_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable; button just won't confirm */
    }
  }

  function signUp() {
    trackNow('finder_trial_click', { via: 'homepage' });
    api('/dealfinder/trial', { method: 'POST' }).catch(() => {});
    window.open(homeUrl || HOMEPAGE_URL, '_blank', 'noreferrer');
  }

  function logIn() {
    trackNow('finder_login_click');
    window.open(targetUrl || EXTERNAL_URL, '_blank', 'noreferrer');
  }

  const Cta = ({ className = '' }) => (
    <button onClick={startTrial} className={`btn-primary ${className}`}>
      {COPY.cta}
    </button>
  );

  if (EMBED_ENABLED) {
    return (
      <div className="relative h-full w-full bg-slate-50">
        <iframe
          ref={iframeRef}
          src={(shouldEmbed ? targetUrl : homeUrl) || (shouldEmbed ? EXTERNAL_URL : HOMEPAGE_URL)}
          title="Dealfinder AI"
          className="h-full w-full border-0"
          onLoad={() => setIframeLoaded(true)}
        />

        {!shouldEmbed && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
        )}

        {!shouldEmbed && !bannerDismissed && (
          <div
            className="pointer-events-auto absolute left-1/2 top-6 w-[min(480px,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-white/15 bg-white/95 p-6 shadow-2xl shadow-slate-950/20"
            style={{ opacity: iframeLoaded ? 1 : 0, transition: 'opacity 200ms ease' }}
          >
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-brand">DealFinder discount</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">Use code {COUPON_CODE} for 35% off for life</h2>
            <p className="mt-2 text-sm text-slate-600">Open DealFinder now and the checkout discount is available for every eligible plan.</p>

            <div className="mt-4 flex gap-3">
              <button onClick={copyCoupon} className="btn-ghost flex-1">
                {copied ? 'Copied!' : `Copy ${COUPON_CODE}`}
              </button>
              <button onClick={signUp} className="btn-primary flex-1">
                Sign up
              </button>
            </div>

            <button
              onClick={logIn}
              className="mt-3 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
            >
              Already have a DealFinder account? Log in
            </button>
          </div>
        )}
      </div>
    );
  }

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
