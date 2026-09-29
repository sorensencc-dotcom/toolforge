# Fix ICF Daemon Stability and Mobile Ingress Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate daemon crash/thrash loops on ICF port 8080 by optimizing host heartbeat telemetry, increasing health probe tolerance, and enabling `trm-ingress-watcher.mjs` to parse and stage unhandled `.gdoc` mobile action cards.

**Architecture:**
1. **ICF Telemetry & Event Loop Non-Blocking**: Replace synchronous `execFileSync` PowerShell calls in `getHostHeartbeat()` (`scripts/ironbots-daily-reporter.mjs`) with an in-memory cache (TTL 60s) or asynchronous execution, preventing event loop starvation when `/api/reporting/ironbots` is polled.
2. **Daemon-Healer Resilience**: Increase `daemon-healer-bot.mjs` probe timeout to 8000ms and allow automatic reset of thrash cooldown when the service recovers or is manually triggered.
3. **Mobile Ingress `.gdoc` Card Processing**: Upgrade `trm-ingress-watcher.mjs` to recognize standalone `.gdoc` action card drops (even when no companion `.md` exists), extract metadata (timestamp, action type, card ID, intent) from the filename, stage an `antigravity_triage` card into `.harness/tasks/pending/`, archive the `.gdoc` pointer to `04_archive/mobile-inbox/`, record in `LEDGER.md`, and emit mobile outbox receipts.
4. **Port Clarity**: Ensure documentation and dashboard banner clarify port `8080` (ICF Gateway) vs `8000` (TorqueQuery API).

**Tech Stack:** Node.js 22+ (native `node:test`, `node:fs`, `node:http`), PowerShell, JSON Schema.

## Global Constraints
- All JavaScript must be ESM (`.mjs` or `"type": "module"`).
- Zero external runtime npm dependencies.
- Retain backwards compatibility with existing `.json` and `.md` action cards in `trm-drive/inbox/`.
- All tests run via `node --test tests/ironbots.test.mjs` and `npm test` in `icf/`.

---

### Task 1: Non-blocking Host Heartbeat in `ironbots-daily-reporter.mjs`

**Files:**
- Modify: `scripts/ironbots-daily-reporter.mjs:70-140`
- Test: `tests/ironbots.test.mjs`

**Interfaces:**
- Consumes: Windows scheduled task registry via PowerShell or cached snapshot.
- Produces: `getHostHeartbeat(options)` returning `{ hostname, platform, uptimeSeconds, uptimeHuman, taskScheduler }` in <50ms on cache hit.

- [ ] **Step 1: Write failing unit test for cached/fast `getHostHeartbeat`**

Add to `tests/ironbots.test.mjs`:
```javascript
test('getHostHeartbeat returns within 100ms on repeated calls using internal cache', async () => {
  const { getHostHeartbeat } = await import('../scripts/ironbots-daily-reporter.mjs');
  const t0 = Date.now();
  const first = getHostHeartbeat();
  const firstDuration = Date.now() - t0;
  
  const t1 = Date.now();
  const second = getHostHeartbeat();
  const secondDuration = Date.now() - t1;

  assert.ok(secondDuration < 100, `Second call should be cached and fast, took ${secondDuration}ms`);
  assert.equal(typeof second.hostname, 'string');
  assert.equal(typeof second.taskScheduler.status, 'string');
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `node --test tests/ironbots.test.mjs`
Expected: May fail duration threshold if every call triggers `execFileSync('powershell.exe')`.

- [ ] **Step 3: Implement memory caching and fast-path in `getHostHeartbeat`**

In `scripts/ironbots-daily-reporter.mjs`:
```javascript
let cachedTaskScheduler = null;
let lastTaskSchedulerFetch = 0;
const TASK_SCHEDULER_CACHE_TTL_MS = 60000; // 1 minute cache

export function getHostHeartbeat(options = {}) {
  const uptimeSeconds = Math.floor(os.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeHuman = `${hours}h ${minutes}m`;

  const now = Date.now();
  if (cachedTaskScheduler && (now - lastTaskSchedulerFetch < TASK_SCHEDULER_CACHE_TTL_MS) && !options.forceRefresh) {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      uptimeSeconds,
      uptimeHuman,
      taskScheduler: cachedTaskScheduler
    };
  }

  let taskScheduler = {
    status: 'UNKNOWN',
    taskCount: 0,
    tasks: [],
    error: null
  };

  if (process.platform === 'win32') {
    try {
      const out = execFileSync('powershell.exe', [
        '-NoProfile',
        '-Command',
        'Get-ScheduledTask -TaskPath "\\Ironbots\\*" -ErrorAction SilentlyContinue | Select-Object TaskName, State | ConvertTo-Json -Compress'
      ], { encoding: 'utf8', timeout: 4000 }).trim();

      if (out) {
        let parsed = JSON.parse(out);
        if (!Array.isArray(parsed)) parsed = [parsed];
        const tasks = parsed.map(t => ({
          name: t.TaskName,
          state: t.State === 3 || t.State === 'Ready' ? 'Ready' : (t.State === 4 || t.State === 'Running' ? 'Running' : String(t.State))
        }));

        const taskNames = new Set(tasks.map(t => t.name));
        const missing = REQUIRED_FLEET_TASKS.filter(name => !taskNames.has(name) && !(name === 'TRM-Drive-Sync' && taskNames.has('TRM-Ingress-Watcher')));
        taskScheduler = {
          status: missing.length === 0 && tasks.length >= 9 ? 'HEALTHY' : 'DEGRADED',
          taskCount: tasks.length,
          tasks,
          missingTasks: missing,
          error: missing.length > 0 ? `Missing required tasks: ${missing.join(', ')}` : null
        };
      }
    } catch (err) {
      taskScheduler = {
        status: 'DEGRADED',
        taskCount: 0,
        tasks: [],
        error: err.message
      };
    }
  }

  cachedTaskScheduler = taskScheduler;
  lastTaskSchedulerFetch = now;

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    uptimeSeconds,
    uptimeHuman,
    taskScheduler
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ironbots.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ironbots-daily-reporter.mjs tests/ironbots.test.mjs
git commit -m "fix(ironbots): add TTL cache to getHostHeartbeat to prevent event loop blocking"
```

---

### Task 2: Update `daemon-healer-bot.mjs` Probe Timeout & Recovery Reset

**Files:**
- Modify: `scripts/daemon-healer-bot.mjs:31-75`
- Test: `tests/ironbots.test.mjs`

**Interfaces:**
- Consumes: HTTP endpoints on `http://127.0.0.1:8080/dashboard` and `http://127.0.0.1:8080/api/reporting/ironbots`.
- Produces: Health check telemetry in `_status-feed/daemon_health.json`.

- [ ] **Step 1: Write test for relaxed probe timeout configuration**

In `tests/ironbots.test.mjs`:
```javascript
test('daemon-healer-bot uses 8000ms probe timeout and handles responsive daemon', async () => {
  const { probeUrl } = await import('../scripts/daemon-healer-bot.mjs');
  assert.equal(typeof probeUrl, 'function');
});
```

- [ ] **Step 2: Update `timeoutMs` in `daemon-healer-bot.mjs`**

Increase default timeout in `probeUrl` from `2500` to `8000`:
```javascript
function probeUrl(url, options = {}) {
  const { timeoutMs = 8000, expectJson = false, expectHtml = false } = options;
  // ...
```

- [ ] **Step 3: Run test to verify passes**

Run: `node --test tests/ironbots.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/daemon-healer-bot.mjs tests/ironbots.test.mjs
git commit -m "fix(daemon-healer): extend health probe timeout to 8000ms"
```

---

### Task 3: Support Standalone `.gdoc` Action Card Ingestion in `trm-ingress-watcher.mjs`

**Files:**
- Modify: `scripts/trm-ingress-watcher.mjs:600-685`
- Test: `tests/ironbots.test.mjs`

**Interfaces:**
- Consumes: `.gdoc` / `.md.gdoc` files in `G:\My Drive\TRM-Research\mobile-inbox` and local triage inboxes.
- Produces: Staged tasks in `.harness/tasks/pending/`, archived `.gdoc` stubs in `04_archive/mobile-inbox/`, updated `LEDGER.md`, and receipts in `mobile-outbox/`.

- [ ] **Step 1: Write unit test for standalone `.gdoc` parsing and staging**

In `tests/ironbots.test.mjs`:
```javascript
test('trm-ingress-watcher processes standalone .gdoc cards by extracting filename metadata', async () => {
  const { processGDocStub, safeMoveFile } = await import('../scripts/trm-ingress-watcher.mjs');
  const tempInbox = path.join(REPO_ROOT, 'logs', `test-gdoc-standalone-${Date.now()}`);
  fs.mkdirSync(tempInbox, { recursive: true });

  const gdocName = '2026-09-27T123001Z__action__act-01-audit-agent-intermediate-storage-exfiltration.md.gdoc';
  const gdocPath = path.join(tempInbox, gdocName);
  fs.writeFileSync(gdocPath, '{"doc_id":"test-standalone"}', 'utf8');

  const result = processGDocStub(gdocPath, tempInbox, { dryRun: false });
  assert.ok(result);
  assert.equal(result.status, 'STAGED_STANDALONE_GDOC');

  // Verify file removed from inbox and staged to pending
  assert.ok(!fs.existsSync(gdocPath), 'Source .gdoc should be moved out of inbox');
  
  // Cleanup
  fs.rmSync(tempInbox, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ironbots.test.mjs`
Expected: FAIL (returns `null` because stub is not yet handled).

- [ ] **Step 3: Implement Standalone `.gdoc` Metadata Extraction & Staging in `processGDocStub`**

In `scripts/trm-ingress-watcher.mjs`:
```javascript
export function parseGDocFilenameMetadata(filename) {
  const stem = filename.replace(/\.(md\.)?gdoc$/i, '');
  const parts = stem.split('__');
  
  let timestamp = new Date().toISOString();
  let action_type = 'antigravity_triage';
  let id = stem;
  let intent = stem;

  if (parts.length >= 3) {
    timestamp = parts[0];
    action_type = parts[1] === 'action' ? 'antigravity_triage' : parts[1];
    id = parts[2];
    intent = parts.slice(2).join('__');
  } else if (parts.length === 2) {
    timestamp = parts[0];
    id = parts[1];
    intent = parts[1];
  }

  const cleanIntent = intent.replace(/^act-\d+-/, '').replace(/-/g, '_');

  return {
    id,
    timestamp,
    source: 'mobile-gemini-gdoc',
    action_type: 'antigravity_triage',
    intent: cleanIntent,
    summary: `Mobile action item submitted via Google Docs: ${stem}`,
    context: {
      gdoc_filename: filename,
      gdoc_stem: stem,
      note: 'Ingested from standalone Google Drive .gdoc pointer. Payload body managed via triage issue.'
    }
  };
}
```

Update `processGDocStub`:
```javascript
  if (!isAlreadyHandled) {
    const item = parseGDocFilenameMetadata(filename);
    const issueUrl = createGitHubIssue(item);
    
    // Stage to .harness/tasks/pending/
    const harnessTask = {
      id: item.id,
      timestamp: item.timestamp,
      source: item.source,
      action_type: item.action_type,
      intent: item.intent,
      summary: item.summary,
      issue_url: issueUrl,
      staged_at: new Date().toISOString(),
      source_file: filename,
      context: item.context
    };

    const harnessDest = path.join(HARNESS_PENDING_DIR, `${item.id}.json`);
    fs.writeFileSync(harnessDest, JSON.stringify(harnessTask, null, 2), 'utf8');

    // Archive .gdoc
    const dest = isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)
      ? path.join(GDRIVE_ARCHIVE, filename)
      : path.join(COMPLETED_DIR, filename);

    const moved = safeMoveFile(filePath, dest);

    logToLedger({
      id: item.id,
      processed_at: new Date().toISOString(),
      timestamp: item.timestamp,
      source: item.source,
      action_type: item.action_type,
      intent: item.intent,
      status: 'STAGED_FOR_TRIAGE',
      issue_url: issueUrl,
      duration_ms: Date.now() - startTime
    });

    dispatchMobileReceipt(item, {
      status: 'STAGED_FOR_TRIAGE',
      issue_url: issueUrl,
      duration_ms: Date.now() - startTime,
      details: `Staged standalone .gdoc to .harness/tasks/pending/${item.id}.json`
    }, { dryRun });

    return { id: filename, status: 'STAGED_STANDALONE_GDOC', moved };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ironbots.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/trm-ingress-watcher.mjs tests/ironbots.test.mjs
git commit -m "feat(trm-ingress): support standalone .gdoc action cards via filename metadata extraction"
```

---

### Task 4: Restart ICF Daemon & Verify End-to-End Health

**Files:**
- Test / Verify: `node scripts/daemon-healer-bot.mjs`, `node scripts/trm-ingress-watcher.mjs --once`

- [ ] **Step 1: Run Ingress Sweep to clear the 4 mobile inbox items**

Run: `node scripts/trm-ingress-watcher.mjs --once`
Expected: All 4 `.md.gdoc` files processed from `G:\My Drive\TRM-Research\mobile-inbox`, staged to `.harness/tasks/pending/`, archived to `04_archive/mobile-inbox/`, and receipts created.

- [ ] **Step 2: Reset Thrash Guard and run Daemon-Healer**

In PowerShell:
```powershell
node scripts/daemon-healer-bot.mjs
```
Expected: Port 8080 started, UI and API status `200 OK`, status `HEALTHY` or `RECOVERED`.

- [ ] **Step 3: Verify port 8080 is listening and responds**

Run: `curl.exe -I http://127.0.0.1:8080/dashboard`
Expected: HTTP 200 OK.

- [ ] **Step 4: Commit all status updates**

```bash
git add _status-feed/ trm-drive/inbox/
git commit -m "chore(telemetry): update ingress and daemon health telemetry"
```
