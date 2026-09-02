import {
  checkLatencyThreshold,
  checkRetryThreshold,
  checkSuccessRateThreshold,
  ThresholdChecker,
} from '../../load-test/assertions';

describe('Assertions', () => {
  describe('checkLatencyThreshold', () => {
    it('passes when observed is below budget', () => {
      const flag = checkLatencyThreshold(1000, 5000, 'test');
      expect(flag.exceeded).toBe(false);
    });

    it('exceeds when observed is above budget', () => {
      const flag = checkLatencyThreshold(6000, 5000, 'test');
      expect(flag.exceeded).toBe(true);
    });
  });

  describe('checkRetryThreshold', () => {
    it('passes when retries are below budget', () => {
      const flag = checkRetryThreshold(2, 3, 'test');
      expect(flag.exceeded).toBe(false);
    });

    it('exceeds when retries exceed budget', () => {
      const flag = checkRetryThreshold(4, 3, 'test');
      expect(flag.exceeded).toBe(true);
    });
  });

  describe('checkSuccessRateThreshold', () => {
    it('passes when rate is above minimum', () => {
      const flag = checkSuccessRateThreshold(0.99, 0.95, 'test');
      expect(flag.exceeded).toBe(false);
    });

    it('exceeds when rate is below minimum', () => {
      const flag = checkSuccessRateThreshold(0.90, 0.95, 'test');
      expect(flag.exceeded).toBe(true);
    });
  });

  describe('ThresholdChecker', () => {
    it('tracks manifest push latency', () => {
      const checker = new ThresholdChecker();
      checker.checkManifestPushLatency(4000);
      expect(checker.getFlags().length).toBe(1);
      expect(checker.getFlags()[0].exceeded).toBe(false);
    });

    it('flags latency exceeded', () => {
      const checker = new ThresholdChecker();
      checker.checkManifestPushLatency(6000);
      expect(checker.getFlags()[0].exceeded).toBe(true);
    });

    it('checks success rates', () => {
      const checker = new ThresholdChecker();
      checker.checkManifestPushSuccessRate(0.97);
      checker.checkManifestPullSuccessRate(0.92);

      const flags = checker.getFlags();
      expect(flags[0].exceeded).toBe(false);
      expect(flags[1].exceeded).toBe(true);
    });

    it('checks heartbeat drift', () => {
      const checker = new ThresholdChecker();
      checker.checkHeartbeatDrift(2000);
      expect(checker.getFlags()[0].exceeded).toBe(false);

      const checker2 = new ThresholdChecker();
      checker2.checkHeartbeatDrift(6000);
      expect(checker2.getFlags()[0].exceeded).toBe(true);
    });

    it('uses custom budgets', () => {
      const checker = new ThresholdChecker({ webhookTimeoutMs: 3000 });
      checker.checkManifestPushLatency(3500);
      expect(checker.getFlags()[0].exceeded).toBe(true);
    });

    it('provides flag summary', () => {
      const checker = new ThresholdChecker();
      checker.checkManifestPushLatency(4000);
      checker.checkManifestPullLatency(6000);
      checker.checkManifestPushSuccessRate(0.92);

      const summary = checker.getFlagsSummary();
      expect(summary.total).toBe(3);
      expect(summary.exceeded).toBe(1);
    });
  });
});
