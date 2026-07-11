-- ============================================================
-- Toolforge run-store.db — Phase 2b Step 1 schema
-- Idempotent. Safe to re-run. UTC ISO-8601 timestamps ('o').
-- ============================================================

-- runs: one authoritative row per completed tool invocation
CREATE TABLE IF NOT EXISTS runs (
  invocation_id  TEXT    PRIMARY KEY NOT NULL,          -- UUID v4 (lowercase)
  tool           TEXT    NOT NULL,                      -- FK -> tools(name)
  timestamp      TEXT    NOT NULL,                      -- ISO-8601 UTC, completion time
  duration_ms    INTEGER NOT NULL DEFAULT 0,            -- wall-clock ms, >= 0
  status         TEXT    NOT NULL,                      -- 'success' | 'fail'
  error_code     TEXT,                                  -- NULL on success; 'E_RUNTIME' etc on fail
  error_message  TEXT,                                  -- NULL on success
  version        TEXT,                                  -- semver of the tool, nullable
  CONSTRAINT chk_runs_status   CHECK (status IN ('success','fail')),
  CONSTRAINT chk_runs_duration CHECK (duration_ms >= 0),
  FOREIGN KEY (tool) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_runs_timestamp        ON runs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_runs_tool_timestamp   ON runs(tool, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status_timestamp ON runs(status, timestamp DESC);

-- tools: tool registry. Populated by UPSERT from the telemetry hook.
-- success_count/fail_count/avg_duration_ms are RESERVED (not written in Step 1;
-- stats are computed live from runs). Kept for forward-compat.
CREATE TABLE IF NOT EXISTS tools (
  name            TEXT    PRIMARY KEY NOT NULL,
  category        TEXT,
  version         TEXT,
  first_seen      TEXT,                                 -- ISO-8601 UTC, set once on insert
  last_run        TEXT,                                 -- ISO-8601 UTC, updated every run
  success_count   INTEGER DEFAULT 0,                    -- RESERVED (unused Step 1)
  fail_count      INTEGER DEFAULT 0,                    -- RESERVED (unused Step 1)
  avg_duration_ms REAL                                  -- RESERVED (unused Step 1)
);

-- ---- Step 2 forward-compat (created, NOT written in Step 1) ----
CREATE TABLE IF NOT EXISTS errors (
  error_id       TEXT PRIMARY KEY NOT NULL,
  invocation_id  TEXT NOT NULL,
  tool           TEXT NOT NULL,
  timestamp      TEXT NOT NULL,
  error_code     TEXT NOT NULL,
  error_message  TEXT,
  stack_trace    TEXT,
  FOREIGN KEY (invocation_id) REFERENCES runs(invocation_id),
  FOREIGN KEY (tool)          REFERENCES tools(name)
);
CREATE INDEX IF NOT EXISTS idx_errors_tool_timestamp ON errors(tool, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_error_code     ON errors(error_code);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id        TEXT PRIMARY KEY NOT NULL,
  tool            TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  alert_type      TEXT NOT NULL,
  threshold_value REAL NOT NULL,
  actual_value    REAL NOT NULL,
  status          TEXT NOT NULL,
  FOREIGN KEY (tool) REFERENCES tools(name)
);
CREATE INDEX IF NOT EXISTS idx_alerts_tool_timestamp ON alerts(tool, timestamp DESC);
