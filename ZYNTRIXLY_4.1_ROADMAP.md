# Zyntrixly 4.1 — The Daily Driver Update

> Status: Engineering roadmap and implementation tracker  
> Target branch: `feat/zyntrixly-4.1-qol`  
> Baseline audited: 2026-11-15  
> Release principle: ship reliable, verifiable behavior before expanding the feature count.

## Product objective

Make Zyntrixly a dependable everyday messaging platform without weakening its privacy-first identity model. The 4.1 release prioritizes truthful delivery states, dependable offline behavior, findability, conversation organization, usable device controls, and web/Android consistency.

This document is the implementation source of truth. A feature is not complete because a button, screen, helper class, or optimistic toast exists. It is complete only when the end-to-end behavior works, failure states are honest, the privacy model is preserved, and tests cover the important paths.

## Repository baseline

Repositories audited:

- Web: [zyntrix-kernel/Zyntrixly](https://github.com/zyntrix-kernel/Zyntrixly)
- Android: [zyntrix-kernel/Zyntrixly-android](https://github.com/zyntrix-kernel/Zyntrixly-android)

The web app already has a large baseline: DM/group messaging, replies, reactions, edits, deletes, forwarding, starring, chat pin/mute/archive, local drafts, voice notes, attachments, WebRTC calls, a command palette, Spaces UI, and an on-device catch-up module.

The Android project already has authentication, DM/group chat, reactions, replies, group management and archive behavior, but it is behind the web experience.

### Audit findings to keep visible

| Finding | 4.1 handling |
|---|---|
| DM send could generate a dummy recipient key after a lookup failure | Fixed on this branch: fail closed; never create undecryptable ciphertext. |
| A failed send could render a local bubble and say it was sent | Fixed on this branch: restore the draft and report that delivery failed. |
| Spaces composer rendered a local-only message as if it had been sent | Fixed on this branch: do not claim delivery until durable encrypted channel persistence exists. |
| DM discovery could display fabricated demo users | Fixed on this branch: show real search results or an explicit error/empty state. |
| Empty catch-up AI input could be replaced with fabricated conversation messages | Fixed on this branch: show a truthful empty state. |
| `src/messaging/MessagePipeline.js`, `src/search/SearchIndex.js`, `src/account/DeviceManager.js`, and `src/storage/EncryptedBlobEngine.js` are not loaded by the current web shell | Integrate deliberately after contracts, storage guarantees and tests are established. |
| Existing outbox helper stores a `text` field in IndexedDB | Do not connect it to production sends until local-at-rest encryption and migration behavior are designed. |
| Current conversation search filters messages already rendered in the DOM | Replace with incremental local search over decrypted-on-device history. |
| Device pairing/revocation functions and visible sample device controls are placeholders | Replace with real registration, pairing, listing, revocation and current-device protection. |
| Starred-message view shows a generic encrypted label rather than the actual decrypted item | Implement local decryption and navigation back to the source message. |
| Spaces channel send path had no persisted delivery path | Implement Firestore persistence, membership/role checks and real MLS integration before enabling send UI. |
| Package/config/docs still describe version 2.0 while the UI displays 4.0.0 | Reconcile version metadata only at the release-candidate stage; avoid advertising an unfinished 4.1 release. |

### Existing work that must not be duplicated

- Open PR [#10 — FCM push notifications](https://github.com/zyntrix-kernel/Zyntrixly/pull/10) already proposes foreground/background Firebase Cloud Messaging support. Review its permission flow, service-worker compatibility, token lifecycle, notification privacy and configuration before merging or replacing it. Notification payloads must never contain plaintext message bodies by default.
- Open PR [#9](https://github.com/zyntrix-kernel/Zyntrixly/pull/9) concerns removal of development leftovers. Review its status independently.

---

# Milestone 0 — Reliability and truthfulness

**Priority: P0 · First**

- [x] **R0.1 — Fail closed on missing recipient public keys.** Never generate a dummy recipient key. Surface a retryable, understandable error when the recipient key cannot be fetched or is missing.
- [x] **R0.2 — Honest failed-send behavior.** Do not show an unacknowledged message as sent. Restore the failed message into the correct chat draft, including when the user navigates away while the request is pending.
- [x] **R0.3 — Remove fake Spaces send success.** Keep the composer text intact and explain that channel delivery is unavailable until the real encrypted persistence path exists.
- [x] **R0.4 — Remove fabricated discovery results.** Failed user lookup must show an error; successful empty lookup must show “No users found”.
- [x] **R0.5 — Remove fabricated catch-up content.** Empty conversations must produce an empty state, never synthetic messages attributed to a user or system.
- [ ] **R0.6 — Idempotent message submission.** Generate a stable client message ID before transmission; persist it with the encrypted message; retry with the same ID; deduplicate on the receiver and sender clients.
- [ ] **R0.7 — Explicit delivery state machine.** Use one model across web and Android: draft → queued → sending → sent → delivered → read, with failed/retryable states. “Sent” requires server acknowledgement.
- [ ] **R0.8 — Error taxonomy.** Distinguish offline, permission denied, missing key, invalid ciphertext, rate limiting and transient server errors without leaking sensitive data.
- [ ] **R0.9 — Remove remaining demo/fallback success paths.** Audit every toast, local optimistic row, fallback identity and placeholder action for claims unsupported by persisted state.

### Acceptance criteria

- A missing recipient key never results in a Firestore message write.
- A failed send never displays a delivered/sent state.
- The message text is recoverable after a failed send or navigation.
- Retrying a request cannot create duplicate messages when the original write succeeded but its acknowledgement was lost.
- Empty search and empty AI states contain no invented people or messages.

---

# Milestone 1 — Offline-first messaging

**Priority: P0**

- [ ] **OF1 — Integrate the messaging pipeline behind a single send API.** Keep the existing DM/group UI entry points, but route them through one tested service.
- [ ] **OF2 — Encrypt the outbox at rest.** Store only encrypted payloads and the minimum metadata required to retry. Never persist plaintext message bodies, replies, or file keys in IndexedDB.
- [ ] **OF3 — Add schema/versioned storage migrations.** Migrate old records safely; do not silently reinterpret plaintext records as encrypted records.
- [ ] **OF4 — Durable queue lifecycle.** Persist queued, sending, retryable-failed and acknowledged states; recover stale “sending” items after restart.
- [ ] **OF5 — Network recovery.** Flush in order with bounded exponential backoff, jitter and a concurrency limit.
- [ ] **OF6 — Per-message retry/cancel.** Provide controls in the UI without creating duplicate writes.
- [ ] **OF7 — Connection status.** Show online, reconnecting and offline states without claiming connectivity based only on a stale presence field.
- [ ] **OF8 — Attachment recovery.** Resume eligible uploads from encrypted chunks or restart safely; never reuse an AES-GCM IV with the same key.
- [ ] **OF9 — Storage manager.** Show local cache usage, clearable caches and protected data categories; never delete key material as a side effect of cache cleanup.

### Acceptance criteria

- Refresh, browser restart and transient disconnection do not lose queued messages.
- The outbox contains no plaintext message content or raw file decryption keys.
- A reconnect does not produce duplicate sends.
- Queue failures remain visible and manually retryable.
- Cache deletion never deletes the user's only usable encryption-key backup.

---

# Milestone 2 — Smart Inbox and conversation management

**Priority: P1**

- [ ] **IN1 — Inbox filters:** All, Unread, Personal, Groups, Favorites and Archived.
- [ ] **IN2 — Accurate unread counts:** derive counts from message/read state, not a binary 0/1 last-message badge.
- [ ] **IN3 — Mark as unread:** per-conversation unread marker that survives navigation and syncs only where the user expects it.
- [ ] **IN4 — First unread jump:** open the conversation at the first unread item and preserve the current scroll position.
- [ ] **IN5 — Custom folders:** create, rename, reorder and delete folders; assign conversations locally first, with optional account sync later.
- [ ] **IN6 — Conversation sort:** recent activity, alphabetical, unread-first and custom order.
- [ ] **IN7 — Snooze:** mute until a chosen time; expire snoozes automatically and show the next unmute time.
- [ ] **IN8 — Separate pin and favorite semantics:** pinned means priority placement; favorite means a user-curated collection.
- [ ] **IN9 — Archive manager:** filter, search, restore and bulk-manage archived chats.
- [ ] **IN10 — Draft indicators:** show conversations with unsent drafts and allow opening the draft directly.
- [ ] **IN11 — Recent conversations and quick switcher:** keyboard navigation with predictable focus behavior.
- [ ] **IN12 — Empty states:** meaningful next actions for empty inboxes, folders and search results.

### Acceptance criteria

- Unread state is consistent after refresh and across devices where sync is supported.
- Muted/snoozed chats do not produce ordinary notification alerts.
- Folder operations never change group membership or server authorization.
- Pin, favorite, archive and mute remain independent preferences.

---

# Milestone 3 — Search, bookmarks and message navigation

**Priority: P1**

- [ ] **SR1 — Load and integrate the existing local SearchIndex only after its data contract is updated.**
- [ ] **SR2 — Index decrypted messages in memory on the client; persist only encrypted source material and non-sensitive indexing metadata where justified.**
- [ ] **SR3 — Search all locally available history, not just currently rendered DOM rows.**
- [ ] **SR4 — Incremental history loading and indexing with cancellation and progress.**
- [ ] **SR5 — Filters:** sender, conversation, date range, attachment type and exact phrase.
- [ ] **SR6 — Search result context:** decrypted snippet, sender, date, conversation and attachment type.
- [ ] **SR7 — Jump to original:** open the source conversation, load the relevant page and focus the target message.
- [ ] **SR8 — Search history:** optional, local-only, clearable and disabled in private sessions.
- [ ] **SR9 — Starred Messages repair:** decrypt the saved message using the normal conversation key path; show content only after successful local decryption.
- [ ] **SR10 — Bookmark collections:** personal labels such as Read later, Important and Work; keep bookmarks private to the account.
- [ ] **SR11 — Copy message link:** authenticated deep link to a conversation/message, with no plaintext content in the URL.
- [ ] **SR12 — Message context window:** include neighboring messages when jumping to search results.

### Acceptance criteria

- Search works across history after incremental loading.
- Search queries and plaintext index contents never leave the device.
- A missing key produces a clear locked/unavailable result, not a misleading blank result.
- Search and bookmark navigation cannot expose conversations the current user is not authorized to read.

---

# Milestone 4 — Composer and attachment experience

**Priority: P1**

- [ ] **CP1 — Multi-attachment selection with per-file preview and removal.**
- [ ] **CP2 — Drag-and-drop and paste-to-attach.**
- [ ] **CP3 — Upload progress, cancel, retry and failure reason.**
- [ ] **CP4 — Validate MIME type, extension, size and decoded content; treat filenames as untrusted text.**
- [ ] **CP5 — Image preview and optional client-side crop before encryption.**
- [ ] **CP6 — Voice-note waveform and duration display.**
- [ ] **CP7 — Voice-note playback speed and seek controls.**
- [ ] **CP8 — Keyboard shortcut reference and composer focus management.**
- [ ] **CP9 — Optional link previews, disabled by default.** Any preview fetch must be explicit, privacy-reviewed and avoid server-side requests that reveal conversation URLs.
- [ ] **CP10 — Reliable draft recovery**, including reply context and staged attachments where safe.
- [ ] **CP11 — Attachment gallery:** images, videos, documents and audio grouped by conversation.
- [ ] **CP12 — Clear file transfer limits and storage estimates before sending.**

### Acceptance criteria

- User can inspect and remove selected files before transmission.
- Upload failure never loses the original file selection without telling the user.
- Ciphertext and key material are handled separately; decryption keys are never included in a remote preview request.
- Keyboard-only and touch interaction both remain usable.

---

# Milestone 5 — Identity, onboarding and user controls

**Priority: P1**

- [ ] **ID1 — Real profile screen:** display name, username, bio, avatar and accent color.
- [ ] **ID2 — Username availability validation** with race-safe reservation on the backend.
- [ ] **ID3 — Shareable profile URL and QR.** Resolve to a profile preview, not an automatic conversation or contact import.
- [ ] **ID4 — Contact request flow:** accept, decline, block and revoke.
- [ ] **ID5 — Invite links:** secure random token, hashed server-side, expiry, usage limit and revocation.
- [ ] **ID6 — Recent contacts and discoverable communities.**
- [ ] **ID7 — Blocked-users manager and abuse/report workflow.**
- [ ] **ID8 — First-run onboarding:** explain identity, encryption-key recovery, device linking and notification privacy.
- [ ] **ID9 — No forced phone-number or address-book import.**

### Acceptance criteria

- Profile and invite previews reveal only public fields.
- Invitation secrets are not stored in plaintext on the server.
- Username creation is atomic and uniqueness is enforced server-side.
- Blocking and contact requests are enforced by database rules, not merely hidden in the UI.

---

# Milestone 6 — Privacy and linked-device management

**Priority: P0 for device security; P1 for preferences**

- [ ] **DV1 — Real device registration:** stable per-install ID, device name, key version, created time, last active time and revocation status.
- [ ] **DV2 — Device list:** render only actual device documents; remove sample/mock device rows.
- [ ] **DV3 — Safe revocation:** confirm the target device, revoke its trust state, reject future key use and refresh the device list.
- [ ] **DV4 — Current-device protection:** do not accidentally revoke the device currently performing the action without a clear sign-out/recovery path.
- [ ] **DV5 — QR pairing protocol:** authenticated short-lived challenge, QR expiry, user confirmation on both devices, key fingerprint verification and replay protection.
- [ ] **DV6 — Pairing cancellation and expiry.**
- [ ] **DV7 — Key-change warning and re-verification flow.**
- [ ] **DV8 — Privacy controls:** presence, last seen, read receipts, typing indicators and per-chat overrides.
- [ ] **DV9 — Disappearing-message retention policy:** local deletion behavior, remote deletion semantics, backups and limitations clearly documented.
- [ ] **DV10 — Security activity history:** show meaningful device and key events without exposing secrets.
- [ ] **DV11 — Notification privacy:** generic content by default; per-device opt-in for any richer preview must be explicit.
- [ ] **DV12 — Audit Firestore rules and emulator tests for every new path.**

### Acceptance criteria

- A user cannot revoke another user's device.
- Revoked devices cannot silently become trusted again.
- Pairing is bound to a short-lived challenge and both devices verify the same identity.
- No QR payload contains a private key or raw recovery secret.
- Notification payloads do not contain plaintext message bodies by default.

---

# Milestone 7 — Calling quality

**Priority: P2**

- [ ] **CL1 — Local call history:** missed, incoming, outgoing, declined and failed.
- [ ] **CL2 — Incoming-call notification and lifecycle cleanup.**
- [ ] **CL3 — Audio input/output selection where supported.**
- [ ] **CL4 — Camera selection and preview controls.**
- [ ] **CL5 — Connection diagnostics:** round-trip time, packet loss and jitter where the browser exposes them.
- [ ] **CL6 — Reconnection and ICE restart behavior with bounded retries.**
- [ ] **CL7 — Picture-in-picture where supported.**
- [ ] **CL8 — Group participant controls and clear host/moderator permissions.**
- [ ] **CL9 — Call-state cleanup on navigation, sign-out and tab closure.**
- [ ] **CL10 — Accessibility labels for all media controls.**

### Acceptance criteria

- Call diagnostics are shown only to the local user unless explicit sharing is enabled.
- Failure and reconnect states are visible and do not leave stale microphone/camera tracks running.
- Call history remains local unless the user explicitly exports it.

---

# Milestone 8 — Spaces that actually persist

**Priority: P0 before enabling channel composer; P2 for expansion**

- [ ] **SP1 — Define one canonical channel-message schema.**
- [ ] **SP2 — Persist encrypted messages in `spaces/{spaceId}/channels/{channelId}/messages`.**
- [ ] **SP3 — Use the actual MLS engine for group key management; do not label locally rendered plaintext as MLS-encrypted.**
- [ ] **SP4 — Confirm membership and channel permissions on the server for every read/write.**
- [ ] **SP5 — Message listeners with pagination and cleanup.**
- [ ] **SP6 — Per-channel unread markers and notification preferences.**
- [ ] **SP7 — Mentions with role/permission checks and user-level suppression.**
- [ ] **SP8 — Pinning, search and bookmarks for channel messages.**
- [ ] **SP9 — Role and permission editor with explicit deny/allow precedence.**
- [ ] **SP10 — Invite creation, expiry, usage limits and revocation.**
- [ ] **SP11 — Moderation/activity log with minimal metadata.**
- [ ] **SP12 — Community discovery and preview with privacy-safe public metadata only.**

### Acceptance criteria

- No channel send UI reports success before a real persisted, encrypted write is acknowledged.
- Non-members cannot fetch channel history, including through subcollections.
- Client-side role checks are convenience only; Firestore rules enforce authorization.
- MLS epoch rotation is atomic with membership changes and tested on member add/remove.

---

# Milestone 9 — Personalization and accessibility

**Priority: P2**

- [ ] **UX1 — Compact/comfortable density.**
- [ ] **UX2 — Font size and message width controls.**
- [ ] **UX3 — Reduced motion and high-contrast modes.**
- [ ] **UX4 — Custom accent and chat wallpaper with readable contrast.**
- [ ] **UX5 — Per-chat appearance overrides.**
- [ ] **UX6 — Notification sound preferences and quiet hours.**
- [ ] **UX7 — Keyboard navigation and visible focus states.**
- [ ] **UX8 — Screen-reader labels and semantic live-region announcements.**
- [ ] **UX9 — Consistent 44px minimum touch targets on mobile.**
- [ ] **UX10 — Responsive layouts for small screens, tablets and desktop.**

### Acceptance criteria

- Color is not the only way status is communicated.
- Reduced-motion mode removes non-essential transitions.
- Dialogs trap focus and restore focus on close.
- Keyboard shortcuts never intercept text entry unexpectedly.

---

# Milestone 10 — Android feature parity

**Priority: P1 for core messaging; P2 for advanced features**

The Android app must share behavior and data semantics with the web app. Native UI can differ, but user-visible messaging behavior must not.

- [ ] **AND1 — Shared delivery states and idempotent message IDs.**
- [ ] **AND2 — Draft persistence per conversation.**
- [ ] **AND3 — Message edit and forward actions with the same authorization semantics.**
- [ ] **AND4 — Starred/bookmarked messages and navigation to source.**
- [ ] **AND5 — Search in conversation and across locally available history.**
- [ ] **AND6 — Accurate unread counts and mark-as-unread.**
- [ ] **AND7 — Pin, mute, archive and snooze parity.**
- [ ] **AND8 — Offline encrypted outbox and retry controls.**
- [ ] **AND9 — Profile sharing and QR preview.**
- [ ] **AND10 — Linked-device listing, pairing and revocation.**
- [ ] **AND11 — Voice-note and attachment handling parity.**
- [ ] **AND12 — Spaces channel persistence and membership controls.**
- [ ] **AND13 — Notification privacy and preferences.**
- [ ] **AND14 — Android UI tests for message lifecycle, navigation and accessibility.**

### Acceptance criteria

- Web and Android decrypt the same message payloads and interpret the same delivery state.
- A feature is not marked cross-platform complete until both platforms have tests.
- Platform-specific fallback behavior is documented and never silently weakens encryption.

---

## Shared engineering standards

### Privacy and security

1. Plaintext message content and raw file keys stay on the client and in memory wherever possible.
2. Never store plaintext message bodies, private keys or raw recovery secrets in Firestore.
3. Local persistent message/outbox data must be encrypted before production use.
4. Never generate substitute identities or recipient keys after a failed lookup.
5. Treat names, filenames, profile fields, message text and URLs as untrusted input.
6. Firestore rules are the authority for access control; client checks are not security boundaries.
7. Notification payloads must be generic by default.
8. Every key/epoch/device change must have explicit, tested lifecycle semantics.

### Performance

- Paginate message history and attachments.
- Debounce search; cancel stale searches.
- Avoid full collection scans for user discovery.
- Virtualize long conversation and search-result lists.
- Avoid repeated cryptographic key imports for every message where safe caching is possible.
- Measure startup, chat-open, search and send latency on both mobile and desktop.

### Testing strategy

- [ ] Unit tests for delivery-state transitions and outbox retry.
- [ ] Unit tests for message ID idempotency.
- [ ] Unit tests for search tokenization, filtering and clear-index behavior.
- [ ] Crypto tests for local outbox encryption/decryption and migration.
- [ ] Firestore Emulator tests for all new collection and subcollection rules.
- [ ] Web E2E tests for inbox, search, composer, failed sends and device settings.
- [ ] Android unit/UI tests for the same core user journeys.
- [ ] Offline/online transition tests, including tab/app restart.
- [ ] Accessibility checks for keyboard, touch and screen-reader paths.
- [ ] Regression test that proves fake users/messages and false-success paths cannot return.

The existing repository reports a 52-test suite. Preserve all baseline tests and add new tests; do not weaken or remove assertions merely to make a feature pass.

## Release gates

A 4.1 release candidate is not ready until:

- [ ] All P0 requirements pass.
- [ ] Core web and Android message flows pass.
- [ ] Firestore Emulator rules tests cover all new paths.
- [ ] Offline outbox is encrypted at rest and idempotent.
- [ ] Spaces sends are genuinely encrypted and persisted, or the send UI remains unavailable.
- [ ] Device management is functional and pairing has replay/expiry protection.
- [ ] No known false-success UI remains.
- [ ] Privacy review is complete for push notifications and any external preview fetch.
- [ ] Version numbers, README, architecture docs and UI agree.
- [ ] Release notes describe shipped behavior only.

## Suggested implementation order

1. Finish Milestone 0 and add regression tests.
2. Build the encrypted outbox and idempotent send contract.
3. Implement accurate read/unread state and Smart Inbox.
4. Integrate full local search and repair Starred Messages.
5. Deliver composer and attachment improvements.
6. Implement real device registration and QR pairing.
7. Bring Android core messaging to parity.
8. Implement real Spaces persistence and MLS integration.
9. Improve calling, personalization and advanced productivity.
10. Complete privacy review, documentation and release gates.

## Work tracking

Use the task IDs above in issues and pull requests. Every PR should state:

- Task IDs completed.
- User-visible behavior changed.
- Data/schema/rules changes.
- Privacy/security implications.
- Tests added and commands actually run.
- Known limitations and rollback plan.

Never mark a task complete solely because code was committed.