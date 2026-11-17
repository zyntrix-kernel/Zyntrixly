const test=require('node:test');
const assert=require('node:assert/strict');
const V5=require('../src/qol/V5Experience.js');
function memoryStorage(seed){
 const values=new Map(Object.entries(seed||{}));
 return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),values};
}
test('normalizes V5 preferences and rejects unknown values',()=>{
 assert.deepEqual(V5.normalizePreferences(null),{inboxFilter:'all',compact:false,reducedMotion:false,focusMode:false});
 assert.deepEqual(V5.normalizePreferences({inboxFilter:'secret',compact:1,reducedMotion:true,focusMode:false,other:true}),
  {inboxFilter:'all',compact:false,reducedMotion:true,focusMode:false});
});
test('preference store persists only supported normalized settings',()=>{
 const storage=memoryStorage(),store=V5.createPreferenceStore(storage);
 store.set({compact:true,inboxFilter:'pinned',focusMode:true,ignored:'value'});
 assert.deepEqual(store.get(),{inboxFilter:'pinned',compact:true,reducedMotion:false,focusMode:true});
 const restored=V5.createPreferenceStore(storage);assert.deepEqual(restored.get(),store.get());
 restored.reset();assert.equal(restored.get().inboxFilter,'all');assert.equal(restored.get().compact,false);
});
test('corrupt persisted preferences safely fall back to defaults',()=>{
 const store=V5.createPreferenceStore(memoryStorage({zx_v5_preferences:'{not-json'}));
 assert.equal(store.get().inboxFilter,'all');assert.equal(store.get().focusMode,false);
});
test('Smart Inbox filters unread, pinned, drafts and groups independently',()=>{
 const items=[
  {id:'a',type:'dm',unread:true,pinned:false,draft:false},
  {id:'b',type:'dm',unread:false,pinned:true,draft:true},
  {id:'c',type:'group',unread:false,pinned:false,draft:false},
  {id:'d',type:'group',unread:true,pinned:true,draft:false}
 ];
 assert.deepEqual(V5.filterConversations(items,'unread').map(x=>x.id),['a','d']);
 assert.deepEqual(V5.filterConversations(items,'pinned').map(x=>x.id),['b','d']);
 assert.deepEqual(V5.filterConversations(items,'drafts').map(x=>x.id),['b']);
 assert.deepEqual(V5.filterConversations(items,'groups').map(x=>x.id),['c','d']);
 assert.deepEqual(V5.filterConversations(items,'all').map(x=>x.id),['a','b','c','d']);
});
test('inbox counts are conversation counts, not message counts',()=>{
 const counts=V5.getInboxCounts([
  {type:'dm',unreadCount:1,pinned:true,draft:false},
  {type:'dm',unreadCount:0,pinned:true,draft:true},
  {type:'group',unreadCount:1,pinned:false,draft:false}
 ]);
 assert.deepEqual(counts,{all:3,unread:2,pinned:2,drafts:1,groups:1});
});
