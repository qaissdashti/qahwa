'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Thin progress bar at the very top of the page (YouTube/GitHub style).
// Starts on any same-origin <a> click, finishes when the route segment
// renders (pathname/search change). Uses Tailwind/inline styles — no
// extra deps.
export default function NavigationProgress() {
  const pathname = usePathname();
  const search   = useSearchParams();
  const [pct, setPct] = useState(0);
  const [show, setShow] = useState(false);
  const firstRender = useRef(true);
  const timers = useRef([]);

  function clear() { timers.current.forEach(clearTimeout); timers.current = []; }

  // Finish when navigation actually completes.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    clear();
    setPct(100);
    timers.current.push(setTimeout(() => { setShow(false); setPct(0); }, 220));
  }, [pathname, search]);

  // Start on any same-origin link click.
  useEffect(() => {
    function onClick(e) {
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      let url;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      // Same path + same query → no nav, don't show.
      if (url.pathname === location.pathname && url.search === location.search) return;
      clear();
      setShow(true);
      setPct(15);
      timers.current.push(setTimeout(() => setPct(60), 200));
      timers.current.push(setTimeout(() => setPct(80), 600));
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <div aria-hidden style={{
      position: 'fixed', top: 0, insetInlineStart: 0, insetInlineEnd: 0,
      height: 3, zIndex: 1000, pointerEvents: 'none',
      opacity: show ? 1 : 0,
      transition: 'opacity 200ms ease-out',
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: '#C8F55A',
        boxShadow: '0 0 10px #C8F55A, 0 0 4px #C8F55A',
        transition: 'width 280ms cubic-bezier(.2,.7,.2,1)',
      }} />
    </div>
  );
}
