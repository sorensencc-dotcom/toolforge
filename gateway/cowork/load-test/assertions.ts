export interface ThresholdFlag {
  metric: string;
  observed: number;
  threshold: number;
  exceeded: boolean;
}

export interface ThresholdBudgets {
  webhookTimeoutMs: number;
  webhookRetries: number;
  adapterTimeoutMs: number;
  adapterRetries: number;
}

/**
 * Default thresholds based on PHASE_27.env.example
 */
export const DEFAULT_BUDGETS: ThresholdBudgets = {
  webhookTimeoutMs: 5000,
  webhookRetries: 3,
  adapterTimeoutMs: 10000,
  adapterRetries: 3,
};

export function checkLatencyThreshold(
  observedMs: number,
  budgetMs: number,
  metricName: string
): ThresholdFlag {
  return {
    metric: metricName,
    observed: observedMs,
    threshold: budgetMs,
    exceeded: observedMs > budgetMs,
  };
}

export function checkRetryThreshold(
  observedRetries: number,
  budgetRetries: number,
  metricName: string
): ThresholdFlag {
  return {
    metric: metricName,
    observed: observedRetries,
    threshold: budgetRetries,
    exceeded: observedRetries > budgetRetries,
  };
}

export function checkSuccessRateThreshold(
  successRate: number,
  minThreshold: number,
  metricName: string
): ThresholdFlag {
  return {
    metric: metricName,
    observed: successRate,
    threshold: minThreshold,
    exceeded: successRate < minThreshold,
  };
}

export class ThresholdChecker {
  private flags: ThresholdFlag[] = [];
  private budgets: ThresholdBudgets;

  constructor(budgets?: Partial<ThresholdBudgets>) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets };
  }

  checkManifestPushLatency(p99Ms: number): void {
    this.flags.push(
      checkLatencyThreshold(p99Ms, this.budgets.webhookTimeoutMs, 'manifest_push_p99_latency_ms')
    );
  }

  checkManifestPullLatency(p99Ms: number): void {
    this.flags.push(
      checkLatencyThreshold(p99Ms, this.budgets.adapterTimeoutMs, 'manifest_pull_p99_latency_ms')
    );
  }

  checkManifestPushSuccessRate(rate: number): void {
    this.flags.push(checkSuccessRateThreshold(rate, 0.95, 'manifest_push_success_rate'));
  }

  checkManifestPullSuccessRate(rate: number): void {
    this.flags.push(checkSuccessRateThreshold(rate, 0.95, 'manifest_pull_success_rate'));
  }

  checkHeartbeatDrift(driftMs: number): void {
    // Allow up to 5s drift from 30s target
    this.flags.push(checkLatencyThreshold(driftMs, 5000, 'heartbeat_drift_ms'));
  }

  checkSyncChurn(mutationsPerSec: number): void {
    // Flag if churn is unusually high (> 100/sec indicates potential issue)
    if (mutationsPerSec > 100) {
      this.flags.push({
        metric: 'sync_state_churn_per_sec',
        observed: mutationsPerSec,
        threshold: 100,
        exceeded: true,
      });
    }
  }

  getFlags(): ThresholdFlag[] {
    return this.flags;
  }

  getFlagsSummary(): { total: number; exceeded: number } {
    const exceeded = this.flags.filter((f) => f.exceeded).length;
    return {
      total: this.flags.length,
      exceeded,
    };
  }
}
