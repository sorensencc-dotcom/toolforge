// Tool lifecycle state machine + contracts

export type ToolLifecycleState = "DISABLED" | "CANARY" | "ACTIVE" | "DEGRADED";

export type HealthScore = "ONLINE" | "DEGRADED" | "DOWN";

export interface ToolHealthMetrics {
  error_rate: number; // 0-1
  latency_p99: number; // milliseconds
  cost_delta: number; // 0-1 (% change from baseline)
  success_rate: number; // 0-1
  timestamp: number;
}

export interface ToolState {
  toolId: string;
  version: string;
  lifecycle: ToolLifecycleState;
  health: HealthScore;
  metrics: ToolHealthMetrics;
  canaryPercentage?: number; // 0-100 for CANARY state
}

export interface LifecycleTransition {
  from: ToolLifecycleState;
  to: ToolLifecycleState;
  reason: string;
  timestamp: number;
}

export interface ToolRegistration {
  toolId: string;
  version: string;
  entrypoint: string;
  dependencies: string[];
  metadata: Record<string, unknown>;
}

export interface LifecycleEvent {
  type: "registered" | "promoted" | "degraded" | "disabled" | "canary_updated" | "health_check";
  timestamp: number;
  toolId: string;
  details: Record<string, unknown>;
}
