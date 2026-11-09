// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/groups/GroupManager.js
//  Group Roles, Cryptographic Invitations & Epoch Rotation
// ════════════════════════════════════════════════

const ZxGroupManager = (() => {
  const ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    MEMBER: 'member',
    RESTRICTED: 'restricted'
  };

  /**
   * Hashes an invitation token string using SHA-256
   */
  async function hashToken(token) {
    const subtle = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).subtle;
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies if caller has sufficient role to perform an action
   */
  function hasPermission(roles, uid, minRole = ROLES.ADMIN) {
    if (!roles || !uid) return false;
    const userRole = roles[uid];
    if (!userRole) return false;

    if (userRole === ROLES.OWNER) return true;
    if (minRole === ROLES.ADMIN) return userRole === ROLES.ADMIN;
    if (minRole === ROLES.MODERATOR) return userRole === ROLES.ADMIN || userRole === ROLES.MODERATOR;
    if (minRole === ROLES.MEMBER) return userRole !== ROLES.RESTRICTED;
    return true;
  }

  /**
   * Generates a revocable, expiring group invitation
   */
  async function createInvitation(groupId, { maxUses = 10, expiresInHours = 168, createdBy }) {
    if (!groupId || !createdBy) throw new Error('Missing groupId or createdBy');
    const bytes = (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(new Uint8Array(16));
    const rawSecret = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await hashToken(rawSecret);
    const expiresAt = Date.now() + (expiresInHours * 60 * 60 * 1000);

    const inviteData = {
      inviteId: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      groupId,
      tokenHash,
      createdBy,
      createdAt: Date.now(),
      expiresAt,
      maxUses,
      useCount: 0,
      revoked: false
    };

    // Link string format: groupId + ":" + rawSecret
    const inviteLink = `zyntrixly://invite/${groupId}/${rawSecret}`;
    return { inviteData, inviteLink, rawSecret };
  }

  /**
   * Validates an invitation token against invitation document
   */
  async function validateInvitation(inviteDoc, rawSecret) {
    if (!inviteDoc || inviteDoc.revoked) return { valid: false, reason: 'Invitation revoked or invalid' };
    if (Date.now() > inviteDoc.expiresAt) return { valid: false, reason: 'Invitation has expired' };
    if (inviteDoc.maxUses > 0 && inviteDoc.useCount >= inviteDoc.maxUses) {
      return { valid: false, reason: 'Invitation use limit reached' };
    }
    const computedHash = await hashToken(rawSecret);
    if (computedHash !== inviteDoc.tokenHash) {
      return { valid: false, reason: 'Invalid invitation secret token' };
    }
    return { valid: true };
  }

  /**
   * Executes a group key epoch rotation when membership changes
   */
  async function rotateGroupEpoch(groupDoc, remainingPublicKeys, callerUid) {
    const cryptoEngine = typeof Crypto !== 'undefined' ? Crypto : (typeof window !== 'undefined' ? window.Crypto : null);
    if (!cryptoEngine) throw new Error('Crypto engine unavailable for epoch rotation');

    const nextEpochId = (groupDoc.currentEpoch || 1) + 1;
    const epochBundle = await cryptoEngine.generateGroupEpoch(nextEpochId, remainingPublicKeys);

    return {
      nextEpochId,
      epochBundle,
      rotatedAt: Date.now(),
      rotatedBy: callerUid
    };
  }

  return {
    ROLES,
    hasPermission,
    createInvitation,
    validateInvitation,
    rotateGroupEpoch,
    hashToken
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxGroupManager;
}
if (typeof window !== 'undefined') {
  window.ZxGroupManager = ZxGroupManager;
}
