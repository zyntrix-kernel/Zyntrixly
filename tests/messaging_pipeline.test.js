const test = require('node:test');
const assert = require('node:assert');

// Polyfills for browser environment in Node.js
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

const Crypto = require('../src/crypto/CryptoEngine.js');
global.Crypto = Crypto;

const ZxStorage = require('../src/storage/IndexedDBStore.js');
global.ZxStorage = ZxStorage;

const ZxMessagePipeline = require('../src/messaging/MessagePipeline.js');

test('MSG-01: ZxStorage Message Caching & Retrieval', async () => {
  const msg1 = {
    id: 'm_101',
    conversationId: 'conv_alpha',
    text: 'Decrypted message 1',
    sentAt: 1000,
    isMine: true
  };
  const msg2 = {
    id: 'm_102',
    conversationId: 'conv_alpha',
    text: 'Decrypted message 2',
    sentAt: 2000,
    isMine: false
  };

  // Put messages
  await ZxStorage.putMessage(msg1);
  await ZxStorage.putMessage(msg2);

  // Get single
  const fetched = await ZxStorage.getMessage('m_101');
  assert.strictEqual(fetched.text, 'Decrypted message 1');

  // Query by conversation
  const list = await ZxStorage.getMessagesByConversation('conv_alpha');
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, 'm_101');
  assert.strictEqual(list[1].id, 'm_102');

  // Delete message
  await ZxStorage.deleteMessage('m_101');
  const remaining = await ZxStorage.getMessagesByConversation('conv_alpha');
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, 'm_102');
});

test('MSG-02: ZxStorage Offline Outbox Queue & Retry Lifecycles', async () => {
  // Enqueue 2 outgoing messages
  const item1 = await ZxStorage.enqueueOutbox({
    conversationId: 'conv_dm_1',
    conversationType: 'dm',
    text: 'Offline message 1'
  });
  const item2 = await ZxStorage.enqueueOutbox({
    conversationId: 'conv_dm_1',
    conversationType: 'dm',
    text: 'Offline message 2'
  });

  assert.ok(item1.id, 'Item 1 assigned unique queue ID');
  assert.strictEqual(item1.status, 'queued');

  // Verify pending list
  let pending = await ZxStorage.getPendingOutbox();
  assert.strictEqual(pending.length, 2);

  // Update status to failed
  await ZxStorage.updateOutboxStatus(item1.id, 'failed', 'Network timeout');
  pending = await ZxStorage.getPendingOutbox();
  const failedItem = pending.find(i => i.id === item1.id);
  assert.strictEqual(failedItem.status, 'failed');
  assert.strictEqual(failedItem.retryAttempts, 1);
  assert.strictEqual(failedItem.lastError, 'Network timeout');

  // Remove processed item
  await ZxStorage.removeOutboxItem(item2.id);
  pending = await ZxStorage.getPendingOutbox();
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].id, item1.id);

  // Cleanup
  await ZxStorage.removeOutboxItem(item1.id);
});

test('MSG-03: ZxStorage Private Local Call History', async () => {
  const callRecord = {
    callId: 'call_test_999',
    peerUid: 'bob_user_id',
    peerName: 'Bob',
    type: 'video',
    direction: 'outgoing',
    status: 'connected',
    durationSeconds: 142
  };

  await ZxStorage.addCallLog(callRecord);
  const history = await ZxStorage.getCallHistory();
  assert.ok(history.length >= 1, 'Call history record saved');
  const found = history.find(c => c.callId === 'call_test_999');
  assert.ok(found, 'Record found in history');
  assert.strictEqual(found.durationSeconds, 142);
  assert.strictEqual(found.type, 'video');
});

test('MSG-04: ZxMessagePipeline Offline Queuing & Idempotency', async () => {
  global.navigator = { onLine: false }; // Simulate offline state

  const sender = {
    uid: 'alice_123',
    publicKeyJwk: (await Crypto.generateKeyPair()).publicKeyJwk
  };

  const res = await ZxMessagePipeline.sendMessage({
    text: 'Secret encrypted dispatch while in airplane mode',
    conversationId: 'dm_alice_bob',
    conversationType: 'dm',
    sender
  });

  assert.strictEqual(res.status, 'queued');
  assert.ok(res.clientMessageId, 'clientMessageId generated for deduplication');

  const pending = await ZxStorage.getPendingOutbox();
  const queuedItem = pending.find(i => i.clientMessageId === res.clientMessageId);
  assert.ok(queuedItem, 'Queued item found in storage outbox');
  assert.strictEqual(queuedItem.text, 'Secret encrypted dispatch while in airplane mode');

  // Clean up
  await ZxStorage.removeOutboxItem(queuedItem.id);
  global.navigator.onLine = true;
});

test('MSG-05: ZxMessagePipeline Reaction Toggling Logic', async () => {
  // Mock firestore doc
  let storedReactions = {};
  const mockDoc = {
    exists: true,
    data: () => ({ reactions: storedReactions })
  };
  const mockDb = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => mockDoc,
            update: async (fields) => {
              storedReactions = fields.reactions;
            }
          })
        })
      })
    })
  };

  // 1. Add reaction ❤️
  await ZxMessagePipeline.toggleReaction(mockDb, 'dm', 'dm_1', 'msg_1', 'alice_123', 'heart');
  assert.strictEqual(storedReactions.heart['alice_123'], true, 'Heart reaction added for Alice');

  // 2. Bob also reacts ❤️
  await ZxMessagePipeline.toggleReaction(mockDb, 'dm', 'dm_1', 'msg_1', 'bob_456', 'heart');
  assert.strictEqual(Object.keys(storedReactions.heart).length, 2, '2 users have reacted with heart');

  // 3. Alice untoggles ❤️
  await ZxMessagePipeline.toggleReaction(mockDb, 'dm', 'dm_1', 'msg_1', 'alice_123', 'heart');
  assert.strictEqual(storedReactions.heart['alice_123'], undefined, 'Alice removed from heart reaction');
  assert.strictEqual(storedReactions.heart['bob_456'], true, 'Bob remains');
});
