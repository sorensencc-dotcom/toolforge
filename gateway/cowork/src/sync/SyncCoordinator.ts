/**
 * Coordinates sync between Toolforge gateway and Cowork.
 * Handles Node-to-Cowork and Cowork-to-Toolforge sync.
 */

import { Logger } from '../utils/logger';
import { SyncError } from '../utils/errors';
import { CoworkClient, SyncStateUpdate } from '../client';
import { SyncState } from './SyncState';
import {
  SyncMessageType,
  HandshakeMessage,
  validateSyncMessage,
} from './SyncProtocol';
import crypto from 'crypto';

class SyncCoordinator {
  private logger: Logger;
  private state: SyncState;

  constructor(
    private gatewayId: string,
    private client: CoworkClient,
  ) {
    this.logger = new Logger('SyncCoordinator');
    this.state = new SyncState(gatewayId);
  }

  /**
   * Perform initial handshake with Cowork.
   */
  async handshake(
    capabilities: string[],
    skillsCount: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.info('Starting Cowork handshake', {
        capabilities: capabilities.length,
        skillsCount,
      });

      const message: HandshakeMessage = {
        id: this.generateMessageId(),
        type: SyncMessageType.HANDSHAKE,
        gateway_id: this.gatewayId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        payload: {
          gateway_version: '1.0.0',
          capabilities,
          skills_count: skillsCount,
        },
      };

      if (!validateSyncMessage(message)) {
        throw new SyncError('Invalid handshake message');
      }

      this.logger.info('Handshake message generated', { messageId: message.id });
      this.state.updateHeartbeat();

      return {
        success: true,
        message: 'Handshake completed',
      };
    } catch (error) {
      throw new SyncError(
        `Handshake failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Sync gateway state to Cowork.
   */
  async syncState(
    skillsRegistered: number,
    skillsActive: number,
  ): Promise<{ syncId: string; ack: boolean }> {
    try {
      this.logger.info('Syncing gateway state', {
        skillsRegistered,
        skillsActive,
      });

      this.state.setSkillsRegistered(skillsRegistered);
      this.state.setSkillsActive(skillsActive);
      this.state.updateSyncTime();

      const stateUpdate: SyncStateUpdate = {
        gateway_id: this.gatewayId,
        last_sync: this.state.getState().lastSync,
        skills_registered: skillsRegistered,
        drift_detected: this.state.getState().driftDetected,
      };

      const response = await this.client.syncState(stateUpdate);

      this.logger.info('State synced successfully', { syncId: response.sync_id });
      return {
        syncId: response.sync_id,
        ack: response.ack,
      };
    } catch (error) {
      throw new SyncError(
        `State sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Detect and report drift.
   */
  detectDrift(expectedHash: string, actualHash: string): void {
    if (expectedHash !== actualHash) {
      const signal = `manifest_hash_mismatch: expected ${expectedHash}, got ${actualHash}`;
      this.state.detectDrift(signal);
      this.logger.warn('Manifest drift detected', { signal });
    }
  }

  /**
   * Generate unique message ID.
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get current sync state.
   */
  getState(): SyncState {
    return this.state;
  }

  /**
   * Get gateway status (health check).
   */
  async getGatewayStatus(): Promise<{
    status: string;
    skills_active: number;
    last_heartbeat: string;
  }> {
    try {
      this.logger.debug('Fetching gateway status');
      const status = await this.client.getGatewayStatus();
      this.state.updateHeartbeat();
      return status;
    } catch (error) {
      throw new SyncError(
        `Failed to get gateway status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export { SyncCoordinator };
