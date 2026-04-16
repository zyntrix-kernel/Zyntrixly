# Zyntrixly — Developer Guide

> Privacy-focused PWA for secure real-time messaging, file sharing, and voice/video calls.

---

## 1. Project Overview

Zyntrixly is a **Progressive Web App** (PWA) built on Firebase (Auth + Firestore) with end-to-end encryption. Every message, file, and call is encrypted on-device before it leaves the browser. The server never sees plaintext content.

### Core Features

| Feature | Status | Notes |
|---------|--------|-------|
| Anonymous accounts (username only) | ✅ | No email or phone required |
| E2E encrypted DMs | ✅ | AES-GCM + RSA-OAEP |
| E2E encrypted group chats | ✅ | Per-recipient key wrapping |
| File sharing (encrypted) | ✅ | AES-GCM, hosted via file.io (24h expiry) |
| Voice calls | ✅ | WebRTC peer-to-peer |
| Video calls | ✅ | Camera + mic, switchable |
| Screen sharing | ✅ | `getDisplayMedia`, live stream replacement |
| Group admin roles | ✅ | Promote / demote admins |
| Reactions, replies, forwarding | ✅ | |
| Read receipts, typing indicators | ✅ | |
| PWA installable | ✅ | iOS + Android + Desktop |
| Offline caching | ✅ | Firestore persistence + service worker |

---

## 2. Setup Instructions

### Prerequisites

- Node.js ≥ 18 (only needed for local Vercel dev)
- A Firebase project (Spark/free tier is fine)
- A Vercel account (free tier works)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/zyntrixly.git
cd zyntrixly

# 2. Install Vercel CLI (for local API routes)
npm install -g vercel

# 3. Create your local firebase config (NEVER commit this file)
cp firebase-config.example.js firebase-config.js
# Then edit firebase-config.js with your real Firebase values

# 4. Run locally
vercel dev
# App available at http://localhost:3000
```

> **Without Vercel CLI:** Open `index.html` directly in a browser. The config loader will fall back to `firebase-config.js` automatically when `/api/config` is unreachable.

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. Enable **Authentication** → Anonymous (or Email/Password — Zyntrixly uses a fake email scheme internally)
3. Enable **Firestore Database** → Start in production mode
4. Copy your web app config values (used in env vars below)
5. Set Firestore security rules (see below)

**Recommended Firestore Rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /dms/{docId} {
      allow read, write: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }
    match /dms/{docId}/{sub=**} {
      allow read, write: if request.auth != null;
    }
    match /groups/{docId} {
      allow read, write: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }
    match /groups/{docId}/{sub=**} {
      allow read, write: if request.auth != null;
    }
    match /calls/{docId} {
      allow read, write: if request.auth != null;
    }
    match /calls/{docId}/{sub=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 3. Deploying on Vercel

```bash
# 1. Push your repo to GitHub (firebase-config.js is gitignored — safe)
git add .
git commit -m "initial deploy"
git push origin main

# 2. Import project at https://vercel.com/new
# 3. Set Environment Variables (see section 4)
# 4. Deploy — Vercel auto-deploys on every git push
```

The `/api/config.js` serverless function runs on Vercel's edge and returns your Firebase config from environment variables. The frontend fetches it at runtime — **nothing sensitive is ever in the repo**.

---

## 4. Environment Variables

Set all of these in **Vercel Dashboard → Project → Settings → Environment Variables**.

| Variable | Description | Example |
|----------|-------------|---------|
| `FIREBASE_API_KEY` | Firebase Web API key | `AIzaSy...` |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `your-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `your-project` |
| `FIREBASE_STORAGE_BUCKET` | Firestore storage bucket | `your-project.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | `663603...` |
| `FIREBASE_APP_ID` | Firebase App ID | `1:663603...:web:...` |

> ⚠️ **Never put real values in `firebase-config.example.js` or any committed file.**  
> For local dev, values go in `firebase-config.js` (gitignored).

---

## 5. Security Rules (CRITICAL)

### ❌ Never Do This
- Hardcode API keys, tokens, or secrets in any file tracked by git
- Store encryption keys in Firestore or any server
- Log message plaintext or crypto keys — `security.js` scrubs logs in production
- Use `console.log(privKey)`, `console.log(encKey)`, etc.
- Commit `firebase-config.js` — it is in `.gitignore` for good reason

### ✅ Always Do This
- Keep ALL secrets in Vercel environment variables only
- Use `ZxKeyStore` for any external API key management with rotation
- Let `security.js` handle session cleanup (auto-clears `sessionStorage` after 30min idle)
- Run sensitive decryption in the browser only — the server never receives keys

### API Key Rotation (`ZxKeyStore`)

`security.js` exports a `ZxKeyStore` object for managing rotating API keys:

```js
// Initialize with primary, backup, and additional keys
ZxKeyStore.init([
  'primary-key-value',
  'backup-key-value',
  'older-key-still-valid'
]);

// Use in a fetch — auto-rotates on 401/403
const res = await ZxKeyStore.fetchWithRotation(
  'https://api.example.com/endpoint',
  { method: 'GET' },
  (opts, key) => { opts.headers = { 'Authorization': `Bearer ${key}` }; return opts; }
);

// Manually invalidate a key (e.g. after security incident)
ZxKeyStore.invalidate('compromised-key-value');

// Check how many active keys remain
console.log(ZxKeyStore.activeCount());
```

Rotation rules:
- Keys expire automatically after **24 hours** (configurable via `TTL_MS`)
- If primary key returns 401/403, system instantly falls back to backup
- Expired and invalid keys are pruned automatically on each `getCurrent()` call
- New keys can be added at runtime via `ZxKeyStore.addKey(newKeyString)`

### Encryption Architecture

```
Sender Device                        Recipient Device
─────────────────────                ─────────────────────
plaintext message
    │
    ▼
AES-GCM encrypt                      AES-GCM decrypt
(random key + IV)                    (key + IV from message)
    │                                    ▲
    ▼                                    │
RSA-OAEP wrap key          ──────►  RSA-OAEP unwrap key
with recipient pubKey                with recipient privKey
    │
    ▼
Firestore (ciphertext only)
```

Private keys **never leave the device**. They are:
1. Generated in-browser via `crypto.subtle`
2. Wrapped with the user's password (PBKDF2 + AES-KW) for backup
3. Stored in `localStorage` for subsequent sessions

---

## 6. WebRTC Requirements

### Browser Permissions Required

| Feature | Permission |
|---------|-----------|
| Voice call | Microphone |
| Video call | Camera + Microphone |
| Screen share | Screen Capture (user-prompted) |

### Browser Compatibility

| Browser | Voice | Video | Screen Share |
|---------|-------|-------|-------------|
| Chrome 90+ | ✅ | ✅ | ✅ |
| Firefox 90+ | ✅ | ✅ | ✅ |
| Safari 15.4+ | ✅ | ✅ | ⚠️ Limited |
| Edge 90+ | ✅ | ✅ | ✅ |
| iOS Safari 15.4+ | ✅ | ✅ | ❌ Not supported |
| Android Chrome | ✅ | ✅ | ✅ |

> **iOS Screen Share**: `getDisplayMedia` is not supported on iOS as of this writing. Voice and video calls work normally.

### Signalling

WebRTC signalling (offer/answer/ICE) uses Firestore subcollections under `calls/{callId}/`. No dedicated signalling server is needed.

### STUN Servers

The app uses Google's public STUN servers by default:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

For production, consider adding a **TURN server** (e.g. Twilio or Metered.ca) to support users behind symmetric NAT. Set in `ICE_SERVERS` array in `webrtc.js`.

---

## 7. File Sharing Behavior

### Upload Flow

1. User selects file (max 5MB) via attach button
2. Browser generates a random AES-GCM 256-bit key + 12-byte IV
3. File is encrypted entirely in-browser — **the plaintext never leaves the device**
4. Encrypted blob is uploaded to [file.io](https://file.io) with `?expires=1d`
5. A JSON payload containing `{url, filename, size, keyHex, ivHex, expiry}` is sent as an encrypted message through the normal chat flow

### Download Flow

1. Recipient receives the message, decrypts the JSON payload
2. Taps the file card → app fetches the encrypted blob from file.io
3. AES-GCM decryption runs in-browser using the embedded key/IV
4. Decrypted file is offered as a browser download

### Expiry Behavior

- Files expire after **24 hours** on file.io
- After expiry, the download link returns a 404 — the chat message remains but tapping download shows `File expired or unavailable`
- Keys embedded in expired messages pose no risk as the ciphertext is gone

### Limitations

- **5MB max** per file (file.io free tier)
- Files are stored on a third-party host (file.io) — not under your control
- No file preview (intentional — preview would require decrypting to memory first)
- For enterprise use, replace file.io with your own encrypted object storage (S3 + pre-signed URLs)

---

## 8. Known Limitations

### WebRTC Group Calls (Mesh Topology)

Group calls use a **full-mesh** topology — every participant connects directly to every other participant. This scales well up to ~4–6 participants. Beyond that:

- CPU and bandwidth usage grows quadratically: `n*(n-1)/2` connections
- For larger groups, migrate to an **SFU** (Selective Forwarding Unit) like LiveKit, mediasoup, or Janus

### External File Hosts

- file.io is a free public service with 24h expiry — no SLA
- If file.io is down, file uploads fail
- Files are uploaded as encrypted blobs so file.io cannot read them, but metadata (file size, upload time) is visible to file.io

### Firebase Dependency

- The app requires Firebase Auth + Firestore — no Firebase = no login
- Firestore costs scale with reads/writes — monitor usage in the Firebase console
- WebRTC signalling uses Firestore subcollections which count against your quota

---

## 9. Developer Notes

### Module Structure

```
zyntrixly/
├── index.html          # Single-page app shell, all UI markup
├── app.js              # Core application logic (~2500 lines)
│   ├── State & helpers
│   ├── Auth (register/login/boot)
│   ├── DM system (startDM, sendDMMsg, listeners)
│   ├── Group system (openGroup, admin management)
│   ├── Message rendering (renderMsg, decryptBubble)
│   ├── File sharing (openFileShare, downloadFileMsg)
│   ├── Emoji picker (openEmojiPicker, insertEmoji)
│   ├── Settings, notifications, modals
│   └── UI helpers (toast, zConfirm, zPrompt)
├── webrtc.js           # WebRTC module (ZxCall) — lazy, self-contained
│   ├── startCall / acceptCall / rejectCall / endCall
│   ├── toggleMute / toggleVideo / toggleScreenShare
│   ├── switchCamera (mobile)
│   └── joinGroupCall (multi-participant)
├── security.js         # Security utilities — loaded FIRST
│   ├── Safe console logger (key scrubbing in production)
│   ├── ZxKeyStore (API key rotation)
│   └── Session guard (auto-clear password from sessionStorage)
├── crypto.js           # Crypto primitives (AES-GCM, RSA-OAEP, PBKDF2)
├── style.css           # All styles (dark theme, glass morphism)
├── sw.js               # Service worker (offline caching)
├── manifest.json       # PWA manifest
├── api/
│   └── config.js       # Vercel serverless: serves Firebase config from env vars
├── firebase-config.example.js  # Template — safe to commit
├── firebase-config.js          # GITIGNORED — local dev only
├── .gitignore
└── GUIDE.md            # This file
```

### Where to Extend Features Safely

| Feature | Where to extend |
|---------|----------------|
| Add new message types | `renderMsg()` in `app.js` — detect payload type and render custom UI |
| Add TURN servers | `ICE_SERVERS` array at top of `webrtc.js` |
| Replace file host | `openFileShare()` in `app.js` — swap fetch to your S3/R2 endpoint |
| Add push notifications | `sw.js` — add `push` event handler; register FCM token in `bootApp()` |
| Add message search | Firestore does not support full-text; add a Cloud Function with Algolia/Typesense |
| Group call SFU | Replace `createPC()` in `webrtc.js` with SFU SDK (LiveKit, mediasoup) |
| Add new env vars | Add to `api/config.js` → set in Vercel dashboard → read in `app.js` |

### Coding Conventions

- **No build step** — vanilla JS, no bundler, no TypeScript. Keep it that way unless adopting a full framework.
- **State is global** — `ME`, `CHAT`, `grpMembers` are module-level. Don't introduce conflicting global names.
- **Never `console.log` keys** — `security.js` will scrub them in production but it's still bad practice.
- **Firestore writes are eventual** — always `.catch()` on writes; the app must remain usable if a write fails.
- **Async chat opens are instant** — `openGroup` / `startDM` show UI immediately before any `await`. Maintain this pattern.

### Adding a New External API (with Key Rotation)

```js
// 1. In your Vercel env vars, add: MY_SERVICE_API_KEY, MY_SERVICE_API_KEY_BACKUP
// 2. In api/config.js, add them to the response JSON (use a non-secret name)
// 3. In app.js bootApp(), after config loads:
ZxKeyStore.init([
  config.myServiceKey,
  config.myServiceKeyBackup
]);

// 4. Make requests with auto-rotation:
const res = await ZxKeyStore.fetchWithRotation(
  'https://myservice.com/api/endpoint',
  { method: 'POST', body: JSON.stringify(payload) },
  (opts, key) => {
    opts.headers = { 'X-API-Key': key, 'Content-Type': 'application/json' };
    return opts;
  }
);
```

---

## 10. Changelog (Patches Applied)

| Change | File(s) |
|--------|---------|
| Secure Firebase config via `/api/config` Vercel function | `index.html`, `api/config.js` |
| Hardcoded keys removed from frontend bundle | `firebase-config.js` → gitignored |
| `.gitignore` created | `.gitignore` |
| Startup animation hard-capped at 3s | `app.js` |
| Emoji picker implemented (cursor-position insertion) | `app.js`, `index.html` |
| File sharing: AES-GCM encrypt → file.io upload → message | `app.js` |
| File download: fetch → AES-GCM decrypt → browser save | `app.js` |
| Admin promote/demote buttons in group panel | `app.js` |
| WebRTC calling module (voice, video, screen share, group) | `webrtc.js` (new) |
| Call overlay UI + incoming call notification | `index.html`, `style.css` |
| Voice/video call buttons in chat header (DM only) | `index.html`, `app.js` |
| Sanitized console logger (no key leakage in production) | `security.js` (new) |
| API key rotation system (`ZxKeyStore`) | `security.js` (new) |
| Session guard (clears password from sessionStorage on idle) | `security.js` (new) |
