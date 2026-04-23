// ════════════════════════════════════════════════
//  ZYNTRIXLY — app.js  (Final)
//  All features. All bugs fixed.
// ════════════════════════════════════════════════

/* ── EMOJI KEYS ── */
const E2K={'👍':'thumb','❤️':'heart','😂':'laugh','😮':'wow','😢':'sad','🔥':'fire'};
const K2E=Object.fromEntries(Object.entries(E2K).map(([e,k])=>[k,e]));

/* ── STATE ── */
let ME=null;            // {uid,username,color,privKey}
let CHAT=null;          // active chat object
let msgUnsub=null;      // firestore listener unsubscribe
let replyTo=null;       // {msgId,senderName,text}
let ctxMsgId=null;
let ctxMine=false;
let grpMembers=[];
let fontStyle='modern'; // 'modern'|'futuristic'|'rounded'
let isSignIn=true;
let sbArchOpen=false;
let settingsView='main';// current settings sub-view
var _startupMinDone=window._startupMinDone||false;
var _authResolved=window._authResolved||false;
let deferredInstallPrompt=null;
let installBannerTimer=null;
let presenceUnsub=null;
let chatMetaUnsub=null;
let typingStopTimer=null;
let typingActive=false;
let presenceStatusText='end-to-end encrypted';
let typingUsers=[];
let forwardPayload=null;
const CONV_INDEX={};
const _iosDevice=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;
let dmListUnsub=null;
let groupListUnsub=null;
let selectionMode=false;
let selectedMsgIds=new Set();
let lastDmReadAt=0;
let chatSessionId=0;

/* ════════════════════════════════════════════════
   STARTUP ANIMATION
════════════════════════════════════════════════ */
// Startup animation logic moved to index.html inline script

// Load saved font
const saved=localStorage.getItem('zx_font')||'modern';
applyFont(saved,false);

// Global click: close menus
document.addEventListener('click',e=>{
  if(!e.target.closest('#ctx'))           closeCtx();
  if(!e.target.closest('#react-pick'))    closeRP();
  if(!e.target.closest('#chat-menu'))     closeChatMenu();
  if(!e.target.closest('.sb-search-wrap'))document.getElementById('sb-search-drop').classList.add('hidden');
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeAllModals();cancelReply();closeCtx();closeRP();
  }
});

// Build settings items
buildSettings();
registerServiceWorker();
setupInstallPrompt();


/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */
function id(i){return document.getElementById(i);}
function g(i){return(document.getElementById(i)?.value||'').trim();}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escQ(s){return String(s).replace(/'/g,"\\'")}

function toast(msg,dur=2500){
  const el=id('toast');
  id('toast-msg').textContent=msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>el.classList.remove('show'),dur);
}

function showErr(elId,msg){
  const el=id(elId);el.textContent=msg;el.classList.remove('hidden');
}
function clearErr(elId){const el=id(elId);el.textContent='';el.classList.add('hidden');}

function finishStartup(){
  // Only hide startup if the animation min-time has passed
  if(!(window._startupMinDone || _startupMinDone)) return;
  const startup=id('startup');
  if(!startup||startup.classList.contains('out'))return;
  startup.classList.add('out');
  setTimeout(()=>{startup.style.display='none';},500);
}

function setCachedProfile(uid,data){
  try{
    localStorage.setItem('zx_me_'+uid,JSON.stringify({
      uid,
      username:data.username,
      color:data.color||'#3b82f6',
      publicKey:data.publicKey||null
    }));
  }catch(e){}
}

function getCachedProfile(uid){
  try{
    const raw=localStorage.getItem('zx_me_'+uid);
    return raw?JSON.parse(raw):null;
  }catch(e){
    return null;
  }
}

function chatStorageKey(prefix,type,id){
  return `${prefix}_${ME?.uid||'anon'}_${type}_${id}`;
}

function chatPrefKey(type,id){
  return chatStorageKey('zx_pref',type,id);
}

function getChatPrefs(type,id){
  try{return JSON.parse(localStorage.getItem(chatPrefKey(type,id))||'{}');}catch(e){return {};}
}

function setChatPrefs(type,id,patch){
  try{
    const next={...getChatPrefs(type,id),...patch};
    localStorage.setItem(chatPrefKey(type,id),JSON.stringify(next));
  }catch(e){}
}

function isPinned(type,id){return !!getChatPrefs(type,id).pinned;}
function isMuted(type,id){return !!getChatPrefs(type,id).muted;}
function isArchived(type,id){return !!getChatPrefs(type,id).archived;}

function getDraftText(type,id){
  try{return localStorage.getItem(chatStorageKey('zx_draft',type,id))||'';}catch(e){return '';}
}

function saveDraftText(type,id,text){
  try{
    const key=chatStorageKey('zx_draft',type,id);
    if(text) localStorage.setItem(key,text);
    else localStorage.removeItem(key);
  }catch(e){}
}

function getSeenAt(type,id){
  try{return Number(localStorage.getItem(chatStorageKey('zx_seen',type,id))||0);}catch(e){return 0;}
}

function markChatSeen(type,id){
  try{localStorage.setItem(chatStorageKey('zx_seen',type,id),String(Date.now()));}catch(e){}
  if(type==='dm'&&ME){
    const now=Date.now();
    if(now-lastDmReadAt>2500){
      lastDmReadAt=now;
      db.collection('dms').doc(id).update({[`lastRead.${ME.uid}`]:now}).catch(()=>{});
    }
  }
}

function getTypingNames(data){
  const now=Date.now();
  const typing=data?.typing||{};
  return Object.entries(typing)
    .filter(([uid,ts])=>uid!==ME?.uid&&typeof ts==='number'&&(now-ts)<5000)
    .map(([uid])=>data?.memberNames?.[uid]||'Someone');
}

function renderChatHeaderSub(){
  const sub=id('chat-hdr-sub');
  if(!sub||!CHAT)return;
  if(typingUsers.length){
    if(CHAT.type==='group'){
      sub.textContent=typingUsers.length===1?`${typingUsers[0]} is typing…`:`${typingUsers.length} people are typing…`;
    } else {
      sub.textContent='typing…';
    }
    return;
  }
  sub.textContent=CHAT.type==='group'
    ?`${CHAT.members.length} members · encrypted`
    :(presenceStatusText||'end-to-end encrypted');
}

function refreshReadReceipts(){
  if(CHAT?.type!=='dm')return;
  const otherRead=Number(CHAT.lastRead?.[CHAT.otherUid]||0);
  document.querySelectorAll('#msgs-wrap .msg-row.mine').forEach(row=>{
    const tk=row.querySelector('.msg-ticks');
    if(!tk)return;
    const sentAt=Number(row.dataset.sentAt||0);
    tk.textContent=otherRead&&sentAt&&otherRead>=sentAt?'✓✓ Seen':'✓✓';
  });
}

function updateSelectionBar(){
  id('selection-strip')?.classList.toggle('hidden',!selectionMode);
  if(selectionMode) id('sel-count').textContent=`${selectedMsgIds.size} selected`;
}

function clearChatWatchers(){
  if(presenceUnsub){presenceUnsub();presenceUnsub=null;}
  if(chatMetaUnsub){chatMetaUnsub();chatMetaUnsub=null;}
  clearTimeout(typingStopTimer);
  typingActive=false;
  typingUsers=[];
  presenceStatusText='end-to-end encrypted';
  lastDmReadAt=0;
}

function watchChatMeta(){
  if(!CHAT)return;
  if(chatMetaUnsub){chatMetaUnsub();chatMetaUnsub=null;}
  const ref=CHAT.type==='dm'
    ?db.collection('dms').doc(CHAT.id)
    :db.collection('groups').doc(CHAT.id);
  chatMetaUnsub=ref.onSnapshot(snap=>{
    const data=snap.data();
    if(!data||!CHAT||CHAT.id!==(snap.id))return;
    typingUsers=getTypingNames(data);
    if(CHAT.type==='dm'){
      CHAT.lastRead=data.lastRead||{};
      refreshReadReceipts();
    }
    if(CHAT.type==='group'){
      CHAT.members=data.members||CHAT.members;
      CHAT.memberNames=data.memberNames||CHAT.memberNames;
      CHAT.memberColors=data.memberColors||CHAT.memberColors;
      CHAT.publicKeys=data.publicKeys||CHAT.publicKeys;
      CHAT.admins=data.admins||CHAT.admins;
    }
    renderChatHeaderSub();
  },err=>console.error('chat meta listener:',err));
}

async function setTyping(on){
  if(!CHAT||!ME)return;
  if(on===typingActive)return;
  typingActive=on;
  const ref=CHAT.type==='dm'
    ?db.collection('dms').doc(CHAT.id)
    :db.collection('groups').doc(CHAT.id);
  const value=on?Date.now():firebase.firestore.FieldValue.delete();
  await ref.update({[`typing.${ME.uid}`]:value}).catch(()=>{});
}

function stopTypingSoon(){
  clearTimeout(typingStopTimer);
  typingStopTimer=setTimeout(()=>setTyping(false),2200);
}

function handleComposerInput(){
  if(!CHAT||!ME)return;
  const inp=id('msg-inp');
  const text=(inp?.value||'').trim();
  saveDraftText(CHAT.type,CHAT.id,inp?.value||'');
  if(text){
    setTyping(true);
    stopTypingSoon();
  } else {
    setTyping(false);
  }
}

function restoreDraft(){
  if(!CHAT)return;
  const inp=id('msg-inp');
  if(!inp)return;
  inp.value=getDraftText(CHAT.type,CHAT.id);
}

function getChatContext(chat=CHAT){
  if(!chat)return null;
  return {
    type:chat.type,
    id:chat.id,
    name:chat.name,
    otherUid:chat.otherUid||null,
    members:Array.isArray(chat.members)?[...chat.members]:[],
    memberNames:{...(chat.memberNames||{})},
    memberColors:{...(chat.memberColors||{})},
    publicKeys:{...(chat.publicKeys||{})},
    lastRead:{...(chat.lastRead||{})}
  };
}

function updateCallButtons(chat=CHAT){
  try{
    const vBtn=document.getElementById('hdr-voice-btn');
    const vidBtn=document.getElementById('hdr-video-btn');
    const isDM=!!(chat&&chat.type==='dm');
    if(vBtn)  vBtn.style.display=isDM?'flex':'none';
    if(vidBtn)vidBtn.style.display=isDM?'flex':'none';
  }catch(e){}
}

function updateMobileChatActions(chat=CHAT){
  const mobBack=id('mob-back-btn');
  const mobMore=id('mob-more-btn');
  const mobGrp=id('mob-grpinfo-btn');
  const mobAv=id('mob-av-btn');
  const mobNC=id('mob-newchat-btn');
  const inChat=!!chat;
  const isGroup=chat?.type==='group';

  if(mobBack) mobBack.style.display=inChat?'flex':'none';
  if(mobMore) mobMore.style.display=inChat&&!isGroup?'flex':'none';
  if(mobGrp){
    mobGrp.style.display=inChat&&isGroup?'flex':'none';
    mobGrp.classList.toggle('hidden',!(inChat&&isGroup));
  }
  if(mobAv) mobAv.style.display=inChat?'none':'flex';
  if(mobNC) mobNC.style.display=inChat?'none':'flex';
}

function getPreviewData(type,docId,data,fallback){
  const draft=getDraftText(type,docId);
  if(draft){
    return {text:`Draft: ${draft}`,mode:'draft'};
  }
  const typing=getTypingNames(data);
  if(typing.length){
    return {text:type==='group'
      ?(typing.length===1?`${typing[0]} is typing…`:`${typing.length} people are typing…`)
      :'typing…',mode:'typing'};
  }
  return {text:data.lastMsg||fallback,mode:'default'};
}

function getUnreadCount(type,docId,data){
  const seen=getSeenAt(type,docId);
  const lastAt=data.lastMsgAt?.toMillis?data.lastMsgAt.toMillis():((data.lastMsgAt?.seconds||0)*1000);
  if(!lastAt||lastAt<=seen)return 0;
  if(data.lastSenderUid===ME.uid)return 0;
  return 1;
}

function showUnsupportedFeature(){
  toast('File sharing is not available yet in this build.',3000);
}

/* ═══ FILE SHARING ═══════════════════════════════ */
function openFileShare(){
  if(!CHAT){toast('Open a chat first.');return;}
  const input=document.createElement('input');
  input.type='file'; input.accept='*/*';
  input.onchange=async()=>{
    const file=input.files?.[0]; if(!file)return;
    if(file.size>900*1024){toast('Max file size: 900KB for encrypted transfers',3000);return;}
    toast('Encrypting & uploading…',12000);
    try{
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const buf=await file.arrayBuffer();
      const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,buf);
      const rawKey=await crypto.subtle.exportKey('raw',key);
      const keyHex=Array.from(new Uint8Array(rawKey)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const ivHex=Array.from(iv).map(b=>b.toString(16).padStart(2,'0')).join('');
      // Store encrypted file as base64 inline in Firestore (max 900KB encrypted)
      const encArr=new Uint8Array(enc);
      let binary = ''; const len = encArr.byteLength; for (let i = 0; i < len; i++) { binary += String.fromCharCode(encArr[i]); } const encB64 = btoa(binary);
      const payload=JSON.stringify({__type:'file',data:encB64,name:file.name,size:file.size,key:keyHex,iv:ivHex});
      if(CHAT.type==='dm')await sendDMMsg(payload,null);
      else await sendGrpMsg(payload,null);
      toast('📎 File sent!');
    }catch(e){
      // Never log encryption keys
      toast('Upload failed: '+(e.message||'Unknown error'),4000);
    }
  };
  input.click();
}

async function downloadFileMsg(url,name,keyHex,ivHex,inlineData){
  try{
    toast('Decrypting…',5000);
    let encBuf;
    if(inlineData && inlineData.length>0){
      // Inline base64 (current format — stored in Firestore)
      try{
        const binStr=atob(inlineData);
        const bytes=new Uint8Array(binStr.length);
        for(let i=0;i<binStr.length;i++) bytes[i]=binStr.charCodeAt(i);
        encBuf=bytes.buffer;
      }catch(b64err){
        throw new Error('File data is corrupted');
      }
    } else if(url && url.length>0){
      const res=await fetch(url,{mode:'cors'});
      if(!res.ok)throw new Error('File download failed ('+res.status+')');
      encBuf=await res.arrayBuffer();
    } else {
      throw new Error('No file data found — try re-sending the file');
    }
    const rawKey=new Uint8Array(keyHex.match(/.{2}/g).map(b=>parseInt(b,16)));
    const iv=new Uint8Array(ivHex.match(/.{2}/g).map(b=>parseInt(b,16)));
    const aesKey=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);
    const decBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},aesKey,encBuf);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([decBuf]));
    a.download=name; a.click();
    toast('✅ File saved!');
  }catch(e){
    toast('Download failed: '+e.message,4000);
  }
}

/* ═══ EMOJI PICKER ════════════════════════════════ */
const EMOJI_SET=['😀','😂','🥰','😎','🤔','😭','🤣','😍','😅','🙏',
  '👍','👏','💯','🔥','✨','❤️','💔','🎉','🎊','⭐',
  '😮','😢','😡','😱','😴','🤯','😇','🤗','😏','😬',
  '🍕','☕','🎮','🎵','📱','💻','🚀','🌈','💡','🔒'];

function openEmojiPicker(e){
  e.stopPropagation();
  let picker=document.getElementById('full-emoji-pick');
  if(!picker){
    picker=document.createElement('div');
    picker.id='full-emoji-pick';
    picker.className='glass-panel-strong';
    picker.style.cssText='position:fixed;z-index:9999;padding:8px;display:flex;flex-wrap:wrap;width:224px;gap:2px;border-radius:14px;border:1px solid rgba(59,130,246,.25);box-shadow:0 8px 32px rgba(0,0,0,.5)';
    EMOJI_SET.forEach(em=>{
      const btn=document.createElement('button');
      btn.textContent=em;
      btn.style.cssText='width:32px;height:32px;font-size:18px;border-radius:8px;border:none;background:none;cursor:pointer;transition:background .1s';
      btn.onmouseover=()=>btn.style.background='rgba(59,130,246,.15)';
      btn.onmouseout=()=>btn.style.background='none';
      btn.onclick=()=>insertEmoji(em);
      picker.appendChild(btn);
    });
    document.body.appendChild(picker);
    document.addEventListener('click',ev=>{
      if(!ev.target.closest('#full-emoji-pick')&&!ev.target.closest('#emoji-btn')){
        picker.style.display='none';
      }
    });
  }
  const btn=document.getElementById('emoji-btn');
  if(!btn)return;
  const rect=btn.getBoundingClientRect();
  const pickerH=244;
  const spaceAbove=rect.top;
  const spaceBelow=window.innerHeight-rect.bottom;
  let top;
  if(spaceAbove>=pickerH||spaceAbove>spaceBelow){
    top=Math.max(4,rect.top-pickerH-6);
  } else {
    top=Math.min(rect.bottom+6,window.innerHeight-pickerH-4);
  }
  picker.style.left=Math.min(rect.left,window.innerWidth-240)+'px';
  picker.style.top=top+'px';
  picker.style.display=picker.style.display==='flex'?'none':'flex';
}

function insertEmoji(em){
  const inp=document.getElementById('msg-inp'); if(!inp)return;
  const s=inp.selectionStart||0, e2=inp.selectionEnd||0;
  inp.value=inp.value.slice(0,s)+em+inp.value.slice(e2);
  inp.selectionStart=inp.selectionEnd=s+em.length;
  inp.focus();
  const picker=document.getElementById('full-emoji-pick');
  if(picker)picker.style.display='none';
  handleComposerInput();
}

function resetConvIndex(prefix){
  Object.keys(CONV_INDEX).forEach(key=>{if(key.startsWith(prefix+':')) delete CONV_INDEX[key];});
}

function convKey(type,id){return `${type}:${id}`;}

function storeConv(type,id,data){
  CONV_INDEX[convKey(type,id)]={...data,type,id};
}

function getSortedConvs(typeFilter=null){
  return Object.values(CONV_INDEX)
    .filter(item=>!typeFilter||item.type===typeFilter)
    .sort((a,b)=>{
      const ap=isPinned(a.type,a.id)?1:0;
      const bp=isPinned(b.type,b.id)?1:0;
      if(ap!==bp) return bp-ap;
      return (b.sortAt||0)-(a.sortAt||0);
    });
}

function refreshConversationLists(){
  if(!ME)return;
  startDMListener();
  startGroupListener();
}

function isStandaloneMode(){
  return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
}

function isIosPwaCandidate(){
  return _iosDevice&&/Safari/.test(navigator.userAgent)&&!/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)&&!isStandaloneMode();
}

function canShowInstallOption(){
  return !isStandaloneMode()&&(!!deferredInstallPrompt||isIosPwaCandidate());
}

function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(err=>{
      console.error('Service worker registration failed:',err);
    });
  },{once:true});
}

function setupInstallPrompt(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    localStorage.removeItem('zx_install_dismissed');
    updateInstallUI();
    queueInstallBanner();
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    localStorage.removeItem('zx_install_dismissed');
    hideInstallBanner();
    updateInstallUI();
    toast('Zynix installed.',3000);
  });

  updateInstallUI();
  queueInstallBanner();
}

function updateInstallUI(){
  const btn=id('install-app-btn');
  const label=id('install-app-label');
  const sub=id('install-app-sub');
  if(btn&&label&&sub){
    const canInstall=canShowInstallOption();
    btn.classList.toggle('hidden',!canInstall);
    if(canInstall){
      const iosOnly=!deferredInstallPrompt&&isIosPwaCandidate();
      label.textContent=iosOnly?'Add to Home Screen':'Install App';
      sub.textContent=iosOnly?'Use Safari Share → Add to Home Screen.':'Open Zynix in its own window.';
    }
  }

  const banner=id('install-banner');
  if(!banner)return;
  if(!canShowInstallOption()||localStorage.getItem('zx_install_dismissed')==='1'){
    hideInstallBanner();
    return;
  }
  id('install-banner-title').textContent=!deferredInstallPrompt&&isIosPwaCandidate()?'Add Zynix to Home Screen':'Install Zynix';
  id('install-banner-sub').textContent=!deferredInstallPrompt&&isIosPwaCandidate()
    ?'On iPhone or iPad, use Safari Share → Add to Home Screen.'
    :'Install the web app for a standalone window and faster offline startup.';
}

function queueInstallBanner(){
  clearTimeout(installBannerTimer);
  if(!canShowInstallOption()||localStorage.getItem('zx_install_dismissed')==='1')return;
  installBannerTimer=setTimeout(()=>{
    if(canShowInstallOption()) id('install-banner')?.classList.remove('hidden');
  },1800);
}

function hideInstallBanner(){
  clearTimeout(installBannerTimer);
  id('install-banner')?.classList.add('hidden');
}

function dismissInstallBanner(){
  localStorage.setItem('zx_install_dismissed','1');
  hideInstallBanner();
  updateInstallUI();
}

async function installApp(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted') hideInstallBanner();
    deferredInstallPrompt=null;
    updateInstallUI();
    return;
  }
  if(isIosPwaCandidate()){
    toast('In Safari, tap Share and choose Add to Home Screen.',4500);
    hideInstallBanner();
    return;
  }
  toast('Install is not available in this browser yet.',3000);
}

/* ════════════════════════════════════════════════
   FONT
════════════════════════════════════════════════ */
function applyFont(style,save=true){
  fontStyle=style;
  document.body.classList.remove('font-modern','font-futuristic','font-rounded');
  document.body.classList.add('font-'+style);
  if(save)localStorage.setItem('zx_font',style);
  // Update preview & options in settings if open
  const prev=id('font-preview');
  if(prev){prev.classList.remove('font-modern','font-futuristic','font-rounded');prev.classList.add('font-'+style);}
  buildFontOptions();
}

/* ════════════════════════════════════════════════
   AUTH TOGGLE
════════════════════════════════════════════════ */
function toggleAuthMode(){
  isSignIn=!isSignIn;
  id('auth-title').textContent=isSignIn?'Welcome back':'Create account';
  id('auth-subtitle').textContent=isSignIn?'Sign in to continue to Zynix':'Private by default 🔒';
  id('auth-btn-label').textContent=isSignIn?'Sign in':'Create account';
  id('auth-toggle-label').textContent=isSignIn?'Create a new account':'Already have an account?';
  id('f-confirm-wrap').classList.toggle('hidden',isSignIn);
  clearErr('auth-err');
}

function togglePw(inputId,btn){
  const inp=id(inputId);
  const on=inp.type==='password';
  inp.type=on?'text':'password';
  btn.querySelector('.eye-off').classList.toggle('hidden',on);
  btn.querySelector('.eye-on').classList.toggle('hidden',!on);
}

/* ════════════════════════════════════════════════
   AUTH — REGISTER & LOGIN
════════════════════════════════════════════════ */
function toEmail(u){return u.toLowerCase().trim()+'@zyntrixly.app';}

async function submitAuth(e){
  e.preventDefault();
  clearErr('auth-err');
  const username=g('f-user').toLowerCase().trim();
  const pass=g('f-pass');

  if(!username||!pass){showErr('auth-err','Please fill in all fields.');return;}
  if(pass.length<6){showErr('auth-err','Password must be at least 6 characters.');return;}

  if(!isSignIn){
    if(!/^[a-z0-9_]{2,20}$/.test(username)){showErr('auth-err','Username: 2-20 chars, letters/numbers/underscore only.');return;}
    const confirm=g('f-confirm');
    if(pass!==confirm){showErr('auth-err','Passwords do not match.');return;}
    await doRegister(username,pass);
  } else {
    await doLogin(username,pass);
  }
}

// ─────────────────────────────────────────────
//  FLAG: true while doRegister() is mid-flight.
//  Prevents onAuthStateChanged from running until
//  the Firestore doc has been written.
// ─────────────────────────────────────────────
let _registering=false;

async function doRegister(username,pass){
  setAuthLoading(true);
  _registering=true; // BLOCK onAuthStateChanged

  try{
    const cred=await auth.createUserWithEmailAndPassword(toEmail(username),pass);
    const uid=cred.user.uid;

    // Generate keys BEFORE writing to Firestore
    const{publicKeyJwk,privateKeyJwk}=await Crypto.generateKeyPair();
    Crypto.saveLocal(uid,privateKeyJwk);
    const wrapped=await Crypto.wrapKey(privateKeyJwk,pass);

    await db.collection('users').doc(uid).set({
      uid,username,color:'#3b82f6',
      publicKey:publicKeyJwk,
      wrappedPrivKey:wrapped,
      online:true,
      lastSeen:firebase.firestore.FieldValue.serverTimestamp(),
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    _registering=false;
    toast('Account created! Welcome 🎉');
    // Manually boot the app — onAuthStateChanged was blocked
    await bootApp(cred.user);
  } catch(err){
    _registering=false;
    // If Firestore write failed but auth user was created, clean up
    if(auth.currentUser) await auth.signOut();
    showErr('auth-err',authErrMsg(err));
    setAuthLoading(false);
  }
}

async function doLogin(username,pass){
  setAuthLoading(true);
  // ── KEY INSIGHT ──────────────────────────────
  // Store password BEFORE the await call.
  // onAuthStateChanged fires when signInWithEmailAndPassword
  // resolves. By then sessionStorage already has the password.
  // ─────────────────────────────────────────────
  sessionStorage.setItem('zx_p',pass);
  try{
    const cred=await auth.signInWithEmailAndPassword(toEmail(username),pass);
    // bootApp is called by onAuthStateChanged but let's call it
    // directly too to guarantee it runs with the password still in sessionStorage
    await bootApp(cred.user);
  } catch(err){
    sessionStorage.removeItem('zx_p');
    showErr('auth-err',authErrMsg(err));
    setAuthLoading(false);
  }
}

function authErrMsg(err){
  const code = err && err.code ? err.code : '';
  const msg = err && err.message ? err.message : 'Something went wrong. Try again.';
  return({
    'auth/email-already-in-use':'Username already taken.',
    'auth/invalid-credential':  'Wrong username or password.',
    'auth/user-not-found':      'No account with that username.',
    'auth/wrong-password':      'Wrong password.',
    'auth/weak-password':       'Password is too short.',
    'auth/too-many-requests':   'Too many attempts. Please wait.',
  })[code]||msg;
}

function setAuthLoading(on){
  id('auth-submit').disabled=on;
  id('auth-btn-label').classList.toggle('hidden',on);
  id('auth-btn-arrow').classList.toggle('hidden',on);
  id('auth-spinner').classList.toggle('hidden',!on);
}

// ─────────────────────────────────────────────
//  onAuthStateChanged — ONLY handles page-reload
//  auto-login (Firebase remembered session).
//  Fresh register/login are handled by bootApp().
// ─────────────────────────────────────────────
let _booted=false;
function _attachAuthListener(){
  if(typeof auth==='undefined'||!auth){
    console.error('[Zyntrixly] auth not ready');
    return;
  }
auth.onAuthStateChanged(async user=>{
  if(_registering) return; // registration in progress — skip
  if(user){
    if(_booted) return;
    // Don't show auth-screen while we load user data
    await bootApp(user);
  } else {
    _booted=false;
    ME=null;CHAT=null;
    _authResolved=true;
    window._authResolved=true;
    showScreen('auth-screen');
    finishStartup();
    setAuthLoading(false);
  }
}); // end auth.onAuthStateChanged
} // end _attachAuthListener

// ─────────────────────────────────────────────
//  bootApp — THE single place that sets up the
//  app after authentication. Called from:
//    • doRegister (after Firestore doc written)
//    • doLogin (after signIn resolves)
//    • onAuthStateChanged (page reload)
// ─────────────────────────────────────────────
async function bootApp(user){
  if(_booted) return;
  _booted=true;
  // Hard cap: startup overlay always clears within 5s of bootApp starting
  setTimeout(()=>{ window._startupMinDone=true; if(typeof finishStartup==='function')finishStartup(); },5000);

  try{
    // Fetch user doc — retry once if race condition (doc just created)
    let snap=await db.collection('users').doc(user.uid).get();
    if(!snap.exists){
      await new Promise(r=>setTimeout(r,1500));
      snap=await db.collection('users').doc(user.uid).get();
    }
    const cachedProfile=getCachedProfile(user.uid);
    if(!snap.exists&&!cachedProfile){
      // Genuine orphan account — sign out cleanly
      _booted=false;
      _authResolved=true;
      showErr('auth-err','Account setup incomplete. Please register again.');
      await auth.signOut();
      return;
    }
    const data=snap.exists?snap.data():cachedProfile;
    if(snap.exists)setCachedProfile(user.uid,data);

    // ── KEY RESTORATION ──────────────────────
    // Priority 1: already in localStorage (same device)
    let privKey=Crypto.loadLocal(user.uid);

    // Priority 2: unwrap using password in sessionStorage (just logged in)
    if(!privKey){
      const tmpPass=sessionStorage.getItem('zx_p')||'';
      if(tmpPass&&data.wrappedPrivKey){
        privKey=await Crypto.unwrapKey(data.wrappedPrivKey,tmpPass);
        if(privKey){
          Crypto.saveLocal(user.uid,privKey);
          // Also freshen wrappedPrivKey in case it was missing
          if(!data.wrappedPrivKey){
            const newWrapped=await Crypto.wrapKey(privKey,tmpPass);
            await db.collection('users').doc(user.uid).update({wrappedPrivKey:newWrapped});
          }
          toast('🔑 Keys restored!');
        }
      }
    }
    sessionStorage.removeItem('zx_p');

    ME={uid:user.uid,username:data.username,color:data.color||'#3b82f6',privKey,publicKey:data.publicKey};

    setOnline(true);
    window.addEventListener('beforeunload',()=>setOnline(false));
    setInterval(()=>setOnline(true),60000);

    updateMeUI();
    _authResolved=true;
    window._authResolved=true;
    showScreen('app-screen');
    finishStartup();
    startDMListener();
    startGroupListener();
    updateNotifUI();
    setAuthLoading(false);
    // Start listening for incoming calls — wait until webrtc.js is loaded
    function _startCallListener(){
      if(typeof ZxCall!=='undefined'){
        try{ ZxCall.listenForIncomingCalls(); }catch(e){ console.error('Call listener error:',e); }
      } else {
        setTimeout(_startCallListener, 300);
      }
    }
    setTimeout(_startCallListener, 500);

    // ── SHOW RESTORE MODAL if still no key ──
    if(!ME.privKey){
      if(data.wrappedPrivKey){
        // Has wrapped key — user just needs to enter password once
        showRestoreModal(false);
      } else {
        // Old account with no wrappedPrivKey — need to generate fresh keys
        showRestoreModal(true);
      }
    }

  } catch(err){
    console.error('bootApp error:',err);
    const cachedProfile=getCachedProfile(user.uid);
    if(cachedProfile){
      const privKey=Crypto.loadLocal(user.uid);
      ME={uid:user.uid,username:cachedProfile.username,color:cachedProfile.color||'#3b82f6',privKey,publicKey:cachedProfile.publicKey||null};
      updateMeUI();
      _authResolved=true;
      window._authResolved=true;
      showScreen('app-screen');
      finishStartup();
      startDMListener();
      startGroupListener();
      updateNotifUI();
      setAuthLoading(false);
      toast('Offline mode: showing cached chats.',4000);
      return;
    }
    _booted=false;
    _authResolved=true;
    showScreen('auth-screen');
    showErr('auth-err',navigator.onLine?'Error loading account. Please try again.':'You are offline and this device does not have cached account data yet.');
    finishStartup();
    setAuthLoading(false);
  }
}

// ─────────────────────────────────────────────
//  KEY RESTORE MODAL
//  needsSetup=false → has wrappedPrivKey, just needs password
//  needsSetup=true  → old account, will generate fresh keys
// ─────────────────────────────────────────────
function showRestoreModal(needsSetup){
  id('key-restore-modal').classList.remove('hidden');
  id('kr-needs-setup').value=needsSetup?'1':'0';
  if(needsSetup){
    id('kr-title').textContent='Set up encryption on this device';
    id('kr-desc').textContent='Your account was created on an older version. Enter your password to generate new encryption keys. Existing messages will stay encrypted but new ones will work perfectly.';
    id('kr-label').textContent='Set up keys';
  } else {
    id('kr-title').textContent='Restore encryption keys';
    id('kr-desc').textContent="This device doesn't have your encryption keys yet. Enter your password once — you won't be asked again.";
    id('kr-label').textContent='Unlock messages';
  }
  setTimeout(()=>id('kr-pass')?.focus(),300);
}

async function restoreKeys(){
  const pass=(id('kr-pass')?.value||'').trim();
  const errEl=id('kr-err');
  errEl.classList.add('hidden');
  if(!pass){errEl.textContent='Enter your password.';errEl.classList.remove('hidden');return;}

  id('kr-label').classList.add('hidden');
  id('kr-arrow').classList.add('hidden');
  id('kr-spin').classList.remove('hidden');

  try{
    const needsSetup=id('kr-needs-setup').value==='1';
    const snap=await db.collection('users').doc(ME.uid).get();
    const data=snap.data();

    let privKey=null;

    if(!needsSetup&&data.wrappedPrivKey){
      // Try to unwrap existing key
      privKey=await Crypto.unwrapKey(data.wrappedPrivKey,pass);
      if(!privKey){
        errEl.textContent='Wrong password. Try again.';
        errEl.classList.remove('hidden');
        return;
      }
    } else {
      // Generate fresh keys (old account or wrappedPrivKey missing)
      const kp=await Crypto.generateKeyPair();
      privKey=kp.privateKeyJwk;
      // Update Firestore with new public key + wrappedPrivKey
      const newWrapped=await Crypto.wrapKey(privKey,pass);
      await db.collection('users').doc(ME.uid).update({
        publicKey:kp.publicKeyJwk,
        wrappedPrivKey:newWrapped
      });
    }

    // Save key locally and activate
    Crypto.saveLocal(ME.uid,privKey);
    ME.privKey=privKey;
    id('key-restore-modal').classList.add('hidden');
    id('kr-pass').value='';

    if(needsSetup){
      toast('✅ Encryption keys set up! New messages will now work.');
    } else {
      toast('🔑 Keys restored! All messages will now decrypt.');
      if(CHAT&&msgUnsub){msgUnsub();msgUnsub=null;listenMsgs();}
    }

  } catch(e){
    console.error('restoreKeys error:',e);
    errEl.textContent='Something went wrong. Try again.';
    errEl.classList.remove('hidden');
  } finally{
    id('kr-label').classList.remove('hidden');
    id('kr-arrow').classList.remove('hidden');
    id('kr-spin').classList.add('hidden');
  }
}

function skipRestore(){
  id('key-restore-modal').classList.add('hidden');
  toast('Messages will show locked until you restore keys from Settings.');
}

function setOnline(v){
  if(!ME)return;
  db.collection('users').doc(ME.uid).update({
    online:v,lastSeen:firebase.firestore.FieldValue.serverTimestamp()
  }).catch(()=>{});
}

function updateMeUI(){
  if(!ME)return;
  // Sidebar avatar
  const av=id('sb-av-circle');
  av.textContent=ME.username[0].toUpperCase();
  av.style.background=ME.color;
  id('sb-av').querySelector('.av-status').classList.remove('hidden');
  // Mobile header mini avatar
  const mobAv=id('mob-av-mini');
  if(mobAv){mobAv.textContent=ME.username[0].toUpperCase();mobAv.style.background=ME.color;}
  // Settings
  id('sp-av-circle').textContent=ME.username[0].toUpperCase();
  id('sp-av-circle').style.background=ME.color;
  id('sp-username').textContent=ME.username;
  id('sp-handle').textContent='@'+ME.username;
}

// ─────────────────────────────────────────────
//  DELETE ACCOUNT
// ─────────────────────────────────────────────
async function deleteAccount(){
  if(!ME)return;
  const confirmed=await zConfirm(
    'Delete account',
    'This permanently deletes your account. Your messages remain (encrypted) in other people\'s chats. This cannot be undone.',
    'Delete forever',true
  );
  if(!confirmed)return;

  try{
    toast('Deleting account…',10000);
    setOnline(false);

    // Remove from all groups
    const groups=await db.collection('groups').where('members','array-contains',ME.uid).get();
    const batch=db.batch();
    groups.docs.forEach(doc=>{
      batch.update(doc.ref,{members:firebase.firestore.FieldValue.arrayRemove(ME.uid)});
    });
    await batch.commit();

    // Delete user Firestore doc
    await db.collection('users').doc(ME.uid).delete();

    // Clear local data
    localStorage.removeItem('zx_pk_'+ME.uid);
    localStorage.removeItem('zx_me_'+ME.uid);
    localStorage.removeItem('zx_font');

    // Delete Firebase Auth account (must be recent login)
    if(msgUnsub){msgUnsub();msgUnsub=null;}
    if(dmListUnsub){dmListUnsub();dmListUnsub=null;}
    if(groupListUnsub){groupListUnsub();groupListUnsub=null;}
    const fbUser=auth.currentUser;
    if(fbUser) await fbUser.delete();

    ME=null;CHAT=null;_booted=false;
    closeAllModals();
    toast('Account deleted.');
    showScreen('auth-screen');
  } catch(err){
    console.error('Delete account error:',err);
    if(err.code==='auth/requires-recent-login'){
      toast('Please sign out and sign back in, then try deleting again.',5000);
    } else {
      toast('Could not delete account: '+err.message,5000);
    }
  }
}

function doSignOut(){
  setTyping(false);
  clearChatWatchers();
  setOnline(false);
  if(msgUnsub){msgUnsub();msgUnsub=null;}
  if(dmListUnsub){dmListUnsub();dmListUnsub=null;}
  if(groupListUnsub){groupListUnsub();groupListUnsub=null;}
  _booted=false;
  _authResolved=true;
  ME=null;CHAT=null;
  closeAllModals();
  auth.signOut();
}

/* ════════════════════════════════════════════════
   SCREENS
════════════════════════════════════════════════ */
function showScreen(name){
  ['auth-screen','app-screen'].forEach(s=>{
    const el=id(s);
    if(s===name){el.classList.remove('hidden');el.style.display='';}
    else el.classList.add('hidden');
  });
}

/* ════════════════════════════════════════════════
   MOBILE SIDEBAR
════════════════════════════════════════════════ */
function toggleMobSidebar(){
  // On mobile the sidebar IS the screen — hamburger opens settings instead
  openSettings();
}
function closeMobSidebar(){
  // no-op — kept for compatibility
}

/* ════════════════════════════════════════════════
   SIDEBAR SEARCH
════════════════════════════════════════════════ */
async function onSbSearch(){
  const q=g('sb-q').toLowerCase();
  const drop=id('sb-search-drop');
  id('sb-clear').classList.toggle('hidden',!q);
  if(!q){drop.classList.add('hidden');return;}
  drop.classList.remove('hidden');
  const chatHits=getSortedConvs().filter(item=>
    item.name.toLowerCase().includes(q)||
    (item.preview||'').toLowerCase().includes(q)
  );
  const chatHtml=chatHits.map(item=>`<div class="sr-item" onclick="${item.type==='dm'
    ?`startDM('${item.otherUid}','${escQ(item.name)}','${item.color}')`
    :`openGroup('${item.id}',CONV_INDEX['${convKey(item.type,item.id)}'].raw)`};clearSbSearch()">
      <div class="av-circle sm" style="background:${item.color}">${item.av}</div>
      <div class="sr-info"><span class="sr-name">${esc(item.type==='dm'?'@'+item.name:item.name)}</span><span class="sr-sub">${esc(item.preview||'Tap to open')}</span></div>
    </div>`).join('');
  if(chatHtml){
    drop.innerHTML=chatHtml;
    return;
  }
  drop.innerHTML='<div class="sr-sl">Searching users…</div>';
  try{
    const snap=await db.collection('users').get();
    const users=snap.docs.map(d=>d.data()).filter(u=>u.uid!==ME.uid&&u.username&&u.username.toLowerCase().includes(q));
    drop.innerHTML=users.length
      ?users.map(u=>`<div class="sr-item" onclick="startDM('${u.uid}','${escQ(u.username)}','${u.color||'#3b82f6'}');clearSbSearch()">
          <div class="av-circle sm" style="background:${u.color||'#3b82f6'}">${u.username[0].toUpperCase()}</div>
          <div class="sr-info"><span class="sr-name">@${esc(u.username)}</span><span class="sr-sub">${u.online?'● Online':'Offline'}</span></div>
        </div>`).join('')
      :'<div class="sr-sl">No chats or users found</div>';
  } catch(err){
    drop.innerHTML=`<div class="sr-sl" style="color:var(--destructive)">Search failed — check Firestore rules</div>`;
    console.error('Search error:',err);
  }
}
function clearSbSearch(){id('sb-q').value='';id('sb-search-drop').classList.add('hidden');id('sb-clear').classList.add('hidden');}

/* ════════════════════════════════════════════════
   DM
════════════════════════════════════════════════ */
function dmDocId(a,b){return[a,b].sort().join('__');}

async function startDM(otherUid,otherUsername,otherColor){
  clearSbSearch();
  await setTyping(false);
  clearChatWatchers();

  const docId=dmDocId(ME.uid,otherUid);
  const color=otherColor||'#3b82f6';

  // ── SHOW UI IMMEDIATELY (no awaits before this) ──
  // Same as openGroup — instant slide on mobile
  CHAT={type:'dm',id:docId,name:otherUsername,color,otherUid,otherPubKey:null};
  showChatPane('@'+otherUsername,color,otherUsername[0].toUpperCase(),'dm');
  restoreDraft();
  watchChatMeta();
  highlightConv(docId);
  listenMsgs();
  updateCallButtons(CHAT);

  // ── Fetch pubKey + ensure DM doc exists in background ──
  try{
    const [udoc, dmSnap] = await Promise.all([
      db.collection('users').doc(otherUid).get(),
      db.collection('dms').doc(docId).get()
    ]);
    const udata=udoc.data();
    // Store pubKey now that we have it
    if(CHAT&&CHAT.id===docId) CHAT.otherPubKey=udata.publicKey;

    if(!dmSnap.exists){
      await db.collection('dms').doc(docId).set({
        members:[ME.uid,otherUid],
        memberNames:{[ME.uid]:ME.username,[otherUid]:otherUsername},
        memberColors:{[ME.uid]:ME.color,[otherUid]:color},
        archived:{[ME.uid]:false,[otherUid]:false},
        lastMsg:'',lastMsgAt:null,lastSenderUid:null,typing:{},
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    watchPresence(otherUid);
  } catch(e){
    console.error('startDM background fetch error:',e);
  }
}

function startDMListener(){
  if(dmListUnsub){dmListUnsub();dmListUnsub=null;}
  dmListUnsub=db.collection('dms').where('members','array-contains',ME.uid)
    .onSnapshot(snap=>{
      resetConvIndex('dm');
      const list=id('sb-chats');
      const arch=id('sb-archived');
      list.innerHTML='';arch.innerHTML='';
      let archCount=0;

      const sorted=snap.docs.slice().sort((a,b)=>{
        const ap=isPinned('dm',a.id)?1:0;
        const bp=isPinned('dm',b.id)?1:0;
        if(ap!==bp) return bp-ap;
        const ta=a.data().lastMsgAt?.seconds||a.data().createdAt?.seconds||0;
        const tb=b.data().lastMsgAt?.seconds||b.data().createdAt?.seconds||0;
        return tb-ta;
      });

      sorted.forEach(doc=>{
        const d=doc.data();
        const other=d.members?.find(x=>x!==ME.uid);
        if(!other)return;
        const name=d.memberNames?.[other]||'?';
        const color=d.memberColors?.[other]||'#3b82f6';
        const isArch=(d.archived?.[ME.uid]===true)||isArchived('dm',doc.id);
        const preview=getPreviewData('dm',doc.id,d,'Tap to open');
        const unread=isMuted('dm',doc.id)?0:getUnreadCount('dm',doc.id,d);
        storeConv('dm',doc.id,{
          name,color,av:name[0].toUpperCase(),otherUid:other,
          preview:preview.text,
          sortAt:(d.lastMsgAt?.seconds||d.createdAt?.seconds||0),
          raw:d
        });
        const el=makeConvEl('dm',doc.id,'@'+name,preview.text,color,name[0].toUpperCase(),()=>startDM(other,name,color),unread,preview.mode);
        if(isArch){arch.appendChild(el);archCount++;}
        else list.appendChild(el);
      });

      if(archCount>0){
        id('sb-archived-section').classList.remove('hidden');
        id('arch-label').textContent=`Archived (${archCount})`;
      } else {
        id('sb-archived-section').classList.add('hidden');
      }
    },err=>console.error('DM listener:',err));
}

function watchPresence(uid){
  if(presenceUnsub){presenceUnsub();presenceUnsub=null;}
  presenceUnsub=db.collection('users').doc(uid).onSnapshot(doc=>{
    const d=doc.data();if(!d)return;
    const badge=id('chat-av-status');
    if(d.online){
      presenceStatusText='Online';
      if(badge)badge.classList.remove('hidden');
    } else {
      const ago=d.lastSeen?.toDate?timeAgo(d.lastSeen.toDate()):'';
      presenceStatusText=ago?`Last seen ${ago}`:'Offline';
      if(badge)badge.classList.add('hidden');
    }
    renderChatHeaderSub();
  });
}

async function archiveCurrent(){
  if(!CHAT)return;
  if(CHAT.type==='dm'){
    const ref=db.collection('dms').doc(CHAT.id);
    const snap=await ref.get();
    const curr=(snap.data()?.archived?.[ME.uid]===true)||isArchived('dm',CHAT.id);
    await ref.update({[`archived.${ME.uid}`]:!curr});
    setChatPrefs('dm',CHAT.id,{archived:!curr});
    toast(curr?'Unarchived!':'Archived!');
  } else {
    const curr=isArchived('group',CHAT.id);
    setChatPrefs('group',CHAT.id,{archived:!curr});
    toast(curr?'Unarchived group.':'Archived group.');
  }
  refreshConversationLists();
  goBack();
}

function closeChatMenu(){id('chat-menu')?.classList.add('hidden');}

function openChatMenu(e){
  if(!CHAT)return;
  e.stopPropagation();
  closeCtx();closeRP();
  id('chat-menu-pin-label').textContent=isPinned(CHAT.type,CHAT.id)?'Unpin chat':'Pin chat';
  id('chat-menu-mute-label').textContent=isMuted(CHAT.type,CHAT.id)?'Unmute chat':'Mute chat';
  id('chat-menu-archive-label').textContent=isArchived(CHAT.type,CHAT.id)?'Unarchive chat':'Archive chat';
  const menu=id('chat-menu');
  menu.classList.remove('hidden');
  menu.style.left=Math.min(e.clientX,window.innerWidth-190)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-180)+'px';
}

function togglePinCurrent(){
  if(!CHAT)return;
  const next=!isPinned(CHAT.type,CHAT.id);
  setChatPrefs(CHAT.type,CHAT.id,{pinned:next});
  refreshConversationLists();
  closeChatMenu();
  toast(next?'Chat pinned.':'Chat unpinned.');
}

function toggleMuteCurrent(){
  if(!CHAT)return;
  const next=!isMuted(CHAT.type,CHAT.id);
  setChatPrefs(CHAT.type,CHAT.id,{muted:next});
  refreshConversationLists();
  closeChatMenu();
  toast(next?'Chat muted.':'Chat unmuted.');
}

function clearCurrentDraft(){
  if(!CHAT)return;
  saveDraftText(CHAT.type,CHAT.id,'');
  const inp=id('msg-inp');
  if(inp) inp.value='';
  refreshConversationLists();
  closeChatMenu();
  toast('Draft cleared.');
}

function openChatSearch(){
  closeChatMenu();
  id('chat-search-strip').classList.remove('hidden');
  setTimeout(()=>id('chat-search-inp')?.focus(),50);
}

function closeChatSearch(){
  const inp=id('chat-search-inp');
  if(inp) inp.value='';
  id('chat-search-strip').classList.add('hidden');
  searchInChat();
}

function searchInChat(){
  const q=(id('chat-search-inp')?.value||'').toLowerCase().trim();
  document.querySelectorAll('#msgs-wrap .msg-row').forEach(row=>{
    const txt=(row.querySelector('.bubble')?.textContent||'').toLowerCase();
    row.style.display=!q||txt.includes(q)?'':'none';
  });
}

function clearSelectionMode(){
  selectionMode=false;
  selectedMsgIds.clear();
  document.querySelectorAll('.msg-row').forEach(r=>r.classList.remove('active-select'));
  updateSelectionBar();
}

function toggleSelection(msgId){
  const row=id('m-'+msgId);
  if(!row)return;
  if(selectedMsgIds.has(msgId)){
    selectedMsgIds.delete(msgId);
    row.classList.remove('active-select');
  } else {
    selectedMsgIds.add(msgId);
    row.classList.add('active-select');
  }
  if(!selectedMsgIds.size) selectionMode=false;
  updateSelectionBar();
}

async function bulkAction(action){
  const ids=[...selectedMsgIds];
  if(!ids.length)return;
  if(action==='star'){
    for(const mid of ids){
      const doc=await msgCol().doc(mid).get();
      const curr=doc.data().starred?.[ME.uid];
      const upd={};upd[`starred.${ME.uid}`]=curr?firebase.firestore.FieldValue.delete():true;
      await msgCol().doc(mid).update(upd);
    }
    toast('Updated stars.');
  } else if(action==='delete'){
    for(const mid of ids){
      const doc=await msgCol().doc(mid).get();
      if(doc.data().senderUid!==ME.uid) continue;
      await msgCol().doc(mid).update({deleted:true,encMsg:'',encKey:'',iv:'',myEncMsg:'',myEncKey:'',myIv:'',keys:{}});
    }
    toast('Deleted your selected messages.');
  } else if(action==='forward'){
    const texts=ids.map(mid=>id('m-'+mid)?.querySelector('.bubble')?.textContent||'').filter(Boolean);
    if(texts.length) openForwardModal(texts.join('\n\n'));
  }
  clearSelectionMode();
}

function toggleArchived(){
  sbArchOpen=!sbArchOpen;
  id('sb-archived').classList.toggle('hidden',!sbArchOpen);
  id('arch-chev').style.transform=sbArchOpen?'rotate(90deg)':'';
}

/* ════════════════════════════════════════════════
   NEW CHAT MODAL
════════════════════════════════════════════════ */
function openNewChat(){
  grpMembers=[];
  ['nc-dm-q','nc-grp-name','nc-grp-q'].forEach(i=>{const el=id(i);if(el)el.value='';});
  id('nc-dm-res').innerHTML='<div class="sr-sl">Type a username to search</div>'; id('nc-grp-res').innerHTML='<div class="sr-sl">Search users to add</div>';
  id('nc-chips').innerHTML='';id('nc-err').textContent='';
  ncTab('dm',document.querySelector('.m-tab'));
  id('nc-modal').classList.remove('hidden');
}
function ncTab(tab,btn){ ['nc-dm-q','nc-grp-name','nc-grp-q'].forEach(i=>{const el=id(i);if(el)el.value='';}); id('nc-dm-res').innerHTML='<div class="sr-sl">Type a username to search</div>'; id('nc-grp-res').innerHTML='<div class="sr-sl">Search users to add</div>';
  document.querySelectorAll('.m-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.nc-pane').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  id('nc-'+tab).classList.add('active');
}
async function searchDM(){
  const q=g('nc-dm-q').toLowerCase();const el=id('nc-dm-res');
  if(!q){el.innerHTML='';return;}
  el.innerHTML='<div class="sr-sl">Searching…</div>';
  try{
    const snap=await db.collection('users').get();
    const users=snap.docs.map(d=>d.data()).filter(u=>u.uid!==ME.uid&&u.username&&u.username.toLowerCase().includes(q));
    el.innerHTML=users.length
      ?users.map(u=>`<div class="sr-item" onclick="startDM('${u.uid}','${escQ(u.username)}','${u.color||'#3b82f6'}');closeModal('nc-modal')">
          <div class="av-circle sm" style="background:${u.color||'#3b82f6'}">${u.username[0].toUpperCase()}</div>
          <div class="sr-info"><span class="sr-name">@${esc(u.username)}</span><span class="sr-sub">${u.online?'● Online':'Offline'}</span></div>
        </div>`).join('')
      :'<div class="sr-sl">No users found</div>';
  } catch(err){el.innerHTML='<div class="sr-sl" style="color:var(--destructive)">Search failed</div>';}
}
async function searchGrp(){
  const q=g('nc-grp-q').toLowerCase();const el=id('nc-grp-res');
  if(!q){el.innerHTML='';return;}
  el.innerHTML='<div class="sr-sl">Searching…</div>';
  try{
    const snap=await db.collection('users').get();
    const users=snap.docs.map(d=>d.data()).filter(u=>u.uid!==ME.uid&&u.username&&u.username.toLowerCase().includes(q)&&!grpMembers.find(m=>m.uid===u.uid));
    el.innerHTML=users.length
      ?users.map(u=>`<div class="sr-item" onclick="addGM('${u.uid}','${escQ(u.username)}','${u.color||'#3b82f6'}')">
          <div class="av-circle sm" style="background:${u.color||'#3b82f6'}">${u.username[0].toUpperCase()}</div>
          <div class="sr-info"><span class="sr-name">@${esc(u.username)}</span></div>
        </div>`).join('')
      :'<div class="sr-sl">No users found</div>';
  } catch(err){el.innerHTML='<div class="sr-sl" style="color:var(--destructive)">Search failed</div>';}
}
function addGM(uid,username,color){
  if(grpMembers.find(m=>m.uid===uid))return;
  grpMembers.push({uid,username,color});
  id('nc-chips').innerHTML=grpMembers.map(m=>`<div class="chip">@${esc(m.username)}<button onclick="removeGM('${m.uid}')">×</button></div>`).join('');
}
function removeGM(uid){grpMembers=grpMembers.filter(m=>m.uid!==uid);addGM._refresh();}
addGM._refresh=()=>{id('nc-chips').innerHTML=grpMembers.map(m=>`<div class="chip">@${esc(m.username)}<button onclick="removeGM('${m.uid}')">×</button></div>`).join('');}

async function createGroup(){
  const name=g('nc-grp-name');const errEl=id('nc-err');
  if(!name){errEl.textContent='Enter a group name.';return;}
  if(!grpMembers.length){errEl.textContent='Add at least one member.';return;}
  const allUids=[ME.uid,...grpMembers.map(m=>m.uid)];
  const pubKeys={},memNames={},memColors={};
  const myDoc=await db.collection('users').doc(ME.uid).get();
  pubKeys[ME.uid]=myDoc.data().publicKey;memNames[ME.uid]=ME.username;memColors[ME.uid]=ME.color;
  for(const m of grpMembers){
    const d=await db.collection('users').doc(m.uid).get();
    pubKeys[m.uid]=d.data().publicKey;memNames[m.uid]=m.username;memColors[m.uid]=m.color;
  }
  await db.collection('groups').add({
    name,members:allUids,memberNames:memNames,memberColors:memColors,
    publicKeys:pubKeys,admins:[ME.uid],createdBy:ME.uid,
    lastMsg:'',lastMsgAt:null,lastSenderUid:null,typing:{},
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  grpMembers=[];closeModal('nc-modal');toast('Group created!');
}

/* ════════════════════════════════════════════════
   GROUPS
════════════════════════════════════════════════ */
function startGroupListener(){
  if(groupListUnsub){groupListUnsub();groupListUnsub=null;}
  groupListUnsub=db.collection('groups').where('members','array-contains',ME.uid)
    .onSnapshot(snap=>{
      resetConvIndex('group');
      const list=id('sb-groups');
      list.innerHTML='';
      if(snap.docs.length){
        const lbl=document.createElement('p');
        lbl.style.cssText='font-size:11px;font-weight:600;color:var(--muted-fg);text-transform:uppercase;letter-spacing:.8px;padding:12px 14px 4px;';
        lbl.textContent='Groups';
        list.appendChild(lbl);
      }
      snap.docs.slice().sort((a,b)=>{
        const ap=isPinned('group',a.id)?1:0;
        const bp=isPinned('group',b.id)?1:0;
        if(ap!==bp) return bp-ap;
        const ta=a.data().lastMsgAt?.seconds||a.data().createdAt?.seconds||0;
        const tb=b.data().lastMsgAt?.seconds||b.data().createdAt?.seconds||0;
        return tb-ta;
      }).forEach(doc=>{
        const d=doc.data();
        const preview=getPreviewData('group',doc.id,d,`${d.members.length} members`);
        const unread=isMuted('group',doc.id)?0:getUnreadCount('group',doc.id,d);
        storeConv('group',doc.id,{
          name:d.name,color:'linear-gradient(135deg,#6366f1,#3b82f6)',av:'#',
          preview:preview.text,
          sortAt:(d.lastMsgAt?.seconds||d.createdAt?.seconds||0),
          raw:d
        });
        const isArch=isArchived('group',doc.id);
        const el=makeConvEl('group',doc.id,d.name,preview.text,
          'linear-gradient(135deg,#6366f1,#3b82f6)','#',()=>openGroup(doc.id,d),unread,preview.mode);
        if(!isArch) list.appendChild(el);
      });
    });
}

function openGroup(gid,data){
  setTyping(false);
  clearChatWatchers();
  closeMobSidebar();
  CHAT={
    type:'group',id:gid,name:data.name,
    members:data.members,memberNames:data.memberNames,
    memberColors:data.memberColors,publicKeys:data.publicKeys,
    admins:data.admins||[data.createdBy]
  };
  const av=id('chat-av-circle');
  av.textContent='#';av.style.background='linear-gradient(135deg,#6366f1,#3b82f6)';
  showChatPane(data.name,null,'#','group');
  restoreDraft();
  presenceStatusText='';
  typingUsers=[];
  renderChatHeaderSub();
  id('chat-av-status').classList.add('hidden');
  id('grp-info-btn').classList.remove('hidden');
  watchChatMeta();
  highlightConv(gid);
  listenMsgs();
  updateCallButtons(CHAT);
}

/* ── Group panel ── */
function openGrpPanel(){
  if(!CHAT||CHAT.type!=='group')return;
  const isAdmin=CHAT.admins?.includes(ME.uid);
  const body=id('gp-body');
  body.innerHTML=`
    <div style="text-align:center;padding:16px 0 20px">
      <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;margin:0 auto 10px">#</div>
      <div style="font-size:18px;font-weight:600">${esc(CHAT.name)}</div>
      <div style="font-size:12px;color:var(--muted-fg);margin-top:2px">${CHAT.members.length} members</div>
    </div>
    ${isAdmin?`<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
      <button class="modal-btn-primary" onclick="renameGrp()" style="justify-content:center">Rename group</button>
      <button onclick="toggleAddMemUI()" style="padding:10px;border-radius:12px;border:1px solid rgba(59,130,246,0.25);color:var(--muted-fg);font-size:13px;transition:background .1s" onmouseover="this.style.background='rgba(59,130,246,.07)'" onmouseout="this.style.background=''">Add members</button>
    </div>
    <div id="add-mem-ui" style="display:none;flex-direction:column;gap:8px;margin-bottom:10px">
      <input id="add-mem-q" class="modal-input" type="text" placeholder="Search username…" oninput="searchAddMem()"/>
      <div id="add-mem-res"></div>
    </div>`:''}
    <p style="font-size:10px;font-weight:600;color:var(--muted-fg);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Members</p>
    <div style="display:flex;flex-direction:column;gap:2px">
      ${CHAT.members.map(uid=>{
        const name=CHAT.memberNames?.[uid]||uid;
        const color=CHAT.memberColors?.[uid]||'#3b82f6';
        const isAdm=CHAT.admins?.includes(uid);
        const canRm=isAdmin&&uid!==ME.uid;
        return`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(59,130,246,.1)">
          <div class="av-circle sm" style="background:${color}">${name[0].toUpperCase()}</div>
          <div style="flex:1;font-size:13px">@${esc(name)} ${isAdm?'<span style="font-size:10px;color:var(--primary);background:rgba(59,130,246,.1);padding:1px 7px;border-radius:10px">admin</span>':''}</div>
          ${canRm?`<div style="display:flex;gap:4px">${!isAdm?`<button onclick="promoteAdmin('${uid}','${escQ(name)}')" style="font-size:11px;color:var(--primary);padding:3px 8px;border:1px solid rgba(59,130,246,.3);border-radius:6px;cursor:pointer" onmouseover="this.style.background='rgba(59,130,246,.07)'" onmouseout="this.style.background=''">Promote</button>`:`<button onclick="demoteAdmin('${uid}','${escQ(name)}')" style="font-size:11px;color:orange;padding:3px 8px;border:1px solid rgba(255,165,0,.3);border-radius:6px;cursor:pointer" onmouseover="this.style.background='rgba(255,165,0,.07)'" onmouseout="this.style.background=''">Demote</button>`}<button onclick="kickMem('${uid}','${escQ(name)}')" style="font-size:11px;color:var(--destructive);padding:3px 8px;border:1px solid rgba(220,50,47,.3);border-radius:6px;cursor:pointer" onmouseover="this.style.background='rgba(220,50,47,.07)'" onmouseout="this.style.background=''">Remove</button></div>`:''}
        </div>`;
      }).join('')}
    </div>
    <button onclick="leaveGrp()" style="margin-top:14px;color:var(--destructive);font-size:13px;padding:12px;border:1px solid rgba(220,50,47,.3);border-radius:12px;width:100%;cursor:pointer;transition:background .1s" onmouseover="this.style.background='rgba(220,50,47,.07)'" onmouseout="this.style.background=''">Leave group</button>
  `;
  id('grp-panel').classList.remove('hidden');
  id('grp-panel').classList.add('open');
  id('gp-bg').classList.remove('hidden');
}
function closeGrpPanel(){id('grp-panel').classList.remove('open');id('gp-bg').classList.add('hidden');}
async function renameGrp(){
  const n=await zPrompt('Rename group','Enter a new name for this group:','Group name',CHAT.name);
  if(!n||n===true)return; // cancelled or empty
  try{
    await db.collection('groups').doc(CHAT.id).update({name:n});
    CHAT.name=n;
    id('chat-hdr-name').textContent=n;
    toast('Renamed!');openGrpPanel();
  }catch(e){toast('Failed to rename.',3000);}
}
function toggleAddMemUI(){const w=id('add-mem-ui');w.style.display=w.style.display==='none'?'flex':w.style.display==='flex'?'none':'flex';}
async function searchAddMem(){
  const q=(id('add-mem-q')?.value||'').toLowerCase().trim();const el=id('add-mem-res');if(!el)return;
  if(!q){el.innerHTML='';return;}
  const snap=await db.collection('users').get();
  const users=snap.docs.map(d=>d.data()).filter(u=>!CHAT.members.includes(u.uid)&&u.username&&u.username.toLowerCase().includes(q));
  el.innerHTML=users.length?users.map(u=>`<div class="sr-item" onclick="addToGrp('${u.uid}','${escQ(u.username)}','${u.color||'#3b82f6'}')">
    <div class="av-circle sm" style="background:${u.color||'#3b82f6'}">${u.username[0].toUpperCase()}</div>
    <span style="font-size:13px">@${esc(u.username)}</span></div>`).join(''):'<div class="sr-sl">No users found</div>';
}
async function addToGrp(uid,username,color){
  const d=await db.collection('users').doc(uid).get();
  await db.collection('groups').doc(CHAT.id).update({
    members:firebase.firestore.FieldValue.arrayUnion(uid),
    [`memberNames.${uid}`]:username,[`memberColors.${uid}`]:color,[`publicKeys.${uid}`]:d.data().publicKey
  });
  toast(`@${username} added!`);openGrpPanel();
}
async function kickMem(uid,name){
  const ok=await zConfirm('Remove member',`Remove @${name} from the group?`,'Remove',true);
  if(!ok)return;
  try{
    await db.collection('groups').doc(CHAT.id).update({members:firebase.firestore.FieldValue.arrayRemove(uid)});
    // Update local CHAT state so panel re-renders correctly
    CHAT.members=CHAT.members.filter(m=>m!==uid);
    toast(`@${name} removed.`);
    openGrpPanel();
  }catch(e){toast('Failed to remove member.',3000);}
}
async function promoteAdmin(uid,name){
  const ok=await zConfirm('Promote to admin',`Make @${name} an admin?`,'Promote');
  if(!ok)return;
  try{
    await db.collection('groups').doc(CHAT.id).update({admins:firebase.firestore.FieldValue.arrayUnion(uid)});
    if(CHAT.admins&&!CHAT.admins.includes(uid))CHAT.admins=[...CHAT.admins,uid];
    toast(`@${name} is now an admin.`);openGrpPanel();
  }catch(e){toast('Failed to promote.',3000);}
}
async function demoteAdmin(uid,name){
  const ok=await zConfirm('Remove admin role',`Remove admin privileges from @${name}?`,'Demote',true);
  if(!ok)return;
  try{
    await db.collection('groups').doc(CHAT.id).update({admins:firebase.firestore.FieldValue.arrayRemove(uid)});
    if(CHAT.admins)CHAT.admins=CHAT.admins.filter(a=>a!==uid);
    toast(`@${name} is no longer an admin.`);openGrpPanel();
  }catch(e){toast('Failed to demote.',3000);}
}
async function leaveGrp(){
  const ok=await zConfirm('Leave group','Are you sure you want to leave this group?','Leave',true);
  if(!ok)return;
  try{
    await db.collection('groups').doc(CHAT.id).update({members:firebase.firestore.FieldValue.arrayRemove(ME.uid)});
    closeGrpPanel();goBack();toast('Left group.');
  }catch(e){toast('Failed to leave group.',3000);}
}

/* ════════════════════════════════════════════════
   MESSAGES
════════════════════════════════════════════════ */
function listenMsgs(){
  if(msgUnsub){msgUnsub();msgUnsub=null;}
  if(!CHAT)return;
  const sessionId=++chatSessionId;
  const chatCtx=getChatContext(CHAT);
  id('msgs-wrap').innerHTML='';
  const col=msgCol();
  msgUnsub=col.orderBy('sentAt').onSnapshot(snap=>{
    if(sessionId!==chatSessionId||!CHAT||CHAT.id!==chatCtx.id||CHAT.type!==chatCtx.type)return;
    const area=id('msgs-wrap');
    area.innerHTML='';
    snap.docs.forEach(doc=>renderMsg(doc.id,doc.data(),chatCtx));
    if(CHAT)markChatSeen(CHAT.type,CHAT.id);
    scrollBottom();
  },err=>console.error('Msg listener:',err));
}

async function renderMsg(msgId,data,chatCtx=getChatContext()){
  const area=id('msgs-wrap');
  const mine=data.senderUid===ME.uid;

  // Date separator
  if(data.sentAt?.toDate){
    const ds=fmtDate(data.sentAt.toDate());
    const ld=area.querySelector('.date-sep:last-of-type');
    if(!ld||ld.dataset.d!==ds){
      const div=document.createElement('div');
      div.className='date-sep';div.dataset.d=ds;
      div.innerHTML=`<span>${ds}</span>`;
      area.appendChild(div);
    }
  }

  const row=document.createElement('div');
  row.className=`msg-row ${mine?'mine':'theirs'}`;row.id='m-'+msgId;
  row.dataset.msgId=msgId;
  row.dataset.sentAt=data.sentAt?.toMillis?data.sentAt.toMillis():((data.sentAt?.seconds||0)*1000);

  // Group sender name
  if(!mine&&chatCtx?.type==='group'){
    const sn=document.createElement('div');sn.className='msg-sender';
    const sc=chatCtx.memberColors?.[data.senderUid]||'#3b82f6';
    sn.innerHTML=`<span style="color:${sc}">@${esc(chatCtx.memberNames?.[data.senderUid]||'?')}</span>`;
    row.appendChild(sn);
  }

  // Reply preview
  if(data.replyTo){
    const rp=document.createElement('div');rp.className='msg-reply-preview';
    rp.innerHTML=`<span class="mrp-name">@${esc(data.replyTo.senderName)}</span><span class="mrp-txt">${esc(data.replyTo.text)}</span>`;
    rp.onclick=()=>id('m-'+data.replyTo.msgId)?.scrollIntoView({behavior:'smooth',block:'center'});
    row.appendChild(rp);
  }

  // Bubble
  const bub=document.createElement('div');
  bub.className='bubble'+(data.deleted?' deleted':'');
  if(data.deleted){
    bub.textContent='🚫 This message was deleted';
  } else {
    bub.textContent='…';
    decryptBubble(bub,data,mine,chatCtx);
  }
  bub.addEventListener('contextmenu',e=>{e.preventDefault();if(selectionMode){toggleSelection(msgId);return;}showCtx(e,msgId,mine,!!data.deleted);});
  bub.addEventListener('click',e=>{e.stopPropagation();if(selectionMode){toggleSelection(msgId);return;}if(!data.deleted)showCtx(e,msgId,mine,false);});
  if(data.forwarded){
    const fw=document.createElement('div');
    fw.className='msg-sender';
    fw.textContent='Forwarded';
    row.appendChild(fw);
  }
  row.appendChild(bub);

  // Footer
  const foot=document.createElement('div');foot.className='msg-foot';
  const tm=document.createElement('span');tm.className='msg-time';
  tm.textContent=data.sentAt?.toDate?fmtTime(data.sentAt.toDate()):'…';
  foot.appendChild(tm);
  if(data.edited){const ed=document.createElement('span');ed.className='msg-time';ed.textContent='edited';foot.appendChild(ed);}
  if(data.starred?.[ME.uid]){const st=document.createElement('span');st.className='msg-time';st.textContent='★';foot.appendChild(st);}
  if(mine){
    const tk=document.createElement('span');tk.className='msg-ticks';
    if(chatCtx?.type==='dm'){
      const otherRead=Number(chatCtx.lastRead?.[chatCtx.otherUid]||0);
      const sentAt=data.sentAt?.toMillis?data.sentAt.toMillis():((data.sentAt?.seconds||0)*1000);
      tk.textContent=otherRead&&sentAt&&otherRead>=sentAt?'✓✓ Seen':'✓✓';
    } else {
      tk.textContent='✓✓';
    }
    foot.appendChild(tk);
  }
  row.appendChild(foot);

  // Reactions
  const rea=document.createElement('div');rea.className='msg-reactions';rea.id='rea-'+msgId;
  renderReactions(rea,data.reactions||{});
  row.appendChild(rea);

  area.appendChild(row);
  if(!mine&&document.hidden)sendNotif(data);
}

async function decryptBubble(bub,data,mine,chatCtx=getChatContext()){
  try{
    if(!ME.privKey){bub.textContent='🔒 Sign out and back in to restore keys.';return;}
    let plain;
    if(chatCtx?.type==='dm'){
      const encKey=mine?data.myEncKey:data.encKey;
      const encMsg=mine?data.myEncMsg:data.encMsg;
      const iv=mine?data.myIv:data.iv;
      if(!encKey||!encMsg){bub.textContent='🔒 Encrypted';return;}
      plain=await Crypto.decryptMsg(encMsg,encKey,iv,ME.privKey);
    } else {
      const myKey=data.keys?.[ME.uid];
      if(!myKey){bub.textContent='🔒 Not encrypted for you';return;}
      plain=await Crypto.decryptMsg(data.encMsg,myKey,data.iv,ME.privKey);
    }
    // Detect file message payload
    try{
      const parsed=JSON.parse(plain);
      if(parsed&&parsed.__type==='file'){
        const sz=parsed.size>1024*1024?(parsed.size/1024/1024).toFixed(1)+'MB':(Math.round(parsed.size/1024))+'KB';
        const card=document.createElement('div');
        card.className='file-bubble';
        card.style.cssText='cursor:pointer;display:flex;align-items:center;gap:10px;padding:4px 0';
        // Store metadata as data attributes (avoids quote escaping in onclick)
        card.dataset.url=parsed.url||'';
        card.dataset.name=parsed.name||'file';
        card.dataset.key=parsed.key||'';
        card.dataset.iv=parsed.iv||'';
        // Store inline base64 data for new-format files
        if(parsed.data) card.dataset.inlinedata=parsed.data;
        card.onclick=function(){
          downloadFileMsg(
            this.dataset.url||null,
            this.dataset.name,
            this.dataset.key,
            this.dataset.iv,
            this.dataset.inlinedata||null
          );
        };
        const fileLabel=parsed.data?'Encrypted · Tap to decrypt':'Tap to download';
        card.innerHTML=`<div style="width:38px;height:38px;border-radius:10px;background:rgba(59,130,246,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${esc(parsed.name||'file')}</div>
            <div style="font-size:11px;color:var(--muted-fg)">${sz} · ${fileLabel}</div>
          </div>`;
        bub.appendChild(card);
        return;
      }
    }catch(_){}
    bub.textContent=plain;
  } catch(e){bub.textContent='🔒 Decryption failed';}
}

function updateMsgEl(msgId,data){
  const row=id('m-'+msgId);if(!row)return;
  row.dataset.sentAt=data.sentAt?.toMillis?data.sentAt.toMillis():((data.sentAt?.seconds||0)*1000);
  const rea=id('rea-'+msgId);if(rea)renderReactions(rea,data.reactions||{});
  const bub=row.querySelector('.bubble');
  const foot=row.querySelector('.msg-foot');
  if(bub&&data.deleted&&!bub.classList.contains('deleted')){
    bub.textContent='🚫 This message was deleted';bub.classList.add('deleted');
  }
  if(bub&&!data.deleted) decryptBubble(bub,data,data.senderUid===ME.uid,getChatContext());
  if(foot){
    foot.querySelectorAll('.msg-time.extra-meta').forEach(el=>el.remove());
    if(data.edited){
      const ed=document.createElement('span');ed.className='msg-time extra-meta';ed.textContent='edited';foot.insertBefore(ed,foot.querySelector('.msg-ticks'));
    }
    if(data.starred?.[ME.uid]){
      const st=document.createElement('span');st.className='msg-time extra-meta';st.textContent='★';foot.insertBefore(st,foot.querySelector('.msg-ticks'));
    }
    const tk=foot.querySelector('.msg-ticks');
    if(tk&&CHAT?.type==='dm'){
      const otherRead=Number(CHAT.lastRead?.[CHAT.otherUid]||0);
      const sentAt=data.sentAt?.toMillis?data.sentAt.toMillis():((data.sentAt?.seconds||0)*1000);
      tk.textContent=otherRead&&sentAt&&otherRead>=sentAt?'✓✓ Seen':'✓✓';
    }
  }
}

function renderReactions(el,reactions){
  el.innerHTML='';
  for(const[key,users]of Object.entries(reactions)){
    if(typeof users!=='object')continue;
    const count=Object.keys(users).length;if(!count)continue;
    const emoji=K2E[key]||key;const isMine=!!users[ME.uid];
    const pill=document.createElement('div');
    pill.className='r-pill'+(isMine?' mine-r':'');
    pill.innerHTML=`${emoji}<span class="r-count">${count}</span>`;
    pill.onclick=e=>{e.stopPropagation();toggleReaction(el.id.replace('rea-',''),key);};
    el.appendChild(pill);
  }
}

/* ════════════════════════════════════════════════
   SEND
════════════════════════════════════════════════ */
function onMsgKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}}

async function sendMsg(){
  const inp=id('msg-inp');const text=inp.value.trim();
  if(!text||!CHAT||!ME)return;
  if(!ME.privKey&&CHAT.type==='dm'){toast('Encryption keys not loaded. Please re-login.',3500);return;}
  inp.value='';
  saveDraftText(CHAT.type,CHAT.id,'');
  setTyping(false);
  const rp=replyTo?{...replyTo}:null;
  cancelReply();
  try{
    CHAT.type==='dm'?await sendDMMsg(text,rp):await sendGrpMsg(text,rp);
  } catch(e){console.error('Send error:',e);toast('Send failed: '+e.message,4000);}
}

async function sendDMMsg(text,rp){
  // Guard: otherPubKey might still be loading (background fetch in startDM)
  if(!CHAT.otherPubKey){
    // Try fetching it now
    try{
      const udoc=await db.collection('users').doc(CHAT.otherUid).get();
      CHAT.otherPubKey=udoc.data().publicKey;
    } catch(e){
      toast('Could not load encryption key. Try again.',3000);return;
    }
  }
  // Use cached ME.publicKey — no Firestore round-trip on every send
  const myPub=ME.publicKey;
  if(!myPub){toast('Your public key is missing. Please re-login.',3000);return;}

  const[their,mine]=await Promise.all([
    Crypto.encryptMsg(text,CHAT.otherPubKey),
    Crypto.encryptMsg(text,myPub)
  ]);
  const ref=db.collection('dms').doc(CHAT.id);
  await ref.set({
    members:[ME.uid,CHAT.otherUid],
    memberNames:{[ME.uid]:ME.username,[CHAT.otherUid]:CHAT.name},
    memberColors:{[ME.uid]:ME.color,[CHAT.otherUid]:CHAT.color||'#3b82f6'},
    archived:{[ME.uid]:false,[CHAT.otherUid]:false},
    lastMsg:text.substring(0,60),
    lastMsgAt:firebase.firestore.FieldValue.serverTimestamp(),
    lastSenderUid:ME.uid,
    [`typing.${ME.uid}`]:firebase.firestore.FieldValue.delete()
  },{merge:true});
  const msg={
    senderUid:ME.uid,type:'text',
    encMsg:their.encMsg,encKey:their.encKey,iv:their.iv,
    myEncMsg:mine.encMsg,myEncKey:mine.encKey,myIv:mine.iv,
    reactions:{},deleted:false,
    sentAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  if(rp)msg.replyTo=rp;
  await ref.collection('messages').add(msg);
}

async function sendGrpMsg(text,rp){
  const enc=await Crypto.encryptForGroup(text,CHAT.publicKeys);
  await db.collection('groups').doc(CHAT.id).update({
    lastMsg:text.substring(0,60),
    lastMsgAt:firebase.firestore.FieldValue.serverTimestamp(),
    lastSenderUid:ME.uid,
    [`typing.${ME.uid}`]:firebase.firestore.FieldValue.delete()
  });
  const msg={
    senderUid:ME.uid,type:'text',
    encMsg:enc.encMsg,keys:enc.keys,iv:enc.iv,
    reactions:{},deleted:false,
    sentAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  if(rp)msg.replyTo=rp;
  await db.collection('groups').doc(CHAT.id).collection('messages').add(msg);
}

/* ════════════════════════════════════════════════
   REPLY
════════════════════════════════════════════════ */
function setReply(msgId,senderName,text){
  replyTo={msgId,senderName,text};
  id('reply-strip').classList.remove('hidden');
  id('rs-who').textContent='@'+senderName;
  id('rs-txt').textContent=text;
  id('msg-inp').focus();
}
function cancelReply(){replyTo=null;id('reply-strip').classList.add('hidden');}

/* ════════════════════════════════════════════════
   CONTEXT MENU
════════════════════════════════════════════════ */
function showCtx(e,msgId,mine,deleted){
  ctxMsgId=msgId;ctxMine=mine;
  id('ctx-del').style.display=mine&&!deleted?'':'none';
  id('ctx-edit-wrap').style.display=mine&&!deleted?'':'none';
  const ctx=id('ctx');ctx.classList.remove('hidden');
  ctx.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';
  ctx.style.top=Math.min(e.clientY,window.innerHeight-145)+'px';
  updateCtxLabels(msgId);
}
function closeCtx(){id('ctx').classList.add('hidden');}

async function updateCtxLabels(msgId){
  try{
    const doc=await msgCol().doc(msgId).get();
    const data=doc.data()||{};
    id('ctx-star-label').textContent=data.starred?.[ME.uid]?'Unstar':'Star';
    id('ctx-copy-label').textContent='Copy';
  }catch(e){}
}

async function copyCurrentMessage(){
  const text=id('m-'+ctxMsgId)?.querySelector('.bubble')?.textContent||'';
  if(!text)return;
  try{
    await navigator.clipboard.writeText(text);
    toast('Message copied.');
  }catch(e){
    toast('Copy failed in this browser.',3000);
  }
}

async function editCurrentMessage(){
  const bub=id('m-'+ctxMsgId)?.querySelector('.bubble');
  if(!bub||bub.classList.contains('deleted'))return;
  const next=await zPrompt('Edit message','Update your message text:','Message',bub.textContent);
  if(!next||next===true)return;
  if(CHAT.type==='dm'){
    const myPub=ME.publicKey;
    const [their,mine]=await Promise.all([
      Crypto.encryptMsg(next,CHAT.otherPubKey),
      Crypto.encryptMsg(next,myPub)
    ]);
    await msgCol().doc(ctxMsgId).update({
      encMsg:their.encMsg,encKey:their.encKey,iv:their.iv,
      myEncMsg:mine.encMsg,myEncKey:mine.encKey,myIv:mine.iv,
      edited:true,editedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    const enc=await Crypto.encryptForGroup(next,CHAT.publicKeys);
    await msgCol().doc(ctxMsgId).update({
      encMsg:enc.encMsg,keys:enc.keys,iv:enc.iv,
      edited:true,editedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  toast('Message updated.');
}

async function toggleStarCurrent(){
  const doc=await msgCol().doc(ctxMsgId).get();
  const curr=doc.data().starred?.[ME.uid];
  const upd={};
  upd[`starred.${ME.uid}`]=curr?firebase.firestore.FieldValue.delete():true;
  await msgCol().doc(ctxMsgId).update(upd);
  toast(curr?'Removed star.':'Starred message.');
}

function openForwardModal(text){
  forwardPayload=text;
  id('fwd-q').value='';
  id('fwd-preview').innerHTML=`<strong>Forwarding</strong>${esc(text)}`;
  renderForwardTargets();
  id('forward-modal').classList.remove('hidden');
}

function renderForwardTargets(){
  const q=(id('fwd-q')?.value||'').toLowerCase().trim();
  const items=getSortedConvs().filter(item=>!q||item.name.toLowerCase().includes(q)||(item.preview||'').toLowerCase().includes(q));
  id('fwd-res').innerHTML=items.length?items.map(item=>`<div class="sr-item" onclick="forwardToTarget('${item.type}','${item.id}')">
    <div class="av-circle sm" style="background:${item.color}">${item.av}</div>
    <div class="sr-info"><span class="sr-name">${esc(item.type==='dm'?'@'+item.name:item.name)}</span><span class="sr-sub">${esc(item.preview||'Tap to open')}</span></div>
  </div>`).join(''):'<div class="sr-sl">No chats found</div>';
}

async function forwardToTarget(type,id){
  if(!forwardPayload)return;
  const target=CONV_INDEX[convKey(type,id)];
  if(!target)return;
  try{
    if(type==='dm'){
      const docId=id;
      let dmData=target.raw;
      if(!dmData){
        const snap=await db.collection('dms').doc(docId).get();
        dmData=snap.data();
      }
      let otherPub=target.raw?.publicKey;
      if(!otherPub){
        const udoc=await db.collection('users').doc(target.otherUid).get();
        otherPub=udoc.data().publicKey;
      }
      const [their,mine]=await Promise.all([
        Crypto.encryptMsg(forwardPayload,otherPub),
        Crypto.encryptMsg(forwardPayload,ME.publicKey)
      ]);
      await db.collection('dms').doc(docId).set({
        members:[ME.uid,target.otherUid],
        memberNames:{[ME.uid]:ME.username,[target.otherUid]:target.name},
        memberColors:{[ME.uid]:ME.color,[target.otherUid]:target.color},
        archived:{[ME.uid]:false,[target.otherUid]:false},
        lastMsg:forwardPayload.substring(0,60),lastMsgAt:firebase.firestore.FieldValue.serverTimestamp(),
        lastSenderUid:ME.uid,typing:{},
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      await db.collection('dms').doc(docId).collection('messages').add({
        senderUid:ME.uid,type:'text',forwarded:true,
        encMsg:their.encMsg,encKey:their.encKey,iv:their.iv,
        myEncMsg:mine.encMsg,myEncKey:mine.encKey,myIv:mine.iv,
        reactions:{},deleted:false,
        sentAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const gsnap=await db.collection('groups').doc(id).get();
      const gdata=gsnap.data();
      const enc=await Crypto.encryptForGroup(forwardPayload,gdata.publicKeys);
      await db.collection('groups').doc(id).update({
        lastMsg:forwardPayload.substring(0,60),
        lastMsgAt:firebase.firestore.FieldValue.serverTimestamp(),
        lastSenderUid:ME.uid
      });
      await db.collection('groups').doc(id).collection('messages').add({
        senderUid:ME.uid,type:'text',forwarded:true,
        encMsg:enc.encMsg,keys:enc.keys,iv:enc.iv,
        reactions:{},deleted:false,
        sentAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    closeModal('forward-modal');
    toast('Message forwarded.');
  }catch(e){
    console.error('forward error',e);
    toast('Forward failed.',3000);
  }
}

async function loadStarredMessages(){
  const list=id('starred-list');
  if(!list||!ME)return;
  list.innerHTML='<div class="sr-sl">Loading…</div>';
  const items=[];
  try{
    const dms=await db.collection('dms').where('members','array-contains',ME.uid).get();
    for(const dm of dms.docs){
      const meta=dm.data();
      const msgs=await dm.ref.collection('messages').where(`starred.${ME.uid}`,'==',true).get();
      msgs.forEach(doc=>items.push({chat:`@${meta.memberNames?.[meta.members.find(x=>x!==ME.uid)]||'DM'}`,data:doc.data()}));
    }
    const groups=await db.collection('groups').where('members','array-contains',ME.uid).get();
    for(const grp of groups.docs){
      const meta=grp.data();
      const msgs=await grp.ref.collection('messages').where(`starred.${ME.uid}`,'==',true).get();
      msgs.forEach(doc=>items.push({chat:meta.name||'Group',data:doc.data()}));
    }
    items.sort((a,b)=>(b.data.sentAt?.seconds||0)-(a.data.sentAt?.seconds||0));
    if(!items.length){
      list.innerHTML='<div class="sr-sl">No starred messages yet</div>';
      return;
    }
    list.innerHTML=items.map(item=>`<div class="starred-item glass-panel">
      <div class="starred-head"><span class="starred-name">${esc(item.chat)}</span><span class="msg-time">${item.data.sentAt?.toDate?fmtDate(item.data.sentAt.toDate()):''}</span></div>
      <div class="starred-text">${esc('Encrypted message')}</div>
    </div>`).join('');
  } catch(e){
    console.error('load starred error',e);
    list.innerHTML='<div class="sr-sl" style="color:var(--destructive)">Could not load starred messages</div>';
  }
}

async function ctxDo(action){
  closeCtx();
  if(action==='reply'){
    const bub=id('m-'+ctxMsgId)?.querySelector('.bubble');
    if(!bub||bub.classList.contains('deleted'))return;
    const col=msgCol();const doc=await col.doc(ctxMsgId).get();const data=doc.data();
    const who=data.senderUid===ME.uid?ME.username:(CHAT.memberNames?.[data.senderUid]||CHAT.name);
    setReply(ctxMsgId,who,bub.textContent);
  } else if(action==='react'){
    const rowRect=id('m-'+ctxMsgId)?.getBoundingClientRect()||{left:100,top:200};
    const pick=id('react-pick');
    pick.style.left=Math.min(rowRect.left,window.innerWidth-250)+'px';
    pick.style.top=Math.max(rowRect.top-58,8)+'px';
    setTimeout(()=>pick.classList.remove('hidden'),0);
  } else if(action==='delete'){
    if(!ctxMine)return;
    await msgCol().doc(ctxMsgId).update({deleted:true,encMsg:'',encKey:'',iv:'',myEncMsg:'',myEncKey:'',myIv:'',keys:{}});
  } else if(action==='copy'){
    await copyCurrentMessage();
  } else if(action==='edit'){
    if(!ctxMine)return;
    await editCurrentMessage();
  } else if(action==='star'){
    await toggleStarCurrent();
  } else if(action==='forward'){
    const text=id('m-'+ctxMsgId)?.querySelector('.bubble')?.textContent||'';
    if(text) openForwardModal(text);
  } else if(action==='select'){
    selectionMode=true;
    toggleSelection(ctxMsgId);
  }
}

/* ════════════════════════════════════════════════
   REACTIONS
════════════════════════════════════════════════ */
function closeRP(){id('react-pick').classList.add('hidden');}
function doReact(emoji,e){
  e.stopPropagation();closeRP();
  if(!ctxMsgId)return;
  toggleReaction(ctxMsgId,E2K[emoji]||emoji);
}
async function toggleReaction(msgId,key){
  try{
    const col=msgCol();const doc=await col.doc(msgId).get();
    const curr=doc.data().reactions?.[key]||{};
    const upd={};upd[`reactions.${key}.${ME.uid}`]=curr[ME.uid]?firebase.firestore.FieldValue.delete():true;
    await col.doc(msgId).update(upd);
  } catch(e){console.error('Reaction error:',e);toast('Reaction failed');}
}
function msgCol(){
  return CHAT.type==='dm'
    ?db.collection('dms').doc(CHAT.id).collection('messages')
    :db.collection('groups').doc(CHAT.id).collection('messages');
}

/* ════════════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════════════ */
async function reqNotif(){
  if(!('Notification' in window)){toast('Not supported in this browser.');return;}
  if(Notification.permission==='granted'){toast('Notifications already enabled!');return;}
  const r=await Notification.requestPermission();
  updateNotifUI();
  toast(r==='granted'?'Notifications enabled 🔔':'Permission denied.');
}
function updateNotifUI(){
  const tok=id('notif-tog');const sub=id('notif-sub');if(!tok)return;
  const ok=Notification.permission==='granted';
  tok.classList.toggle('on',ok);
  if(sub)sub.textContent=ok?'Enabled':Notification.permission==='denied'?'Blocked by browser':'Tap to enable';
}
function sendNotif(data){
  if(Notification.permission!=='granted')return;
  if(CHAT&&isMuted(CHAT.type,CHAT.id))return;
  const who=CHAT.memberNames?.[data.senderUid]||CHAT.name||'Someone';
  new Notification('Zynix · @'+who,{
    body:'🔒 New encrypted message',
    icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%233b82f6"/><text x="16" y="22" text-anchor="middle" font-size="18" fill="white">Z</text></svg>',
    tag:'zx'
  });
}

/* ════════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════════ */
function buildSettings(){
  const acctHTML=`
    <button class="settings-row-btn" onclick="openSettingsView('notif')">
      ${settingsIcon('bell')}<span style="flex:1;font-size:14px">Notifications</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <button class="settings-row-btn" onclick="openSettingsView('privacy')">
      ${settingsIcon('lock')}<span style="flex:1;font-size:14px">Privacy &amp; Security</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <button class="settings-row-btn" style="cursor:default;opacity:.5" disabled>
      ${settingsIcon('user')}<span style="flex:1;font-size:14px">Profile</span>
    </button>`;

  const appHTML=`
    <button id="install-app-btn" class="settings-row-btn hidden" onclick="installApp()">
      ${settingsIcon('download')}<div style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span id="install-app-label" style="font-size:14px">Install App</span>
        <span id="install-app-sub" style="font-size:12px;color:var(--muted-fg)">Open Zyntrixly in its own window.</span>
      </div>
    </button>
    <button class="settings-row-btn" onclick="openSettingsView('starred')">
      ${settingsIcon('star')}<span style="flex:1;font-size:14px">Starred Messages</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <button class="settings-row-btn" onclick="openSettingsView('appearance')">
      ${settingsIcon('palette')}<span style="flex:1;font-size:14px">Appearance</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <button class="settings-row-btn" onclick="openSettingsView('about')">
      ${settingsIcon('info')}<span style="flex:1;font-size:14px">About</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;

  const acctEl=id('sv-main-acct'); if(acctEl) acctEl.innerHTML=acctHTML;
  const appEl=id('sv-main-app');   if(appEl)  appEl.innerHTML=appHTML;
  buildFontOptions();
  updateInstallUI();
}

function settingsIcon(name){
  const icons={
    user:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M3 21v-1a9 9 0 0 1 18 0v1"/></svg>',
    bell:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
    lock:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    database:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    download:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    star:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.1 8.3 22 9.3 17 14.2 18.2 21 12 17.7 5.8 21 7 14.2 2 9.3 8.9 8.3 12 2"/></svg>',
    palette:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    help:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>',
    info:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  return `<span style="color:var(--muted-fg)">${icons[name]||''}</span>`;
}

function buildFontOptions(){
  const el=id('font-options');if(!el)return;
  const opts=[
    {id:'modern',label:'Clean Modern',desc:'Default, balanced typography'},
    {id:'futuristic',label:'Futuristic',desc:'Tech-inspired, monospace feel'},
    {id:'rounded',label:'Rounded',desc:'Friendly, approachable style'},
  ];
  el.innerHTML=opts.map(o=>`
    <button class="font-opt ${fontStyle===o.id?'sel':''} font-${o.id}" onclick="applyFont('${o.id}')">
      <div class="fo-top">
        <span class="fo-label">${o.label}</span>
        ${fontStyle===o.id?'<div class="fo-check"></div>':''}
      </div>
      <span class="fo-desc">${o.desc}</span>
    </button>`).join('');
  // Update preview
  const prev=id('font-preview');
  if(prev){prev.classList.remove('font-modern','font-futuristic','font-rounded');prev.classList.add('font-'+fontStyle);}
}

function openSettings(){
  updateMeUI();updateNotifUI();buildSettings();
  openSettingsView('main');
  const m=id('settings-modal');
  if(!m){console.error('settings-modal not found');return;}
  m.classList.remove('hidden');
  // Prevent backdrop tap from closing settings — notification permission dialog
  // fires a synthetic click event that can land on the backdrop.
  // Instead, only the X button closes settings.
  m._openedAt=Date.now();
}
function closeSettings(){
  id('settings-modal').classList.add('hidden');
  settingsView='main';
}

function openSettingsView(view){
  settingsView=view;
  ['main','appearance','about','notif','privacy','starred'].forEach(v=>{
    id('sv-'+v)?.classList.toggle('hidden',v!==view);
  });
  id('settings-title').textContent={
    main:'Settings',appearance:'Appearance',about:'About',notif:'Notifications',privacy:'Privacy & Security',starred:'Starred Messages'
  }[view]||'Settings';
  if(view==='appearance')buildFontOptions();
  if(view==='starred')loadStarredMessages();
}
function settingsBack(){openSettingsView('main');}

/* ════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════ */
function showChatPane(name,color,avChar,type){
  // Hide empty state, show chat
  id('empty-pane').style.display='none';
  id('chat-pane').classList.remove('hidden');

  // Desktop chat header
  id('chat-hdr-name').textContent=name;
  id('grp-info-btn').classList.add('hidden');
  id('chat-hdr-sub').textContent='end-to-end encrypted';
  id('chat-av-status').classList.add('hidden');

  if(color){
    const av=id('chat-av-circle');
    if(av){ av.textContent=avChar||name[0].toUpperCase(); av.style.background=color; }
  }

  // Mobile top bar: switch to chat mode
  const mobTitle=id('mob-title');
  if(mobTitle){
    mobTitle.innerHTML=''; // clear spans
    const span=document.createElement('span');
    span.textContent=name;
    span.style.cssText='font-size:16px;font-weight:600;color:var(--foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;display:block';
    mobTitle.appendChild(span);
  }
  updateMobileChatActions(CHAT);

  // Mobile: slide chat panel in (WhatsApp style)
  const layout=id('app-layout');
  if(layout) layout.classList.add('mob-chat-open');

  // Update mobile header: show back button + chat name, hide list buttons
  document.querySelectorAll('.mob-list-only').forEach(el=>el.style.display='none');
  document.querySelectorAll('.mob-back-only').forEach(el=>el.style.display='flex');
}

function goBack(){
  saveDraftText(CHAT?.type,CHAT?.id,id('msg-inp')?.value||'');
  setTyping(false);
  clearChatWatchers();
  closeChatSearch();
  clearSelectionMode();
  closeChatMenu();
  id('chat-pane').classList.add('hidden');
  id('empty-pane').style.display='';
  document.querySelectorAll('.conv-item').forEach(r=>r.classList.remove('active'));
  if(msgUnsub){msgUnsub();msgUnsub=null;}
  chatSessionId++;
  CHAT=null;

  // Mobile: slide back to list
  const layout=id('app-layout');
  if(layout) layout.classList.remove('mob-chat-open');

  // Restore mobile header to list mode
  const mobTitle=id('mob-title');
  if(mobTitle) mobTitle.innerHTML='<img src="zyntrixly-logo.png" alt="Zynix" class="brand-lockup-img"/><span class="brand-gradient">Zynix</span>';
  document.querySelectorAll('.mob-list-only').forEach(el=>el.style.display='flex');
  document.querySelectorAll('.mob-back-only').forEach(el=>el.style.display='none');
  updateMobileChatActions(null);
}

function makeConvEl(type,docId,name,sub,color,av,onclickFn,unread=0,previewMode='default'){
  const el=document.createElement('button'); // button fires click reliably on iOS
  el.className='conv-item';el.id='conv-'+docId;el.type='button';
  const previewClass=previewMode==='draft'?'ci-preview draft-preview':previewMode==='typing'?'ci-preview typing-preview':'ci-preview';
  const pin=isPinned(type,docId)?'<span class="ci-pin">📌</span>':'';
  el.innerHTML=`
    <div class="av-circle" style="background:${color};width:40px;height:40px;font-size:15px;flex-shrink:0">${esc(av)}</div>
    <div class="ci-info">
      <div class="ci-top"><span class="ci-name">${esc(name)}</span>${pin}</div>
      <div class="ci-bot">
        <div class="ci-meta">
          <span class="${previewClass}">${esc(sub)}</span>
          <span class="ci-unread ${unread?'':'hidden'}">${unread||''}</span>
        </div>
      </div>
    </div>`;
  el.addEventListener('click', onclickFn);
  return el;
}

function highlightConv(docId){
  document.querySelectorAll('.conv-item').forEach(r=>r.classList.remove('active'));
  id('conv-'+docId)?.classList.add('active');
}

function scrollBottom(){const el=id('msgs-wrap');el.scrollTop=el.scrollHeight;}
function fmtTime(d){return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDate(d){
  const t=new Date(),y=new Date(t);y.setDate(t.getDate()-1);
  if(d.toDateString()===t.toDateString())return'Today';
  if(d.toDateString()===y.toDateString())return'Yesterday';
  return d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
}
function timeAgo(d){
  const s=Math.floor((Date.now()-d)/1000);
  if(s<60)return'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  return fmtDate(d);
}

function closeModal(mid){id(mid).classList.add('hidden');}
function modalBgClick(e,mid){
  if(e.target===e.currentTarget) closeModal(mid);
}
function closeAllModals(){
  ['nc-modal','forward-modal'].forEach(m=>id(m).classList.add('hidden'));
  // Don't force-close settings — only its X button should close it
  // to prevent notification permission dialog synthetic clicks closing it
  closeChatMenu();
  closeCtx();
  closeRP();
  closeGrpPanel();
}

/* ════════════════════════════════════════════════
   CUSTOM CONFIRM / PROMPT (replaces browser confirm/prompt
   which are blocked on mobile WebViews and iOS PWA)
════════════════════════════════════════════════ */
let _confirmResolve=null;

function zConfirm(title,msg,okLabel='Confirm',danger=false){
  return new Promise(res=>{
    _confirmResolve=res;
    id('confirm-title').textContent=title;
    id('confirm-msg').textContent=msg;
    id('confirm-inp').style.display='none';
    id('confirm-inp').value='';
    const btn=id('confirm-ok-btn');
    btn.textContent=okLabel;
    btn.style.background=danger?'var(--destructive)':'var(--primary)';
    id('confirm-modal').classList.remove('hidden');
    setTimeout(()=>id('confirm-ok-btn').focus(),100);
  });
}

function zPrompt(title,msg,placeholder='',defaultVal=''){
  return new Promise(res=>{
    _confirmResolve=res;
    id('confirm-title').textContent=title;
    id('confirm-msg').textContent=msg;
    const inp=id('confirm-inp');
    inp.style.display='';
    inp.placeholder=placeholder;
    inp.value=defaultVal;
    id('confirm-ok-btn').textContent='OK';
    id('confirm-ok-btn').style.background='var(--primary)';
    id('confirm-modal').classList.remove('hidden');
    setTimeout(()=>inp.focus(),100);
  });
}

function confirmOk(){
  const inp=id('confirm-inp');
  const val=inp.style.display==='none'?true:inp.value.trim();
  id('confirm-modal').classList.add('hidden');
  if(_confirmResolve){_confirmResolve(val);_confirmResolve=null;}
}

function confirmCancel(){
  id('confirm-modal').classList.add('hidden');
  if(_confirmResolve){_confirmResolve(false);_confirmResolve=null;}
}

// Allow Enter key in prompt input
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!id('confirm-modal').classList.contains('hidden'))confirmOk();
});

/* ════════════════════════════════════════════════
   FULLSCREEN (iOS Safari does not support this API)
════════════════════════════════════════════════ */
function toggleFullscreen(){
  // iOS Safari has no Fullscreen API — show a tip instead
  if(_iosDevice){
    toast('On iPhone/iPad, install from Share → Add to Home Screen for fullscreen.',4000);
    return;
  }
  if(!document.fullscreenElement&&!document.webkitFullscreenElement){
    const el=document.documentElement;
    const fn=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen;
    if(fn) fn.call(el).catch(()=>toast('Fullscreen not available in this browser.'));
    else toast('Fullscreen not supported here.',2500);
  } else {
    const fn=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen;
    if(fn) fn.call(document).catch(()=>{});
  }
}
document.addEventListener('fullscreenchange',updateFsIcon);
document.addEventListener('webkitfullscreenchange',updateFsIcon);
function updateFsIcon(){
  const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
  const expandSvg=`<path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"/>`;
  const compressSvg=`<path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/>`;
  ['fs-icon-sb','fs-icon-mob'].forEach(iconId=>{
    const el=id(iconId);
    if(el) el.innerHTML=isFs?compressSvg:expandSvg;
  });
}

// App loaded — attach auth listener now that Firebase is confirmed ready
_attachAuthListener();

window.startChatCall = function(mode) {
  if (CHAT && CHAT.type === 'dm') {
    ZxCall.startCall(CHAT.uid || CHAT.otherUid, mode);
  }
};
