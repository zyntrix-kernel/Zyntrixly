const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// List of 146 required baseline DOM element IDs
const REQUIRED_DOM_IDS = [
  // 1. Canvas & Startup
  'zyntrix-canvas', 'startup', 'startup-fade',
  // 2. Authentication
  'auth-screen', 'auth-title', 'auth-subtitle', 'auth-form', 'f-user', 'f-pass', 'f-confirm-wrap', 'f-confirm', 'auth-err', 'auth-submit', 'auth-btn-label', 'auth-btn-arrow', 'auth-spinner', 'auth-toggle-label',
  // 3. Key Restore Modal
  'key-restore-modal', 'kr-title', 'kr-desc', 'kr-pass', 'kr-err', 'kr-needs-setup', 'kr-label', 'kr-arrow', 'kr-spin',
  // 4. Layout & Panels
  'app-screen', 'app-layout', 'sidebar', 'main-panel',
  // 5. Sidebar Header & Fullscreen
  'sb-av', 'sb-av-circle', 'sb-status', 'fs-btn-sb', 'fs-icon-sb',
  // 6. Sidebar Navigation & Search
  'sb-q', 'sb-clear', 'sb-search-drop', 'sb-chats', 'sb-groups', 'sb-archived', 'sb-archived-section', 'arch-label', 'arch-chev', 'sb-list',
  // 7. Chat Header & HUD Triggers
  'chat-pane', 'chat-back', 'chat-hdr', 'chat-hdr-av', 'chat-av-circle', 'chat-av-status', 'chat-hdr-name', 'chat-hdr-sub', 'hdr-voice-btn', 'hdr-video-btn', 'grp-info-btn', 'chat-search-inp', 'chat-search-strip',
  // 8. Messages, Replies, Context & Reactions
  'msgs-wrap', 'empty-pane', 'reply-strip', 'rs-who', 'rs-txt', 'selection-strip', 'sel-count', 'react-pick', 'ctx', 'ctx-copy-label', 'ctx-del', 'ctx-edit-wrap', 'ctx-star-label',
  // 9. Composer, Voice Notes & Attachments
  'msg-inp', 'emoji-btn', 'audio-rec-btn', 'audio-rec-hud', 'audio-rec-timer', 'attach-dock', 'attach-dock-name', 'attach-dock-size',
  // 10. New Chat & Group Modal
  'nc-modal', 'nc-dm', 'nc-grp', 'nc-dm-q', 'nc-dm-res', 'nc-grp-name', 'nc-grp-q', 'nc-grp-res', 'nc-chips', 'nc-err',
  // 11. Group Drawer
  'grp-panel', 'gp-bg', 'gp-body',
  // 12. Settings Modal & Apple HIG Subviews
  'settings-modal', 'settings-title', 'sp-av-circle', 'sp-username', 'sp-handle', 'sv-main', 'sv-main-acct', 'sv-main-app', 'sv-appearance', 'font-options', 'font-preview', 'sv-privacy', 'sv-notif', 'notif-tog', 'notif-sub', 'sv-about', 'sv-starred', 'starred-list',
  // 13. Forward, Confirmation & Install
  'forward-modal', 'fwd-preview', 'fwd-q', 'fwd-res', 'confirm-modal', 'confirm-title', 'confirm-msg', 'confirm-inp', 'confirm-ok-btn', 'install-banner', 'install-banner-title', 'install-banner-sub',
  // 14. Mobile Top Bar & Actions
  'mob-hdr', 'mob-back-btn', 'mob-title', 'mob-av-btn', 'mob-av-mini', 'mob-more-btn', 'mob-grpinfo-btn', 'mob-newchat-btn', 'fs-btn-mob', 'fs-icon-mob',
  // 15. WebRTC HUD Overlay
  'call-overlay', 'call-status', 'call-timer', 'call-local-video', 'call-remote-grid', 'call-mute-btn', 'call-video-btn', 'call-screen-btn', 'call-end-btn', 'call-incoming', 'call-incoming-who', 'screen-share-indicator',
  // 16. Global Feedback
  'toast', 'toast-msg'
];

test('DOM-01: Baseline 146 DOM Element IDs Complete Preservation', () => {
  const missing = [];
  for (const id of REQUIRED_DOM_IDS) {
    const re = new RegExp(`id=["']${id}["']`);
    if (!re.test(html)) {
      missing.push(id);
    }
  }

  assert.strictEqual(
    missing.length,
    0,
    `The following DOM IDs are missing from index.html: ${missing.join(', ')}`
  );
});

test('DOM-02: Form Controls, Autocomplete, and Password Security', () => {
  // Username input exists with appropriate attributes
  assert.match(html, /id=["']f-user["'][^>]*type=["']text["']|type=["']text["'][^>]*id=["']f-user["']/);
  // Password input exists with type="password"
  assert.match(html, /id=["']f-pass["'][^>]*type=["']password["']|type=["']password["'][^>]*id=["']f-pass["']/);
  // Confirm password input exists
  assert.match(html, /id=["']f-confirm["'][^>]*type=["']password["']|type=["']password["'][^>]*id=["']f-confirm["']/);
});

test('DOM-03: Security and Script Bootstrapping Architecture', () => {
  // crypto.js and security.js are statically imported
  const securityIndex = html.indexOf('src="security.js"');
  const cryptoIndex = html.indexOf('src="crypto.js"');

  assert.ok(securityIndex > -1, 'security.js script tag must exist');
  assert.ok(cryptoIndex > -1, 'crypto.js script tag must exist');

  // app.js and webrtc.js are injected in ZxBoot lifecycle
  assert.match(html, /appScript\.src\s*=\s*['"]app\.js['"]/, 'app.js must be loaded dynamically after Firebase init');
  assert.match(html, /rtc\.src\s*=\s*['"]webrtc\.js['"]/, 'webrtc.js must be lazy-loaded upon app readiness');
});

test('DOM-04: Apple HIG Viewport Meta & PWA Icons', () => {
  // Viewport meta with viewport-fit=cover for safe-area insets
  assert.match(html, /viewport-fit=cover/i, 'Viewport must support viewport-fit=cover for iOS safe area');
  // Apple Touch Icon
  assert.match(html, /rel=["']apple-touch-icon["']/, 'Apple touch icon link must be present');
  // Manifest link
  assert.match(html, /rel=["']manifest["']/, 'PWA webmanifest must be linked');
});
