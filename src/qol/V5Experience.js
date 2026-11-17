/* ZYNTRIXLY V5 — daily-driver experience layer.
 * Preferences stay on this device. Search reads only the decrypted in-memory index.
 */
(function(root){
 'use strict';
 const PREF_KEY='zx_v5_preferences',FILTERS=['all','unread','pinned','drafts','groups'];
 const DEFAULTS=Object.freeze({inboxFilter:'all',compact:false,reducedMotion:false,focusMode:false});
 function normalizePreferences(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {inboxFilter:FILTERS.includes(source.inboxFilter)?source.inboxFilter:'all',
   compact:source.compact===true,reducedMotion:source.reducedMotion===true,focusMode:source.focusMode===true};
 }
 function createPreferenceStore(storage,key){
  const storageKey=key||PREF_KEY;let current={...DEFAULTS};
  try{const raw=storage&&storage.getItem(storageKey);if(raw)current=normalizePreferences(JSON.parse(raw));}catch(_){current={...DEFAULTS};}
  function persist(){try{if(storage)storage.setItem(storageKey,JSON.stringify(current));}catch(_){}}
  return {get:()=>({...current}),set:function(patch){current=normalizePreferences({...current,...(patch||{})});persist();return {...current};},
   reset:function(){current={...DEFAULTS};persist();return {...current};}};
 }
 function filterConversations(items,filter){
  const list=Array.isArray(items)?items:[];
  switch(filter){
   case 'unread':return list.filter(x=>x.unread===true||Number(x.unreadCount)>0);
   case 'pinned':return list.filter(x=>x.pinned===true);
   case 'drafts':return list.filter(x=>x.draft===true);
   case 'groups':return list.filter(x=>x.type==='group');
   default:return list.slice();
  }
 }
 function getInboxCounts(items){
  const list=Array.isArray(items)?items:[];
  return {all:list.length,unread:list.filter(x=>x.unread===true||Number(x.unreadCount)>0).length,
   pinned:list.filter(x=>x.pinned===true).length,drafts:list.filter(x=>x.draft===true).length,
   groups:list.filter(x=>x.type==='group').length};
 }
 let prefs=null,toolbar=null,palette=null,paletteInput=null,resultHost=null,footer=null;
 let activeResults=[],activeIndex=0,initialized=false,previousFocus=null,conversationIsOpen=false;
 const COMMANDS=[
  {id:'new-chat',label:'New conversation',detail:'Start a direct message or group',run:()=>{if(typeof openNewChat==='function')openNewChat();}},
  {id:'settings',label:'Open settings',detail:'Account, privacy and appearance',run:()=>{if(typeof openSettings==='function')openSettings();}},
  {id:'composer',label:'Focus message composer',detail:'Jump straight to the current chat',run:()=>{if(typeof CHAT!=='undefined'&&CHAT)byId('msg-inp')?.focus();}},
  {id:'all',label:'Show all conversations',detail:'Smart Inbox · All',run:()=>setInboxFilter('all')},
  {id:'unread',label:'Show unread conversations',detail:'Smart Inbox · Unread',run:()=>setInboxFilter('unread')},
  {id:'pinned',label:'Show pinned conversations',detail:'Smart Inbox · Pinned',run:()=>setInboxFilter('pinned')},
  {id:'drafts',label:'Show conversations with drafts',detail:'Smart Inbox · Drafts',run:()=>setInboxFilter('drafts')},
  {id:'density',label:'Toggle compact density',detail:'Switch between compact and comfortable lists',run:()=>setPreference('compact',!prefs.get().compact)},
  {id:'motion',label:'Toggle reduced motion',detail:'Reduce interface movement and transitions',run:()=>setPreference('reducedMotion',!prefs.get().reducedMotion)},
  {id:'focus',label:'Toggle focus mode',detail:'Hide navigation while a conversation is open',run:()=>setPreference('focusMode',!prefs.get().focusMode)}
 ];
 function byId(id){return typeof document!=='undefined'?document.getElementById(id):null;}
 function safeCall(name,fallback){try{return typeof root[name]==='function'?root[name]():fallback;}catch(_){return fallback;}}
 function conversationItems(){
  const source=safeCall('getSortedConvs',[]);
  return (Array.isArray(source)?source:[]).map(function(item){
   let unreadCount=0,pinned=false,draft=false;
   try{unreadCount=Number(root.getUnreadCount(item.type,item.id,item.raw))||0;}catch(_){}
   try{pinned=!!root.isPinned(item.type,item.id);}catch(_){}
   try{draft=!!root.getDraftText(item.type,item.id)||/^\s*Draft:/i.test(item.preview||'');}catch(_){}
   return {...item,unreadCount,unread:unreadCount>0,pinned,draft};
  });
 }
 function setInboxFilter(filter){if(!FILTERS.includes(filter))return;prefs?.set({inboxFilter:filter});applyInboxFilter();}
 function renderToolbar(){
  const host=byId('sb-list');if(!host)return;
  if(toolbar&&toolbar.isConnected)return;
  toolbar=document.createElement('section');toolbar.className='zx-v5-inbox';toolbar.setAttribute('aria-label','Smart Inbox filters');
  const heading=document.createElement('div');heading.className='zx-v5-inbox-heading';
  const title=document.createElement('span');title.textContent='INBOX';
  const hint=document.createElement('span');hint.className='zx-v5-inbox-hint';hint.textContent='SMART VIEWS';
  heading.append(title,hint);
  const tabs=document.createElement('div');tabs.className='zx-v5-inbox-tabs';
  [['all','All'],['unread','Unread'],['pinned','Pinned'],['drafts','Drafts'],['groups','Groups']].forEach(entry=>{
   const button=document.createElement('button');button.type='button';button.className='zx-v5-inbox-tab';button.dataset.filter=entry[0];
   button.addEventListener('click',()=>setInboxFilter(entry[0]));
   const label=document.createElement('span');label.textContent=entry[1];
   const count=document.createElement('span');count.className='zx-v5-inbox-count';count.setAttribute('aria-hidden','true');
   button.append(label,count);tabs.appendChild(button);
  });
  toolbar.append(heading,tabs);host.insertBefore(toolbar,host.firstChild);
 }
 function applyInboxFilter(){
  if(typeof document==='undefined')return;renderToolbar();if(!toolbar||!prefs)return;
  const filter=prefs.get().inboxFilter,items=conversationItems(),counts=getInboxCounts(items);
  toolbar.querySelectorAll('.zx-v5-inbox-tab').forEach(button=>{
   const key=button.dataset.filter,selected=key===filter;
   button.classList.toggle('active',selected);button.setAttribute('aria-pressed',selected?'true':'false');
   const count=button.querySelector('.zx-v5-inbox-count');if(count)count.textContent=String(counts[key]||0);
  });
  const visible=new Set(filterConversations(items,filter).map(x=>x.type+':'+x.id));
  document.querySelectorAll('#sb-list .conv-item').forEach(node=>{
   node.hidden=filter!=='all'&&!visible.has(node.dataset.convType+':'+node.dataset.convId);
  });
 }
 function setPreference(name,value){
  if(!prefs||!['compact','reducedMotion','focusMode'].includes(name))return;
  prefs.set({[name]:value===true});applyPreferences();applyInboxFilter();
 }
 function applyPreferences(){
  if(!prefs||typeof document==='undefined')return;const state=prefs.get();
  document.body.classList.toggle('zx-v5-compact',state.compact);
  document.body.classList.toggle('zx-v5-reduce-motion',state.reducedMotion);syncFocusMode();
 }
 function syncFocusMode(open){
  if(typeof document==='undefined')return;if(typeof open==='boolean')conversationIsOpen=open;
  document.body.classList.toggle('zx-v5-focus-mode',!!(prefs&&prefs.get().focusMode&&conversationIsOpen));
 }
 function createPalette(){
  if(palette&&palette.isConnected)return;
  palette=document.createElement('div');palette.className='zx-v5-palette';palette.setAttribute('role','dialog');
  palette.setAttribute('aria-modal','true');palette.setAttribute('aria-label','Zyntrixly command palette');
  const panel=document.createElement('div');panel.className='zx-v5-palette-panel';
  const top=document.createElement('div');top.className='zx-v5-palette-top';
  const mark=document.createElement('span');mark.className='zx-v5-palette-mark';mark.textContent='Z';
  const wrap=document.createElement('div');wrap.className='zx-v5-palette-input-wrap';
  paletteInput=document.createElement('input');paletteInput.className='zx-v5-palette-input';paletteInput.type='search';
  paletteInput.autocomplete='off';paletteInput.spellcheck=false;paletteInput.placeholder='Search chats, messages or commands…';
  paletteInput.setAttribute('aria-label','Search chats, messages or commands');wrap.appendChild(paletteInput);
  const esc=document.createElement('kbd');esc.textContent='ESC';top.append(mark,wrap,esc);
  resultHost=document.createElement('div');resultHost.className='zx-v5-palette-results';resultHost.setAttribute('role','listbox');
  const bottom=document.createElement('div');bottom.className='zx-v5-palette-bottom';
  const note=document.createElement('span');note.textContent='↑ ↓ navigate   ↵ open   ESC close';
  footer=document.createElement('span');footer.textContent='Messages searched locally';bottom.append(note,footer);
  panel.append(top,resultHost,bottom);palette.appendChild(panel);
  palette.addEventListener('mousedown',event=>{if(event.target===palette)closePalette();});
  paletteInput.addEventListener('input',renderPaletteResults);paletteInput.addEventListener('keydown',onPaletteKeydown);
  document.body.appendChild(palette);
 }
 function openPalette(){
  if(typeof document==='undefined')return;createPalette();if(!palette||!palette.isConnected)return;
  previousFocus=document.activeElement;palette.classList.add('open');document.body.classList.add('zx-v5-palette-open');
  paletteInput.value='';renderPaletteResults();setTimeout(()=>paletteInput?.focus(),0);
 }
 function closePalette(){
  if(!palette)return;palette.classList.remove('open');document.body.classList.remove('zx-v5-palette-open');
  if(previousFocus&&typeof previousFocus.focus==='function'){try{previousFocus.focus();}catch(_){}}
 }
 function renderPaletteResults(){
  if(!paletteInput||!resultHost)return;
  const query=paletteInput.value.trim().toLocaleLowerCase(),results=[],seen=new Set();
  function add(item){if(results.length>=18||seen.has(item.id))return;seen.add(item.id);results.push(item);}
  if(!query){
   COMMANDS.slice(0,6).forEach(command=>add({id:'cmd:'+command.id,kind:'command',label:command.label,detail:command.detail,command}));
   conversationItems().slice(0,5).forEach(item=>add({id:'conv:'+item.type+':'+item.id,kind:'conversation',
    label:item.type==='dm'?'@'+item.name:item.name,detail:item.preview||'Open conversation',item}));
  }else{
   COMMANDS.filter(command=>(command.label+' '+command.detail).toLocaleLowerCase().includes(query))
    .forEach(command=>add({id:'cmd:'+command.id,kind:'command',label:command.label,detail:command.detail,command}));
   const conversations=conversationItems();
   conversations.filter(item=>(item.name+' '+(item.preview||'')).toLocaleLowerCase().includes(query)).slice(0,7)
    .forEach(item=>add({id:'conv:'+item.type+':'+item.id,kind:'conversation',label:item.type==='dm'?'@'+item.name:item.name,detail:item.preview||'Open conversation',item}));
   try{
    if(root.ZxSearch&&typeof root.ZxSearch.search==='function')root.ZxSearch.search(paletteInput.value,{limit:8}).forEach(message=>{
     const item=conversations.find(candidate=>candidate.id===message.conversationId&&candidate.type===message.conversationType);
     const who=message.senderUid===(root.ME&&root.ME.uid)?'You':(item?item.name:'Message');
     add({id:'msg:'+message.conversationType+':'+message.conversationId+':'+message.id,kind:'message',
      label:String(message.text||'').replace(/\s+/g,' ').slice(0,88)||'Message',
      detail:(item?item.name:'Conversation')+' · '+who+' · this session',message,item});
    });
   }catch(_){}
  }
  activeResults=results;activeIndex=0;resultHost.textContent='';
  if(!results.length){const empty=document.createElement('div');empty.className='zx-v5-palette-empty';
   empty.textContent=query?'No matches in chats or decrypted messages from this session.':'No quick actions available.';resultHost.appendChild(empty);}
  else results.forEach((result,index)=>{
   const button=document.createElement('button');button.type='button';button.className='zx-v5-palette-result';
   button.setAttribute('role','option');button.setAttribute('aria-selected',index===activeIndex?'true':'false');
   const glyph=document.createElement('span');glyph.className='zx-v5-result-glyph';glyph.textContent=result.kind==='message'?'↳':result.kind==='conversation'?'#':'⌘';
   const copy=document.createElement('span');copy.className='zx-v5-result-copy';
   const label=document.createElement('span');label.className='zx-v5-result-label';label.textContent=result.label;
   const detail=document.createElement('span');detail.className='zx-v5-result-detail';detail.textContent=result.detail||'';copy.append(label,detail);
   const tail=document.createElement('span');tail.className='zx-v5-result-tail';tail.textContent=result.kind==='command'?'Run':'Open';
   button.append(glyph,copy,tail);button.addEventListener('mouseenter',()=>setActiveResult(index));
   button.addEventListener('click',()=>activateResult(index));resultHost.appendChild(button);
  });
  if(footer){const count=root.ZxSearch&&typeof root.ZxSearch.getIndexedCount==='function'?root.ZxSearch.getIndexedCount():0;
   footer.textContent=count+' messages in memory · no cloud search';}
 }
 function setActiveResult(index){
  if(!activeResults.length)return;activeIndex=Math.max(0,Math.min(index,activeResults.length-1));
  resultHost.querySelectorAll('.zx-v5-palette-result').forEach((node,i)=>{
   node.classList.toggle('active',i===activeIndex);node.setAttribute('aria-selected',i===activeIndex?'true':'false');
  });
 }
 function onPaletteKeydown(event){
  if(event.key==='ArrowDown'){event.preventDefault();setActiveResult(activeIndex+1);}
  else if(event.key==='ArrowUp'){event.preventDefault();setActiveResult(activeIndex-1);}
  else if(event.key==='Enter'){event.preventDefault();activateResult(activeIndex);}
  else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePalette();}
 }
 async function activateResult(index){
  const result=activeResults[index];if(!result)return;closePalette();
  if(result.kind==='command'){try{result.command.run();}catch(error){notify('Could not run action: '+error.message);}return;}
  if(result.kind==='conversation'){await openConversation(result.item);return;}
  if(result.kind==='message'){
   if(!result.item){notify('That conversation is no longer in the current inbox.');return;}
   await openConversation(result.item);const row=await waitForMessageRow(result.message.id);
   if(!row){notify('Conversation opened, but the message could not be loaded.');return;}
   row.scrollIntoView({behavior:prefs&&prefs.get().reducedMotion?'auto':'smooth',block:'center'});
   row.classList.remove('zx-v5-message-focus');void row.offsetWidth;row.classList.add('zx-v5-message-focus');
   setTimeout(()=>row.classList.remove('zx-v5-message-focus'),2200);
  }
 }
 async function openConversation(item){
  if(!item)return;
  try{
   if(item.type==='dm'&&item.otherUid&&typeof root.startDM==='function')await root.startDM(item.otherUid,item.name,item.color);
   else if(item.type==='group'&&typeof root.openGroup==='function')root.openGroup(item.id,item.raw);
  }catch(error){notify('Could not open conversation: '+error.message);}
 }
 function waitForMessageRow(messageId){
  return new Promise(resolve=>{
   const rowId='m-'+messageId,existing=byId(rowId);if(existing){resolve(existing);return;}
   const host=byId('msgs-wrap');if(!host||typeof MutationObserver==='undefined'){resolve(null);return;}
   let settled=false;const rowObserver=new MutationObserver(()=>{const row=byId(rowId);if(row)finish(row);});
   const timeout=setTimeout(()=>finish(byId(rowId)),6000);
   function finish(value){if(settled)return;settled=true;rowObserver.disconnect();clearTimeout(timeout);resolve(value||null);}
   rowObserver.observe(host,{childList:true,subtree:true});
  });
 }
 function notify(message){if(typeof root.toast==='function')root.toast(message,3200);}
 function wireComposer(){
  const composer=document.querySelector('.composer'),messageArea=byId('msgs-wrap'),input=byId('msg-inp');
  if(!composer||composer.dataset.zxV5Wired==='1')return;composer.dataset.zxV5Wired='1';
  function stage(file){if(!file)return;if(typeof root.ZxStageAttachmentFile!=='function'){notify('Attachment staging is not available in this build.');return;}root.ZxStageAttachmentFile(file);}
  function isFileDrag(event){return !!(event.dataTransfer&&Array.from(event.dataTransfer.types||[]).includes('Files'));}
  [composer,messageArea].filter(Boolean).forEach(target=>{
   target.addEventListener('dragenter',event=>{if(!isFileDrag(event))return;event.preventDefault();composer.classList.add('zx-v5-drop-ready');});
   target.addEventListener('dragover',event=>{if(!isFileDrag(event))return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';composer.classList.add('zx-v5-drop-ready');});
   target.addEventListener('dragleave',event=>{if(event.relatedTarget&&target.contains(event.relatedTarget))return;composer.classList.remove('zx-v5-drop-ready');});
   target.addEventListener('drop',event=>{
    if(!isFileDrag(event))return;event.preventDefault();composer.classList.remove('zx-v5-drop-ready');
    const file=event.dataTransfer.files&&event.dataTransfer.files[0];if(file)stage(file);
    if(event.dataTransfer.files&&event.dataTransfer.files.length>1)notify('V5 currently stages one attachment at a time.');
   });
  });
  if(input)input.addEventListener('paste',event=>{
   const files=event.clipboardData&&event.clipboardData.files;if(!files||!files.length)return;
   const imageFile=Array.from(files).find(file=>file.type&&file.type.startsWith('image/'));
   if(!imageFile)return;event.preventDefault();stage(imageFile);
  });
 }
 function init(){
  if(initialized||typeof document==='undefined')return;initialized=true;
  prefs=createPreferenceStore(root.localStorage);renderToolbar();applyPreferences();applyInboxFilter();
  const list=byId('sb-list');
  if(list&&typeof MutationObserver!=='undefined'){const mo=new MutationObserver(()=>applyInboxFilter());mo.observe(list,{childList:true,subtree:true});}
  wireComposer();
 }
 function resetSession(){closePalette();if(root.ZxSearch&&typeof root.ZxSearch.clearIndex==='function')root.ZxSearch.clearIndex();syncFocusMode(false);}
 function getStatus(){return {version:'5.0.0',preferences:prefs?prefs.get():{...DEFAULTS},
  indexedMessages:root.ZxSearch&&typeof root.ZxSearch.getIndexedCount==='function'?root.ZxSearch.getIndexedCount():0,
  searchScope:'decrypted messages from conversations opened in this browser session'};}
 const api={normalizePreferences,createPreferenceStore,filterConversations,getInboxCounts,init,openPalette,closePalette,
  isPaletteOpen:()=>!!(palette&&palette.isConnected&&palette.classList.contains('open')),setInboxFilter,setPreference,syncFocusMode,resetSession,getStatus};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ZxV5=api;
})(typeof window!=='undefined'?window:globalThis);
