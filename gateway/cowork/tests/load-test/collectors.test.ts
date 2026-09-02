import {
  calculatePercentiles,
  createRegistryLatencyCollector,
  createManifestCollector,
  createSyncStateChurnCollector,
  createHeartbeatCollector,
  createRetryBackoffCollector,
  createErrorEnvelopeCollector,
  createHashConsistencyCollector,
} from '../../load-test/collectors';

describe('Collectors', () => {
  describe('calculatePercentiles', () => {
    it('calculates percentiles correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => i);
      const stats = calculatePercentiles(values);
      expect(stats.p50).toBeCloseTo(50, 1);
      expect(stats.p95).toBeCloseTo(95, 1);
      expect(stats.p99).toBeCloseTo(99, 1);
    });

    it('handles empty array', () => {
      const stats = calculatePercentiles([]);
      expect(stats.p50).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
    });
  });

  describe('RegistryLatencyCollector', () => {
    it('records latencies and computes percentiles', () => {
      const collector = createRegistryLatencyCollector();
      for (let i = 0; i < 100; i++) {
        collector.recordLatency(i);
      }
      const stats = collector.getStats();
      expect(stats.opsTotal).toBe(100);
      expect(stats.p50).toBeCloseTo(50, 1);
    });
  });

  describe('ManifestCollector', () => {
    it('tracks push and pull success rates and latencies', () => {
      const collector = createManifestCollector();
      collector.recordPush(true, 100);
      collector.recordPush(true, 150);
      collector.recordPush(false, 200);
      collector.recordPull(true, 50);
      collector.recordPull(true, 75);

      const stats = collector.getStats();
      expect(stats.pushCount).toBe(3);
      expect(stats.pushSuccessRate).toBeCloseTo(2 / 3, 0.01);
      expect(stats.pullCount).toBe(2);
      expect(stats.pullSuccessRate).toBe(1);
    });
  });

  describe('SyncStateChurnCollector', () => {
    it('calculates mutations per second', () => {
      const collector = createSyncStateChurnCollector();
      for (let i = 0; i < 100; i++) {
        collector.recordMutation();
      }
      const stats = collector.getStats(1000);
      expect(stats.mutationsPerSecond).toBeCloseTo(100, 1);
    });
  });

  describe('HeartbeatCollector', () => {
    it('tracks heartbeat intervals and drift', () => {
      const collector = createHeartbeatCollector();
      for (let i = 0; i < 10; i++) {
        collector.recordHeartbeat(30000);
      }
      const stats = collector.getStats(30000);
      expect(stats.targetIntervalMs).toBe(30000);
      expect(stats.driftMs).toBeCloseTo(0, 1);
    });

    it('detects drift when intervals vary', () => {
      const collector = createHeartbeatCollector();
      collector.recordHeartbeat(20000);
      collector.recordHeartbeat(25000);
      const stats = collector.getStats(30000);
      expect(stats.driftMs).toBeGreaterThan(0);
    });
  });

  describe('RetryBackoffCollector', () => {
    it('records retry delays and checks against expected pattern', () => {
      const collector = createRetryBackoffCollector();
      collector.recordRetryDelays([100, 300, 1000]);
      const stats = collector.getStats([100, 300, 1000]);
      expect(stats.matched).toBe(true);
    });
  });

  describe('ErrorEnvelopeCollector', () => {
    it('detects conformance to AdapterResponse shape', () => {
      const collector = createErrorEnvelopeCollector();
      collector.recordResponse({ ok: true, data: { test: 'data' } }, 'AdapterResponse');
      collector.recordResponse({ ok: false, error: 'test error' }, 'AdapterResponse');
      const stats = collector.getStats();
      expect(stats.conformsToAdapterResponse).toBe(true);
    });

    it('detects mismatches against AdapterResponse', () => {
      const collector = createErrorEnvelopeCollector();
      collector.recordResponse({ error: 'unauthorized' }, 'AdapterResponse');
      const stats = collector.getStats();
      expect(stats.conformsToAdapterResponse).toBe(false);
      expect(stats.sampleMismatches.length).toBeGreaterThan(0);
    });
  });

  describe('HashConsistencyCollector', () => {
    it('verifies pulled hashes match pushed hashes', () => {
      const collector = createHashConsistencyCollector();
      const hash1 = 'abc123';
      const hash2 = 'def456';

      collector.recordPushHash(hash1);
      collector.recordPushHash(hash2);
      collector.recordPulledHash(hash1);
      collector.recordPulledHash(hash2);

      const stats = collector.getStats();
      expect(stats.pulledHashesAlwaysMatchAPush).toBe(true);
      expect(stats.tornDetected).toBe(0);
    });

    it('detects torn hashes', () => {
      const collector = createHashConsistencyCollector();
      collector.recordPushHash('abc123');
      collector.recordPulledHash('invalid-hash');

      const stats = collector.getStats();
      expect(stats.pulledHashesAlwaysMatchAPush).toBe(false);
      expect(stats.tornDetected).toBe(1);
    });
  });
});
