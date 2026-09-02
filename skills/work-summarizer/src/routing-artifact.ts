import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { DriftSignal } from "./drift-detector.js";
import { WeeklyAggregation } from "./weekly-aggregator.js";

export interface SubsystemActivity {
  subsystem: string;
  category: string;
  file_count: number;
  activity_type: string[];
  complexity: string;
  drift_detected: boolean;
}

export interface RepoDelta {
  repo_name: string;
  files_changed: number;
  lines_added: number;
  lines_deleted: number;
  active_subsystems: string[];
}

export interface RoutingHint {
  priority: "high" | "medium" | "low";
  reason: string;
  subsystem: string;
}

export interface WorkSummaryArtifact {
  version: string;
  generated_at: string;
  mode: "daily" | "weekly";
  subsystem_activity: SubsystemActivity[];
  drift_signals: DriftSignal;
  repo_deltas: RepoDelta[];
  operator_intent: {
    primary_focus: string;
    secondary_focus: string[];
    blocked_areas: string[];
  };
  routing_hints: RoutingHint[];
}

export function buildRoutingArtifact(
  mode: "daily" | "weekly",
  subsystemActivity: SubsystemActivity[],
  driftSignals: DriftSignal,
  repoDeltas: RepoDelta[]
): WorkSummaryArtifact {
  // Determine primary focus from most active subsystem
  let primaryFocus = "general-maintenance";
  if (subsystemActivity.length > 0) {
    const sorted = [...subsystemActivity].sort(
      (a, b) => b.file_count - a.file_count
    );
    primaryFocus = sorted[0].subsystem;
  }

  // Secondary focus: any subsystem with medium activity
  const secondaryFocus = subsystemActivity
    .filter(s => s.file_count >= 3 && s.file_count < 10)
    .map(s => s.subsystem)
    .slice(0, 2);

  // Blocked areas: subsystems with drift
  const blockedAreas = subsystemActivity
    .filter(s => s.drift_detected)
    .map(s => s.subsystem);

  // Build routing hints
  const routingHints: RoutingHint[] = [];

  // High priority: complex work or drift-related
  for (const subsystem of subsystemActivity) {
    if (subsystem.complexity === "major" || subsystem.drift_detected) {
      routingHints.push({
        priority: "high",
        reason: subsystem.drift_detected
          ? "Drift detected in subsystem"
          : "Major complexity changes",
        subsystem: subsystem.subsystem
      });
    }
  }

  // Medium priority: moderate activity
  for (const subsystem of subsystemActivity) {
    if (
      subsystem.complexity === "moderate" &&
      !subsystem.drift_detected
    ) {
      routingHints.push({
        priority: "medium",
        reason: "Moderate activity level",
        subsystem: subsystem.subsystem
      });
    }
  }

  return {
    version: "2.0.0",
    generated_at: new Date().toISOString(),
    mode,
    subsystem_activity: subsystemActivity,
    drift_signals: driftSignals,
    repo_deltas: repoDeltas,
    operator_intent: {
      primary_focus: primaryFocus,
      secondary_focus: secondaryFocus,
      blocked_areas: blockedAreas
    },
    routing_hints: routingHints
  };
}

export function writeRoutingArtifact(
  artifact: WorkSummaryArtifact,
  queueDir: string
): string {
  try {
    // Ensure queue directory exists
    mkdirSync(queueDir, { recursive: true });

    const outputPath = join(queueDir, "work-summary.artifact.json");
    const content = JSON.stringify(artifact, null, 2);
    writeFileSync(outputPath, content, "utf-8");

    return outputPath;
  } catch (error) {
    throw new Error(
      `Failed to write routing artifact: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function validateRoutingArtifact(
  artifact: WorkSummaryArtifact
): boolean {
  // Basic validation
  if (!artifact.version || !artifact.generated_at || !artifact.mode) {
    return false;
  }

  if (!Array.isArray(artifact.subsystem_activity)) {
    return false;
  }

  if (!artifact.drift_signals || typeof artifact.drift_signals.type !== "string") {
    return false;
  }

  if (!Array.isArray(artifact.repo_deltas)) {
    return false;
  }

  if (!artifact.operator_intent || !artifact.operator_intent.primary_focus) {
    return false;
  }

  return true;
}
