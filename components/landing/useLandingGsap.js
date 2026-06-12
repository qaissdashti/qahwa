'use client';

// ============================================================
// useLandingGsap — all page-level GSAP for the landing page.
//
// Design notes
//  • One gsap.context() scoped to the root <main>. Cleanup is a single
//    ctx.revert() (kills every tween + ScrollTrigger created inside) plus
//    removing the one global mousemove listener. → "kill ScrollTriggers on
//    unmount" requirement.
//  • prefers-reduced-motion: we bail out BEFORE creating anything, so the
//    JSX renders in its final (visible) state — nothing animates.
//  • Responsive heavy bits (pinned scrub, cursor parallax, phone tilt) live
//    in a gsap.matchMedia() desktop branch; mobile gets a light fade-up.
//    Keeps mobile cheap (Lighthouse) and avoids touch jank.
//  • useLayoutEffect (pre-paint) so initial gsap.set() states apply before
//    the browser paints → no flash of the "from" state.
//  • RTL: reveals use y/opacity (direction-agnostic). Cursor parallax is
//    mirrored by `sign` so it drifts correctly in RTL.
// ============================================================

import { useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// useLayoutEffect warns during SSR; this component only runs on the client,
// but guard anyway so it's safe.
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const BG_LAVENDER = '#F5F0FF';
const BG_WHITE = '#FFFFFF';

export default function useLandingGsap(rootRef, { lang, dir }) {
  useIso(() => {
    const root = rootRef.current;
    if (!root) return;

    // ── reduced motion: render the final state, animate nothing ──
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const sign = dir === 'rtl' ? -1 : 1;
    let onMove = null; // global pointer handler (assigned in desktop branch)

    const ctx = gsap.context(() => {
      // ─────────────────────────────────────────────────────────
      // HERO — runs on all viewports
      // ─────────────────────────────────────────────────────────

      // 1. Headline reveal, word by word (slide up out of clip wrappers)
      const words = gsap.utils.toArray('.lc-word');
      if (words.length) {
        gsap.set(words, { yPercent: 115 });
        gsap.to(words, {
          yPercent: 0,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.06,
          delay: 0.1,
        });
      }

      // hero badge / sub / CTAs / microcopy fade-up after the headline
      gsap.from('[data-lc="hero-fade"]', {
        y: 22,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.1,
        delay: 0.45,
      });

      // 2. Logo gentle floating loop
      gsap.to('[data-lc="logo"]', {
        y: -8,
        duration: 3,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      // 2b. Pixel steam particles rising + fading on a loop
      gsap.utils.toArray('.lc-steam').forEach((s, i) => {
        gsap
          .timeline({ repeat: -1, delay: i * 0.7 })
          .fromTo(
            s,
            { y: 0, opacity: 0, scale: 0.7 },
            { y: -10, opacity: 0.55, scale: 1, duration: 1.1, ease: 'power1.out' },
          )
          .to(s, { y: -26, opacity: 0, scale: 1.15, duration: 1.3, ease: 'power1.in' });
      });

      // 3b. Brand badges — gentle vertical drift (inner layer). The mouse
      //     parallax (outer layer) is added in the desktop branch below.
      gsap.utils.toArray('.lc-brand-inner').forEach((el, i) => {
        gsap.to(el, {
          y: '+=12',
          duration: 3 + i * 0.4,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });

      // ─────────────────────────────────────────────────────────
      // SCROLL — feature cards, nav, background shift (all viewports)
      // ─────────────────────────────────────────────────────────

      // 6. Feature cards batch fade-up on scroll into view
      const features = gsap.utils.toArray('.lc-feature');
      if (features.length) {
        gsap.set(features, { y: 30, autoAlpha: 0 });
        ScrollTrigger.batch('.lc-feature', {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.6,
              ease: 'power3.out',
              stagger: 0.12,
            }),
        });
      }

      // 11. Nav shrink/elevate/blur after 100px scroll
      const nav = root.querySelector('[data-lc="nav"]');
      if (nav) {
        ScrollTrigger.create({
          trigger: root,
          start: 'top top-=100', // when the page has scrolled ~100px
          end: 'max',
          onToggle: (self) => nav.classList.toggle('nav-scrolled', self.isActive),
        });
      }

      // 9. Section background shift: lavender → white while the "how"
      //    section is in view, back to lavender otherwise.
      const how = root.querySelector('[data-lc="how"]');
      if (how) {
        const toWhite = () => gsap.to(root, { backgroundColor: BG_WHITE, duration: 0.6, overwrite: 'auto' });
        const toLavender = () => gsap.to(root, { backgroundColor: BG_LAVENDER, duration: 0.6, overwrite: 'auto' });
        ScrollTrigger.create({
          trigger: how,
          start: 'top 65%',
          end: 'bottom 35%',
          onEnter: toWhite,
          onEnterBack: toWhite,
          onLeave: toLavender,
          onLeaveBack: toLavender,
        });
      }

      // ─────────────────────────────────────────────────────────
      // Responsive: heavy interactions on desktop, light on mobile
      // ─────────────────────────────────────────────────────────
      const mm = gsap.matchMedia();

      // DESKTOP (fine pointer + wide): pinned scrub + cursor parallax + tilt
      mm.add('(min-width: 1024px) and (pointer: fine)', () => {
        // 5. "How it works" — pinned, scrubbed sequence. Each card slides up
        //    with a rotation that settles to 0, staggered.
        const steps = gsap.utils.toArray('.lc-step');
        if (how && steps.length) {
          steps.forEach((card, i) => {
            gsap.set(card, { autoAlpha: 0, y: 70, rotation: i % 2 ? 5 : -5 });
          });
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: how,
              start: 'top top',
              end: '+=' + steps.length * 320,
              pin: true,
              scrub: 0.6,
              anticipatePin: 1,
            },
          });
          steps.forEach((card, i) => {
            tl.to(
              card,
              { autoAlpha: 1, y: 0, rotation: 0, duration: 1, ease: 'back.out(1.3)' },
              i * 1.0, // sequential; settle-then-next
            ).to({}, { duration: 0.15 }); // small hold = the 0.15 stagger feel
          });
        }

        // 3. + 4. Cursor parallax (brand badges) and phone tilt
        const brands = gsap.utils.toArray('.lc-brand-outer');
        const xTo = brands.map((el) => gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }));
        const yTo = brands.map((el) => gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }));

        const phone = root.querySelector('[data-lc="phone"]');
        let rotX = null, rotY = null;
        if (phone) {
          gsap.set(phone, { transformPerspective: 800, transformOrigin: 'center' });
          rotX = gsap.quickTo(phone, 'rotationX', { duration: 0.5, ease: 'power3.out' });
          rotY = gsap.quickTo(phone, 'rotationY', { duration: 0.5, ease: 'power3.out' });
        }

        onMove = (e) => {
          const nx = e.clientX / window.innerWidth - 0.5;  // -0.5..0.5
          const ny = e.clientY / window.innerHeight - 0.5;
          brands.forEach((_, i) => {
            const depth = ((i % 3) + 1) * 10; // varied parallax depth
            xTo[i](nx * depth * sign);
            yTo[i](ny * depth);
          });
          if (phone && rotX) {
            const pr = phone.getBoundingClientRect();
            const px = (e.clientX - (pr.left + pr.width / 2)) / (pr.width / 2);
            const py = (e.clientY - (pr.top + pr.height / 2)) / (pr.height / 2);
            rotY(gsap.utils.clamp(-6, 6, px * 6) * sign);
            rotX(gsap.utils.clamp(-6, 6, -py * 6));
          }
        };
        window.addEventListener('mousemove', onMove);

        // cleanup for this media branch
        return () => {
          if (onMove) window.removeEventListener('mousemove', onMove);
          onMove = null;
        };
      });

      // MOBILE / no fine pointer: light fade-up for the steps (no pin)
      mm.add('(max-width: 1023px)', () => {
        const steps = gsap.utils.toArray('.lc-step');
        if (!steps.length) return;
        gsap.set(steps, { y: 30, autoAlpha: 0 });
        ScrollTrigger.batch('.lc-step', {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', stagger: 0.15 }),
        });
      });
    }, root);

    // Single cleanup: revert the context (kills all tweens + ScrollTriggers
    // + matchMedia created inside) and drop the global listener as a backup.
    return () => {
      if (onMove) window.removeEventListener('mousemove', onMove);
      ctx.revert();
    };
  }, [lang, dir, rootRef]);
}
