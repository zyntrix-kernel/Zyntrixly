<div align="center">

# 🛡️ Zyntrixly

### Private. Encrypted. Yours.

**A free, open-source, end-to-end encrypted messaging app you can host yourself.**  
No phone number. No email. No ads. No surveillance.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOURUSERNAME/zyntrixly)

</div>

---

## ✨ What makes Zyntrixly different?

Most messaging apps say they're private. Zyntrixly *proves* it — by design, the server **cannot** read your messages even if it wanted to. All encryption happens on your device, in your browser, before anything is sent.

| Feature | Zyntrixly | WhatsApp | Telegram |
|---------|-----------|----------|----------|
| No phone number needed | ✅ | ❌ | ❌ |
| Open source | ✅ | ❌ | Partial |
| Self-hostable | ✅ | ❌ | ❌ |
| Encrypted file sharing | ✅ | ✅ | ❌ |
| Group video calls | ✅ | ✅ | ✅ |
| Screen sharing | ✅ | ❌ | ❌ |
| Free forever | ✅ | ✅ | ✅ |

---

## 📱 Features

### 💬 Messaging
- **Direct messages** — one-to-one, end-to-end encrypted
- **Group chats** — up to any size, with admin controls
- **Reactions** — emoji reactions on any message
- **Replies** — reply to specific messages with context
- **Read receipts** — see when messages are read
- **Typing indicators** — see when someone is typing
- **Message forwarding** — share messages across chats

### 📞 Calling
- **Voice calls** — crystal clear, peer-to-peer audio
- **Video calls** — camera + microphone, toggle independently
- **Group calls** — multiple people in one call
- **Screen sharing** — share your screen live during a call
- **Camera switching** — front/back camera toggle on mobile

### 📁 File Sharing
- **Encrypted uploads** — files are encrypted before leaving your device
- **Any file type** — documents, images, audio, video, anything
- **Temporary hosting** — files auto-expire after 24 hours
- **Secure download** — files decrypt locally on the recipient's device

### 👥 Groups
- **Admin roles** — promote and demote members
- **Invite system** — share invite links
- **Member management** — remove members, manage permissions
- **Group settings** — custom names and icons

### 🔐 Privacy & Security
- **End-to-end encryption** — AES-256-GCM + RSA-OAEP
- **Anonymous accounts** — username only, no personal info required
- **Zero knowledge** — the server stores only ciphertext, never plaintext
- **Keys never leave your device** — private keys are generated and stored locally
- **No tracking** — no analytics, no ads, no data selling

### 📲 App Experience
- **Progressive Web App** — installs on iOS, Android, and desktop like a native app
- **Works offline** — cached messages available without internet
- **Dark theme** — easy on the eyes
- **Mobile-first design** — built for phones, great on desktop too
- **3-second load time** — fast startup, no waiting

---

## 🚀 Try it live

> Coming soon — deploy your own instance using the guide below!

---

## 🛠️ Deploy your own copy in 15 minutes

Zyntrixly is designed to be self-hosted. You get your own private instance with your own database. No one else's data, no shared servers.

**What you need (all free):**
- A Google account (for Firebase)
- A GitHub account (for code hosting)
- A Vercel account (for deployment)

**📖 Follow the complete step-by-step guide: [GUIDE.md](./GUIDE.md)**

The guide covers everything from zero — creating accounts, setting up the database, deploying the app, and securing it. No coding experience required.

### Quick deploy (if you know what you're doing)

```bash
# 1. Fork this repository on GitHub

# 2. Create a Firebase project at console.firebase.google.com
#    - Enable Firestore Database
#    - Enable Authentication (Email/Password)
#    - Copy your web app config values

# 3. Deploy to Vercel
#    - Import your forked repo at vercel.com
#    - Add these environment variables:

FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# 4. Deploy! Your app is live.
```

---

## 🧱 How it's built

Zyntrixly is intentionally simple — **no frameworks, no build tools, no npm**. Just files a browser can run directly.

```
zyntrixly/
├── index.html          ← The entire UI (one file)
├── app.js              ← All app logic
├── crypto.js           ← Encryption primitives
├── webrtc.js           ← Voice/video/screen share
├── security.js         ← Key rotation, safe logging
├── style.css           ← All styles
├── sw.js               ← Service worker (offline)
├── manifest.webmanifest← PWA manifest
└── api/
    └── config.js       ← Vercel function (serves config securely)
```

**Technologies used:**
- [Firebase](https://firebase.google.com) — Auth + Firestore database + realtime sync
- [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — Browser-native AES-GCM and RSA-OAEP encryption
- [WebRTC](https://webrtc.org) — Peer-to-peer voice, video, and screen sharing
- [Vercel](https://vercel.com) — Hosting + serverless functions
- [file.io](https://file.io) — Temporary encrypted file hosting

**No React. No Vue. No bundler. No node_modules.** Just clean, readable JavaScript that any browser can run.

---

## 🔒 Security model

### Encryption
Every message goes through this process before hitting the database:

```
Your message (plaintext)
       ↓
AES-256-GCM encryption  ←  random key + IV (generated per message)
       ↓
Key wrapped with RSA-OAEP  ←  recipient's public key
       ↓
Stored in Firestore  ←  server only ever sees ciphertext
       ↓
Recipient unwraps key with their private key
       ↓
Message decrypted locally on their device
```

Your private key is generated in your browser and **never sent to any server**. It's stored locally on your device, optionally password-protected with PBKDF2 key derivation.

### What the server can see
- ✅ Encrypted message blobs (unreadable without your key)
- ✅ Message timestamps
- ✅ Who sent a message to whom (metadata)
- ❌ Message content — impossible without your private key
- ❌ File content — encrypted before upload
- ❌ Call audio/video — peer-to-peer, never touches the server

---

## 🤝 Using this code for your own project

This project is open source. You're welcome to:

- ✅ Fork it and run your own private instance
- ✅ Modify it for your own community or organization
- ✅ Use it as a starting point for your own encrypted app
- ✅ Learn from the code for your own projects

### Building on top of this

Some ideas for what you could add:

| Feature | Where to start |
|---------|---------------|
| Custom branding | Edit `index.html` (app name, colors in `style.css`) |
| Larger file sizes | Replace file.io in `openFileShare()` in `app.js` with your own S3/R2 storage |
| Push notifications | Add FCM token registration in `app.js` bootApp, handle push in `sw.js` |
| Message search | Add a Cloud Function with Typesense or Algolia (Firestore doesn't support full-text search) |
| Larger group calls | Replace mesh WebRTC in `webrtc.js` with an SFU like LiveKit or mediasoup |
| Custom TURN servers | Add your TURN credentials to `ICE_SERVERS` in `webrtc.js` |
| Multiple themes | Add theme classes to `style.css`, add a theme picker in Settings |

### Replacing the file host

By default, files are uploaded to [file.io](https://file.io) which is free but limited to 5MB and 24-hour expiry. To use your own storage, find `openFileShare()` in `app.js` and replace the `fetch('https://file.io/...')` block with your own upload endpoint. The encryption code stays the same — only the upload destination changes.

---

## 📋 Browser support

| Browser | Messages | Calls | Screen Share |
|---------|----------|-------|-------------|
| Chrome 90+ | ✅ | ✅ | ✅ |
| Firefox 90+ | ✅ | ✅ | ✅ |
| Safari 15.4+ | ✅ | ✅ | ⚠️ Limited |
| Edge 90+ | ✅ | ✅ | ✅ |
| iOS Safari 15.4+ | ✅ | ✅ | ❌ |
| Android Chrome | ✅ | ✅ | ✅ |

---

## 📄 License

MIT License — free to use, modify, and distribute.  
See [LICENSE](./LICENSE) for full details.

---

<div align="center">

**Built with privacy in mind. Hosted by you. Owned by no one.**

⭐ Star this repo if you find it useful

</div>
