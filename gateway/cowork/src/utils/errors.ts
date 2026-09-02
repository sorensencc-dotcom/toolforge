/**
 * Error classes for Cowork Gateway.
 */

export class CoworkError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'CoworkError';
  }
}

export class RegistrationError extends CoworkError {
  constructor(message: string, public skillId?: string) {
    super(message, 'REGISTRATION_FAILED', 400);
    this.name = 'RegistrationError';
  }
}

export class SyncError extends CoworkError {
  constructor(message: string, public nodeId?: string) {
    super(message, 'SYNC_FAILED', 503);
    this.name = 'SyncError';
  }
}

export class ManifestError extends CoworkError {
  constructor(message: string) {
    super(message, 'MANIFEST_INVALID', 422);
    this.name = 'ManifestError';
  }
}

export class AuthError extends CoworkError {
  constructor(message: string) {
    super(message, 'AUTH_FAILED', 401);
    this.name = 'AuthError';
  }
}

export class NetworkError extends CoworkError {
  constructor(message: string, public retryable: boolean = true) {
    super(message, 'NETWORK_ERROR', 502);
    this.name = 'NetworkError';
  }
}
