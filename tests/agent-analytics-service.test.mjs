import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AgentAnalyticsService } from '../rewrite-mcp/src/analytics/AgentAnalyticsService.ts';

test('AgentAnalyticsService computes metrics, token costs, and error distributions', async () => {
  const service = new AgentAnalyticsService();
  await service.initialize();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'service-test-'));
  const logFile = path.join(tmpDir, 'test-trajectory.jsonl');

  const lines = [
    JSON.stringify({
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 10000,
      completion_tokens: 2000,
      duration_ms: 300,
      tool_name: 'view_file',
      status: 'SUCCESS',
    }),
    JSON.stringify({
      step_index: 2,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 15000,
      completion_tokens: 3000,
      duration_ms: 1200,
      tool_name: 'run_command',
      status: 'ERROR',
    }),
  ];
  fs.writeFileSync(logFile, lines.join('\n'), 'utf8');

  try {
    const toolMetrics = await service.getToolPerformanceMetrics(logFile);
    assert.equal(toolMetrics.length, 2);

    const runCmd = toolMetrics.find((t) => t.tool_name === 'run_command');
    assert.ok(runCmd);
    assert.equal(runCmd.total_invocations, 1);
    assert.equal(runCmd.total_errors, 1);
    assert.equal(runCmd.error_rate_pct, 100);

    const tokenExp = await service.getTokenExpenditure(logFile);
    assert.equal(tokenExp.length, 1);
    assert.equal(tokenExp[0].total_prompt_tokens, 25000);
    assert.equal(tokenExp[0].total_completion_tokens, 5000);
    assert.ok(tokenExp[0].estimated_cost_usd > 0);

    const errorDist = await service.getErrorDistribution(logFile);
    assert.equal(errorDist.length, 1);
    assert.equal(errorDist[0].tool_name, 'run_command');

    const trajectory = await service.getSessionTrajectory(logFile, 'sess-test-999');
    assert.equal(trajectory.session_id, 'sess-test-999');
    assert.equal(trajectory.total_steps, 2);
    assert.equal(trajectory.error_count, 1);
    assert.deepEqual(trajectory.tools_used.sort(), ['run_command', 'view_file']);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await service.close();
  }
});
