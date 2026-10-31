const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Create mock DOM element factory
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

// Mock audio / video tracks
class MockMediaStreamTrack {
  constructor(kind) {
    this.kind = kind;
    this.enabled = true;
    this.stopped = false;
    this.onended = null;
  }
  stop() {
    this.stopped = true;
  }
}

class MockMediaStream {
  constructor(hasVideo = true) {
    this.tracks = [new MockMediaStreamTrack('audio')];
    if (hasVideo) this.tracks.push(new MockMediaStreamTrack('video'));
  }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(t) { this.tracks.push(t); }
  removeTrack(t) { this.tracks = this.tracks.filter(x => x !== t); }
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDesc = null;
    this.remoteDesc = null;
    this.closed = false;
    this.senders = [
      { track: new MockMediaStreamTrack('video'), replaceTrack: async (t) => { this.track = t; } }
    ];
  }
  getSenders() { return this.senders; }
  addTrack(t, s) {}
  async createOffer() { return { type: 'offer', sdp: 'mock-offer-sdp' }; }
  async createAnswer() { return { type: 'answer', sdp: 'mock-answer-sdp' }; }
  async setLocalDescription(d) { this.localDesc = d; }
  async setRemoteDescription(d) { this.remoteDesc = d; }
  async addIceCandidate(c) {}
  close() { this.closed = true; }
}

// Polyfill globals for webrtc.js
global.document = {
  getElementById: (id) => mockElements[id] || null,
  createElement: (tag) => createMockElement(tag)
};
global.window = globalThis;
global.window.ME = { uid: 'user_alice_123', username: 'alice' };
global.ME = global.window.ME;
global.window.toast = (msg) => {};

Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: async (constraints) => new MockMediaStream(!!constraints.video),
      getDisplayMedia: async () => new MockMediaStream(true)
    }
  },
  configurable: true,
  writable: true
});

global.MediaStream = MockMediaStream;
global.RTCPeerConnection = MockRTCPeerConnection;
global.RTCIceCandidate = class { constructor(c) { Object.assign(this, c); } };

// Mock Firestore db
const mockCallDoc = {
  id: 'call_doc_12345',
  set: async () => {},
  update: async () => {},
  get: async () => ({ exists: true, data: () => ({ callerId: 'user_bob_456', callerName: 'bob', mode: 'voice' }) }),
  onSnapshot: () => () => {},
  collection: () => ({
    doc: () => ({
      set: async () => {},
      get: async () => ({ exists: false }),
      onSnapshot: () => () => {}
    }),
    orderBy: () => ({
      onSnapshot: () => () => {}
    }),
    onSnapshot: () => () => {},
    add: async () => {}
  })
};

global.db = {
  collection: (name) => ({
    doc: (id) => mockCallDoc
  })
};
global.firebase = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => Date.now()
    }
  }
};

// Load webrtc.js module
const webrtcSource = fs.readFileSync('webrtc.js', 'utf8');
const loadWebRTC = new Function(webrtcSource + '; return ZxCall;');
const ZxCall = loadWebRTC();

// Clean up call state after each test to ensure complete isolation
test.afterEach(async () => {
  if (ZxCall.isInCall()) {
    await ZxCall.endCall();
  }
});

test('RTC-01: Call State Machine Initial State', () => {
  assert.strictEqual(ZxCall.isInCall(), false, 'Initially not in call');
  assert.strictEqual(ZxCall.currentMode(), null, 'Initial mode is null');
});

test('RTC-02: Voice Call Initiation Transitions to In-Call Mode', async () => {
  // Act: Start voice call to bob
  await ZxCall.startCall('user_bob_456', 'voice');

  // Assert
  assert.strictEqual(ZxCall.isInCall(), true, 'In call should be true');
  assert.strictEqual(ZxCall.currentMode(), 'voice', 'Mode should be voice');
  assert.strictEqual(mockElements['call-overlay'].dataset.mode, 'voice');
  assert.ok(!mockElements['call-overlay'].classList.contains('hidden'), 'Overlay must not be hidden');
});

test('RTC-03: Track Muting Inverts Audio Track State', async () => {
  // Arrange: Ensure active call with local stream
  if (!ZxCall.isInCall()) {
    await ZxCall.startCall('user_bob_456', 'voice');
  }

  // Act: Toggle mute
  ZxCall.toggleMute();
  assert.ok(mockElements['call-mute-btn'].classList.contains('active'), 'Mute button marked active');

  // Act again: Unmute
  ZxCall.toggleMute();
  assert.ok(!mockElements['call-mute-btn'].classList.contains('active'), 'Mute button unmarked');
});

test('RTC-04: Video Call Initiation and Camera Track Toggling', async () => {
  // Arrange: Start video call
  await ZxCall.startCall('user_bob_456', 'video');
  assert.strictEqual(ZxCall.isInCall(), true);
  assert.strictEqual(ZxCall.currentMode(), 'video');

  // Act: Toggle video off
  ZxCall.toggleVideo();
  assert.ok(mockElements['call-video-btn'].classList.contains('active'), 'Video button indicates camera muted');

  // Act: Toggle video back on
  ZxCall.toggleVideo();
  assert.ok(!mockElements['call-video-btn'].classList.contains('active'), 'Video button active status cleared');
});

test('RTC-05: Screen Sharing and Call Termination Cleans Up Streams', async () => {
  // Arrange: Ensure active call
  if (!ZxCall.isInCall()) {
    await ZxCall.startCall('user_bob_456', 'video');
  }

  // Act: Toggle screen share
  await ZxCall.toggleScreenShare();
  assert.ok(mockElements['call-screen-btn'].classList.contains('active'), 'Screen share active');
  assert.ok(!mockElements['screen-share-indicator'].classList.contains('hidden'), 'Indicator displayed');

  // Act: Hangup
  await ZxCall.endCall();

  // Assert
  assert.strictEqual(ZxCall.isInCall(), false, 'isInCall reset to false');
  assert.strictEqual(ZxCall.currentMode(), null, 'callMode reset to null');
  assert.ok(mockElements['call-overlay'].classList.contains('hidden'), 'Overlay hidden on hangup');
});
