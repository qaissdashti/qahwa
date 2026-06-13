'use client';

// ============================================================
// Client-side report exporters for the admin panel.
// Both run entirely in the browser on the already-filtered table data.
//
// CSV: built manually (no dependency) with proper quoting + a UTF-8 BOM so
//      Excel renders Arabic correctly.
// PDF: renders an off-screen, branded, light-themed report node and
//      rasterises it (html2canvas → jsPDF), paginated across A4. We go via
//      the DOM because jsPDF cannot shape Arabic / RTL text on its own — the
//      browser already does, so the snapshot matches what the admin sees.
//
// Both libs are dynamically imported so they only load when an export is
// actually triggered (keeps the admin bundle light).
// ============================================================

// ── CSV ──────────────────────────────────────────────────────
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv({ filename, columns, rows }) {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => csvCell(c.csv ? c.csv(r) : c.value(r))).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF', `${header}\r\n${body}`], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, filename);
}

// ── PDF ──────────────────────────────────────────────────────
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build a detached, light-themed branded report DOM node using only plain
// inline styles + hex colours (html2canvas 1.4 is fussy about modern CSS
// colour functions, so we avoid Tailwind classes / oklch here).
function buildReportNode({ title, subtitle, generatedLabel, totals, columns, rows }) {
  const INK = '#0D0D0D';
  const ACCENT = '#C8F55A';
  const PURPLE = '#7B2FBE';
  const MUT = '#6B6680';
  const LINE = '#E6E1F0';

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '760px',
    background: '#ffffff',
    color: INK,
    padding: '32px',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
  });

  const totalCards = totals
    .map(
      (tot) => `
      <div style="flex:1;border:2px solid ${INK};border-radius:14px;padding:12px 14px;background:${tot.highlight ? ACCENT : '#FAFAF7'}">
        <div style="font-size:11px;font-weight:700;color:${tot.highlight ? INK : MUT}">${esc(tot.label)}</div>
        <div style="font-size:20px;font-weight:800;margin-top:2px">${esc(tot.value)}${
          tot.unit ? `<span style="font-size:12px;color:${MUT}"> ${esc(tot.unit)}</span>` : ''
        }</div>
      </div>`,
    )
    .join('');

  const head = columns
    .map(
      (c) =>
        `<th style="text-align:${c.num ? 'right' : 'left'};font-size:11px;font-weight:800;color:#ffffff;padding:8px 10px;white-space:nowrap">${esc(c.label)}</th>`,
    )
    .join('');

  const body = rows
    .map((r, i) => {
      const cells = columns
        .map(
          (c) =>
            `<td style="text-align:${c.num ? 'right' : 'left'};font-size:11px;padding:7px 10px;border-bottom:1px solid ${LINE};${
              c.num ? 'font-variant-numeric:tabular-nums;white-space:nowrap' : ''
            }">${esc(c.value(r))}</td>`,
        )
        .join('');
      return `<tr style="background:${i % 2 ? '#FAFAF7' : '#ffffff'}">${cells}</tr>`;
    })
    .join('');

  wrap.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid ${INK};padding-bottom:14px;margin-bottom:18px">
      <div>
        <div style="font-size:26px;font-weight:800">قهوة <span style="color:${PURPLE}">☕</span> <span style="font-size:15px;color:${MUT};font-weight:700">Qahwa</span></div>
        <div style="font-size:18px;font-weight:800;margin-top:8px">${esc(title)}</div>
        <div style="font-size:12px;color:${MUT};margin-top:2px">${esc(subtitle)}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:${MUT};white-space:nowrap">${esc(generatedLabel)}</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:18px">${totalCards}</div>
    <table style="width:100%;border-collapse:collapse;border:2px solid ${INK}">
      <thead><tr style="background:${INK}">${head}</tr></thead>
      <tbody>${
        body ||
        `<tr><td colspan="${columns.length}" style="padding:20px;text-align:center;color:${MUT};font-size:12px">—</td></tr>`
      }</tbody>
    </table>
    <div style="margin-top:16px;font-size:10px;color:${MUT};text-align:center">Qahwa · buymeqahwa.com</div>
  `;
  return wrap;
}

export async function downloadPdf({ filename, title, subtitle, generatedLabel, totals, columns, rows }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const node = buildReportNode({ title, subtitle, generatedLabel, totals, columns, rows });
  document.body.appendChild(node);

  try {
    // Make sure web fonts are ready so Arabic/Latin render in the snapshot.
    if (document.fonts?.ready) await document.fonts.ready;

    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    // Slice the single tall image across as many A4 pages as needed.
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH, undefined, 'FAST');
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH, undefined, 'FAST');
      heightLeft -= pageH;
    }
    pdf.save(filename);
  } finally {
    node.remove();
  }
}
