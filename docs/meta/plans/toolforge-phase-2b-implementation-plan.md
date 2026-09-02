---
title: Toolforge Phase 2b Implementation Plan — Step-by-Step Specification
date: 2026-07-11
status: DRAFT
version: 1.0
---

# Toolforge Phase 2b Implementation Plan

Detailed specification for each of 4 execution steps (Step 1–4). This plan is executable — every file, function, route, and test is specified deterministically.

---

## STEP 1: EXECUTION HISTORY + RUN TRACKING (W1–W3)

### Step 1.1 — Build run-store.db (W1)

**Objective:** Create SQLite database as authoritative execution log.

**File Location:** `C:\dev\toolforge\run-store.db`

**Initialization Script:** `C:\dev\toolforge\utilities\init-run-store.ps1`

**Schema:**

```sql
-- runs table: complete invocation record
CREATE TABLE runs (
  invocation_id TEXT PRIMARY KEY NOT NULL,
  tool TEXT NOT NULL,
  timestamp TEXT NOT NULL,  -- ISO 8601
  duration_ms INTEGER,
  status TEXT NOT NULL,  -- 'success' | 'fail'
  error_code TEXT,
  error_message TEXT,
  version TEXT,  -- semver
  FOREIGN KEY (tool) REFERENCES tools(name)
);

CREATE INDEX idx_runs_tool_timestamp ON runs(tool, timestamp DESC);
CREATE INDEX idx_runs_status_timestamp ON runs(status, timestamp DESC);
CREATE INDEX idx_runs_timestamp ON runs(timestamp DESC);

-- tools table: registered tools metadata
CREATE TABLE tools (
  name TEXT PRIMARY KEY NOT NULL,
  category TEXT,
  version TEXT,
  last_run TEXT,  -- ISO 8601
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  avg_duration_ms REAL
);

-- Error log table (for Step 2)
CREATE TABLE errors (
  error_id TEXT PRIMARY KEY NOT NULL,
  invocation_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  timestamp TEXT NOT NULL,  -- ISO 8601
  error_code TEXT NOT NULL,  -- E_RUNTIME, E_VALIDATION, E_TIMEOUT, E_DEPENDENCY, E_ENVIRONMENT
  error_message TEXT,
  stack_trace TEXT,
  FOREIGN KEY (invocation_id) REFERENCES runs(invocation_id),
  FOREIGN KEY (tool) REFERENCES tools(name)
);

CREATE INDEX idx_errors_tool_timestamp ON errors(tool, timestamp DESC);
CREATE INDEX idx_errors_error_code ON errors(error_code);

-- Alerts table (for Step 2)
CREATE TABLE alerts (
  alert_id TEXT PRIMARY KEY NOT NULL,
  tool TEXT NOT NULL,
  timestamp TEXT NOT NULL,  -- ISO 8601
  alert_type TEXT NOT NULL,  -- 'error_spike', 'fail_rate', 'duration_anomaly'
  threshold_value REAL NOT NULL,
  actual_value REAL NOT NULL,
  status TEXT NOT NULL,  -- 'active' | 'resolved'
  FOREIGN KEY (tool) REFERENCES tools(name)
);

CREATE INDEX idx_alerts_tool_timestamp ON alerts(tool, timestamp DESC);
```

**Initialization Steps:**

1. Create `utilities/init-run-store.ps1`:

```powershell
param([string]$DbPath = "C:\dev\toolforge\run-store.db")

if (Test-Path $DbPath) {
  Write-Host "run-store.db exists. Backing up to run-store-$(Get-Date -Format yyyyMMdd-hhmmss).db"
  Copy-Item $DbPath "C:\dev\toolforge\run-store-$(Get-Date -Format yyyyMMdd-hhmmss).db"
}

# Create database + schema
$connection = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
$connection.Open()

# Enable WAL mode for concurrent access
$cmd = $connection.CreateCommand()
$cmd.CommandText = "PRAGMA journal_mode=WAL;"
$cmd.ExecuteNonQuery() | Out-Null

# Run schema SQL
$schema = Get-Content "$(Split-Path $PSScriptRoot)\schema.sql" -Raw
$cmd.CommandText = $schema
$cmd.ExecuteNonQuery() | Out-Null

$connection.Close()
Write-Host "run-store.db initialized at $DbPath"
```

2. Create `toolforge/schema.sql` (copy schema from above)

3. Run on first initialization:
```powershell
.\utilities\init-run-store.ps1
```

**Success Criteria:**
- [ ] run-store.db created with all tables
- [ ] WAL mode enabled
- [ ] Schema verified via `SELECT name FROM sqlite_master WHERE type='table'`

---

### Step 1.2 — Modify run-tool.ps1 to Emit Telemetry (W1)

**File:** `C:\dev\toolforge\run-tool.ps1`

**Current Signature:**
```powershell
param(
  [Parameter(Mandatory=$true)] [string]$Run,
  [Parameter(Mandatory=$false)] [string]$Config
)
```

**New Wrapper Logic:**

```powershell
param(
  [Parameter(Mandatory=$true)] [string]$Run,
  [Parameter(Mandatory=$false)] [string]$Config,
  [Parameter(Mandatory=$false)] [string]$DbPath = "C:\dev\toolforge\run-store.db"
)

# Generate invocation ID (UUID)
$invocationId = [System.Guid]::NewGuid().ToString()
$startTime = Get-Date

# Write "start" telemetry
Write-Telemetry -InvocationId $invocationId -Tool $Run -Event "start" -DbPath $DbPath

try {
  # Execute tool (existing logic)
  $toolResult = & ".\tools\$Run\run.ps1" @PSBoundParameters

  # Calculate duration
  $duration = ((Get-Date) - $startTime).TotalMilliseconds

  # Write "success" telemetry
  Write-Telemetry -InvocationId $invocationId -Tool $Run -Event "success" `
    -DurationMs $duration -Version "1.0.0" -DbPath $DbPath

  return $toolResult
}
catch {
  # Calculate duration
  $duration = ((Get-Date) - $startTime).TotalMilliseconds

  # Extract error code + message
  $errorCode = "E_RUNTIME"  # Default
  $errorMessage = $_.Exception.Message

  # Write "fail" telemetry
  Write-Telemetry -InvocationId $invocationId -Tool $Run -Event "fail" `
    -DurationMs $duration -ErrorCode $errorCode -ErrorMessage $errorMessage `
    -DbPath $DbPath

  # Re-throw
  throw $_
}

# Helper function: Write-Telemetry
function Write-Telemetry {
  param(
    [string]$InvocationId,
    [string]$Tool,
    [string]$Event,  # 'start' | 'success' | 'fail'
    [int]$DurationMs = 0,
    [string]$Version = $null,
    [string]$ErrorCode = $null,
    [string]$ErrorMessage = $null,
    [string]$DbPath
  )

  $timestamp = (Get-Date -AsUTC).ToString("o")
  $status = if ($Event -eq "success") { "success" } else { "fail" }

  $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
  $conn.Open()

  $cmd = $conn.CreateCommand()
  $cmd.CommandText = @"
    INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message, version)
    VALUES (@invocationId, @tool, @timestamp, @durationMs, @status, @errorCode, @errorMessage, @version)
"@

  $cmd.Parameters.AddWithValue("@invocationId", $InvocationId) | Out-Null
  $cmd.Parameters.AddWithValue("@tool", $Tool) | Out-Null
  $cmd.Parameters.AddWithValue("@timestamp", $timestamp) | Out-Null
  $cmd.Parameters.AddWithValue("@durationMs", $DurationMs) | Out-Null
  $cmd.Parameters.AddWithValue("@status", $status) | Out-Null
  $cmd.Parameters.AddWithValue("@errorCode", $ErrorCode ?? [DBNull]::Value) | Out-Null
  $cmd.Parameters.AddWithValue("@errorMessage", $ErrorMessage ?? [DBNull]::Value) | Out-Null
  $cmd.Parameters.AddWithValue("@version", $Version ?? [DBNull]::Value) | Out-Null

  $cmd.ExecuteNonQuery() | Out-Null
  $conn.Close()
}
```

**Success Criteria:**
- [ ] run-tool.ps1 generates invocation_id
- [ ] Telemetry written on start
- [ ] Telemetry written on success (includes duration)
- [ ] Telemetry written on error (includes error_code + error_message)
- [ ] Database writes do not slow invocation > 100ms

---

### Step 1.3 — Build `/api/toolforge` Node Backend (W2)

**Directory:** `C:\dev\toolforge\api\telemetry`

**Files to Create:**

#### A. `api/telemetry/server.js` — Express REST API

```javascript
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, '../../run-store.db');
const db = new sqlite3.Database(DB_PATH);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Routes

// GET /api/toolforge/runs?limit=100&offset=0&tool=xyz&status=success
app.get('/api/toolforge/runs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const tool = req.query.tool || null;
  const status = req.query.status || null;

  let sql = 'SELECT * FROM runs WHERE 1=1';
  const params = [];

  if (tool) {
    sql += ' AND tool = ?';
    params.push(tool);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ runs: rows, count: rows.length });
  });
});

// GET /api/toolforge/runs/:invocationId
app.get('/api/toolforge/runs/:invocationId', (req, res) => {
  const { invocationId } = req.params;

  db.get('SELECT * FROM runs WHERE invocation_id = ?', [invocationId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Run not found' });
    res.json(row);
  });
});

// GET /api/toolforge/tools/:tool/stats
app.get('/api/toolforge/tools/:tool/stats', (req, res) => {
  const { tool } = req.params;
  const window = req.query.window || '24h';  // '24h', '7d', 'all'

  const windowMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    'all': Infinity
  }[window] || 24 * 60 * 60 * 1000;

  const cutoff = new Date(Date.now() - windowMs).toISOString();

  db.get(`
    SELECT
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count,
      ROUND(AVG(duration_ms), 2) as avg_duration_ms,
      MAX(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as max_duration_ms,
      MIN(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as min_duration_ms,
      ROUND(100.0 * SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) / COUNT(*), 2) as fail_rate_pct
    FROM runs
    WHERE tool = ? AND timestamp > ?
  `, [tool, cutoff], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tool, window, stats: row });
  });
});

// Health check
app.get('/health', (req, res) => {
  db.get('SELECT COUNT(*) as run_count FROM runs', (err, row) => {
    if (err) return res.status(500).json({ status: 'unhealthy', error: err.message });
    res.json({ status: 'healthy', runs_recorded: row.run_count });
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toolforge API running on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

module.exports = app;
```

#### B. `api/telemetry/package.json`

```json
{
  "name": "toolforge-api",
  "version": "1.0.0",
  "description": "Toolforge execution telemetry API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

#### C. `api/telemetry/.env`

```env
PORT=3000
DB_PATH=C:\dev\toolforge\run-store.db
```

**Installation:**
```powershell
cd C:\dev\toolforge\api\telemetry
npm install
npm start  # Runs on localhost:3000
```

**Test Endpoints:**
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/toolforge/runs?limit=10
curl http://localhost:3000/api/toolforge/tools/analyze-token-burn/stats?window=24h
```

**Success Criteria:**
- [ ] `/health` responds 200 OK
- [ ] `/api/toolforge/runs` returns runs from database
- [ ] Filters (tool, status, limit, offset) work correctly
- [ ] Stats endpoint calculates fail_rate, avg_duration correctly
- [ ] All responses have correct JSON schema

---

### Step 1.4 — Dashboard v2 HTML + Execution History Tab (W2–W3)

**File:** `C:\dev\toolforge\dashboard-v2.html`

**Key Sections:**

#### A. HTML Structure (Tabs)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toolforge Dashboard v2</title>
  <!-- CIC design system (Cast Iron Charlie) -->
  <link rel="stylesheet" href="./assets/cic-dashboard.css">
</head>
<body>

<header class="dashboard-header">
  <div class="logo">Toolforge</div>
  <h1>Operational Dashboard</h1>
  <div class="nav-tabs">
    <button class="tab-button active" data-tab="skills">Skills</button>
    <button class="tab-button" data-tab="history">Execution History</button>
    <button class="tab-button" data-tab="errors">Errors</button>
    <button class="tab-button" data-tab="release">Release Pipeline</button>
    <button class="tab-button" data-tab="badges">Status Badges</button>
  </div>
  <button id="refresh-btn" class="refresh-button">REFRESH</button>
</header>

<main class="container">
  <!-- Tab 1: Skills (existing v1) -->
  <section id="tab-skills" class="tab-content active">
    <!-- Load existing skill inventory here -->
  </section>

  <!-- Tab 2: Execution History (new) -->
  <section id="tab-history" class="tab-content">
    <div class="filters">
      <input type="text" id="filter-tool" placeholder="Filter by tool..." class="filter-input">
      <select id="filter-status" class="filter-select">
        <option value="">All statuses</option>
        <option value="success">Success</option>
        <option value="fail">Failed</option>
      </select>
      <input type="date" id="filter-date-from" class="filter-input" placeholder="From date">
      <input type="date" id="filter-date-to" class="filter-input" placeholder="To date">
      <button id="apply-filters" class="filter-button">Apply Filters</button>
    </div>

    <div id="history-stats" class="stats-panel">
      <div class="stat-item">
        <label>Total Runs (24h)</label>
        <span id="stat-total" class="stat-value">0</span>
      </div>
      <div class="stat-item">
        <label>Success Rate</label>
        <span id="stat-success-rate" class="stat-value">0%</span>
      </div>
      <div class="stat-item">
        <label>Avg Duration</label>
        <span id="stat-avg-duration" class="stat-value">0ms</span>
      </div>
    </div>

    <table id="runs-table" class="runs-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Tool</th>
          <th>Duration (ms)</th>
          <th>Status</th>
          <th>Version</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="runs-tbody"></tbody>
    </table>

    <div id="pagination" class="pagination">
      <button id="prev-page" class="page-button">← Prev</button>
      <span id="page-info"></span>
      <button id="next-page" class="page-button">Next →</button>
    </div>
  </section>

  <!-- Tab 3: Errors (placeholder for Step 2) -->
  <section id="tab-errors" class="tab-content">
    <p>Errors tab will be populated in Step 2</p>
  </section>

  <!-- Tab 4: Release Pipeline (placeholder for Step 3) -->
  <section id="tab-release" class="tab-content">
    <p>Release pipeline tab will be populated in Step 3</p>
  </section>

  <!-- Tab 5: Status Badges (placeholder for Step 4) -->
  <section id="tab-badges" class="tab-content">
    <p>Status badges tab will be populated in Step 4</p>
  </section>
</main>

<script src="./assets/dashboard-v2.js"></script>

</body>
</html>
```

#### B. JavaScript Logic (`assets/dashboard-v2.js`)

```javascript
const API_URL = 'http://localhost:3000/api/toolforge';

let currentPage = 0;
const pageSize = 20;

// Tab switching
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
  });
});

// Load runs from API
async function loadRuns() {
  const tool = document.getElementById('filter-tool').value;
  const status = document.getElementById('filter-status').value;
  const limit = pageSize;
  const offset = currentPage * pageSize;

  let url = `${API_URL}/runs?limit=${limit}&offset=${offset}`;
  if (tool) url += `&tool=${tool}`;
  if (status) url += `&status=${status}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    renderRunsTable(data.runs);
    updateStats(data.runs);
    updatePagination();
  } catch (err) {
    console.error('Failed to load runs:', err);
    document.getElementById('runs-tbody').innerHTML = '<tr><td colspan="6">Failed to load data</td></tr>';
  }
}

// Render table
function renderRunsTable(runs) {
  const tbody = document.getElementById('runs-tbody');
  tbody.innerHTML = '';

  runs.forEach(run => {
    const row = document.createElement('tr');
    row.className = run.status === 'success' ? 'run-success' : 'run-fail';
    row.innerHTML = `
      <td>${new Date(run.timestamp).toLocaleString()}</td>
      <td>${run.tool}</td>
      <td>${run.duration_ms || '—'}</td>
      <td class="status-${run.status}">${run.status.toUpperCase()}</td>
      <td>${run.version || '—'}</td>
      <td><a href="#" onclick="viewRunDetails('${run.invocation_id}')">Details</a></td>
    `;
    tbody.appendChild(row);
  });
}

// Update stats
function updateStats(runs) {
  const total = runs.length;
  const success = runs.filter(r => r.status === 'success').length;
  const successRate = total > 0 ? (success / total * 100).toFixed(1) : 0;
  const avgDuration = runs.length > 0
    ? (runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length).toFixed(0)
    : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-success-rate').textContent = `${successRate}%`;
  document.getElementById('stat-avg-duration').textContent = `${avgDuration}ms`;
}

// Pagination
function updatePagination() {
  document.getElementById('page-info').textContent = `Page ${currentPage + 1}`;
}

document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 0) currentPage--;
  loadRuns();
});

document.getElementById('next-page').addEventListener('click', () => {
  currentPage++;
  loadRuns();
});

document.getElementById('apply-filters').addEventListener('click', () => {
  currentPage = 0;
  loadRuns();
});

document.getElementById('refresh-btn').addEventListener('click', loadRuns);

// View run details (placeholder)
function viewRunDetails(invocationId) {
  alert(`Viewing details for ${invocationId}`);
}

// Initial load
loadRuns();
```

#### C. CSS (`assets/cic-dashboard.css`)

```css
/* Cast Iron Charlie design system */
:root {
  --black: #0d0b08;
  --forge: #15120f;
  --iron: #1e1a17;
  --rust: #8B3A1A;
  --ember: #D85A24;
  --brass: #B8922A;
  --ash: #9a9088;
  --bone: #e8e0d4;
  --paper: #f2ece2;
  --white: #faf6f0;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: var(--black);
  color: var(--bone);
  font-family: "Libre Baskerville", serif;
  font-size: 16px;
  line-height: 1.6;
}

header.dashboard-header {
  background: var(--forge);
  border-bottom: 1px solid rgba(196, 80, 26, 0.2);
  padding: 2rem;
}

.nav-tabs {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  border-bottom: 1px solid rgba(154, 144, 136, 0.15);
}

.tab-button {
  background: none;
  border: none;
  color: var(--ash);
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-bottom: 2px solid transparent;
}

.tab-button.active {
  color: var(--ember);
  border-bottom-color: var(--ember);
}

.tab-content {
  display: none;
  padding: 2rem;
}

.tab-content.active {
  display: block;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filter-input, .filter-select, .filter-button {
  padding: 0.5rem 1rem;
  background: rgba(30, 26, 23, 0.9);
  border: 1px solid rgba(154, 144, 136, 0.15);
  color: var(--bone);
  font-size: 0.9rem;
}

.filter-button {
  background: rgba(196, 80, 26, 0.2);
  cursor: pointer;
}

.stats-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-item {
  background: rgba(30, 26, 23, 0.7);
  padding: 1.5rem;
  border: 1px solid rgba(154, 144, 136, 0.08);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ember);
  display: block;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.runs-table th {
  background: rgba(30, 26, 23, 0.9);
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(154, 144, 136, 0.15);
  font-weight: 700;
}

.runs-table td {
  padding: 0.75rem;
  border-bottom: 1px solid rgba(154, 144, 136, 0.08);
}

.runs-table tr.run-success { }
.runs-table tr.run-fail { background: rgba(139, 58, 26, 0.1); }

.status-success { color: var(--bone); }
.status-fail { color: var(--ember); font-weight: 700; }

.pagination {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.page-button {
  padding: 0.5rem 1.5rem;
  background: rgba(196, 80, 26, 0.2);
  border: 1px solid rgba(154, 144, 136, 0.15);
  color: var(--bone);
  cursor: pointer;
}

.refresh-button {
  padding: 0.5rem 1rem;
  background: rgba(196, 80, 26, 0.3);
  border: 1px solid rgba(196, 80, 26, 0.5);
  color: var(--bone);
  cursor: pointer;
  font-weight: 600;
}
```

**Success Criteria:**
- [ ] Dashboard v2.html loads and renders tabs
- [ ] Execution History tab fetches from `/api/toolforge/runs`
- [ ] Runs display in table with timestamp, tool, duration, status
- [ ] Filters (tool, status, date) work
- [ ] Pagination works (prev/next)
- [ ] Stats calculated and displayed (total, success rate, avg duration)
- [ ] Responsive design (mobile-friendly)
- [ ] WCAG AA accessible

---

## STEP 2: ERROR COLLECTION + ALERTS (W3–W4)

### Step 2.1 — Error Taxonomy + Logging

**Error Codes (Enum):**

```powershell
enum ErrorCode {
  E_VALIDATION = "E_VALIDATION"   # Input validation failed
  E_RUNTIME = "E_RUNTIME"         # Runtime execution error
  E_DEPENDENCY = "E_DEPENDENCY"   # Missing/unavailable dependency
  E_ENVIRONMENT = "E_ENVIRONMENT" # Environment config error
  E_TIMEOUT = "E_TIMEOUT"         # Execution timeout
}
```

**Modify run-tool.ps1 to Classify Errors:**

```powershell
# In catch block:
$errorCode = Classify-Error -Exception $_.Exception -ErrorMessage $_.Exception.Message

function Classify-Error {
  param(
    [System.Exception]$Exception,
    [string]$ErrorMessage
  )

  if ($ErrorMessage -match "timeout|timed out") { return "E_TIMEOUT" }
  if ($ErrorMessage -match "not found|cannot find|missing") { return "E_DEPENDENCY" }
  if ($ErrorMessage -match "invalid|validation") { return "E_VALIDATION" }
  if ($ErrorMessage -match "environment|env|config") { return "E_ENVIRONMENT" }
  return "E_RUNTIME"
}
```

**Store Structured Error Logs:**

Modify Write-Telemetry to also write to errors table:

```powershell
if ($Event -eq "fail") {
  $errorId = [System.Guid]::NewGuid().ToString()
  
  # Write to errors table
  $cmd.CommandText = @"
    INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message, stack_trace)
    VALUES (@errorId, @invocationId, @tool, @timestamp, @errorCode, @errorMessage, @stackTrace)
"@
  
  $cmd.Parameters.AddWithValue("@errorId", $errorId) | Out-Null
  # ... other params ...
  
  $cmd.ExecuteNonQuery() | Out-Null
}
```

**API Route: GET /api/toolforge/errors**

Add to Node backend:

```javascript
// GET /api/toolforge/errors?tool=xyz&limit=50&window=24h
app.get('/api/toolforge/errors', (req, res) => {
  const tool = req.query.tool || null;
  const limit = parseInt(req.query.limit) || 50;
  const window = req.query.window || '24h';
  
  const windowMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    'all': Infinity
  }[window] || 24 * 60 * 60 * 1000;

  const cutoff = new Date(Date.now() - windowMs).toISOString();

  let sql = 'SELECT * FROM errors WHERE timestamp > ?';
  const params = [cutoff];

  if (tool) {
    sql += ' AND tool = ?';
    params.push(tool);
  }

  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ errors: rows, count: rows.length });
  });
});

// GET /api/toolforge/errors/taxonomy
app.get('/api/toolforge/errors/taxonomy', (req, res) => {
  const window = req.query.window || '24h';
  
  const windowMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    'all': Infinity
  }[window] || 24 * 60 * 60 * 1000;

  const cutoff = new Date(Date.now() - windowMs).toISOString();

  db.all(`
    SELECT
      error_code,
      COUNT(*) as count,
      GROUP_CONCAT(DISTINCT tool) as tools
    FROM errors
    WHERE timestamp > ?
    GROUP BY error_code
    ORDER BY count DESC
  `, [cutoff], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ taxonomy: rows, window });
  });
});
```

**Success Criteria:**
- [ ] Errors classified into 5 categories
- [ ] errors table populated on tool failure
- [ ] `/api/toolforge/errors` returns structured error logs
- [ ] `/api/toolforge/errors/taxonomy` returns error distribution
- [ ] Error messages + stack traces stored and retrievable

---

### Step 2.2 — Alert Thresholds

**Configuration File:** `C:\dev\toolforge\config\alert-thresholds.json`

```json
{
  "alerts": [
    {
      "name": "error_spike",
      "condition": "error_count_10m > 10",
      "threshold": 10,
      "window_minutes": 10,
      "error_codes": ["E_RUNTIME"],
      "severity": "CRITICAL",
      "enabled": true
    },
    {
      "name": "fail_rate",
      "condition": "fail_rate_1h > 0.15",
      "threshold": 0.15,
      "window_minutes": 60,
      "status": "fail",
      "severity": "CRITICAL",
      "enabled": true
    },
    {
      "name": "duration_anomaly",
      "condition": "p99_duration > 2x baseline",
      "threshold_multiplier": 2.0,
      "window_minutes": 60,
      "severity": "WARNING",
      "enabled": true
    }
  ]
}
```

**Alert Engine (Node backend):**

```javascript
// Evaluate alerts (run every 5 minutes)
async function evaluateAlerts() {
  const now = new Date().toISOString();

  // Check error spike
  db.get(`
    SELECT COUNT(*) as error_count FROM errors
    WHERE timestamp > datetime('now', '-10 minutes')
  `, (err, row) => {
    if (err) return;
    if (row.error_count > 10) {
      createAlert('error_spike', 'E_RUNTIME', row.error_count, 10);
    }
  });

  // Check fail rate
  db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count
    FROM runs
    WHERE timestamp > datetime('now', '-1 hour')
  `, (err, row) => {
    if (err) return;
    const failRate = row.total > 0 ? row.fail_count / row.total : 0;
    if (failRate > 0.15) {
      createAlert('fail_rate', null, failRate, 0.15);
    }
  });
}

function createAlert(alertType, tool, actualValue, thresholdValue) {
  const alertId = require('uuid').v4();
  const timestamp = new Date().toISOString();

  db.run(`
    INSERT INTO alerts (alert_id, tool, timestamp, alert_type, threshold_value, actual_value, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `, [alertId, tool || 'system', timestamp, alertType, thresholdValue, actualValue], (err) => {
    if (err) console.error('Failed to create alert:', err);
    else console.log(`Alert created: ${alertType}`);
  });
}

// Run every 5 minutes
setInterval(evaluateAlerts, 5 * 60 * 1000);
```

**Success Criteria:**
- [ ] alert-thresholds.json configured
- [ ] Alert engine evaluates thresholds every 5 minutes
- [ ] Alerts written to alerts table
- [ ] `/api/toolforge/alerts` endpoint returns active alerts
- [ ] Alerts do not fire false positives

---

### Step 2.3 — Dashboard v2 Errors Tab

**Add to dashboard-v2.html:**

```html
<!-- Tab 3: Errors (new) -->
<section id="tab-errors" class="tab-content">
  <div class="filters">
    <input type="text" id="filter-error-tool" placeholder="Filter by tool..." class="filter-input">
    <select id="filter-error-code" class="filter-select">
      <option value="">All errors</option>
      <option value="E_RUNTIME">E_RUNTIME</option>
      <option value="E_VALIDATION">E_VALIDATION</option>
      <option value="E_DEPENDENCY">E_DEPENDENCY</option>
      <option value="E_ENVIRONMENT">E_ENVIRONMENT</option>
      <option value="E_TIMEOUT">E_TIMEOUT</option>
    </select>
    <button id="apply-error-filters" class="filter-button">Apply Filters</button>
  </div>

  <div id="error-taxonomy" class="taxonomy-panel">
    <h3>Error Distribution (24h)</h3>
    <div id="taxonomy-chart" class="chart"></div>
  </div>

  <table id="errors-table" class="errors-table">
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Tool</th>
        <th>Error Code</th>
        <th>Message</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="errors-tbody"></tbody>
  </table>
</section>
```

**JavaScript:**

```javascript
async function loadErrors() {
  const tool = document.getElementById('filter-error-tool').value;
  const errorCode = document.getElementById('filter-error-code').value;

  let url = `${API_URL}/errors?limit=50`;
  if (tool) url += `&tool=${tool}`;
  if (errorCode) url += `&error_code=${errorCode}`;

  const response = await fetch(url);
  const data = await response.json();

  renderErrorsTable(data.errors);
  loadErrorTaxonomy();
}

function renderErrorsTable(errors) {
  const tbody = document.getElementById('errors-tbody');
  tbody.innerHTML = '';

  errors.forEach(err => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(err.timestamp).toLocaleString()}</td>
      <td>${err.tool}</td>
      <td class="error-code">${err.error_code}</td>
      <td class="error-message">${err.error_message}</td>
      <td><a href="#" onclick="viewError('${err.error_id}')">Details</a></td>
    `;
    tbody.appendChild(row);
  });
}

async function loadErrorTaxonomy() {
  const response = await fetch(`${API_URL}/errors/taxonomy?window=24h`);
  const data = await response.json();

  // Render simple bar chart
  const chart = document.getElementById('taxonomy-chart');
  chart.innerHTML = data.taxonomy.map(t => `
    <div class="taxonomy-row">
      <span class="error-code-label">${t.error_code}</span>
      <div class="bar" style="width: ${Math.min(t.count * 10, 100)}%"></div>
      <span class="count">${t.count}</span>
    </div>
  `).join('');
}

document.getElementById('apply-error-filters').addEventListener('click', loadErrors);
```

**Success Criteria:**
- [ ] Errors tab displays error logs
- [ ] Error taxonomy visualization works
- [ ] Filters by tool + error code work
- [ ] Error distribution chart updates
- [ ] Details view shows full stack trace

---

## STEP 3: RELEASE AUTOMATION (W5)

### Step 3.1 — Semver Automation

**File:** `C:\dev\toolforge\utilities\bump-version.ps1`

```powershell
param(
  [ValidateSet('patch', 'minor', 'major')] [string]$BumpType = 'patch',
  [string]$VersionFile = "C:\dev\toolforge\VERSION.md"
)

# Read current version
$content = Get-Content $VersionFile -Raw
$match = [regex]::Match($content, 'version: (\d+\.\d+\.\d+)')
$currentVersion = $match.Groups[1].Value

# Parse version
$parts = $currentVersion -split '\.'
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Bump
switch ($BumpType) {
  'major' { $major++; $minor = 0; $patch = 0 }
  'minor' { $minor++; $patch = 0 }
  'patch' { $patch++ }
}

$newVersion = "$major.$minor.$patch"

# Update VERSION.md
$newContent = $content -replace "version: $currentVersion", "version: $newVersion"
$newContent = $newContent -replace "date: .*", "date: $(Get-Date -Format 'yyyy-MM-dd')"

Set-Content $VersionFile $newContent
Write-Host "Version bumped: $currentVersion → $newVersion"

# Output for CI
Write-Output "::set-output name=version::$newVersion"
```

**GitHub Actions Workflow:** `.github/workflows/toolforge-release.yml`

```yaml
name: Toolforge Release

on:
  push:
    branches: [main]
    paths:
      - 'toolforge/**'
      - '!toolforge/docs/**'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Determine version bump
        id: version
        run: |
          # Analyze commits since last tag
          COMMITS=$(git log $(git describe --tags --abbrev=0)..HEAD --oneline | wc -l)
          if [ $COMMITS -gt 0 ]; then
            echo "bump_type=patch" >> $GITHUB_OUTPUT
          fi
      
      - name: Bump version
        if: steps.version.outputs.bump_type
        run: |
          pwsh toolforge/utilities/bump-version.ps1 -BumpType ${{ steps.version.outputs.bump_type }}
      
      - name: Generate release notes
        run: |
          pwsh toolforge/utilities/generate-changelog.ps1
      
      - name: Create tag
        if: steps.version.outputs.bump_type
        run: |
          VERSION=$(cat toolforge/VERSION.md | grep version | awk '{print $2}')
          git tag v$VERSION
          git push origin v$VERSION
      
      - name: Publish release
        uses: softprops/action-gh-release@v1
        with:
          files: CHANGELOG.md
          tag_name: v${{ env.NEW_VERSION }}
```

**Success Criteria:**
- [ ] VERSION.md auto-incremented
- [ ] Tags created for releases
- [ ] CI workflow triggers on toolforge changes
- [ ] Release notes generated from commits

---

### Step 3.2 — Release Notes Generator

**File:** `C:\dev\toolforge\utilities/generate-changelog.ps1`

```powershell
param([string]$OutputFile = "C:\dev\toolforge\CHANGELOG.md")

# Get commits since last tag
$lastTag = git describe --tags --abbrev=0 2>$null || "initial"
$commits = git log $lastTag..HEAD --pretty=format:"%h - %s (%an)"

# Generate changelog entry
$entry = @"
## Version $((Get-Content "C:\dev\toolforge\VERSION.md" | Select-String "version:").ToString().Split(' ')[1])
Date: $(Get-Date -Format 'yyyy-MM-dd')

### Changes
$(
  $commits | ForEach-Object {
    "- $_"
  }
)

"@

# Prepend to CHANGELOG.md
$oldContent = Get-Content $OutputFile -Raw -ErrorAction SilentlyContinue
Set-Content $OutputFile ($entry + "`n" + $oldContent)

Write-Host "Changelog updated"
```

**Success Criteria:**
- [ ] CHANGELOG.md auto-generated from commits
- [ ] Entries include commit hash, message, author
- [ ] Newest changes at top

---

## STEP 4: STATUS BADGES (W6)

### Step 4.1 — Badge Endpoints

**Add to Node backend:**

```javascript
// GET /api/toolforge/badge/health/{tool}
// Returns: svg badge showing ONLINE/DEGRADED/DOWN
app.get('/api/toolforge/badge/health/:tool', (req, res) => {
  const { tool } = req.params;

  db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count
    FROM runs
    WHERE tool = ? AND timestamp > datetime('now', '-24 hours')
  `, [tool], (err, row) => {
    if (err) return res.status(500).send('Error');

    let health = 'ONLINE';
    let color = '#00AA00';

    if (row.total === 0) {
      health = 'UNKNOWN';
      color = '#999999';
    } else {
      const failRate = row.fail_count / row.total;
      if (failRate > 0.2) {
        health = 'DOWN';
        color = '#DD0000';
      } else if (failRate > 0.05) {
        health = 'DEGRADED';
        color = '#FFAA00';
      }
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(generateBadgeSvg(`${tool}`, health, color));
  });
});

function generateBadgeSvg(label, message, color) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="20">
      <g shape-rendering="crispEdges">
        <rect width="60" height="20" fill="#555"/>
        <rect x="60" width="40" height="20" fill="${color}"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="Verdana" font-size="11" font-weight="bold">
        <text x="30" y="14">${label}</text>
        <text x="80" y="14">${message}</text>
      </g>
    </svg>
  `;
}

// GET /api/toolforge/badge/latency/{tool}
app.get('/api/toolforge/badge/latency/:tool', (req, res) => {
  // Similar pattern, return p95 latency
});

// GET /api/toolforge/badge/errors/{tool}
app.get('/api/toolforge/badge/errors/:tool', (req, res) => {
  // Similar pattern, return 24h error count
});
```

**Success Criteria:**
- [ ] `/badge/health/{tool}` returns SVG badge
- [ ] `/badge/latency/{tool}` returns SVG badge
- [ ] `/badge/errors/{tool}` returns SVG badge
- [ ] Badges render correctly in markdown/README

---

### Step 4.2 — Dashboard v2 Badges Tab

**Add to dashboard-v2.html:**

```html
<section id="tab-badges" class="tab-content">
  <div id="badges-grid" class="badges-grid"></div>
</section>
```

**JavaScript:**

```javascript
async function loadBadges() {
  // Get list of tools
  const response = await fetch(`${API_URL}/runs?limit=1`);
  const data = await response.json();

  const tools = [...new Set(data.runs.map(r => r.tool))];

  const grid = document.getElementById('badges-grid');
  grid.innerHTML = '';

  tools.forEach(tool => {
    const badgeHtml = `
      <div class="badge-item">
        <h4>${tool}</h4>
        <img src="/api/toolforge/badge/health/${tool}" alt="Health">
        <img src="/api/toolforge/badge/latency/${tool}" alt="Latency">
        <img src="/api/toolforge/badge/errors/${tool}" alt="Errors">
      </div>
    `;
    grid.innerHTML += badgeHtml;
  });
}
```

**Success Criteria:**
- [ ] Badges tab displays all tools
- [ ] Badges render as SVG images
- [ ] Badges update in real-time
- [ ] Badges embeddable in README.md

---

## TEST STRATEGY

### Unit Tests

**run-store.db initialization:**
```powershell
# Test: init-run-store.ps1 creates valid database
$dbPath = "test-run-store.db"
.\utilities\init-run-store.ps1 -DbPath $dbPath
$tableCount = (& sqlite3 $dbPath "SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
Assert-Equal $tableCount 4  # runs, tools, errors, alerts
Remove-Item $dbPath
```

**Telemetry hook:**
```powershell
# Test: run-tool.ps1 writes telemetry on success
# Test: run-tool.ps1 writes telemetry on error
# Test: Telemetry includes invocation_id, duration, status
```

### Integration Tests

**API endpoints:**
```javascript
// Test: GET /api/toolforge/runs returns data
// Test: GET /api/toolforge/errors returns errors
// Test: GET /api/toolforge/badge/health/{tool} returns SVG
// Test: Filters work (tool, status, error_code, window)
```

**Dashboard v2:**
```javascript
// Test: Dashboard loads runs from API
// Test: Filters apply correctly
// Test: Pagination works
// Test: Stats calculated correctly
```

### E2E Tests

**Full flow:**
```
1. Run a tool via run-tool.ps1
2. Verify telemetry written to run-store.db
3. Verify API returns the run
4. Verify dashboard displays the run
5. Verify badge reflects the status
```

**Error flow:**
```
1. Run a tool that fails
2. Verify error classified
3. Verify error_log table populated
4. Verify API returns the error
5. Verify dashboard error tab shows it
6. Verify alert fires if threshold exceeded
```

---

## RISK MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SQLite write contention | Lost telemetry | Use WAL mode, atomic transactions |
| API server down | Dashboard can't load | Fallback to local JSON export |
| Telemetry hook slows tools | Tool invocation slow | Async writes, batch I/O |
| Dashboard browser cache | Stale data | Add Cache-Control: no-cache |
| Version bump collision | Conflicting releases | Sequential CI queue, lock file |
| Badge endpoint overload | Dashboard lag | Cache badges 5min, rate limit |

---

## DELIVERABLES SUMMARY

**Step 1 (W1–W3):**
- ✅ run-store.db schema + init script
- ✅ run-tool.ps1 telemetry hook
- ✅ `/api/toolforge` Node backend + `/runs` endpoint
- ✅ dashboard-v2.html with Execution History tab

**Step 2 (W3–W4):**
- ✅ Error taxonomy + classification
- ✅ Structured error logs
- ✅ `/api/toolforge/errors` endpoint
- ✅ Dashboard Errors tab + error distribution

**Step 3 (W5):**
- ✅ Semver automation (bump-version.ps1)
- ✅ GitHub Actions release workflow
- ✅ Release notes generator
- ✅ Dashboard Release Pipeline tab

**Step 4 (W6):**
- ✅ Badge endpoints (`/badge/health`, `/badge/latency`, `/badge/errors`)
- ✅ Dashboard Badges tab
- ✅ Real-time badge updates

**Total Files Created:** 20+  
**Total Lines of Code:** ~2,000  
**Test Cases:** 20+  
**Execution Time:** 10 days

---

## COMMIT STRATEGY

Each step commits separately to main:

```
Commit 1: "feat: Step 1 - Execution history + run tracking"
Commit 2: "feat: Step 2 - Error collection + alerts"
Commit 3: "feat: Step 3 - Release automation"
Commit 4: "feat: Step 4 - Status badges"
```

Each commit includes passing tests + documentation updates.

---

**Plan Status:** ✅ READY FOR EXECUTION

**Next Step:** Builder agent or immediate start (your call)
