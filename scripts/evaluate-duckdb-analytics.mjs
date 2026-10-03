/**
 * @file evaluate-duckdb-analytics.mjs
 * @description Evaluator and analytics service for Rewrite-MCP agent trajectories.
 * Computes token expenditure, tool error rates, and percentile latencies over JSONL logs.
 */

import fs from 'node:fs';
import readline from 'node:readline';

/**
 * Calculates continuous percentile using linear interpolation.
 * @param {number[]} numbers - Sorted array of numbers
 * @param {number} p - Percentile between 0 and 1 (e.g. 0.95)
 * @returns {number}
 */
export function calculatePercentile(numbers, p) {
  if (!numbers || numbers.length === 0) return 0;
  if (numbers.length === 1) return numbers[0];

  const sorted = [...numbers].sort((a, b) => a - b);
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Analyzes streaming agent session logs from a JSONL file.
 * @param {string} filePath - Absolute path to JSONL log file
 * @returns {Promise<Object>} Summary analytics object
 */
export async function analyzeAgentTrajectory(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Trajectory file not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const toolStats = new Map();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalSteps = 0;
  let totalErrors = 0;
  let malformedLines = 0;
  const latencies = [];

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed);
      totalSteps += 1;

      if (entry.prompt_tokens) totalPromptTokens += Number(entry.prompt_tokens) || 0;
      if (entry.completion_tokens) totalCompletionTokens += Number(entry.completion_tokens) || 0;
      if (entry.duration_ms != null) latencies.push(Number(entry.duration_ms));

      if (entry.status === 'ERROR' || entry.error) {
        totalErrors += 1;
      }

      if (entry.tool_name) {
        const name = String(entry.tool_name);
        if (!toolStats.has(name)) {
          toolStats.set(name, {
            toolName: name,
            invocations: 0,
            errors: 0,
            durations: [],
          });
        }
        const stat = toolStats.get(name);
        stat.invocations += 1;
        if (entry.status === 'ERROR' || entry.error) {
          stat.errors += 1;
        }
        if (entry.duration_ms != null) {
          stat.durations.push(Number(entry.duration_ms));
        }
      }
    } catch {
      malformedLines += 1;
    }
  }

  const formattedTools = Array.from(toolStats.values()).map((t) => {
    const avgDuration =
      t.durations.length > 0
        ? t.durations.reduce((acc, v) => acc + v, 0) / t.durations.length
        : 0;
    const p95Duration = calculatePercentile(t.durations, 0.95);
    const errorRatePct = t.invocations > 0 ? (t.errors / t.invocations) * 100 : 0;

    return {
      toolName: t.toolName,
      invocations: t.invocations,
      errors: t.errors,
      errorRatePct: Number(errorRatePct.toFixed(2)),
      avgDurationMs: Number(avgDuration.toFixed(2)),
      p95DurationMs: Number(p95Duration.toFixed(2)),
    };
  });

  const overallAvgLatency =
    latencies.length > 0
      ? latencies.reduce((acc, v) => acc + v, 0) / latencies.length
      : 0;
  const overallP95Latency = calculatePercentile(latencies, 0.95);

  return {
    totalSteps,
    malformedLines,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens: totalPromptTokens + totalCompletionTokens,
    totalErrors,
    errorRatePct: totalSteps > 0 ? Number(((totalErrors / totalSteps) * 100).toFixed(2)) : 0,
    avgLatencyMs: Number(overallAvgLatency.toFixed(2)),
    p95LatencyMs: Number(overallP95Latency.toFixed(2)),
    tools: formattedTools,
  };
}

/**
 * Formats analytical metrics into an executive summary markdown table.
 * @param {Object} report
 * @returns {string}
 */
export function formatReportMarkdown(report) {
  let md = `### Agent Telemetry & Analytics Summary\n\n`;
  md += `| Metric | Value |\n| :--- | :--- |\n`;
  md += `| **Total Steps** | ${report.totalSteps} |\n`;
  if (report.malformedLines > 0) {
    md += `| **Malformed Lines** | ${report.malformedLines} |\n`;
  }
  md += `| **Prompt Tokens** | ${report.totalPromptTokens.toLocaleString()} |\n`;
  md += `| **Completion Tokens** | ${report.totalCompletionTokens.toLocaleString()} |\n`;
  md += `| **Total Tokens** | ${report.totalTokens.toLocaleString()} |\n`;
  md += `| **Total Errors** | ${report.totalErrors} (${report.errorRatePct}%) |\n`;
  md += `| **Avg Step Latency** | ${report.avgLatencyMs} ms |\n`;
  md += `| **P95 Latency** | ${report.p95LatencyMs} ms |\n\n`;

  if (report.tools && report.tools.length > 0) {
    md += `#### Tool Invocation Breakdown\n\n`;
    md += `| Tool Name | Invocations | Errors | Error Rate | Avg Duration (ms) | P95 Duration (ms) |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const tool of report.tools) {
      md += `| \`${tool.toolName}\` | ${tool.invocations} | ${tool.errors} | ${tool.errorRatePct}% | ${tool.avgDurationMs} | ${tool.p95DurationMs} |\n`;
    }
  }

  return md;
}
