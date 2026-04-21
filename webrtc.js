// ════════════════════════════════════════════════
//  ZYNTRIXLY — webrtc.js
//  Voice / Video / Screen Share / Group Calls
//  Signalling via Firestore  (collection: calls/)
//  Lazy-loaded — does NOT run until first call.
// ════════════════════════════════════════════════

const ZxCall = (() => {
  // ── ICE servers (STUN public + optional TURN) ──
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // ── State ──
  let callId       = null;
  let callRole     = null;   // 'caller' | 'callee'
  let callMode     = null;   // 'voice' | 'video' | 'screen'
  let localStream  = null;
  let screenStream = null;
  let peers        = {};     // uid → RTCPeerConnection
  let remoteStreams = {};     // uid → MediaStream
  let sigUnsubs    = [];     // firestore unsubscribes
  let callDoc      = null;   // firestore doc reference
  let ringtoneTimer = null;
  let callTimer    = null;
  let callSeconds  = 0;

  // ── UI refs ──
  const ui = () => ({
    overlay:     document.getElementById('call-overlay'),
    status:      document.getElementById('call-status'),
    timer:       document.getElementById('call-timer'),
    localVid:    document.getElementById('call-local-video'),
    remoteGrid:  document.getElementById('call-remote-grid'),
    muteBtn:     document.getElementById('call-mute-btn'),
    videoBtn:    document.getElementById('call-video-btn'),
    screenBtn:   document.getElementById('call-screen-btn'),
    endBtn:      document.getElementById('call-end-btn'),
    incomingBox: document.getElementById('call-incoming'),
    incomingWho: document.getElementById('call-incoming-who'),
    screenIndicator: document.getElementById('screen-share-indicator'),
  });

  // ── Helpers ──
  function log(...a) { /* intentionally silent in production */ }

  // Safe accessor for ME — avoids crashes if called before app.js sets ME
  function getMe() { return window.ME || null; }

  function safeClose(pc) {
    try { pc.close(); } catch(_) {}
  }

  function setStatus(text) {
    const el = ui().status;
    if (el) el.textContent = text;
  }

  function showOverlay(mode) {
    const o = ui().overlay;
    if (!o) return;
    o.classList.remove('hidden');
    o.dataset.mode = mode;
    const vBtn = ui().videoBtn;
    const sBtn = ui().screenBtn;
    if (vBtn) vBtn.classList.toggle('active', mode === 'video');
    if (sBtn) sBtn.classList.remove('active');
  }

  function hideOverlay() {
    const o = ui().overlay;
    if (o) o.classList.add('hidden');
    hideIncoming();
  }

  function showIncoming(callerName, mode) {
    const box = ui().incomingBox;
    const who = ui().incomingWho;
    if (!box) return;
    if (who) who.textContent = `${callerName} is calling (${mode})…`;
    box.classList.remove('hidden');
  }

  function hideIncoming() {
    const box = ui().incomingBox;
    if (box) box.classList.add('hidden');
  }

  function startCallTimer() {
    callSeconds = 0;
    clearInterval(callTimer);
    callTimer = setInterval(() => {
      callSeconds++;
      const m = String(Math.floor(callSeconds / 60)).padStart(2,'0');
      const s = String(callSeconds % 60).padStart(2,'0');
      const el = ui().timer;
      if (el) el.textContent = `${m}:${s}`;
    }, 1000);
  }

  // ── Media ──
  async function getLocalStream(mode) {
    const constraints = mode === 'voice'
      ? { audio: true, video: false }
      : { audio: true, video: { width: 640, height: 480, facingMode: 'user' } };
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch(e) {
      if (e.name === 'NotAllowedError') throw new Error('Camera/microphone permission denied.');
      if (e.name === 'NotFoundError')   throw new Error('No camera or microphone found.');
      throw e;
    }
  }

  function attachLocalVideo(stream) {
    const vid = ui().localVid;
    if (!vid) return;
    vid.srcObject = stream;
    vid.muted = true;
    vid.classList.toggle('hidden', callMode === 'voice');
  }

  function attachRemoteVideo(uid, stream) {
    remoteStreams[uid] = stream;
    const grid = ui().remoteGrid;
    if (!grid) return;
    let vidEl = document.getElementById('rv-' + uid);
    if (!vidEl) {
      vidEl = document.createElement('video');
      vidEl.id = 'rv-' + uid;
      vidEl.autoplay = true;
      vidEl.playsInline = true;
      vidEl.className = 'remote-video';
      grid.appendChild(vidEl);
    }
    vidEl.srcObject = stream;
  }

  function removeRemoteVideo(uid) {
    const el = document.getElementById('rv-' + uid);
    if (el) el.remove();
    delete remoteStreams[uid];
  }

  // ── PeerConnection ──
  function createPC(remoteUid) {
    if (peers[remoteUid]) safeClose(peers[remoteUid]);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers[remoteUid] = pc;

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }

    // Remote stream assembly
    const remote = new MediaStream();
    pc.ontrack = e => {
      e.streams[0]?.getTracks().forEach(t => remote.addTrack(t));
      attachRemoteVideo(remoteUid, remote);
    };

    // ICE → write to Firestore
    pc.onicecandidate = e => {
      if (!e.candidate || !callDoc) return;
      callDoc.collection('ice_' + getMe()?.uid + '_to_' + remoteUid)
        .add({ candidate: JSON.stringify(e.candidate), ts: Date.now() })
        .catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('Connected');
        startCallTimer();
      } else if (['failed','disconnected'].includes(pc.connectionState)) {
        setStatus('Connection lost…');
      }
    };

    return pc;
  }

  // ── Listen for remote ICE candidates ──
  function listenICE(remoteUid) {
    if (!callDoc || !ME) return;
    const colName = 'ice_' + remoteUid + '_to_' + getMe()?.uid;
    const unsub = callDoc.collection(colName).orderBy('ts')
      .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const pc = peers[remoteUid];
          if (!pc) return;
          try {
            const cand = JSON.parse(change.doc.data().candidate);
            pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          } catch(_) {}
        });
      });
    sigUnsubs.push(unsub);
  }

  // ── Initiate call (1-to-1 or start group) ──
  async function startCall(targetUid, mode = 'voice') {
    if (!targetUid) { toast('No contact selected for call.'); return; }
    if (callId) { toast('Already in a call.'); return; }
    if (typeof db === 'undefined' || !db) { toast('App not ready. Try again.'); return; }
    if (!getMe()?.uid) { toast('Not logged in.'); return; }
    callMode = mode;
    callRole = 'caller';

    try {
      localStream = await getLocalStream(mode);
    } catch(e) {
      toast(e.message, 4000);
      return;
    }

    // Create Firestore call doc
    const ref = db.collection('calls').doc();
    callId  = ref.id;
    callDoc = ref;

    const callerName = getMe()?.username;
    await ref.set({
      callId,
      callerId:   getMe()?.uid,
      callerName,
      calleeId:   targetUid,
      mode,
      status:     'ringing',
      createdAt:  firebase.firestore.FieldValue.serverTimestamp()
    });

    showOverlay(mode);
    setStatus('Ringing…');
    attachLocalVideo(localStream);

    // Build PC and create offer
    const pc = createPC(targetUid);
    listenICE(targetUid);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await ref.collection('offers').doc(targetUid).set({ sdp: JSON.stringify(offer), from: getMe()?.uid });

    // Watch for answer
    const ansUnsub = ref.collection('answers').doc(getMe()?.uid)
      .onSnapshot(async snap => {
        const d = snap.data();
        if (!d?.sdp) return;
        const pc2 = peers[targetUid];
        if (!pc2 || pc2.signalingState !== 'have-local-offer') return;
        await pc2.setRemoteDescription(JSON.parse(d.sdp));
      });
    sigUnsubs.push(ansUnsub);

    // Watch call status changes (callee accepted/rejected)
    const statusUnsub = ref.onSnapshot(snap => {
      const s = snap.data()?.status;
      if (s === 'rejected') { toast('Call rejected.'); endCall(); }
      if (s === 'ended')    { endCall(); }
    });
    sigUnsubs.push(statusUnsub);
  }

  // ── Receive incoming call notification ──
  function listenForIncomingCalls() {
    const ME = getMe();
    if (!ME || !ME.uid) { console.warn('[ZxCall] ME not ready, retrying...'); setTimeout(listenForIncomingCalls, 500); return; }
    if (typeof db === 'undefined' || !db) return;
    db.collection('calls')
      .where('calleeId', '==', getMe()?.uid)
      .where('status', '==', 'ringing')
      .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const d = change.doc.data();
            if (callId) {
              // Already in a call — auto-reject
              change.doc.ref.update({ status: 'rejected' });
              return;
            }
            showIncoming(d.callerName, d.mode);
            // Store pending call info for accept/reject
            window._pendingCall = { id: change.doc.id, doc: change.doc.ref, data: d };
          }
        });
      });
  }

  // ── Accept incoming call ──
  async function acceptCall() {
    const ME = getMe();
    if (!ME) return;
    const pending = window._pendingCall;
    if (!pending) return;
    window._pendingCall = null;
    hideIncoming();

    callId   = pending.id;
    callDoc  = pending.doc;
    callMode = pending.data.mode;
    callRole = 'callee';
    const callerUid = pending.data.callerId;

    try {
      localStream = await getLocalStream(callMode);
    } catch(e) {
      toast(e.message, 4000);
      await callDoc.update({ status: 'rejected' });
      return;
    }

    showOverlay(callMode);
    setStatus('Connecting…');
    attachLocalVideo(localStream);

    const pc = createPC(callerUid);
    listenICE(callerUid);

    // Get offer
    const offerSnap = await callDoc.collection('offers').doc(getMe()?.uid).get();
    if (!offerSnap.exists) { toast('Call offer expired.'); endCall(); return; }

    const offer = JSON.parse(offerSnap.data().sdp);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await callDoc.collection('answers').doc(callerUid).set({ sdp: JSON.stringify(answer), from: getMe()?.uid });
    await callDoc.update({ status: 'accepted' });

    // Watch for call end
    const statusUnsub = callDoc.onSnapshot(snap => {
      if (snap.data()?.status === 'ended') endCall();
    });
    sigUnsubs.push(statusUnsub);
  }

  // ── Reject incoming call ──
  async function rejectCall() {
    const pending = window._pendingCall;
    if (!pending) return;
    window._pendingCall = null;
    hideIncoming();
    await pending.doc.update({ status: 'rejected' }).catch(() => {});
  }

  // ── End / clean up ──
  async function endCall() {
    if (!callId) return; // already ended
    // Notify remote
    const docToEnd = callDoc;
    callId = null; // prevent re-entry
    if (docToEnd) {
      await docToEnd.update({ status: 'ended' }).catch(() => {});
    }

    // Stop all tracks
    localStream?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    localStream  = null;
    screenStream = null;

    // Close all peer connections
    Object.values(peers).forEach(safeClose);
    peers = {};
    remoteStreams = {};

    // Unsubscribe Firestore listeners
    sigUnsubs.forEach(u => { try { u(); } catch(_) {} });
    sigUnsubs = [];

    callRole = null;
    callMode = null;
    callDoc  = null;

    clearInterval(callTimer);
    callTimer   = null;
    callSeconds = 0;

    // Clean up UI
    hideOverlay();
    const grid = ui().remoteGrid;
    if (grid) grid.innerHTML = '';
    const timer = ui().timer;
    if (timer) timer.textContent = '00:00';

    // Hide screen indicator
    const ind = ui().screenIndicator;
    if (ind) ind.classList.add('hidden');
  }

  // ── Toggle mute ──
  function toggleMute() {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const btn = ui().muteBtn;
    if (btn) btn.classList.toggle('active', !track.enabled);
    toast(track.enabled ? 'Unmuted 🎤' : 'Muted 🔇', 1500);
  }

  // ── Toggle video ──
  function toggleVideo() {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const btn = ui().videoBtn;
    if (btn) btn.classList.toggle('active', !track.enabled);
  }

  // ── Start screen share ──
  async function startScreenShare() {
    if (!callId) { toast('Start a call first.'); return; }
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      for (const pc of Object.values(peers)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
      }

      // Show screen in local preview
      const vid = ui().localVid;
      if (vid) { vid.srcObject = screenStream; vid.classList.remove('hidden'); }

      // Indicator
      const ind = ui().screenIndicator;
      if (ind) ind.classList.remove('hidden');

      // Auto-stop when user clicks "Stop sharing" in browser UI
      screenTrack.onended = () => stopScreenShare();

      const btn = ui().screenBtn;
      if (btn) btn.classList.add('active');
    } catch(e) {
      if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
        toast('Screen share failed: ' + e.message, 3000);
      }
    }
  }

  // ── Stop screen share, restore camera ──
  async function stopScreenShare() {
    if (!screenStream) return;
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;

    // Restore camera track
    const camTrack = localStream?.getVideoTracks()[0];
    if (camTrack) {
      for (const pc of Object.values(peers)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack).catch(() => {});
      }
    }

    attachLocalVideo(localStream);
    const ind = ui().screenIndicator;
    if (ind) ind.classList.add('hidden');
    const btn = ui().screenBtn;
    if (btn) btn.classList.remove('active');
  }

  // ── Toggle screen share ──
  async function toggleScreenShare() {
    if (screenStream) await stopScreenShare();
    else await startScreenShare();
  }

  // ── Switch camera (mobile) ──
  async function switchCamera() {
    if (!localStream || callMode === 'voice') return;
    const current = localStream.getVideoTracks()[0];
    const currentFacing = current?.getSettings()?.facingMode || 'user';
    const newFacing = currentFacing === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false
      });
      const newTrack = newStream.getVideoTracks()[0];
      // Replace in all PCs
      for (const pc of Object.values(peers)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack).catch(() => {});
      }
      // Replace in localStream
      current?.stop();
      localStream.removeTrack(current);
      localStream.addTrack(newTrack);
      attachLocalVideo(localStream);
    } catch(e) {
      toast('Could not switch camera.', 2500);
    }
  }

  // ── Group call: join existing call room ──
  async function joinGroupCall(gCallId, mode = 'voice') {
    if (callId) { toast('Already in a call.'); return; }
    callMode = mode;
    callRole = 'callee';
    callId   = gCallId;
    callDoc  = db.collection('calls').doc(gCallId);

    try {
      localStream = await getLocalStream(mode);
    } catch(e) {
      toast(e.message, 4000);
      return;
    }

    showOverlay(mode);
    setStatus('Joining…');
    attachLocalVideo(localStream);

    // Get list of participants already in call
    const snap = await callDoc.get();
    const participants = snap.data()?.participants || [];
    for (const uid of participants) {
      if (uid === getMe()?.uid) continue;
      const pc = createPC(uid);
      listenICE(uid);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await callDoc.collection('offers').doc(uid).set({ sdp: JSON.stringify(offer), from: getMe()?.uid });
    }

    // Register self as participant
    await callDoc.update({
      participants: firebase.firestore.FieldValue.arrayUnion(getMe()?.uid)
    }).catch(() => {});

    // Watch for new participants
    const joinUnsub = callDoc.onSnapshot(async snap => {
      const newParts = snap.data()?.participants || [];
      for (const uid of newParts) {
        if (uid === getMe()?.uid || peers[uid]) continue;
        const pc = createPC(uid);
        listenICE(uid);
        // Wait for their offer
        const offerSnap = await callDoc.collection('offers').doc(getMe()?.uid).get().catch(() => null);
        if (offerSnap?.exists) {
          const offer = JSON.parse(offerSnap.data().sdp);
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await callDoc.collection('answers').doc(uid).set({ sdp: JSON.stringify(answer), from: getMe()?.uid });
        }
      }
    });
    sigUnsubs.push(joinUnsub);
  }

  // ── Public API ──
  async function startGroupCall(gid, mode='voice'){
    if(callId){toast('Already in a call.');return;}
    if(typeof db==='undefined'||!db){toast('App not ready.');return;}
    // Create/reset the group call doc
    const ref = db.collection('calls').doc('grp_'+gid);
    await ref.set({
      callId:'grp_'+gid, callerId:getMe()?.uid, callerName:getMe()?.username,
      mode, status:'active', participants:[getMe()?.uid],
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
    await joinGroupCall('grp_'+gid, mode);
  }

  return {
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    switchCamera,
    startGroupCall,
    joinGroupCall,
    listenForIncomingCalls,
    isInCall: () => !!callId,
    currentMode: () => callMode
  };
})();
