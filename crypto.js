// ════════════════════════════════════════════════
//  ZYNTRIXLY — crypto.js
//  RSA-OAEP + AES-GCM E2EE
//  Multi-device: private key wrapped with PBKDF2
// ════════════════════════════════════════════════
const Crypto = (() => {
  async function generateKeyPair() {
    const kp = await window.crypto.subtle.generateKey(
      {name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
      true,['encrypt','decrypt']
    );
    return {
      publicKeyJwk: await window.crypto.subtle.exportKey('jwk',kp.publicKey),
      privateKeyJwk:await window.crypto.subtle.exportKey('jwk',kp.privateKey)
    };
  }

  function saveLocal(uid,jwk){try{localStorage.setItem('zx_pk_'+uid,JSON.stringify(jwk));}catch(e){}}
  function loadLocal(uid){try{const r=localStorage.getItem('zx_pk_'+uid);return r?JSON.parse(r):null;}catch(e){return null;}}

  async function wrapKey(privJwk, password) {
    const salt=window.crypto.getRandomValues(new Uint8Array(16));
    const iv=window.crypto.getRandomValues(new Uint8Array(12));
    const km=await window.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    const aes=await window.crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt']
    );
    const enc=await window.crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(JSON.stringify(privJwk)));
    return {data:b64(enc),iv:b64(iv),salt:b64(salt)};
  }

  async function unwrapKey(wrapped, password) {
    try {
      const km=await window.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
      const aes=await window.crypto.subtle.deriveKey(
        {name:'PBKDF2',salt:unb64(wrapped.salt),iterations:200000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']
      );
      const dec=await window.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(wrapped.iv)},aes,unb64(wrapped.data));
      return JSON.parse(new TextDecoder().decode(dec));
    } catch { return null; }
  }

  async function encryptMsg(text, pubJwk) {
    const pub=await importPub(pubJwk);
    const aes=await window.crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const iv=window.crypto.getRandomValues(new Uint8Array(12));
    const enc=await window.crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(text));
    const raw=await window.crypto.subtle.exportKey('raw',aes);
    const ek=await window.crypto.subtle.encrypt({name:'RSA-OAEP'},pub,raw);
    return{encMsg:b64(enc),encKey:b64(ek),iv:b64(iv)};
  }

  async function decryptMsg(encMsg,encKey,iv,privJwk) {
    const priv=await importPriv(privJwk);
    const raw=await window.crypto.subtle.decrypt({name:'RSA-OAEP'},priv,unb64(encKey));
    const aes=await window.crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);
    const dec=await window.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},aes,unb64(encMsg));
    return new TextDecoder().decode(dec);
  }

  async function encryptForGroup(text, pubKeysMap) {
    const aes=await window.crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const iv=window.crypto.getRandomValues(new Uint8Array(12));
    const enc=await window.crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(text));
    const raw=await window.crypto.subtle.exportKey('raw',aes);
    const keys={};
    for(const[uid,jwk]of Object.entries(pubKeysMap)){
      const pub=await importPub(jwk);
      keys[uid]=b64(await window.crypto.subtle.encrypt({name:'RSA-OAEP'},pub,raw));
    }
    return{encMsg:b64(enc),iv:b64(iv),keys};
  }

  async function importPub(jwk){return window.crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);}
  async function importPriv(jwk){return window.crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);}
  function b64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)));}
  function unb64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;}

  return{generateKeyPair,saveLocal,loadLocal,wrapKey,unwrapKey,encryptMsg,decryptMsg,encryptForGroup};
})();
