// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/storage/EncryptedBlobEngine.js
//  Client-Side AES-256-GCM Streaming Blob Encryption
// ════════════════════════════════════════════════

const ZxBlobEngine = (() => {
  const activeObjectUrls = new Set();

  function getSubtle() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    throw new Error('WebCrypto subtle is not available');
  }

  /**
   * Encrypts a File or Blob with fresh AES-256-GCM key
   */
  async function encryptBlob(fileOrBlob) {
    const subtle = getSubtle();
    const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));

    const rawBuffer = await fileOrBlob.arrayBuffer();
    const encryptedBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, key, rawBuffer);

    const rawKey = await subtle.exportKey('raw', key);
    const keyHex = Array.from(new Uint8Array(rawKey)).map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
      encryptedBuffer,
      keyHex,
      ivHex,
      size: fileOrBlob.size,
      name: fileOrBlob.name || 'attachment',
      mimeType: fileOrBlob.type || 'application/octet-stream'
    };
  }

  /**
   * Decrypts an encrypted ArrayBuffer or Blob using provided AES-GCM credentials
   */
  async function decryptBlob(encryptedBufferOrBlob, keyHex, ivHex, mimeType = 'application/octet-stream') {
    const subtle = getSubtle();
    let encBuffer;
    if (typeof Blob !== 'undefined' && encryptedBufferOrBlob instanceof Blob) {
      encBuffer = await encryptedBufferOrBlob.arrayBuffer();
    } else {
      encBuffer = encryptedBufferOrBlob;
    }

    const rawKeyBytes = new Uint8Array(keyHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const ivBytes = new Uint8Array(ivHex.match(/.{2}/g).map(b => parseInt(b, 16)));

    const aesKey = await subtle.importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const decryptedBuffer = await subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, encBuffer);

    return new Blob([decryptedBuffer], { type: mimeType });
  }

  /**
   * Safely generates an ObjectURL that is tracked and automatically revoked on teardown
   */
  function createTrackedUrl(blob) {
    if (typeof URL === 'undefined' || !URL.createObjectURL) return null;
    const url = URL.createObjectURL(blob);
    activeObjectUrls.add(url);
    return url;
  }

  /**
   * Revokes all active object URLs to prevent memory leaks
   */
  function revokeAllTrackedUrls() {
    if (typeof URL === 'undefined' || !URL.revokeObjectURL) return;
    for (const url of activeObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }
    activeObjectUrls.clear();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', revokeAllTrackedUrls);
  }

  return {
    encryptBlob,
    decryptBlob,
    createTrackedUrl,
    revokeAllTrackedUrls
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxBlobEngine;
}
if (typeof window !== 'undefined') {
  window.ZxBlobEngine = ZxBlobEngine;
}
