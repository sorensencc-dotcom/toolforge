/**
 * Tests for sync protocol and coordination.
 */

import { SyncMessageType, validateSyncMessage } from '../src/sync/SyncProtocol';
import { SyncState } from '../src/sync/SyncState';
import { SyncCoordinator } from '../src/sync/SyncCoordinator';
import { CoworkClient } from '../src/client/CoworkClient';
import { initMockServer, getMockServerContext, resetMockServerState, shutdownMockServer } from './helpers/mockServer';

describe('SyncProtocol', () => {
  describe('validateSyncMessage', () => {
    it('should validate correct sync messages', () => {
      const validMessage = {
        id: 'msg_123456_abc',
        type: SyncMessageType.HANDSHAKE,
        gateway_id: 'toolforge-gateway',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        payload: {},
      };

      expect(validateSyncMessage(validMessage)).toBe(true);
    });

    it('should reject messages with missing id', () => {
      const invalidMessage = {
        type: SyncMessageType.HANDSHAKE,
        gateway_id: 'toolforge-gateway',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        payload: {},
      };

      expect(validateSyncMessage(invalidMessage as any)).toBe(false);
    });

    it('should reject messages with missing gateway_id', () => {
      const invalidMessage = {
        id: 'msg_123456_abc',
        type: SyncMessageType.HANDSHAKE,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        payload: {},
      };

      expect(validateSyncMessage(invalidMessage as any)).toBe(false);
    });

    it('should reject messages with invalid timestamp', () => {
      const invalidMessage = {
        id: 'msg_123456_abc',
        type: SyncMessageType.HANDSHAKE,
        gateway_id: 'toolforge-gateway',
        timestamp: 'not-a-date',
        version: '1.0.0',
        payload: {},
      };

      expect(validateSyncMessage(invalidMessage as any)).toBe(false);
    });
  });
});

describe('SyncState', () => {
  let state: SyncState;

  beforeEach(() => {
    state = new SyncState('toolforge-gateway');
  });

  describe('updateSyncTime', () => {
    it('should update last sync timestamp', async () => {
      const before = state.getState().lastSync;
      await new Promise((r) => setTimeout(r, 1));
      state.updateSyncTime();
      const after = state.getState().lastSync;

      expect(after).not.toBe(before);
    });
  });

  describe('updateManifestHash', () => {
    it('should update manifest hash', () => {
      const hash = 'abc123def456';
      state.updateManifestHash(hash);

      expect(state.getState().lastManifestHash).toBe(hash);
    });
  });

  describe('detectDrift', () => {
    it('should add drift signals', () => {
      state.detectDrift('signal_1');
      state.detectDrift('signal_2');

      const signals = state.getState().driftSignals;
      expect(signals).toContain('signal_1');
      expect(signals).toContain('signal_2');
    });

    it('should set drift flag on detection', () => {
      expect(state.getState().driftDetected).toBe(false);
      state.detectDrift('test_signal');

      expect(state.getState().driftDetected).toBe(true);
    });

    it('should not add duplicate drift signals', () => {
      state.detectDrift('same_signal');
      state.detectDrift('same_signal');

      expect(state.getState().driftSignals.length).toBe(1);
    });
  });

  describe('clearDrift', () => {
    it('should clear all drift signals', () => {
      state.detectDrift('signal_1');
      state.detectDrift('signal_2');

      state.clearDrift();

      expect(state.getState().driftSignals.length).toBe(0);
      expect(state.getState().driftDetected).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return current state snapshot', () => {
      const snapshot = state.getState();

      expect(snapshot.gatewayId).toBe('toolforge-gateway');
      expect(snapshot.lastSync).toBeDefined();
      expect(snapshot.driftDetected).toBe(false);
      expect(snapshot.driftSignals).toEqual([]);
    });

    it('should return a copy, not reference', () => {
      const snapshot1 = state.getState();
      snapshot1.skillsRegistered = 999;

      const snapshot2 = state.getState();
      expect(snapshot2.skillsRegistered).toBe(0);
    });
  });

  describe('toJSON/fromJSON', () => {
    it('should serialize and deserialize state', () => {
      state.setSkillsRegistered(5);
      state.setSkillsActive(4);
      state.updateManifestHash('hash123');

      const json = state.toJSON();
      const state2 = new SyncState('toolforge-gateway');
      state2.fromJSON(json);

      const restored = state2.getState();
      expect(restored.skillsRegistered).toBe(5);
      expect(restored.skillsActive).toBe(4);
      expect(restored.lastManifestHash).toBe('hash123');
    });

    it('should handle roundtrip correctly', () => {
      state.detectDrift('drift_1');
      state.addPendingRegistration('skill_1');

      const json = state.toJSON();
      expect(() => JSON.parse(json)).not.toThrow();

      const state2 = new SyncState('toolforge-gateway');
      state2.fromJSON(json);

      expect(state2.getState().driftSignals).toContain('drift_1');
      expect(state2.getState().pendingRegistrations).toContain('skill_1');
    });
  });

  describe('pending registrations', () => {
    it('should add pending registration', () => {
      state.addPendingRegistration('skill_1');
      expect(state.getState().pendingRegistrations).toContain('skill_1');
    });

    it('should remove pending registration', () => {
      state.addPendingRegistration('skill_1');
      state.removePendingRegistration('skill_1');

      expect(state.getState().pendingRegistrations).not.toContain('skill_1');
    });

    it('should not add duplicate pending registrations', () => {
      state.addPendingRegistration('skill_1');
      state.addPendingRegistration('skill_1');

      expect(state.getState().pendingRegistrations.length).toBe(1);
    });
  });

  describe('heartbeat', () => {
    it('should update heartbeat timestamp', async () => {
      const before = state.getState().lastHeartbeat;
      await new Promise((r) => setTimeout(r, 1));
      state.updateHeartbeat();
      const after = state.getState().lastHeartbeat;

      expect(after).not.toBe(before);
    });
  });
});

describe('SyncCoordinator', () => {
  let coordinator: SyncCoordinator;
  let client: CoworkClient;

  beforeAll(async () => {
    await initMockServer();
    const context = getMockServerContext();
    client = new CoworkClient(context.baseUrl, context.apiKey, 'toolforge-gateway');
  });

  beforeEach(() => {
    coordinator = new SyncCoordinator('toolforge-gateway', client);
  });

  afterEach(() => {
    resetMockServerState();
  });

  afterAll(async () => {
    await shutdownMockServer();
  });

  describe('handshake', () => {
    it('should complete Cowork handshake', async () => {
      const result = await coordinator.handshake(['skill-registration', 'distributed-sync'], 22);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Handshake completed');
    });

    it('should update heartbeat on handshake', async () => {
      const before = coordinator.getState().getState().lastHeartbeat;
      await coordinator.handshake([], 0);
      const after = coordinator.getState().getState().lastHeartbeat;

      expect(after).not.toBe(before);
    });
  });

  describe('syncState', () => {
    it('should sync gateway state to Cowork', async () => {
      const result = await coordinator.syncState(22, 20);

      expect(result.ack).toBe(true);
      expect(result.syncId).toBeDefined();
    });

    it('should handle sync errors gracefully', async () => {
      const context = getMockServerContext();
      context.state.faultInjection.set('/v1/sync/state', {
        forceStatus: { code: 500, count: 100 },
      });

      await expect(coordinator.syncState(22, 20)).rejects.toThrow();
    });

    it('should update internal state after sync', async () => {
      const stateBefore = coordinator.getState().getState().skillsRegistered;
      expect(stateBefore).toBe(0);

      await coordinator.syncState(22, 20);

      const stateAfter = coordinator.getState().getState().skillsRegistered;
      expect(stateAfter).toBe(22);
    });
  });

  describe('detectDrift', () => {
    it('should detect manifest hash mismatches', () => {
      coordinator.detectDrift('expected_hash', 'actual_hash');

      expect(coordinator.getState().getState().driftDetected).toBe(true);
      expect(coordinator.getState().getState().driftSignals.length).toBeGreaterThan(0);
    });

    it('should not detect drift when hashes match', () => {
      coordinator.detectDrift('same_hash', 'same_hash');

      expect(coordinator.getState().getState().driftDetected).toBe(false);
    });

    it('should not add duplicate drift signals for same mismatch', () => {
      coordinator.detectDrift('hash_a', 'hash_b');
      const count1 = coordinator.getState().getState().driftSignals.length;

      coordinator.detectDrift('hash_a', 'hash_b');
      const count2 = coordinator.getState().getState().driftSignals.length;

      expect(count1).toBe(count2);
    });
  });

  describe('getGatewayStatus', () => {
    it('should fetch and return gateway status', async () => {
      const status = await coordinator.getGatewayStatus();

      expect(status.status).toBe('online');
      expect(status.skills_active).toBeDefined();
      expect(status.last_heartbeat).toBeDefined();
    });

    it('should update heartbeat on status check', async () => {
      const before = coordinator.getState().getState().lastHeartbeat;
      await coordinator.getGatewayStatus();
      const after = coordinator.getState().getState().lastHeartbeat;

      expect(after).not.toBe(before);
    });
  });
});
