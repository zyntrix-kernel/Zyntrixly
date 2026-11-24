/* ═════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — PANIC LOCK
   One gesture, total cover: Ctrl+Shift+L (or Cmd+Shift+L) drops an opaque
   vault door over the client, mutes the cipher ticker only on unlock, and
   requires re-authentication (Firebase reauth when signed in; reload as the
   local fallback). Optional idle auto-lock, default 15 minutes, stored in
   localStorage (zx_v10_idle_minutes, 0 = off).
   Exposes: window.ZxPanic
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const IDLE_KEY = 'zx_v10_idle_minutes';
  const DEFAULT_IDLE_MIN = 15;

  let root = null;
  let locked = false;
  let idleTimer = null;
  let rainTimer = null;
  let lastActivity = Date.now();

  const CIPHER_CHARS = '0123456789abcdef';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ── Cipher rain (the vault door's texture) ────────────────── */
  function startRain() {
    stopRain();
    const el = root.querySelector('#v10-lock-cipher');
    if (!el) return;
    rainTimer = setInterval(() => {
      let s = '';
      for (let i = 0; i < 54; i++) s += CIPHER_CHARS[(Math.random() * 16) | 0];
      el.textContent = s;
    }, 110);
  }

  function stopRain() {
    if (rainTimer) { clearInterval(rainTimer); rainTimer = null; }
  }

  /* ── DOM ──────────────────────────────────────────────── */
  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'v10-lock';
    root.id = 'v10-lock';
    root.innerHTML = `
      <div class="sigil" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none"/></svg>
      </div>
      <div class="word">Locked</div>
      <div class="line" id="v10-lock-line">This client is sealed. Re-authenticate to continue.</div>
      <div class="cipher" id="v10-lock-cipher" aria-hidden="true"></div>
      <div class="unlock" id="v10-lock-unlock">
        <input id="v10-lock-pwd" type="password" placeholder="Account password" autocomplete="current-password"/>
        <button class="btn btn-default" id="v10-lock-go">Unlock</button>
      </div>
      <div class="line" id="v10-lock-alt" style="display:none">
        Firebase session unavailable in this context —
        <button class="btn btn-sm btn-outline" id="v10-lock-reload" style="margin-left:6px">Reload to unlock</button>
      </div>`;
    document.body.appendChild(root);

    root.querySelector('#v10-lock-go').addEventListener('click', attemptUnlock);
    root.querySelector('#v10-lock-pwd').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptUnlock();
    });
    root.querySelector('#v10-lock-reload').addEventListener('click', () => location.reload());
  }

  /* ── Lock / unlock ───────────────────────────────────────── */
  function lock() {
    ensureDom();
    if (locked) return;
    locked = true;
    root.classList.add('on');
    startRain();
    const pwd = root.querySelector('#v10-lock-pwd');
    const fbAuthReady = typeof window.firebase !== 'undefined' &&
      window.firebase.auth && window.firebase.auth().currentUser;
    root.querySelector('#v10-lock-unlock').style.display = fbAuthReady ? 'flex' : 'none';
    root.querySelector('#v10-lock-alt').style.display = fbAuthReady ? 'none' : 'block';
    if (fbAuthReady) setTimeout(() => pwd.focus(), 120);
    if (window.ZxMotion && !window.ZxMotion.reduced() && window.gsap) {
      gsap.fromTo(root.querySelector('.sigil'), { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' });
    }
  }

  function attemptUnlock() {
    if (!root || !locked) return;
    const pwdInput = root.querySelector('#v10-lock-pwd');
    const line = root.querySelector('#v10-lock-line');
    const pwd = pwdInput.value;
    if (!pwd) { pwdInput.focus(); return; }

    try {
      const user = window.firebase.auth().currentUser;
      const cred = window.firebase.auth.EmailAuthProvider.credential(user.email, pwd);
      user.reauthenticateWithCredential(cred).then(() => {
        unlock();
      }).catch(() => {
        line.textContent = 'That password did not open the vault. Try again.';
        if (window.ZxMotion && window.gsap && !window.ZxMotion.reduced()) {
          gsap.fromTo(pwdInput, { x: -7 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        }
        pwdInput.value = '';
        pwdInput.focus();
      });
    } catch (e) {
      console.error('[V10 PanicLock]', e);
      line.textContent = 'Re-authentication failed — reload to unlock.';
    }
  }

  function unlock() {
    locked = false;
    stopRain();
    root.classList.remove('on');
    const pwdInput = root.querySelector('#v10-lock-pwd');
    if (pwdInput) pwdInput.value = '';
    const line = root.querySelector('#v10-lock-line');
    if (line) line.textContent = 'This client is sealed. Re-authenticate to continue.';
    touch();
    window.toast && window.toast('Vault open. Welcome back.');
  }

  /* ── Idle auto-lock ───────────────────────────────────────── */
  function idleMinutes() {
    const v = parseInt(localStorage.getItem(IDLE_KEY), 10);
    return Number.isFinite(v) ? v : DEFAULT_IDLE_MIN;
  }

  function setIdleMinutes(m) {
    try { localStorage.setItem(IDLE_KEY, String(m)); } catch (e) { /* ignore */ }
    armIdle();
  }

  function touch() { lastActivity = Date.now(); }

  function armIdle() {
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    const min = idleMinutes();
    if (!min || min <= 0) return;
    idleTimer = setInterval(() => {
      if (locked) return;
      if (document.visibilityState !== 'visible') { lock(); return; }
      if (Date.now() - lastActivity > min * 60 * 1000) lock();
    }, 20000);
  }

  ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(ev =>
    document.addEventListener(ev, touch, { passive: true }));

  /* ── Global shortcut: Ctrl/Cmd + Shift + L ────────────────── */
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      // Avoid colliding with browser/OS combos that use Ctrl+Shift+L
      if (!e.altKey) { e.preventDefault(); lock(); }
    }
  });

  /* ── Boot ─────────────────────────────────────────────── */
  armIdle();

  window.ZxPanic = {
    version: '10.0.0',
    lock,
    unlock,
    isLocked: () => locked,
    idleMinutes,
    setIdleMinutes
  };
})();
