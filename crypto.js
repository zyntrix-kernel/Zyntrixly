// ════════════════════════════════════════════════
//  ZYNTRIXLY — crypto.js
//  RSA-OAEP + AES-GCM E2EE & Multi-Device Engine 2.0
// ════════════════════════════════════════════════
const Crypto = (() => {
  const getSubtle = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) return window.crypto.subtle;
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto.subtle;
    throw new Error('WebCrypto subtle is not available in current environment');
  };

  async function generateKeyPair() {
    const subtle = getSubtle();
    const kp = await subtle.generateKey(
      {name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
      true,['encrypt','decrypt']
    );
    return {
      publicKeyJwk: await subtle.exportKey('jwk',kp.publicKey),
      privateKeyJwk:await subtle.exportKey('jwk',kp.privateKey)
    };
  }

  function saveLocal(uid,jwk){try{localStorage.setItem('zx_pk_'+uid,JSON.stringify(jwk));}catch(e){}}
  function loadLocal(uid){try{const r=localStorage.getItem('zx_pk_'+uid);return r?JSON.parse(r):null;}catch(e){return null;}}

  async function wrapKey(privJwk, password) {
    const subtle = getSubtle();
    const salt=(typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(new Uint8Array(16));
    const iv=(typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const km=await subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    const aes=await subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt']
    );
    const enc=await subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(JSON.stringify(privJwk)));
    return {data:b64(enc),iv:b64(iv),salt:b64(salt)};
  }

  async function unwrapKey(wrapped, password) {
    try {
      const subtle = getSubtle();
      const km=await subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
      const aes=await subtle.deriveKey(
        {name:'PBKDF2',salt:unb64(wrapped.salt),iterations:200000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']
      );
      const dec=await subtle.decrypt({name:'AES-GCM',iv:unb64(wrapped.iv)},aes,unb64(wrapped.data));
      return JSON.parse(new TextDecoder().decode(dec));
    } catch { return null; }
  }

  async function encryptMsg(text, pubJwk) {
    const subtle = getSubtle();
    const pub=await importPub(pubJwk);
    const aes=await subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const iv=(typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const enc=await subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(text));
    const raw=await subtle.exportKey('raw',aes);
    const ek=await subtle.encrypt({name:'RSA-OAEP'},pub,raw);
    return{encMsg:b64(enc),encKey:b64(ek),iv:b64(iv)};
  }

  async function decryptMsg(encMsg,encKey,iv,privJwk) {
    const subtle = getSubtle();
    const priv=await importPriv(privJwk);
    const raw=await subtle.decrypt({name:'RSA-OAEP'},priv,unb64(encKey));
    const aes=await subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);
    const dec=await subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},aes,unb64(encMsg));
    return new TextDecoder().decode(dec);
  }

  async function encryptForGroup(text, pubKeysMap) {
    const subtle = getSubtle();
    const aes=await subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const iv=(typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
    const enc=await subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(text));
    const raw=await subtle.exportKey('raw',aes);
    const keys={};
    for(const[uid,jwk]of Object.entries(pubKeysMap || {})){
      try {
        const pub=await importPub(jwk);
        keys[uid]=b64(await subtle.encrypt({name:'RSA-OAEP'},pub,raw));
      } catch(_) {}
    }
    return{encMsg:b64(enc),iv:b64(iv),keys};
  }

  // ── 2.0 MULTI-DEVICE MANAGEMENT ─────────────────────────────────
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

  // ── 2.0 SAFETY NUMBERS / FINGERPRINTS (SHA-512) ──────────────────
  async function calculateSafetyNumber(pubKeyA, pubKeyB, uidA, uidB) {
    const subtle = getSubtle();
    const firstIsA = (uidA || '') < (uidB || '');
    const user1 = firstIsA ? uidA : uidB;
    const user2 = firstIsA ? uidB : uidA;
    const key1 = firstIsA ? (pubKeyA?.n || '') : (pubKeyB?.n || '');
    const key2 = firstIsA ? (pubKeyB?.n || '') : (pubKeyA?.n || '');

    const seedString = `${user1}:${key1}|${user2}:${key2}`;
    const hashBuffer = await subtle.digest('SHA-512', new TextEncoder().encode(seedString));
    const hashBytes = new Uint8Array(hashBuffer);

    const blocks = [];
    for (let i = 0; i < 12; i++) {
      const offset = i * 4;
      const num = ((hashBytes[offset] << 24) | (hashBytes[offset + 1] << 16) | (hashBytes[offset + 2] << 8) | hashBytes[offset + 3]) >>> 0;
      blocks.push(String(num % 100000).padStart(5, '0'));
    }

    return { fingerprint: blocks.join(''), formatted: blocks.join(' '), blocks };
  }

  // ── 2.0 GROUP KEY EPOCHS (Forward & Backward Secrecy) ────────────
  async function generateGroupEpoch(epochId, membersPublicKeysMap) {
    const subtle = getSubtle();
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

    return { epochId, rawEpochKey: rawB64, wrappedKeys, createdAt: Date.now() };
  }

  async function encryptWithEpochKey(text, rawEpochKeyB64) {
    const subtle = getSubtle();
    const rawKey = unb64(rawEpochKeyB64);
    const aesKey = await subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(new Uint8Array(12));
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

  // ── 2.0 RECOVERY KEYS (24-word / Hex Format) ────────────────────
  function generateRecoveryKey() {
    const bytes = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const formatted = hex.match(/.{1,4}/g).join('-');
    return { recoveryKey: hex, formatted };
  }

  async function wrapKeyWithRecovery(privJwk, recoveryKey) {
    return wrapKey(privJwk, recoveryKey.replace(/[^0-9a-fA-F]/g, '').toLowerCase());
  }

  async function unwrapKeyWithRecovery(wrapped, recoveryKey) {
    return unwrapKey(wrapped, recoveryKey.replace(/[^0-9a-fA-F]/g, '').toLowerCase());
  }

  async function importPub(jwk){return getSubtle().importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);}
  async function importPriv(jwk){return getSubtle().importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);}
  function b64(buf){
    if (typeof Buffer !== 'undefined') return Buffer.from(buf).toString('base64');
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function unb64(s){
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64');
    const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;
  }

  return {
    generateKeyPair,saveLocal,loadLocal,wrapKey,unwrapKey,encryptMsg,decryptMsg,encryptForGroup,
    generateDeviceIdentity,calculateSafetyNumber,generateGroupEpoch,encryptWithEpochKey,decryptWithEpochKey,
    generateRecoveryKey,wrapKeyWithRecovery,unwrapKeyWithRecovery,b64,unb64
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Crypto;
}
if (typeof window !== 'undefined') {
  window.Crypto = Crypto;
}
