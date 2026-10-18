import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('icf/dashboard/index.html contains TRM action backlog UI elements and promote modal', () => {
  const targetPath = path.resolve('c:/dev/icf/dashboard/index.html');
  assert.ok(fs.existsSync(targetPath), 'Canonical dashboard at icf/dashboard/index.html must exist');
  const dashboardHtml = fs.readFileSync(targetPath, 'utf8');

  // Verify Tab 04 backlog elements exist
  assert.ok(dashboardHtml.includes('id="trmBacklogTableBody"'), 'Missing trmBacklogTableBody');
  assert.ok(dashboardHtml.includes('id="promoteModal"'), 'Missing promoteModal overlay');
  assert.ok(dashboardHtml.includes('id="promoteTitleInput"'), 'Missing promoteTitleInput');
  assert.ok(dashboardHtml.includes('id="promoteRepoInput"'), 'Missing promoteRepoInput');
  assert.ok(dashboardHtml.includes('id="promoteBodyInput"'), 'Missing promoteBodyInput');

  // Verify JavaScript handler functions exist
  assert.ok(dashboardHtml.includes('function loadTrmBacklog'), 'Missing loadTrmBacklog function');
  assert.ok(dashboardHtml.includes('function filterTrmBacklog'), 'Missing filterTrmBacklog function');
  assert.ok(dashboardHtml.includes('function openPromoteModal'), 'Missing openPromoteModal function');
  assert.ok(dashboardHtml.includes('function submitPromoteModal'), 'Missing submitPromoteModal function');

  // Verify Tab 04 backlog filter controls exist and default to OPEN
  assert.ok(dashboardHtml.includes('id="btnBacklogFilterOpen"'), 'Missing btnBacklogFilterOpen button');
  assert.ok(dashboardHtml.includes('id="btnBacklogFilterCompleted"'), 'Missing btnBacklogFilterCompleted button');
  assert.ok(dashboardHtml.includes("let currentTrmBacklogFilter = 'OPEN';"), 'Default backlog filter must be OPEN');
  assert.ok(dashboardHtml.includes("currentTrmBacklogFilter === 'COMPLETED'"), 'Missing COMPLETED filter handling');

  // Verify Tab 04 gaps matrix controls exist
  assert.ok(dashboardHtml.includes('id="trmGapsSearchInput"'), 'Missing trmGapsSearchInput');
  assert.ok(dashboardHtml.includes('id="btnGapFilterAll"'), 'Missing btnGapFilterAll');
  assert.ok(dashboardHtml.includes('id="btnGapFilterOpen"'), 'Missing btnGapFilterOpen');
  assert.ok(dashboardHtml.includes('id="btnGapFilterTriaged"'), 'Missing btnGapFilterTriaged');
  assert.ok(dashboardHtml.includes('id="btnGapFilterResolved"'), 'Missing btnGapFilterResolved');
  assert.ok(dashboardHtml.includes('function filterTrmGaps'), 'Missing filterTrmGaps function');
  assert.ok(dashboardHtml.includes('function renderTrmGapsTable'), 'Missing renderTrmGapsTable function');

  // REGRESSION GUARD: Ensure modern Cathryn Lavery layout and theme switcher are never overwritten
  assert.ok(dashboardHtml.includes('data-theme="parchment"') || dashboardHtml.includes("applyTheme('parchment')"), 'Missing Warm Parchment theme support');
  assert.ok(dashboardHtml.includes('class="command-header"'), 'Missing modern command-header layout');
  assert.ok(dashboardHtml.includes('class="tab-strip"'), 'Missing modern tab-strip navigation');
  assert.ok(dashboardHtml.includes('id="btnParchment"'), 'Missing Warm Parchment theme switcher button');
  assert.ok(dashboardHtml.includes('id="btnForge"'), 'Missing Dark Forge theme switcher button');

  // REGRESSION GUARD: Modal must never fall back to IronLedger for cards
  assert.ok(!dashboardHtml.includes("card.repo || 'IronLedger'"), 'Must not fall back to hardcoded IronLedger');
  assert.ok(dashboardHtml.includes('BACKLOG_DOMAIN_TO_REPO'), 'Missing BACKLOG_DOMAIN_TO_REPO mapping');
  assert.ok(dashboardHtml.includes('resolveRepoForCard'), 'Missing resolveRepoForCard helper');
});
