const test = require('node:test');
const assert = require('node:assert');
const { WebAuthnPRF } = require('../src/crypto/WebAuthnPRF.js');

test('PRF-01: Passkey Registration & Key Derivation', async () => {
  const prf = new WebAuthnPRF();
  const reg = await prf.registerHardwarePasskey('tester_tanay');

  assert.ok(reg.credentialId, 'Credential ID returned');
  assert.strictEqual(reg.rawKey.length, 32, 'Master key is 32 bytes (256 bits)');

  // Subsequent derivation with same credential and salt derives identical master key
  const derived = await prf.deriveHardwareMasterKey(reg.credentialId);
  assert.deepStrictEqual(derived, reg.rawKey, 'Derived key matches enrolled key deterministically');
});

test('PRF-02: Cryptographic Isolation across Salts & Credentials', async () => {
  const prf = new WebAuthnPRF();
  const reg1 = await prf.registerHardwarePasskey('user1', 'salt_alpha');
  const reg2 = await prf.registerHardwarePasskey('user2', 'salt_beta');

  assert.notStrictEqual(
    Buffer.from(reg1.rawKey).toString('hex'),
    Buffer.from(reg2.rawKey).toString('hex'),
    'Different passkeys produce cryptographically uncorrelated master keys'
  );

  const derivedAlt = await prf.deriveHardwareMasterKey(reg1.credentialId, 'salt_different');
  assert.notStrictEqual(
    Buffer.from(derivedAlt).toString('hex'),
    Buffer.from(reg1.rawKey).toString('hex'),
    'Different salts derive different master keys for same credential'
  );
});
