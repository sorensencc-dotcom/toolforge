/**
 * Authentication handler for Cowork API.
 * Manages API key, token refresh, gateway identity.
 */

import { AuthError } from '../utils/errors';
import { Logger } from '../utils/logger';

interface GatewayIdentity {
  gatewayId: string;
  version: string;
  timestamp: string;
}

class CoworkAuth {
  private logger: Logger;
  private apiKey: string;
  private gatewayId: string;
  private readonly version = '1.0.0';

  constructor(apiKey: string, gatewayId: string) {
    this.logger = new Logger('CoworkAuth');
    if (!apiKey || apiKey.trim().length === 0) {
      throw new AuthError('API key is empty or invalid');
    }
    this.apiKey = apiKey;
    this.gatewayId = gatewayId;
  }

  /**
   * Generate Authorization header.
   */
  getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * Generate gateway identity for handshake.
   */
  getGatewayIdentity(): GatewayIdentity {
    return {
      gatewayId: this.gatewayId,
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify API key format (basic validation).
   */
  validateKeyFormat(): boolean {
    const pattern = /^[a-z0-9-]{20,}$/i;
    return pattern.test(this.apiKey);
  }

  /**
   * Refresh token (placeholder for future auth scheme).
   */
  async refreshToken(): Promise<string> {
    this.logger.info('Token refresh requested (noop in v1)');
    return this.apiKey;
  }
}

export { CoworkAuth, GatewayIdentity };
