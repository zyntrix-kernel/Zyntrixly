const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Mock DOM elements
function createMockElement(id) {
  const classList = new Set(['hidden']);
  return {
    id,
    dataset: {},
    textContent: '',
    srcObject: null,
    style: {},
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        } else if (force) {
          classList.add(c);
        } else {
          classList.delete(c);
        }
      },
      contains: (c) => classList.has(c)
    }
  };
}

const mockElements = {
  'call-overlay': createMockElement('call-overlay'),
  'call-status': createMockElement('call-status'),
  'call-timer': createMockElement('call-timer'),
  'call-local-video': createMockElement('call-local-video'),
  'call-remote-grid': createMockElement('call-remote-grid'),
  'call-mute-btn': createMockElement('call-mute-btn'),
  'call-video-btn': createMockElement('call-video-btn'),
  'call-screen-btn': createMockElement('call-screen-btn'),
  'call-end-btn': createMockElement('call-end-btn'),
  'call-incoming': createMockElement('call-incoming'),
  'call-incoming-who': createMockElement('call-incoming-who'),
  'screen-share-indicator': createMockElement('screen-share-indicator')
};

global.document = {
  getElementById: (id) => mockElements[id] || null,
  createElement: (tag) => createMockElement(tag)
};
global.window = globalThis;

let toastedMessages = [];
global.window.toast = (msg) => toastedMessages.push(msg);

// Mock navigator & MediaStream
class MockMediaStreamTrack {
  constructor(kind) { this.kind = kind; this.enabled = true; }
  stop() {}
}
class MockMediaStream {
  constructor() { this.tracks = [new MockMediaStreamTrack('audio'), new MockMediaStreamTrack('video')]; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
}
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: async () => new MockMediaStream(),
      getDisplayMedia: async () => new MockMediaStream()
    }
  },
  configurable: true,
  writable: true
});

global.MediaStream = MockMediaStream;
global.RTCPeerConnection = class {
  constructor() {
    this.senders = [{ track: new MockMediaStreamTrack('video'), replaceTrack: async () => {} }];
  }
  getSenders() { return this.senders; }
  addTrack() {}
  async createOffer() { return { type: 'offer', sdp: 'mock-sdp' }; }
  async createAnswer() { return { type: 'answer', sdp: 'mock-sdp' }; }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
  close() {}
};
global.RTCIceCandidate = class { constructor(c) { Object.assign(this, c); } };

// Mock Firestore call doc
const mockCallDoc = {
  id: 'call_live_123',
  set: async () => {},
  update: async () => {},
  get: async () => ({ exists: true, data: () => ({ callerId: 'test123_uid', callerName: 'test123', mode: 'voice' }) }),
  onSnapshot: () => () => {},
  collection: () => ({
    doc: () => ({ set: async () => {}, get: async () => ({ exists: false }), onSnapshot: () => () => {} }),
    orderBy: () => ({ onSnapshot: () => () => {} }),
    onSnapshot: () => () => {},
    add: async () => {}
  })
};

global.db = {
  collection: () => ({ doc: () => mockCallDoc })
};
global.firebase = {
  firestore: { FieldValue: { serverTimestamp: () => Date.now() } }
};

// Load webrtc.js
const webrtcSource = fs.readFileSync('webrtc.js', 'utf8');
const loadWebRTC = new Function(webrtcSource + '; return ZxCall;');
const ZxCall = loadWebRTC();

test('CALL-01: Verifies "Not logged in." toast is NOT shown after setting window.ME for test123', async () => {
  toastedMessages = [];

  // Simulate user 'test123' logged in
  window.ME = {
    uid: 'uid_test123_abc',
    username: 'test123',
    color: '#27272a',
    publicKey: { kty: 'RSA' }
  };

  // Call a random offline user
  const randomOfflineUid = 'random_user_xyz_999';
  await ZxCall.startCall(randomOfflineUid, 'voice');

  // Assert: "Not logged in." is NEVER toasted
  assert.ok(
    !toastedMessages.includes('Not logged in.'),
    'Should NOT toast "Not logged in."'
  );

  // Assert: Call state is active and ringing
  assert.strictEqual(ZxCall.isInCall(), true, 'Caller is in call');
  assert.strictEqual(ZxCall.currentMode(), 'voice', 'Call mode is voice');
  assert.strictEqual(mockElements['call-status'].textContent, 'Ringing…');
  assert.ok(!mockElements['call-overlay'].classList.contains('hidden'), 'Call overlay is visible');

  // Hangup
  await ZxCall.endCall();
  assert.strictEqual(ZxCall.isInCall(), false, 'Cleanly hung up');
});

test('CALL-02: Verifies unauthenticated call triggers "Not logged in." toast if window.ME is null', async () => {
  toastedMessages = [];

  // Explicitly clear auth
  window.ME = null;

  await ZxCall.startCall('someone_uid', 'voice');

  assert.ok(
    toastedMessages.includes('Not logged in.'),
    'Must toast "Not logged in." when unauthenticated'
  );
  assert.strictEqual(ZxCall.isInCall(), false);
});
