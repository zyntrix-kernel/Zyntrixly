<div align="center">

# 🛡️ Zyntrixly 10

### The Sovereign Client. One client. Zero knowledge.

**An open, privacy-first communication platform with user-controlled identity, secure messaging, and extensible real-time communication.**  
No phone number. No email required. No surveillance. No telemetry.

[![Zyntrixly 10 Tests](https://img.shields.io/badge/tests-52%20passing%20(100%25)-brightgreen.svg)](#-automated-testing--quality-gate)
[![Security Architecture](https://img.shields.io/badge/security-hardened-blue.svg)](SECURITY.md)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

</div>

---

## 🌑 What's New in Zyntrixly 10 — The Sovereign Client

V10 is not a feature drop. It is a thesis: **privacy is not a feature of your apps — it is the operating system.** One browser tab that is your messenger, your encrypted drive, your AI assistant, and your panic room, where the server only ever relays ciphertext. Full reasoning and the ten-pillar roadmap: [VISION_V10.md](VISION_V10.md).

- 🎨 **Design OS "Darkroom"** — OLED ground, one ember accent, hairline system, editorial type, full token override with a kill switch (`src/styles/v10.css`).
- 🎬 **GSAP Motion Core** — self-hosted GSAP: boot choreography, screen transitions, message entrances, magnetic controls, and the signature **decryption scramble** (`src/v10/MotionEngine.js`). Reduced-motion covenant included.
- ⌘ **Command Deck v2** — ⌘K opens the OS-level palette: fuzzy search, grouped actions, keyboard navigation, recent commands (`src/v10/CommandDeck.js`).
- 🔐 **The Vault** — drag-and-drop encrypted file room. Every file sealed with a fresh AES-256-GCM key on-device before storage; decrypt, shred, quota meter (`src/v10/Vault.js`).
- 🚨 **Panic Lock** — `Ctrl/Cmd+Shift+L` seals the client instantly; re-authentication required back in; idle auto-lock by default (`src/v10/PanicLock.js`).
- 🧠 **AI Concierge (on-device)** — "Catch me up" summaries and semantic search over decrypted threads, computed locally, zero bytes leave the tab (`src/v10/Concierge.js`).
- 🧬 **Advanced crypto modules carried into the load chain** — MLS TreeKEM group ratchets and WebAuthn-PRF passkey key derivation.

---

## 📊 Feature Comparison Matrix

| Capability | Zyntrixly 10 | Signal | WhatsApp | Telegram |
|---|:---:|:---:|:---:|:---:|
| **Zero-Knowledge Architecture** | ✅ | ✅ | ❌ | ❌ |
| **No Phone Number Required** | ✅ | ❌ | ❌ | ❌ |
| **Multi-Device Cryptography** | ✅ | ✅ | ✅ | ❌ |
| **Group Key Epochs (Forward Secrecy)** | ✅ | ✅ | Partial | ❌ |
| **Peer-to-Peer Calling & Screen Share** | ✅ | ✅ | ❌ | ❌ |
| **Offline IndexedDB Outbox** | ✅ | ✅ | ✅ | ✅ |
| **On-Device AI (zero-network)** | ✅ | ❌ | ❌ | Partial |
| **Encrypted Local Vault** | ✅ | ❌ | ❌ | ❌ |
| **Panic Lock + Idle Auto-Lock** | ✅ | ❌ | ❌ | ❌ |
| **100% Open Source & Self-Hostable** | ✅ | Partial | ❌ | Partial |
| **Docker & Caddy One-Click Deploy** | ✅ | ❌ | ❌ | ❌ |

---

## 🚀 Quick Start & Deployment

### 1. Self-Hosting with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/zyntrix-kernel/Zyntrixly.git
cd Zyntrixly

# Run automated pre-flight setup checks
npm run setup:check

# Start production container
docker-compose up -d --build
```

Access Zyntrixly at `http://localhost:8080`.

### 2. Static Web Deployment (Vercel / Firebase Hosting)

Deploy to your favorite hosting platform and configure environment variables:
`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`.

See [DEPLOYMENT.md](DEPLOYMENT.md) and [GUIDE.md](GUIDE.md) for full step-by-step instructions.

---

## 🧪 Automated Testing & Quality Gate

Zyntrixly 10 enforces a strict continuous quality gate with automated test suites verifying cryptography, security rules, DOM architecture, WebRTC state machines, and end-to-end browser journeys:

```bash
npm test
```

### Test Coverage Report:
- **Cryptographic Engine:** 12 tests (RSA-OAEP, AES-GCM, PBKDF2, Safety Numbers, Group Epochs, Recovery Keys)
- **Security & Sanitization:** 7 tests (Safe Logger, KeyStore, Session Guard, Universal DOM Sanitizer, XSS Defense)
- **Firestore Security Rules:** 6 tests (DM immutability, call authorization, private data isolation, role enforcement)
- **Communication Engine:** 5 tests (IndexedDB store, outbox offline queue, retry cycles, reaction toggles)
- **DOM Architecture Integrity:** 4 tests (Strict verification of 146 baseline element IDs)
- **WebRTC Calling Subsystem:** 5 tests (Connection state machine, tracks, group calls, screen sharing)
- **Calling Authentication & Lifecycle:** 2 tests (Timeout handlers and user auth synchronization)
- **Full E2E Browser Journey (Puppeteer Chrome):** 11 tests (Auth, navigation, messages, bubbles, settings, voice notes)

**Total: 52 tests, 100% pass rate.**

---

## 📚 Documentation Portal

- [VISION_V10.md](VISION_V10.md) — The V10 thesis: why "the Sovereign Client", the ten pillars, and the full feature roadmap.
- [SECURITY.md](SECURITY.md) — Threat model, cryptographic specifications, metadata budget, and disclosure policy.
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, data flow diagrams, and module organization.
- [GUIDE.md](GUIDE.md) — Beginner-friendly step-by-step setup guide with production security rules.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Self-hosting guide for Docker, Caddy, and static hosting platforms.

---

## 📜 License

Licensed under the [ISC License](LICENSE).
