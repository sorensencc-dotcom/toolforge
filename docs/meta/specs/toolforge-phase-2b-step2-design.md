---
title: Toolforge Phase 2b — Step 2 End-to-End Architecture (Error Collection + Alerts)
date: 2026-07-11
status: DESIGN_LOCKED
version: 1.0
scope: Step 2 (W3–W4) only — errors table population, error taxonomy, alert engine, Dashboard v2 Errors tab
depends_on: docs/meta/specs/toolforge-phase-2b-step1-design.md
supersedes_ambiguity_in: docs/meta/plans/toolforge-phase-2b-implementation-plan.md (Step 2 sections, lines ~790–1114)
---

# Toolforge Phase 2b — Step 2 Architecture (DESIGN_LOCKED)

Authoritative build contract for **Step 2**. A builder implements each file mechanically from
this document with **zero remaining architectural judgment calls**. Where this document and
`toolforge-phase-2b-implementation-plan.md` disagree, **this document wins** for Step 2. All
disagreements are enumerated in §0.2 with rationale, each backed by the actual committed Step 1
code (not the plan's illustrative snippets).

Absolute paths only (project convention). Windows / PowerShell 7 host. Node v24, SQLite WAL.

---

## 0. Overview + Ground-Truth Verification + Corrections

### 0.1 Component map (Step 2 files)

| # | File (absolute) | Action | Depends on |
|---|-----------------|--------|-----------|
| G1 | `C:\dev\toolforge\config\alert-thresholds.json` | **CREATE** (new dir `config\`) | — |
| G2 | `C:\dev\toolforge\run-tool.ps1` | **MODIFY** — add `Classify-Error`, extend `Write-Telemetry` (errors insert + `-StackTrace`), rewire 2 call sites | Step 1 run-tool.ps1, errors table |
| G3 | `C:\dev\toolforge\api\telemetry\server.js` | **MODIFY** — add RW handle, validators, `/errors` + `/errors/taxonomy` + `/alerts` routes, alert engine | Step 1 server.js, errors+alerts tables, G1 |
| G4 | `C:\dev\toolforge\assets\cic-dashboard.css` | **APPEND** — Errors-tab styles + severity ramp | Step 1 css |
| G5 | `C:\dev\toolforge\dashboard-v2.html` | **MODIFY** — replace `#tab-errors` placeholder with full markup | G4 |
| G6 | `C:\dev\toolforge\assets\dashboard-v2.js` | **MODIFY** — add errors module, wire tab activation + pagination | G3, G5 |

**No schema change.** `errors` and `alerts` tables + their indices already exist (Step 1
`schema.sql` lines 40–64, verified present in `run-store.db`). `run-store.db` is already in WAL
mode (verified: `run-store.db-wal` / `-shm` sidecars present). **No additional PRAGMAs.**

### 0.2 Ground-truth verification (what the plan got wrong)

The plan's Step 2 code snippets do **not** match the committed Step 1 API surface. The builder
MUST follow the corrected design in this document, not the plan.

| ID | Plan defect (lines) | Ground truth (verified in committed file) | Correction |
|----|--------------------|--------------------------------------------|------------|
| **D1** | Plan's `Write-Telemetry` modification keys on `$Event -eq "fail"` (line 829). | Committed `Write-Telemetry` (run-tool.ps1 L50–107) has **no `$Event` param**; it takes `-Status ('success'\|'fail')`. | Branch on `$Status -eq 'fail'`. §1.3. |
| **D2** | Plan uses `$cmd.CommandText` / `$cmd.Parameters.AddWithValue` / `$cmd.ExecuteNonQuery()` (raw `System.Data.SQLite`) (L833–841). | Committed hook uses **PSSQLite** `Invoke-SqliteQuery -DataSource -Query -SqlParameters @{}` and runs the whole `BEGIN…COMMIT` as **one** `-Query` string. | Add the `errors` INSERT **inside the existing single transaction block**; pass extra params via the `@{}` hashtable. §1.3. |
| **D3** | Plan writes the error row in a **separate** statement after the run (L833). | — | Same-transaction insert (run then error). Guarantees atomic errors+runs (task requirement). §1.4. |
| **D4** | Plan's `Classify-Error` runs only "in catch block" (L807–808). | Committed hook writes `fail` telemetry from **two** sites: native non-zero `$LASTEXITCODE` (L366–374) **and** the PS `catch` (L382–389). | Classify at **both** fail sites; the non-zero-exit message (`"exit code N"`) classifies to `E_RUNTIME` by the default rule. §1.2/§1.5. |
| **D5** | Plan's alert engine compares `timestamp > datetime('now','-10 minutes')` (L965, L979). | Timestamps are stored as `yyyy-MM-ddTHH:mm:ss.fffZ` (run-tool.ps1 L71). SQLite `datetime('now',…)` returns `YYYY-MM-DD HH:MM:SS` (space, no `T`, no `Z`, no ms). Lexicographic compare of `'…T…Z'` vs `'… …'` is **broken** (the `T`/space and trailing `Z`/ms diverge) → the filter silently matches wrong rows. | Compute every cutoff in **JS as an ISO string** (`new Date(Date.now()-ms).toISOString()`) and bind as a `?` param — exactly as Step 1's `getToolStats` already does (server.js L223). §2.4. |
| **D6** | Plan `require('uuid').v4()` (L990). | `uuid` is **not** installed; Node is **v24** (`crypto.randomUUID` is built-in). | Use `crypto.randomUUID()`. **No new dependency.** §2.5. |
| **D7** | Plan's `/errors` route (L875–879) and `createAlert` (L997) leak `err.message` to clients and use `db.all(... res.status(500).json({error: err.message}))`. | Step 1 established the central error envelope + `next(err)` (server.js L299–306, resolves C8). | New routes `throw`/`next(err)`; **never** return raw SQLite messages. §2.6. |
| **D8** | Plan's `/errors` route has **no** `error_code` filter (L864–873) but the dashboard calls `&error_code=E_RUNTIME` (L1064) and the task mandates it. | — | `/errors` accepts + validates `error_code` (enum of 5) and paginates like `/runs`. §2.6. |
| **D9** | Plan opens **one** `db` handle; the alert engine calls `db.run(INSERT …)`. | Committed `server.js` opens `db` with **`sqlite3.OPEN_READONLY`** (L18). A read-only handle **cannot** insert alerts — the engine would throw `SQLITE_READONLY` every 5 min. | Add a **second, dedicated `dbWrite` handle** (`OPEN_READWRITE`) used **only** by the alert engine. The HTTP-serving `db` stays read-only (preserves the Step 1 read-only-API security posture; a route bug can never mutate). §2.2. |
| **D10** | Plan's `window: 'all'` maps to `Infinity`; `new Date(Date.now()-Infinity).toISOString()` throws `RangeError`. | — | `all` **omits** the cutoff clause (mirrors `getToolStats`). §2.4. |
| **D11** | Plan dashboard uses `innerHTML` with unescaped `err.tool`/`err.error_message` (L1079–1085) and inline `onclick="viewError(...)"`. | Step 1 dashboard builds rows via `createElement` + `textContent` (dashboard-v2.js L153–198) to prevent stored-XSS from a malicious tool name; uses `addEventListener`, no inline handlers. | Errors table uses the **same DOM-construction + `textContent`** pattern; no `innerHTML` on untrusted fields; event delegation, not inline `onclick`. §3.4. |
| **D12** | Plan taxonomy bar width = `Math.min(t.count*10,100)` (L1099) — arbitrary, saturates at 10 errors. | — | Scale bars by the **max count** in the set (`count/maxCount*100`). §3.4. |

### 0.3 Locked cross-cutting decisions (one line each)

- **Error write model:** the `errors` row is written **in the same transaction** as the `runs`
  row, on fail only — atomic (§1.4).
- **Error-code totality:** `Classify-Error` is a **total function** — first-match-wins over an
  ordered rule list; the final default `E_RUNTIME` guarantees every message maps to exactly one
  of the 5 codes (§1.2).
- **NOT-NULL guard:** `errors.error_code` is `NOT NULL`. On any `fail` with an empty code the
  hook substitutes `E_RUNTIME` **before** the insert, so the errors row can never roll back the
  (now co-transactional) runs row (§1.4).
- **Alert writes:** internal scheduler only; **no HTTP write route**. Dedicated `dbWrite` handle
  (§2.2). API remains read-only from every client's perspective.
- **Alert cutoffs:** computed in JS as ISO strings, bound as params — never `datetime('now')`
  (§2.4, D5).
- **Alert idempotency:** app-level cooldown — suppress a new alert of the same
  `(alert_type, tool)` while an `active` one exists inside that alert's `window_minutes`
  (§2.7). No DB unique index (would block re-alerting; no resolver in scope).
- **duration_anomaly is per-tool** (baseline + p99 computed per tool) — avoids Simpson's-paradox
  false positives from mixing fast and slow tools (§2.8).
- **Alert `id`:** `crypto.randomUUID()` (§2.5). **Timestamps:** `new Date().toISOString()`
  (matches stored format; lexicographic == chronological).
- **Date-range picker on the Errors tab:** **DEFERRED to Step 3**. Step 2 ships a `window`
  select (`24h`/`7d`/`all`), which covers triage without duplicating History's `from`/`to`
  (§3.2, decision rationale).

---

## 1. Component 1 — Error Taxonomy + Logging (`run-tool.ps1`)

### 1.1 Finalized error taxonomy (5 codes)

| Code | Meaning | Severity (dashboard) |
|------|---------|----------------------|
| `E_RUNTIME` | Runtime execution error; also the **default / catch-all** (native non-zero exit, unclassified exception). | CRITICAL |
| `E_TIMEOUT` | Execution exceeded a time budget / operation timed out. | WARNING |
| `E_DEPENDENCY` | A required file, module, command, or binary was missing / unresolvable. | CRITICAL |
| `E_VALIDATION` | Input / argument / schema validation failed. | WARNING |
| `E_ENVIRONMENT` | Environment variable / config / permission problem. | WARNING |

### 1.2 `Classify-Error` — exact pattern-matching contract

**Total, deterministic, first-match-wins over this exact order.** Priority order encodes
tie-breaks (e.g. `"invalid config"` → `E_VALIDATION` because `E_VALIDATION` precedes
`E_ENVIRONMENT`). `switch -Regex` clauses each `return`, so the first matching clause wins and
the function exits; the final `default` makes the function total.

| Priority | Code | Regex (case-insensitive) — matched against `$ErrorMessage` |
|----------|------|-------------------------------------------------------------|
| 1 | `E_TIMEOUT` | `timeout\|timed out\|has timed out\|operation.*timed` |
| 2 | `E_DEPENDENCY` | `not found\|cannot find\|no such file\|module not found\|could not load\|unable to (resolve\|load)\|is not recognized\|command not found\|ENOENT` |
| 3 | `E_VALIDATION` | `invalid\|validation\|malformed\|is required\|must be (a\|an\|non-\|greater\|less)\|bad request\|parse error\|failed to parse\|schema` |
| 4 | `E_ENVIRONMENT` | `environment variable\|env var\|\.env\|access is denied\|permission denied\|unauthorized\|not set\|missing.*variable\|configuration (error\|missing)` |
| 5 (default) | `E_RUNTIME` | (no match / null / empty) |

**Exact PowerShell (copy-paste — replaces the existing `Get-ErrorCode` function, run-tool.ps1
L45–48):**

```powershell
function Classify-Error {
  # Total, deterministic error classifier (Step 2). First-match-wins over the
  # ordered rule set below; the final default guarantees totality.
  param([string]$ErrorMessage)

  if ([string]::IsNullOrWhiteSpace($ErrorMessage)) { return "E_RUNTIME" }

  switch -Regex ($ErrorMessage) {
    '(?i)timeout|timed out|has timed out|operation.*timed'                                              { return "E_TIMEOUT" }
    '(?i)not found|cannot find|no such file|module not found|could not load|unable to (resolve|load)|is not recognized|command not found|ENOENT' { return "E_DEPENDENCY" }
    '(?i)invalid|validation|malformed|is required|must be (a|an|non-|greater|less)|bad request|parse error|failed to parse|schema' { return "E_VALIDATION" }
    '(?i)environment variable|env var|\.env|access is denied|permission denied|unauthorized|not set|missing.*variable|configuration (error|missing)' { return "E_ENVIRONMENT" }
    default { return "E_RUNTIME" }
  }
}
```

### 1.3 `Write-Telemetry` modification — exact edits

Two changes to the committed `Write-Telemetry` (run-tool.ps1 L50–107): (a) add a `-StackTrace`
param; (b) conditionally append an `errors` INSERT **inside the same `BEGIN…COMMIT` block** and
add its params. The success path is **byte-for-byte unchanged** (no error insert, no extra
params) — zero regression.

**Edit 1 — param block.** Add `-StackTrace` after `-ErrorMessage`:

```powershell
    [string]$ErrorMessage,
    [string]$StackTrace,     # <-- ADD: only used on fail; error stack for the errors table
    [string]$Version,
```

**Edit 2 — SQL + params (replaces the body from `$ts = …` through the `$params = @{…}` block,
run-tool.ps1 L71–97).** Copy-paste exact:

```powershell
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

    # errors.error_code is NOT NULL. Guarantee a non-null code on every fail so the
    # (co-transactional) errors insert can never roll back the runs insert.
    $effectiveCode = if ($ErrorCode) { $ErrorCode }
                     elseif ($Status -eq 'fail') { 'E_RUNTIME' }
                     else { $null }

    # On fail, insert a structured errors row in the SAME transaction, AFTER the runs
    # insert (FK errors.invocation_id -> runs.invocation_id resolves in-txn).
    $errorInsert = ""
    if ($Status -eq 'fail') {
      $errorInsert = @"

INSERT INTO errors
  (error_id, invocation_id, tool, timestamp, error_code, error_message, stack_trace)
VALUES
  (@error_id, @invocation_id, @tool, @ts, @error_code, @error_message, @stack_trace);
"@
    }

    $sql = @"
BEGIN IMMEDIATE;

INSERT INTO tools (name, first_seen, last_run)
VALUES (@tool, @ts, @ts)
ON CONFLICT(name) DO UPDATE SET last_run = @ts;

INSERT INTO runs
  (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message, version)
VALUES
  (@invocation_id, @tool, @ts, @duration_ms, @status, @error_code, @error_message, @version);
$errorInsert
COMMIT;
"@

    $params = @{
      tool          = $Tool
      ts            = $ts
      invocation_id = $InvocationId
      duration_ms   = $DurationMs
      status        = $Status
      error_code    = $effectiveCode
      error_message = if ($ErrorMessage) { $ErrorMessage } else { $null }
      version       = if ($Version) { $Version } else { $null }
    }
    if ($Status -eq 'fail') {
      $params['error_id']    = [guid]::NewGuid().ToString().ToLower()
      $params['stack_trace'] = if ($StackTrace) { $StackTrace } else { $null }
    }
```

The three `Invoke-SqliteQuery` lines that follow (PRAGMAs + `$sql`/`$params`) are **unchanged**
(run-tool.ps1 L99–101). The outer `try/catch` that swallows telemetry errors into a
`Write-Warning` (L64/L104–106) is **unchanged** — telemetry isolation (Step 1 §5.1) is
preserved: a failed errors insert warns and returns; it never changes the tool's exit code.

### 1.4 Atomic write guarantee (errors + runs, or neither)

- Both INSERTs live in **one** `BEGIN IMMEDIATE … COMMIT` string passed as a single
  `Invoke-SqliteQuery -Query`. SQLite executes it as one script: if the `errors` insert fails
  (constraint, disk, lock), the `COMMIT` is not reached and the whole transaction — including
  the `runs` insert and `tools` upsert — is discarded. **Never a run without its error row on
  fail; never an error row without its run.**
- **Insert order is load-bearing:** `tools` upsert → `runs` insert → `errors` insert. With
  `foreign_keys=ON`, `errors.invocation_id → runs.invocation_id` and `errors.tool → tools.name`
  both resolve because the referenced rows are inserted earlier **in the same transaction**.
- **Connection hygiene:** PSSQLite opens a fresh connection per `Invoke-SqliteQuery` and closes
  it; a transaction left open by an error is torn down with that connection — no dangling txn
  leaks to the next invocation.
- **NOT-NULL guard (§0.3):** `$effectiveCode` guarantees `errors.error_code` is non-null on
  every fail, so the errors insert cannot trip `NOT NULL` and roll back an otherwise-valid run.

### 1.5 Call-site rewiring (run-tool.ps1) — exact edits

Both fail sites currently call `-ErrorCode (Get-ErrorCode)`. Replace with `Classify-Error` and
capture the message once so the same string feeds both classification and `-ErrorMessage`.

**Non-zero `$LASTEXITCODE` branch (replaces run-tool.ps1 L366–374):**

```powershell
    if ($LASTEXITCODE -ne 0) {
      # native/node/ts/sh non-zero exit (C4: telemetry written before this exit)
      $dur     = [int]((Get-Date) - $startTime).TotalMilliseconds
      $failMsg = "exit code $LASTEXITCODE"
      Write-Telemetry -InvocationId $invocationId -Tool $ToolName -Status 'fail' `
        -DurationMs $dur -ErrorCode (Classify-Error -ErrorMessage $failMsg) -ErrorMessage $failMsg `
        -Version $version -DbPath $DbPath
      Write-Host "❌ $itemType exited with code $LASTEXITCODE" -ForegroundColor Red
      exit $LASTEXITCODE
    }
```

(`"exit code N"` matches no special rule → `E_RUNTIME`, the correct default for an opaque native
failure. No `-StackTrace` — none exists for a native exit.)

**PS `catch` branch (replaces run-tool.ps1 L382–389):**

```powershell
  catch {
    # PS terminating error (ErrorActionPreference = Stop)
    $dur     = [int]((Get-Date) - $startTime).TotalMilliseconds
    $failMsg = $_.Exception.Message
    Write-Telemetry -InvocationId $invocationId -Tool $ToolName -Status 'fail' `
      -DurationMs $dur -ErrorCode (Classify-Error -ErrorMessage $failMsg) -ErrorMessage $failMsg `
      -StackTrace $_.ScriptStackTrace -Version $version -DbPath $DbPath
    throw
  }
```

The success `Write-Telemetry` call (L377–378) is **unchanged**.

### 1.6 Success criteria (G2)

- [ ] `Classify-Error` returns exactly one of the 5 codes for any string (total).
- [ ] A tool that throws with `"module not found"` writes a `runs` row (`status=fail`,
      `error_code=E_DEPENDENCY`) **and** a matching `errors` row with the same `invocation_id`,
      stack trace populated.
- [ ] A native non-zero exit writes `error_code=E_RUNTIME` and an `errors` row (stack null).
- [ ] Success path writes exactly one `runs` row, **zero** `errors` rows.
- [ ] Forcing an errors-insert failure (e.g. a bad param) leaves **no** partial `runs` row for
      that invocation (transaction rolled back), and only a `Write-Warning` surfaces.

---

## 2. Component 2 — Alert Thresholds + Engine (`server.js` + `alert-thresholds.json`)

### 2.1 Configuration file — `C:\dev\toolforge\config\alert-thresholds.json` (G1, create)

Config-driven: the engine reads these values; code holds only fallback defaults. Copy-paste
exact:

```json
{
  "$schema_version": "1.0",
  "evaluation_interval_minutes": 5,
  "alerts": [
    {
      "name": "error_spike",
      "description": "More than `threshold` errors of the listed codes within the window.",
      "threshold": 10,
      "comparison": "gt",
      "window_minutes": 10,
      "error_codes": ["E_RUNTIME"],
      "severity": "CRITICAL",
      "scope": "system",
      "enabled": true
    },
    {
      "name": "fail_rate",
      "description": "Failed-run ratio exceeds `threshold` within the window (system-wide).",
      "threshold": 0.15,
      "comparison": "gt",
      "window_minutes": 60,
      "min_samples": 10,
      "severity": "CRITICAL",
      "scope": "system",
      "enabled": true
    },
    {
      "name": "duration_anomaly",
      "description": "Per-tool p99 duration in the window exceeds multiplier x the tool's rolling baseline average.",
      "threshold_multiplier": 2.0,
      "window_minutes": 60,
      "baseline_days": 7,
      "percentile": 99,
      "min_samples": 20,
      "min_baseline_samples": 30,
      "severity": "WARNING",
      "scope": "per_tool",
      "enabled": true
    }
  ]
}
```

Field meanings the engine consumes: `window_minutes` (evaluation + cooldown window),
`min_samples` (floor to suppress small-sample false positives), `baseline_days` (rolling
baseline span), `percentile` (nearest-rank percentile), `min_baseline_samples` (baseline floor),
`threshold_multiplier`, `error_codes`. Every alert honours its `enabled` flag.

### 2.2 DB handles (resolves D9) — exact insertion

The committed read-only `db` cannot write alerts. Add a dedicated read-write handle **after**
the existing `db.serialize(...)` block (server.js L25–28). The HTTP-serving `db` stays
`OPEN_READONLY`.

```javascript
// ---- Dedicated read-write handle for the alert engine ONLY (D9). ----
// The HTTP `db` above stays OPEN_READONLY so no request path can ever mutate.
// WAL permits this single writer alongside readers (API) + the PS hook writer.
const dbWrite = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('[toolforge-api] failed to open run-store.db (rw for alerts):', err.message);
    // Do NOT exit — the read API must keep serving even if alerts can't write.
  }
});
dbWrite.serialize(() => {
  dbWrite.run('PRAGMA foreign_keys = ON;');
  dbWrite.run('PRAGMA busy_timeout = 5000;');
});
```

Also add `fs` + `crypto` requires after `const path = require('path');` (server.js L11):

```javascript
const fs = require('fs');
const crypto = require('crypto');
```

### 2.3 Shared helpers — exact insertion

Add near the Step 1 validation helpers (after `validateTool`, server.js ~L90):

```javascript
const WINDOW_MS = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 };
const ERROR_CODES = ['E_RUNTIME', 'E_VALIDATION', 'E_DEPENDENCY', 'E_ENVIRONMENT', 'E_TIMEOUT'];

function isoAgo(ms) { return new Date(Date.now() - ms).toISOString(); }

function validateWindow(value) {
  const w = value || '24h';
  if (w !== '24h' && w !== '7d' && w !== 'all') {
    throw new BadRequestError(`Invalid window: ${value}. Must be '24h', '7d', or 'all'.`);
  }
  return w;
}

function validateErrorCode(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!ERROR_CODES.includes(value)) {
    throw new BadRequestError(`Invalid error_code: ${value}. Must be one of ${ERROR_CODES.join(', ')}.`);
  }
  return value;
}

function validateAlertStatus(value) {
  const s = value || 'active';
  if (s !== 'active' && s !== 'resolved' && s !== 'all') {
    throw new BadRequestError(`Invalid status: ${value}. Must be 'active', 'resolved', or 'all'.`);
  }
  return s;
}

function percentileNearestRank(sortedAsc, p) {
  // sortedAsc: numbers ascending. Nearest-rank: idx = ceil(p/100 * N) (1-indexed).
  const n = sortedAsc.length;
  if (n === 0) return null;
  const idx = Math.min(n, Math.max(1, Math.ceil((p / 100) * n))) - 1;
  return sortedAsc[idx];
}
```

### 2.4 Route: `GET /api/toolforge/errors` (resolves D5/D8/D10)

**Query params:**

| Param | Type | Default | Rule | On violation |
|-------|------|---------|------|--------------|
| `tool` | string | — | exact match, ≤200 chars | 400 if >200 |
| `error_code` | enum | — | one of the 5 codes | 400 otherwise |
| `window` | enum | `24h` | `24h`\|`7d`\|`all` (`all` omits cutoff) | 400 otherwise |
| `limit` | int | 50 | clamp 1..200 | clamp silently |
| `offset` | int | 0 | ≥0 | clamp to 0 |

**Handler (exact):**

```javascript
function listErrors(req, res, next) {
  try {
    const tool = validateTool(req.query.tool);
    const errorCode = validateErrorCode(req.query.error_code);
    const window = validateWindow(req.query.window);
    const limit = clamp(parseIntParam(req.query.limit, 50), 1, 200);
    const offset = Math.max(0, parseIntParam(req.query.offset, 0));

    const clauses = [];
    const params = [];
    if (window !== 'all') { clauses.push('timestamp > ?'); params.push(isoAgo(WINDOW_MS[window])); }
    if (tool)      { clauses.push('tool = ?');        params.push(tool); }
    if (errorCode) { clauses.push('error_code = ?');  params.push(errorCode); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const pageSql = `SELECT error_id, invocation_id, tool, timestamp, error_code, error_message, stack_trace
                     FROM errors ${where}
                     ORDER BY timestamp DESC
                     LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) total FROM errors ${where}`;

    db.all(pageSql, [...params, limit, offset], (err, rows) => {
      if (err) return next(err);
      db.get(countSql, params, (cErr, c) => {
        if (cErr) return next(cErr);
        const total = c.total || 0;
        const returned = rows.length;
        res.status(200).json({
          errors: rows,
          pagination: {
            limit, offset, total, returned,
            hasNext: offset + returned < total,
            hasPrev: offset > 0
          }
        });
      });
    });
  } catch (e) { next(e); }
}
```

**Response 200:**
```json
{
  "errors": [
    {
      "error_id": "a1b2...uuid",
      "invocation_id": "b2c9...uuid",
      "tool": "multiRepoRoadmapSync",
      "timestamp": "2026-07-11T14:03:22.104Z",
      "error_code": "E_DEPENDENCY",
      "error_message": "Cannot find module './config'",
      "stack_trace": "at Object.<anonymous> (...)"
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 7, "returned": 7, "hasNext": false, "hasPrev": false }
}
```

### 2.4b Route: `GET /api/toolforge/errors/taxonomy`

**Query params:** `window` (`24h` default | `7d` | `all`). **Handler (exact):**

```javascript
function errorTaxonomy(req, res, next) {
  try {
    const window = validateWindow(req.query.window);
    const clause = window !== 'all' ? 'WHERE timestamp > ?' : '';
    const params = window !== 'all' ? [isoAgo(WINDOW_MS[window])] : [];

    const sql = `SELECT error_code, COUNT(*) count, GROUP_CONCAT(DISTINCT tool) tools
                 FROM errors ${clause}
                 GROUP BY error_code
                 ORDER BY count DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return next(err);
      const total = rows.reduce((s, r) => s + r.count, 0);
      res.status(200).json({ taxonomy: rows, total, window });
    });
  } catch (e) { next(e); }
}
```

**Response 200:**
```json
{
  "taxonomy": [
    { "error_code": "E_RUNTIME", "count": 12, "tools": "toolA,toolB" },
    { "error_code": "E_DEPENDENCY", "count": 3, "tools": "toolC" }
  ],
  "total": 15,
  "window": "24h"
}
```

### 2.5 Route: `GET /api/toolforge/alerts` (task-mandated)

**Query params:**

| Param | Type | Default | Rule |
|-------|------|---------|------|
| `window` | enum | `24h` | `24h`\|`7d`\|`all` |
| `status` | enum | `active` | `active`\|`resolved`\|`all` |
| `limit` | int | 100 | clamp 1..500 |

Uses the **read-only** `db` (this is a read). **Handler (exact):**

```javascript
function listAlerts(req, res, next) {
  try {
    const window = validateWindow(req.query.window);
    const statusFilter = validateAlertStatus(req.query.status);
    const limit = clamp(parseIntParam(req.query.limit, 100), 1, 500);

    const clauses = [];
    const params = [];
    if (window !== 'all')       { clauses.push('timestamp > ?'); params.push(isoAgo(WINDOW_MS[window])); }
    if (statusFilter !== 'all') { clauses.push('status = ?');    params.push(statusFilter); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `SELECT alert_id, tool, timestamp, alert_type, threshold_value, actual_value, status
                 FROM alerts ${where}
                 ORDER BY timestamp DESC
                 LIMIT ?`;

    db.all(sql, [...params, limit], (err, rows) => {
      if (err) return next(err);
      res.status(200).json({ alerts: rows, count: rows.length, window, status: statusFilter });
    });
  } catch (e) { next(e); }
}
```

**Response 200:**
```json
{
  "alerts": [
    {
      "alert_id": "c3d4...uuid",
      "tool": "system",
      "timestamp": "2026-07-11T14:05:00.000Z",
      "alert_type": "error_spike",
      "threshold_value": 10,
      "actual_value": 14,
      "status": "active"
    }
  ],
  "count": 1,
  "window": "24h",
  "status": "active"
}
```

**Route registration (exact anchor):** insert these three lines **immediately after**
`app.get('/health', health);` (server.js L291) and **before** the `notFoundHandler`
registration:

```javascript
app.get('/api/toolforge/errors', listErrors);
app.get('/api/toolforge/errors/taxonomy', errorTaxonomy);
app.get('/api/toolforge/alerts', listAlerts);
```

### 2.6 `crypto.randomUUID` + config loader (resolves D6/D7)

Add the config loader after `dbWrite` setup (§2.2):

```javascript
const THRESHOLDS_PATH = path.join(__dirname, '..', '..', 'config', 'alert-thresholds.json');

const DEFAULT_THRESHOLDS = {
  evaluation_interval_minutes: 5,
  alerts: [
    { name: 'error_spike', threshold: 10, window_minutes: 10, error_codes: ['E_RUNTIME'], enabled: true },
    { name: 'fail_rate', threshold: 0.15, window_minutes: 60, min_samples: 10, enabled: true },
    { name: 'duration_anomaly', threshold_multiplier: 2.0, window_minutes: 60, baseline_days: 7,
      percentile: 99, min_samples: 20, min_baseline_samples: 30, enabled: true }
  ]
};

function loadThresholds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(THRESHOLDS_PATH, 'utf8'));
    if (!parsed || !Array.isArray(parsed.alerts)) throw new Error('missing alerts[]');
    return parsed;
  } catch (e) {
    console.warn('[toolforge-api] alert-thresholds.json unreadable; using defaults:', e.message);
    return DEFAULT_THRESHOLDS;
  }
}
const THRESHOLDS = loadThresholds();
```

### 2.7 Alert engine — `evaluateAlerts` + idempotent `createAlert` (exact)

Insert after the route handlers, before `app.use(notFoundHandler)`. All cutoffs are JS ISO
strings (D5). All queries + the insert use `dbWrite`. Engine errors are logged, never thrown
(the API must not crash on a timer).

```javascript
// ============================================================
// Alert engine (Step 2). Internal scheduler; writes via dbWrite only.
// ============================================================
function logEngineError(err) { console.error('[toolforge-api][alerts]', err.message); }

function getAlertCfg(name) {
  return (THRESHOLDS.alerts || []).find((a) => a.name === name && a.enabled);
}

// Idempotency: suppress a duplicate active alert of the same (type, tool) while one
// already exists inside the alert's window (acts as a cooldown). After the window
// elapses, a fresh alert may fire even if the old one is still 'active' — no resolver
// is in Step 2 scope. Single-timer engine + one dbWrite handle => the check-then-insert
// race is practically nil (documented, accepted).
function maybeCreateAlert(type, tool, actualValue, thresholdValue, cooldownMinutes) {
  const cooldownCutoff = isoAgo(cooldownMinutes * 60 * 1000);
  dbWrite.get(
    `SELECT 1 FROM alerts WHERE alert_type = ? AND tool = ? AND status = 'active' AND timestamp > ? LIMIT 1`,
    [type, tool, cooldownCutoff],
    (err, row) => {
      if (err) return logEngineError(err);
      if (row) return; // active alert within cooldown -> suppress duplicate
      createAlert(type, tool, actualValue, thresholdValue);
    }
  );
}

function createAlert(type, tool, actualValue, thresholdValue) {
  const alertId = crypto.randomUUID();
  const ts = new Date().toISOString();
  dbWrite.run(
    `INSERT INTO alerts (alert_id, tool, timestamp, alert_type, threshold_value, actual_value, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [alertId, tool || 'system', ts, type, thresholdValue, actualValue],
    (err) => {
      if (err) console.error('[toolforge-api][alerts] createAlert failed:', err.message);
      else console.log(`[toolforge-api][alerts] created type=${type} tool=${tool} actual=${actualValue} threshold=${thresholdValue}`);
    }
  );
}

function evalErrorSpike(cfg) {
  const cutoff = isoAgo(cfg.window_minutes * 60 * 1000);
  const codes = (cfg.error_codes && cfg.error_codes.length) ? cfg.error_codes : ['E_RUNTIME'];
  const placeholders = codes.map(() => '?').join(',');
  dbWrite.get(
    `SELECT COUNT(*) c FROM errors WHERE timestamp > ? AND error_code IN (${placeholders})`,
    [cutoff, ...codes],
    (err, row) => {
      if (err) return logEngineError(err);
      const count = row.c || 0;
      if (count > cfg.threshold) {
        maybeCreateAlert('error_spike', 'system', count, cfg.threshold, cfg.window_minutes);
      }
    }
  );
}

function evalFailRate(cfg) {
  const cutoff = isoAgo(cfg.window_minutes * 60 * 1000);
  const minSamples = cfg.min_samples != null ? cfg.min_samples : 10;
  dbWrite.get(
    `SELECT COUNT(*) total, SUM(CASE WHEN status='fail' THEN 1 ELSE 0 END) fails
     FROM runs WHERE timestamp > ?`,
    [cutoff],
    (err, row) => {
      if (err) return logEngineError(err);
      const total = row.total || 0;
      const fails = row.fails || 0;
      if (total < minSamples) return; // small-sample guard (no false positives)
      const rate = fails / total;
      if (rate > cfg.threshold) {
        const rounded = Math.round(rate * 10000) / 10000;
        maybeCreateAlert('fail_rate', 'system', rounded, cfg.threshold, cfg.window_minutes);
      }
    }
  );
}

function evalDurationAnomaly(cfg) {
  const winCutoff = isoAgo(cfg.window_minutes * 60 * 1000);
  const baseDays = cfg.baseline_days != null ? cfg.baseline_days : 7;
  const baseCutoff = isoAgo(baseDays * 24 * 60 * 60 * 1000);
  const minWin = cfg.min_samples != null ? cfg.min_samples : 20;
  const minBase = cfg.min_baseline_samples != null ? cfg.min_baseline_samples : 30;
  const mult = cfg.threshold_multiplier != null ? cfg.threshold_multiplier : 2.0;
  const pct = cfg.percentile != null ? cfg.percentile : 99;

  // Tools with enough samples in the window.
  dbWrite.all(
    `SELECT tool, COUNT(*) n FROM runs WHERE timestamp > ? GROUP BY tool HAVING n >= ?`,
    [winCutoff, minWin],
    (err, tools) => {
      if (err) return logEngineError(err);
      tools.forEach((t) => {
        // Rolling baseline average over baseline_days.
        dbWrite.get(
          `SELECT AVG(duration_ms) avg, COUNT(*) n FROM runs WHERE tool = ? AND timestamp > ?`,
          [t.tool, baseCutoff],
          (bErr, base) => {
            if (bErr) return logEngineError(bErr);
            if (!base || base.n < minBase || !base.avg || base.avg <= 0) return;
            // p99 within the window (nearest-rank, computed in JS).
            dbWrite.all(
              `SELECT duration_ms d FROM runs WHERE tool = ? AND timestamp > ? ORDER BY duration_ms ASC`,
              [t.tool, winCutoff],
              (pErr, rows) => {
                if (pErr) return logEngineError(pErr);
                if (!rows.length) return;
                const p99 = percentileNearestRank(rows.map((r) => r.d), pct);
                const threshold = mult * base.avg;
                if (p99 > threshold) {
                  maybeCreateAlert('duration_anomaly', t.tool, p99, Math.round(threshold * 10) / 10, cfg.window_minutes);
                }
              }
            );
          }
        );
      });
    }
  );
}

function evaluateAlerts() {
  const spike = getAlertCfg('error_spike');       if (spike) evalErrorSpike(spike);
  const rate = getAlertCfg('fail_rate');          if (rate) evalFailRate(rate);
  const dur = getAlertCfg('duration_anomaly');    if (dur) evalDurationAnomaly(dur);
}
```

### 2.8 Baseline computation (duration_anomaly) — precise definition

- **Scope:** per tool (`scope: "per_tool"`). Each tool is evaluated independently; the alert's
  `tool` column carries the offending tool name (not `system`).
- **Baseline:** `AVG(runs.duration_ms)` for that tool over the last `baseline_days` (7) — a
  **rolling** average (the cutoff slides every evaluation). Requires ≥ `min_baseline_samples`
  (30) rows, else the tool is skipped (insufficient history → no alert).
- **Signal:** the nearest-rank `percentile` (p99) of that tool's `duration_ms` over the last
  `window_minutes` (60), requiring ≥ `min_samples` (20) rows in the window.
- **Fire when:** `p99 > threshold_multiplier (2.0) * baseline`. Stored `actual_value = p99`,
  `threshold_value = round(2.0 * baseline, 1)`.
- **Why per-tool + floors:** a global p99 mixes a 5-second tool with a 50-ms tool and always
  looks anomalous (Simpson's paradox); the sample floors kill small-N noise. Together they
  satisfy the "no false positives" success criterion.

### 2.9 Scheduling — `setInterval` (exact)

Add **inside** the `app.listen` callback (after the two existing `console.log` lines,
server.js L309–310):

```javascript
  const intervalMin = THRESHOLDS.evaluation_interval_minutes || 5;
  console.log(`[toolforge-api][alerts] engine every ${intervalMin}m`);
  evaluateAlerts();                                   // first pass at boot
  setInterval(evaluateAlerts, intervalMin * 60 * 1000);
```

### 2.10 Security / CORS review (new routes)

- All three new routes are **GET**, under the existing `/api/toolforge` surface — covered by the
  Step 1 `corsOptions` (`methods: ['GET']`, loopback + `null` origins) and `securityHeaders`
  (`nosniff`, `Cache-Control: no-store`). **No CORS change needed.**
- Server stays bound to `127.0.0.1` (unchanged) — primary access control. No auth added (out of
  scope; loopback + read-only HTTP surface).
- The **only** new write path is the internal timer via `dbWrite`; it is never reachable over
  HTTP. All query params are validated + parameterized (no string concatenation of user input).
- No rate limiting (loopback, GET-only) — unchanged from Step 1.

### 2.11 `package.json`

**No change.** `crypto`/`fs`/`path` are Node built-ins; `uuid` is **not** added (D6). Deps
remain `express`/`cors`/`sqlite3`.

### 2.12 Success criteria (G1/G3)

- [ ] `config/alert-thresholds.json` parses; engine loads it (or logs + falls back to defaults).
- [ ] Engine runs at boot and every 5 min; writes via `dbWrite`, never the read-only `db`.
- [ ] `error_spike` fires when >10 `E_RUNTIME` errors in 10 min; not before.
- [ ] `fail_rate` fires only when total ≥ `min_samples` and fail ratio > 0.15.
- [ ] `duration_anomaly` fires per-tool only with sufficient samples + baseline.
- [ ] Re-running the timer while a condition persists does **not** create duplicate active
      alerts within the window (idempotency).
- [ ] `GET /api/toolforge/alerts?window=24h&status=active` returns active alerts (exact schema).
- [ ] `GET /api/toolforge/errors?...` and `/errors/taxonomy` return the documented schemas; bad
      params → 400 with the central envelope; no SQLite message leaks.

---

## 3. Component 3 — Dashboard v2 Errors Tab

### 3.1 Tab navigation

**No change to the tab bar.** The `Errors` tab button (`#tab-btn-errors`) and its panel
(`#tab-errors`) already exist in the committed `dashboard-v2.html` (L19, L80) between
`Execution History` and `Release Pipeline`, wired into the ARIA tablist. Step 2 only replaces
the placeholder **content** of `#tab-errors` and adds JS that lazy-loads on activation.

### 3.2 Errors panel — HTML skeleton (G5, replaces the `#tab-errors` placeholder, L80)

Filters: tool text, error_code select (5 codes), **window select** (24h/7d/all — the
date-range picker is deferred to Step 3, §0.3), Apply. Taxonomy bar panel. Errors table with a
per-row expandable stack-trace detail row. Pagination mirrors History.

```html
    <section id="tab-errors" class="tab-content" role="tabpanel" aria-labelledby="tab-btn-errors" hidden>
      <form class="filters" role="search" id="error-filters">
        <div class="field">
          <label for="filter-error-tool">Tool</label>
          <input type="text" id="filter-error-tool" class="filter-input" placeholder="Filter by tool…" autocomplete="off">
        </div>
        <div class="field">
          <label for="filter-error-code">Error Code</label>
          <select id="filter-error-code" class="filter-select">
            <option value="">All codes</option>
            <option value="E_RUNTIME">E_RUNTIME</option>
            <option value="E_VALIDATION">E_VALIDATION</option>
            <option value="E_DEPENDENCY">E_DEPENDENCY</option>
            <option value="E_ENVIRONMENT">E_ENVIRONMENT</option>
            <option value="E_TIMEOUT">E_TIMEOUT</option>
          </select>
        </div>
        <div class="field">
          <label for="filter-error-window">Window</label>
          <select id="filter-error-window" class="filter-select">
            <option value="24h" selected>Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <button type="submit" id="apply-error-filters" class="filter-button">Apply</button>
      </form>

      <section class="taxonomy-panel" aria-labelledby="taxonomy-heading">
        <h3 id="taxonomy-heading" class="taxonomy-heading">Error Distribution</h3>
        <div id="taxonomy-chart" class="taxonomy-chart" role="img"
             aria-label="Error distribution by code"></div>
      </section>

      <div class="table-scroll">
        <table class="errors-table" id="errors-table" aria-label="Tool error log">
          <caption class="sr-only">Tool error log, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Timestamp</th>
              <th scope="col">Tool</th>
              <th scope="col">Error Code</th>
              <th scope="col">Message</th>
              <th scope="col">Stack Trace</th>
            </tr>
          </thead>
          <tbody id="errors-tbody"></tbody>
        </table>
      </div>
      <p id="errors-status" role="status" aria-live="polite" class="runs-status"></p>

      <nav class="pagination" role="navigation" aria-label="Errors pagination">
        <button id="err-prev-page" class="page-button" aria-label="Previous page" disabled>&larr; Prev</button>
        <span id="err-page-info" class="page-info">Page 1</span>
        <button id="err-next-page" class="page-button" aria-label="Next page">Next &rarr;</button>
        <label class="page-size-label" for="err-page-size">Rows</label>
        <select id="err-page-size" class="filter-select" aria-label="Rows per page">
          <option value="25">25</option>
          <option value="50" selected>50</option>
          <option value="100">100</option>
        </select>
      </nav>
    </section>
```

### 3.3 CSS additions (G4, append to `cic-dashboard.css`)

Reuses Step 1 tokens + `.filters`/`.table-scroll`/`.pagination`/`.stat-*` classes. Adds the
severity ramp (§4) as per-code CSS custom properties, applied to a **left border** + a
decorative dot — **never** to text (text stays `--bone` for AA contrast; color is never the
sole signal).

```css
/* ============================================================
   Errors tab (Step 2)
   ============================================================ */
.taxonomy-panel {
  border: 1px solid rgba(154, 144, 136, 0.12);
  background: rgba(26, 20, 16, 0.6);
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}
.taxonomy-heading {
  font-family: var(--font-label);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ash);
  margin-bottom: 1rem;
}
.taxonomy-chart { display: flex; flex-direction: column; gap: 0.6rem; }
.taxonomy-row {
  display: grid;
  grid-template-columns: 9.5rem 1fr 3rem;
  align-items: center;
  gap: 0.75rem;
}
.tax-code {
  font-family: var(--font-label);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--bone);           /* text stays high-contrast; color != sole signal */
  border-left: 3px solid var(--err-accent);
  padding-left: 0.5rem;
}
.tax-bar-track { background: rgba(154, 144, 136, 0.12); height: 0.75rem; }
.tax-bar { height: 100%; background: var(--err-accent); transition: width 0.3s ease; }
.tax-count {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--ash);
  text-align: right;
}

.errors-table { min-width: 820px; }
.errors-table thead th {
  font-family: var(--font-label);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ash);
  text-align: left;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(154, 144, 136, 0.2);
}
.errors-table tbody td {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--bone);
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgba(154, 144, 136, 0.08);
  vertical-align: top;
}
/* Severity accent = left border + dot only (text stays --bone for AA). */
.errors-table tbody tr.error-row { border-left: 3px solid var(--err-accent); }
.err-code-cell { white-space: nowrap; }
.err-dot { color: var(--err-accent); margin-right: 0.4rem; }
.err-code-text { font-family: var(--font-label); letter-spacing: 0.1em; }
.err-message { color: var(--bone); }
.err-detail-row td {
  background: rgba(10, 8, 6, 0.6);
  color: var(--ash);
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.err-detail-row[hidden] { display: none; }

/* Severity ramp — dashboard-scoped, applied via --err-accent (see design §4). */
.err-E_RUNTIME     { --err-accent: #C4501A; } /* ember  — red    (CRITICAL) */
.err-E_TIMEOUT     { --err-accent: #D98324; } /* orange          (WARNING)  */
.err-E_DEPENDENCY  { --err-accent: #8B3A1A; } /* rust   — deep red(CRITICAL)*/
.err-E_ENVIRONMENT { --err-accent: #B8922A; } /* brass  — yellow (WARNING)  */
.err-E_VALIDATION  { --err-accent: #C9A24B; } /* gold   — pale   (WARNING)  */
```

### 3.4 JavaScript (G6, add inside the existing IIFE in `dashboard-v2.js`, resolves D11/D12)

Add an errors state block, five functions, and an `initErrors()` wired into `DOMContentLoaded`.
Also add **one line** to the Step 1 `activateTab` so the Errors tab lazy-loads on first
activation. All untrusted fields (`tool`, `error_message`, `stack_trace`) are rendered with
`textContent` via `createElement` — **no `innerHTML`, no inline `onclick`** (D11).

**Edit A — inside `activateTab` (dashboard-v2.js, in `initTabs`), after the auto-poll block
(~L57), add:**

```javascript
      // Lazy-load the Errors tab on activation (Step 2).
      if (button.dataset.tab === 'errors') { loadErrors(); }
```

**Edit B — add this module before the `// Init` section (dashboard-v2.js ~L336):**

```javascript
  // ============================================================
  // Errors tab (Step 2)
  // ============================================================
  const ERR_ACCENTS = ['E_RUNTIME', 'E_TIMEOUT', 'E_DEPENDENCY', 'E_ENVIRONMENT', 'E_VALIDATION'];

  let errState = { offset: 0, limit: 50, tool: '', errorCode: '', window: '24h' };
  let errRowsById = Object.create(null); // error_id -> row (for stack-trace detail)

  function buildErrorQuery() {
    const params = new URLSearchParams();
    params.set('limit', errState.limit);
    params.set('offset', errState.offset);
    params.set('window', errState.window);
    if (errState.tool) params.set('tool', errState.tool);
    if (errState.errorCode) params.set('error_code', errState.errorCode);
    return params.toString();
  }

  async function loadErrors() {
    const statusEl = document.getElementById('errors-status');
    statusEl.textContent = 'Loading…';
    try {
      const res = await fetch(`${API_BASE}/errors?${buildErrorQuery()}`);
      const data = await res.json();
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `Request failed (${res.status})`;
        statusEl.textContent = `Error: ${msg}`;
        return;
      }
      renderErrorsTable(data.errors);
      renderErrorPagination(data.pagination);
      statusEl.textContent = data.errors.length === 0 ? 'No errors found.' : '';
      loadErrorTaxonomy();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  function renderErrorsTable(errors) {
    const tbody = document.getElementById('errors-tbody');
    tbody.innerHTML = '';
    errRowsById = Object.create(null);

    errors.forEach((e) => {
      errRowsById[e.error_id] = e;
      const codeClass = ERR_ACCENTS.includes(e.error_code) ? `err-${e.error_code}` : 'err-E_RUNTIME';

      const tr = document.createElement('tr');
      tr.className = `error-row ${codeClass}`;

      const tdTs = document.createElement('td');
      tdTs.textContent = formatTimestamp(e.timestamp);
      tr.appendChild(tdTs);

      const tdTool = document.createElement('td');
      tdTool.textContent = e.tool;                 // textContent — untrusted
      tr.appendChild(tdTool);

      const tdCode = document.createElement('td');
      tdCode.className = 'err-code-cell';
      tdCode.setAttribute('aria-label', `Error code: ${e.error_code}`);
      const dot = document.createElement('span');
      dot.className = 'err-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '●';
      const codeText = document.createElement('span');
      codeText.className = 'err-code-text';
      codeText.textContent = e.error_code;
      tdCode.appendChild(dot);
      tdCode.appendChild(codeText);
      tr.appendChild(tdCode);

      const tdMsg = document.createElement('td');
      tdMsg.className = 'err-message';
      tdMsg.textContent = e.error_message || '—';  // textContent — untrusted
      tr.appendChild(tdMsg);

      const tdAct = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'link-btn';
      btn.textContent = 'Stack →';
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => toggleStack(e.error_id, tr, btn));
      tdAct.appendChild(btn);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });
  }

  function toggleStack(errorId, tr, btn) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('err-detail-row')) {
      const willHide = !next.hidden ? true : false;
      next.hidden = willHide;
      btn.setAttribute('aria-expanded', String(!willHide));
      return;
    }
    const rec = errRowsById[errorId];
    const detail = document.createElement('tr');
    detail.className = 'err-detail-row';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = (rec && rec.stack_trace) ? rec.stack_trace : 'No stack trace recorded.';
    detail.appendChild(td);
    tr.insertAdjacentElement('afterend', detail);
    btn.setAttribute('aria-expanded', 'true');
  }

  async function loadErrorTaxonomy() {
    try {
      const res = await fetch(`${API_BASE}/errors/taxonomy?window=${encodeURIComponent(errState.window)}`);
      const data = await res.json();
      if (!res.ok) return;
      renderTaxonomy(data.taxonomy);
    } catch (err) {
      /* taxonomy is non-critical; silent on failure */
    }
  }

  function renderTaxonomy(taxonomy) {
    const chart = document.getElementById('taxonomy-chart');
    chart.innerHTML = '';
    const maxCount = taxonomy.reduce((m, t) => Math.max(m, t.count), 0) || 1; // scale by max (D12)

    taxonomy.forEach((t) => {
      const codeClass = ERR_ACCENTS.includes(t.error_code) ? `err-${t.error_code}` : 'err-E_RUNTIME';
      const row = document.createElement('div');
      row.className = `taxonomy-row ${codeClass}`;
      row.setAttribute('aria-label', `${t.error_code}: ${t.count} errors`);

      const code = document.createElement('span');
      code.className = 'tax-code';
      code.textContent = t.error_code;

      const track = document.createElement('span');
      track.className = 'tax-bar-track';
      const bar = document.createElement('span');
      bar.className = 'tax-bar';
      bar.style.width = `${Math.round((t.count / maxCount) * 100)}%`;
      track.appendChild(bar);

      const count = document.createElement('span');
      count.className = 'tax-count';
      count.textContent = t.count;

      row.appendChild(code);
      row.appendChild(track);
      row.appendChild(count);
      chart.appendChild(row);
    });
  }

  function renderErrorPagination(p) {
    document.getElementById('err-prev-page').disabled = !p.hasPrev;
    document.getElementById('err-next-page').disabled = !p.hasNext;
    const currentPage = Math.floor(p.offset / p.limit) + 1;
    const totalPages = Math.max(1, Math.ceil(p.total / p.limit));
    document.getElementById('err-page-info').textContent =
      `Page ${currentPage} of ${totalPages} — ${p.total} errors`;
  }

  function initErrors() {
    document.getElementById('error-filters').addEventListener('submit', (ev) => {
      ev.preventDefault();
      errState.tool = document.getElementById('filter-error-tool').value.trim();
      errState.errorCode = document.getElementById('filter-error-code').value;
      errState.window = document.getElementById('filter-error-window').value;
      errState.offset = 0;
      loadErrors();
    });
    document.getElementById('err-page-size').addEventListener('change', (ev) => {
      errState.limit = parseInt(ev.target.value, 10);
      errState.offset = 0;
      loadErrors();
    });
    document.getElementById('err-prev-page').addEventListener('click', () => {
      errState.offset = Math.max(0, errState.offset - errState.limit);
      loadErrors();
    });
    document.getElementById('err-next-page').addEventListener('click', () => {
      errState.offset = errState.offset + errState.limit;
      loadErrors();
    });
  }
```

**Edit C — in `DOMContentLoaded` (dashboard-v2.js L339–345), add `initErrors();` after
`initHistoryControls();`:**

```javascript
    initHistoryControls();
    initErrors();
    loadRuns();
```

(`loadErrors()` is **not** called at boot — the Errors tab loads lazily on activation via Edit
A, so no wasted fetch on the default History view.)

### 3.5 Success criteria (G4/G5/G6)

- [ ] Activating the Errors tab fetches `/errors` + `/errors/taxonomy` and renders both.
- [ ] Filters (tool / error_code / window) re-query on Apply; pagination prev/next works and
      honours `hasNext`/`hasPrev`; page size 25/50/100.
- [ ] Taxonomy bars scale by max count; each row shows code text + numeric count (not
      color-only); bar/border colored by the severity ramp.
- [ ] Error rows carry a left-border severity accent + dot; `error_code`/`message`/`tool`/
      `stack_trace` rendered via `textContent` (no XSS); Stack → toggles an inline detail row
      with `aria-expanded`.
- [ ] Table wraps in `.table-scroll` (no horizontal body scroll); focus rings visible; error
      code cell has `aria-label`.

---

## 4. Error Severity → CIC Color Mapping

Applied to the **left border + decorative dot only** (never to text — text stays `--bone` for
WCAG AA). The uppercase code label is always present, so color is never the sole signal.

| Error Code | Hex | CIC token / derivation | Visual | Dashboard severity |
|------------|-----|------------------------|--------|--------------------|
| `E_RUNTIME` | `#C4501A` | `--ember` (canonical accent) | red-orange | CRITICAL |
| `E_TIMEOUT` | `#D98324` | ember→amber derived (dashboard-scoped) | orange | WARNING |
| `E_DEPENDENCY` | `#8B3A1A` | `--rust` (canonical) | deep red | CRITICAL |
| `E_ENVIRONMENT` | `#B8922A` | `--brass` (canonical) | yellow-gold | WARNING |
| `E_VALIDATION` | `#C9A24B` | brass→pale-gold derived (dashboard-scoped) | pale yellow | WARNING |

The two derived shades (`#D98324`, `#C9A24B`) are **dashboard-scoped severity-scale extensions**,
not brand accents — introduced only because 5 codes need 5 distinguishable hues, and applied to
non-text elements so they carry no contrast obligation. This preserves CIC's "ember is the sole
vivid accent" discipline for the rest of the UI.

---

## Appendix A — Verification checklist (maps to task)

- [x] Error taxonomy: 5 codes, distinct ordered regex patterns, total function (§1.1/§1.2).
- [x] `Classify-Error` exhaustive + deterministic (first-match-wins + default) (§1.2).
- [x] `Write-Telemetry` mods preserve the Step 1 success path (no error insert, no extra params
      on success) (§1.3).
- [x] Atomic error+run write: single `BEGIN…COMMIT`, correct FK insert order, NOT-NULL guard
      (§1.4).
- [x] Alert engine idempotency: cooldown-scoped active-alert suppression (§2.7).
- [x] Duration baseline: per-tool 7-day rolling `AVG`, nearest-rank p99, sample floors (§2.8).
- [x] `/alerts` route: exact request params + response schema (§2.5).
- [x] `/errors` + `/errors/taxonomy`: exact schemas, 400 handling, no message leak (§2.4).
- [x] Errors-tab color-coding matches the CIC ramp; color never sole signal (§3.3/§4).
- [x] Ground-truth verified against committed Step 1 files; 12 plan defects corrected (§0.2).

## Appendix B — Build order for the builder

Each file is independently implementable from the cited section with no remaining design
decisions. Order respects data dependencies (DB write path → API → UI).

1. **G1** `config\alert-thresholds.json` — create dir + file (§2.1). Verify: `node -e
   "JSON.parse(require('fs').readFileSync('C:/dev/toolforge/config/alert-thresholds.json'))"`.
2. **G2** `run-tool.ps1` — replace `Get-ErrorCode`→`Classify-Error` (§1.2); add `-StackTrace` +
   errors insert to `Write-Telemetry` (§1.3); rewire 2 fail call sites (§1.5). Smoke: run a tool
   that throws `"cannot find module"` → verify 1 `runs` (fail, `E_DEPENDENCY`) + 1 matching
   `errors` row; run a passing tool → 1 `runs`, 0 `errors`.
3. **G3** `server.js` — add `fs`/`crypto` requires + `dbWrite` handle (§2.2); config loader
   (§2.6); helpers (§2.3); `listErrors`/`errorTaxonomy`/`listAlerts` (§2.4/§2.4b/§2.5) +
   register before `notFoundHandler`; alert engine (§2.7) + `setInterval` in `listen` (§2.9).
   Restart API; curl `/api/toolforge/errors`, `/errors/taxonomy`, `/alerts?status=active`.
4. **G4** `cic-dashboard.css` — append Errors-tab styles + severity ramp (§3.3).
5. **G5** `dashboard-v2.html` — replace the `#tab-errors` placeholder with the full markup
   (§3.2).
6. **G6** `dashboard-v2.js` — Edit A (lazy-load in `activateTab`), Edit B (errors module), Edit
   C (`initErrors()` in `DOMContentLoaded`) (§3.4). Load dashboard, open Errors tab, filter by
   code, expand a stack trace, paginate; confirm taxonomy bars render.

---

**Status:** DESIGN_LOCKED — ready for mechanical builder execution.
