import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('CIC daily pipeline files exist in scripts directory', () => {
  const requiredFiles = [
    'scripts/run_daily_pipeline.ps1',
    'scripts/aggregate_status.py',
    'scripts/render_status_html.py',
    'scripts/render_dashboard.py',
    'scripts/Run-DailyStatus.ps1',
    'scripts/Mirror-ClaudeMemory.ps1',
  ];

  for (const file of requiredFiles) {
    const fullPath = resolve(repoRoot, file);
    assert.ok(existsSync(fullPath), `Expected ${file} to exist in repository`);
  }
});

test('render_dashboard.py writes HTML with utf-8 encoding and avoids deprecated utcnow', () => {
  const dashboardScript = readFileSync(resolve(repoRoot, 'scripts/render_dashboard.py'), 'utf8');
  assert.match(dashboardScript, /open\(output_file,\s*'w',\s*encoding='utf-8'\)/);
  assert.doesNotMatch(dashboardScript, /datetime\.utcnow\(\)/);
});

test('downstream pipeline orchestrators reference scripts/run_daily_pipeline.ps1', () => {
  const catchupScript = readFileSync(resolve(repoRoot, 'scripts/catchup-daily-pipeline.ps1'), 'utf8');
  assert.match(catchupScript, /run_daily_pipeline\.ps1/);

  const ondemandScript = readFileSync(resolve(repoRoot, 'scripts/run-ondemand-mine.ps1'), 'utf8');
  assert.match(ondemandScript, /run_daily_pipeline\.ps1/);

  const dashboardHtml = readFileSync(resolve(repoRoot, 'dashboard.html'), 'utf8');
  assert.match(dashboardHtml, /run_daily_pipeline\.ps1/);
});
