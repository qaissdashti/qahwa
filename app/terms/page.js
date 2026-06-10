// Terms & Conditions page — reads public/terms-ar.md at request time
// and renders it as a clean RTL document in the existing Flewd theme.
// Server Component on purpose: no client state, no hydration cost.
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = {
  title: 'الشروط والأحكام — Qahwa ☕',
  description: 'الشروط والأحكام لاستخدام منصة قهوة',
};

// ─── Tiny markdown → JSX parser ──────────────────────────────
// Handles exactly the subset we use in terms-ar.md:
//   # / ## headings, ---, **bold**, bullet (-) lists with one
//   level of indent, ordered (1.) lists, paragraphs. Nothing
//   external; ~80 lines of intentional scope.
function renderInline(text, keyPrefix = '') {
  // Split on **bold** markers, alternating plain ↔ bold spans.
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={`${keyPrefix}-b-${i++}`} style={{ fontWeight: 800 }}>{m[1]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MarkdownTerms({ source }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim(), key: i });
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim(), key: i });
      i++; continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim(), key: i });
      i++; continue;
    }

    // Horizontal rule
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr', key: i });
      i++; continue;
    }

    // Ordered list — collect consecutive lines that start with "N." until break
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const main = lines[i].replace(/^\d+\.\s/, '');
        const sub = [];
        // Pick up indented bullet continuations (3-space indented `-`)
        let j = i + 1;
        while (j < lines.length && /^\s{2,}-\s/.test(lines[j])) {
          sub.push(lines[j].replace(/^\s+-\s/, ''));
          j++;
        }
        items.push({ main, sub });
        i = j;
      }
      blocks.push({ type: 'ol', items, key: `ol-${blocks.length}` });
      continue;
    }

    // Bullet list at column 0
    if (/^-\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items, key: `ul-${blocks.length}` });
      continue;
    }

    // Blank line — skip
    if (line.trim() === '') { i++; continue; }

    // Paragraph — single line for our content
    blocks.push({ type: 'p', text: line.trim(), key: i });
    i++;
  }

  return (
    <>
      {blocks.map((b) => {
        switch (b.type) {
          case 'h1':
            return (
              <h1 key={b.key} className="text-2xl sm:text-3xl font-extrabold mt-2 mb-4 leading-snug"
                  style={{ fontFamily: 'var(--font-sans)' }}>
                {renderInline(b.text, `h1-${b.key}`)}
              </h1>
            );
          case 'h2':
            return (
              <h2 key={b.key} className="text-lg sm:text-xl font-extrabold mt-7 mb-3 leading-snug"
                  style={{ fontFamily: 'var(--font-sans)', color: '#6B4F8A' }}>
                {renderInline(b.text, `h2-${b.key}`)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={b.key} className="text-base font-bold mt-5 mb-2"
                  style={{ fontFamily: 'var(--font-sans)' }}>
                {renderInline(b.text, `h3-${b.key}`)}
              </h3>
            );
          case 'hr':
            return <hr key={b.key} className="my-7 border-0 border-t-2"
                       style={{ borderColor: 'rgba(13,13,13,0.10)' }} />;
          case 'p':
            return (
              <p key={b.key} className="mb-3 leading-relaxed text-sm sm:text-base">
                {renderInline(b.text, `p-${b.key}`)}
              </p>
            );
          case 'ul':
            return (
              <ul key={b.key} className="list-disc ps-6 mb-4 space-y-1.5 text-sm sm:text-base leading-relaxed">
                {b.items.map((it, k) => (
                  <li key={k}>{renderInline(it, `${b.key}-${k}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={b.key} className="list-decimal ps-6 mb-4 space-y-2 text-sm sm:text-base leading-relaxed">
                {b.items.map((it, k) => (
                  <li key={k}>
                    {renderInline(it.main, `${b.key}-${k}-m`)}
                    {it.sub.length > 0 && (
                      <ul className="list-disc ps-6 mt-1.5 space-y-1">
                        {it.sub.map((s, kk) => (
                          <li key={kk}>{renderInline(s, `${b.key}-${k}-s-${kk}`)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

export default function TermsPage() {
  // Read the markdown source from /public — kept here as the
  // canonical text so non-code consumers (legal review, PDF export,
  // /terms-ar.md direct link) all see the same content.
  const src = fs.readFileSync(
    path.join(process.cwd(), 'public', 'terms-ar.md'),
    'utf8',
  );

  return (
    <main dir="rtl" lang="ar" className="min-h-screen" style={{ background: '#F5F0FF', color: '#0D0D0D' }}>
      {/* ── Top bar with logo + back button ── */}
      <header className="border-b-2 sticky top-0 z-10" style={{ background: '#F5F0FF', borderColor: 'rgba(13,13,13,0.10)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-extrabold"
                style={{ fontFamily: 'var(--font-sans)' }}>
            <Logo size={28} />
            <span>قهوة</span>
          </Link>
          <Link href="/" className="text-sm font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: '#FFFFFF',
                  color: '#0D0D0D',
                  border: '2px solid #0D0D0D',
                  boxShadow: '2px 2px 0 #0D0D0D',
                }}>
            <span>↩</span><span>رجوع</span>
          </Link>
        </div>
      </header>

      {/* ── Document body ── */}
      <article className="max-w-3xl mx-auto px-5 sm:px-7 py-8 sm:py-12">
        <div className="rounded-2xl p-6 sm:p-9"
             style={{
               background: '#FFFFFF',
               border: '2px solid #0D0D0D',
               boxShadow: '5px 5px 0 #0D0D0D',
             }}>
          <MarkdownTerms source={src} />
        </div>
      </article>

      <footer className="border-t-2 py-6 text-center text-sm font-medium"
              style={{ borderColor: 'rgba(13,13,13,0.10)', color: 'rgba(13,13,13,0.55)' }}>
        قهوة ☕ — صُنع في الكويت
      </footer>
    </main>
  );
}
