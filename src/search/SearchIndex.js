// ZYNTRIXLY 4.1 — Local decrypted message search
// Plaintext is indexed in memory only. Never persist this index or upload its tokens.
const ZxSearch = (() => {
  const tokenIndex = new Map(); // token -> Set<messageId>
  const messageLookup = new Map(); // messageId -> sanitized message snapshot
  const messageTokens = new Map(); // messageId -> Set<token>

  function tokenize(text) {
    if (typeof text !== 'string') return [];
    return text.toLocaleLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 2);
  }

  function timestampValue(value) {
    if (value instanceof Date) return value.getTime();
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.seconds === 'number') return value.seconds * 1000;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function removeMessage(messageId) {
    const previousTokens = messageTokens.get(messageId);
    if (previousTokens) {
      for (const token of previousTokens) {
        const ids = tokenIndex.get(token);
        if (!ids) continue;
        ids.delete(messageId);
        if (ids.size === 0) tokenIndex.delete(token);
      }
    }
    messageTokens.delete(messageId);
    messageLookup.delete(messageId);
  }

  function indexMessage(message) {
    if (!message || message.id == null || typeof message.text !== 'string') return false;

    // Re-indexing replaces the old snapshot instead of leaving stale tokens behind.
    removeMessage(String(message.id));
    if (message.deleted || !message.text.trim()) return false;

    const id = String(message.id);
    const snapshot = { ...message, id };
    const tokens = new Set(tokenize(snapshot.text));
    messageLookup.set(id, snapshot);
    messageTokens.set(id, tokens);

    for (const token of tokens) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, new Set());
      tokenIndex.get(token).add(id);
    }
    return true;
  }

  function search(query, options = {}) {
    if (typeof query !== 'string' || !query.trim()) return [];
    const searchTokens = [...new Set(tokenize(query))];
    if (!searchTokens.length) return [];

    const matchesPerToken = searchTokens.map(searchToken => {
      const matchedIds = new Set();
      for (const [indexedToken, ids] of tokenIndex) {
        if (indexedToken.startsWith(searchToken)) {
          for (const id of ids) matchedIds.add(id);
        }
      }
      return matchedIds;
    });

    matchesPerToken.sort((a, b) => a.size - b.size);
    let candidateIds = [...matchesPerToken[0]];
    for (let i = 1; i < matchesPerToken.length && candidateIds.length; i++) {
      candidateIds = candidateIds.filter(id => matchesPerToken[i].has(id));
    }

    const before = options.before == null ? null : timestampValue(options.before);
    const after = options.after == null ? null : timestampValue(options.after);
    const normalizedQuery = query.toLocaleLowerCase().normalize('NFKC').trim();

    let results = candidateIds
      .map(id => messageLookup.get(id))
      .filter(Boolean)
      .filter(message => {
        if (options.conversationId && message.conversationId !== options.conversationId) return false;
        if (options.conversationType && message.conversationType !== options.conversationType) return false;
        if (options.senderUid && message.senderUid !== options.senderUid) return false;
        if (options.type && message.type !== options.type) return false;
        if (message.deleted && !options.includeDeleted) return false;

        const sentAt = timestampValue(message.sentAt);
        if (before !== null && (!sentAt || sentAt >= before)) return false;
        if (after !== null && (!sentAt || sentAt <= after)) return false;
        if (options.exactPhrase && !message.text.toLocaleLowerCase().normalize('NFKC').includes(normalizedQuery)) return false;
        return true;
      });

    results.sort((a, b) => timestampValue(b.sentAt) - timestampValue(a.sentAt));
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 50;
    return results.slice(0, limit);
  }

  function clearConversation(conversationId) {
    if (!conversationId) return 0;
    const ids = [...messageLookup.values()]
      .filter(message => message.conversationId === conversationId)
      .map(message => message.id);
    ids.forEach(removeMessage);
    return ids.length;
  }

  function clearIndex() {
    tokenIndex.clear();
    messageLookup.clear();
    messageTokens.clear();
  }

  return {
    indexMessage,
    removeMessage,
    clearConversation,
    search,
    clearIndex,
    tokenize,
    getIndexedCount: () => messageLookup.size
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ZxSearch;
if (typeof window !== 'undefined') window.ZxSearch = ZxSearch;
