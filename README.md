<div align="center">

# 🛡️ Zyntrixly 2.0

### Private. Encrypted. Multi-Device. Yours.

**An open, privacy-first communication platform with user-controlled identity, secure messaging, and extensible real-time communication.**  
No phone number. No email required. No surveillance. No telemetry.

[![Zyntrixly 2.0 Tests](https://img.shields.io/badge/tests-52%20passing%20(100%25)-brightgreen.svg)](#-automated-testing--quality-gate)
[![Security Architecture](https://img.shields.io/badge/security-hardened-blue.svg)](SECURITY.md)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

</div>

---

## 🌟 What's New in Zyntrixly 2.0

Zyntrixly 2.0 transforms Zyntrixly from an encrypted prototype into an enterprise-grade, privacy-first communication platform:

- 🛡️ **Zero-Knowledge Metadata Budget:** Plaintext previews (`lastMsg`) eliminated from database records; message previews are decrypted on the client.
- 🔑 **Multi-Device Cryptographic Architecture:** Multi-device identity keys, deterministic safety numbers (60-digit SHA-512 fingerprints), and BIP-39 recovery keys.
- 🔄 **Group Key Epochs:** Cryptographic forward and backward secrecy ratcheting on any membership change.
- 📦 **Offline Storage & Outbox Pipeline:** Client-side IndexedDB caching and resilient outgoing queue that synchronizes upon network recovery.
- 👥 **Group Calling in UI:** Direct one-click group voice and video calling from conversation headers.
- 💻 **Command Palette (`Cmd+K` / `Ctrl+K`):** Keyboard-first navigation for instant chat discovery, settings toggles, and cryptographic actions.
- 🐳 **Self-Hosting Docker & Caddy:** Production containerization with automated HTTPS and strict Content Security Policy.
- 🔍 **Pre-Flight Validator CLI:** `npm run setup:check` automated deployment diagnostics.

---

## 📊 Feature Comparison Matrix

| Capability | Zyntrixly 2.0 | Signal | WhatsApp | Telegram |
|---|:---:|:---:|:---:|:---:|
| **Zero-Knowledge Architecture** | ✅ | ✅ | ❌ | ❌ |
| **No Phone Number Required** | ✅ | ❌ | ❌ | ❌ |
| **Multi-Device Cryptography** | ✅ | ✅ | ✅ | ❌ |
| **Group Key Epochs (Forward Secrecy)** | ✅ | ✅ | Partial | ❌ |
| **Peer-to-Peer Calling & Screen Share** | ✅ | ✅ | ❌ | ❌ |
| **Offline IndexedDB Outbox** | ✅ | ✅ | ✅ | ✅ |
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

Zyntrixly 2.0 enforces a strict continuous quality gate with automated test suites verifying cryptography, security rules, DOM architecture, WebRTC state machines, and end-to-end browser journeys:

```bash
npm test
```

### Test Coverage Report:
- **Cryptographic Engine:** 12 tests (RSA-OAEP, AES-GCM, PBKDF2, Safety Numbers, Group Epochs, Recovery Keys)
- **Security & Sanitization:** 7 tests (Safe Logger, KeyStore, Session Guard, Universal DOM Sanitizer, XSS Defense)
- **Firestore Security Rules:** 6 tests (DM immutability, call authorization, private data isolation, role enforcement)
- **Communication Engine:** 5 tests (IndexedDB store, outbox offline queue, retry cycles, reaction toggles)
- **DOM Architecture Integrity:** 4 tests (Strict verification of 146 required baseline element IDs)
- **WebRTC Calling Subsystem:** 5 tests (Connection state machine, tracks, group calls, screen sharing)
- **Calling Authentication & Lifecycle:** 2 tests (Timeout handlers and user auth synchronization)
- **Full E2E Browser Journey (Puppeteer Chrome):** 11 tests (Auth, navigation, messages, bubbles, settings, voice notes)

**Total: 52 tests, 100% pass rate.**

---

## 📚 Documentation Portal

- [SECURITY.md](SECURITY.md) — Threat model, cryptographic specifications, metadata budget, and disclosure policy.
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, data flow diagrams, and module organization.
- [GUIDE.md](GUIDE.md) — Beginner-friendly step-by-step setup guide with production security rules.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Self-hosting guide for Docker, Caddy, and static hosting platforms.

---

## 📜 License

Licensed under the [ISC License](LICENSE).
