'use client';

// Creator tips history + report. Full transaction table with date-range and
// status filters, summary totals, date sorting, and CSV / PDF export branded
// with the creator's name. Reuses the generic export helpers from
// lib/adminReport.js. Dark dashboard theme.

import { useMemo, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import { downloadCsv, downloadPdf } from '@/lib/adminReport';
import { trackEvent } from '@/lib/mixpanel';
import Spinner from '@/components/Spinner';

const STATUS_COLOR = {
  paid:     'text-qahwa-accent',
  pending:  'text-yellow-400',
  failed:   'text-qahwa-red',
  refunded: 'text-white/40',
};

const dayKey = (r) => (r.created_at || '').slice(0, 10); // 'YYYY-MM-DD'
const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

export default function TipsTableClient({ tips, creatorName, handle }) {
  const { t, lang, dir } = useLang();
  const dateLoc = lang === 'ar' ? 'ar-KW' : 'en-GB';
  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(dateLoc) : '—');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const out = tips.filter((r) => {
      const d = dayKey(r);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (status !== 'all' && r.status !== status) return false;
      return true;
    });
    out.sort((a, b) => {
      const cmp = (a.created_at || '').localeCompare(b.created_at || '');
      return sortDesc ? -cmp : cmp;
    });
    return out;
  }, [tips, from, to, status, sortDesc]);

  const totals = useMemo(() => {
    let net = 0;
    let coffees = 0;
    for (const r of filtered) {
      net += Number(r.net_amount_kd || 0);
      coffees += Number(r.cups || 0);
    }
    return { net, coffees, count: filtered.length };
  }, [filtered]);

  // Columns shared by the table, CSV and PDF.
  const columns = useMemo(() => [
    { key: 'date', label: t('tips.col.date'), value: (r) => fmtDate(r.created_at), csv: (r) => dayKey(r) },
    { key: 'supporter', label: t('tips.col.supporter'), value: (r) => r.supporter_name || t('dash.supporterDefault') },
    { key: 'phone', label: t('tips.col.phone'), value: (r) => r.supporter_phone || '—', csv: (r) => r.supporter_phone || '' },
    { key: 'cups', label: t('tips.col.cups'), value: (r) => (r.is_amazing ? t('dash.amazing') : String(r.cups ?? 0)) },
    { key: 'gross', label: t('tips.col.gross'), num: true, value: (r) => fmtKd(r.gross_amount_kd) },
    { key: 'fee', label: t('tips.col.fee'), num: true, value: (r) => fmtKd(r.platform_fee_kd) },
    { key: 'net', label: t('tips.col.net'), num: true, value: (r) => fmtKd(r.net_amount_kd) },
    { key: 'method', label: t('tips.col.method'), value: (r) => r.payment_method || '—' },
    { key: 'message', label: t('tips.col.message'), value: (r) => truncate(r.message || '—', 40), csv: (r) => r.message || '' },
    { key: 'status', label: t('tips.col.status'), value: (r) => t(`tips.status.${r.status}`) },
  ], [t, dateLoc]);

  const rangeLabel = from || to ? `${from || '…'} → ${to || '…'}` : t('tips.allTime');
  const stamp = () => new Date().toISOString().slice(0, 10);
  const fileBase = `qahwa-tips-${handle || 'creator'}-${stamp()}`;

  const totalDefs = [
    { key: 'net', label: t('tips.totalEarned'), value: fmtKd(totals.net), unit: 'KD', highlight: true },
    { key: 'count', label: t('tips.totalCount'), value: String(totals.count), unit: '' },
    { key: 'coffees', label: t('tips.totalCoffees'), value: String(totals.coffees), unit: '☕' },
  ];

  function resetFilters() {
    setFrom('');
    setTo('');
    setStatus('all');
  }

  function onCsv() {
    trackEvent('Tips Export CSV');
    downloadCsv({ filename: `${fileBase}.csv`, columns, rows: filtered });
  }

  async function onPdf() {
    if (busy) return;
    trackEvent('Tips Export PDF');
    setBusy(true);
    try {
      await downloadPdf({
        filename: `${fileBase}.pdf`,
        title: t('tips.pdfTitle', { name: creatorName || `@${handle}` }),
        subtitle: rangeLabel + (status !== 'all' ? ` · ${t(`tips.status.${status}`)}` : ''),
        generatedLabel: `${t('tips.generated')}: ${fmtDate(new Date().toISOString())}`,
        totals: totalDefs,
        columns,
        rows: filtered,
      });
    } finally {
      setBusy(false);
    }
  }

  const noneAtAll = !tips || tips.length === 0;
  const empty = filtered.length === 0;

  if (noneAtAll) {
    return (
      <div className="space-y-5" dir={dir}>
        <h1 className="text-2xl">{t('tips.title')}</h1>
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-16 text-white/40">
          <div className="text-4xl mb-2">☕</div>
          <p className="font-medium">{t('tips.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={dir}>
      <h1 className="text-2xl">{t('tips.title')}</h1>

      {/* Summary totals */}
      <div className="grid grid-cols-3 gap-3">
        {totalDefs.map((td) => (
          <div
            key={td.key}
            className={`rounded-2xl p-4 ${td.highlight ? 'bg-qahwa-accent text-qahwa-black' : 'dash-surface border border-white/10'}`}
          >
            <div className="text-xs font-bold opacity-70">{td.label}</div>
            <div className="mt-1 font-num text-2xl font-bold">
              {td.value} {td.unit && <span className="text-sm opacity-60">{td.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + exports */}
      <div className="dash-surface rounded-2xl border border-white/10 p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-white/50">
          {t('tips.from')}
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
            className="bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white font-num [color-scheme:dark]" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-white/50">
          {t('tips.to')}
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
            className="bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white font-num [color-scheme:dark]" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-white/50">
          {t('tips.statusFilter')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white min-w-[120px]">
            <option value="all">{t('tips.statusAll')}</option>
            <option value="paid">{t('tips.status.paid')}</option>
            <option value="pending">{t('tips.status.pending')}</option>
          </select>
        </label>

        {(from || to || status !== 'all') && (
          <button onClick={resetFilters}
            className="text-xs font-bold rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 min-h-[38px]">
            {t('tips.reset')}
          </button>
        )}

        <div className="flex gap-2 ms-auto">
          <button onClick={onCsv} disabled={empty}
            className="text-xs font-bold rounded-lg px-4 py-2 bg-white/10 hover:bg-white/15 text-white min-h-[38px] disabled:opacity-40 disabled:pointer-events-none">
            ⬇ {t('tips.exportCsv')}
          </button>
          <button onClick={onPdf} disabled={empty || busy}
            className="text-xs font-bold rounded-lg px-4 py-2 bg-qahwa-accent text-qahwa-black hover:opacity-90 min-h-[38px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none">
            {busy ? <Spinner size={12} /> : '⬇'}
            {busy ? t('tips.generating') : t('tips.exportPdf')}
          </button>
        </div>
      </div>

      {empty ? (
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-12 text-white/40 font-medium">
          {t('tips.filteredEmpty')}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="md:hidden dash-surface rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden">
            {filtered.map((tp) => {
              const cls = STATUS_COLOR[tp.status] || 'text-white/40';
              return (
                <li key={tp.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{tp.supporter_name || t('dash.supporterDefault')}</div>
                      {tp.message && <div className="text-white/50 text-xs line-clamp-2">&quot;{tp.message}&quot;</div>}
                    </div>
                    <div className="text-end shrink-0">
                      <div className="font-num font-bold text-qahwa-accent">{fmtKd(tp.net_amount_kd)} KD</div>
                      <div className="text-[10px] text-white/30 font-num whitespace-nowrap">{fmtDate(tp.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">
                      {tp.is_amazing ? t('dash.amazing') : t('dash.cupsN', { n: tp.cups })}
                      <span className="text-white/30 mx-1">·</span>
                      <span className="font-num">{fmtKd(tp.gross_amount_kd)} {t('common.kd')}</span>
                    </span>
                    <span className={`font-bold ${cls}`}>{t(`tips.status.${tp.status}`)}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block dash-surface rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="text-white/40">
                <tr className="border-b border-white/10">
                  {columns.map((c) => {
                    const isDate = c.key === 'date';
                    return (
                      <th key={c.key}
                        onClick={isDate ? () => setSortDesc((v) => !v) : undefined}
                        className={`font-bold px-4 py-3 ${c.num ? 'text-end' : 'text-start'} ${isDate ? 'cursor-pointer select-none hover:text-white/70' : ''}`}>
                        {c.label}
                        {isDate && <span className="ms-1">{sortDesc ? '↓' : '↑'}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tp) => {
                  const cls = STATUS_COLOR[tp.status] || 'text-white/40';
                  return (
                    <tr key={tp.id} className="border-b border-white/5 hover:bg-white/5">
                      {columns.map((c) => {
                        if (c.key === 'status') {
                          return <td key={c.key} className={`px-4 py-3 font-bold ${cls}`}>{c.value(tp)}</td>;
                        }
                        if (c.key === 'message') {
                          return (
                            <td key={c.key} className="px-4 py-3 text-white/50 text-xs max-w-[200px]">
                              <span className="line-clamp-1">{tp.message ? `"${truncate(tp.message, 40)}"` : '—'}</span>
                            </td>
                          );
                        }
                        return (
                          <td key={c.key}
                            className={`px-4 py-3 ${c.num ? 'text-end font-num whitespace-nowrap' : 'text-start'} ${
                              c.key === 'net' ? 'text-qahwa-accent font-bold' : c.num ? 'text-white/70' : c.key === 'cups' ? 'text-white/70' : ''
                            }`}>
                            {c.value(tp)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
