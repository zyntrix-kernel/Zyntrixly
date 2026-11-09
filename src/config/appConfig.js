// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/config/appConfig.js
//  Centralized Runtime & Environment Configuration
// ════════════════════════════════════════════════

const ZxConfig = (() => {
  const DEFAULT_CONFIG = {
    version: '2.0.0',
    appName: 'Zyntrixly',
    codename: 'Zyntrixly Evolution',
    // WebRTC STUN/TURN configuration
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    // Cryptographic defaults
    crypto: {
      rsaModulusLength: 2048,
      pbkdf2Iterations: 200000,
      aesKeyLength: 256,
      hashAlgorithm: 'SHA-256'
    },
    // Storage & file transfer limits
    limits: {
      maxFileSizeInlineBytes: 900 * 1024, // 900 KB for direct inline encrypted payloads
      maxFileSizeStorageBytes: 50 * 1024 * 1024, // 50 MB for storage objects
      maxVoiceNoteDurationSeconds: 300,
      maxGroupNameLength: 50,
      maxPinnedMessages: 5
    },
    // Privacy and notification defaults
    privacy: {
      genericPushNotifications: true,
      presenceThrottlingSeconds: 60,
      callRingtoneTimeoutSeconds: 30
    }
  };

  let activeConfig = { ...DEFAULT_CONFIG };

  function init(overrides = {}) {
    activeConfig = {
      ...DEFAULT_CONFIG,
      ...overrides,
      crypto: { ...DEFAULT_CONFIG.crypto, ...(overrides.crypto || {}) },
      limits: { ...DEFAULT_CONFIG.limits, ...(overrides.limits || {}) },
      privacy: { ...DEFAULT_CONFIG.privacy, ...(overrides.privacy || {}) }
    };
  }

  function get() {
    return activeConfig;
  }

  return { init, get, DEFAULT_CONFIG };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxConfig;
}
if (typeof window !== 'undefined') {
  window.ZxConfig = ZxConfig;
}
