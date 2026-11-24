/* ═════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — THE VAULT
   A private file room inside the client. Every file is encrypted with a
   fresh AES-256-GCM key on this device (via ZxBlobEngine) before it is
   stored in IndexedDB. Keys live beside the ciphertext, which never leaves
   the browser profile. No upload, no relay, no telemetry.
   Exposes: window.ZxVault
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const DB_NAME = 'zx_vault_v10';
  const STORE = 'files';
  const state = { db: null, items: [] };
  let root = null;

  /* ── IndexedDB ─────────────────────────────────────────────── */
  function db() {
    if (state.db) return Promise.resolve(state.db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => { state.db = req.result; res(state.db); };
      req.onerror = () => rej(req.error);
    });
  }

  function tx(mode) {
    return db().then(d => d.transaction(STORE, mode).objectStore(STORE));
  }

  function put(rec) {
    return tx('readwrite').then(s => new Promise((res, rej) => {
      const r = s.put(rec); r.onsuccess = res; r.onerror = () => rej(r.error);
    }));
  }

  function all() {
    return tx('readonly').then(s => new Promise((res, rej) => {
      const r = s.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    }));
  }

  function get(id) {
    return tx('readonly').then(s => new Promise((res, rej) => {
      const r = s.get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  }

  function del(id) {
    return tx('readwrite').then(s => new Promise((res, rej) => {
      const r = s.delete(id); r.onsuccess = res; r.onerror = () => rej(r.error);
    }));
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function iconFor(type) {
    if (type.startsWith('image/')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    if (type.startsWith('video/')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
    if (type.startsWith('audio/')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  }

  /* ── Actions ─────────────────────────────────────────────── */
  async function addFiles(fileList) {
    const engine = window.ZxBlobEngine;
    if (!engine) { window.toast && window.toast('Vault engine unavailable in this build'); return; }
    const files = Array.from(fileList || []);
    if (!files.length) return;

    for (const f of files) {
      try {
        window.toast && window.toast('Encrypting ' + f.name + '...');
        const enc = await engine.encryptBlob(f);
        await put({
          id: uid(),
          name: f.name || 'file',
          size: f.size,
          mimeType: enc.mimeType || f.type || 'application/octet-stream',
          ts: Date.now(),
          blob: enc.encryptedBlob,
          keyHex: enc.keyHex,
          ivHex: enc.ivHex
        });
      } catch (e) {
        console.error('[V10 Vault] encrypt failed', e);
        window.toast && window.toast('Could not encrypt ' + f.name);
      }
    }
    window.toast && window.toast(files.length + ' file' + (files.length > 1 ? 's' : '') + ' sealed in the vault');
    await refresh();
  }

  async function download(id) {
    try {
      const engine = window.ZxBlobEngine;
      const rec = await get(id);
      if (!rec || !engine) return;
      const plain = await engine.decryptBlob(rec.blob, rec.keyHex, rec.ivHex, rec.mimeType);
      const url = engine.createTrackedUrl(plain);
      const a = document.createElement('a');
      a.href = url;
      a.download = rec.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.toast && window.toast('Decrypted locally: ' + rec.name);
    } catch (e) {
      console.error('[V10 Vault] decrypt failed', e);
      window.toast && window.toast('Decryption failed for this file');
    }
  }

  async function remove(id) {
    try {
      const rec = await get(id);
      await del(id);
      window.toast && window.toast('Shredded: ' + (rec ? rec.name : 'file'));
      await refresh();
    } catch (e) {
      console.error('[V10 Vault] delete failed', e);
    }
  }

  async function refresh() {
    if (!root) return;
    const listEl = root.querySelector('#v10-vault-list');
    const fill = root.querySelector('#v10-quota-fill');
    const usageEl = root.querySelector('#v10-quota-usage');

    let items = [];
    try { items = await all(); } catch (e) { items = []; }
    items.sort((a, b) => b.ts - a.ts);
    state.items = items;

    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<div class="v10-vault-empty">Nothing in the vault yet.<br/>Drop a file above — it is sealed before it is stored.</div>';
    } else {
      items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'v10-vault-item';
        row.innerHTML = `
          <div class="ic">${iconFor(it.mimeType || '')}</div>
          <div class="meta">
            <div class="nm">${esc(it.name)}</div>
            <div class="sz">${fmtSize(it.size)} · ${new Date(it.ts).toLocaleDateString()}</div>
          </div>
          <div class="act">
            <button title="Decrypt &amp; download" data-a="dl">&#8681;</button>
            <button title="Shred permanently" data-a="rm" class="del">&#10005;</button>
          </div>`;
        row.querySelector('[data-a="dl"]').onclick = () => download(it.id);
        row.querySelector('[data-a="rm"]').onclick = () => remove(it.id);
        listEl.appendChild(row);
      });
    }

    // quota
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        const used = est.usage || 0, quota = est.quota || 1;
        if (fill) fill.style.width = Math.min(100, (used / quota) * 100).toFixed(2) + '%';
        if (usageEl) usageEl.textContent = fmtSize(used) + ' of ' + fmtSize(quota) + ' browser storage';
      }).catch(() => {});
    }
  }

  /* ── DOM ──────────────────────────────────────────────── */
  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'v10-vault hidden';
    root.id = 'v10-vault';
    root.innerHTML = `
      <div class="v10-vault-panel" role="dialog" aria-label="Encrypted Vault">
        <div class="v10-vault-head">
          <span class="v10-kicker">The Vault</span>
          <button class="v10-vault-x" title="Close" aria-label="Close vault">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="v10-vault-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>AES-256-GCM on this device. Files never leave the browser profile.</span>
        </div>
        <div class="v10-vault-drop" id="v10-vault-drop" tabindex="0" role="button" aria-label="Add files to the vault">
          Drop files here, or <b>click to seal</b> a file into the vault
        </div>
        <div class="v10-vault-list" id="v10-vault-list"></div>
        <div class="v10-vault-foot">
          <div class="v10-quota">
            <span id="v10-quota-usage">Measuring storage...</span>
            <div class="bar"><div class="fill" id="v10-quota-fill" style="width:0%"></div></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);

    const drop = root.querySelector('#v10-vault-drop');
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    root.appendChild(input);

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation(); drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
    }));
    drop.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    // global drag & drop anywhere -> vault (only when vault is open)
    document.addEventListener('dragover', (e) => {
      if (root && !root.classList.contains('hidden')) e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      if (root && !root.classList.contains('hidden')) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      }
    });

    root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
    root.querySelector('.v10-vault-x').addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !root.classList.contains('hidden')) close();
    });
  }

  function open() {
    ensureDom();
    root.classList.remove('hidden');
    refresh();
    if (window.ZxMotion) window.ZxMotion.panelIn(root.querySelector('.v10-vault-panel'));
  }

  function close() {
    if (root) root.classList.add('hidden');
  }

  window.ZxVault = { version: '10.0.0', open, close, addFiles, refresh };
})();
