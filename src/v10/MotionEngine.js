/* ═════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — MOTION ENGINE (GSAP core)
   The Darkroom moves quietly: one entrance, quiet answers to the pointer,
   and the signature "decryption" scramble. Everything rests under
   prefers-reduced-motion. Self-hosted GSAP (vendor/gsap).
   Exposes: window.ZxMotion
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const hasGSAP = () => typeof window.gsap !== 'undefined';

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ── The signature effect: text "decrypts" into place ────────── */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\|';
  const _running = new WeakMap();

  function decryptText(el, finalText, opts = {}) {
    if (!el) return Promise.resolve();
    const text = finalText !== undefined ? finalText : (el.dataset.decryptTarget || el.textContent || '');
    el.dataset.decryptTarget = text;

    if (reduced() || !hasGSAP()) { el.textContent = text; return Promise.resolve(); }
    if (_running.has(el)) { _running.get(el).kill(); }

    const state = { p: 0 };
    const tw = gsap.to(state, {
      p: 1,
      duration: opts.duration || 0.9,
      ease: 'power2.inOut'
    });
    _running.set(el, tw);

    const tick = setInterval(() => {
      const reveal = Math.floor(state.p * text.length);
      let out = text.slice(0, reveal);
      for (let i = reveal; i < text.length; i++) {
        const ch = text[i];
        out += (ch === ' ') ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
    }, 32);

    tw.eventCallback('onComplete', () => {
      clearInterval(tick);
      el.textContent = text;
      _running.delete(el);
      if (opts.onDone) opts.onDone();
    });
    return tw.then ? tw : Promise.resolve();
  }

  /* ── Boot choreography: the vault opening ─────────────────────── */
  function boot() {
    if (reduced() || !hasGSAP()) return;
    const icon = document.querySelector('.startup-icon-wrap');
    const title = document.querySelector('.startup-title');
    const sub = document.querySelector('.startup-sub');
    const dots = document.querySelector('.startup-dots');

    if (icon) {
      gsap.fromTo(icon,
        { scale: 0.82, opacity: 0, filter: 'blur(8px)' },
        { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.85, ease: 'power3.out', clearProps: 'filter' });
    }
    if (title) {
      gsap.fromTo(title, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay: 0.18, ease: 'power3.out' });
      if (title.firstElementChild) decryptText(title.firstElementChild, title.firstElementChild.textContent, { duration: 1.1 });
    }
    if (sub) {
      gsap.fromTo(sub, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 0.42, ease: 'power3.out', clearProps: 'transform' });
    }
    if (dots) {
      gsap.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.6 });
    }
  }

  /* ── Screen transitions (auth -> app) ─────────────────────── */
  function screenIn(el) {
    if (!el || reduced() || !hasGSAP()) return;
    gsap.fromTo(el, { opacity: 0, y: 12, scale: 0.995 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform,filter' });
  }

  function staggerIn(els, opts = {}) {
    if (!els || !els.length || reduced() || !hasGSAP()) return;
    gsap.fromTo(els, { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, stagger: opts.stagger || 0.045, ease: 'power3.out', clearProps: 'transform' });
  }

  /* ── Message bubble pop (entrance, once) ─────────────────────── */
  function pop(el) {
    if (!el || reduced() || !hasGSAP()) return;
    if (el.dataset.v10Popped) return;
    el.dataset.v10Popped = '1';
    gsap.fromTo(el, { opacity: 0, y: 8, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'back.out(1.7)', clearProps: 'transform' });
  }

  /* ── Modal / panel entrances ─────────────────────────────── */
  function panelIn(el) {
    if (!el || reduced() || !hasGSAP()) return;
    gsap.fromTo(el, { opacity: 0, y: -10, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out', clearProps: 'transform' });
  }

  /* ── Magnetic hover (max ±2px — never a tilt) ────────────────── */
  const _magnetized = new WeakSet();
  function magnetize(els) {
    if (!hasGSAP() || reduced()) return;
    (els || []).forEach((el) => {
      if (!el || _magnetized.has(el)) return;
      _magnetized.add(el);
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 4;   // ±2px
        const dy = ((e.clientY - (r.top + r.height / 2)) / r.height) * 4;
        gsap.to(el, { x: Math.max(-2, Math.min(2, dx)), y: Math.max(-2, Math.min(2, dy)), duration: 0.3, ease: 'power2.out' });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
      });
    });
  }

  /* ── Auto-magnetize matching controls anywhere in the app ────── */
  function magnetizeAll(root) {
    magnetize((root || document).querySelectorAll('.btn-default, .auth-btn.btn-default, .rail-item, .v10-dock-btn'));
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.ZxMotion = {
    version: '10.0.0',
    decryptText,
    boot,
    screenIn,
    staggerIn,
    pop,
    panelIn,
    magnetize,
    magnetizeAll,
    reduced
  };
})();
