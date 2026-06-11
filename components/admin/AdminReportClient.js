'use client';

// ============================================================
// Shared admin report view, used by both:
//   /admin/fees  (variant="fees", metric "fees" | "volume")
//   /admin/tips  (variant="tips")
//
// Renders summary totals, date-range + creator filters, a sortable table
// (desktop) / stacked cards (mobile), and CSV / PDF export of the currently
// filtered + sorted rows. All data is paid tips joined with their creator,
// fetched server-side via the service-role client.
// ============================================================

import { useMemo, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import { downloadCsv, downloadPdf } from '@/lib/adminReport';
import { trackEvent } from '@/lib/mixpanel';
import Spinner from '@/components/Spinner';

const rowDate = (r) => r.paid_at || r.created_at || '';
const dayKey = (r) => rowDate(r).slice(0, 10); // 'YYYY-MM-DD'

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

export default function AdminReportClient({ rows, variant = 'fees', metric = 'fees' }) {
  const { t, dir } = useLang();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creator, setCreator] = useState('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [busy, setBusy] = useState(false);

  // Creator filter options derived from the tips present (handle = stable key).
  const creators = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const h = r.creators?.handle;
      if (h && !map.has(h)) map.set(h, r.creators?.full_name || h);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      const d = dayKey(r);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (creator !== 'all' && r.creators?.handle !== creator) return false;
      return true;
    });
    out.sort((a, b) => {
      const cmp = rowDate(a).localeCompare(rowDate(b));
      return sortDesc ? -cmp : cmp;
    });
    return out;
  }, [rows, from, to, creator, sortDesc]);

  const totals = useMemo(() => {
    let volume = 0;
    let fees = 0;
    let net = 0;
    for (const r of filtered) {
      volume += Number(r.gross_amount_kd || 0);
      fees += Number(r.platform_fee_kd || 0);
      net += Number(r.net_amount_kd || 0);
    }
    return { volume, fees, net, count: filtered.length };
  }, [filtered]);

  // ── Columns (shared by table, CSV and PDF) ──
  const columns = useMemo(() => {
    const colDate = { key: 'date', label: t('admin.rep.col.date'), value: (r) => fmtDate(rowDate(r)), csv: (r) => dayKey(r) };
    const colSupporter = { key: 'supporter', label: t('admin.rep.col.supporter'), value: (r) => r.supporter_name || t('admin.rep.anonymous') };
    const colCreator = { key: 'creator', label: t('admin.rep.col.creator'), value: (r) => r.creators?.full_name || '—' };
    const colHandle = { key: 'handle', label: t('admin.rep.col.handle'), value: (r) => `@${r.creators?.handle || '—'}` };
    const colType = { key: 'type', label: t('admin.rep.col.type'), value: (r) => (r.is_amazing ? t('admin.rep.amazing') : t('admin.rep.cupsN', { n: r.cups })) };
    const colGross = { key: 'gross', label: t('admin.rep.col.gross'), num: true, value: (r) => fmtKd(r.gross_amount_kd) };
    const colFee = { key: 'fee', label: t('admin.rep.col.fee'), num: true, value: (r) => fmtKd(r.platform_fee_kd) };
    const colNet = { key: 'net', label: t('admin.rep.col.net'), num: true, value: (r) => fmtKd(r.net_amount_kd) };
    const colMethod = { key: 'method', label: t('admin.rep.col.method'), value: (r) => r.payment_method || '—' };
    const colMessage = { key: 'message', label: t('admin.rep.col.message'), value: (r) => truncate(r.message || '—', 40), csv: (r) => r.message || '' };

    return [
      colDate,
      colSupporter,
      colCreator,
      colHandle,
      ...(variant === 'tips' ? [colType] : []),
      colGross,
      colFee,
      colNet,
      colMethod,
      ...(variant === 'tips' ? [colMessage] : []),
    ];
  }, [t, variant]);

  // ── Page title + which total is highlighted ──
  const title =
    variant === 'tips'
      ? t('admin.tips.title')
      : metric === 'volume'
      ? t('admin.fees.volumeTitle')
      : t('admin.fees.title');

  const highlightKey = variant === 'tips' ? 'count' : metric === 'volume' ? 'volume' : 'fees';

  const totalDefs = [
    { key: 'volume', label: t('admin.rep.totalVolume'), value: fmtKd(totals.volume), unit: 'KD' },
    { key: 'fees', label: t('admin.rep.totalFees'), value: fmtKd(totals.fees), unit: 'KD' },
    { key: 'net', label: t('admin.rep.totalNet'), value: fmtKd(totals.net), unit: 'KD' },
    { key: 'count', label: t('admin.rep.count'), value: String(totals.count), unit: '' },
  ];

  const rangeLabel = from || to ? `${from || '…'} → ${to || '…'}` : t('admin.rep.allTime');
  const stamp = () => new Date().toISOString().slice(0, 10);

  function resetFilters() {
    setFrom('');
    setTo('');
    setCreator('all');
  }

  function onCsv() {
    trackEvent('Admin Export CSV', { reportType: variant });
    downloadCsv({
      filename: `qahwa-${variant}-${stamp()}.csv`,
      columns,
      rows: filtered,
    });
  }

  async function onPdf() {
    if (busy) return;
    trackEvent('Admin Export PDF', { reportType: variant });
    setBusy(true);
    try {
      await downloadPdf({
        filename: `qahwa-${variant}-${stamp()}.pdf`,
        title,
        subtitle: rangeLabel + (creator !== 'all' ? ` · @${creator}` : ''),
        generatedLabel: `${t('admin.rep.generated')}: ${fmtDate(new Date().toISOString())}`,
        totals: totalDefs.map((td) => ({ ...td, highlight: td.key === highlightKey })),
        columns,
        rows: filtered,
      });
    } finally {
      setBusy(false);
    }
  }

  const empty = filtered.length === 0;

  return (
    <div className="space-y-5" dir={dir}>
      <h1 className="text-2xl">{title}</h1>

      {/* Summary totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {totalDefs.map((td) => {
          const hot = td.key === highlightKey;
          return (
            <div
              key={td.key}
              className={`rounded-2xl p-4 ${hot ? 'bg-qahwa-accent text-qahwa-black' : 'dash-surface border border-white/10'}`}
            >
              <div className="text-xs font-bold opacity-70">{td.label}</div>
              <div className="mt-1 font-num text-2xl font-bold">
                {td.value} {td.unit && <span className="text-sm opacity-60">{td.unit}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + exports */}
      <div className="dash-surface rounded-2xl border border-white/10 p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-white/50">
          {t('admin.rep.from')}
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white font-num [color-scheme:dark]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-white/50">
          {t('admin.rep.to')}
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white font-num [color-scheme:dark]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-white/50">
          {t('admin.rep.creator')}
          <select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white min-w-[160px]"
          >
            <option value="all">{t('admin.rep.allCreators')}</option>
            {creators.map(([handle, name]) => (
              <option key={handle} value={handle}>
                {name} (@{handle})
              </option>
            ))}
          </select>
        </label>

        {(from || to || creator !== 'all') && (
          <button
            onClick={resetFilters}
            className="text-xs font-bold rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 min-h-[38px]"
          >
            {t('admin.rep.reset')}
          </button>
        )}

        <div className="flex gap-2 ms-auto">
          <button
            onClick={onCsv}
            disabled={empty}
            className="text-xs font-bold rounded-lg px-4 py-2 bg-white/10 hover:bg-white/15 text-white min-h-[38px] disabled:opacity-40 disabled:pointer-events-none"
          >
            ⬇ {t('admin.rep.exportCsv')}
          </button>
          <button
            onClick={onPdf}
            disabled={empty || busy}
            className="text-xs font-bold rounded-lg px-4 py-2 bg-qahwa-accent text-qahwa-black hover:opacity-90 min-h-[38px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy ? <Spinner size={12} /> : '⬇'}
            {busy ? t('admin.rep.generating') : t('admin.rep.exportPdf')}
          </button>
        </div>
      </div>

      {empty ? (
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-12 text-white/40 font-medium">
          {t('admin.rep.empty')}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="md:hidden space-y-2">
            {filtered.map((r) => (
              <li key={r.id} className="dash-surface rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{r.creators?.full_name || '—'}</span>
                  <span className="font-num text-sm text-white/50">{fmtDate(rowDate(r))}</span>
                </div>
                <div className="text-xs text-white/40 font-num">@{r.creators?.handle || '—'}</div>
                <div className="mt-1 text-sm text-white/70">
                  {r.supporter_name || t('admin.rep.anonymous')}
                  {variant === 'tips' && (
                    <span className="text-white/40">
                      {' · '}
                      {r.is_amazing ? t('admin.rep.amazing') : t('admin.rep.cupsN', { n: r.cups })}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-sm font-num">
                  <span className="text-white/50">
                    {fmtKd(r.gross_amount_kd)} <span className="text-xs">KD</span>
                  </span>
                  <span className="text-qahwa-accent font-bold">
                    +{fmtKd(r.platform_fee_kd)} <span className="text-xs">KD</span>
                  </span>
                  <span className="text-white/40 text-xs uppercase">{r.payment_method || '—'}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block dash-surface rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-white/40 border-b border-white/10">
                <tr>
                  {columns.map((c) => {
                    const isDate = c.key === 'date';
                    return (
                      <th
                        key={c.key}
                        onClick={isDate ? () => setSortDesc((v) => !v) : undefined}
                        className={`font-bold px-4 py-3 ${c.num ? 'text-end' : 'text-start'} ${
                          isDate ? 'cursor-pointer select-none hover:text-white/70' : ''
                        }`}
                      >
                        {c.label}
                        {isDate && <span className="ms-1">{sortDesc ? '↓' : '↑'}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-3 ${c.num ? 'text-end font-num whitespace-nowrap' : 'text-start'} ${
                          c.key === 'fee' ? 'text-qahwa-accent font-bold' : c.num ? 'text-white/70' : ''
                        }`}
                      >
                        {c.value(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
