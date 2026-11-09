const test = require('node:test');
const assert = require('node:assert');
const { SpaceManager, Permissions, ChannelTypes } = require('../src/spaces/SpaceManager.js');

test('SPACE-01: Community Space Creation & Channel Defaults', () => {
  const sm = new SpaceManager();
  const space = sm.createSpace({
    name: 'Zyntrix Core Builders',
    ownerId: 'user_founder',
    icon: '🚀'
  });

  assert.ok(space.id, 'Space ID generated');
  assert.strictEqual(space.name, 'Zyntrix Core Builders');
  assert.strictEqual(space.ownerId, 'user_founder');
  assert.strictEqual(space.channels.length, 4, '4 default channels initialized');

  const channelTypes = space.channels.map(c => c.type);
  assert.ok(channelTypes.includes(ChannelTypes.TEXT));
  assert.ok(channelTypes.includes(ChannelTypes.ANNOUNCEMENT));
  assert.ok(channelTypes.includes(ChannelTypes.VOICE_STAGE));
  assert.ok(channelTypes.includes(ChannelTypes.CANVAS));
});

test('SPACE-02: 64-bit RBAC Permission Bitfields & Channel Overwrites', () => {
  const sm = new SpaceManager();
  const space = sm.createSpace({
    name: 'Security Ops',
    ownerId: 'user_admin'
  });

  const annChannel = space.channels.find(c => c.type === ChannelTypes.ANNOUNCEMENT);
  assert.ok(annChannel);

  // 1. Owner has all permissions in all channels
  const ownerCanSendInAnn = sm.hasPermission('user_admin', space.id, Permissions.SEND_MESSAGES, annChannel.id);
  assert.strictEqual(ownerCanSendInAnn, true, 'Owner has send permissions in announcement channel');

  // 2. Regular member permissions in announcement channel (SEND_MESSAGES is denied by overwrite)
  const regularMember = 'user_guest';
  space.members.push(regularMember);
  space.memberRoles[regularMember] = ['everyone'];

  const guestCanViewAnn = sm.hasPermission(regularMember, space.id, Permissions.VIEW_SPACE, annChannel.id);
  assert.strictEqual(guestCanViewAnn, true, 'Guest can view announcement channel');

  const guestCanSendInAnn = sm.hasPermission(regularMember, space.id, Permissions.SEND_MESSAGES, annChannel.id);
  assert.strictEqual(guestCanSendInAnn, false, 'Guest is denied send permissions in announcement channel by overwrite');

  // 3. Promote regular member to moderator
  space.memberRoles[regularMember].push('moderator');
  const modCanAnnounce = sm.hasPermission(regularMember, space.id, Permissions.SEND_ANNOUNCEMENTS, annChannel.id);
  assert.strictEqual(modCanAnnounce, true, 'Moderator can send announcements');
});

test('SPACE-03: Context Switching & Dynamic Channel Addition', () => {
  const sm = new SpaceManager();
  const space = sm.createSpace({ name: 'Dev Space', ownerId: 'user1' });

  const customChannel = sm.addChannel(space.id, {
    name: 'rfcs',
    type: ChannelTypes.FORUM,
    topic: 'Architecture proposals'
  });

  assert.strictEqual(customChannel.name, 'rfcs');
  assert.strictEqual(customChannel.type, ChannelTypes.FORUM);

  const nav = sm.setActiveContext(space.id, customChannel.id);
  assert.strictEqual(nav.activeSpaceId, space.id);
  assert.strictEqual(nav.activeChannelId, customChannel.id);
});
