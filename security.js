// ════════════════════════════════════════════════
//  ZYNTRIXLY — security.js
//  • Sanitized console logging (no key leakage)
//  • API key rotation system
//  • Client-side security helpers
//
//  Loaded BEFORE app.js in index.html
// ════════════════════════════════════════════════

/* ── 1. SANITIZED LOGGER ─────────────────────────
   Replaces console methods to strip patterns that
   look like secrets before they reach DevTools.
   Patterns scrubbed: hex keys ≥32 chars, JWK
   objects, Bearer tokens, base64 blobs ≥64 chars.
─────────────────────────────────────────────── */
(function installSafeLogger() {
  const HEX32     = /\b[0-9a-fA-F]{32,}\b/g;
  const B64_LONG  = /[A-Za-z0-9+/]{64,}={0,2}/g;
  const BEARER    = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
  const JWK_KEY   = /"(d|dp|dq|qi|p|q|n|e)"\s*:\s*"[^"]{10,}"/g;

  function scrub(val) {
    if (typeof val === 'string') {
      return val
        .replace(HEX32,    '[KEY_REDACTED]')
        .replace(B64_LONG, '[B64_REDACTED]')
        .replace(BEARER,   'Bearer [TOKEN_REDACTED]')
        .replace(JWK_KEY,  '"[JWK_FIELD]":"[REDACTED]"');
    }
    if (val && typeof val === 'object') {
      // Don't mutate — return a safe string summary
      try {
        const s = JSON.stringify(val);
        if (HEX32.test(s) || JWK_KEY.test(s) || B64_LONG.test(s)) {
          return '[Object containing sensitive fields — display suppressed]';
        }
      } catch(_) {}
    }
    return val;
  }

  const _log   = console.log.bind(console);
  const _warn  = console.warn.bind(console);
  const _error = console.error.bind(console);
  const _info  = console.info.bind(console);

  function wrap(orig) {
    return function(...args) {
      orig(...args.map(scrub));
    };
  }

  // Only patch in production (non-localhost)
  if (!location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
    console.log   = wrap(_log);
    console.warn  = wrap(_warn);
    console.error = wrap(_error);
    console.info  = wrap(_info);
  }
})();


/* ── 2. API KEY ROTATION SYSTEM ──────────────────
   Manages rotating keys for any external service.
   Keys are never stored in source — set them via:
     ZxKeyStore.init([...keys])
   Called from app startup after loading env config.

   Rotation strategy:
   • primary  → used for all requests
   • backup   → used if primary returns 401/403
   • rotated  → retired keys kept for grace period
   • Keys expire after TTL_MS (default 24h)
   • Automatic fallback on invalid key detected
─────────────────────────────────────────────── */
const ZxKeyStore = (() => {
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  let _keys    = [];   // [{value, addedAt, active}]
  let _primary = null;
  let _backup  = null;

  function now() { return Date.now(); }

  function isExpired(entry) {
    return (now() - entry.addedAt) > TTL_MS;
  }

  function pruneExpired() {
    _keys = _keys.filter(k => !isExpired(k));
    if (_primary && isExpired(_primary)) {
      _primary = null;
    }
  }

  /**
   * Initialise the store with an array of key strings.
   * First key = primary, second = backup, rest = rotation pool.
   * @param {string[]} keys
   */
  function init(keys) {
    if (!Array.isArray(keys) || !keys.length) return;
    _keys = keys.map((value, i) => ({
      value,
      addedAt: now() - i * 1000, // stagger so primary is newest
      active: true
    }));
    _primary = _keys[0] || null;
    _backup  = _keys[1] || null;
  }

  /**
   * Get the current active key.
   * Auto-rotates if primary is expired or invalidated.
   * @returns {string|null}
   */
  function getCurrent() {
    pruneExpired();
    if (_primary?.active) return _primary.value;
    if (_backup?.active)  { promotBackup(); return _primary?.value || null; }
    const next = _keys.find(k => k.active && !isExpired(k));
    if (next) { _primary = next; return next.value; }
    return null;
  }

  function promotBackup() {
    _primary = _backup;
    _backup  = _keys.find(k => k !== _primary && k.active && !isExpired(k)) || null;
  }

  /**
   * Call this when a request fails with an auth error (401/403).
   * Marks the current key as invalid and rotates to the next.
   * @param {string} badKeyValue
   */
  function invalidate(badKeyValue) {
    const entry = _keys.find(k => k.value === badKeyValue);
    if (entry) entry.active = false;
    if (_primary?.value === badKeyValue) {
      _primary = null;
      promotBackup();
    }
    console.warn('[ZxKeyStore] Key invalidated, rotated to backup.');
  }

  /**
   * Add a new key to the rotation pool (e.g. after admin rotation).
   * @param {string} newKey
   */
  function addKey(newKey) {
    if (_keys.find(k => k.value === newKey)) return; // already present
    const entry = { value: newKey, addedAt: now(), active: true };
    _keys.unshift(entry);
    _primary = entry;
  }

  /**
   * Wrap a fetch call with automatic key rotation on 401/403.
   * @param {string} url
   * @param {RequestInit} options
   * @param {function} keyInjector  fn(options, key) → options
   * @returns {Promise<Response>}
   */
  async function fetchWithRotation(url, options = {}, keyInjector = null) {
    let key = getCurrent();
    if (!key) throw new Error('[ZxKeyStore] No active API key available.');

    let opts = keyInjector ? keyInjector({ ...options }, key) : options;
    let res  = await fetch(url, opts);

    if ((res.status === 401 || res.status === 403) && _backup) {
      const badKey = key;
      invalidate(badKey);
      key  = getCurrent();
      if (!key) throw new Error('[ZxKeyStore] All keys exhausted after rotation.');
      opts = keyInjector ? keyInjector({ ...options }, key) : options;
      res  = await fetch(url, opts);
    }

    return res;
  }

  /**
   * How many active, non-expired keys remain.
   */
  function activeCount() {
    pruneExpired();
    return _keys.filter(k => k.active).length;
  }

  return { init, getCurrent, invalidate, addKey, fetchWithRotation, activeCount };
})();


/* ── 3. SESSION GUARD ────────────────────────────
   Clears sensitive sessionStorage entries if the
   page has been backgrounded for > 30 minutes.
   Prevents stale passwords lingering in memory.
─────────────────────────────────────────────── */
(function sessionGuard() {
  const IDLE_LIMIT = 30 * 60 * 1000;
  let lastActive   = Date.now();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      lastActive = Date.now();
    } else {
      if (Date.now() - lastActive > IDLE_LIMIT) {
        sessionStorage.removeItem('zx_p');
      }
    }
  });

  // Also clear on page unload
  window.addEventListener('pagehide', () => {
    sessionStorage.removeItem('zx_p');
  });
})();


/* ── 4. CSP VIOLATION REPORTER ───────────────────
   Logs CSP violations in dev. Helps catch accidental
   inline script injection or mixed-content issues.
─────────────────────────────────────────────── */
document.addEventListener('securitypolicyviolation', e => {
  if (location.hostname.includes('localhost')) {
    console.warn('[CSP Violation]', e.violatedDirective, e.blockedURI);
  }
});
