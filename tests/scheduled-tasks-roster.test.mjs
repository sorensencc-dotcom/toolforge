import test from 'node:test';
import assert from 'node:assert/strict';
import { TASK_DEFINITIONS, generateMarkdownReport } from '../scripts/generate-scheduled-tasks-roster.mjs';

test('TASK_DEFINITIONS contains exactly 35 scheduled tasks with required fields', () => {
  assert.equal(TASK_DEFINITIONS.length, 35, `Expected 35 tasks, found ${TASK_DEFINITIONS.length}`);

  for (const task of TASK_DEFINITIONS) {
    assert.ok(task.name && typeof task.name === 'string', 'Task must have a non-empty name');
    assert.ok(task.path && task.path.startsWith('\\') && task.path.endsWith('\\'), `Task path must be formatted as \\Folder\\: ${task.path}`);
    assert.ok(task.ironbot && typeof task.ironbot === 'string', `Task must have an ironbot owner: ${task.name}`);
    assert.ok(task.subsystem && typeof task.subsystem === 'string', `Task must specify subsystem: ${task.name}`);
    assert.ok(task.script && typeof task.script === 'string', `Task must specify entrypoint script: ${task.name}`);
    assert.ok(task.schedule && typeof task.schedule === 'string', `Task must specify schedule trigger: ${task.name}`);
    assert.ok(task.purpose && task.purpose.length > 10, `Task must have a descriptive purpose: ${task.name}`);
  }
});

test('generateMarkdownReport compiles complete markdown with headers and tables', () => {
  const mockLiveStatus = [
    { Name: 'Notebook-Ingester', Path: '\\Ironbots\\', State: 'Ready', LastRun: '10/17/2026 2:00:00 AM', LastResult: '0x00000000' },
    { Name: 'KB-Sync-Master-Pipeline', Path: '\\KB-SYNC\\', State: 'Ready', LastRun: '10/16/2026 8:00:00 PM', LastResult: '0x00000000' }
  ];

  const md = generateMarkdownReport(TASK_DEFINITIONS, mockLiveStatus);

  assert.ok(md.includes('# Windows Scheduled Tasks Master Roster'), 'Must have main title');
  assert.ok(md.includes('Total Monitored Tasks'), 'Must have task count callout');
  assert.ok(md.includes('### 1. Ironbots Fleet'), 'Must have Ironbots section');
  assert.ok(md.includes('### 2. KB-Sync Knowledge Plane'), 'Must have KB-Sync section');
  assert.ok(md.includes('### 3. Toolforge Core & Governance'), 'Must have Toolforge section');
  assert.ok(md.includes('### 4. Cast Iron Charlie'), 'Must have CIC section');
  assert.ok(md.includes('### 5. Topic Research Mining'), 'Must have TRM section');
  assert.ok(md.includes('### 6. Standalone Services & Daemons'), 'Must have Standalone section');
  assert.ok(md.includes('Notebook-Ingester'), 'Must include Notebook-Ingester in output');
  assert.ok(md.includes('KB-Sync-Master-Pipeline'), 'Must include KB-Sync-Master-Pipeline in output');
  assert.ok(md.includes('0x00000000'), 'Must render live task result code');
});
