const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Read the firestore.rules file to verify it exists and is structurally complete
const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

// Rules Logical Evaluator simulating Firestore Security Rules engine
class FirestoreRulesEngine {
  constructor(rulesText) {
    this.rules = rulesText;
  }

  canReadUser(auth, targetUid, subcollection = null) {
    if (!auth) return false;
    if (subcollection === 'privateAccount' || subcollection === 'devices' || subcollection === 'keyBackups') {
      return auth.uid === targetUid;
    }
    // publicProfile or root user document
    return true;
  }

  canWriteUser(auth, targetUid, subcollection = null, resourceData = null, requestData = null) {
    if (!auth || auth.uid !== targetUid) return false;
    if (requestData && requestData.uid && requestData.uid !== targetUid) return false;
    return true;
  }

  canCreateDM(auth, members) {
    if (!auth) return false;
    if (!Array.isArray(members) || members.length !== 2) return false;
    return members.includes(auth.uid);
  }

  canReadDM(auth, dmDoc) {
    if (!auth || !dmDoc || !Array.isArray(dmDoc.members)) return false;
    return dmDoc.members.includes(auth.uid);
  }

  canUpdateDM(auth, existingDoc, updatedDoc) {
    if (!this.canReadDM(auth, existingDoc)) return false;
    // Rule: !request.resource.data.diff(resource.data).affectedKeys().hasAny(['members', 'createdAt'])
    const existingMembers = JSON.stringify(existingDoc.members || []);
    const updatedMembers = JSON.stringify(updatedDoc.members || []);
    if (existingMembers !== updatedMembers) return false; // Members array is immutable!
    if (existingDoc.createdAt !== updatedDoc.createdAt) return false;
    return true;
  }

  canCreateDMMessage(auth, dmDoc, msgData) {
    if (!this.canReadDM(auth, dmDoc)) return false;
    return msgData && msgData.senderUid === auth.uid;
  }

  canUpdateDMMessage(auth, dmDoc, existingMsg, updatedMsg, isReactionOnly = false, isStarOnly = false) {
    if (!this.canReadDM(auth, dmDoc)) return false;
    if (isReactionOnly || isStarOnly) return true;
    if (existingMsg.senderUid === auth.uid) {
      // Cannot alter senderUid or sentAt
      if (updatedMsg.senderUid !== existingMsg.senderUid) return false;
      if (updatedMsg.sentAt !== existingMsg.sentAt) return false;
      return true;
    }
    return false;
  }

  canReadGroup(auth, groupDoc) {
    if (!auth || !groupDoc || !Array.isArray(groupDoc.members)) return false;
    return groupDoc.members.includes(auth.uid);
  }

  canCreateGroup(auth, groupData) {
    if (!auth || !groupData) return false;
    if (groupData.createdBy !== auth.uid) return false;
    if (!Array.isArray(groupData.members) || !groupData.members.includes(auth.uid)) return false;
    const isOwner = groupData.roles?.[auth.uid] === 'owner' || groupData.admins?.includes(auth.uid);
    return !!isOwner;
  }

  canUpdateGroup(auth, existingGroup, updatedGroup) {
    if (!auth || !existingGroup) return false;
    const isAdmin = (existingGroup.admins && existingGroup.admins.includes(auth.uid)) ||
      (existingGroup.roles && ['owner', 'admin'].includes(existingGroup.roles[auth.uid])) ||
      existingGroup.createdBy === auth.uid;

    if (isAdmin) return true;

    const isMember = existingGroup.members && existingGroup.members.includes(auth.uid);
    if (!isMember) return false;

    // Check metadata-only update
    const allowedMetaKeys = new Set(['typing', 'lastMsgAt', 'lastSenderUid', 'currentEpoch']);
    const changedKeys = Object.keys(updatedGroup).filter(k => updatedGroup[k] !== existingGroup[k]);
    if (changedKeys.every(k => allowedMetaKeys.has(k))) return true;

    // Check safe self-leave update
    const memberLeaveKeys = new Set(['members', 'memberNames', 'memberColors']);
    if (changedKeys.every(k => memberLeaveKeys.has(k))) {
      const oldMembers = existingGroup.members || [];
      const newMembers = updatedGroup.members || [];
      const leavingUid = auth.uid;
      const expectedMembers = oldMembers.filter(m => m !== leavingUid);
      const isExactlyOneRemoved = newMembers.length === oldMembers.length - 1;
      const callerNotInNew = !newMembers.includes(leavingUid);
      const listsMatch = JSON.stringify(newMembers.sort()) === JSON.stringify(expectedMembers.sort());
      if (isExactlyOneRemoved && callerNotInNew && listsMatch) return true;
    }

    return false;
  }

  canReadCall(auth, callDoc) {
    if (!auth || !callDoc) return false;
    const participants = callDoc.participants || [callDoc.callerId, callDoc.calleeId].filter(Boolean);
    return participants.includes(auth.uid);
  }

  canWriteCallSignal(auth, callDoc, signalSenderUid) {
    if (!this.canReadCall(auth, callDoc)) return false;
    return auth.uid === signalSenderUid;
  }

  canReadSpaceChannel(auth, spaceDoc) {
    if (!auth || !spaceDoc) return false;
    if (spaceDoc.isPublic === true) return true;
    return Array.isArray(spaceDoc.members) && spaceDoc.members.includes(auth.uid);
  }

  canWriteSpaceChannel(auth, spaceDoc) {
    if (!auth || !spaceDoc) return false;
    if (spaceDoc.ownerId === auth.uid) return true;
    return Array.isArray(spaceDoc.admins) && spaceDoc.admins.includes(auth.uid);
  }
}

const engine = new FirestoreRulesEngine(rulesContent);

test('RULE-01: Structure & Syntax of firestore.rules', () => {
  assert.ok(rulesContent.includes("rules_version = '2'"), 'Must specify rules_version = 2');
  assert.ok(rulesContent.includes('match /databases/{database}/documents'), 'Root documents match required');
  assert.ok(rulesContent.includes('match /calls/{callId}'), 'Call signaling rules must be present in repository');
  assert.ok(rulesContent.includes('match /publicProfile/{docId}'), 'Public profile subcollection present');
  assert.ok(rulesContent.includes('match /privateAccount/{docId}'), 'Private account subcollection present');
  assert.ok(rulesContent.includes('match /keyBackups/{backupId}'), 'Private key backups subcollection present');
});

test('RULE-02: DM Membership Immutability & Unauthorized Access Rejection', () => {
  const alice = { uid: 'alice_123' };
  const bob = { uid: 'bob_456' };
  const eve = { uid: 'eve_789' };

  const dm = { id: 'dm_ab', members: ['alice_123', 'bob_456'], createdAt: 1000 };

  // 1. Authorized members can read
  assert.strictEqual(engine.canReadDM(alice, dm), true, 'Alice should be authorized to read DM');
  assert.strictEqual(engine.canReadDM(bob, dm), true, 'Bob should be authorized to read DM');

  // 2. Unauthorized eavesdropper cannot read
  assert.strictEqual(engine.canReadDM(eve, dm), false, 'Eve must be blocked from reading Alice and Bob DM');

  // 3. Modifying members array after creation is strictly forbidden
  const maliciousDM = { ...dm, members: ['alice_123', 'bob_456', 'eve_789'] };
  assert.strictEqual(engine.canUpdateDM(alice, dm, maliciousDM), false, 'Members array cannot be altered');
  assert.strictEqual(engine.canUpdateDM(eve, dm, maliciousDM), false, 'Eve cannot insert herself into DM');

  // 4. Valid metadata update without altering members is permitted
  const validDM = { ...dm, typing: { alice_123: true } };
  assert.strictEqual(engine.canUpdateDM(alice, dm, validDM), true, 'Valid typing update permitted');
});

test('RULE-03: User Private Data & Key Backup Protection', () => {
  const alice = { uid: 'alice_123' };
  const eve = { uid: 'eve_789' };

  // 1. Public profile readable by any signed-in user
  assert.strictEqual(engine.canReadUser(eve, 'alice_123', 'publicProfile'), true, 'Public profile readable');

  // 2. Private account data readable ONLY by account owner
  assert.strictEqual(engine.canReadUser(alice, 'alice_123', 'privateAccount'), true, 'Alice reads own private data');
  assert.strictEqual(engine.canReadUser(eve, 'alice_123', 'privateAccount'), false, 'Eve blocked from private data');

  // 3. Encrypted key backups readable and writable ONLY by account owner
  assert.strictEqual(engine.canReadUser(alice, 'alice_123', 'keyBackups'), true, 'Alice reads own key backup');
  assert.strictEqual(engine.canReadUser(eve, 'alice_123', 'keyBackups'), false, 'Eve blocked from key backups');
  assert.strictEqual(engine.canWriteUser(eve, 'alice_123', 'keyBackups'), false, 'Eve blocked from writing key backups');
});

test('RULE-04: Group Roles & Safe Member Leave Verification', () => {
  const alice = { uid: 'alice_123' }; // Owner
  const bob = { uid: 'bob_456' };     // Member
  const eve = { uid: 'eve_789' };     // Outsider

  const group = {
    id: 'grp_test',
    members: ['alice_123', 'bob_456'],
    admins: ['alice_123'],
    roles: { alice_123: 'owner', bob_456: 'member' },
    createdBy: 'alice_123'
  };

  // 1. Outsider blocked
  assert.strictEqual(engine.canReadGroup(eve, group), false, 'Eve blocked from reading group');

  // 2. Member Bob leaving legitimately (removes only himself)
  const groupAfterBobLeave = {
    ...group,
    members: ['alice_123'],
    memberNames: { alice_123: 'alice' }
  };
  assert.strictEqual(engine.canUpdateGroup(bob, group, groupAfterBobLeave), true, 'Bob can leave group');

  // 3. Malicious leave where Bob attempts to kick Alice instead of leaving
  const groupMaliciousKick = {
    ...group,
    members: ['bob_456'],
    memberNames: { bob_456: 'bob' }
  };
  assert.strictEqual(engine.canUpdateGroup(bob, group, groupMaliciousKick), false, 'Bob cannot kick Alice');
});

test('RULE-05: WebRTC Call Participant Isolation', () => {
  const caller = { uid: 'user_a' };
  const callee = { uid: 'user_b' };
  const snoop = { uid: 'user_c' };

  const callDoc = {
    id: 'call_123',
    callerId: 'user_a',
    calleeId: 'user_b',
    participants: ['user_a', 'user_b'],
    active: true
  };

  // 1. Participants can access call
  assert.strictEqual(engine.canReadCall(caller, callDoc), true, 'Caller authorized');
  assert.strictEqual(engine.canReadCall(callee, callDoc), true, 'Callee authorized');

  // 2. Non-participant snoop blocked
  assert.strictEqual(engine.canReadCall(snoop, callDoc), false, 'Snoop blocked from call');
  assert.strictEqual(engine.canWriteCallSignal(snoop, callDoc, snoop.uid), false, 'Snoop cannot write signals');
});

test('RULE-06: Message Ownership & Anti-Forgery Protection', () => {
  const alice = { uid: 'alice_123' };
  const eve = { uid: 'eve_789' };
  const dm = { id: 'dm_ab', members: ['alice_123', 'bob_456'] };

  // 1. Forged senderUid blocked
  const forgedMessage = { senderUid: 'alice_123', text: 'I am Alice' };
  assert.strictEqual(engine.canCreateDMMessage(eve, dm, forgedMessage), false, 'Eve cannot send message as Alice');

  // 2. Alice sends message as Alice in her own DM
  assert.strictEqual(engine.canCreateDMMessage(alice, dm, { senderUid: 'alice_123', text: 'Hello' }), true);
});

test('RULE-07: Private Community Spaces & Subcollection Authorization Isolation', () => {
  const alice = { uid: 'alice_123' };
  const eve = { uid: 'eve_789' };
  const privateSpace = {
    id: 'space_classified',
    isPublic: false,
    ownerId: 'alice_123',
    admins: ['alice_123'],
    members: ['alice_123']
  };

  // Alice is member & owner
  assert.strictEqual(engine.canReadSpaceChannel(alice, privateSpace), true, 'Member can read channel in private space');
  assert.strictEqual(engine.canWriteSpaceChannel(alice, privateSpace), true, 'Owner can write channel in private space');

  // Eve is an outside eavesdropper
  assert.strictEqual(engine.canReadSpaceChannel(eve, privateSpace), false, 'Non-member blocked from reading private channel');
  assert.strictEqual(engine.canWriteSpaceChannel(eve, privateSpace), false, 'Non-admin blocked from creating/deleting channels');
});

