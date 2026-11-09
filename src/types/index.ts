// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/types/index.ts
//  Master TypeScript Interfaces & Type Declarations
// ════════════════════════════════════════════════

export type MessageDeliveryState = 
  | 'draft'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type MessageContentType =
  | 'text'
  | 'file'
  | 'audio'
  | 'video'
  | 'image'
  | 'call_event';

export interface ReactionMap {
  [reactionKey: string]: {
    [uid: string]: boolean | number;
  };
}

export interface EncryptedMessagePayload {
  messageId: string;
  clientMessageId: string;
  senderUid: string;
  conversationId: string;
  conversationType: 'dm' | 'group';
  type: MessageContentType;
  // Ciphertext payload
  encMsg: string;
  iv: string;
  // DM keys
  encKey?: string;
  myEncMsg?: string;
  myEncKey?: string;
  myIv?: string;
  // Group keys map { [uid]: b64WrappedKey }
  keys?: Record<string, string>;
  epochId?: number;
  // Metadata
  replyTo?: {
    msgId: string;
    senderName: string;
    textPreview: string;
  } | null;
  forwarded?: boolean;
  edited?: boolean;
  editedAt?: number;
  deleted?: boolean;
  starred?: Record<string, boolean>;
  reactions: ReactionMap;
  sentAt: any;
  deliveryState?: MessageDeliveryState;
  expiresAt?: number; // Ephemeral messages
}

export interface DecryptedMessage {
  id: string;
  clientMessageId: string;
  conversationId: string;
  senderUid: string;
  senderName: string;
  senderColor?: string;
  text: string;
  type: MessageContentType;
  fileMetadata?: {
    name: string;
    size: number;
    mimeType: string;
    keyHex: string;
    ivHex: string;
    url?: string;
    inlineData?: string;
  };
  audioMetadata?: {
    duration: number;
    waveform?: number[];
  };
  sentAt: number;
  isMine: boolean;
  deliveryState: MessageDeliveryState;
  reactions: ReactionMap;
  starred: boolean;
  edited: boolean;
  deleted: boolean;
  pinned?: boolean;
  expiresAt?: number;
  replyTo?: {
    msgId: string;
    senderName: string;
    text: string;
  } | null;
}

export interface ConversationSummary {
  id: string;
  type: 'dm' | 'group';
  name: string;
  color: string;
  avatarChar: string;
  otherUid?: string;
  members: string[];
  admins?: string[];
  roles?: Record<string, 'owner' | 'admin' | 'moderator' | 'member'>;
  pinned: boolean;
  archived: boolean;
  unreadCount: number;
  lastDecryptedPreview: string;
  sortTimestamp: number;
  draftText?: string;
  currentEpoch?: number;
}

export interface OutboxItem {
  id: string;
  clientMessageId: string;
  conversationId: string;
  conversationType: 'dm' | 'group';
  text: string;
  replyTo?: any;
  fileAttachment?: any;
  createdAt: number;
  retryAttempts: number;
  status: 'queued' | 'sending' | 'failed';
  lastError?: string;
}

export interface LocalCallRecord {
  callId: string;
  peerUid: string;
  peerName: string;
  type: 'voice' | 'video' | 'screen' | 'group';
  direction: 'incoming' | 'outgoing' | 'missed';
  status: 'connected' | 'declined' | 'timeout' | 'failed';
  startedAt: number;
  durationSeconds: number;
}

export interface UserDeviceIdentity {
  deviceId: string;
  deviceName: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk?: JsonWebKey;
  keyVersion: number;
  createdAt: number;
  lastActiveAt?: number;
  trustStatus: 'trusted' | 'untrusted' | 'revoked';
  revoked: boolean;
}

export interface GroupEpoch {
  epochId: number;
  groupId: string;
  rawEpochKey?: string;
  wrappedKeys: Record<string, string>;
  createdAt: number;
  createdBy: string;
}
