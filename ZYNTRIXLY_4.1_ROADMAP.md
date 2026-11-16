# Zyntrixly 4.1 — Daily Driver QoL Roadmap

> Status: implementation in progress. This document tracks intended work; a feature is not complete until its acceptance criteria and tests pass.

## Product goals
1. Make everyday messaging faster and easier to manage.
2. Make offline behavior reliable without weakening end-to-end encryption.
3. Make web and Android behavior consistent.
4. Ensure UI claims correspond to real backend behavior.
5. Keep decrypted message search local to the user's device.

## Milestones

### M0 — Reliability and security foundations (P0)
- [ ] Integrate the offline message pipeline into the actual send flow.
- [ ] Encrypt queued message payloads at rest; never persist plaintext drafts/outbox data unprotected.
- [ ] Make retries idempotent using a stable client message ID and server-side duplicate protection.
- [ ] Remove dummy recipient-key fallback; fail closed when identity keys are unavailable.
- [ ] Implement and verify real linked-device pairing and revocation.
- [ ] Persist Spaces channel messages and enforce membership/role checks in Firestore rules.
- [ ] Audit unread/read-position semantics and delivery state transitions.
- [ ] Add emulator-backed authorization tests for device, message and Spaces data.

Acceptance: simulated offline/online transitions do not lose or duplicate messages; failed key retrieval cannot send under an unverified key; device revocation blocks future access; Spaces messages survive reload and synchronize across clients.

### M1 — Message search and organization (P1)
- [x] Add a local in-memory decrypted-message index with token replacement, deletion and conversation cleanup.
- [ ] Connect message listeners to the local index and rebuild it from locally cached/decrypted history.
- [ ] Add global search UI with sender, conversation, content-type and date filters.
- [ ] Add jump-to-message navigation from search results.
- [ ] Implement true unread counts and first-unread navigation.
- [ ] Add mark-as-unread, bookmarks and pinned-message management.
- [ ] Fix Starred Messages to decrypt locally and navigate to the original message.

Acceptance: search covers all locally available history, never uploads plaintext or tokens, filters correctly, and can navigate to the original message.

### M2 — Composer and attachments (P1)
- [ ] Multi-file selection and previews.
- [ ] Clipboard image paste and drag/drop.
- [ ] Per-file progress, cancellation and retry.
- [ ] Voice-note waveform and playback speed.
- [ ] Recoverable autosaved drafts with local encryption.
- [ ] Link previews opt-in and privacy-safe by default.

Acceptance: failed uploads are visible and recoverable; previews do not transmit until the user sends.

### M3 — Smart Inbox and personalization (P1)
- [ ] All / Unread / Personal / Groups inbox filters.
- [ ] User-created folders and favorites.
- [ ] Snooze and archive management.
- [ ] Compact/comfortable density and accessibility controls.
- [ ] Per-chat notification and appearance preferences.
- [ ] Keyboard shortcut reference and quick switcher.

Acceptance: preferences persist per account/device as documented; all inbox filters reflect real conversation state.

### M4 — Privacy, identity and discovery (P1/P2)
- [ ] Profile sharing links and QR codes.
- [ ] Revocable invitation links and contact requests.
- [ ] Per-chat read receipts, typing and presence controls.
- [ ] Block/report and spam controls.
- [ ] Key-change and session activity alerts.
- [ ] Secure export and local storage manager.

Acceptance: privacy defaults are conservative, consent is explicit, and account/device operations are auditable.

### M5 — Calling and Spaces (P2)
- [ ] Call history, missed-call state and network diagnostics.
- [ ] Audio/camera device selection and reconnect handling.
- [ ] Persistent Spaces messages and channel-level unread state.
- [ ] Mentions, channel pins, roles and permissions.
- [ ] Invite management and moderation audit log.

Acceptance: calling diagnostics reveal no private network identifiers to other participants; Space permissions are enforced server-side.

### M6 — Android parity (P2)
- [ ] Editing, forwarding, starring, pinning and message search.
- [ ] Draft persistence and offline outbox.
- [ ] Profile sharing and linked-device management.
- [ ] Notification and privacy preferences.
- [ ] Spaces and call feature parity where supported.

Acceptance: a shared cross-platform behavior matrix passes for core messaging, identity, privacy and delivery flows.

## Release gates
- No plaintext message body, search token or unencrypted outbox payload in Firestore.
- No fake-success UI for failed or queued operations.
- No dummy cryptographic keys or silent downgrade paths.
- Firestore emulator tests cover every new authorization path.
- Browser unit/E2E tests and Android tests pass.
- Version strings, README, architecture docs and release notes agree.
- Every checkbox above is updated only after implementation and verification.
