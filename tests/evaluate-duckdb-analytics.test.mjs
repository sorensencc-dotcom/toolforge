import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  calculatePercentile,
  analyzeAgentTrajectory,
  formatReportMarkdown,
} from '../scripts/evaluate-duckdb-analytics.mjs';

test('calculatePercentile computes correct p95 and edge percentiles', () => {
  const empty = [];
  assert.equal(calculatePercentile(empty, 0.95), 0);

  const single = [100];
  assert.equal(calculatePercentile(single, 0.95), 100);

  const dataset = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const p95 = calculatePercentile(dataset, 0.95);
  assert.equal(p95, 95.5);

  const p50 = calculatePercentile(dataset, 0.5);
  assert.equal(p50, 55);
});

test('analyzeAgentTrajectory correctly parses JSONL streams and computes aggregations', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-test-'));
  const logFile = path.join(tmpDir, 'test-transcript.jsonl');

  const lines = [
    JSON.stringify({
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 1200,
      completion_tokens: 300,
      duration_ms: 250,
      tool_name: 'view_file',
      status: 'SUCCESS',
    }),
    JSON.stringify({
      step_index: 2,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 1400,
      completion_tokens: 150,
      duration_ms: 800,
      tool_name: 'run_command',
      status: 'SUCCESS',
    }),
    JSON.stringify({
      step_index: 3,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 1600,
      completion_tokens: 200,
      duration_ms: 1200,
      tool_name: 'run_command',
      status: 'ERROR',
    }),
    JSON.stringify({
      step_index: 4,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 1800,
      completion_tokens: 400,
      duration_ms: 150,
      tool_name: 'view_file',
      status: 'SUCCESS',
    }),
  ];

  fs.writeFileSync(logFile, lines.join('\n'), 'utf8');

  try {
    const report = await analyzeAgentTrajectory(logFile);

    assert.equal(report.totalSteps, 4);
    assert.equal(report.totalPromptTokens, 6000);
    assert.equal(report.totalCompletionTokens, 1050);
    assert.equal(report.totalTokens, 7050);
    assert.equal(report.totalErrors, 1);
    assert.equal(report.errorRatePct, 25);
    assert.equal(report.avgLatencyMs, 600);

    const viewFileStat = report.tools.find((t) => t.toolName === 'view_file');
    assert.ok(viewFileStat);
    assert.equal(viewFileStat.invocations, 2);
    assert.equal(viewFileStat.errors, 0);
    assert.equal(viewFileStat.errorRatePct, 0);
    assert.equal(viewFileStat.avgDurationMs, 200);

    const runCommandStat = report.tools.find((t) => t.toolName === 'run_command');
    assert.ok(runCommandStat);
    assert.equal(runCommandStat.invocations, 2);
    assert.equal(runCommandStat.errors, 1);
    assert.equal(runCommandStat.errorRatePct, 50);
    assert.equal(runCommandStat.avgDurationMs, 1000);

    const markdown = formatReportMarkdown(report);
    assert.ok(markdown.includes('Agent Telemetry & Analytics Summary'));
    assert.ok(markdown.includes('`run_command`'));
    assert.ok(markdown.includes('`view_file`'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
