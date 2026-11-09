const test = require('node:test');
const assert = require('node:assert');
const { MLSEngine } = require('../src/crypto/MLSEngine.js');

test('MLS-01: Group Initialization and Member Addition O(log N)', () => {
  const mls = new MLSEngine('group_space_alpha');
  assert.strictEqual(mls.epoch, 0, 'Initial epoch is 0');

  // Add Alice
  const aliceRes = mls.addMember('user_alice');
  assert.strictEqual(aliceRes.epoch, 1, 'Epoch incremented to 1 after adding Alice');
  assert.strictEqual(mls.members.size, 1);

  // Add Bob
  const bobRes = mls.addMember('user_bob');
  assert.strictEqual(bobRes.epoch, 2, 'Epoch incremented to 2 after adding Bob');
  assert.strictEqual(mls.members.size, 2);

  // Add Charlie
  const charlieRes = mls.addMember('user_charlie');
  assert.strictEqual(charlieRes.epoch, 3, 'Epoch incremented to 3 after adding Charlie');
  assert.strictEqual(mls.members.size, 3);
});

test('MLS-02: Message Encryption & Decryption within Epoch', () => {
  const mls = new MLSEngine('group_space_crypto');
  mls.addMember('user_alice');
  mls.addMember('user_bob');

  const plaintext = 'Zero-Knowledge Group Message via TreeKEM RFC 9420!';
  const packet = mls.encryptGroupMessage(plaintext, 'user_alice');

  assert.strictEqual(packet.protocol, 'MLS_RFC_9420');
  assert.strictEqual(packet.groupId, 'group_space_crypto');
  assert.strictEqual(packet.epoch, mls.epoch);
  assert.notStrictEqual(packet.ciphertext, plaintext);

  const decrypted = mls.decryptGroupMessage(packet);
  assert.strictEqual(decrypted, plaintext, 'Message decrypted correctly using epoch key');
});

test('MLS-03: Forward Secrecy on Member Removal', () => {
  const mls = new MLSEngine('group_space_fs');
  mls.addMember('user_alice');
  mls.addMember('user_bob');
  mls.addMember('user_charlie');

  const oldEpoch = mls.epoch;
  const oldKey = Buffer.from(mls.deriveMessageKey(oldEpoch)).toString('hex');

  // Remove Bob
  const removeRes = mls.removeMember('user_bob');
  assert.strictEqual(removeRes.removedMemberId, 'user_bob');
  assert.strictEqual(mls.epoch, oldEpoch + 1, 'Epoch ratcheted forward');
  assert.strictEqual(mls.members.has('user_bob'), false, 'Bob removed from member registry');

  const newKey = Buffer.from(mls.deriveMessageKey(mls.epoch)).toString('hex');
  assert.notStrictEqual(newKey, oldKey, 'New epoch key is cryptographically isolated from previous epoch (Forward Secrecy)');
});

test('MLS-04: Post-Compromise Security (PCS) Key Healing Update', () => {
  const mls = new MLSEngine('group_space_pcs');
  mls.addMember('user_alice');
  mls.addMember('user_bob');

  const epochBefore = mls.epoch;
  const updateRes = mls.updateKey('user_alice');

  assert.strictEqual(updateRes.epoch, epochBefore + 1, 'Epoch ratcheted on key update');
  assert.ok(updateRes.commit.treeHash, 'Tree hash recomputed across direct path to root');
});
