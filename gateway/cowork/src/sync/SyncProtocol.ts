/**
 * Sync protocol definitions for Cowork-Toolforge communication.
 * Defines message schema, handshake, error codes, retry semantics.
 */

/**
 * Sync message types.
 */
enum SyncMessageType {
  HANDSHAKE = 'handshake',
  STATE_UPDATE = 'state_update',
  MANIFEST_PUSH = 'manifest_push',
  DRIFT_DETECT = 'drift_detect',
  ACK = 'ack',
  ERROR = 'error',
}

/**
 * Sync error codes.
 */
enum SyncErrorCode {
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  GATEWAY_UNKNOWN = 'GATEWAY_UNKNOWN',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  MANIFEST_CONFLICT = 'MANIFEST_CONFLICT',
  STATE_DIVERGENCE = 'STATE_DIVERGENCE',
  TIMEOUT = 'TIMEOUT',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
}

/**
 * Sync message envelope.
 */
interface SyncMessage {
  id: string;
  type: SyncMessageType;
  gateway_id: string;
  timestamp: string;
  version: string;
  payload: Record<string, unknown>;
  trace_id?: string;
}

/**
 * Handshake message (gateway → Cowork).
 */
interface HandshakeMessage extends SyncMessage {
  type: SyncMessageType.HANDSHAKE;
  payload: {
    gateway_version: string;
    capabilities: string[];
    skills_count: number;
  };
}

/**
 * State update message (gateway → Cowork).
 */
interface StateUpdateMessage extends SyncMessage {
  type: SyncMessageType.STATE_UPDATE;
  payload: {
    last_sync: string;
    skills_registered: number;
    skills_active: number;
    drift_detected: boolean;
  };
}

/**
 * Acknowledgement message (Cowork → gateway).
 */
interface AckMessage extends SyncMessage {
  type: SyncMessageType.ACK;
  payload: {
    original_id: string;
    status: 'received' | 'processed' | 'rejected';
  };
}

/**
 * Error message (Cowork → gateway).
 */
interface ErrorMessage extends SyncMessage {
  type: SyncMessageType.ERROR;
  payload: {
    code: SyncErrorCode;
    message: string;
    retry_after?: number;
  };
}

/**
 * Sync retry policy.
 */
interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number[];
  retryableErrors: SyncErrorCode[];
}

/**
 * Default retry policy.
 */
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: [100, 500, 2000],
  retryableErrors: [
    SyncErrorCode.TIMEOUT,
    SyncErrorCode.STATE_DIVERGENCE,
  ],
};

/**
 * Validate sync message structure.
 */
function validateSyncMessage(message: SyncMessage): boolean {
  if (!message.id || message.id.trim().length === 0) return false;
  if (!message.gateway_id || message.gateway_id.trim().length === 0) return false;
  if (!message.timestamp || !new Date(message.timestamp).getTime()) return false;
  if (!message.version || message.version.trim().length === 0) return false;
  if (!message.payload || typeof message.payload !== 'object') return false;
  return true;
}

export {
  SyncMessageType,
  SyncErrorCode,
  SyncMessage,
  HandshakeMessage,
  StateUpdateMessage,
  AckMessage,
  ErrorMessage,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  validateSyncMessage,
};
