# Zyntrixly 5.0.0 · Release notes

## Daily-driver experience
- Smart Inbox views for unread, pinned, draft and group conversations.
- Global command palette for conversations, commands and local message search.
- Jump directly to a matching message from the command palette.
- Compact density, reduced motion and focus mode preferences.
- Paste an image or drop a file to stage an attachment.

## Frontend foundation
- Smart Inbox, search shortcuts and the command palette now use genuine shadcn/ui React components.
- Tailwind compiles the shadcn component styles into a production bundle.
- Legacy authentication, settings and older dialogs remain to be migrated.

## Reliability and trust
- Failed message writes no longer create a fake “sent locally” message bubble.
- Failed sends preserve the text draft.
- Recipient public-key lookup fails closed; no random replacement identity key is generated.
- Spaces sends explain that persistent channel delivery is not yet connected.

## Scope notes
- Message search is session-local and limited to conversations decrypted in the current browser session.
- One attachment is staged at a time, retaining the existing 900 KB transfer cap.
- Encrypted offline outbox, persisted Spaces messaging, linked-device pairing, full historical search and Android parity remain gated.
- Runtime test execution is pending.
