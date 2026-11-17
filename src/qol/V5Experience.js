/* ZYNTRIXLY V5 — state and legacy-engine bridge.
 * All V5 interactive controls are rendered with the shadcn/ui React components.
 * This file owns only device-local preferences, inbox filtering and composer gestures.
 */
(function(root){
 'use strict';
 const PREF_KEY='zx_v5_preferences';
 const FILTERS=['all','unread','pinned','drafts','groups'];
 const DEFAULTS=Object.freeze({inboxFilter:'all',compact:false,reducedMotion:false,focusMode:false});
 let prefs=null,initialized=false,conversationIsOpen=false,conversationObserver=null;

 function normalizePreferences(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {
   inboxFilter:FILTERS.includes(source.inboxFilter)?source.inboxFilter:'all',
   compact:source.compact===true,
   reducedMotion:source.reducedMotion===true,
   focusMode:source.focusMode===true
  };
 }
 function createPreferenceStore(storage,key){
  const storageKey=key||PREF_KEY;
  let current={...DEFAULTS};
  try{const raw=storage&&storage.getItem(storageKey);if(raw)current=normalizePreferences(JSON.parse(raw));}
  catch(_){current={...DEFAULTS};}
  function persist(){try{if(storage)storage.setItem(storageKey,JSON.stringify(current));}catch(_){}}
  return {
   get:function(){return {...current};},
   set:function(patch){current=normalizePreferences({...current,...(patch||{})});persist();return {...current};},
   reset:function(){current={...DEFAULTS};persist();return {...current};}
  };
 }
 function emitState(){
  if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
   root.dispatchEvent(new root.CustomEvent('zx:v5:state'));
  }
 }
 function safeCall(name,args,fallback){
  try{return typeof root[name]==='function'?root[name].apply(root,args||[]):fallback;}
  catch(_){return fallback;}
 }
 function conversationItems(){
  const source=safeCall('getSortedConvs',[],[]);
  return (Array.isArray(source)?source:[]).map(function(item){
   let unreadCount=0,pinned=false,draft=false;
   try{unreadCount=Number(root.getUnreadCount(item.type,item.id,item.raw))||0;}catch(_){}
   try{pinned=!!root.isPinned(item.type,item.id);}catch(_){}
   try{draft=!!root.getDraftText(item.type,item.id)||/^\s*Draft:/i.test(item.preview||'');}catch(_){}
   return {
    id:item.id,type:item.type,name:item.name||'Unknown conversation',
    color:item.color||'#27272a',av:item.av||'?',otherUid:item.otherUid||null,
    preview:item.preview||'',sortAt:item.sortAt||0,raw:item.raw||null,
    unreadCount,unread:unreadCount>0,pinned,draft
   };
  });
 }
 function filterConversations(items,filter){
  const list=Array.isArray(items)?items:[];
  switch(filter){
   case 'unread':return list.filter(item=>item.unread===true||Number(item.unreadCount)>0);
   case 'pinned':return list.filter(item=>item.pinned===true);
   case 'drafts':return list.filter(item=>item.draft===true);
   case 'groups':return list.filter(item=>item.type==='group');
   default:return list.slice();
  }
 }
 function getInboxCounts(items){
  const list=Array.isArray(items)?items:[];
  return {
   all:list.length,
   unread:list.filter(item=>item.unread===true||Number(item.unreadCount)>0).length,
   pinned:list.filter(item=>item.pinned===true).length,
   drafts:list.filter(item=>item.draft===true).length,
   groups:list.filter(item=>item.type==='group').length
  };
 }
 function getInboxSnapshot(){
  const items=conversationItems();
  return {
   filter:prefs?prefs.get().inboxFilter:DEFAULTS.inboxFilter,
   preferences:prefs?prefs.get():{...DEFAULTS},
   counts:getInboxCounts(items),
   items
  };
 }
 function setInboxFilter(filter){
  if(!FILTERS.includes(filter))return;
  if(prefs)prefs.set({inboxFilter:filter});
  applyInboxFilter();
  emitState();
 }
 function applyInboxFilter(){
  if(typeof document==='undefined')return;
  const filter=prefs?prefs.get().inboxFilter:'all';
  const items=conversationItems();
  const visible=new Set(filterConversations(items,filter).map(item=>item.type+':'+item.id));
  document.querySelectorAll('#sb-list .conv-item').forEach(function(node){
   const key=node.dataset.convType+':'+node.dataset.convId;
   node.hidden=filter!=='all'&&!visible.has(key);
  });
 }
 function setPreference(name,value){
  if(!prefs||!['compact','reducedMotion','focusMode'].includes(name))return;
  prefs.set({[name]:value===true});
  applyPreferences();
  applyInboxFilter();
  emitState();
 }
 function applyPreferences(){
  if(!prefs||typeof document==='undefined')return;
  const state=prefs.get();
  document.body.classList.toggle('zx-v5-compact',state.compact);
  document.body.classList.toggle('zx-v5-reduce-motion',state.reducedMotion);
  syncFocusMode();
 }
 function syncFocusMode(open){
  if(typeof document==='undefined')return;
  if(typeof open==='boolean')conversationIsOpen=open;
  document.body.classList.toggle('zx-v5-focus-mode',!!(prefs&&prefs.get().focusMode&&conversationIsOpen));
 }
 function openPalette(){
  root.__zxV5PaletteOpen=true;
  if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
   root.dispatchEvent(new root.CustomEvent('zx:v5:open-palette'));
  }
 }
 function closePalette(){
  root.__zxV5PaletteOpen=false;
  if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
   root.dispatchEvent(new root.CustomEvent('zx:v5:close-palette'));
  }
 }
 async function openConversation(item){
  if(!item)return;
  if(item.type==='dm'&&item.otherUid&&typeof root.startDM==='function'){
   await root.startDM(item.otherUid,item.name,item.color);
  }else if(item.type==='group'&&typeof root.openGroup==='function'&&item.raw){
   root.openGroup(item.id,item.raw);
  }
 }
 function waitForMessageRow(messageId){
  return new Promise(function(resolve){
   const rowId='m-'+messageId,existing=document.getElementById(rowId);
   if(existing){resolve(existing);return;}
   const host=document.getElementById('msgs-wrap');
   if(!host||typeof MutationObserver==='undefined'){resolve(null);return;}
   let settled=false;
   const rowObserver=new MutationObserver(function(){
    const row=document.getElementById(rowId);if(row)finish(row);
   });
   const timeout=root.setTimeout(function(){finish(document.getElementById(rowId));},6000);
   function finish(value){
    if(settled)return;settled=true;rowObserver.disconnect();root.clearTimeout(timeout);resolve(value||null);
   }
   rowObserver.observe(host,{childList:true,subtree:true});
  });
 }
 function notify(message){
  if(typeof root.toast==='function')root.toast(message,3200);
 }
 function wireComposer(){
  const composer=document.querySelector('.composer'),messageArea=document.getElementById('msgs-wrap'),input=document.getElementById('msg-inp');
  if(!composer||composer.dataset.zxV5Wired==='1')return;
  composer.dataset.zxV5Wired='1';
  function stage(file){
   if(!file)return;
   if(typeof root.ZxStageAttachmentFile!=='function'){notify('Attachment staging is not available in this build.');return;}
   root.ZxStageAttachmentFile(file);
  }
  function isFileDrag(event){
   return !!(event.dataTransfer&&Array.from(event.dataTransfer.types||[]).includes('Files'));
  }
  [composer,messageArea].filter(Boolean).forEach(function(target){
   target.addEventListener('dragenter',function(event){
    if(!isFileDrag(event))return;event.preventDefault();composer.classList.add('zx-v5-drop-ready');
   });
   target.addEventListener('dragover',function(event){
    if(!isFileDrag(event))return;event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
    composer.classList.add('zx-v5-drop-ready');
   });
   target.addEventListener('dragleave',function(event){
    if(event.relatedTarget&&target.contains(event.relatedTarget))return;
    composer.classList.remove('zx-v5-drop-ready');
   });
   target.addEventListener('drop',function(event){
    if(!isFileDrag(event))return;event.preventDefault();composer.classList.remove('zx-v5-drop-ready');
    const file=event.dataTransfer.files&&event.dataTransfer.files[0];if(file)stage(file);
    if(event.dataTransfer.files&&event.dataTransfer.files.length>1)notify('V5 currently stages one attachment at a time.');
   });
  });
  if(input)input.addEventListener('paste',function(event){
   const files=event.clipboardData&&event.clipboardData.files;
   if(!files||!files.length)return;
   const imageFile=Array.from(files).find(file=>file.type&&file.type.startsWith('image/'));
   if(!imageFile)return;
   event.preventDefault();stage(imageFile);
  });
 }
 function init(){
  if(initialized||typeof document==='undefined')return;
  initialized=true;
  prefs=createPreferenceStore(root.localStorage);
  applyPreferences();
  applyInboxFilter();
  ['sb-chats','sb-groups'].forEach(function(id){
   const target=document.getElementById(id);
   if(!target||typeof MutationObserver==='undefined')return;
   if(!conversationObserver)conversationObserver=new MutationObserver(function(){
    applyInboxFilter();emitState();
   });
   conversationObserver.observe(target,{childList:true,subtree:true});
  });
  wireComposer();
  emitState();
 }
 function refresh(){
  applyInboxFilter();
  emitState();
 }
 function resetSession(){
  closePalette();
  if(root.ZxSearch&&typeof root.ZxSearch.clearIndex==='function')root.ZxSearch.clearIndex();
  syncFocusMode(false);
  emitState();
 }
 function getStatus(){
  return {
   version:'5.0.0',
   preferences:prefs?prefs.get():{...DEFAULTS},
   indexedMessages:root.ZxSearch&&typeof root.ZxSearch.getIndexedCount==='function'?root.ZxSearch.getIndexedCount():0,
   searchScope:'decrypted messages from conversations opened in this browser session'
  };
 }
 const api={
  normalizePreferences,createPreferenceStore,filterConversations,getInboxCounts,
  getInboxSnapshot,init,refresh,openPalette,closePalette,
  isPaletteOpen:function(){return root.__zxV5PaletteOpen===true;},
  setInboxFilter,setPreference,syncFocusMode,resetSession,getStatus,openConversation,waitForMessageRow
 };
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.ZxV5=api;
})(typeof window!=='undefined'?window:globalThis);
