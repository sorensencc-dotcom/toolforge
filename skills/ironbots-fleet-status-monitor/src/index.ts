/**
 * ironbots-fleet-status-monitor
 * 
 * Aggregates live telemetry and execution health across all 9 Ironbots fleet tasks.
 */

import * as fs from 'fs';
import * as path from 'path';

export const REQUIRED_FLEET_TASKS = [
  'Notebook-Ingester',
  'KB-Sentinel',
  'TRM-Bot',
  'Watchlist-Miner',
  'Daemon-Healer',
  'CI-Watchdog',
  'TRM-Drive-Sync',
  'Storage-Pruner',
  'Ironbots-Reporter'
];

export const TASK_ARTIFACT_MAPPINGS: Record<string, string> = {
  'Notebook-Ingester': 'notebook_ingester_report.json',
  'KB-Sentinel': 'kb_sentinel_report.json',
  'TRM-Bot': 'trm_bot_report.json',
  'Watchlist-Miner': 'watchlist_miner_report.json',
  'Daemon-Healer': 'daemon_health.json',
  'CI-Watchdog': 'ci_alerts.json',
  'TRM-Drive-Sync': 'trm_ingress_status.json',
  'Storage-Pruner': 'storage_pruner_status.json',
  'Ironbots-Reporter': 'ironbots_daily_report.json'
};

export interface MonitorInput {
  action: 'status' | 'aggregate' | 'diagnose';
  statusFeedDir?: string;
  taskFilter?: string[];
  verbose?: boolean;
}

export interface TaskTelemetry {
  taskId: string;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
  lastRun?: string;
  exitCode?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface MonitorOutput {
  status: 'success' | 'warning' | 'error';
  fleetScore: number;
  totalTasks: number;
  healthyCount: number;
  failedCount: number;
  tasks: TaskTelemetry[];
  alerts: string[];
  timestamp: string;
}

export function inspectTaskTelemetry(
  taskId: string,
  feedDir: string
): TaskTelemetry {
  const artifactName = TASK_ARTIFACT_MAPPINGS[taskId];
  if (!artifactName) {
    return {
      taskId,
      status: 'UNKNOWN',
      message: `No artifact mapping for task ${taskId}`
    };
  }

  const filePath = path.resolve(feedDir, artifactName);
  if (!fs.existsSync(filePath)) {
    return {
      taskId,
      status: 'UNKNOWN',
      message: `Artifact file not found: ${artifactName}`
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    
    // Determine status from artifact payload
    let taskStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN' = 'HEALTHY';
    let message = 'Telemetry OK';

    if (data.status === 'error' || data.status === 'FAILED' || (typeof data.errors === 'number' && data.errors > 0)) {
      taskStatus = 'FAILED';
      message = data.message || data.error || 'Task reported errors';
    } else if (data.status === 'warning' || data.status === 'DEGRADED' || (typeof data.warnings === 'number' && data.warnings > 0)) {
      taskStatus = 'DEGRADED';
      message = data.message || 'Task reported warnings';
    }

    return {
      taskId,
      status: taskStatus,
      lastRun: data.timestamp || data.lastRun || new Date().toISOString(),
      exitCode: data.exitCode ?? 0,
      message,
      details: data
    };
  } catch (err: any) {
    return {
      taskId,
      status: 'FAILED',
      message: `Failed to parse telemetry: ${err.message}`
    };
  }
}

export async function runMonitor(input: MonitorInput): Promise<MonitorOutput> {
  const feedDir = input.statusFeedDir || path.resolve(process.cwd(), '_status-feed');
  const targetTasks = input.taskFilter && input.taskFilter.length > 0
    ? input.taskFilter
    : REQUIRED_FLEET_TASKS;

  const taskResults: TaskTelemetry[] = [];
  const alerts: string[] = [];

  let healthyCount = 0;
  let failedCount = 0;

  for (const taskId of targetTasks) {
    const telemetry = inspectTaskTelemetry(taskId, feedDir);
    taskResults.push(telemetry);

    if (telemetry.status === 'HEALTHY') {
      healthyCount++;
    } else if (telemetry.status === 'FAILED') {
      failedCount++;
      alerts.push(`[ALERT] Task ${taskId} is in FAILED state: ${telemetry.message}`);
    } else if (telemetry.status === 'DEGRADED') {
      alerts.push(`[WARN] Task ${taskId} is DEGRADED: ${telemetry.message}`);
    }
  }

  const totalTasks = targetTasks.length;
  const fleetScore = totalTasks > 0
    ? Math.max(0, Math.round(((healthyCount + 0.5 * (totalTasks - healthyCount - failedCount)) / totalTasks) * 100))
    : 100;

  const overallStatus: 'success' | 'warning' | 'error' = failedCount > 0
    ? 'error'
    : alerts.length > 0
      ? 'warning'
      : 'success';

  return {
    status: overallStatus,
    fleetScore,
    totalTasks,
    healthyCount,
    failedCount,
    tasks: taskResults,
    alerts,
    timestamp: new Date().toISOString()
  };
}

// Entrypoint wrapper
export default async function handler(input: MonitorInput): Promise<MonitorOutput> {
  if (!input || !input.action) {
    throw new Error('Missing required property: action');
  }
  return runMonitor(input);
}
