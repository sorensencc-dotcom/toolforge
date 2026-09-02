export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DriftSignal {
  severity: Severity;
  [key: string]: unknown;
}

export interface HydrationFailure {
  severity: Severity;
  [key: string]: unknown;
}

/** Shape returned by CIC Ingestion's /execute/:adapter route */
export interface QualityMetrics {
  driftSignals: DriftSignal[];
  hydrationFailures: HydrationFailure[];
  hitRate: number;
}
