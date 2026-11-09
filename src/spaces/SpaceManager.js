/**
 * ZYNTRIXLY 3.0 APEX - Spaces & Communities Hierarchy Manager
 * Multi-channel architecture with 64-bit BigInt RBAC bitfield permissions
 * and hierarchical channel permission overwrites.
 */

const Permissions = {
  VIEW_SPACE: 1n << 0n,
  MANAGE_CHANNELS: 1n << 1n,
  MANAGE_ROLES: 1n << 2n,
  SEND_MESSAGES: 1n << 3n,
  MANAGE_MESSAGES: 1n << 4n,
  STAGE_SPEAKER: 1n << 5n,
  STAGE_MODERATOR: 1n << 6n,
  CANVAS_DRAW: 1n << 7n,
  ATTACH_FILES: 1n << 8n,
  SEND_ANNOUNCEMENTS: 1n << 9n,
  CREATE_THREADS: 1n << 10n,
  ADMINISTRATOR: 1n << 60n
};

const ChannelTypes = {
  TEXT: 'text',
  ANNOUNCEMENT: 'announcement',
  VOICE_STAGE: 'voice_stage',
  CANVAS: 'canvas',
  FORUM: 'forum'
};

class SpaceManager {
  constructor() {
    this.spaces = new Map(); // spaceId -> Space
    this.activeSpaceId = null;
    this.activeChannelId = null;
  }

  /**
   * Create a new Community Space with default channels
   */
  createSpace({ id, name, ownerId, icon = '🌐', isPublic = false }) {
    const spaceId = id || `space_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Default roles
    const roles = {
      everyone: {
        id: 'everyone',
        name: '@everyone',
        permissions: Permissions.VIEW_SPACE | Permissions.SEND_MESSAGES | Permissions.CANVAS_DRAW | Permissions.ATTACH_FILES | Permissions.CREATE_THREADS
      },
      moderator: {
        id: 'moderator',
        name: 'Moderator',
        permissions: Permissions.VIEW_SPACE | Permissions.SEND_MESSAGES | Permissions.MANAGE_MESSAGES | Permissions.STAGE_MODERATOR | Permissions.STAGE_SPEAKER | Permissions.SEND_ANNOUNCEMENTS
      },
      admin: {
        id: 'admin',
        name: 'Administrator',
        permissions: Permissions.ADMINISTRATOR
      }
    };

    // Standard default channels
    const channels = [
      {
        id: `chan_${spaceId}_general`,
        name: 'general',
        type: ChannelTypes.TEXT,
        topic: 'General conversation and banter',
        overwrites: {}
      },
      {
        id: `chan_${spaceId}_announcements`,
        name: 'announcements',
        type: ChannelTypes.ANNOUNCEMENT,
        topic: 'Official community announcements',
        overwrites: {
          everyone: {
            allow: Permissions.VIEW_SPACE,
            deny: Permissions.SEND_MESSAGES
          }
        }
      },
      {
        id: `chan_${spaceId}_stage`,
        name: 'town-hall-stage',
        type: ChannelTypes.VOICE_STAGE,
        topic: 'Community town hall and keynote presentations',
        overwrites: {
          everyone: {
            allow: Permissions.VIEW_SPACE,
            deny: Permissions.STAGE_SPEAKER
          }
        }
      },
      {
        id: `chan_${spaceId}_whiteboard`,
        name: 'team-whiteboard',
        type: ChannelTypes.CANVAS,
        topic: 'Collaborative real-time canvas',
        overwrites: {}
      }
    ];

    const space = {
      id: spaceId,
      name,
      ownerId,
      icon,
      isPublic,
      createdAt: Date.now(),
      members: [ownerId],
      memberRoles: {
        [ownerId]: ['admin']
      },
      roles,
      channels
    };

    this.spaces.set(spaceId, space);
    return space;
  }

  /**
   * Add a channel to an existing space
   */
  addChannel(spaceId, { name, type = ChannelTypes.TEXT, topic = '', overwrites = {} }) {
    const space = this.spaces.get(spaceId);
    if (!space) throw new Error(`Space ${spaceId} not found`);

    const channelId = `chan_${spaceId}_${name.toLowerCase().replace(/[^a-z0-9_-]/g, '')}_${Date.now().toString(36)}`;
    const channel = {
      id: channelId,
      name,
      type,
      topic,
      overwrites
    };

    space.channels.push(channel);
    return channel;
  }

  /**
   * Calculate effective permissions for a user in a specific channel
   */
  computePermissions(userId, spaceId, channelId = null) {
    const space = this.spaces.get(spaceId);
    if (!space) return 0n;

    // Owner has absolute permission
    if (space.ownerId === userId) {
      return ~0n; // All bits set
    }

    const userRoles = space.memberRoles[userId] || ['everyone'];
    let effectivePerms = 0n;

    // 1. Accumulate base role permissions
    for (const roleKey of userRoles) {
      const role = space.roles[roleKey];
      if (role) {
        effectivePerms |= role.permissions;
      }
    }

    // Always include @everyone base
    if (space.roles.everyone) {
      effectivePerms |= space.roles.everyone.permissions;
    }

    // If administrator, grant all
    if ((effectivePerms & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
      return ~0n;
    }

    // 2. Channel-specific overwrites
    if (channelId) {
      const channel = space.channels.find(c => c.id === channelId);
      if (channel && channel.overwrites) {
        // Apply @everyone overwrite
        if (channel.overwrites.everyone) {
          const { allow = 0n, deny = 0n } = channel.overwrites.everyone;
          effectivePerms = (effectivePerms & ~deny) | allow;
        }

        // Apply specific role overwrites
        for (const roleKey of userRoles) {
          if (channel.overwrites[roleKey]) {
            const { allow = 0n, deny = 0n } = channel.overwrites[roleKey];
            effectivePerms = (effectivePerms & ~deny) | allow;
          }
        }

        // Apply member-specific overwrite
        if (channel.overwrites[userId]) {
          const { allow = 0n, deny = 0n } = channel.overwrites[userId];
          effectivePerms = (effectivePerms & ~deny) | allow;
        }
      }
    }

    return effectivePerms;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(userId, spaceId, permission, channelId = null) {
    const perms = this.computePermissions(userId, spaceId, channelId);
    return (perms & permission) === permission;
  }

  /**
   * Set active Space and Channel navigation
   */
  setActiveContext(spaceId, channelId = null) {
    this.activeSpaceId = spaceId;
    const space = this.spaces.get(spaceId);
    if (space) {
      if (channelId && space.channels.some(c => c.id === channelId)) {
        this.activeChannelId = channelId;
      } else if (space.channels.length > 0) {
        this.activeChannelId = space.channels[0].id;
      }
    } else {
      this.activeChannelId = null;
    }

    return {
      activeSpaceId: this.activeSpaceId,
      activeChannelId: this.activeChannelId
    };
  }

  /**
   * Safe serialization of space entities converting BigInts to string
   */
  serializeSpace(space) {
    return JSON.stringify(space, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      return value;
    });
  }

  /**
   * Safe deserialization converting BigInt string representations back to BigInt
   */
  deserializeSpace(jsonStr) {
    return JSON.parse(jsonStr, (key, value) => {
      if (typeof value === 'string' && /^\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpaceManager, Permissions, ChannelTypes };
}
if (typeof window !== 'undefined') {
  window.SpaceManager = SpaceManager;
  window.Permissions = Permissions;
  window.ChannelTypes = ChannelTypes;
}
