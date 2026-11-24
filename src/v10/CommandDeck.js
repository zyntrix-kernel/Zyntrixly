/* ═════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — COMMAND DECK v2
   The keyboard-first cockpit: one palette for everything in the private OS.
   Fuzzy matching, grouped actions, arrow-key navigation, recent commands.
   Overrides the legacy palette entry points (openCommandPalette etc.),
   keeps every legacy command, adds the V10 command surface.
   Exposes: window.ZxDeck
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RECENT_KEY = 'zx_v10_deck_recent';
  const MAX_VISIBLE = 24;

  const state = { open: false, sel: 0, items: [], query: '' };
  let root = null;

  const svg = {
    search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    dm: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    group: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    gear: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    palette: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20v-20z"/></svg>',
    shield: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    lock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    vault: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M12 12v2M10.5 14h3"/></svg>',
    spark: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2"/></svg>',
    grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    compass: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>',
    chip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>',
    spark2: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>'
  };

  /* ── Registry ─────────────────────────────────────────────── */
  function registry() {
    const has = (fn) => typeof window[fn] === 'function';
    const run = (fn, ...a) => { if (has(fn)) window[fn](...a); else if (window.toast) window.toast('Not available yet'); };

    return [
      // NAVIGATE
      { g: 'Navigate', label: 'Go to Chats', kw: 'home chats direct messages list', ic: svg.dm, hint: '', act: () => run('ZxNavGoHome') },
      { g: 'Navigate', label: 'Open Settings', kw: 'preferences options configure', ic: svg.gear, act: () => run('openSettings') },
      { g: 'Navigate', label: 'Appearance & Themes', kw: 'theme look dark accent skin', ic: svg.palette, act: () => { run('openSettings'); setTimeout(() => run('openSettingsView', 'appearance'), 60); } },
      { g: 'Navigate', label: 'Linked Devices & Sessions', kw: 'devices sessions pairing', ic: svg.chip, act: () => { run('openSettings'); setTimeout(() => run('openSettingsView', 'devices'), 60); } },

      // CREATE
      { g: 'Create', label: 'Start New Direct Message', kw: 'new dm message person write', ic: svg.dm, act: () => { run('openModal', 'nc-modal'); run('switchMTab', 0); } },
      { g: 'Create', label: 'Create New Group Conversation', kw: 'new group team circle', ic: svg.group, act: () => { run('openModal', 'nc-modal'); run('switchMTab', 1); } },
      { g: 'Create', label: 'Create Community Space', kw: 'space community server create', ic: svg.grid, act: () => run('openNewSpaceModal') },
      { g: 'Create', label: 'Explore Communities', kw: 'explore discover spaces browse', ic: svg.compass, act: () => run('openExploreSpaces') },

      // VAULT
      { g: 'Vault', label: 'Open the Encrypted Vault', kw: 'vault files storage encrypted drop upload', ic: svg.vault, hint: 'V', act: () => window.ZxVault && window.ZxVault.open() },

      // INTELLIGENCE
      { g: 'Intelligence', label: 'Open AI Concierge (on-device)', kw: 'ai assistant summarize catch up search local', ic: svg.spark, hint: 'A', act: () => window.ZxConcierge && window.ZxConcierge.open() },

      // SECURITY
      { g: 'Security', label: 'Panic Lock — Lock It Down Now', kw: 'lock panic hide secure instant shutdown', ic: svg.lock, hint: 'L', act: () => window.ZxPanic && window.ZxPanic.lock() },
      { g: 'Security', label: 'Copy Cryptographic Safety Number', kw: 'safety number verify fingerprint identity', ic: svg.shield, act: () => run('copySafetyNumber') },
      { g: 'Security', label: 'Purge Decrypted Local Cache', kw: 'purge cache wipe shred clean', ic: svg.trash, act: () => run('purgeLocalCache') },

      // SYSTEM
      { g: 'System', label: 'Toggle Motion Effects', kw: 'motion animation reduce movement', ic: svg.spark2, act: () => toggleMotion() },
      { g: 'System', label: 'Toggle Fullscreen', kw: 'fullscreen expand maximize', ic: svg.grid, act: () => run('toggleFullscreen') },
      { g: 'System', label: 'About Zyntrixly 10', kw: 'about version info v10 sovereign', ic: svg.shield, act: () => aboutV10() }
    ];
  }

  function toggleMotion() {
    const html = document.documentElement;
    if (html.dataset.v10Motion === 'off') {
      delete html.dataset.v10Motion;
      window.toast && window.toast('Motion on — the Darkroom moves');
    } else {
      html.dataset.v10Motion = 'off';
      window.toast && window.toast('Motion off — everything rests');
    }
  }

  function aboutV10() {
    if (window.toast) window.toast('Zyntrixly 10 — The Sovereign Client. One client, zero knowledge.');
  }

  // Bridge: legacy app.js exposes ZxNav.switchToHome; make a callable alias
  function ensureNavAlias() {
    if (!window.ZxNavGoHome && window.ZxNav && typeof window.ZxNav.switchToHome === 'function') {
      window.ZxNavGoHome = () => window.ZxNav.switchToHome();
    }
  }

  /* ── Fuzzy match: subsequence + score ─────────────────────── */
  function fuzzy(q, str) {
    if (!q) return 1;
    const s = str.toLowerCase();
    const query = q.toLowerCase();
    let qi = 0, score = 0, streak = 0;
    for (let i = 0; i < s.length && qi < query.length; i++) {
      if (s[i] === query[qi]) {
        qi++; streak++;
        score += 2 + streak + (i === 0 || s[i - 1] === ' ' ? 4 : 0);
      } else streak = 0;
    }
    if (qi < query.length) return 0;
    return score;
  }

  function search(query) {
    const reg = registry();
    if (!query.trim()) return reg;
    const scored = reg.map(it => {
      const a = fuzzy(query, it.label);
      const b = fuzzy(query, it.kw || '') * 0.6;
      return { it, sc: Math.max(a, b) };
    }).filter(x => x.sc > 0);
    scored.sort((x, y) => y.sc - x.sc);
    return scored.slice(0, MAX_VISIBLE).map(x => x.it);
  }

  function recents() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
  }

  function pushRecent(id) {
    try {
      const r = recents().filter(x => x !== id);
      r.unshift(id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5)));
    } catch (e) { /* private mode */ }
  }

  /* ── DOM ──────────────────────────────────────────────── */
  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'v10-deck hidden';
    root.id = 'v10-deck';
    root.innerHTML = `
      <div class="v10-deck-panel" role="dialog" aria-label="Command Deck">
        <div class="v10-deck-head">
          ${svg.search}
          <input class="v10-deck-input" id="v10-deck-inp" type="text" placeholder="Search the private OS..." autocomplete="off" spellcheck="false"/>
          <span class="v10-deck-esc">ESC</span>
        </div>
        <div class="v10-deck-list" id="v10-deck-list" role="listbox"></div>
        <div class="v10-deck-foot">
          <span>Zyntrixly 10 · Command Deck</span><span class="dot"></span>
          <span>&uarr;&darr; navigate</span><span class="dot"></span>
          <span>&crarr; run</span><span class="dot"></span>
          <span>&#8984;K anywhere</span>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
    const inp = root.querySelector('#v10-deck-inp');
    inp.addEventListener('input', () => { state.query = inp.value; render(); });
    inp.addEventListener('keydown', onKey);
  }

  function render() {
    const list = root.querySelector('#v10-deck-list');
    let items = search(state.query);

    // recents first on empty query
    if (!state.query.trim()) {
      const rec = recents();
      const reg = registry();
      const recItems = rec.map(id => reg.find(i => i.label === id)).filter(Boolean);
      const rest = reg.filter(i => !recItems.includes(i));
      items = [...recItems, ...rest];
    }

    state.items = items;
    state.sel = Math.min(state.sel, Math.max(0, items.length - 1));
    list.innerHTML = '';

    if (!items.length) {
      list.innerHTML = '<div class="v10-deck-empty">Nothing matches. The OS stays quiet.</div>';
      return;
    }

    let lastG = null;
    items.forEach((item, idx) => {
      if (item.g !== lastG) {
        lastG = item.g;
        const gh = document.createElement('div');
        gh.className = 'v10-deck-group';
        gh.textContent = item.g;
        list.appendChild(gh);
      }
      const b = document.createElement('button');
      b.className = 'v10-deck-item' + (idx === state.sel ? ' sel' : '');
      b.setAttribute('role', 'option');
      b.innerHTML = `<span class="v10-deck-ic">${item.ic}</span><span>${item.label}</span>` +
        (item.hint ? `<span class="v10-deck-hint">⇧${item.hint}</span>` : '');
      b.onmouseenter = () => { state.sel = idx; paintSel(); };
      b.onclick = () => runItem(item);
      list.appendChild(b);
    });
  }

  function paintSel() {
    root.querySelectorAll('.v10-deck-item').forEach((el, idx) => {
      el.classList.toggle('sel', idx === state.sel);
    });
    const sel = root.querySelector('.v10-deck-item.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function runItem(item) {
    pushRecent(item.label);
    close();
    try { item.act(); } catch (e) { console.error('[V10 Deck]', e); window.toast && window.toast('Command failed — see console'); }
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); state.sel = Math.min(state.sel + 1, state.items.length - 1); paintSel(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); state.sel = Math.max(state.sel - 1, 0); paintSel(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = state.items[state.sel]; if (it) runItem(it); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  function open() {
    ensureDom();
    ensureNavAlias();
    // close legacy palette if it ever opened
    const legacy = document.getElementById('cmd-palette');
    if (legacy) legacy.classList.add('hidden');
    state.open = true; state.sel = 0; state.query = '';
    root.classList.remove('hidden');
    const inp = root.querySelector('#v10-deck-inp');
    inp.value = '';
    render();
    setTimeout(() => inp.focus(), 0);
    if (window.ZxMotion) window.ZxMotion.panelIn(root.querySelector('.v10-deck-panel'));
  }

  function close() {
    state.open = false;
    if (root) root.classList.add('hidden');
  }

  function toggle() { state.open ? close() : open(); }
  function isOpen() { return state.open; }

  /* ── Own Escape handling (independent of legacy app.js) ────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);

  /* ── Overrides of legacy entry points ─────────────────────── */
  window.openCommandPalette = open;
  window.closeCommandPalette = close;

  window.ZxDeck = { version: '10.0.0', open, close, toggle, isOpen, registry };
})();
