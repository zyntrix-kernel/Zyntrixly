// ════════════════════════════════════════════════
//  ZYNTRIXLY — src/crypto/CryptoEngine.js
//  Zyntrixly 2.0 Cryptographic Engine
//  • Multi-Device Identity & Session Management
//  • Deterministic Safety Numbers (SHA-512)
//  • Group Key Epochs (Forward/Backward Secrecy)
//  • Out-of-band Recovery Keys (PBKDF2/AES-GCM)
//  • 100% Backward Compatible with Crypto v1.0
// ════════════════════════════════════════════════

const CryptoEngine = (() => {
  const getSubtle = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    throw new Error('WebCrypto subtle is not available in current environment');
  };

  const b64 = buf => {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buf).toString('base64');
    }
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  };

  const unb64 = s => {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(s, 'base64');
    }
    const b = atob(s);
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u.buffer;
  };

  // ── 1. BASE KEY GENERATION & WRAPPING (V1 Compatibility) ─────────
  async function generateKeyPair() {
    const subtle = getSubtle();
    const kp = await subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['encrypt', 'decrypt']
    );
    return {
      publicKeyJwk: await subtle.exportKey('jwk', kp.publicKey),
      privateKeyJwk: await subtle.exportKey('jwk', kp.privateKey)
    };
  }

  function saveLocal(uid, jwk) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('zx_pk_' + uid, JSON.stringify(jwk));
      }
    } catch (_) {}
  }

  function loadLocal(uid) {
    try {
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('zx_pk_' + uid);
        return r ? JSON.parse(r) : null;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  async function wrapKey(privJwk, password) {
    const subtle = getSubtle();
    const salt = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(16));
    const iv = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const km = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const aes = await subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
    );
    const enc = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(privJwk)));
    return { data: b64(enc), iv: b64(iv), salt: b64(salt) };
  }

  async function unwrapKey(wrapped, password) {
    try {
      const subtle = getSubtle();
      const km = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const aes = await subtle.deriveKey(
        { name: 'PBKDF2', salt: unb64(wrapped.salt), iterations: 200000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );
      const dec = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(wrapped.iv) }, aes, unb64(wrapped.data));
      return JSON.parse(new TextDecoder().decode(dec));
    } catch {
      return null;
    }
  }

  async function importPub(jwk) {
    return getSubtle().importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  }

  async function importPriv(jwk) {
    return getSubtle().importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  }

  async function encryptMsg(text, pubJwk) {
    const subtle = getSubtle();
    const pub = await importPub(pubJwk);
    const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const enc = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(text));
    const raw = await subtle.exportKey('raw', aes);
    const ek = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw);
    return { encMsg: b64(enc), encKey: b64(ek), iv: b64(iv) };
  }

  async function decryptMsg(encMsg, encKey, iv, privJwk) {
    const subtle = getSubtle();
    const priv = await importPriv(privJwk);
    const raw = await subtle.decrypt({ name: 'RSA-OAEP' }, priv, unb64(encKey));
    const aes = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
    const dec = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, aes, unb64(encMsg));
    return new TextDecoder().decode(dec);
  }

  async function encryptForGroup(text, pubKeysMap) {
    const subtle = getSubtle();
    const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const enc = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(text));
    const raw = await subtle.exportKey('raw', aes);
    const keys = {};
    for (const [uid, jwk] of Object.entries(pubKeysMap)) {
      try {
        const pub = await importPub(jwk);
        keys[uid] = b64(await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw));
      } catch (_) {}
    }
    return { encMsg: b64(enc), iv: b64(iv), keys };
  }

  // ── 2. MULTI-DEVICE MANAGEMENT ─────────────────────────────────
  async function generateDeviceIdentity(deviceId, deviceName = 'Web Browser') {
    const keyPair = await generateKeyPair();
    return {
      deviceId: deviceId || ('dev_' + Math.random().toString(36).substring(2, 10)),
      deviceName,
      publicKeyJwk: keyPair.publicKeyJwk,
      privateKeyJwk: keyPair.privateKeyJwk,
      keyVersion: 2,
      createdAt: Date.now(),
      trustStatus: 'trusted',
      revoked: false
    };
  }

  // ── 3. SAFETY NUMBERS / FINGERPRINTS (SHA-512) ──────────────────
  async function calculateSafetyNumber(pubKeyA, pubKeyB, uidA, uidB) {
    const subtle = getSubtle();
    // Deterministic sort order
    const firstIsA = (uidA || '') < (uidB || '');
    const user1 = firstIsA ? uidA : uidB;
    const user2 = firstIsA ? uidB : uidA;
    const key1 = firstIsA ? (pubKeyA?.n || '') : (pubKeyB?.n || '');
    const key2 = firstIsA ? (pubKeyB?.n || '') : (pubKeyA?.n || '');

    const seedString = `${user1}:${key1}|${user2}:${key2}`;
    const hashBuffer = await subtle.digest(
      'SHA-512',
      new TextEncoder().encode(seedString)
    );
    const hashBytes = new Uint8Array(hashBuffer);

    // Convert into 12 5-digit decimal blocks (60 digits total)
    const blocks = [];
    for (let i = 0; i < 12; i++) {
      const offset = i * 4;
      const num = ((hashBytes[offset] << 24) | (hashBytes[offset + 1] << 16) | (hashBytes[offset + 2] << 8) | hashBytes[offset + 3]) >>> 0;
      const blockStr = String(num % 100000).padStart(5, '0');
      blocks.push(blockStr);
    }

    const formatted = blocks.join(' ');
    const fingerprint = blocks.join('');
    return { fingerprint, formatted, blocks };
  }

  // ── 4. GROUP KEY EPOCHS (Forward & Backward Secrecy) ────────────
  async function generateGroupEpoch(epochId, membersPublicKeysMap) {
    const subtle = getSubtle();
    // Generate fresh random 256-bit AES-GCM epoch key
    const epochAesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawEpochKey = await subtle.exportKey('raw', epochAesKey);
    const rawB64 = b64(rawEpochKey);

    const wrappedKeys = {};
    for (const [uid, pubJwk] of Object.entries(membersPublicKeysMap || {})) {
      try {
        const pub = await importPub(pubJwk);
        const encKey = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, rawEpochKey);
        wrappedKeys[uid] = b64(encKey);
      } catch (_) {}
    }

    return {
      epochId,
      rawEpochKey: rawB64,
      wrappedKeys,
      createdAt: Date.now()
    };
  }

  async function encryptWithEpochKey(text, rawEpochKeyB64) {
    const subtle = getSubtle();
    const rawKey = unb64(rawEpochKeyB64);
    const aesKey = await subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const enc = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(text));
    return { encMsg: b64(enc), iv: b64(iv) };
  }

  async function decryptWithEpochKey(encMsgB64, ivB64, rawEpochKeyB64) {
    const subtle = getSubtle();
    const rawKey = unb64(rawEpochKeyB64);
    const aesKey = await subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const dec = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64) }, aesKey, unb64(encMsgB64));
    return new TextDecoder().decode(dec);
  }

  // ── 5. RECOVERY KEYS (24-word / Hex Format) ────────────────────
  function generateRecoveryKey() {
    const bytes = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // Split into 4 segments of 8 characters for readability
    const formatted = hex.match(/.{1,4}/g).join('-');
    return { recoveryKey: hex, formatted };
  }

  async function wrapKeyWithRecovery(privJwk, recoveryKey) {
    return wrapKey(privJwk, recoveryKey.replace(/[^0-9a-fA-F]/g, '').toLowerCase());
  }

  async function unwrapKeyWithRecovery(wrapped, recoveryKey) {
    return unwrapKey(wrapped, recoveryKey.replace(/[^0-9a-fA-F]/g, '').toLowerCase());
  }

  return {
    generateKeyPair,
    saveLocal,
    loadLocal,
    wrapKey,
    unwrapKey,
    encryptMsg,
    decryptMsg,
    encryptForGroup,
    // 2.0 Additions
    generateDeviceIdentity,
    calculateSafetyNumber,
    generateGroupEpoch,
    encryptWithEpochKey,
    decryptWithEpochKey,
    generateRecoveryKey,
    wrapKeyWithRecovery,
    unwrapKeyWithRecovery,
    b64,
    unb64
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoEngine;
}
if (typeof window !== 'undefined') {
  window.Crypto = CryptoEngine;
}
