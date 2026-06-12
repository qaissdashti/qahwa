'use client';

// Magnetic CTA — leans toward the cursor on hover, springs back on leave,
// and presses down (scale) on click. Keeps the brutalist look by rendering
// a normal Next <Link> with the usual q-btn-* classes; GSAP only adds the
// transform on top. Disabled on touch (no fine pointer) and under
// prefers-reduced-motion, where the .q-btn CSS active-state still gives a
// press affordance.
import { useRef, useEffect } from 'react';
import Link from 'next/link';
import gsap from 'gsap';

export default function MagneticButton({
  href,
  onClick,
  className = '',
  children,
  strength = 0.4,   // fraction of cursor offset the button follows
  max = 10,         // px cap on travel (subtle, brutalist)
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    const sTo = gsap.quickTo(el, 'scale', { duration: 0.18, ease: 'power2.out' });

    const move = (e) => {
      const r = el.getBoundingClientRect();
      const relX = e.clientX - (r.left + r.width / 2);
      const relY = e.clientY - (r.top + r.height / 2);
      xTo(gsap.utils.clamp(-max, max, relX * strength));
      yTo(gsap.utils.clamp(-max, max, relY * strength));
    };
    const reset = () => { xTo(0); yTo(0); };
    const down = () => sTo(0.94);
    const up = () => sTo(1);

    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', () => { reset(); up(); });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);

    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', reset);
      el.removeEventListener('mousedown', down);
      el.removeEventListener('mouseup', up);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'transform' });
    };
  }, [strength, max]);

  return (
    <Link href={href} onClick={onClick} ref={ref} className={className}>
      {children}
    </Link>
  );
}
