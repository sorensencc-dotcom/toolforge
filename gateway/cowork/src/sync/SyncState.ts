/**
 * Tracks gateway sync state and drift detection.
 * Maintains canonical state for conflict resolution.
 */

import { Logger } from '../utils/logger';

interface GatewaySyncState {
  gatewayId: string;
  lastSync: string; // ISO timestamp
  lastManifestHash: string;
  skillsRegistered: number;
  skillsActive: number;
  pendingRegistrations: string[];
  driftDetected: boolean;
  driftSignals: string[];
  lastHeartbeat: string;
}

class SyncState {
  private logger: Logger;
  private state: GatewaySyncState;

  constructor(gatewayId: string) {
    this.logger = new Logger('SyncState');
    this.state = {
      gatewayId,
      lastSync: new Date().toISOString(),
      lastManifestHash: '',
      skillsRegistered: 0,
      skillsActive: 0,
      pendingRegistrations: [],
      driftDetected: false,
      driftSignals: [],
      lastHeartbeat: new Date().toISOString(),
    };
  }

  /**
   * Update sync timestamp.
   */
  updateSyncTime(): void {
    this.state.lastSync = new Date().toISOString();
    this.logger.debug('Sync time updated', { time: this.state.lastSync });
  }

  /**
   * Update manifest hash.
   */
  updateManifestHash(hash: string): void {
    this.state.lastManifestHash = hash;
    this.logger.debug('Manifest hash updated', { hash });
  }

  /**
   * Update registered skills count.
   */
  setSkillsRegistered(count: number): void {
    this.state.skillsRegistered = count;
  }

  /**
   * Update active skills count.
   */
  setSkillsActive(count: number): void {
    this.state.skillsActive = count;
  }

  /**
   * Add pending registration.
   */
  addPendingRegistration(skillId: string): void {
    if (!this.state.pendingRegistrations.includes(skillId)) {
      this.state.pendingRegistrations.push(skillId);
      this.logger.debug('Pending registration added', { skillId });
    }
  }

  /**
   * Remove pending registration (on success).
   */
  removePendingRegistration(skillId: string): void {
    this.state.pendingRegistrations = this.state.pendingRegistrations.filter(
      (id) => id !== skillId,
    );
    this.logger.debug('Pending registration removed', { skillId });
  }

  /**
   * Detect drift (version mismatch, missing files, etc).
   */
  detectDrift(signal: string): void {
    if (!this.state.driftSignals.includes(signal)) {
      this.state.driftSignals.push(signal);
    }
    this.state.driftDetected = this.state.driftSignals.length > 0;
    this.logger.warn('Drift detected', { signal });
  }

  /**
   * Clear drift signals.
   */
  clearDrift(): void {
    this.state.driftSignals = [];
    this.state.driftDetected = false;
    this.logger.info('Drift cleared');
  }

  /**
   * Update heartbeat timestamp.
   */
  updateHeartbeat(): void {
    this.state.lastHeartbeat = new Date().toISOString();
  }

  /**
   * Get current state snapshot.
   */
  getState(): GatewaySyncState {
    return { ...this.state };
  }

  /**
   * Export state as JSON.
   */
  toJSON(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Restore state from JSON.
   */
  fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json);
      this.state = { ...parsed };
      this.logger.info('State restored from JSON');
    } catch (error) {
      this.logger.error('Failed to restore state from JSON', error as Error);
    }
  }
}

export { SyncState, GatewaySyncState };
