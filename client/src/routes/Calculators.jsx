import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { trackNow } from '../lib/track.js';
import { useToolTracking } from '../lib/useToolTracking.js';
import PageHeader from '../components/PageHeader.jsx';
import { money, pct, relTime } from '../lib/format.js';

const MENTORSHIP_URL =
  import.meta.env.VITE_MENTORSHIP_URL || 'https://go.investingsection8.com/df82de5b';

const DEFAULTS = {
  purchasePrice: 120000,
  downPct: 25,
  rate: 7.0,
  termYears: 30,
  monthlyRent: 1500, // Section 8 FMR for the unit
  taxesYearly: 1800,
  insuranceYearly: 1200,
  vacancyPct: 5,
  maintenancePct: 8,
  mgmtPct: 8,
  otherMonthly: 0,
};

// Deal math. Returns monthly cash flow plus the headline return metrics.
// Note: cashInvested = down payment only (closing costs excluded — v1 simplification).
function compute(v) {
  const down = (v.purchasePrice * v.downPct) / 100;
  const loan = v.purchasePrice - down;
  const monthlyRate = v.rate / 100 / 12;
  const n = v.termYears * 12;
  const mortgage =
    monthlyRate > 0 ? (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n)) : loan / n;

  const gross = v.monthlyRent;
  const vacancy = (gross * v.vacancyPct) / 100;
  const maintenance = (gross * v.maintenancePct) / 100;
  const mgmt = (gross * v.mgmtPct) / 100;
  const taxes = v.taxesYearly / 12;
  const insurance = v.insuranceYearly / 12;

  const operatingExpenses = vacancy + maintenance + mgmt + taxes + insurance + v.otherMonthly;
  const noiMonthly = gross - operatingExpenses; // before debt service
  const cashFlow = noiMonthly - mortgage;

  const annualNOI = noiMonthly * 12;
  const annualCashFlow = cashFlow * 12;
  const cashInvested = down;
  const capRate = v.purchasePrice > 0 ? (annualNOI / v.purchasePrice) * 100 : 0;
  const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;

  return { down, loan, mortgage, operatingExpenses, cashFlow, annualCashFlow, capRate, cashOnCash };
}

const FIELDS = [
  { key: 'purchasePrice', label: 'Purchase price ($)' },
  { key: 'downPct', label: 'Down payment (%)' },
  { key: 'rate', label: 'Interest rate (%)' },
  { key: 'termYears', label: 'Loan term (years)' },
  { key: 'monthlyRent', label: 'Section 8 monthly rent ($)' },
  { key: 'taxesYearly', label: 'Property taxes / year ($)' },
  { key: 'insuranceYearly', label: 'Insurance / year ($)' },
  { key: 'vacancyPct', label: 'Vacancy (%)' },
  { key: 'maintenancePct', label: 'Maintenance (%)' },
  { key: 'mgmtPct', label: 'Property mgmt (%)' },
  { key: 'otherMonthly', label: 'Other monthly costs ($)' },
];

// Plain-text summary of a saved deal for copy-to-clipboard.
function dealText(deal) {
  const r = deal.data?.results || {};
  const lines = [
    deal.label,
    `Monthly cash flow: ${money(r.cashFlow)}`,
    `Cash-on-cash: ${pct(r.cashOnCash)}`,
    `Cap rate: ${pct(r.capRate)}`,
    `Annual cash flow: ${money(r.annualCashFlow)}`,
  ];
  if (deal.data?.listingUrl) lines.push(`Listing: ${deal.data.listingUrl}`);
  return lines.join('\n');
}

// "zillow.com/..." -> "https://zillow.com/..." so saved links always open.
function normalizeUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export default function Calculators() {
  const [v, setV] = useState(DEFAULTS);
  const [listingUrl, setListingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deals, setDeals] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [firstDealNudge, setFirstDealNudge] = useState(false);
  const editRef = useRef(null);

  const r = useMemo(() => compute(v), [v]);

  useToolTracking('calculators', [v], () => ({
    inputs: v,
    results: {
      cashFlow: Math.round(r.cashFlow),
      cashOnCash: +r.cashOnCash.toFixed(1),
      capRate: +r.capRate.toFixed(1),
    },
  }));

  useEffect(() => {
    api('/deals')
      .then((d) => setDeals(d.deals || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const set = (key) => (e) => {
    setV({ ...v, [key]: parseFloat(e.target.value) || 0 });
    setSaved(false);
  };

  const reset = () => {
    setV(DEFAULTS);
    setSaved(false);
  };

  async function saveDeal() {
    setSaving(true);
    const wasFirstDeal = deals.length === 0;
    try {
      const label = `Deal @ ${money(v.purchasePrice)} · ${money(r.cashFlow)}/mo`;
      const url = normalizeUrl(listingUrl);
      const { deal } = await api('/deals', {
        method: 'POST',
        body: { label, data: { inputs: v, results: r, ...(url ? { listingUrl: url } : {}) } },
      });
      setDeals((prev) => [deal, ...prev]);
      setSaved(true);
      if (wasFirstDeal) setFirstDealNudge(true);
    } catch {
      /* surfaced via disabled state; keep silent for v1 */
    } finally {
      setSaving(false);
    }
  }

  async function removeDeal(id) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    try {
      await api(`/deals/${id}`, { method: 'DELETE' });
    } catch {
      /* optimistic; reconciles on reload */
    }
  }

  function startEdit(deal) {
    setEditingId(deal.id);
    setEditLabel(deal.label);
  }

  async function commitEdit() {
    const id = editingId;
    const label = editLabel.trim();
    setEditingId(null);
    if (!label) return;
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, label } : d)));
    try {
      await api(`/deals/${id}`, { method: 'PATCH', body: { label } });
    } catch {
      /* optimistic label already applied; reconciles on reload */
    }
  }

  async function copyDeal(deal) {
    try {
      await navigator.clipboard.writeText(dealText(deal));
      setCopiedId(deal.id);
      setTimeout(() => setCopiedId((c) => (c === deal.id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const positive = r.cashFlow >= 0;

  return (
    <div>
      <PageHeader
        back={{ to: '/vault', label: 'Toolkit' }}
        title="Deal Calculator"
        subtitle="Section 8 rental analysis: cash flow, cash-on-cash, and cap rate."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Inputs */}
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Deal inputs</h3>
            <button onClick={reset} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
              Reset to defaults
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input
                  type="number"
                  className="field"
                  value={v[f.key]}
                  onChange={set(f.key)}
                  min="0"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="label">Listing link (optional)</label>
            <input
              type="url"
              className="field"
              placeholder="Paste the Zillow, Redfin, or MLS link for this property"
              value={listingUrl}
              onChange={(e) => {
                setListingUrl(e.target.value);
                setSaved(false);
              }}
            />
            <p className="mt-1.5 text-xs text-slate-400">Saved with the deal so you can jump back to the property later.</p>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className={`card ${positive ? 'border-success/20 bg-success-soft' : 'border-danger/20 bg-danger-soft'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly cash flow</div>
            <div className={`num font-display mt-1 text-[32px] font-bold leading-none ${positive ? 'text-success' : 'text-danger'}`}>
              {money(r.cashFlow)}
            </div>
          </div>

          <div className="card space-y-3 text-sm">
            <Row label="Cash-on-cash return" value={pct(r.cashOnCash)} />
            <Row label="Cap rate" value={pct(r.capRate)} />
            <Row label="Annual cash flow" value={money(r.annualCashFlow)} />
            <hr className="border-slate-100" />
            <Row label="Down payment" value={money(r.down)} />
            <Row label="Loan amount" value={money(r.loan)} />
            <Row label="Mortgage (P&I) / mo" value={money(r.mortgage)} />
            <Row label="Operating expenses / mo" value={money(r.operatingExpenses)} />
          </div>

          <button onClick={saveDeal} className="btn-primary w-full" disabled={saving}>
            {saved ? '✓ Saved to your account' : saving ? 'Saving…' : 'Save this deal'}
          </button>
        </div>
      </div>

      {/* Saved deals */}
      <div className="mt-10">
        <h3 className="mb-4 text-lg font-bold">Saved deals</h3>
        {firstDealNudge && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-500">
              Saved. If you ever want a second set of eyes on a deal, that is exactly what the free game plan call is for.{' '}
              <a
                href={MENTORSHIP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackNow('calendar_click', { which: 'deal-saved', href: MENTORSHIP_URL })}
                className="font-medium text-brand hover:underline"
              >
                Book a free call →
              </a>
            </p>
            <button
              onClick={() => setFirstDealNudge(false)}
              className="text-slate-300 hover:text-slate-500"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        {deals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No saved deals yet. Run the numbers above and hit <span className="font-semibold">Save this deal</span> to keep it here.
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => {
              const cf = deal.data?.results?.cashFlow;
              const cfPositive = (cf ?? 0) >= 0;
              return (
                <div key={deal.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {editingId === deal.id ? (
                      <input
                        ref={editRef}
                        className="field"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={commitEdit}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(deal)}
                        title="Click to rename"
                        className="block truncate text-left font-semibold hover:text-brand"
                      >
                        {deal.label}
                      </button>
                    )}
                    <div className="mt-0.5 text-xs text-slate-400">
                      {Number.isFinite(cf) && (
                        <span className={cfPositive ? 'text-success' : 'text-danger'}>
                          {money(cf)}/mo
                        </span>
                      )}
                      {deal.created_at && <span> · saved {relTime(deal.created_at)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {deal.data?.listingUrl && (
                      <a
                        href={deal.data.listingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => trackNow('listing_click', {})}
                        className="btn-ghost !px-3 !py-1.5 text-xs text-brand"
                      >
                        Listing ↗
                      </a>
                    )}
                    <button onClick={() => copyDeal(deal)} className="btn-ghost !px-3 !py-1.5 text-xs">
                      {copiedId === deal.id ? '✓ Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => removeDeal(deal.id)}
                      className="btn-ghost !px-3 !py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="num font-semibold tabular-nums">{value}</span>
    </div>
  );
}
