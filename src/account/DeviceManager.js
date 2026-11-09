// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/account/DeviceManager.js
//  Multi-Device Management, Pairing & Account Shredding
// ════════════════════════════════════════════════

const ZxDeviceManager = (() => {
  /**
   * Registers current device in user's private device subcollection
   */
  async function registerDevice(db, uid, deviceIdentity) {
    if (!db || !uid || !deviceIdentity || !deviceIdentity.deviceId) return;
    const docRef = db.collection('users').doc(uid).collection('devices').doc(deviceIdentity.deviceId);
    await docRef.set({
      deviceId: deviceIdentity.deviceId,
      deviceName: deviceIdentity.deviceName || 'Web Browser',
      publicKeyJwk: deviceIdentity.publicKeyJwk,
      keyVersion: deviceIdentity.keyVersion || 2,
      createdAt: (typeof firebase !== 'undefined' && firebase.firestore)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : Date.now(),
      lastActiveAt: Date.now(),
      trustStatus: 'trusted',
      revoked: false
    }, { merge: true });
  }

  /**
   * Lists all active devices for account
   */
  async function listDevices(db, uid) {
    if (!db || !uid) return [];
    const snap = await db.collection('users').doc(uid).collection('devices').get();
    const devices = [];
    snap.forEach(doc => {
      devices.push({ id: doc.id, ...doc.data() });
    });
    return devices;
  }

  /**
   * Revokes a device remotely
   */
  async function revokeDevice(db, uid, targetDeviceId) {
    if (!db || !uid || !targetDeviceId) return;
    const docRef = db.collection('users').doc(uid).collection('devices').doc(targetDeviceId);
    await docRef.update({
      revoked: true,
      trustStatus: 'revoked',
      revokedAt: Date.now()
    });
  }

  /**
   * Initiates a verified out-of-band QR pairing session
   */
  function createPairingSession(uid, primaryPublicKey) {
    const rand = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(16));
    const sessionId = 'pair_' + Array.from(rand.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
    const challenge = Array.from(rand.slice(8, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
    const payload = JSON.stringify({
      v: 2,
      uid,
      sessionId,
      challenge,
      primaryPublicKeyFingerprint: primaryPublicKey?.n ? primaryPublicKey.n.substring(0, 20) : null,
      ts: Date.now()
    });
    return {
      sessionId,
      challenge,
      pairingPayload: payload,
      qrString: `zyntrixly://pair?session=${sessionId}&uid=${uid}`
    };
  }

  /**
   * Clean cryptographic account shredding & deletion
   */
  async function shredAccount(db, uid) {
    if (!db || !uid) return;

    // 1. Shred local cryptographic vault
    if (typeof ZxStorage !== 'undefined') {
      await ZxStorage.shredAllLocalData();
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}

    // 2. Tombstone user profile in Firestore
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      uid,
      username: 'deleted_user',
      displayName: 'Deleted User',
      deleted: true,
      deletedAt: (typeof firebase !== 'undefined' && firebase.firestore)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : Date.now()
    });

    // 3. Delete auth account if supported
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const user = firebase.auth().currentUser;
      if (user) {
        await user.delete().catch(() => {});
      }
    }
  }

  return {
    registerDevice,
    listDevices,
    revokeDevice,
    createPairingSession,
    shredAccount
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxDeviceManager;
}
if (typeof window !== 'undefined') {
  window.ZxDeviceManager = ZxDeviceManager;
}
