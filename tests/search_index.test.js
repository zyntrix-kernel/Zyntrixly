const test = require('node:test');
const assert = require('node:assert/strict');
const ZxSearch = require('../src/search/SearchIndex.js');

test('indexes decrypted messages and matches all query terms', () => {
  ZxSearch.clearIndex();
  ZxSearch.indexMessage({ id: '1', conversationId: 'dm-a', text: 'Hello encrypted world', sentAt: 100 });
  ZxSearch.indexMessage({ id: '2', conversationId: 'dm-a', text: 'Hello there', sentAt: 200 });

  assert.deepEqual(ZxSearch.search('hello world').map(message => message.id), ['1']);
  assert.deepEqual(ZxSearch.search('hell').map(message => message.id), ['2', '1']);
});

test('re-indexing replaces stale tokens and message contents', () => {
  ZxSearch.clearIndex();
  ZxSearch.indexMessage({ id: 'same', conversationId: 'dm-a', text: 'old searchable phrase' });
  ZxSearch.indexMessage({ id: 'same', conversationId: 'dm-a', text: 'new searchable phrase' });

  assert.equal(ZxSearch.search('old').length, 0);
  assert.equal(ZxSearch.search('new')[0].id, 'same');
  assert.equal(ZxSearch.getIndexedCount(), 1);
});

test('supports conversation, sender, type and date filters', () => {
  ZxSearch.clearIndex();
  ZxSearch.indexMessage({ id: 'a', conversationId: 'dm-a', conversationType: 'dm', senderUid: 'u1', type: 'text', text: 'release notes', sentAt: 100 });
  ZxSearch.indexMessage({ id: 'b', conversationId: 'group-b', conversationType: 'group', senderUid: 'u2', type: 'file', text: 'release notes', sentAt: 200 });

  assert.deepEqual(ZxSearch.search('release', { conversationId: 'dm-a' }).map(m => m.id), ['a']);
  assert.deepEqual(ZxSearch.search('release', { senderUid: 'u2', type: 'file' }).map(m => m.id), ['b']);
  assert.deepEqual(ZxSearch.search('release', { after: 150 }).map(m => m.id), ['b']);
  assert.deepEqual(ZxSearch.search('release', { before: 150 }).map(m => m.id), ['a']);
});

test('supports exact phrase filtering and excludes deleted messages by default', () => {
  ZxSearch.clearIndex();
  ZxSearch.indexMessage({ id: 'a', text: 'a very useful release note', sentAt: 1 });
  ZxSearch.indexMessage({ id: 'b', text: 'useful note about a release', sentAt: 2 });
  ZxSearch.indexMessage({ id: 'c', text: 'useful release note', deleted: true, sentAt: 3 });

  assert.deepEqual(ZxSearch.search('useful release', { exactPhrase: true }).map(m => m.id), []);
  assert.deepEqual(ZxSearch.search('useful release').map(m => m.id), ['b', 'a']);
  assert.deepEqual(ZxSearch.search('useful release', { includeDeleted: true }).map(m => m.id), ['c', 'b', 'a']);
});

test('removes messages and clears a conversation without affecting others', () => {
  ZxSearch.clearIndex();
  ZxSearch.indexMessage({ id: 'a', conversationId: 'dm-a', text: 'alpha beta' });
  ZxSearch.indexMessage({ id: 'b', conversationId: 'dm-a', text: 'beta gamma' });
  ZxSearch.indexMessage({ id: 'c', conversationId: 'dm-b', text: 'beta delta' });

  assert.equal(ZxSearch.removeMessage('a'), undefined);
  assert.equal(ZxSearch.clearConversation('dm-a'), 1);
  assert.deepEqual(ZxSearch.search('beta').map(m => m.id), ['c']);
});
