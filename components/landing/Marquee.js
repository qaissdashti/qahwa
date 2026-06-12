'use client';

// Infinite horizontal marquee strip ("قهوة ☕ Qahwa ☕" repeating) placed
// between sections. Two identical halves are rendered; GSAP translates the
// track by exactly one half so it loops seamlessly. Direction follows the
// page dir (drifts the "natural reading" way). Static under reduced motion.
import { useRef, useEffect } from 'react';
import gsap from 'gsap';

const F = { ink: '#0D0D0D', purple: '#7B2FBE', accent: '#C8F55A' };

export default function Marquee({ text = 'قهوة ☕ Qahwa ☕', dir = 'ltr' }) {
  const trackRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tween = gsap.to(track, {
      xPercent: dir === 'rtl' ? 50 : -50,
      duration: 20,
      ease: 'none',
      repeat: -1,
    });
    return () => tween.kill();
  }, [dir]);

  // One "set" of items; rendered twice in the track for a seamless -50% loop.
  const set = Array.from({ length: 6 }).map((_, i) => (
    <span
      key={i}
      style={{
        padding: '0 28px',
        fontFamily: 'var(--font-sans)',
        fontWeight: 800,
        fontSize: 'clamp(26px, 5vw, 48px)',
        letterSpacing: '-0.02em',
        color: i % 2 ? F.purple : F.ink,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  ));

  return (
    <div
      aria-hidden
      style={{
        overflow: 'hidden',
        borderTop: `2px solid ${F.ink}`,
        borderBottom: `2px solid ${F.ink}`,
        background: F.accent,
        padding: '14px 0',
      }}
    >
      {/* dir reset to ltr so the visual order of the two halves is stable;
          the drift direction itself is handled by the tween's sign. */}
      <div ref={trackRef} className="lc-marquee" dir="ltr">
        {set}
        {set}
      </div>
    </div>
  );
}
