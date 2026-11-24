# ZYNTRIXLY 10 — THE SOVEREIGN CLIENT

**Release:** 10.0.0 · **Codename:** The Sovereign Client · **Design OS:** Darkroom
**Status:** Flagship slice implemented and shipping in this release (marked `SHIPPED`); the rest is the committed roadmap (marked `NEXT`).

---

## 1. The Very Big Reason

Versions 1 through 4 of Zyntrixly answered one question: *how do you build an encrypted messenger that doesn't spy on you?* They answered it well — zero-knowledge relaying, multi-device cryptography, group key epochs, offline outbox, P2P calling, a 52-test quality gate.

But there is a ceiling on that question, and we hit it. **Chat is commodity.** Every messenger on earth sends messages; the encrypted ones are judged only by what they refuse to do. A product defined by refusal cannot grow, and a privacy product that cannot grow eventually loses to one that surveils better.

So Zyntrixly 10 asks a different question:

> **What if privacy is not a feature of your apps — what if it is the operating system?**

One browser tab that is your messenger, your encrypted drive, your meeting room, your notes, your AI assistant, and your identity — where the server's only job is to move ciphertext it can never read. You don't *install* privacy. You *live inside* it.

**Why the jump to 10:** the number is the thesis. **One client. Zero knowledge.** The leap from 4 to 10 declares that Zyntrixly is no longer a messenger with ambitions — it is an environment with apps, and everything after V10 is filling in an OS, not bolting features onto a chat.

---

## 2. The Non-Negotiables (the V10 Privacy Budget)

Every feature in this document must pass all five gates before it ships:

1. **Zero-knowledge relay** — the server stores ciphertext and routing metadata only. No plaintext previews, ever (kept from 2.0's metadata budget).
2. **No new third-party intelligence** — no external model APIs, no analytics SDKs, no font/CDN phone-home. GSAP is vendored; AI is on-device or absent.
3. **Client-first cryptography** — keys are generated, used, and (where possible) stored on-device. Recovery is user-held (BIP-39, WebAuthn PRF).
4. **Destroyable by default** — every artifact the client creates (cache, vault entries, call logs) can be shredded locally in one action.
5. **Self-hostable forever** — Docker + Caddy one-liner keeps working; no feature may require Zyntrixly-operated infrastructure.

---

## 3. The Ten Pillars of V10

### Pillar I — The Sovereign Surface (Design OS "Darkroom")

The interface itself makes the argument: one deep ground, one ember accent, hairlines instead of boxes, editorial type, and motion that behaves like good service — present, quiet, never in the way. No violet, no gradient slop, no glassmorphism clichés.

| # | Feature | Status |
|---|---------|--------|
| 1.1 | **Darkroom design system** — OLED ground `#050507`, ember accent `#ff6a3d`, warm ink, hairline borders, lit-edge signature line, full token override layer (`src/styles/v10.css`) with a kill switch (`html[data-v10]`) | `SHIPPED` |
| 1.2 | **Every surface re-skinned** — startup, auth, spaces rail, sidebar, chat, bubbles, composer, modals, settings, call overlay, toasts, scrollbars, focus rings, selection | `SHIPPED` |
| 1.3 | **GSAP Motion Core** (`src/v10/MotionEngine.js`) — boot choreography, screen transitions, panel entrances, message bubble pop, ±2px magnetic buttons (never tilt) | `SHIPPED` |
| 1.4 | **The decryption moment** — the signature effect: headers and the brand wordmark resolve through a live cipher-scramble, the interface visibly *decrypting* into place | `SHIPPED` |
| 1.5 | **Reduced-motion covenant** — under `prefers-reduced-motion` everything rests and nothing stays hidden; a Command Deck switch toggles motion globally | `SHIPPED` |
| 1.6 | Accent chapters (Ember / Aurora / Moss) as curated token sets | `NEXT` |
| 1.7 | Light "Daylight" theme with identical discipline | `NEXT` |

### Pillar II — The Command Deck (keyboard-first cockpit)

| # | Feature | Status |
|---|---------|--------|
| 2.1 | **Command Deck v2** (`src/v10/CommandDeck.js`) — ⌘K/Ctrl+K opens the OS-level palette: fuzzy matching across labels *and* keywords, grouped sections, ↑↓/Enter/Esc navigation, hover-to-select, recent commands persisted locally | `SHIPPED` |
| 2.2 | **Full command registry** — navigation, creation, Vault, Concierge, Panic Lock, safety number, cache purge, motion, fullscreen, About | `SHIPPED` |
| 2.3 | Conversational commands ("message Alice tomorrow") | `NEXT` |
| 2.4 | Composable chains (run 2–3 commands as a macro) | `NEXT` |

### Pillar III — The Vault (encrypted file room)

| # | Feature | Status |
|---|---------|--------|
| 3.1 | **The Vault** (`src/v10/Vault.js`) — drag-and-drop files anywhere into the vault panel; each file is sealed with a fresh AES-256-GCM key on-device (via `ZxBlobEngine`) before storage; ciphertext + key live only in the browser profile | `SHIPPED` |
| 3.2 | **Vault management** — decrypt-and-download, permanent shred, live browser-storage quota meter, type-aware file cards | `SHIPPED` |
| 3.3 | Global drop-to-vault while the vault is open; keyboard accessible (`Ctrl+Shift+V`) | `SHIPPED` |
| 3.4 | Vault spaces (folders as encrypted collections) and encrypted search over filenames | `NEXT` |
| 3.5 | Vault sharing — hand a file to a DM by wrapping its key for the recipient's public key | `NEXT` |

### Pillar IV — Panic Lock (one gesture, total cover)

| # | Feature | Status |
|---|---------|--------|
| 4.1 | **Panic Lock** (`src/v10/PanicLock.js`) — `Ctrl/Cmd+Shift+L` instantly seals the client behind an opaque vault door with a live cipher ticker; re-authentication (Firebase reauth) required to reopen; honest local fallback ("reload to unlock") when no session exists | `SHIPPED` |
| 4.2 | **Idle auto-lock** — default 15 minutes, user-tunable (`zx_v10_idle_minutes`), locks immediately when the tab is hidden and the timer has elapsed | `SHIPPED` |
| 4.3 | Decoy lock screen (disguised slate that looks like a neutral new-tab page) | `NEXT` |
| 4.4 | Duress password — opens a clean, empty instance | `NEXT` |

### Pillar V — On-Device Intelligence (the Concierge)

| # | Feature | Status |
|---|---------|--------|
| 5.1 | **AI Concierge drawer** (`src/v10/Concierge.js`) — "Catch me up" summary (participants, extractive summary, action items) and semantic search over the currently decrypted thread, both computed locally via `OnDeviceAI`; permanent **ON-DEVICE** badge and explicit zero-network statement in the UI | `SHIPPED` |
| 5.2 | WebGPU capability probe surfaced honestly (adapter detected vs heuristic local mode) | `SHIPPED` |
| 5.3 | WebLLM full local model (Llama-class, quantized) behind the same drawer | `NEXT` |
| 5.4 | Smart replies composed on-device, offered privately before sending | `NEXT` |
| 5.5 | Thread digests on a schedule, rendered locally, never uploaded | `NEXT` |

### Pillar VI — Spaces (encrypted communities)

| # | Feature | Status |
|---|---------|--------|
| 6.1 | Spaces rail (communities column) with create/explore — carried forward and re-skinned | `SHIPPED` |
| 6.2 | Space commands in the Deck (create space, explore) | `SHIPPED` |
| 6.3 | `SpaceManager` RBAC wired into channel UI (roles, permissions, channels per space) | `NEXT` |
| 6.4 | Per-space MLS groups (see Pillar VII) | `NEXT` |

### Pillar VII — Next-Generation Cryptography

| # | Feature | Status |
|---|---------|--------|
| 7.1 | MLS engine (`MLSEngine.js`) — TreeKEM group ratcheting, epoch forward/backward secrecy — shipped as a module, wired into group UI | `SHIPPED` (module) / `NEXT` (UI) |
| 7.2 | Passkey-derived master keys via WebAuthn PRF (`WebAuthnPRF.js`) — hardware-bound key derivation, shipped as a module; settings entry | `SHIPPED` (module) / `NEXT` (UI) |
| 7.3 | Post-quantum hybrid (Kyber-768 + X25519) for new handshakes | `NEXT` |
| 7.4 | Sealed sender — relay learns routing but not identity pairs | `NEXT` |

### Pillar VIII — Presence Without Surveillance

| # | Feature | Status |
|---|---------|--------|
| 8.1 | Zero-knowledge presence (carried from 2.0) — throttled, generic notifications | `SHIPPED` |
| 8.2 | Focus mode — per-conversation quiet hours with local scheduling | `NEXT` |
| 8.3 | Read receipts as an explicit, per-chat switch (default off) | `NEXT` |

### Pillar IX — Calls & Stage (real-time, P2P)

| # | Feature | Status |
|---|---------|--------|
| 9.1 | P2P voice/video, screen share, group calls (carried from 2.0/3.0), re-skinned Darkroom call overlay | `SHIPPED` |
| 9.2 | `StageController` media pipeline — layout stages for calls | `SHIPPED` (module) |
| 9.3 | Encrypted call recording to the Vault (double-consent, local-only) | `NEXT` |
| 9.4 | Watch-together / encrypted stage sharing via `CanvasEngine` | `NEXT` |

### Pillar X — The Self-Hosted Republic

| # | Feature | Status |
|---|---------|--------|
| 10.1 | Docker + Caddy one-click with strict CSP (carried from 2.0) | `SHIPPED` |
| 10.2 | Pre-flight validator `npm run setup:check` (carried from 2.0) | `SHIPPED` |
| 10.3 | Service worker precache extended to the full V10 layer (offline-first OS) | `SHIPPED` |
| 10.4 | Federation bridge (self-hosted relays talking to each other, still zero-knowledge) | `NEXT` |

---

## 4. What Shipped in 10.0.0 (the implementation contract)

Six new files, one vendored library, and a strictly layered load chain (`app.js → webrtc.js → V10 layer`):

```
src/styles/v10.css          Design OS "Darkroom" — token override + full reskin (kill switch: remove html[data-v10])
src/v10/MotionEngine.js     GSAP core — boot, screens, bubbles, magnetic, decryptText
src/v10/CommandDeck.js      Command Deck v2 — fuzzy, grouped, keyboard-first, recents
src/v10/Vault.js            Encrypted file vault on ZxBlobEngine + IndexedDB
src/v10/PanicLock.js        Instant lock, re-auth unlock, idle auto-lock
src/v10/Concierge.js        On-device AI drawer (summary + semantic search)
src/v10/boot.js             Wiring — dock, shortcuts, observers, version stamp
vendor/gsap/gsap.min.js     Self-hosted GSAP 3.13 (no CDN phone-home)
```

The layer is **non-destructive by design**: no baseline element IDs were removed or renamed (the 146-ID DOM integrity gate still passes), all overrides are additive, and deleting `html[data-v10]` + the V10 script chain restores the v4 client byte-for-byte.

## 5. How We'll Know V10 Worked

- **The 10-second test:** a stranger can explain what Zyntrixly is after 10 seconds on the auth screen ("a private OS in a tab", not "another chat app").
- **The K-risk test:** losing the laptop loses nothing but the recovery phrase's job.
- **The warrant test:** the relay operator can produce ciphertext and timestamps, and nothing else.
- **The week test:** after a week, the Vault and Concierge have at least one daily use each — proof the OS is lived in, not demoed.

## 6. The Line

> **Zyntrixly 10. One client. Zero knowledge.**
> Privacy stopped being a feature the day it became the place you live.
