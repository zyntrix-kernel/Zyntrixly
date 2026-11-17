# Zyntrixly V5 · Master Product Pass

> Release train: 5.0.0 · Status: implementation in progress; review and runtime verification required.

V5 is a cohesive daily-driver upgrade, not a cosmetic version bump. The target is a calm,
predictable, keyboard-first messaging product with strong privacy boundaries and honest
delivery semantics.

## Delivered in this implementation branch

- [x] V5 experience module separated from the legacy app shell.
- [x] Smart Inbox filters: All, Unread, Pinned, Drafts and Groups.
- [x] Device-local preferences for inbox filter, density, reduced motion and focus mode.
- [x] Keyboard command palette on Ctrl/⌘ + K with chat, command and local-message results.
- [x] Jump-to-message navigation from the decrypted in-memory search index.
- [x] Clipboard image paste and drag/drop attachment staging using the existing one-file path.
- [x] Honest Spaces send feedback while persistent channel messaging is not connected.
- [x] Failed text sends keep the draft and do not render a fake successful local bubble.
- [x] DM send fails closed if the recipient public key cannot be retrieved.
- [x] V5 unit test suite added and registered.
- [x] Package and visible app version advanced to 5.0.0.

These items are implemented in this branch but remain subject to runtime verification.

## V5 quality bar

### Product feel
- Consistent hierarchy, restrained surfaces, intentional motion and responsive touch targets.
- Command palette supports keyboard and pointer navigation.
- Smart Inbox state persists on the same browser profile.
- Focus mode hides navigation only while a conversation is active.
- Reduced-motion preference overrides non-essential animation.

### Messaging correctness
- A failed network write is not a delivered message.
- Draft text is retained when sending fails.
- Attachment staging is one file at a time and obeys the existing 900 KB cap.
- Missing recipient keys never trigger generated placeholder identities.
- Message search remains local and is cleared from memory on sign-out.

### Privacy and honesty
- Search terms and decrypted message text are not sent to Firestore by the V5 experience layer.
- Search scope is only messages decrypted in the current browser session.
- Existing local drafts and some legacy local previews are not encrypted at rest. Do not market them as encrypted.
- The legacy offline outbox is not wired into sending because it stores plaintext payloads.
- Spaces channel messages are not yet persisted; V5 does not show a fake sent bubble.

## Explicitly not complete / gated before a production V5 release

- [ ] Encrypted local drafts and offline outbox with audited key lifecycle.
- [ ] Idempotent server writes and duplicate protection for retries.
- [ ] True unread message counts and first-unread navigation; current inbox unread state is conversation-level and inherited from the last-message marker.
- [ ] Historical search backfill for unopened conversations.
- [ ] Persisted Spaces messages, server-side membership enforcement and emulator tests.
- [ ] Real multi-device pairing, key transfer and revocation protocol.
- [ ] Starred-message decryption/navigation audit.
- [ ] Attachment progress, cancellation, retry and multi-file selection.
- [ ] Android V5 feature parity.
- [ ] Browser E2E, Firebase emulator and Android test execution.

## Release gates

1. Run npm run test:unit, npm run test:syntax, npm run test:e2e and the full npm test suite.
2. Validate keyboard flows, focus behavior, mobile layout and assistive technology navigation.
3. Test DM failures with missing recipient documents, unavailable keys, offline state and Firestore permission errors.
4. Confirm no plaintext message body or search token is written by V5 to Firestore or IndexedDB.
5. Verify Spaces messaging, offline delivery, linked devices and Android parity before claiming them as shipped.
6. Reconcile README, package version, manifest/cache versioning and release notes before tagging 5.0.0.
