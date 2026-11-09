const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Set up DOM & browser globals for Node.js
const listeners = new Map();
const sessionStore = new Map();

global.location = { hostname: 'zyntrixly.app' }; // production host to activate safe logger
global.sessionStorage = {
  setItem: (k, v) => sessionStore.set(k, String(v)),
  getItem: (k) => sessionStore.has(k) ? sessionStore.get(k) : null,
  removeItem: (k) => sessionStore.delete(k),
  clear: () => sessionStore.clear()
};
global.document = {
  hidden: false,
  addEventListener: (event, handler) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  }
};
global.window = {
  addEventListener: (event, handler) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  }
};

// Capture underlying console log output
let capturedLogs = [];
const baseLog = console.log;
console.log = function(...args) {
  capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

// Read and execute security.js in our configured environment
const securitySource = fs.readFileSync('security.js', 'utf8');
const loadSecurity = new Function(securitySource + '; return { ZxKeyStore, ZxSanitizer: typeof ZxSanitizer !== "undefined" ? ZxSanitizer : null };');
const { ZxKeyStore, ZxSanitizer } = loadSecurity();

test('SEC-01: Safe Logger Redacts Hex, Base64, Bearer, and JWK Exponents', () => {
  capturedLogs = [];

  // 1. Hex key >= 32 chars
  console.log('API key is a1b2c3d4e5f60718293a4b5c6d7e8f9012345678');
  assert.match(capturedLogs[0], /\[KEY_REDACTED\]/);
  assert.ok(!capturedLogs[0].includes('a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'));

  // 2. Base64 payload >= 64 chars
  const longB64 = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODk+/=';
  console.log('Secret payload: ' + longB64);
  assert.match(capturedLogs[1], /\[B64_REDACTED\]/);

  // 3. Bearer Token
  console.log('Authorization header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret');
  assert.match(capturedLogs[2], /Bearer \[TOKEN_REDACTED\]/);

  // 4. JWK Private Exponent
  console.log('Private exponent: "d":"superSecretPrivateExponentValue1234567890"');
  assert.match(capturedLogs[3], /"\[JWK_FIELD\]":"\[REDACTED\]"/);

  // 5. Sensitive object containing JWK fields
  console.log({ d: 'abcdefghijklmnop1234567890', alg: 'RSA-OAEP-256' });
  assert.match(capturedLogs[4], /\[Object containing sensitive fields — display suppressed\]/);
});

test('SEC-02: ZxKeyStore Initialization, Rotation, and Backup Promotion', () => {
  // Arrange
  const keys = ['primary-key-abc', 'backup-key-def', 'spare-key-ghi'];
  ZxKeyStore.init(keys);

  // Act & Assert 1: Primary key returned first
  assert.strictEqual(ZxKeyStore.getCurrent(), 'primary-key-abc');
  assert.strictEqual(ZxKeyStore.activeCount(), 3);

  // Act 2: Invalidate primary key on failure
  ZxKeyStore.invalidate('primary-key-abc');

  // Assert 2: Rotated to backup key
  assert.strictEqual(ZxKeyStore.getCurrent(), 'backup-key-def');
  assert.strictEqual(ZxKeyStore.activeCount(), 2);

  // Act 3: Add new key
  ZxKeyStore.addKey('new-key-jkl');
  assert.strictEqual(ZxKeyStore.getCurrent(), 'new-key-jkl');
});

test('SEC-03: ZxKeyStore fetchWithRotation Transparent Failover', async () => {
  // Arrange
  ZxKeyStore.init(['failing-key-1', 'succeeding-key-2']);
  let attempt = 0;

  global.fetch = async (url, opts) => {
    attempt++;
    const authHeader = opts?.headers?.Authorization;
    if (authHeader === 'Bearer failing-key-1') {
      return { status: 401, ok: false };
    }
    return { status: 200, ok: true, text: async () => 'Success!' };
  };

  const injector = (opts, key) => {
    opts.headers = { ...opts.headers, Authorization: 'Bearer ' + key };
    return opts;
  };

  // Act
  const response = await ZxKeyStore.fetchWithRotation('https://api.zyntrixly.app/test', {}, injector);

  // Assert
  assert.strictEqual(response.status, 200);
  assert.strictEqual(attempt, 2, 'Should have attempted twice (failover to backup)');
  assert.strictEqual(ZxKeyStore.getCurrent(), 'succeeding-key-2');
});

test('SEC-04: Session Guard Clears Stored Password on Extended Inactivity', () => {
  // Arrange
  sessionStore.clear();
  global.sessionStorage.setItem('zx_p', 'user_master_password');
  assert.strictEqual(global.sessionStorage.getItem('zx_p'), 'user_master_password');

  const visHandlers = listeners.get('visibilitychange') || [];
  assert.ok(visHandlers.length > 0, 'Visibility change listener registered');

  // Act 1: Background page
  global.document.hidden = true;
  visHandlers.forEach(fn => fn());

  // Fast-forward time past 30-minute threshold (31 minutes)
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 31 * 60 * 1000;

    // Foreground page
    global.document.hidden = false;
    visHandlers.forEach(fn => fn());

    // Assert: Password cleared from session storage
    assert.strictEqual(global.sessionStorage.getItem('zx_p'), null, 'Password must be removed after 30+ minutes background idle');
  } finally {
    Date.now = realNow;
  }
});

test('SEC-05: Session Guard Clears Password on pagehide', () => {
  // Arrange
  global.sessionStorage.setItem('zx_p', 'active_vault_password');
  const pagehideHandlers = listeners.get('pagehide') || [];
  assert.ok(pagehideHandlers.length > 0, 'pagehide listener registered');

  // Act
  pagehideHandlers.forEach(fn => fn());

  // Assert
  assert.strictEqual(global.sessionStorage.getItem('zx_p'), null, 'Password must be wiped on page unload');
});


test('SEC-06: ZxSanitizer Neutralizes HTML and XSS Script Injection', () => {
  assert.ok(ZxSanitizer, 'ZxSanitizer should be defined');
  const dirty = '<script>alert(1)</script><img src=x onerror=alert(2)>Hello & Welcome!';
  const escaped = ZxSanitizer.escapeHtml(dirty);
  assert.ok(!escaped.includes('<script>'), 'Must escape script tags');
  assert.ok(escaped.includes('&lt;script&gt;'), 'Must convert to &lt;script&gt;');
  assert.ok(escaped.includes('&amp;'), 'Must escape ampersand');

  assert.strictEqual(ZxSanitizer.isSafeUrl('javascript:alert(1)'), false);
  assert.strictEqual(ZxSanitizer.isSafeUrl('https://zyntrixly.app'), true);
  assert.strictEqual(ZxSanitizer.isSafeUrl('data:text/html,<script>alert(1)</script>'), false);
});

test('SEC-07: ZxSanitizer Rejects Reaction Injections and Validates Unicode Emojis', () => {
  assert.ok(ZxSanitizer, 'ZxSanitizer should be defined');
  const knownMap = { thumb: '👍', heart: '❤️' };
  
  // Known codes
  assert.strictEqual(ZxSanitizer.sanitizeReactionKey('heart', knownMap), '❤️');
  
  // Direct valid unicode emojis
  assert.strictEqual(ZxSanitizer.sanitizeReactionKey('🚀'), '🚀');
  assert.strictEqual(ZxSanitizer.sanitizeReactionKey('🔥'), '🔥');
  
  // Dangerous XSS injection payloads must be safely stripped and fall back
  const attackPayload = '<img src=x onerror=alert("hacked")>';
  const sanitized = ZxSanitizer.sanitizeReactionKey(attackPayload, knownMap);
  assert.strictEqual(sanitized, '👍', 'Malicious string must be rejected and fall back safely');
});

test.after(() => {
  console.log = baseLog;
});
