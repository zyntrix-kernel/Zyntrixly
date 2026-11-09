# 🛡️ Zyntrixly 2.0 Security Architecture & Threat Model

**Status:** Authoritative Specification  
**Version:** 2.0.0  
**Classification:** Public Security Documentation

---

## 1. Security Principles

Zyntrixly 2.0 operates under four strict security axioms:

1. **Zero-Knowledge Architecture:** The server never receives, logs, or stores unencrypted message contents, attachment bytes, or private keys.
2. **Privacy Enforced by Architecture:** Message metadata is minimized; conversation previews are decrypted on the client rather than stored in plaintext on the database.
3. **Cryptographic Forward & Backward Secrecy:** Group key epochs ensure that departed members cannot decrypt future communications and new members cannot read past messages.
4. **Verifiable Trust:** Identity fingerprints and 60-digit safety numbers allow users to verify participant keys out-of-band to prevent man-in-the-middle (MITM) attacks.

---

## 2. Cryptographic Protocol Specifications

### 2.1 Key Hierarchy

| Key | Algorithm | Purpose | Storage Location |
|---|---|---|---|
| **Identity Keypair (IK)** | RSA-OAEP 2048-bit / SHA-256 | Asymmetric device identity & key exchange | Public key in `/users/{uid}/publicProfile`; Private key encrypted in local vault |
| **Session Key** | AES-256-GCM | Symmetric payload encryption for messages & attachments | Generated ephemerally per message / epoch |
| **Key Encryption Key (KEK)** | PBKDF2 (200,000 iterations, 16-byte salt, SHA-256) | Encrypts private keys for multi-device backup and recovery | Derived from user master password or 128-bit recovery key |
| **Group Epoch Key** | AES-256-GCM | Encrypts group conversation messages during epoch $N$ | Rotated upon every member addition, eviction, or leave |

### 2.2 Metadata Budget

Zyntrixly documents the exact information that the relay service necessarily learns versus what is strictly zero-knowledge:

| Data Element | Server Knowledge | Protection Mechanism |
|---|---|---|
| Message Plaintext | **Zero** | Encrypted with recipient/group public keys before dispatch |
| Message Preview (`lastMsg`) | **Zero** | Plaintext preview removed from database; client-side decrypted cache |
| File Attachments | **Zero** | Client-side AES-256-GCM encryption with client-generated IV and key |
| Reactions | Emoji identifier + UID | Validated via strict DOM sanitizer to eliminate XSS |
| Participant UIDs | Visible to relay | Required for Firestore document security rules routing |
| Message Timestamps | Visible to relay | Required for chronological synchronization |

---

## 3. Threat Model & Countermeasures

### 3.1 Malicious DM Member Insertion
- **Threat:** An attacker attempts to modify `members: ['alice', 'bob']` in a DM document to add a third party (`eve`).
- **Mitigation:** Firestore rules enforce DM membership immutability (`!request.resource.data.diff(resource.data).affectedKeys().hasAny(['members'])`). Modifying the members array is rejected by the database.

### 3.2 Group Member Eviction & Eavesdropping
- **Threat:** An evicted group member retains the group key and continues decrypting future messages.
- **Mitigation:** The `GroupManager` executes a key epoch transition (`epochId + 1`) upon member eviction. The new epoch key is encrypted exclusively for remaining members. The evicted user receives no wrapped key for subsequent epochs.

### 3.3 Reaction-Based Stored XSS
- **Threat:** A user sends an exploit payload (e.g. `<img src=x onerror=alert(1)>`) inside a reaction key.
- **Mitigation:** `renderReactions()` strictly validates emoji keys using Unicode property regex (`\p{Emoji}`) and constructs DOM text nodes via `document.createTextNode()`, eliminating all `innerHTML` interpolation vulnerabilities.

### 3.4 Key Backup Exfiltration
- **Threat:** An authenticated user queries another user's encrypted key backups.
- **Mitigation:** Subcollection `/users/{uid}/keyBackups/{backupId}` is locked to `request.auth.uid == uid`. No foreign user can read another account's key backups.

---

## 4. Responsible Disclosure Policy

If you discover a security vulnerability in Zyntrixly, please disclose it responsibly:

1. Send details via encrypted email or open a confidential security advisory on GitHub.
2. Do not publicly disclose the vulnerability until a patch has been released.
3. The security team acknowledges reports within 24 hours and provides status updates every 72 hours until resolution.
