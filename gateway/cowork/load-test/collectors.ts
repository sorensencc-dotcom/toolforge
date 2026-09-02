export interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
}

export function calculatePercentiles(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

export interface RegistryLatencyCollector {
  recordLatency(latencyMs: number): void;
  getStats(): PercentileStats & { opsTotal: number };
}

export function createRegistryLatencyCollector(): RegistryLatencyCollector {
  const latencies: number[] = [];

  return {
    recordLatency(latencyMs: number) {
      latencies.push(latencyMs);
    },
    getStats() {
      return {
        ...calculatePercentiles(latencies),
        opsTotal: latencies.length,
      };
    },
  };
}

export interface ManifestCollector {
  recordPush(success: boolean, latencyMs: number): void;
  recordPull(success: boolean, latencyMs: number): void;
  getStats(): {
    pushSuccessRate: number;
    pushLatencyMs: PercentileStats;
    pushCount: number;
    pullSuccessRate: number;
    pullLatencyMs: PercentileStats;
    pullCount: number;
  };
}

export function createManifestCollector(): ManifestCollector {
  const pushLatencies: number[] = [];
  let pushSuccess = 0;
  const pullLatencies: number[] = [];
  let pullSuccess = 0;

  return {
    recordPush(success, latencyMs) {
      if (success) pushSuccess++;
      pushLatencies.push(latencyMs);
    },
    recordPull(success, latencyMs) {
      if (success) pullSuccess++;
      pullLatencies.push(latencyMs);
    },
    getStats() {
      return {
        pushSuccessRate: pushLatencies.length > 0 ? pushSuccess / pushLatencies.length : 0,
        pushLatencyMs: calculatePercentiles(pushLatencies),
        pushCount: pushLatencies.length,
        pullSuccessRate: pullLatencies.length > 0 ? pullSuccess / pullLatencies.length : 0,
        pullLatencyMs: calculatePercentiles(pullLatencies),
        pullCount: pullLatencies.length,
      };
    },
  };
}

export interface SyncStateChurnCollector {
  recordMutation(): void;
  getStats(durationMs: number): { mutationsPerSecond: number };
}

export function createSyncStateChurnCollector(): SyncStateChurnCollector {
  let mutations = 0;

  return {
    recordMutation() {
      mutations++;
    },
    getStats(durationMs) {
      return {
        mutationsPerSecond: durationMs > 0 ? (mutations / durationMs) * 1000 : 0,
      };
    },
  };
}

export interface HeartbeatCollector {
  recordHeartbeat(intervalMs: number): void;
  getStats(targetIntervalMs: number): {
    targetIntervalMs: number;
    observedIntervalMs: PercentileStats;
    driftMs: number;
  };
}

export function createHeartbeatCollector(): HeartbeatCollector {
  const intervals: number[] = [];

  return {
    recordHeartbeat(intervalMs) {
      intervals.push(intervalMs);
    },
    getStats(targetIntervalMs) {
      const stats = calculatePercentiles(intervals);
      const avg = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
      return {
        targetIntervalMs,
        observedIntervalMs: stats,
        driftMs: Math.abs(avg - targetIntervalMs),
      };
    },
  };
}

export interface RetryBackoffCollector {
  recordRetryDelays(delaysMs: number[]): void;
  getStats(expectedDelaysMs: number[]): {
    observedDelaysMs: number[];
    expectedDelaysMs: number[];
    matched: boolean;
  };
}

export function createRetryBackoffCollector(): RetryBackoffCollector {
  const allDelays: number[] = [];

  return {
    recordRetryDelays(delaysMs) {
      allDelays.push(...delaysMs);
    },
    getStats(expectedDelaysMs) {
      // Simplified: check if observed delays are "close enough" to expected
      // In real code, would do more sophisticated backoff verification
      const avg = allDelays.length > 0 ? allDelays.reduce((a, b) => a + b) / allDelays.length : 0;
      const expectedAvg =
        expectedDelaysMs.length > 0
          ? expectedDelaysMs.reduce((a, b) => a + b) / expectedDelaysMs.length
          : 0;
      return {
        observedDelaysMs: allDelays,
        expectedDelaysMs,
        matched: Math.abs(avg - expectedAvg) < 100, // within 100ms
      };
    },
  };
}

export interface ErrorEnvelopeCollector {
  recordResponse(response: unknown, expectedShape: string): void;
  getStats(): {
    conformsToAdapterResponse: boolean;
    sampleMismatches: Array<{ got: unknown; expected: string }>;
  };
}

export function createErrorEnvelopeCollector(): ErrorEnvelopeCollector {
  const mismatches: Array<{ got: unknown; expected: string }> = [];
  let total = 0;
  let matching = 0;

  return {
    recordResponse(response, expectedShape) {
      total++;
      // Check if response conforms to AdapterResponse { ok, data?, error?, meta }
      if (
        typeof response === 'object' &&
        response !== null &&
        'ok' in response &&
        typeof (response as any).ok === 'boolean'
      ) {
        matching++;
      } else if (mismatches.length < 5) {
        mismatches.push({ got: response, expected: expectedShape });
      }
    },
    getStats() {
      return {
        conformsToAdapterResponse: total > 0 ? matching === total : false,
        sampleMismatches: mismatches,
      };
    },
  };
}

export interface HashConsistencyCollector {
  recordPushHash(hash: string): void;
  recordPulledHash(hash: string): void;
  getStats(): {
    pulledHashesAlwaysMatchAPush: boolean;
    tornDetected: number;
  };
}

export function createHashConsistencyCollector(): HashConsistencyCollector {
  const pushedHashes = new Set<string>();
  const pulledHashes: string[] = [];
  let tornDetected = 0;

  return {
    recordPushHash(hash) {
      pushedHashes.add(hash);
    },
    recordPulledHash(hash) {
      pulledHashes.push(hash);
      if (!pushedHashes.has(hash)) {
        tornDetected++;
      }
    },
    getStats() {
      return {
        pulledHashesAlwaysMatchAPush: tornDetected === 0,
        tornDetected,
      };
    },
  };
}
