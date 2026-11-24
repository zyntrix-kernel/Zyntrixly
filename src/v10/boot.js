/* ═════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — BOOT
   Loads last (after app.js + webrtc.js). Wires the V10 layer into the
   running app without touching its core: theme flag, sidebar dock, screen
   transitions, message entrances, magnetic controls, version stamp.
   Exposes: window.ZxV10
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const VERSION = '10.0.0';

  document.documentElement.dataset.v10 = '10';

  const M = window.ZxMotion;

  /* ── 1. Sidebar dock: Vault / Concierge / Lock ─────────────── */
  const ICONS = {
    vault: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M12 12v2M10.5 14h3"/></svg>',
    conc: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
  };

  function injectDock() {
    const host = document.querySelector('.sb-hdr-right');
    if (!host || document.getElementById('v10-dock')) return;
    const dock = document.createElement('div');
    dock.className = 'v10-dock';
    dock.id = 'v10-dock';

    const mk = (id, title, icon, fn) => {
      const b = document.createElement('button');
      b.className = 'v10-dock-btn';
      b.id = id;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.innerHTML = icon;
      b.addEventListener('click', fn);
      return b;
    };

    dock.appendChild(mk('v10-dock-vault', 'Encrypted Vault (Ctrl+Shift+V)', ICONS.vault, () => window.ZxVault && window.ZxVault.open()));
    dock.appendChild(mk('v10-dock-conc', 'AI Concierge (Ctrl+Shift+A)', ICONS.conc, () => window.ZxConcierge && window.ZxConcierge.toggle()));
    dock.appendChild(mk('v10-dock-lock', 'Panic Lock (Ctrl+Shift+L)', ICONS.lock, () => window.ZxPanic && window.ZxPanic.lock()));

    host.insertBefore(dock, host.firstChild);
  }

  /* ── 2. Screen transitions ─────────────────────────────── */
  function wrapShowScreen() {
    if (typeof window.showScreen !== 'function' || window.showScreen._v10) return;
    const orig = window.showScreen;
    const wrapped = function (name) {
      orig(name);
      const el = document.getElementById(name);
      if (el) M.screenIn(el);
      if (name === 'app-screen') {
        // dock exists only once the app shell is on stage
        injectDock();
        M.magnetizeAll(document.getElementById('app-screen') || document);
        decryptChatName();
      }
    };
    wrapped._v10 = true;
    window.showScreen = wrapped;
  }

  /* ── 3. Chat header name decrypts on conversation switch ───── */
  let lastName = '';
  function decryptChatName() {
    const el = document.querySelector('.chat-hdr-name');
    if (!el) return;
    const name = el.textContent.trim();
    if (!name || name === lastName) return;
    lastName = name;
    M.decryptText(el, name, { duration: 0.55 });
  }
  setInterval(decryptChatName, 800);

  /* ── 4. Message bubbles: entrance pop, once ───────────────── */
  function observeMessages() {
    const wrap = document.getElementById('msgs-wrap');
    if (!wrap || wrap._v10Obs) return;
    wrap._v10Obs = true;
    const mo = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.classList && n.classList.contains('msg-row')) M.pop(n);
        });
      });
    });
    mo.observe(wrap, { childList: true });
  }
  // the chat pane exists from boot; retry briefly in case of late mount
  let tries = 0;
  const moTimer = setInterval(() => {
    observeMessages();
    if (++tries > 40) clearInterval(moTimer);
  }, 500);

  /* ── 5. Global V10 shortcuts ─────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || !e.shiftKey || e.altKey) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'v') { e.preventDefault(); window.ZxVault && window.ZxVault.open(); }
    else if (k === 'a') { e.preventDefault(); window.ZxConcierge && window.ZxConcierge.toggle(); }
  });

  /* ── 6. Auth screen: staggered entrance when visible ───────── */
  function choreographAuth() {
    const auth = document.getElementById('auth-screen');
    if (!auth) return;
    const mo = new MutationObserver(() => {
      if (!auth.classList.contains('hidden')) {
        M.staggerIn(auth.querySelectorAll('.auth-header, .field-wrap, .auth-toggle, .auth-btn'));
      }
    });
    mo.observe(auth, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── 7. Version stamp in sidebar + console banner ─────────── */
  function stampVersion() {
    const e2e = document.querySelector('.sb-e2e span');
    if (e2e && !document.getElementById('v10-stamp')) {
      const chip = document.createElement('span');
      chip.className = 'v10-chip';
      chip.id = 'v10-stamp';
      chip.textContent = 'V10';
      chip.style.marginLeft = '6px';
      e2e.parentElement.parentElement.appendChild(chip);
    }
  }

  /* ── Boot ─────────────────────────────────────────────── */
  function start() {
    M.boot();                    // startup choreography (if startup screen present)
    wrapShowScreen();
    choreographAuth();
    injectDock();                // in case app screen is already active
    stampVersion();
    M.magnetizeAll();
    console.log('%cZYNTRIXLY 10 — The Sovereign Client. One client, zero knowledge.',
      'color:#ff6a3d;font-weight:bold;letter-spacing:.05em');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.ZxV10 = { version: VERSION, bootedAt: Date.now() };
})();
