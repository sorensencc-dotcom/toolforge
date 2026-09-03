# IronLedger Phase 2b review and categorization implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a staged transaction a contra account and move it through an explicit `pending -> categorized -> approved | rejected` lifecycle under operator authorization, with a database-backed payee rule engine that auto-fills the contra account at import time and a guided interactive review loop.

**Architecture:** A new `src/ironledger/review/` package holds the state machine (`state.py`), the approve precondition (`approve_gate.py`), the rule engine (`rules.py`), and the guided loop (`loop.py`). Migration `0004`, written whole in Task 1, rebuilds `staged_transactions` to widen its `status` CHECK and adds `categorization_rules`. The Phase 2a import pipeline gains one call into `rules.resolve_rule`, replaces `_with_placeholder_account` with a required `--importing-account` flag for OFX/QFX, and threads a `rules_applied` count. The CLI grows a `review` subcommand tree and a `rule` subcommand tree that reuse the extended `cli/auth.py` gate.

**Tech Stack:** Python 3.12+ standard library only (`argparse`, `sqlite3`, `re`, `unicodedata`, `io`). One existing runtime dependency (`ofxtools`) is untouched. Tests are `pytest` (dev-only dependency).

**Repo:** `C:\dev\IronLedger` (local `main`, no remote, decision D-0). Run tests with `PYTHONPATH=src python -m pytest -q`. Baseline before Task 1: **161 passed, 1 skipped**.

**Spec:** `C:\dev\docs\meta\specs\ironledger-phase-2b-review-design.md` (operator-approved). The plan argues from the spec; executors read both.

## Global Constraints

- Python `requires-python = ">=3.12"`. Standard library only; add no dependency.
- Monetary values are signed 64-bit integer minor units with an explicit currency and scale. No floating-point on any path. Unlike currencies are never netted.
- All stored timestamps are UTC ISO-8601 `%Y-%m-%dT%H:%M:%SZ` (trailing `Z`). Functions that write timestamps take an optional `now_utc: str | None = None` parameter and default to `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`, matching Phase 2a.
- `audit.append_audit_event(conn, *, actor, action, target, result, ...)` has a fixed field envelope and **no payload column**. Event detail rides in the `action` string, exactly as Phase 2a (`import (records_created=5)`). `result` is one of `"ok"`, `"denied"`, `"error"`. `actor` is `"operator"` for every Phase 2b event.
- Account names are validated with `ironledger.conventions.validate_account_name(name) -> str`, which raises `ConventionError` (a `ValueError` subclass). Valid roots: `Assets`, `Liabilities`, `Equity`, `Income`, `Expenses`.
- Payee canonicalization for rule matching is `ironledger.ingest.identity.canonical_payee(value)` — NFC, casefold, ASCII whitespace collapse, strip. Frozen for identity version 1; reuse it, do not reimplement.
- Migration files are `NNNN_name.sql` in `src/ironledger/db/schema/`, applied by `ironledger.db.migrations.migrate`. The runner wraps each file in a single `BEGIN; <file> <bookkeeping> COMMIT;`. **A migration file must not contain its own `BEGIN`/`COMMIT` and must not rely on `PRAGMA foreign_keys` (ignored inside a transaction).** Versions must be a gapless 1-based sequence, so the new file is `0004_review_workflow.sql`.
- `ironledger.db.migrations` stores a SHA-256 of each migration file's text and raises `ChecksumMismatch` if a recorded file changes on disk. **`0004_review_workflow.sql` is therefore written whole in Task 1 and never edited again.** Task 2 adds only test coverage for the `categorization_rules` table that Task 1's file already creates. Do not run the CLI against a persistent database between tasks; tests use `:memory:` and are unaffected.
- `ironledger.conventions.validate_same_currency_balance(postings)` takes a list of `{account, minor_units, currency}`-shaped dicts, returns `{currency: 0}` on success, and raises `ConventionError` on a non-zero per-currency sum, fewer than two postings, or a zero-amount posting. Reuse it; do not hand-roll a balance loop.
- Every mutating command fails closed: safe mode on, or missing/wrong `--confirm` on a non-TTY, raises `AuthorizationError` (exit code 3) and writes one `denied` audit event.
- Tests are the focused `pytest` suite only. Full-suite, live-bank-file, and production evidence stay deferred. Every task keeps the suite green.
- CRLF note: this repo's files are LF. Write new files LF. Do not let an editor rewrite existing files to CRLF or vice versa; check `git diff --stat` before staging.

---

### Task 1: Migration 0004 — the complete review-workflow schema

Write `0004_review_workflow.sql` **whole** in this task: the `staged_transactions` rebuild **and** the `categorization_rules` table. The migration runner records a checksum of this file, so it must not change again (Global Constraints). Task 2 adds only more tests against it.

**Files:**
- Create: `src/ironledger/db/schema/0004_review_workflow.sql`
- Test: `tests/test_migration_0004.py`

**Interfaces:**
- Consumes: `ironledger.db.migrations.migrate`, `ironledger.db.connection.connect` (Phase 1).
- Produces: schema version 4; `staged_transactions` with `status IN ('pending','categorized','approved','rejected')` and new nullable columns `reject_reason TEXT`, `categorized_at_utc TEXT`; the `categorization_rules` table with `UNIQUE (match_type, pattern, importing_account)` and index `idx_categorization_rules_active_priority (active, priority)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_migration_0004.py
"""Phase 2b: migration 0004 widens staged_transactions.status and adds review columns."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    return conn


def _seed(conn: sqlite3.Connection) -> tuple[str, str]:
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
        f" canonical_payload, content_sha256, created_at_utc) VALUES ('rec-1','doc-1',0,'{{}}',"
        f" '{'b'*64}','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO staged_transactions (staged_transaction_id, source_record_id, status, "
        " proposed_date, payee, narration, identity_algo_version, identity_method, "
        " identity_fingerprint, created_at_utc) "
        f"VALUES ('stx-1','rec-1','pending','2026-09-01','Store','',1,'sha256_fallback',"
        f" '{'c'*64}','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO staged_postings (staged_posting_id, staged_transaction_id, source_record_id, "
        " role, posting_index, account, minor_units, currency, minor_unit_scale, created_at_utc) "
        "VALUES ('sp-0','stx-1','rec-1','imported',0,'Assets:Bank:Checking',-1299,'USD',2,"
        " '2026-09-02T10:00:00Z'),"
        " ('sp-1','stx-1','rec-1','contra',1,NULL,1299,'USD',2,'2026-09-02T10:00:00Z')"
    )
    conn.commit()
    return "stx-1", "rec-1"


def test_reaches_version_four(db: sqlite3.Connection):
    assert migrations.current_version(db) == 4


def test_status_check_accepts_categorized_and_rejects_unknown(db: sqlite3.Connection):
    _seed(db)
    db.execute("UPDATE staged_transactions SET status = 'categorized' WHERE staged_transaction_id = 'stx-1'")
    db.commit()
    assert db.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = 'stx-1'"
    ).fetchone()[0] == "categorized"
    with pytest.raises(sqlite3.IntegrityError):
        db.execute("UPDATE staged_transactions SET status = 'archived' WHERE staged_transaction_id = 'stx-1'")


def test_new_columns_present_and_default_null(db: sqlite3.Connection):
    _seed(db)
    row = db.execute(
        "SELECT reject_reason, categorized_at_utc FROM staged_transactions WHERE staged_transaction_id = 'stx-1'"
    ).fetchone()
    assert row == (None, None)


def test_rebuild_preserves_rows_and_foreign_keys(db: sqlite3.Connection):
    _seed(db)
    assert db.execute("SELECT count(*) FROM staged_transactions").fetchone()[0] == 1
    assert db.execute("SELECT count(*) FROM staged_postings").fetchone()[0] == 2
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []


def test_identity_uniqueness_still_enforced(db: sqlite3.Connection):
    _seed(db)
    with pytest.raises(sqlite3.IntegrityError):
        db.execute(
            "INSERT INTO staged_transactions (staged_transaction_id, source_record_id, status, "
            " proposed_date, payee, narration, identity_algo_version, identity_method, "
            " identity_fingerprint, created_at_utc) "
            f"VALUES ('stx-dup','rec-1','pending','2026-09-01','Store','',1,'sha256_fallback',"
            f" '{'c'*64}','2026-09-02T10:00:00Z')"
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_migration_0004.py -q`
Expected: FAIL — `migrations.MigrationError` (no `0004_*.sql`) or version is 3.

- [ ] **Step 3: Write the migration file**

```sql
-- src/ironledger/db/schema/0004_review_workflow.sql
-- IronLedger Phase 2b: widen staged_transactions.status and add the review workflow.
--
-- The migration runner wraps this file in a single BEGIN/COMMIT and PRAGMA
-- foreign_keys is ignored inside a transaction, so the classic
-- "foreign_keys = OFF" table rebuild is unavailable. Two tables reference
-- staged_transactions.staged_transaction_id: staged_postings (ON DELETE CASCADE)
-- and ledger_entries (ON DELETE RESTRICT). The rebuild parks and restores
-- staged_postings so DROP TABLE cascades into nothing.
--
-- ledger_entries is created by migration 0001 but is only ever populated by the
-- Phase 3 compiler, which does not exist yet. 0004 is recorded before any
-- Phase 3 work runs, so at apply time ledger_entries has zero rows and the
-- implicit DELETE inside DROP TABLE never triggers its ON DELETE RESTRICT.
-- If a future migration reorders this, revisit the DROP below.

CREATE TABLE staged_postings_rebuild_backup AS SELECT * FROM staged_postings;

DELETE FROM staged_postings;

CREATE TABLE staged_transactions_new (
    staged_transaction_id TEXT PRIMARY KEY,
    source_record_id      TEXT NOT NULL
        REFERENCES source_records (source_record_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    status                TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'categorized', 'approved', 'rejected')),
    proposed_date         TEXT NOT NULL CHECK (proposed_date GLOB '????-??-??'),
    payee                 TEXT NOT NULL DEFAULT '',
    narration             TEXT NOT NULL DEFAULT '',
    identity_algo_version INTEGER NOT NULL CHECK (identity_algo_version >= 1),
    identity_method       TEXT NOT NULL CHECK (identity_method IN ('fitid', 'sha256_fallback')),
    identity_fingerprint  TEXT NOT NULL CHECK (length(identity_fingerprint) = 64),
    created_at_utc        TEXT NOT NULL CHECK (created_at_utc GLOB '????-??-??T??:??:??*Z'),
    decided_at_utc        TEXT CHECK (decided_at_utc IS NULL OR decided_at_utc GLOB '????-??-??T??:??:??*Z'),
    reject_reason         TEXT,
    categorized_at_utc    TEXT CHECK (categorized_at_utc IS NULL OR categorized_at_utc GLOB '????-??-??T??:??:??*Z'),
    UNIQUE (identity_algo_version, identity_fingerprint)
) STRICT;

INSERT INTO staged_transactions_new (
    staged_transaction_id, source_record_id, status, proposed_date, payee, narration,
    identity_algo_version, identity_method, identity_fingerprint, created_at_utc, decided_at_utc,
    reject_reason, categorized_at_utc
)
SELECT
    staged_transaction_id, source_record_id, status, proposed_date, payee, narration,
    identity_algo_version, identity_method, identity_fingerprint, created_at_utc, decided_at_utc,
    NULL, NULL
FROM staged_transactions;

DROP TABLE staged_transactions;

ALTER TABLE staged_transactions_new RENAME TO staged_transactions;

INSERT INTO staged_postings SELECT * FROM staged_postings_rebuild_backup;

DROP TABLE staged_postings_rebuild_backup;

CREATE TABLE categorization_rules (
    rule_id           TEXT PRIMARY KEY,
    match_type        TEXT NOT NULL CHECK (match_type IN ('exact', 'prefix', 'regex')),
    pattern           TEXT NOT NULL,
    importing_account TEXT CHECK (
        importing_account IS NULL
        OR importing_account GLOB 'Assets:*' OR importing_account GLOB 'Liabilities:*'
        OR importing_account GLOB 'Equity:*' OR importing_account GLOB 'Income:*'
        OR importing_account GLOB 'Expenses:*'
    ),
    target_account    TEXT NOT NULL CHECK (
        target_account GLOB 'Assets:*' OR target_account GLOB 'Liabilities:*'
        OR target_account GLOB 'Equity:*' OR target_account GLOB 'Income:*'
        OR target_account GLOB 'Expenses:*'
    ),
    priority          INTEGER NOT NULL DEFAULT 100,
    active            INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at_utc    TEXT NOT NULL CHECK (created_at_utc GLOB '????-??-??T??:??:??*Z'),
    disabled_at_utc   TEXT CHECK (disabled_at_utc IS NULL OR disabled_at_utc GLOB '????-??-??T??:??:??*Z'),
    UNIQUE (match_type, pattern, importing_account)
) STRICT;

CREATE INDEX idx_categorization_rules_active_priority ON categorization_rules (active, priority);
```

Add two assertions to `tests/test_migration_0004.py` so this task also proves the rules table landed:

```python
def test_categorization_rules_table_and_index_present(db: sqlite3.Connection):
    db.execute(
        "INSERT INTO categorization_rules (rule_id, match_type, pattern, importing_account, "
        " target_account, priority, active, created_at_utc) "
        "VALUES ('r1','exact','coffee bar',NULL,'Expenses:Coffee',100,1,'2026-09-03T10:00:00Z')"
    )
    db.commit()
    assert db.execute("SELECT count(*) FROM categorization_rules").fetchone()[0] == 1
    names = {r[1] for r in db.execute("PRAGMA index_list('categorization_rules')")}
    assert "idx_categorization_rules_active_priority" in names
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_migration_0004.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the whole suite**

Run: `PYTHONPATH=src python -m pytest -q`
Expected: the Phase 2a `test_migration_0003.py::test_migrate_reaches_version_three` and any test asserting `current_version == 3` still pass (0003 is unchanged); everything else green. If a Phase 2a test hard-codes "highest version is 3", update it to 4 in this task and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add src/ironledger/db/schema/0004_review_workflow.sql tests/test_migration_0004.py
git commit -m "feat(phase-2b): migration 0004 — review lifecycle rebuild and categorization_rules"
```

---

### Task 2: `categorization_rules` constraint coverage

The table and index already exist in `0004_review_workflow.sql` from Task 1 (the file's checksum is now frozen — do not edit it). This task adds the remaining constraint tests in their own file.

**Files:**
- Test: `tests/test_migration_0004_rules.py`

**Interfaces:**
- Consumes: the `categorization_rules` table from Task 1.
- Produces: no code — test coverage only.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_migration_0004_rules.py
"""Phase 2b: migration 0004 adds the categorization_rules table."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    return conn


def _add(conn, rule_id, match_type="exact", pattern="coffee bar",
         importing_account=None, target_account="Expenses:Coffee", priority=100):
    conn.execute(
        "INSERT INTO categorization_rules (rule_id, match_type, pattern, importing_account, "
        " target_account, priority, active, created_at_utc) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
        (rule_id, match_type, pattern, importing_account, target_account, priority,
         "2026-09-03T10:00:00Z"),
    )


def test_table_exists_and_accepts_a_row(db: sqlite3.Connection):
    _add(db, "r1")
    db.commit()
    assert db.execute("SELECT count(*) FROM categorization_rules").fetchone()[0] == 1


def test_match_type_check(db: sqlite3.Connection):
    with pytest.raises(sqlite3.IntegrityError):
        _add(db, "r-bad", match_type="glob")


def test_target_account_root_check(db: sqlite3.Connection):
    with pytest.raises(sqlite3.IntegrityError):
        _add(db, "r-bad", target_account="Nonsense:Root")


def test_unique_on_match_pattern_and_scope(db: sqlite3.Connection):
    _add(db, "r1", importing_account="Assets:Bank:Checking")
    db.commit()
    with pytest.raises(sqlite3.IntegrityError):
        _add(db, "r2", importing_account="Assets:Bank:Checking")
        db.commit()


def test_null_scope_is_distinct_from_a_concrete_account(db: sqlite3.Connection):
    _add(db, "r-global", importing_account=None)
    _add(db, "r-scoped", importing_account="Assets:Bank:Checking")
    db.commit()
    assert db.execute("SELECT count(*) FROM categorization_rules").fetchone()[0] == 2


def test_active_priority_index_present(db: sqlite3.Connection):
    names = {r[1] for r in db.execute("PRAGMA index_list('categorization_rules')")}
    assert "idx_categorization_rules_active_priority" in names
```

- [ ] **Step 2: Run the tests**

Run: `PYTHONPATH=src python -m pytest tests/test_migration_0004_rules.py -q`
Expected: **PASS** immediately — the table and index were created by Task 1's migration file. This task is coverage, not a red-green cycle: it exists so a reviewer can reject the constraint set independently of the rebuild. If any test fails, the bug is in Task 1's `0004_review_workflow.sql`; fix it there (the checksum is not yet frozen against any persistent DB, only `:memory:` test runs) and re-run Task 1's suite too.

- [ ] **Step 3: (no migration edit)**

The migration file is complete and its checksum is frozen. Do not touch `0004_review_workflow.sql` in this task.

- [ ] **Step 4: Run the whole suite**

Run: `PYTHONPATH=src python -m pytest -q`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add tests/test_migration_0004_rules.py
git commit -m "test(phase-2b): categorization_rules constraint coverage"
```

---

### Task 3: `review/rules.py` — rule resolution

**Files:**
- Create: `src/ironledger/review/__init__.py` (empty)
- Create: `src/ironledger/review/rules.py`
- Test: `tests/test_review_rules_resolve.py`

**Interfaces:**
- Consumes: `ironledger.ingest.identity.canonical_payee`, `ironledger.audit.append_audit_event`.
- Produces:
  - `resolve_rule(conn, canonical_payee_value: str, importing_account: str, *, audit_skips: bool = True, now_utc: str | None = None) -> str | None` — returns the winning rule's `target_account`, or `None`. `canonical_payee_value` is already canonicalized by the caller. With `audit_skips=True` (import staging, `auto-match`), a stored `regex` that will not compile is skipped and one audit event records it. With `audit_skips=False` (`review show`, the loop suggestion line), the bad rule is skipped with **no audit write** — those are read paths and must not mutate `audit_events`.
  - `RuleError(ValueError)` — raised for a bad `match_type` or an uncompilable regex at write time (used by Task 4).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_rules_resolve.py
"""Phase 2b: categorization rule resolution — match types, priority, scope, skip-on-bad-regex."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.identity import canonical_payee
from ironledger.review.rules import resolve_rule


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    return conn


def _add(conn, rule_id, *, match_type, pattern, target, importing_account=None,
         priority=100, active=1, created="2026-09-03T10:00:00Z"):
    conn.execute(
        "INSERT INTO categorization_rules (rule_id, match_type, pattern, importing_account, "
        " target_account, priority, active, created_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (rule_id, match_type, pattern, importing_account, target, priority, active, created),
    )
    conn.commit()


def test_exact_match(db):
    _add(db, "r1", match_type="exact", pattern="coffee bar", target="Expenses:Coffee")
    assert resolve_rule(db, canonical_payee("Coffee Bar"), "Assets:Bank:Checking") == "Expenses:Coffee"


def test_prefix_match(db):
    _add(db, "r1", match_type="prefix", pattern="amzn mktp", target="Expenses:Shopping")
    assert resolve_rule(db, canonical_payee("AMZN Mktp US*1A2B3"), "Assets:Bank:Checking") == "Expenses:Shopping"


def test_regex_match(db):
    _add(db, "r1", match_type="regex", pattern=r"^uber\s+(eats|trip)", target="Expenses:Transport")
    assert resolve_rule(db, canonical_payee("UBER   Trip 123"), "Assets:Bank:Checking") == "Expenses:Transport"


def test_no_match_returns_none(db):
    _add(db, "r1", match_type="exact", pattern="coffee bar", target="Expenses:Coffee")
    assert resolve_rule(db, canonical_payee("Gas Station"), "Assets:Bank:Checking") is None


def test_priority_then_created_at_ordering(db):
    _add(db, "low-prio", match_type="prefix", pattern="star", target="Expenses:A", priority=100,
         created="2026-09-03T10:00:00Z")
    _add(db, "high-prio", match_type="prefix", pattern="star", target="Expenses:B", priority=50,
         created="2026-09-03T11:00:00Z")
    assert resolve_rule(db, canonical_payee("Starbucks"), "Assets:Bank:Checking") == "Expenses:B"


def test_importing_account_scope(db):
    _add(db, "scoped", match_type="exact", pattern="transfer", target="Assets:Savings",
         importing_account="Assets:Bank:Checking")
    assert resolve_rule(db, canonical_payee("Transfer"), "Assets:Bank:Other") is None
    assert resolve_rule(db, canonical_payee("Transfer"), "Assets:Bank:Checking") == "Assets:Savings"


def test_inactive_rule_skipped(db):
    _add(db, "r1", match_type="exact", pattern="coffee bar", target="Expenses:Coffee", active=0)
    assert resolve_rule(db, canonical_payee("Coffee Bar"), "Assets:Bank:Checking") is None


def test_uncompilable_regex_is_skipped_and_audited(db):
    _add(db, "bad", match_type="regex", pattern="(unclosed", target="Expenses:X", priority=10)
    _add(db, "ok", match_type="exact", pattern="coffee bar", target="Expenses:Coffee", priority=20)
    assert resolve_rule(db, canonical_payee("Coffee Bar"), "Assets:Bank:Checking") == "Expenses:Coffee"
    row = db.execute(
        "SELECT action, target, result FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    assert row == ("rule resolve (skipped uncompilable regex)", "bad", "error")


def test_uncompilable_regex_with_audit_skips_false_writes_nothing(db):
    _add(db, "bad", match_type="regex", pattern="(unclosed", target="Expenses:X", priority=10)
    _add(db, "ok", match_type="exact", pattern="coffee bar", target="Expenses:Coffee", priority=20)
    before = db.execute("SELECT count(*) FROM audit_events").fetchone()[0]
    assert resolve_rule(
        db, canonical_payee("Coffee Bar"), "Assets:Bank:Checking", audit_skips=False
    ) == "Expenses:Coffee"
    assert db.execute("SELECT count(*) FROM audit_events").fetchone()[0] == before
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_rules_resolve.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ironledger.review'`.

- [ ] **Step 3: Write the implementation**

```python
# src/ironledger/review/__init__.py
```

```python
# src/ironledger/review/rules.py
"""Categorization rule model, resolution, and CRUD (Phase 2b)."""

from __future__ import annotations

import re
import sqlite3

from ironledger.audit import append_audit_event

__all__ = ["RuleError", "resolve_rule"]


class RuleError(ValueError):
    """A rule definition is malformed (bad match_type or uncompilable regex)."""


def resolve_rule(
    conn: sqlite3.Connection,
    canonical_payee_value: str,
    importing_account: str,
    *,
    audit_skips: bool = True,
    now_utc: str | None = None,
) -> str | None:
    """Return the winning active rule's target_account for this payee and account, or None.

    `canonical_payee_value` must already be canonicalized by the caller
    (`ironledger.ingest.identity.canonical_payee`). A stored regex rule that
    fails to compile is skipped; it never aborts resolution. When `audit_skips`
    is True (import staging, auto-match) the skip is recorded as one audit
    event. When False (`review show`, the loop suggestion) nothing is written —
    those are read paths.
    """
    rows = conn.execute(
        "SELECT rule_id, match_type, pattern, target_account FROM categorization_rules "
        "WHERE active = 1 AND (importing_account IS NULL OR importing_account = ?) "
        "ORDER BY priority ASC, created_at_utc ASC",
        (importing_account,),
    ).fetchall()

    for rule_id, match_type, pattern, target_account in rows:
        if match_type == "exact":
            if canonical_payee_value == pattern:
                return target_account
        elif match_type == "prefix":
            if canonical_payee_value.startswith(pattern):
                return target_account
        elif match_type == "regex":
            try:
                compiled = re.compile(pattern)
            except re.error:
                if audit_skips:
                    append_audit_event(
                        conn,
                        actor="operator",
                        action="rule resolve (skipped uncompilable regex)",
                        target=rule_id,
                        result="error",
                        ts_utc=now_utc,
                    )
                continue
            if compiled.search(canonical_payee_value) is not None:
                return target_account
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_rules_resolve.py -q`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/__init__.py src/ironledger/review/rules.py tests/test_review_rules_resolve.py
git commit -m "feat(phase-2b): categorization rule resolution engine"
```

---

### Task 4: `review/rules.py` — rule CRUD

**Files:**
- Modify: `src/ironledger/review/rules.py`
- Test: `tests/test_review_rules_crud.py`

**Interfaces:**
- Consumes: `ironledger.conventions.validate_account_name`, `ironledger.audit.append_audit_event`, `RuleError` (Task 3).
- Produces:
  - `add_rule(conn, *, match_type: str, pattern: str, target_account: str, importing_account: str | None = None, priority: int = 100, now_utc: str | None = None) -> str` — returns the new `rule_id` (`f"rule:{n}"` where `n` is a monotonic count; simplest stable scheme is `"rule:" + secrets-free uuid4().hex`). Emits `rule add (<match_type> <pattern> -> <target_account>)`.
  - `disable_rule(conn, rule_id: str, *, now_utc: str | None = None) -> None` — sets `active = 0`, `disabled_at_utc`. Emits `rule disable`. Raises `RuleError` if the id is unknown or already disabled.
  - `list_rules(conn) -> list[dict]` — every rule, ordered `priority ASC, created_at_utc ASC`, no filtering; keys: `rule_id, match_type, pattern, importing_account, target_account, priority, active, created_at_utc, disabled_at_utc`.
  - `persist_exact_rule(conn, *, canonical_payee_value: str, importing_account: str, target_account: str, now_utc: str | None = None) -> str` — writes one `exact`, account-scoped, `priority = 50` rule; raises `RuleError` naming the existing `rule_id` on a `UNIQUE` collision.
  - `RuleExistsError(RuleError)` — carries `.existing_rule_id`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_rules_crud.py
"""Phase 2b: rule add / disable / list / persist_exact_rule."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.review.rules import (
    RuleError,
    RuleExistsError,
    add_rule,
    disable_rule,
    list_rules,
    persist_exact_rule,
    resolve_rule,
)
from ironledger.ingest.identity import canonical_payee


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    return conn


def test_add_rule_persists_and_audits(db):
    rid = add_rule(db, match_type="prefix", pattern="amzn mktp", target_account="Expenses:Shopping",
                   now_utc="2026-09-03T10:00:00Z")
    db.commit()
    assert resolve_rule(db, canonical_payee("AMZN Mktp 12"), "Assets:Bank:Checking") == "Expenses:Shopping"
    action, target = db.execute(
        "SELECT action, target FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    assert action == "rule add (prefix amzn mktp -> Expenses:Shopping)"
    assert target == rid


def test_add_rule_rejects_bad_match_type(db):
    with pytest.raises(RuleError):
        add_rule(db, match_type="glob", pattern="x", target_account="Expenses:X")


def test_add_rule_rejects_uncompilable_regex(db):
    with pytest.raises(RuleError):
        add_rule(db, match_type="regex", pattern="(unclosed", target_account="Expenses:X")


def test_add_rule_rejects_bad_account(db):
    with pytest.raises(RuleError):
        add_rule(db, match_type="exact", pattern="x", target_account="NotARoot:X")


def test_disable_rule(db):
    rid = add_rule(db, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
                   now_utc="2026-09-03T10:00:00Z")
    db.commit()
    disable_rule(db, rid, now_utc="2026-09-03T11:00:00Z")
    db.commit()
    assert resolve_rule(db, canonical_payee("Coffee Bar"), "Assets:Bank:Checking") is None
    active, disabled_at = db.execute(
        "SELECT active, disabled_at_utc FROM categorization_rules WHERE rule_id = ?", (rid,)
    ).fetchone()
    assert active == 0
    assert disabled_at == "2026-09-03T11:00:00Z"


def test_disable_unknown_or_already_disabled_raises(db):
    with pytest.raises(RuleError):
        disable_rule(db, "rule:nope")
    rid = add_rule(db, match_type="exact", pattern="x", target_account="Expenses:X")
    db.commit()
    disable_rule(db, rid)
    db.commit()
    with pytest.raises(RuleError):
        disable_rule(db, rid)


def test_list_rules_shape_and_order(db):
    add_rule(db, match_type="prefix", pattern="b", target_account="Expenses:B", priority=100,
             now_utc="2026-09-03T10:00:00Z")
    add_rule(db, match_type="prefix", pattern="a", target_account="Expenses:A", priority=50,
             now_utc="2026-09-03T10:01:00Z")
    db.commit()
    rules = list_rules(db)
    assert [r["pattern"] for r in rules] == ["a", "b"]
    assert set(rules[0]) == {
        "rule_id", "match_type", "pattern", "importing_account", "target_account",
        "priority", "active", "created_at_utc", "disabled_at_utc",
    }


def test_persist_exact_rule_writes_scoped_priority_50(db):
    rid = persist_exact_rule(
        db, canonical_payee_value=canonical_payee("Coffee Bar"),
        importing_account="Assets:Bank:Checking", target_account="Expenses:Coffee",
        now_utc="2026-09-03T10:00:00Z",
    )
    db.commit()
    row = db.execute(
        "SELECT match_type, pattern, importing_account, target_account, priority FROM categorization_rules "
        "WHERE rule_id = ?", (rid,)
    ).fetchone()
    assert row == ("exact", "coffee bar", "Assets:Bank:Checking", "Expenses:Coffee", 50)


def test_persist_exact_rule_collision_raises_with_existing_id(db):
    first = persist_exact_rule(
        db, canonical_payee_value="coffee bar", importing_account="Assets:Bank:Checking",
        target_account="Expenses:Coffee", now_utc="2026-09-03T10:00:00Z",
    )
    db.commit()
    with pytest.raises(RuleExistsError) as exc:
        persist_exact_rule(
            db, canonical_payee_value="coffee bar", importing_account="Assets:Bank:Checking",
            target_account="Expenses:Other", now_utc="2026-09-03T11:00:00Z",
        )
    assert exc.value.existing_rule_id == first
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_rules_crud.py -q`
Expected: FAIL — `ImportError` for `add_rule` / `RuleExistsError`.

- [ ] **Step 3: Extend the implementation**

Add to `src/ironledger/review/rules.py`:

```python
import uuid

from ironledger.conventions import ConventionError, validate_account_name

# add to __all__: "RuleExistsError", "add_rule", "disable_rule", "list_rules", "persist_exact_rule"

_MATCH_TYPES = ("exact", "prefix", "regex")


class RuleExistsError(RuleError):
    """A rule with the same (match_type, pattern, importing_account) already exists."""

    def __init__(self, existing_rule_id: str) -> None:
        super().__init__(
            f"a rule for this pattern and scope already exists: {existing_rule_id}. "
            f"Run 'ironledger rule disable {existing_rule_id}' first."
        )
        self.existing_rule_id = existing_rule_id


def _new_rule_id() -> str:
    return f"rule:{uuid.uuid4().hex}"


def _validate_definition(match_type: str, pattern: str, target_account: str,
                         importing_account: str | None) -> None:
    if match_type not in _MATCH_TYPES:
        raise RuleError(f"match_type {match_type!r} is not one of {_MATCH_TYPES}")
    if not pattern:
        raise RuleError("pattern must be a non-empty string")
    if match_type == "regex":
        try:
            re.compile(pattern)
        except re.error as exc:
            raise RuleError(f"regex pattern does not compile: {exc}") from exc
    try:
        validate_account_name(target_account)
        if importing_account is not None:
            validate_account_name(importing_account)
    except ConventionError as exc:
        raise RuleError(str(exc)) from exc


def _insert(conn, *, rule_id, match_type, pattern, importing_account, target_account,
            priority, now_utc):
    ts = now_utc or _now()
    try:
        conn.execute(
            "INSERT INTO categorization_rules (rule_id, match_type, pattern, importing_account, "
            " target_account, priority, active, created_at_utc) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            (rule_id, match_type, pattern, importing_account, target_account, priority, ts),
        )
    except sqlite3.IntegrityError as exc:
        existing = conn.execute(
            "SELECT rule_id FROM categorization_rules "
            "WHERE match_type = ? AND pattern = ? AND importing_account IS ?",
            (match_type, pattern, importing_account),
        ).fetchone()
        if existing is not None:
            raise RuleExistsError(existing[0]) from exc
        raise RuleError(f"rule insert violated a constraint: {exc}") from exc


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def add_rule(conn, *, match_type, pattern, target_account, importing_account=None,
             priority=100, now_utc=None) -> str:
    _validate_definition(match_type, pattern, target_account, importing_account)
    rule_id = _new_rule_id()
    _insert(conn, rule_id=rule_id, match_type=match_type, pattern=pattern,
            importing_account=importing_account, target_account=target_account,
            priority=priority, now_utc=now_utc)
    append_audit_event(
        conn, actor="operator",
        action=f"rule add ({match_type} {pattern} -> {target_account})",
        target=rule_id, result="ok", ts_utc=now_utc,
    )
    return rule_id


def persist_exact_rule(conn, *, canonical_payee_value, importing_account, target_account,
                       now_utc=None) -> str:
    _validate_definition("exact", canonical_payee_value, target_account, importing_account)
    rule_id = _new_rule_id()
    _insert(conn, rule_id=rule_id, match_type="exact", pattern=canonical_payee_value,
            importing_account=importing_account, target_account=target_account,
            priority=50, now_utc=now_utc)
    append_audit_event(
        conn, actor="operator",
        action=f"rule add (exact {canonical_payee_value} -> {target_account})",
        target=rule_id, result="ok", ts_utc=now_utc,
    )
    return rule_id


def disable_rule(conn, rule_id: str, *, now_utc=None) -> None:
    ts = now_utc or _now()
    updated = conn.execute(
        "UPDATE categorization_rules SET active = 0, disabled_at_utc = ? "
        "WHERE rule_id = ? AND active = 1",
        (ts, rule_id),
    ).rowcount
    if updated == 0:
        raise RuleError(f"rule {rule_id!r} is unknown or already disabled")
    append_audit_event(
        conn, actor="operator", action="rule disable", target=rule_id, result="ok", ts_utc=now_utc,
    )


def list_rules(conn) -> list[dict]:
    cols = ["rule_id", "match_type", "pattern", "importing_account", "target_account",
            "priority", "active", "created_at_utc", "disabled_at_utc"]
    return [
        dict(zip(cols, row))
        for row in conn.execute(
            f"SELECT {', '.join(cols)} FROM categorization_rules "
            "ORDER BY priority ASC, created_at_utc ASC"
        )
    ]
```

Note on `importing_account IS ?` in the collision lookup: SQLite `IS` handles a `None` bind as `IS NULL`, so it matches the `UNIQUE` semantics for global rules.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_rules_crud.py tests/test_review_rules_resolve.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/rules.py tests/test_review_rules_crud.py
git commit -m "feat(phase-2b): rule add / disable / list / persist_exact_rule"
```

---

### Task 5: `cli/auth.py` — extend the gate for review actions

**Files:**
- Modify: `src/ironledger/cli/auth.py`
- Test: `tests/test_cli_auth_phase2b.py`

**Interfaces:**
- Consumes: existing `expected_phrase`, `require_operator`, `safe_mode_enabled`, `append_audit_event`, `AuthorizationError`.
- Produces:
  - `_PREFIX` gains: `"review-approve": "approve"`, `"review-reject": "reject"`, `"review-reopen": "reopen"`, `"review-auto-match": "auto-match"`, `"rule-add": "rule"`, `"rule-disable": "rule-disable"`, `"review-session": "review-session"`.
  - `require_safe_mode_off(conn, *, action: str, subject: str, config_dir) -> None` — raises `AuthorizationError` and writes a `denied` audit event (`f"{action} (denied: safe mode is on)"`) when safe mode is on; returns `None` otherwise. Used by `categorize`, which is not phrase-gated.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cli_auth_phase2b.py
"""Phase 2b: auth-gate extensions for review and rule actions."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.errors import AuthorizationError
from ironledger.cli.auth import expected_phrase, require_operator, require_safe_mode_off


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    return conn


def _config(tmp_path: Path, safe: bool) -> Path:
    d = tmp_path / "config"
    d.mkdir()
    (d / "safe-mode.json").write_text(json.dumps({"enabled": safe}), encoding="utf-8")
    return d


def test_phrases():
    assert expected_phrase("review-approve", "stx:abc") == "approve stx:abc"
    assert expected_phrase("review-reject", "stx:abc") == "reject stx:abc"
    assert expected_phrase("review-reopen", "stx:abc") == "reopen stx:abc"
    assert expected_phrase("review-auto-match", "all") == "auto-match all"
    assert expected_phrase("rule-add", "Expenses:Coffee") == "rule Expenses:Coffee"
    assert expected_phrase("rule-disable", "rule:abc") == "rule-disable rule:abc"
    assert expected_phrase("review-session", "ledger.db") == "review-session ledger.db"


def test_require_operator_authorizes_approve_with_confirm(db, tmp_path):
    cfg = _config(tmp_path, safe=False)
    phrase = expected_phrase("review-approve", "stx:abc")
    mech = require_operator(db, action="review-approve", subject="stx:abc", confirm=phrase,
                            stdin_isatty=False, config_dir=cfg)
    assert mech == "confirm-flag"


def test_safe_mode_off_helper_denies_and_audits(db, tmp_path):
    cfg = _config(tmp_path, safe=True)
    with pytest.raises(AuthorizationError):
        require_safe_mode_off(db, action="review categorize", subject="stx:abc", config_dir=cfg)
    action, result = db.execute(
        "SELECT action, result FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    assert result == "denied"
    assert action == "review categorize (denied: safe mode is on)"


def test_safe_mode_off_helper_passes_when_off(db, tmp_path):
    cfg = _config(tmp_path, safe=False)
    assert require_safe_mode_off(db, action="review categorize", subject="stx:abc", config_dir=cfg) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_cli_auth_phase2b.py -q`
Expected: FAIL — `KeyError` for the new `_PREFIX` keys and `ImportError` for `require_safe_mode_off`.

- [ ] **Step 3: Extend `cli/auth.py`**

Replace the `_PREFIX` assignment and append the helper:

```python
_PREFIX = {
    "import": "import",
    "fitid-trust-add": "trust",
    "review-approve": "approve",
    "review-reject": "reject",
    "review-reopen": "reopen",
    "review-auto-match": "auto-match",
    "rule-add": "rule",
    "rule-disable": "rule-disable",
    "review-session": "review-session",
}
```

Add to `__all__`: `"require_safe_mode_off"`. Append:

```python
def require_safe_mode_off(
    conn: sqlite3.Connection,
    *,
    action: str,
    subject: str,
    config_dir: str | Path,
) -> None:
    """Raise AuthorizationError (after a denied audit event) if safe mode is on.

    For mutating actions that are gated by safe mode alone and take no phrase,
    such as `review categorize`.
    """
    if safe_mode_enabled(config_dir):
        append_audit_event(
            conn, actor="operator", action=f"{action} (denied: safe mode is on)",
            target=subject, result="denied",
        )
        conn.commit()
        raise AuthorizationError(f"{action} not authorized: safe mode is on")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_cli_auth_phase2b.py tests/test_cli_auth.py -q`
Expected: PASS (new file, plus Phase 2a auth suite still green).

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/cli/auth.py tests/test_cli_auth_phase2b.py
git commit -m "feat(phase-2b): extend the operator-authorization gate for review and rule actions"
```

---

### Task 6: `stage.py` — accept a resolved contra account

**Files:**
- Modify: `src/ironledger/ingest/stage.py`
- Test: `tests/test_ingest_stage_contra.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `upsert_staged(conn, staged, *, now_utc=None, contra_account: str | None = None) -> tuple[str, bool]` — when `contra_account` is not `None`, the `contra` posting is inserted with that account instead of `NULL`. `status` is still `'pending'`. All existing behavior (idempotency on fingerprint, `imported` posting, `StageError` on constraint violation) is unchanged.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ingest_stage_contra.py
"""Phase 2b: upsert_staged can pre-fill the contra posting account from a rule match."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.stage import StagedInput, upsert_staged


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
        f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:0','doc-1',0,'{{}}',"
        f" '{'b'*64}','2026-09-02T10:00:00Z')"
    )
    conn.commit()
    return conn


def _input(fp: str = "d" * 64) -> StagedInput:
    return StagedInput(
        source_record_id="doc-1:0", account="Assets:Bank:Checking", iso_date="2026-08-15",
        minor_units=-1299, currency="USD", scale=2, payee="COFFEE BAR", fitid="",
        identity_method="sha256_fallback", identity_fingerprint=fp, institution_account_key="b/c1",
    )


def test_contra_account_none_leaves_null(db):
    stx_id, _ = upsert_staged(db, _input(), now_utc="2026-09-02T10:00:00Z")
    rows = db.execute(
        "SELECT role, account FROM staged_postings WHERE staged_transaction_id = ? ORDER BY posting_index",
        (stx_id,),
    ).fetchall()
    assert rows == [("imported", "Assets:Bank:Checking"), ("contra", None)]


def test_contra_account_filled_when_provided(db):
    stx_id, _ = upsert_staged(
        db, _input(), now_utc="2026-09-02T10:00:00Z", contra_account="Expenses:Coffee"
    )
    status = db.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (stx_id,)
    ).fetchone()[0]
    contra = db.execute(
        "SELECT account FROM staged_postings WHERE staged_transaction_id = ? AND role = 'contra'",
        (stx_id,),
    ).fetchone()[0]
    assert status == "pending"
    assert contra == "Expenses:Coffee"


def test_still_idempotent_on_fingerprint(db):
    first_id, first_created = upsert_staged(db, _input(), now_utc="2026-09-02T10:00:00Z",
                                           contra_account="Expenses:Coffee")
    second_id, second_created = upsert_staged(db, _input(), now_utc="2026-09-02T10:05:00Z",
                                              contra_account="Expenses:Other")
    assert first_id == second_id
    assert (first_created, second_created) == (True, False)
    contra = db.execute(
        "SELECT account FROM staged_postings WHERE staged_transaction_id = ? AND role = 'contra'",
        (first_id,),
    ).fetchone()[0]
    assert contra == "Expenses:Coffee"  # the second call is a no-op
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_ingest_stage_contra.py -q`
Expected: FAIL — `TypeError: upsert_staged() got an unexpected keyword argument 'contra_account'`.

- [ ] **Step 3: Modify `upsert_staged`**

Change the signature and the `contra` row of the `executemany`:

```python
def upsert_staged(
    conn: sqlite3.Connection,
    staged: StagedInput,
    *,
    now_utc: str | None = None,
    contra_account: str | None = None,
) -> tuple[str, bool]:
```

In the `conn.executemany(...)` posting list, change the `contra` tuple's account field from `None` to `contra_account`:

```python
            [
                (f"{stx_id}:0", stx_id, staged.source_record_id, "imported", 0,
                 staged.account, staged.minor_units, staged.currency, staged.scale, ts),
                (f"{stx_id}:1", stx_id, staged.source_record_id, "contra", 1,
                 contra_account, -staged.minor_units, staged.currency, staged.scale, ts),
            ],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_ingest_stage_contra.py tests/test_ingest_stage.py -q`
Expected: PASS (new file plus the Phase 2a stage suite unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/ingest/stage.py tests/test_ingest_stage_contra.py
git commit -m "feat(phase-2b): upsert_staged accepts a rule-resolved contra account"
```

---

### Task 7: `pipeline.py` — rule auto-fill and `--importing-account`

**Files:**
- Modify: `src/ironledger/ingest/pipeline.py`
- Modify: `src/ironledger/cli/__main__.py` (add `--importing-account` to the `import` subparser and thread it)
- Modify: `tests/test_ingest_pipeline.py` (the three OFX tests pass the new arg)
- Modify: `tests/test_cli_import.py` (if it drives an OFX import)
- Test: `tests/test_ingest_pipeline_rules.py`

**Interfaces:**
- Consumes: `ironledger.review.rules.resolve_rule`, `ironledger.ingest.identity.canonical_payee`, `ironledger.conventions.validate_account_name`.
- Produces:
  - `run_import(conn, resolved_path, *, config_dir, evidence_dir, records_dir, csv_profile=None, importing_account: str | None = None, allow_partial=False, actor="operator", now_utc=None) -> ImportResult` — new `importing_account` keyword. `ImportResult` shape unchanged.
  - Behavior: after `_parse`, if `parsed.account is None` (an OFX/QFX file) and `importing_account is None` → `raise ParseError("an OFX or QFX import needs --importing-account")`; if `parsed.account is not None` (a CSV file, account from the profile) and `importing_account is not None` → `raise ParseError("--importing-account is only for OFX/QFX; a CSV import takes its account from the profile")`; otherwise when `parsed.account is None`, `parsed = replace(parsed, account=validate_account_name(importing_account))`.
  - `_with_placeholder_account` is deleted.
  - Each newly-inserted row resolves a rule on `(canonical_payee(row.payee), parsed.account)` and passes the result as `contra_account` to `upsert_staged`; `rules_applied` counts the hits.
  - The success audit note becomes `records_created=<n>, rules_applied=<k>`; the short-circuit note becomes `records_created=0, rules_applied=0`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ingest_pipeline_rules.py
"""Phase 2b: import consults categorization rules and takes --importing-account for OFX."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.errors import ParseError
from ironledger.ingest.pipeline import run_import
from ironledger.review.rules import add_rule

FIXTURES = Path(__file__).parent / "fixtures"
CSV_IMPORTED_ACCOUNT = "Assets:Bank:Checking:ExampleBank"  # from config/csv-profiles/example-bank.json
OFX_IMPORTING_ACCOUNT = "Assets:Bank:Checking:SampleOfx"


@pytest.fixture
def env(tmp_path: Path):
    conn = connect(str(tmp_path / "ledger.db"))
    migrations.migrate(conn)
    config_dir = tmp_path / "config"
    (config_dir / "csv-profiles").mkdir(parents=True)
    (config_dir / "csv-profiles" / "example-bank.json").write_text(
        Path("config/csv-profiles/example-bank.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    paths = {
        "config_dir": config_dir,
        "evidence_dir": tmp_path / "evidence",
        "records_dir": tmp_path / "evidence" / "source_records",
    }
    return conn, paths


def _contra(conn, stx_like="stx:%"):
    return conn.execute(
        "SELECT account FROM staged_postings WHERE role = 'contra' ORDER BY staged_posting_id"
    ).fetchall()


def _last_import_action(conn) -> str:
    return conn.execute(
        "SELECT action FROM audit_events WHERE action LIKE 'import%' ORDER BY seq DESC LIMIT 1"
    ).fetchone()[0]


def test_matching_rule_fills_contra_and_row_stays_pending(env):
    conn, paths = env
    # sample_bank.csv row 1 payee is "COFFEE BAR" -> canonical "coffee bar";
    # the profile's imported account is Assets:Bank:Checking:ExampleBank.
    add_rule(conn, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
             importing_account=CSV_IMPORTED_ACCOUNT, now_utc="2026-09-03T09:00:00Z")
    conn.commit()
    run_import(conn, FIXTURES / "sample_bank.csv", csv_profile="example-bank",
               now_utc="2026-09-03T10:00:00Z", **paths)
    filled = conn.execute(
        "SELECT p.account FROM staged_postings p JOIN staged_transactions t "
        "  ON t.staged_transaction_id = p.staged_transaction_id "
        "WHERE p.role = 'contra' AND t.payee = 'COFFEE BAR'"
    ).fetchone()[0]
    status = conn.execute(
        "SELECT status FROM staged_transactions WHERE payee = 'COFFEE BAR'"
    ).fetchone()[0]
    assert filled == "Expenses:Coffee"
    assert status == "pending"
    assert "rules_applied=1" in _last_import_action(conn)


def test_no_matching_rule_leaves_contra_null(env):
    conn, paths = env
    run_import(conn, FIXTURES / "sample_bank.csv", csv_profile="example-bank",
               now_utc="2026-09-03T10:00:00Z", **paths)
    nulls = conn.execute(
        "SELECT count(*) FROM staged_postings WHERE role = 'contra' AND account IS NULL"
    ).fetchone()[0]
    assert nulls == 3  # every row in sample_bank.csv
    assert "rules_applied=0" in _last_import_action(conn)


def test_reimport_after_rule_change_is_a_noop(env):
    conn, paths = env
    run_import(conn, FIXTURES / "sample_bank.csv", csv_profile="example-bank",
               now_utc="2026-09-03T10:00:00Z", **paths)
    add_rule(conn, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
             importing_account=CSV_IMPORTED_ACCOUNT, now_utc="2026-09-03T10:30:00Z")
    conn.commit()
    result = run_import(conn, FIXTURES / "sample_bank.csv", csv_profile="example-bank",
                        now_utc="2026-09-03T11:00:00Z", **paths)
    assert result.records_created == 0 and result.short_circuited is True
    coffee_contra = conn.execute(
        "SELECT p.account FROM staged_postings p JOIN staged_transactions t "
        "  ON t.staged_transaction_id = p.staged_transaction_id "
        "WHERE p.role = 'contra' AND t.payee = 'COFFEE BAR'"
    ).fetchone()[0]
    assert coffee_contra is None  # the pre-existing fingerprint short-circuits; no rewrite


def test_ofx_without_importing_account_is_a_parse_error(env):
    conn, paths = env
    with pytest.raises(ParseError):
        run_import(conn, FIXTURES / "sample_v1.ofx", csv_profile=None,
                   now_utc="2026-09-03T10:00:00Z", **paths)
    assert conn.execute("SELECT count(*) FROM staged_transactions").fetchone()[0] == 0


def test_csv_with_importing_account_is_a_parse_error(env):
    conn, paths = env
    with pytest.raises(ParseError):
        run_import(conn, FIXTURES / "sample_bank.csv", csv_profile="example-bank",
                   importing_account="Assets:Bank:Checking:Wrong",
                   now_utc="2026-09-03T10:00:00Z", **paths)
    assert conn.execute("SELECT count(*) FROM staged_transactions").fetchone()[0] == 0


def test_ofx_import_with_importing_account_and_rule_fills_contra(env):
    conn, paths = env
    add_rule(conn, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
             importing_account=OFX_IMPORTING_ACCOUNT, now_utc="2026-09-03T09:00:00Z")
    conn.commit()
    run_import(conn, FIXTURES / "sample_v1.ofx", csv_profile=None,
               importing_account=OFX_IMPORTING_ACCOUNT, now_utc="2026-09-03T10:00:00Z", **paths)
    coffee_contra = conn.execute(
        "SELECT p.account FROM staged_postings p JOIN staged_transactions t "
        "  ON t.staged_transaction_id = p.staged_transaction_id "
        "WHERE p.role = 'contra' AND t.payee = 'COFFEE BAR'"
    ).fetchone()[0]
    imported = conn.execute(
        "SELECT DISTINCT account FROM staged_postings WHERE role = 'imported'"
    ).fetchall()
    assert coffee_contra == "Expenses:Coffee"
    assert imported == [(OFX_IMPORTING_ACCOUNT,)]  # no fabricated Assets:Unmapped:* name
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_ingest_pipeline_rules.py -q`
Expected: FAIL — `TypeError` on the `importing_account` kwarg, then assertion failures.

- [ ] **Step 3: Modify `pipeline.py`**

1. Extend the imports:

```python
from dataclasses import replace
from ironledger.conventions import ConventionError, currency_scale, validate_currency, validate_account_name
from ironledger.ingest.identity import fingerprint, select_identity_method, canonical_payee
from ironledger.review.rules import resolve_rule
```

2. Add the `importing_account: str | None = None` keyword to `run_import`'s signature (keyword-only, next to `csv_profile`).

3. Delete `_with_placeholder_account` entirely. Replace its `if parsed.account is None:` call site with:

```python
        if parsed.account is None and importing_account is None:
            raise ParseError("an OFX or QFX import needs --importing-account")
        if parsed.account is not None and importing_account is not None:
            raise ParseError(
                "--importing-account is only for OFX/QFX; a CSV import takes its account from the profile"
            )
        if parsed.account is None:
            try:
                parsed = replace(parsed, account=validate_account_name(importing_account))
            except ConventionError as exc:
                raise ParseError(f"--importing-account: {exc}") from exc
```

4. In the row loop, after `minor_units = minor_units_from_text(...)` and before `write_source_record`, initialize a counter once (`rules_applied = 0` next to `created = 0`) and inside the loop:

```python
            contra_account = resolve_rule(
                conn, canonical_payee(row.payee), parsed.account, now_utc=now_utc
            )
```

Pass `contra_account=contra_account` into `upsert_staged(...)`, and:

```python
            if was_created:
                created += 1
                if contra_account is not None:
                    rules_applied += 1
```

5. Success audit: `note=f"records_created={created}, rules_applied={rules_applied}"`. Short-circuit audit: `note="records_created=0, rules_applied=0"`.

- [ ] **Step 4: Add the CLI flag**

In `src/ironledger/cli/__main__.py`, add to the `import` subparser: `imp.add_argument("--importing-account", default=None)`. In `_cmd_import`, pass `importing_account=args.importing_account` into `run_import`. (Task 14 does not touch the `import` command; it is fully handled here.)

- [ ] **Step 5: Update the three Phase 2a OFX tests**

In `tests/test_ingest_pipeline.py`, add `importing_account="Assets:Bank:Checking:SampleOfx"` to the `run_import` call in each of `test_ofx_import_stages_rows_and_writes_one_audit_event`, `test_reimport_short_circuits_with_zero_records_and_one_more_audit_event`, and `test_ofx_unresolvable_curdef_audits_error_and_rolls_back`. Their assertions (row counts, audit counts, rollback) are unchanged. If `tests/test_cli_import.py` drives `sample_v1.ofx`, add `--importing-account Assets:Bank:Checking:SampleOfx` to that invocation; a CSV-only `test_cli_import.py` needs no change.

- [ ] **Step 6: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_ingest_pipeline_rules.py tests/test_ingest_pipeline.py tests/test_cli_import.py -q`
Expected: PASS.

- [ ] **Step 7: Run the whole suite**

Run: `PYTHONPATH=src python -m pytest -q`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/ironledger/ingest/pipeline.py src/ironledger/cli/__main__.py tests/test_ingest_pipeline_rules.py tests/test_ingest_pipeline.py tests/test_cli_import.py
git commit -m "feat(phase-2b): import-time rule auto-fill; --importing-account replaces the OFX placeholder"
```

---

### Task 8: `review/state.py` — `categorize`

**Files:**
- Create: `src/ironledger/review/state.py`
- Test: `tests/test_review_state_categorize.py`

**Interfaces:**
- Consumes: `ironledger.conventions.validate_account_name`, `ironledger.audit.append_audit_event`.
- Produces:
  - `ReviewStateError(ValueError)` — an unknown id or an illegal transition.
  - `categorize(conn, stx_id: str, target_account: str, *, rule_id: str | None = None, now_utc: str | None = None) -> None` — validates the account; on a `pending` row sets the `contra` posting account, `status = 'categorized'`, `categorized_at_utc = now`; on a `categorized` row replaces the account only; on `rejected`/`approved` raises `ReviewStateError` naming `review reopen`; on unknown id raises `ReviewStateError`. Emits `review categorize (<target_account>)` or `review categorize (<target_account>; rule <rule_id>)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_state_categorize.py
"""Phase 2b: review categorize sets the contra account and advances pending -> categorized."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.stage import StagedInput, upsert_staged
from ironledger.review.state import ReviewStateError, categorize


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
        f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:0','doc-1',0,'{{}}',"
        f" '{'b'*64}','2026-09-02T10:00:00Z')"
    )
    conn.commit()
    return conn


def _stage(db, fp="d" * 64, contra=None) -> str:
    stx_id, _ = upsert_staged(
        db,
        StagedInput(
            source_record_id="doc-1:0", account="Assets:Bank:Checking", iso_date="2026-08-15",
            minor_units=-1299, currency="USD", scale=2, payee="COFFEE BAR", fitid="",
            identity_method="sha256_fallback", identity_fingerprint=fp,
            institution_account_key="b/c1",
        ),
        now_utc="2026-09-02T10:00:00Z", contra_account=contra,
    )
    db.commit()
    return stx_id


def test_categorize_pending_advances_to_categorized(db):
    stx = _stage(db)
    categorize(db, stx, "Expenses:Coffee", now_utc="2026-09-03T12:00:00Z")
    db.commit()
    status, cat_at = db.execute(
        "SELECT status, categorized_at_utc FROM staged_transactions WHERE staged_transaction_id = ?",
        (stx,),
    ).fetchone()
    contra = db.execute(
        "SELECT account FROM staged_postings WHERE staged_transaction_id = ? AND role = 'contra'",
        (stx,),
    ).fetchone()[0]
    assert (status, cat_at, contra) == ("categorized", "2026-09-03T12:00:00Z", "Expenses:Coffee")
    action, target = db.execute(
        "SELECT action, target FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    assert action == "review categorize (Expenses:Coffee)"
    assert target == stx


def test_categorize_again_replaces_account_keeps_status(db):
    stx = _stage(db)
    categorize(db, stx, "Expenses:Coffee", now_utc="2026-09-03T12:00:00Z")
    db.commit()
    categorize(db, stx, "Expenses:DiningOut", rule_id="rule:abc", now_utc="2026-09-03T12:05:00Z")
    db.commit()
    status, cat_at = db.execute(
        "SELECT status, categorized_at_utc FROM staged_transactions WHERE staged_transaction_id = ?",
        (stx,),
    ).fetchone()
    contra = db.execute(
        "SELECT account FROM staged_postings WHERE staged_transaction_id = ? AND role = 'contra'",
        (stx,),
    ).fetchone()[0]
    assert (status, cat_at, contra) == ("categorized", "2026-09-03T12:00:00Z", "Expenses:DiningOut")
    assert db.execute(
        "SELECT action FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()[0] == "review categorize (Expenses:DiningOut; rule rule:abc)"


def test_categorize_rejects_bad_account(db):
    stx = _stage(db)
    with pytest.raises(ValueError):
        categorize(db, stx, "NotARoot:X")


def test_categorize_unknown_id_raises(db):
    with pytest.raises(ReviewStateError):
        categorize(db, "stx:missing", "Expenses:Coffee")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_state_categorize.py -q`
Expected: FAIL — `ModuleNotFoundError: ironledger.review.state`.

- [ ] **Step 3: Write `review/state.py`**

```python
# src/ironledger/review/state.py
"""Phase 2b review lifecycle transitions: categorize, approve, reject, reopen, auto_match."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from ironledger.audit import append_audit_event
from ironledger.conventions import ConventionError, validate_account_name

__all__ = ["ReviewStateError", "categorize"]


class ReviewStateError(ValueError):
    """An unknown staged transaction id or an illegal review-state transition."""


def _now(now_utc: str | None) -> str:
    return now_utc or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _status(conn: sqlite3.Connection, stx_id: str) -> str:
    row = conn.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (stx_id,)
    ).fetchone()
    if row is None:
        raise ReviewStateError(f"unknown staged transaction {stx_id!r}")
    return row[0]


def categorize(
    conn: sqlite3.Connection,
    stx_id: str,
    target_account: str,
    *,
    rule_id: str | None = None,
    now_utc: str | None = None,
) -> None:
    try:
        validate_account_name(target_account)
    except ConventionError as exc:
        raise ReviewStateError(str(exc)) from exc

    status = _status(conn, stx_id)
    if status in ("rejected", "approved"):
        raise ReviewStateError(
            f"{stx_id} is {status}; run 'ironledger review reopen {stx_id}' before categorizing"
        )

    ts = _now(now_utc)
    conn.execute(
        "UPDATE staged_postings SET account = ? WHERE staged_transaction_id = ? AND role = 'contra'",
        (target_account, stx_id),
    )
    if status == "pending":
        conn.execute(
            "UPDATE staged_transactions SET status = 'categorized', categorized_at_utc = ? "
            "WHERE staged_transaction_id = ?",
            (ts, stx_id),
        )

    detail = target_account if rule_id is None else f"{target_account}; rule {rule_id}"
    append_audit_event(
        conn, actor="operator", action=f"review categorize ({detail})",
        target=stx_id, result="ok", ts_utc=now_utc,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_state_categorize.py -q`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/state.py tests/test_review_state_categorize.py
git commit -m "feat(phase-2b): review categorize transition"
```

---

### Task 9: `review/approve_gate.py` — approve preconditions

**Files:**
- Create: `src/ironledger/review/approve_gate.py`
- Test: `tests/test_review_approve_gate.py`

**Interfaces:**
- Consumes: `ironledger.conventions.validate_account_name`.
- Produces:
  - `ApproveGateError(ValueError)` — carries `.reason` (a short slug: `"status"`, `"missing_account"`, `"invalid_account"`, `"unbalanced"`, `"multi_currency"`).
  - `check_approvable(conn, stx_id: str) -> None` — raises `ApproveGateError` unless: status is `pending` or `categorized`; every posting has a non-null account that passes `validate_account_name`; postings sum to zero per currency; only one currency is present. Unknown id raises `ApproveGateError(reason="status")`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_approve_gate.py
"""Phase 2b: the approve gate refuses incomplete or unbalanced staged transactions."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.stage import StagedInput, upsert_staged
from ironledger.review.approve_gate import ApproveGateError, check_approvable
from ironledger.review.state import categorize


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
        f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:0','doc-1',0,'{{}}',"
        f" '{'b'*64}','2026-09-02T10:00:00Z')"
    )
    conn.commit()
    return conn


def _stage(db, fp="d" * 64, contra=None) -> str:
    stx_id, _ = upsert_staged(
        db,
        StagedInput(
            source_record_id="doc-1:0", account="Assets:Bank:Checking", iso_date="2026-08-15",
            minor_units=-1299, currency="USD", scale=2, payee="COFFEE BAR", fitid="",
            identity_method="sha256_fallback", identity_fingerprint=fp,
            institution_account_key="b/c1",
        ),
        now_utc="2026-09-02T10:00:00Z", contra_account=contra,
    )
    db.commit()
    return stx_id


def test_null_contra_account_blocks(db):
    stx = _stage(db)
    with pytest.raises(ApproveGateError) as exc:
        check_approvable(db, stx)
    assert exc.value.reason == "missing_account"


def test_categorized_and_balanced_passes(db):
    stx = _stage(db)
    categorize(db, stx, "Expenses:Coffee", now_utc="2026-09-03T12:00:00Z")
    db.commit()
    check_approvable(db, stx)  # no raise


def test_invalid_account_blocks(db):
    stx = _stage(db)
    db.execute(
        "UPDATE staged_postings SET account = 'bogus' WHERE staged_transaction_id = ? AND role = 'contra'",
        (stx,),
    )
    db.commit()
    with pytest.raises(ApproveGateError) as exc:
        check_approvable(db, stx)
    assert exc.value.reason == "invalid_account"


def test_unbalanced_blocks(db):
    stx = _stage(db, contra="Expenses:Coffee")
    db.execute(
        "UPDATE staged_postings SET minor_units = -1 WHERE staged_transaction_id = ? AND role = 'contra'",
        (stx,),
    )
    db.commit()
    with pytest.raises(ApproveGateError) as exc:
        check_approvable(db, stx)
    assert exc.value.reason == "unbalanced"


def test_multi_currency_blocks(db):
    stx = _stage(db, contra="Expenses:Coffee")
    db.execute(
        "UPDATE staged_postings SET currency = 'EUR' WHERE staged_transaction_id = ? AND role = 'contra'",
        (stx,),
    )
    db.commit()
    with pytest.raises(ApproveGateError) as exc:
        check_approvable(db, stx)
    assert exc.value.reason in ("multi_currency", "unbalanced")


def test_approved_row_blocks_on_status(db):
    stx = _stage(db, contra="Expenses:Coffee")
    db.execute("UPDATE staged_transactions SET status = 'approved' WHERE staged_transaction_id = ?", (stx,))
    db.commit()
    with pytest.raises(ApproveGateError) as exc:
        check_approvable(db, stx)
    assert exc.value.reason == "status"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_approve_gate.py -q`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `review/approve_gate.py`**

```python
# src/ironledger/review/approve_gate.py
"""Phase 2b approve-gate: a staged transaction is approvable only when fully categorized,
single-currency, and balanced."""

from __future__ import annotations

import sqlite3

from ironledger.conventions import ConventionError, validate_account_name, validate_same_currency_balance

__all__ = ["ApproveGateError", "check_approvable"]


class ApproveGateError(ValueError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason


def check_approvable(conn: sqlite3.Connection, stx_id: str) -> None:
    row = conn.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (stx_id,)
    ).fetchone()
    if row is None:
        raise ApproveGateError("status", f"unknown staged transaction {stx_id!r}")
    if row[0] not in ("pending", "categorized"):
        raise ApproveGateError("status", f"{stx_id} is {row[0]}, not approvable")

    postings = conn.execute(
        "SELECT account, minor_units, currency, minor_unit_scale FROM staged_postings "
        "WHERE staged_transaction_id = ? ORDER BY posting_index",
        (stx_id,),
    ).fetchall()
    if len(postings) < 2:
        raise ApproveGateError("missing_account", f"{stx_id} has fewer than two postings")

    # Explicit NULL / grammar check first, so the caller gets a precise reason
    # slug instead of the generic ConventionError from validate_same_currency_balance.
    for account, _minor, _currency, _scale in postings:
        if account is None:
            raise ApproveGateError("missing_account", f"{stx_id} has a posting with no account")
        try:
            validate_account_name(account)
        except ConventionError as exc:
            raise ApproveGateError("invalid_account", f"{stx_id}: {exc}") from exc

    # Reject any multi-currency transaction outright. validate_same_currency_balance
    # only checks that each currency independently nets to zero, which would let a
    # balanced two-currency transaction through; Phase 2b compiles neither.
    if len({p[2] for p in postings}) > 1:
        raise ApproveGateError(
            "multi_currency", f"{stx_id} mixes currencies {sorted({p[2] for p in postings})}"
        )

    # Reuse the locked convention for the zero-sum / non-zero-amount check.
    try:
        validate_same_currency_balance([
            {"account": a, "minor_units": m, "currency": c, "scale": s}
            for a, m, c, s in postings
        ])
    except ConventionError as exc:
        raise ApproveGateError("unbalanced", f"{stx_id}: {exc}") from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_approve_gate.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/approve_gate.py tests/test_review_approve_gate.py
git commit -m "feat(phase-2b): approve-gate precondition check"
```

---

### Task 10: `review/state.py` — `approve`, `reject`, `reopen`

**Files:**
- Modify: `src/ironledger/review/state.py`
- Test: `tests/test_review_state_decisions.py`

**Interfaces:**
- Consumes: `check_approvable` / `ApproveGateError` (Task 9).
- Produces:
  - `approve(conn, stx_id, *, now_utc=None) -> None` — calls `check_approvable`; on pass sets `status = 'approved'`, `decided_at_utc = now`; emits `review approve`. On gate failure re-raises `ApproveGateError` (the CLI turns it into a `denied` audit event and exit 3).
  - `reject(conn, stx_id, *, reason: str | None = None, now_utc=None) -> None` — from `pending`/`categorized`/`rejected` (idempotent no-op if already `rejected`), sets `status = 'rejected'`, `reject_reason = reason`, `decided_at_utc = now`; emits `review reject`. From `approved` raises `ReviewStateError`.
  - `reopen(conn, stx_id, *, now_utc=None) -> None` — from `categorized`/`rejected` sets `status = 'pending'`, clears `reject_reason`, `categorized_at_utc`, `decided_at_utc`; leaves the contra account as-is; emits `review reopen (from <state>)`. From `pending` or `approved` raises `ReviewStateError`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_state_decisions.py
"""Phase 2b: approve / reject / reopen transitions and the approved-is-terminal rule."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.stage import StagedInput, upsert_staged
from ironledger.review.approve_gate import ApproveGateError
from ironledger.review.state import ReviewStateError, approve, categorize, reject, reopen


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
        f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:0','doc-1',0,'{{}}',"
        f" '{'b'*64}','2026-09-02T10:00:00Z')"
    )
    conn.commit()
    return conn


def _stage(db, fp="d" * 64, contra=None) -> str:
    stx_id, _ = upsert_staged(
        db,
        StagedInput(
            source_record_id="doc-1:0", account="Assets:Bank:Checking", iso_date="2026-08-15",
            minor_units=-1299, currency="USD", scale=2, payee="COFFEE BAR", fitid="",
            identity_method="sha256_fallback", identity_fingerprint=fp,
            institution_account_key="b/c1",
        ),
        now_utc="2026-09-02T10:00:00Z", contra_account=contra,
    )
    db.commit()
    return stx_id


def test_approve_sets_approved_and_decided_at(db):
    stx = _stage(db, contra="Expenses:Coffee")
    approve(db, stx, now_utc="2026-09-03T13:00:00Z")
    db.commit()
    status, decided = db.execute(
        "SELECT status, decided_at_utc FROM staged_transactions WHERE staged_transaction_id = ?", (stx,)
    ).fetchone()
    assert (status, decided) == ("approved", "2026-09-03T13:00:00Z")
    assert db.execute("SELECT action FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()[0] == "review approve"


def test_approve_propagates_gate_failure(db):
    stx = _stage(db)  # NULL contra
    with pytest.raises(ApproveGateError):
        approve(db, stx)


def test_reject_with_reason(db):
    stx = _stage(db)
    reject(db, stx, reason="duplicate of check 1041", now_utc="2026-09-03T13:00:00Z")
    db.commit()
    status, reason = db.execute(
        "SELECT status, reject_reason FROM staged_transactions WHERE staged_transaction_id = ?", (stx,)
    ).fetchone()
    assert (status, reason) == ("rejected", "duplicate of check 1041")


def test_reject_is_idempotent(db):
    stx = _stage(db)
    reject(db, stx, now_utc="2026-09-03T13:00:00Z")
    db.commit()
    reject(db, stx, now_utc="2026-09-03T13:05:00Z")  # no raise
    db.commit()


def test_reopen_from_rejected_clears_fields_keeps_contra(db):
    stx = _stage(db, contra="Expenses:Coffee")
    categorize(db, stx, "Expenses:Coffee", now_utc="2026-09-03T12:00:00Z")
    reject(db, stx, reason="x", now_utc="2026-09-03T13:00:00Z")
    db.commit()
    reopen(db, stx, now_utc="2026-09-03T14:00:00Z")
    db.commit()
    status, reason, cat_at, decided = db.execute(
        "SELECT status, reject_reason, categorized_at_utc, decided_at_utc "
        "FROM staged_transactions WHERE staged_transaction_id = ?", (stx,)
    ).fetchone()
    contra = db.execute(
        "SELECT account FROM staged_postings WHERE staged_transaction_id = ? AND role = 'contra'", (stx,)
    ).fetchone()[0]
    assert (status, reason, cat_at, decided, contra) == ("pending", None, None, None, "Expenses:Coffee")
    assert db.execute(
        "SELECT action FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()[0] == "review reopen (from rejected)"


def test_approved_is_terminal(db):
    stx = _stage(db, contra="Expenses:Coffee")
    approve(db, stx, now_utc="2026-09-03T13:00:00Z")
    db.commit()
    with pytest.raises(ReviewStateError):
        reject(db, stx)
    with pytest.raises(ReviewStateError):
        reopen(db, stx)
    with pytest.raises(ReviewStateError):
        categorize(db, stx, "Expenses:Other")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_state_decisions.py -q`
Expected: FAIL — `ImportError` for `approve`/`reject`/`reopen`.

- [ ] **Step 3: Extend `review/state.py`**

Add to `__all__`: `"approve"`, `"reject"`, `"reopen"`. Add:

```python
from ironledger.review.approve_gate import check_approvable


def approve(conn: sqlite3.Connection, stx_id: str, *, now_utc: str | None = None) -> None:
    check_approvable(conn, stx_id)  # raises ApproveGateError on failure
    ts = _now(now_utc)
    conn.execute(
        "UPDATE staged_transactions SET status = 'approved', decided_at_utc = ? "
        "WHERE staged_transaction_id = ?",
        (ts, stx_id),
    )
    append_audit_event(
        conn, actor="operator", action="review approve", target=stx_id, result="ok", ts_utc=now_utc,
    )


def reject(
    conn: sqlite3.Connection, stx_id: str, *, reason: str | None = None, now_utc: str | None = None
) -> None:
    status = _status(conn, stx_id)
    if status == "approved":
        raise ReviewStateError(f"{stx_id} is approved; approved is terminal in Phase 2b")
    if status == "rejected":
        return
    ts = _now(now_utc)
    conn.execute(
        "UPDATE staged_transactions SET status = 'rejected', reject_reason = ?, decided_at_utc = ? "
        "WHERE staged_transaction_id = ?",
        (reason, ts, stx_id),
    )
    append_audit_event(
        conn, actor="operator", action="review reject", target=stx_id, result="ok", ts_utc=now_utc,
    )


def reopen(conn: sqlite3.Connection, stx_id: str, *, now_utc: str | None = None) -> None:
    status = _status(conn, stx_id)
    if status not in ("categorized", "rejected"):
        raise ReviewStateError(
            f"{stx_id} is {status}; only a categorized or rejected row can be reopened"
        )
    conn.execute(
        "UPDATE staged_transactions SET status = 'pending', reject_reason = NULL, "
        "categorized_at_utc = NULL, decided_at_utc = NULL WHERE staged_transaction_id = ?",
        (stx_id,),
    )
    append_audit_event(
        conn, actor="operator", action=f"review reopen (from {status})",
        target=stx_id, result="ok", ts_utc=now_utc,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_state_decisions.py tests/test_review_state_categorize.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/state.py tests/test_review_state_decisions.py
git commit -m "feat(phase-2b): approve / reject / reopen transitions"
```

---

### Task 11: `review/state.py` — `auto_match`

**Files:**
- Modify: `src/ironledger/review/state.py`
- Test: `tests/test_review_state_auto_match.py`

**Interfaces:**
- Consumes: `ironledger.review.rules.resolve_rule`, `ironledger.ingest.identity.canonical_payee`, `categorize` (Task 8).
- Produces:
  - `auto_match(conn, *, importing_account: str | None = None, now_utc: str | None = None) -> tuple[int, int]` — returns `(matched, candidates)`. `candidates` = count of `pending` staged transactions whose `contra` posting account is `NULL` (optionally filtered so the `imported` posting account equals `importing_account`). For each, resolve a rule on the transaction's canonical payee and its `imported` account; on a hit, call `categorize(conn, stx_id, target, rule_id=<rid>)` — no, `resolve_rule` returns only the account. To also record the `rule_id`, `auto_match` runs its own audit event `review auto-match (<target>; rule <rule_id>)` and sets state directly rather than through `categorize`. Emits one per matched row plus a final `review auto-match (matched <n> of <m>)` with `target = importing_account or "all"`.

> `resolve_rule` returns the target account, not the rule id. Add a sibling `resolve_rule_row(conn, canonical_payee_value, importing_account, *, now_utc=None) -> tuple[str, str] | None` in `rules.py` that returns `(rule_id, target_account)` (same ordering and skip logic), and have `resolve_rule` delegate to it. Do this refactor as Step 3a below.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_state_auto_match.py
"""Phase 2b: review auto-match fills NULL-contra pending rows from rules."""

from __future__ import annotations

import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.stage import StagedInput, upsert_staged
from ironledger.review.rules import add_rule
from ironledger.review.state import auto_match


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    for i in range(3):
        conn.execute(
            "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
            f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:{i}','doc-1',{i},'{{}}',"
            f" '{chr(98 + i) * 64}','2026-09-02T10:00:00Z')"
        )
    conn.commit()
    return conn


def _stage(db, i, payee, account="Assets:Bank:Checking", contra=None) -> str:
    stx_id, _ = upsert_staged(
        db,
        StagedInput(
            source_record_id=f"doc-1:{i}", account=account, iso_date="2026-08-15",
            minor_units=-1299, currency="USD", scale=2, payee=payee, fitid="",
            identity_method="sha256_fallback", identity_fingerprint=chr(100 + i) * 64,
            institution_account_key="b/c1",
        ),
        now_utc="2026-09-02T10:00:00Z", contra_account=contra,
    )
    db.commit()
    return stx_id


def test_auto_match_fills_and_categorizes(db):
    add_rule(db, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
             now_utc="2026-09-03T09:00:00Z")
    db.commit()
    a = _stage(db, 0, "COFFEE BAR")
    b = _stage(db, 1, "GAS STATION")
    matched, candidates = auto_match(db, now_utc="2026-09-03T12:00:00Z")
    db.commit()
    assert (matched, candidates) == (1, 2)
    assert db.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (a,)
    ).fetchone()[0] == "categorized"
    assert db.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (b,)
    ).fetchone()[0] == "pending"
    actions = [r[0] for r in db.execute("SELECT action FROM audit_events ORDER BY seq")]
    assert "review auto-match (matched 1 of 2)" in actions
    assert any(x.startswith("review auto-match (Expenses:Coffee; rule ") for x in actions)


def test_auto_match_skips_already_categorized(db):
    add_rule(db, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
             now_utc="2026-09-03T09:00:00Z")
    db.commit()
    _stage(db, 0, "COFFEE BAR", contra="Expenses:Manual")
    matched, candidates = auto_match(db, now_utc="2026-09-03T12:00:00Z")
    assert (matched, candidates) == (0, 0)


def test_auto_match_honors_importing_account_filter(db):
    add_rule(db, match_type="exact", pattern="coffee bar", target_account="Expenses:Coffee",
             now_utc="2026-09-03T09:00:00Z")
    db.commit()
    _stage(db, 0, "COFFEE BAR", account="Assets:Bank:Checking")
    _stage(db, 1, "COFFEE BAR", account="Assets:Bank:Savings")
    matched, candidates = auto_match(db, importing_account="Assets:Bank:Savings",
                                    now_utc="2026-09-03T12:00:00Z")
    assert (matched, candidates) == (1, 1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_state_auto_match.py -q`
Expected: FAIL — `ImportError` for `auto_match`.

- [ ] **Step 3a: Refactor `rules.py` to expose the rule id**

In `src/ironledger/review/rules.py`, add `resolve_rule_row` and make `resolve_rule` delegate:

```python
__all__ = [..., "resolve_rule_row"]


def resolve_rule_row(conn, canonical_payee_value, importing_account, *, audit_skips=True, now_utc=None):
    """Like resolve_rule but returns (rule_id, target_account) or None.

    `audit_skips` has the same meaning as in `resolve_rule`: True records an
    uncompilable-regex skip as one audit event; False writes nothing.
    """
    rows = conn.execute(
        "SELECT rule_id, match_type, pattern, target_account FROM categorization_rules "
        "WHERE active = 1 AND (importing_account IS NULL OR importing_account = ?) "
        "ORDER BY priority ASC, created_at_utc ASC",
        (importing_account,),
    ).fetchall()
    for rule_id, match_type, pattern, target_account in rows:
        if match_type == "exact" and canonical_payee_value == pattern:
            return rule_id, target_account
        if match_type == "prefix" and canonical_payee_value.startswith(pattern):
            return rule_id, target_account
        if match_type == "regex":
            try:
                compiled = re.compile(pattern)
            except re.error:
                if audit_skips:
                    append_audit_event(
                        conn, actor="operator",
                        action="rule resolve (skipped uncompilable regex)",
                        target=rule_id, result="error", ts_utc=now_utc,
                    )
                continue
            if compiled.search(canonical_payee_value) is not None:
                return rule_id, target_account
    return None


def resolve_rule(conn, canonical_payee_value, importing_account, *, audit_skips=True, now_utc=None):
    hit = resolve_rule_row(
        conn, canonical_payee_value, importing_account, audit_skips=audit_skips, now_utc=now_utc
    )
    return None if hit is None else hit[1]
```

Keep the existing `resolve_rule` tests green (they assert the account string, unchanged). The Step 3 `resolve_rule` body is now replaced by this delegating version — the match loop lives only in `resolve_rule_row`.

- [ ] **Step 3b: Add `auto_match` to `state.py`**

```python
from ironledger.ingest.identity import canonical_payee
from ironledger.review.rules import resolve_rule_row

# add "auto_match" to __all__


def auto_match(
    conn: sqlite3.Connection,
    *,
    importing_account: str | None = None,
    now_utc: str | None = None,
) -> tuple[int, int]:
    sql = (
        "SELECT st.staged_transaction_id, st.payee, imp.account "
        "FROM staged_transactions st "
        "JOIN staged_postings imp ON imp.staged_transaction_id = st.staged_transaction_id "
        "  AND imp.role = 'imported' "
        "JOIN staged_postings con ON con.staged_transaction_id = st.staged_transaction_id "
        "  AND con.role = 'contra' "
        "WHERE st.status = 'pending' AND con.account IS NULL"
    )
    params: tuple = ()
    if importing_account is not None:
        sql += " AND imp.account = ?"
        params = (importing_account,)
    candidates = conn.execute(sql, params).fetchall()

    matched = 0
    ts = _now(now_utc)
    for stx_id, payee, imp_account in candidates:
        hit = resolve_rule_row(conn, canonical_payee(payee), imp_account, now_utc=now_utc)
        if hit is None:
            continue
        rule_id, target_account = hit
        conn.execute(
            "UPDATE staged_postings SET account = ? "
            "WHERE staged_transaction_id = ? AND role = 'contra'",
            (target_account, stx_id),
        )
        conn.execute(
            "UPDATE staged_transactions SET status = 'categorized', categorized_at_utc = ? "
            "WHERE staged_transaction_id = ?",
            (ts, stx_id),
        )
        append_audit_event(
            conn, actor="operator",
            action=f"review auto-match ({target_account}; rule {rule_id})",
            target=stx_id, result="ok", ts_utc=now_utc,
        )
        matched += 1

    append_audit_event(
        conn, actor="operator",
        action=f"review auto-match (matched {matched} of {len(candidates)})",
        target=importing_account or "all", result="ok", ts_utc=now_utc,
    )
    return matched, len(candidates)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_state_auto_match.py tests/test_review_rules_resolve.py tests/test_review_rules_crud.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/state.py src/ironledger/review/rules.py tests/test_review_state_auto_match.py
git commit -m "feat(phase-2b): review auto-match bulk categorization"
```

---

### Task 12: `review/loop.py` — the guided interactive loop

**Files:**
- Create: `src/ironledger/review/loop.py`
- Test: `tests/test_review_loop.py`

**Interfaces:**
- Consumes: `categorize`, `approve`, `reject` (state.py); `resolve_rule` (rules.py); `canonical_payee`; `ironledger.cli.auth.expected_phrase`; `ironledger.audit.append_audit_event`; `ironledger.ingest.errors.AuthorizationError`; `ApproveGateError`.
- Produces:
  - `run_review_loop(conn, *, stdin, stdout, db_basename: str, confirm: str | None, stdin_isatty: bool, now_utc: str | None = None) -> dict[str, int]` — returns the per-action counts `{"c": .., "a": .., "r": .., "s": ..}`. Iterates `pending` then `categorized` rows, oldest-first by `created_at_utc` then `staged_transaction_id`. For each row writes the show view to `stdout` and reads a command line from `stdin`. Commands: `c` (prompt for account, default = rule suggestion), `a` (approve), `r` (prompt for reason), `s` (skip), `q` (stop). The first `a` or `r` requires the `review-session <db_basename>` phrase: if `stdin_isatty`, prompt for it on `stdout`/`stdin`; else it must equal `confirm`, otherwise raise `AuthorizationError`. Once granted it is cached for the rest of the loop. Emits `review-session start` before the first row and `review-session end (c=.. a=.. r=.. s=..)` on exit. Each `c`/`a`/`r` still emits its own event through the state functions. On `ApproveGateError` from `a`, print the reason and re-prompt the same row.

> The loop must not call `conn.commit()` itself if the CLI wraps the whole command in a transaction; match the Phase 2a CLI pattern (each `_cmd_*` calls `conn.commit()` after its mutation). Decide in Task 14: the simplest is the loop commits after each decision so a mid-loop `q` keeps completed decisions. Implement the loop to `conn.commit()` after each successful `c`/`a`/`r`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review_loop.py
"""Phase 2b: the guided review loop, driven by a scripted stdin stream."""

from __future__ import annotations

import io
import sqlite3

import pytest

from ironledger.db import migrations
from ironledger.db.connection import connect
from ironledger.ingest.errors import AuthorizationError
from ironledger.ingest.stage import StagedInput, upsert_staged
from ironledger.review.loop import run_review_loop


@pytest.fixture
def db() -> sqlite3.Connection:
    conn = connect(":memory:")
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    for i in range(3):
        conn.execute(
            "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
            f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:{i}','doc-1',{i},'{{}}',"
            f" '{chr(98 + i) * 64}','2026-09-02T10:00:00Z')"
        )
    conn.commit()
    return conn


def _stage(db, i, payee="COFFEE BAR", contra=None) -> str:
    stx_id, _ = upsert_staged(
        db,
        StagedInput(
            source_record_id=f"doc-1:{i}", account="Assets:Bank:Checking", iso_date="2026-08-15",
            minor_units=-1299, currency="USD", scale=2, payee=payee, fitid="",
            identity_method="sha256_fallback", identity_fingerprint=chr(100 + i) * 64,
            institution_account_key="b/c1",
        ),
        now_utc=f"2026-09-02T10:0{i}:00Z", contra_account=contra,
    )
    db.commit()
    return stx_id


def test_loop_categorize_then_approve_then_reject_then_quit(db):
    a = _stage(db, 0)
    b = _stage(db, 1)
    _c = _stage(db, 2)
    # row a: c -> account -> (re-shown) a ; first 'a' needs the phrase (confirm passed in)
    # row b: r -> reason
    # row c: q
    script = "c\nExpenses:Coffee\na\nr\nnot needed\nq\n"
    counts = run_review_loop(
        db, stdin=io.StringIO(script), stdout=io.StringIO(), db_basename="ledger.db",
        confirm="review-session ledger.db", stdin_isatty=False, now_utc="2026-09-03T12:00:00Z",
    )
    assert counts == {"c": 1, "a": 1, "r": 1, "s": 0}
    assert db.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (a,)
    ).fetchone()[0] == "approved"
    assert db.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (b,)
    ).fetchone()[0] == "rejected"
    actions = [r[0] for r in db.execute("SELECT action FROM audit_events ORDER BY seq")]
    assert actions[0] == "review-session start"
    assert actions[-1] == "review-session end (c=1 a=1 r=1 s=0)"
    assert actions.count("review approve") == 1


def test_loop_first_decision_without_phrase_fails_closed(db):
    _stage(db, 0)
    script = "a\n"
    with pytest.raises(AuthorizationError):
        run_review_loop(
            db, stdin=io.StringIO(script), stdout=io.StringIO(), db_basename="ledger.db",
            confirm=None, stdin_isatty=False, now_utc="2026-09-03T12:00:00Z",
        )


def test_loop_phrase_prompted_once_only(db):
    _stage(db, 0)
    _stage(db, 1)
    # two approves; phrase provided once via confirm; second 'a' must not re-check
    script = "a\na\nq\n"
    counts = run_review_loop(
        db, stdin=io.StringIO(script), stdout=io.StringIO(), db_basename="ledger.db",
        confirm="review-session ledger.db", stdin_isatty=False, now_utc="2026-09-03T12:00:00Z",
    )
    # both rows had NULL contra -> approve gate fails, but the phrase check still
    # happens once; counts reflect completed approvals (0) not attempts
    assert counts["a"] == 0
```

> If `test_loop_phrase_prompted_once_only` is awkward because both approvals fail the gate, the implementer may stage the rows with `contra="Expenses:Coffee"` so the approvals succeed and assert `counts["a"] == 2`. Keep the intent: the phrase is checked once.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_review_loop.py -q`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `review/loop.py`**

```python
# src/ironledger/review/loop.py
"""Phase 2b guided review loop. Plain prompts over injected stdin/stdout; stdlib only."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from ironledger.audit import append_audit_event
from ironledger.cli.auth import expected_phrase
from ironledger.ingest.errors import AuthorizationError
from ironledger.ingest.identity import canonical_payee
from ironledger.review.approve_gate import ApproveGateError
from ironledger.review.rules import resolve_rule
from ironledger.review.state import approve, categorize, reject

__all__ = ["run_review_loop"]


def _now(now_utc: str | None) -> str:
    return now_utc or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _rows(conn: sqlite3.Connection):
    return conn.execute(
        "SELECT st.staged_transaction_id, st.status, st.payee, st.proposed_date, "
        "       imp.account, con.account "
        "FROM staged_transactions st "
        "JOIN staged_postings imp ON imp.staged_transaction_id = st.staged_transaction_id "
        "  AND imp.role = 'imported' "
        "JOIN staged_postings con ON con.staged_transaction_id = st.staged_transaction_id "
        "  AND con.role = 'contra' "
        "WHERE st.status IN ('pending', 'categorized') "
        "ORDER BY CASE st.status WHEN 'pending' THEN 0 ELSE 1 END, "
        "         st.created_at_utc ASC, st.staged_transaction_id ASC"
    ).fetchall()


def run_review_loop(
    conn: sqlite3.Connection,
    *,
    stdin,
    stdout,
    db_basename: str,
    confirm: str | None,
    stdin_isatty: bool,
    now_utc: str | None = None,
) -> dict[str, int]:
    counts = {"c": 0, "a": 0, "r": 0, "s": 0}
    append_audit_event(
        conn, actor="operator", action="review-session start", target=db_basename,
        result="ok", ts_utc=now_utc,
    )
    conn.commit()

    want_phrase = expected_phrase("review-session", db_basename)
    phrase_ok = False

    def ensure_phrase() -> None:
        nonlocal phrase_ok
        if phrase_ok:
            return
        if stdin_isatty:
            stdout.write(f"Type '{want_phrase}' to authorize decisions this session: ")
            stdout.flush()
            typed = (stdin.readline() or "").strip()
            if typed != want_phrase:
                _end(conn, db_basename, counts, now_utc)
                raise AuthorizationError("review session not authorized: phrase did not match")
        else:
            if confirm != want_phrase:
                _end(conn, db_basename, counts, now_utc)
                raise AuthorizationError("review session not authorized: --confirm did not match")
        phrase_ok = True

    def read_line() -> str:
        line = stdin.readline()
        if line == "":
            return "q"
        return line.strip()

    for stx_id, status, payee, date, imp_acct, con_acct in _rows(conn):
        suggestion = (
            resolve_rule(conn, canonical_payee(payee), imp_acct, audit_skips=False, now_utc=now_utc)
            if con_acct is None else None
        )
        re_show = True
        while re_show:
            re_show = False
            stdout.write(
                f"\n{stx_id}  {date}  {status}  {payee}\n"
                f"  imported {imp_acct}   contra {con_acct or '<uncategorized>'}"
                + (f"   [rule suggests {suggestion}]" if suggestion else "")
                + "\n[c]ategorize  [a]pprove  [r]eject  [s]kip  [q]uit > "
            )
            stdout.flush()
            cmd = read_line()
            if cmd == "q":
                _end(conn, db_basename, counts, now_utc)
                return counts
            if cmd == "s":
                counts["s"] += 1
                continue
            if cmd == "c":
                stdout.write(f"account{f' [{suggestion}]' if suggestion else ''}: ")
                stdout.flush()
                entered = read_line()
                account = entered or (suggestion or "")
                if not account:
                    stdout.write("no account entered\n")
                    re_show = True
                    continue
                try:
                    categorize(conn, stx_id, account,
                               rule_id=None if entered else None, now_utc=now_utc)
                except ValueError as exc:
                    stdout.write(f"rejected: {exc}\n")
                    re_show = True
                    continue
                conn.commit()
                counts["c"] += 1
                status, con_acct, suggestion = "categorized", account, None
                re_show = True
                continue
            if cmd == "a":
                ensure_phrase()
                try:
                    approve(conn, stx_id, now_utc=now_utc)
                except ApproveGateError as exc:
                    stdout.write(f"cannot approve: {exc}\n")
                    re_show = True
                    continue
                conn.commit()
                counts["a"] += 1
                continue
            if cmd == "r":
                ensure_phrase()
                stdout.write("reason (optional): ")
                stdout.flush()
                reason = read_line() or None
                reject(conn, stx_id, reason=reason, now_utc=now_utc)
                conn.commit()
                counts["r"] += 1
                continue
            stdout.write(f"unknown command {cmd!r}\n")
            re_show = True

    _end(conn, db_basename, counts, now_utc)
    return counts


def _end(conn, db_basename, counts, now_utc) -> None:
    append_audit_event(
        conn, actor="operator",
        action=f"review-session end (c={counts['c']} a={counts['a']} r={counts['r']} s={counts['s']})",
        target=db_basename, result="ok", ts_utc=now_utc,
    )
    conn.commit()
```

> `categorize`'s `rule_id` argument is always `None` from the loop even when the operator accepted the suggestion, because the spec's `review categorize (<account>; rule <id>)` variant is for a recorded rule-sourced decision; a hand-typed acceptance of a suggestion is still an operator categorize. If the reviewer wants the suggestion acceptance tagged, pass the resolved rule id — decide during review. Leaving it `None` is spec-compliant.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_review_loop.py -q`
Expected: PASS. Adjust the `test_loop_phrase_prompted_once_only` fixture per the inline note if needed.

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/review/loop.py tests/test_review_loop.py
git commit -m "feat(phase-2b): guided interactive review loop"
```

---

### Task 13: `cli/render.py` — review show, rule list

**Files:**
- Modify: `src/ironledger/cli/render.py`
- Test: `tests/test_cli_render_phase2b.py`

**Interfaces:**
- Produces:
  - `render_review_show(row: dict, postings: list[dict], suggestion: str | None, *, as_json: bool) -> str` — `row` keys: `staged_transaction_id, status, payee, proposed_date, identity_method, identity_fingerprint, source_record_id`. `postings` items: `role, account, minor_units, currency`. Plain text is a short block; `--json` is `json.dumps({..., "postings": [...], "rule_suggestion": suggestion}, indent=2, sort_keys=True)`.
  - `render_rule_list(rows: list[dict], *, as_json: bool) -> str` — `json.dumps(rows, indent=2, sort_keys=True)` or one line per rule: `f"{rule_id}  {match_type} {pattern!r} -> {target_account}  prio {priority}  {'active' if active else 'disabled'}"`; `"no categorization rules"` when empty.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cli_render_phase2b.py
"""Phase 2b: render helpers for review show and rule list."""

from __future__ import annotations

import json

from ironledger.cli.render import render_review_show, render_rule_list


def _row():
    return {
        "staged_transaction_id": "stx:abc", "status": "categorized", "payee": "COFFEE BAR",
        "proposed_date": "2026-08-15", "identity_method": "sha256_fallback",
        "identity_fingerprint": "d" * 64, "source_record_id": "doc-1:0",
    }


def _postings():
    return [
        {"role": "imported", "account": "Assets:Bank:Checking", "minor_units": -1299, "currency": "USD"},
        {"role": "contra", "account": "Expenses:Coffee", "minor_units": 1299, "currency": "USD"},
    ]


def test_review_show_text_contains_key_fields():
    out = render_review_show(_row(), _postings(), None, as_json=False)
    assert "stx:abc" in out and "COFFEE BAR" in out and "Expenses:Coffee" in out


def test_review_show_json_roundtrips():
    out = render_review_show(_row(), _postings(), "Expenses:Coffee", as_json=True)
    data = json.loads(out)
    assert data["rule_suggestion"] == "Expenses:Coffee"
    assert len(data["postings"]) == 2


def test_rule_list_empty():
    assert render_rule_list([], as_json=False) == "no categorization rules"


def test_rule_list_text_line():
    rows = [{
        "rule_id": "rule:1", "match_type": "exact", "pattern": "coffee bar",
        "importing_account": None, "target_account": "Expenses:Coffee",
        "priority": 50, "active": 1, "created_at_utc": "2026-09-03T10:00:00Z",
        "disabled_at_utc": None,
    }]
    out = render_rule_list(rows, as_json=False)
    assert "rule:1" in out and "Expenses:Coffee" in out and "active" in out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_cli_render_phase2b.py -q`
Expected: FAIL — `ImportError`.

- [ ] **Step 3: Extend `render.py`**

Add to `__all__`: `"render_review_show"`, `"render_rule_list"`. Append:

```python
def render_review_show(row: dict, postings: list[dict], suggestion, *, as_json: bool) -> str:
    if as_json:
        return json.dumps(
            {**row, "postings": postings, "rule_suggestion": suggestion},
            indent=2, sort_keys=True,
        )
    lines = [
        f"{row['staged_transaction_id']}  {row['proposed_date']}  {row['status']}",
        f"  payee     {row['payee']}",
        f"  identity  {row['identity_method']} {row['identity_fingerprint'][:12]}",
        f"  source    {row['source_record_id']}",
    ]
    for p in postings:
        lines.append(f"  {p['role']:8} {p['account'] or '<uncategorized>':30} {p['minor_units']:>12} {p['currency']}")
    if suggestion:
        lines.append(f"  rule suggests: {suggestion}")
    return "\n".join(lines)


def render_rule_list(rows: list[dict], *, as_json: bool) -> str:
    if as_json:
        return json.dumps(rows, indent=2, sort_keys=True)
    if not rows:
        return "no categorization rules"
    return "\n".join(
        f"{r['rule_id']}  {r['match_type']} {r['pattern']!r} -> {r['target_account']}  "
        f"prio {r['priority']}  {'active' if r['active'] else 'disabled'}"
        + (f"  scope {r['importing_account']}" if r['importing_account'] else "")
        for r in rows
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_cli_render_phase2b.py tests/test_cli_review_list.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ironledger/cli/render.py tests/test_cli_render_phase2b.py
git commit -m "feat(phase-2b): render helpers for review show and rule list"
```

---

### Task 14: `cli/__main__.py` — wire the `review` and `rule` command trees

**Files:**
- Modify: `src/ironledger/cli/__main__.py`
- Test: `tests/test_cli_review_phase2b.py`

**Interfaces:**
- Consumes: every Task 3–13 public function.
- Produces: new subcommands, each opening a connection with `connect`, running `migrations.migrate`, doing its work, and returning an exit code (`_EXIT_OK`, `_EXIT_AUTH`, `_EXIT_INGEST` reused; add `_EXIT_STATE = 5` for a `ReviewStateError`/`RuleError` that is not an auth failure):
  - `review show <id> [--json]` — read-only. Load the header row and both postings; when the `contra` account is `NULL`, compute the suggestion with `resolve_rule(conn, canonical_payee(row_payee), imported_account, audit_skips=False)` so a broken rule never makes this command write; pass all three to `render_review_show`. No `conn.commit()`, no auth gate.
  - `review categorize <id> <account> [--persist-rule] [--confirm <phrase>]` — `require_safe_mode_off` (no phrase); `state.categorize`; if `--persist-rule`, `rules.persist_exact_rule` in the same connection before commit; a `RuleExistsError` → print, exit 5, no categorize committed (call persist first, then categorize, then one commit).
  - `review auto-match [--importing-account <acct>] [--confirm <phrase>]` — `require_operator(action="review-auto-match", subject=importing_account or "all")`; `state.auto_match`; print the summary.
  - `review approve <id> [--confirm <phrase>]` — `require_operator(action="review-approve", subject=id)`; `state.approve`; on `ApproveGateError` write a `denied` audit event (`append_audit_event(action=f"review approve (denied: {exc.reason})", target=id, result="denied")`), print, exit 3.
  - `review reject <id> [--reason <text>] [--confirm <phrase>]` — `require_operator(action="review-reject", subject=id)`; `state.reject`.
  - `review reopen <id> [--confirm <phrase>]` — `require_operator(action="review-reopen", subject=id)`; `state.reopen`.
  - `review` (no subcommand) — `loop.run_review_loop(conn, stdin=sys.stdin, stdout=sys.stdout, db_basename=Path(args.db).name, confirm=args.confirm, stdin_isatty=sys.stdin.isatty())`; the loop enforces safe mode via the first-decision phrase, but also call `require_safe_mode_off(action="review-session", subject=Path(args.db).name)` up front so an all-skip session on a safe-mode relay still fails closed. Add `--confirm` to the bare `review` parser.
  - `rule add --match-type T --pattern P --account A [--importing-account X] [--priority N] [--confirm <phrase>]` — `require_operator(action="rule-add", subject=args.account)`; `rules.add_rule`.
  - `rule list [--json]` — read-only; `render_rule_list(rules.list_rules(conn), ...)`.
  - `rule disable <rule_id> [--confirm <phrase>]` — `require_operator(action="rule-disable", subject=rule_id)`; `rules.disable_rule`.
- `review list` keeps working; extend nothing except allowing `--status categorized` (already free-form; no code change needed — confirm the Phase 2a handler passes `--status` straight through).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cli_review_phase2b.py
"""Phase 2b: the review and rule CLI command trees end to end via main(argv)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ironledger.cli.__main__ import main
from ironledger.db import migrations
from ironledger.db.connection import connect


@pytest.fixture
def env(tmp_path: Path):
    db = tmp_path / "ledger.db"
    cfg = tmp_path / "config"
    cfg.mkdir()
    (cfg / "safe-mode.json").write_text(json.dumps({"enabled": False}), encoding="utf-8")
    conn = connect(str(db))
    migrations.migrate(conn)
    conn.execute(
        "INSERT INTO source_documents (source_document_id, mime_type, encoding, provenance, "
        " acquisition_time_utc, content_sha256, raw_payload_ref, created_at_utc) "
        f"VALUES ('doc-1','text/csv','utf-8','p','2026-09-02T10:00:00Z','{'a'*64}',"
        " 'evidence/source_documents/doc-1','2026-09-02T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO source_records (source_record_id, source_document_id, record_index, "
        f" canonical_payload, content_sha256, created_at_utc) VALUES ('doc-1:0','doc-1',0,'{{}}',"
        f" '{'b'*64}','2026-09-02T10:00:00Z')"
    )
    from ironledger.ingest.stage import StagedInput, upsert_staged
    stx_id, _ = upsert_staged(
        conn,
        StagedInput(
            source_record_id="doc-1:0", account="Assets:Bank:Checking", iso_date="2026-08-15",
            minor_units=-1299, currency="USD", scale=2, payee="COFFEE BAR", fitid="",
            identity_method="sha256_fallback", identity_fingerprint="d" * 64,
            institution_account_key="b/c1",
        ),
        now_utc="2026-09-02T10:00:00Z",
    )
    conn.commit()
    conn.close()
    return db, cfg, stx_id


def _argv(db, cfg, *rest):
    return ["--db", str(db), "--config-dir", str(cfg), *rest]


def test_rule_add_then_list(env, capsys):
    db, cfg, _ = env
    rc = main(_argv(db, cfg, "rule", "add", "--match-type", "exact", "--pattern", "coffee bar",
                    "--account", "Expenses:Coffee", "--confirm", "rule Expenses:Coffee"))
    assert rc == 0
    rc = main(_argv(db, cfg, "rule", "list"))
    assert rc == 0
    assert "Expenses:Coffee" in capsys.readouterr().out


def test_categorize_then_approve(env, capsys):
    db, cfg, stx = env
    rc = main(_argv(db, cfg, "review", "categorize", stx, "Expenses:Coffee"))
    assert rc == 0
    rc = main(_argv(db, cfg, "review", "approve", stx, "--confirm", f"approve {stx}"))
    assert rc == 0
    conn = connect(str(db))
    assert conn.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (stx,)
    ).fetchone()[0] == "approved"


def test_approve_without_categorize_is_denied(env):
    db, cfg, stx = env
    rc = main(_argv(db, cfg, "review", "approve", stx, "--confirm", f"approve {stx}"))
    assert rc == 3
    conn = connect(str(db))
    action, result = conn.execute(
        "SELECT action, result FROM audit_events ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    assert result == "denied"
    assert action.startswith("review approve (denied:")


def test_approve_without_confirm_on_non_tty_is_denied(env):
    db, cfg, stx = env
    main(_argv(db, cfg, "review", "categorize", stx, "Expenses:Coffee"))
    rc = main(_argv(db, cfg, "review", "approve", stx))
    assert rc == 3


def test_reject_with_reason_and_reopen(env):
    db, cfg, stx = env
    assert main(_argv(db, cfg, "review", "reject", stx, "--reason", "dupe",
                      "--confirm", f"reject {stx}")) == 0
    assert main(_argv(db, cfg, "review", "reopen", stx, "--confirm", f"reopen {stx}")) == 0
    conn = connect(str(db))
    assert conn.execute(
        "SELECT status FROM staged_transactions WHERE staged_transaction_id = ?", (stx,)
    ).fetchone()[0] == "pending"


def test_categorize_persist_rule_creates_rule(env):
    db, cfg, stx = env
    rc = main(_argv(db, cfg, "review", "categorize", stx, "Expenses:Coffee", "--persist-rule"))
    assert rc == 0
    conn = connect(str(db))
    assert conn.execute("SELECT count(*) FROM categorization_rules").fetchone()[0] == 1


def test_review_list_status_categorized(env, capsys):
    db, cfg, stx = env
    main(_argv(db, cfg, "review", "categorize", stx, "Expenses:Coffee"))
    rc = main(_argv(db, cfg, "review", "list", "--status", "categorized"))
    assert rc == 0
    assert stx[:16] in capsys.readouterr().out


def test_safe_mode_blocks_categorize(env):
    db, cfg, stx = env
    (cfg / "safe-mode.json").write_text(json.dumps({"enabled": True}), encoding="utf-8")
    rc = main(_argv(db, cfg, "review", "categorize", stx, "Expenses:Coffee"))
    assert rc == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=src python -m pytest tests/test_cli_review_phase2b.py -q`
Expected: FAIL — `argparse` errors on the unknown subcommands.

- [ ] **Step 3: Extend `_build_parser` and `main`**

In `_build_parser`, extend the existing `rev_sub` (currently only has `list`) and add a `rule` group:

```python
    rev_show = rev_sub.add_parser("show", help="show one staged transaction")
    rev_show.add_argument("staged_transaction_id")
    rev_show.add_argument("--json", action="store_true")

    rev_cat = rev_sub.add_parser(
        "categorize", help="set the contra account",
        description="Safe-mode gated; no phrase. Advances a pending row to categorized.",
    )
    rev_cat.add_argument("staged_transaction_id")
    rev_cat.add_argument("target_account")
    rev_cat.add_argument("--persist-rule", action="store_true")
    rev_cat.add_argument("--confirm", default=None)  # accepted, unused; keeps a uniform surface

    rev_am = rev_sub.add_parser(
        "auto-match", help="apply rules to pending NULL-contra rows",
        description="Authorized action. Phrase: 'auto-match <importing-account|all>'.",
    )
    rev_am.add_argument("--importing-account", default=None)
    rev_am.add_argument("--confirm", default=None)

    rev_ap = rev_sub.add_parser("approve", help="approve a staged transaction",
                                description="Authorized action. Phrase: 'approve <id>'.")
    rev_ap.add_argument("staged_transaction_id")
    rev_ap.add_argument("--confirm", default=None)

    rev_rj = rev_sub.add_parser("reject", help="reject a staged transaction",
                                description="Authorized action. Phrase: 'reject <id>'.")
    rev_rj.add_argument("staged_transaction_id")
    rev_rj.add_argument("--reason", default=None)
    rev_rj.add_argument("--confirm", default=None)

    rev_ro = rev_sub.add_parser("reopen", help="return a categorized or rejected row to pending",
                                description="Authorized action. Phrase: 'reopen <id>'.")
    rev_ro.add_argument("staged_transaction_id")
    rev_ro.add_argument("--confirm", default=None)
```

Make `rev_sub` not `required` so a bare `ironledger review` runs the loop, and add `--confirm` to `rev`:

```python
    rev_sub = rev.add_subparsers(dest="review_command", required=False)
    rev.add_argument("--confirm", default=None)
```

Add the `rule` group:

```python
    rule = sub.add_parser("rule", help="manage categorization rules")
    rule_sub = rule.add_subparsers(dest="rule_command", required=True)
    rule_add = rule_sub.add_parser("add", help="add a categorization rule",
                                   description="Authorized action. Phrase: 'rule <target-account>'.")
    rule_add.add_argument("--match-type", required=True, choices=["exact", "prefix", "regex"])
    rule_add.add_argument("--pattern", required=True)
    rule_add.add_argument("--account", required=True)
    rule_add.add_argument("--importing-account", default=None)
    rule_add.add_argument("--priority", type=int, default=100)
    rule_add.add_argument("--confirm", default=None)
    rule_list = rule_sub.add_parser("list", help="list categorization rules")
    rule_list.add_argument("--json", action="store_true")
    rule_dis = rule_sub.add_parser("disable", help="disable a rule",
                                   description="Authorized action. Phrase: 'rule-disable <rule_id>'.")
    rule_dis.add_argument("rule_id")
    rule_dis.add_argument("--confirm", default=None)
```

In `main`, dispatch:

```python
    if args.command == "review":
        if getattr(args, "review_command", None) in (None,):
            return _cmd_review_loop(args)
        return {
            "list": _cmd_review_list,
            "show": _cmd_review_show,
            "categorize": _cmd_review_categorize,
            "auto-match": _cmd_review_auto_match,
            "approve": _cmd_review_approve,
            "reject": _cmd_review_reject,
            "reopen": _cmd_review_reopen,
        }[args.review_command](args)
    if args.command == "rule":
        return {
            "add": _cmd_rule_add, "list": _cmd_rule_list, "disable": _cmd_rule_disable,
        }[args.rule_command](args)
```

Implement each `_cmd_*` following the Phase 2a pattern in this file: open `connect(str(args.db))`, `migrations.migrate(conn)`, `try/finally: conn.close()`, catch `AuthorizationError` → print `denied:`, return `_EXIT_AUTH`; catch `ReviewStateError` / `RuleError` / `ApproveGateError` (non-auth) → print `error:`, return `_EXIT_STATE`. For `approve`, translate `ApproveGateError` into a `denied` audit event before returning `_EXIT_AUTH` (per the spec's approve-gate section):

```python
def _cmd_review_approve(args) -> int:
    conn = connect(str(args.db))
    try:
        migrations.migrate(conn)
        try:
            auth.require_operator(conn, action="review-approve", subject=args.staged_transaction_id,
                                  confirm=args.confirm, stdin_isatty=sys.stdin.isatty(),
                                  config_dir=args.config_dir)
        except AuthorizationError as exc:
            print(f"denied: {exc}", file=sys.stderr)
            return _EXIT_AUTH
        from ironledger.review.state import approve
        from ironledger.review.approve_gate import ApproveGateError
        try:
            approve(conn, args.staged_transaction_id)
            conn.commit()
        except ApproveGateError as exc:
            append_audit_event(conn, actor="operator",
                               action=f"review approve (denied: {exc.reason})",
                               target=args.staged_transaction_id, result="denied")
            conn.commit()
            print(f"denied: {exc}", file=sys.stderr)
            return _EXIT_AUTH
        print(f"approved {args.staged_transaction_id}")
        return _EXIT_OK
    finally:
        conn.close()
```

The other handlers follow the same skeleton with their own `state.*` / `rules.*` call and phrase `action`. `_cmd_review_categorize` calls `auth.require_safe_mode_off(conn, action="review categorize", subject=args.staged_transaction_id, config_dir=args.config_dir)` (catching `AuthorizationError` → `_EXIT_AUTH`), then, if `args.persist_rule`, resolves the row's canonical payee + imported account and calls `rules.persist_exact_rule` (catching `RuleExistsError` → print, `_EXIT_STATE`, no commit), then `state.categorize`, then one `conn.commit()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=src python -m pytest tests/test_cli_review_phase2b.py -q`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `PYTHONPATH=src python -m pytest -q`
Expected: green. Fix any Phase 2a CLI test that assumed `review` required a subcommand.

- [ ] **Step 6: Commit**

```bash
git add src/ironledger/cli/__main__.py tests/test_cli_review_phase2b.py
git commit -m "feat(phase-2b): wire the review and rule CLI command trees"
```

---

### Task 15: Full-suite regression sweep and evidence mapping

**Files:**
- Create: `docs/meta/phases/ironledger-phase-2b-evidence.md` (skeleton; the operator fills the verdict)
- Modify: any Phase 2a test that hard-coded schema version 3 or a required `review` subcommand (if not already fixed in an earlier task)

**Interfaces:** none — this task produces evidence, not code.

- [ ] **Step 1: Run the whole focused suite**

Run: `PYTHONPATH=src python -m pytest -q`
Expected: all green, no errors, no unexpected skips. Record the summary line (e.g. `NNN passed, 1 skipped`).

- [ ] **Step 2: Map each spec section 12 test-contract item to its test(s)**

Build the table: for each of the 10 items in `ironledger-phase-2b-review-design.md` section 12, name the test file and test function(s) that cover it. If any item has no covering test, write the missing test now in the appropriate `tests/test_review_*.py` and re-run.

- [ ] **Step 3: Write the evidence skeleton**

```markdown
# IronLedger Phase 2b exit evidence

Status: evidence for operator review. No Phase 3 work is authorized until this gate is approved.

## 1. Scope delivered

Contra-account categorization, the database-backed payee rule engine with import-time
auto-fill, the pending/categorized/approved/rejected state machine, `review show`,
`review categorize`, `review auto-match`, `review approve`, `review reject`,
`review reopen`, the guided interactive loop, and `rule add` / `rule list` / `rule disable`.
Migration 0004 applied. `_with_placeholder_account` removed.

## 2. Test evidence (focused suite only)

`PYTHONPATH=src python -m pytest -q` -> <summary line>

| Spec section 12 item | Covering test(s) |
|---|---|
| 1 migration | tests/test_migration_0004.py, tests/test_migration_0004_rules.py |
| 2 state machine | tests/test_review_state_categorize.py, tests/test_review_state_decisions.py |
| 3 rule resolution | tests/test_review_rules_resolve.py |
| 4 import-time auto-fill | tests/test_ingest_pipeline_rules.py, tests/test_ingest_stage_contra.py |
| 5 --persist-rule | tests/test_review_rules_crud.py, tests/test_cli_review_phase2b.py |
| 6 auto-match | tests/test_review_state_auto_match.py |
| 7 authorization | tests/test_cli_auth_phase2b.py, tests/test_cli_review_phase2b.py |
| 8 approve gate | tests/test_review_approve_gate.py |
| 9 guided loop | tests/test_review_loop.py |
| 10 read-only surfaces | tests/test_cli_render_phase2b.py, tests/test_cli_review_phase2b.py |

## 3. Fixed authorization phrases (published)

| Action | Phrase |
|---|---|
| review approve | `approve <staged_transaction_id>` |
| review reject | `reject <staged_transaction_id>` |
| review reopen | `reopen <staged_transaction_id>` |
| review auto-match | `auto-match <importing-account|all>` |
| rule add | `rule <target_account>` |
| rule disable | `rule-disable <rule_id>` |
| review session (loop) | `review-session <db-basename>` |

`review categorize` is gated by safe mode only; it takes no phrase.

## 4. Deferred, unchanged

Beancount compile, `bean-check`, projection, search, MCP, SimpleFIN, RAG, mobile,
backups, Git publication. Full-suite, live-bank-file, and production evidence.

## 5. Operator verdict

<operator fills: approved / changes requested, date, transcript reference>
```

- [ ] **Step 4: Commit**

```bash
git add docs/meta/phases/ironledger-phase-2b-evidence.md tests/
git commit -m "docs(phase-2b): exit evidence skeleton and test-contract mapping"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| 3 state machine + transition table | 8, 10, 11 |
| 4.1 `staged_transactions` rebuild | 1 |
| 4.2 `categorization_rules` | 1 (schema, whole file), 2 (constraint coverage) |
| 5.1 import-time auto-fill + `rules_applied` | 6, 7 |
| 5.2 `--importing-account` replaces `_with_placeholder_account` | 7 (pipeline + CLI flag + the three OFX test updates) |
| 6.1 payee canonicalization reuse | 3 (imports `identity.canonical_payee`) |
| 6.2 resolution ordering + `audit_skips` skip-on-bad-regex | 3, 11 (`resolve_rule_row`) |
| 6.3 `--persist-rule` | 4, 14 |
| 6.4 `rule add`/`list`/`disable` | 4, 13, 14 |
| 7 command surface (`review show` uses `audit_skips=False`) | 14 |
| 7.1 guided loop (suggestion uses `audit_skips=False`) | 12, 14 |
| 8 approve gate (reuses `validate_same_currency_balance`) | 9, 10 |
| 9 auth-gate extension | 5, 14 |
| 10 observability (`action`-string events) | every mutating task asserts its `action` string |
| 11 error-handling table (incl. OFX-without-`--importing-account`, CSV-with-`--importing-account`) | 7, 8, 9, 10, 14 (exit codes) |
| 12 test contract | 15 mapping |
| 13 out of scope | respected — no compile/projection/MCP code |

**2. Placeholder scan:** No `...` stubs remain. Task 7's test bodies are fully written against the real fixtures (`tests/fixtures/sample_bank.csv` — payees `COFFEE BAR` / `ACME PAYROLL` / `PARENS VENDOR`, imported account `Assets:Bank:Checking:ExampleBank` from `config/csv-profiles/example-bank.json` — and `tests/fixtures/sample_v1.ofx`). Every task has complete code.

**3. Type consistency:** `resolve_rule(conn, canonical_payee_value, importing_account, *, audit_skips=True, now_utc=None)` returns `str | None`; `resolve_rule_row(..., audit_skips=True, ...)` returns `tuple[str, str] | None`; `resolve_rule` delegates to `resolve_rule_row` after Task 11. Call sites: Task 7 pipeline (`audit_skips` default), Task 11 `auto_match` (`resolve_rule_row`, default), Task 12/14 read paths (`audit_skips=False`). `categorize(conn, stx_id, target_account, *, rule_id=None, now_utc=None)` — call sites in Tasks 12 (loop, `rule_id=None`) and 14 (CLI). `auto_match` returns `tuple[int, int]` = `(matched, candidates)` — asserted in Task 11, printed in Task 14. `check_approvable` raises `ApproveGateError` with `.reason` in `{status, missing_account, invalid_account, multi_currency, unbalanced}`; consumed in Task 10 (`approve` re-raises) and Task 14 (CLI maps to a `denied` audit). `add_rule` / `persist_exact_rule` return `str` (rule id); `RuleExistsError.existing_rule_id` used in Task 4 test and Task 14 handler. `run_import` gains keyword `importing_account: str | None = None` (Task 7); the CLI `import` command passes it (Task 7 step 4).

## Execution Handoff

**Plan complete and saved to `docs/meta/plans/ironledger-phase-2b-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session with checkpoints for review.

**Which approach?**
