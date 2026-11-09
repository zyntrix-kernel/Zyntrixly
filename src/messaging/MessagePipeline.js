// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/messaging/MessagePipeline.js
//  Complete Modular Messaging Pipeline & State Machine
// ════════════════════════════════════════════════

const ZxMessagePipeline = (() => {
  let isFlushingQueue = false;

  // Listen for online events to automatically flush offline outbox
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => {
      console.log('[ZxMessagePipeline] Network restored, flushing offline outbox…');
      flushOutbox();
    });
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  }

  /**
   * Enqueues or immediately sends a message through the encrypted pipeline
   */
  async function sendMessage({
    text,
    conversationId,
    conversationType,
    sender,
    recipientKey,
    groupKeys,
    epochKey,
    replyTo = null,
    fileAttachment = null,
    dbInstance = null
  }) {
    if (!text && !fileAttachment) throw new Error('Message cannot be empty');
    if (!conversationId) throw new Error('Missing conversationId');
    if (!sender || !sender.uid) throw new Error('Unauthenticated sender');

    const clientMessageId = generateUUID();

    // 1. Enqueue in persistent outbox queue
    const outboxItem = await (typeof ZxStorage !== 'undefined' ? ZxStorage.enqueueOutbox({
      clientMessageId,
      conversationId,
      conversationType,
      text,
      replyTo,
      fileAttachment,
      status: 'sending'
    }) : { clientMessageId });

    // 2. If online and Firestore DB instance is available, execute transmission
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline || !dbInstance) {
      console.log('[ZxMessagePipeline] Offline or no DB provided; message safely queued in outbox:', clientMessageId);
      return { clientMessageId, status: 'queued' };
    }

    try {
      await transmitMessage(outboxItem, {
        sender,
        recipientKey,
        groupKeys,
        epochKey,
        db: dbInstance
      });

      if (typeof ZxStorage !== 'undefined') {
        await ZxStorage.removeOutboxItem(outboxItem.id);
      }
      return { clientMessageId, status: 'sent' };
    } catch (err) {
      console.warn('[ZxMessagePipeline] Message transmission failed, marked for retry:', err);
      if (typeof ZxStorage !== 'undefined' && outboxItem.id) {
        await ZxStorage.updateOutboxStatus(outboxItem.id, 'failed', err.message);
      }
      return { clientMessageId, status: 'failed', error: err.message };
    }
  }

  /**
   * Internal encrypted transmission logic
   */
  async function transmitMessage(item, { sender, recipientKey, groupKeys, epochKey, db }) {
    const { conversationId, conversationType, text, replyTo, clientMessageId } = item;
    const cryptoEngine = typeof Crypto !== 'undefined' ? Crypto : (typeof window !== 'undefined' ? window.Crypto : null);
    if (!cryptoEngine) throw new Error('Crypto engine unavailable');

    const messageData = {
      clientMessageId,
      senderUid: sender.uid,
      type: item.fileAttachment ? 'file' : 'text',
      reactions: {},
      deleted: false,
      sentAt: (typeof firebase !== 'undefined' && firebase.firestore)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : Date.now()
    };

    if (replyTo) {
      messageData.replyTo = {
        msgId: replyTo.msgId,
        senderName: replyTo.senderName || '',
        text: (replyTo.text || '').substring(0, 50)
      };
    }

    if (conversationType === 'dm') {
      if (!recipientKey) throw new Error('Missing recipient public key for DM encryption');
      const their = await cryptoEngine.encryptMsg(text, recipientKey);
      const mine = await cryptoEngine.encryptMsg(text, sender.publicKeyJwk);

      messageData.encMsg = their.encMsg;
      messageData.encKey = their.encKey;
      messageData.iv = their.iv;
      messageData.myEncMsg = mine.encMsg;
      messageData.myEncKey = mine.encKey;
      messageData.myIv = mine.iv;

      // Update DM root metadata (Zero-Knowledge: zero plaintext preview!)
      await db.collection('dms').doc(conversationId).set({
        lastMsgAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
        lastSenderUid: sender.uid,
        [`typing.${sender.uid}`]: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.delete() : null
      }, { merge: true });

      // Add to messages subcollection
      await db.collection('dms').doc(conversationId).collection('messages').add(messageData);
    } else {
      // Group conversation encryption
      if (epochKey) {
        // Use epoch AES-GCM key
        const enc = await cryptoEngine.encryptWithEpochKey(text, epochKey);
        messageData.encMsg = enc.encMsg;
        messageData.iv = enc.iv;
        messageData.epochId = item.epochId || 1;
      } else if (groupKeys) {
        // Fallback to multi-recipient RSA-OAEP wrapped key
        const enc = await cryptoEngine.encryptForGroup(text, groupKeys);
        messageData.encMsg = enc.encMsg;
        messageData.keys = enc.keys;
        messageData.iv = enc.iv;
      } else {
        throw new Error('No encryption keys available for group message');
      }

      await db.collection('groups').doc(conversationId).update({
        lastMsgAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
        lastSenderUid: sender.uid,
        [`typing.${sender.uid}`]: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.delete() : null
      });

      await db.collection('groups').doc(conversationId).collection('messages').add(messageData);
    }
  }

  /**
   * Processes all pending offline outbox items
   */
  async function flushOutbox(context = {}) {
    if (isFlushingQueue) return;
    if (typeof ZxStorage === 'undefined') return;

    isFlushingQueue = true;
    try {
      const pending = await ZxStorage.getPendingOutbox();
      for (const item of pending) {
        try {
          if (context.db && context.sender) {
            await transmitMessage(item, context);
            await ZxStorage.removeOutboxItem(item.id);
          }
        } catch (err) {
          console.warn('[ZxMessagePipeline] Retry failed for outbox item:', item.id, err);
          await ZxStorage.updateOutboxStatus(item.id, 'failed', err.message);
        }
      }
    } finally {
      isFlushingQueue = false;
    }
  }

  /**
   * Toggles an emoji reaction on a message idempotently
   */
  async function toggleReaction(db, conversationType, conversationId, messageId, uid, reactionKey) {
    if (!db || !conversationId || !messageId || !uid) return;
    const colName = conversationType === 'dm' ? 'dms' : 'groups';
    const msgRef = db.collection(colName).doc(conversationId).collection('messages').doc(messageId);

    const doc = await msgRef.get();
    if (!doc.exists) return;

    const reactions = doc.data().reactions || {};
    const hasReacted = !!(reactions[reactionKey] && reactions[reactionKey][uid]);

    if (hasReacted) {
      delete reactions[reactionKey][uid];
      if (Object.keys(reactions[reactionKey]).length === 0) {
        delete reactions[reactionKey];
      }
    } else {
      if (!reactions[reactionKey]) reactions[reactionKey] = {};
      reactions[reactionKey][uid] = true;
    }

    await msgRef.update({ reactions });
  }

  /**
   * Stars or unstars a message for the current user
   */
  async function setStarred(db, conversationType, conversationId, messageId, uid, isStarred) {
    if (!db || !conversationId || !messageId || !uid) return;
    const colName = conversationType === 'dm' ? 'dms' : 'groups';
    const msgRef = db.collection(colName).doc(conversationId).collection('messages').doc(messageId);
    await msgRef.update({
      [`starred.${uid}`]: isStarred ? true : ((typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.delete() : false)
    });
  }

  /**
   * Pins or unpins a message in a conversation
   */
  async function setPinned(db, conversationType, conversationId, messageId, isPinned) {
    if (!db || !conversationId || !messageId) return;
    const colName = conversationType === 'dm' ? 'dms' : 'groups';
    const convRef = db.collection(colName).doc(conversationId);
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      await convRef.update({
        pinnedMessages: isPinned
          ? firebase.firestore.FieldValue.arrayUnion(messageId)
          : firebase.firestore.FieldValue.arrayRemove(messageId)
      });
    }
  }

  return {
    sendMessage,
    flushOutbox,
    toggleReaction,
    setStarred,
    setPinned
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxMessagePipeline;
}
if (typeof window !== 'undefined') {
  window.ZxMessagePipeline = ZxMessagePipeline;
}
