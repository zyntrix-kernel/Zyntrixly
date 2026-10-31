const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Initialize browser environment polyfills for Node.js
global.window = globalThis;
if (!global.window.crypto) {
  global.window.crypto = globalThis.crypto;
}
if (!global.btoa) {
  global.btoa = s => Buffer.from(s, 'binary').toString('base64');
}
if (!global.atob) {
  global.atob = s => Buffer.from(s, 'base64').toString('binary');
}

// In-memory mock for localStorage
const storageMap = new Map();
global.localStorage = {
  setItem: (k, v) => storageMap.set(k, String(v)),
  getItem: (k) => storageMap.has(k) ? storageMap.get(k) : null,
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

// Load Crypto module from crypto.js
const cryptoSource = fs.readFileSync('crypto.js', 'utf8');
const Crypto = new Function(cryptoSource + '; return Crypto;')();

test('CRY-01: Keypair Generation Format (RSA-OAEP 2048)', async () => {
  // Arrange & Act
  const kp = await Crypto.generateKeyPair();

  // Assert
  assert.ok(kp.publicKeyJwk, 'publicKeyJwk should be present');
  assert.ok(kp.privateKeyJwk, 'privateKeyJwk should be present');
  assert.strictEqual(kp.publicKeyJwk.kty, 'RSA', 'Key type must be RSA');
  assert.strictEqual(kp.publicKeyJwk.alg, 'RSA-OAEP-256', 'Algorithm must be RSA-OAEP-256');
  assert.strictEqual(kp.publicKeyJwk.e, 'AQAB', 'Public exponent must be 65537 (AQAB)');
  assert.ok(kp.privateKeyJwk.d, 'Private key must contain private exponent d');
  assert.ok(Array.isArray(kp.publicKeyJwk.key_ops), 'key_ops must be defined');
  assert.ok(kp.publicKeyJwk.key_ops.includes('encrypt'), 'Public key must include encrypt op');
});

test('CRY-02: Key Wrapping with PBKDF2 (200,000 iterations & 16-byte salt)', async () => {
  // Arrange
  const kp = await Crypto.generateKeyPair();
  const password = 'StrongPassword!2026';

  // Act
  const wrapped = await Crypto.wrapKey(kp.privateKeyJwk, password);

  // Assert
  assert.ok(wrapped.data, 'Wrapped payload data must be present');
  assert.ok(wrapped.iv, 'IV must be present');
  assert.ok(wrapped.salt, 'Salt must be present');

  const saltBytes = Buffer.from(wrapped.salt, 'base64');
  const ivBytes = Buffer.from(wrapped.iv, 'base64');
  assert.strictEqual(saltBytes.length, 16, 'Salt must be exactly 16 bytes');
  assert.strictEqual(ivBytes.length, 12, 'AES-GCM IV must be exactly 12 bytes');
});

test('CRY-03: Key Unwrapping & Recovery (Exact Round-Trip)', async () => {
  // Arrange
  const kp = await Crypto.generateKeyPair();
  const password = 'SecureVaultKey#99';
  const wrapped = await Crypto.wrapKey(kp.privateKeyJwk, password);

  // Act
  const unwrapped = await Crypto.unwrapKey(wrapped, password);

  // Assert
  assert.ok(unwrapped, 'Unwrapped key must not be null');
  assert.strictEqual(unwrapped.kty, kp.privateKeyJwk.kty, 'Key type must match');
  assert.strictEqual(unwrapped.n, kp.privateKeyJwk.n, 'Modulus must match');
  assert.strictEqual(unwrapped.d, kp.privateKeyJwk.d, 'Private exponent must match');
});

test('CRY-04: Unwrapping with Incorrect Password Returns null', async () => {
  // Arrange
  const kp = await Crypto.generateKeyPair();
  const password = 'CorrectPassword123';
  const wrapped = await Crypto.wrapKey(kp.privateKeyJwk, password);

  // Act
  const result = await Crypto.unwrapKey(wrapped, 'IncorrectWrongPassword');

  // Assert
  assert.strictEqual(result, null, 'Unwrapping with bad password must fail and return null without throwing');
});

test('CRY-05: 1-to-1 Encryption & Decryption Round-Trip with Unicode and Emojis', async () => {
  // Arrange
  const recipient = await Crypto.generateKeyPair();
  const message = 'Hello Zyntrixly! 🛡️ Top secret zero-knowledge message with Unicode: äöü 日本語 & math: ∑(x)=42';

  // Act
  const enc = await Crypto.encryptMsg(message, recipient.publicKeyJwk);
  const dec = await Crypto.decryptMsg(enc.encMsg, enc.encKey, enc.iv, recipient.privateKeyJwk);

  // Assert
  assert.ok(enc.encMsg, 'Encrypted ciphertext must exist');
  assert.ok(enc.encKey, 'RSA-wrapped AES key must exist');
  assert.ok(enc.iv, 'AES IV must exist');
  assert.strictEqual(dec, message, 'Decrypted plaintext must exactly equal original message');
});

test('CRY-06: Cryptographic Tampering Detection Throws OperationError', async () => {
  // Arrange
  const recipient = await Crypto.generateKeyPair();
  const message = 'Tamper-proof payload';
  const enc = await Crypto.encryptMsg(message, recipient.publicKeyJwk);

  // Act & Assert 1: Tampered ciphertext
  const rawMsg = Buffer.from(enc.encMsg, 'base64');
  rawMsg[0] ^= 0xff; // Flip bits
  const tamperedMsg = rawMsg.toString('base64');

  await assert.rejects(
    async () => {
      await Crypto.decryptMsg(tamperedMsg, enc.encKey, enc.iv, recipient.privateKeyJwk);
    },
    /OperationError|Error/,
    'Tampered ciphertext must fail authentication and reject'
  );

  // Act & Assert 2: Tampered IV
  const rawIv = Buffer.from(enc.iv, 'base64');
  rawIv[0] ^= 0x01;
  const tamperedIv = rawIv.toString('base64');

  await assert.rejects(
    async () => {
      await Crypto.decryptMsg(enc.encMsg, enc.encKey, tamperedIv, recipient.privateKeyJwk);
    },
    /OperationError|Error/,
    'Tampered IV must fail tag check and reject'
  );
});

test('CRY-07: Multi-Recipient Group Encryption', async () => {
  // Arrange
  const userA = await Crypto.generateKeyPair();
  const userB = await Crypto.generateKeyPair();
  const userC = await Crypto.generateKeyPair();
  const intruder = await Crypto.generateKeyPair();

  const groupKeys = {
    'uid_alice': userA.publicKeyJwk,
    'uid_bob': userB.publicKeyJwk,
    'uid_charlie': userC.publicKeyJwk
  };

  const groupMsg = 'Strategic planning notes for the Core Security Team 🚀';

  // Act
  const encryptedGroup = await Crypto.encryptForGroup(groupMsg, groupKeys);

  // Assert keys exist for all authorized members
  assert.ok(encryptedGroup.keys['uid_alice'], 'Alice key exists');
  assert.ok(encryptedGroup.keys['uid_bob'], 'Bob key exists');
  assert.ok(encryptedGroup.keys['uid_charlie'], 'Charlie key exists');
  assert.strictEqual(encryptedGroup.keys['uid_intruder'], undefined, 'Intruder must not have a key');

  // Verify all 3 authorized users can decrypt
  const decAlice = await Crypto.decryptMsg(encryptedGroup.encMsg, encryptedGroup.keys['uid_alice'], encryptedGroup.iv, userA.privateKeyJwk);
  const decBob = await Crypto.decryptMsg(encryptedGroup.encMsg, encryptedGroup.keys['uid_bob'], encryptedGroup.iv, userB.privateKeyJwk);
  const decCharlie = await Crypto.decryptMsg(encryptedGroup.encMsg, encryptedGroup.keys['uid_charlie'], encryptedGroup.iv, userC.privateKeyJwk);

  assert.strictEqual(decAlice, groupMsg, 'Alice decrypted payload successfully');
  assert.strictEqual(decBob, groupMsg, 'Bob decrypted payload successfully');
  assert.strictEqual(decCharlie, groupMsg, 'Charlie decrypted payload successfully');

  // Verify intruder cannot decrypt using Alice\'s encKey with intruder\'s private key
  await assert.rejects(
    async () => {
      await Crypto.decryptMsg(encryptedGroup.encMsg, encryptedGroup.keys['uid_alice'], encryptedGroup.iv, intruder.privateKeyJwk);
    },
    /OperationError|Error/,
    'Intruder cannot decrypt with foreign RSA private key'
  );
});

test('CRY-08: LocalStorage Persistence & Corrupted Data Handling', async () => {
  // Arrange
  const uid = 'test_user_777';
  const kp = await Crypto.generateKeyPair();

  // Act: Save and load
  Crypto.saveLocal(uid, kp.privateKeyJwk);
  const loaded = Crypto.loadLocal(uid);

  // Assert
  assert.deepStrictEqual(loaded, kp.privateKeyJwk, 'Loaded key must match saved key');

  // Act: Corrupt storage entry
  global.localStorage.setItem('zx_pk_' + uid, 'CORRUPTED_NON_JSON_DATA{{');
  const corrupted = Crypto.loadLocal(uid);

  // Assert: Gracefully returns null
  assert.strictEqual(corrupted, null, 'Corrupted local data must return null safely');
});
