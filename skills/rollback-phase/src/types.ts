// Rollback phase state machine + contracts

export type RollbackState = "IDLE" | "INIT" | "RESTORE_CONFIG" | "RESTORE_FLAGS" | "HEALTH_CHECK" | "COMPLETE" | "FAIL";

export interface Checkpoint {
  phaseId: string;
  timestamp: number;
  configSnapshot: Record<string, unknown>;
  flagSnapshot: Record<string, unknown>;
  metadataSnapshot: Record<string, unknown>;
}

export interface RollbackPlan {
  checkpointId: string;
  targetPhase: number;
  steps: RollbackStep[];
  estimatedDuration: number;
}

export interface RollbackStep {
  id: string;
  type: "validate" | "restore_config" | "restore_flags" | "health_check";
  status: "pending" | "in_progress" | "complete" | "failed";
  error?: string;
}

export interface HealthCheckResult {
  passed: boolean;
  metrics: {
    error_rate: number;
    latency_p99: number;
    cost_delta: number;
  };
  timestamp: number;
  reason?: string;
}

export interface RollbackEvent {
  type: "started" | "checkpoint_loaded" | "config_restored" | "flags_restored" | "health_passed" | "completed" | "failed";
  timestamp: number;
  details: Record<string, unknown>;
}

export interface RollbackResult {
  phaseId: string;
  rollbackStatus: "completed" | "failed" | "pending";
  restored: boolean;
  checkpointId?: string;
  events: RollbackEvent[];
  error?: string;
}
