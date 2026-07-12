import type { ToolHealthMetrics, HealthScore } from "./types";

// Compute health score from metrics
// ONLINE: error_rate < 1%, latency_p99 < 500ms, cost_delta < 5%, success_rate > 95%
// DEGRADED: error_rate < 5%, latency_p99 < 2000ms, cost_delta < 20%, success_rate > 80%
// DOWN: otherwise

export function computeHealthScore(metrics: ToolHealthMetrics): HealthScore {
  // Implementation: evaluate metrics against thresholds
  // Return "ONLINE", "DEGRADED", or "DOWN"
  throw new Error("Not implemented");
}

export function isHealthy(score: HealthScore): boolean {
  return score === "ONLINE" || score === "DEGRADED";
}

export function canPromote(score: HealthScore, currentState: string): boolean {
  // Implementation: determine if tool can be promoted to ACTIVE
  // Preconditions: health must be ONLINE, running in CANARY successfully
  // Return true if ready, false otherwise
  throw new Error("Not implemented");
}

export function shouldDegrade(score: HealthScore): boolean {
  // Implementation: determine if tool should transition to DEGRADED
  // Trigger: health score dropped to DEGRADED
  return score === "DEGRADED";
}

export function shouldDisable(score: HealthScore): boolean {
  // Implementation: determine if tool should be disabled
  // Trigger: health score is DOWN
  return score === "DOWN";
}
