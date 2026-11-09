// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/search/SearchIndex.js
//  Client-Side Decrypted Full-Text Search Engine
//  • Zero Plaintext Index Leaks to Server
//  • Local Inverted Index over IndexedDB Messages
// ════════════════════════════════════════════════

const ZxSearch = (() => {
  // In-memory token cache for fast local querying
  const tokenIndex = new Map(); // token -> Set of messageIds
  const messageLookup = new Map(); // messageId -> DecryptedMessage

  function tokenize(text) {
    if (typeof text !== 'string') return [];
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);
  }

  /**
   * Indexes a decrypted message locally
   */
  function indexMessage(message) {
    if (!message || !message.id || !message.text) return;
    messageLookup.set(message.id, message);
    const tokens = tokenize(message.text);
    for (const token of tokens) {
      if (!tokenIndex.has(token)) {
        tokenIndex.set(token, new Set());
      }
      tokenIndex.get(token).add(message.id);
    }
  }

  /**
   * Searches locally decrypted messages across conversations
   */
  function search(query, options = {}) {
    if (!query || typeof query !== 'string') return [];
    const searchTokens = tokenize(query);
    if (!searchTokens.length) return [];

    const matchesPerToken = searchTokens.map(st => {
      const matchedIds = new Set();
      for (const [indexedToken, msgIds] of tokenIndex.entries()) {
        if (indexedToken.startsWith(st)) {
          for (const id of msgIds) matchedIds.add(id);
        }
      }
      return matchedIds;
    });

    if (!matchesPerToken.length) return [];

    // Intersection of all query tokens (AND search)
    let candidateIds = Array.from(matchesPerToken[0]);
    for (let i = 1; i < matchesPerToken.length; i++) {
      candidateIds = candidateIds.filter(id => matchesPerToken[i].has(id));
    }

    let results = candidateIds.map(id => messageLookup.get(id)).filter(Boolean);

    // Filter by conversation if specified
    if (options.conversationId) {
      results = results.filter(m => m.conversationId === options.conversationId);
    }

    // Sort by timestamp descending
    results.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));

    return results.slice(0, options.limit || 50);
  }

  /**
   * Clears in-memory search index
   */
  function clearIndex() {
    tokenIndex.clear();
    messageLookup.clear();
  }

  return {
    indexMessage,
    search,
    clearIndex,
    tokenize
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxSearch;
}
if (typeof window !== 'undefined') {
  window.ZxSearch = ZxSearch;
}
