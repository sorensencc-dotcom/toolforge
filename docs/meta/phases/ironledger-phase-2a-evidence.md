# IronLedger Phase 2a evidence and exit verification

Status: Phase 2a exit gate approved by the operator in the session transcript on 2026-09-03. Phase 2b may start.
Scope: file acquisition, parsing, canonical versioned identity, idempotent staging, a read-only `review list`, and the operator-authorization gate for `import` and `fitid-trust add`. Focused-suite evidence only.

## 1. Provenance of this evidence

Every number in this document comes from a test run executed against the working tree at the head of the Phase 2a implementation branch in `C:\dev\IronLedger`, after Tasks 1 through 14 of `docs/meta/plans/ironledger-phase-2a-plan.md`. The `verify_manifest` hardening from spec §11 shipped earlier, in commit `eafe754`, with its regression test `tests/test_manifests_injection.py`.

This is a focused-suite record in the same discipline as the Phase 1 evidence. Full-suite runs, live bank-file runs, and production evidence stay deferred; they are not inputs to this gate.

## 2. Repository and environment state

| Item | Value |
|---|---|
| Repository path | `C:\dev\IronLedger` (operator-approved home, D-0) |
| Git branch | Phase 2a implementation branch (local-only; no git push) |
| Upstream remote | None configured |
| Toolchain | Python 3.14, pytest, SQLite via stdlib `sqlite3` |
| Added runtime dependency | `ofxtools==1.1.1` (see `docs/meta/ironledger-dependency-posture.md`) |
| Lockfile | `requirements.lock`, `pip-compile` output, pins `ofxtools==1.1.1` and nothing transitive |

## 3. Dependency posture

Phase 2a adds one runtime dependency, `ofxtools==1.1.1`, used only as an OFX SGML and XML parser on local bytes in `src/ironledger/ingest/formats/ofx.py` (`ofxtools.Parser.OFXTree().parse(BytesIO(raw))` then `.convert()`). IronLedger never constructs `ofxtools`'s OFX network client, so the dependency opens no outbound path. `ofxtools` 1.1.1 has zero runtime dependencies, so `requirements.lock` pins a single line. The CLI uses stdlib `argparse`, CSV parsing uses stdlib `csv`, and encoding detection uses a byte-order-mark sniff plus a bounded UTF-8, UTF-16, and Latin-1 trial in `csv_engine._decode` rather than `chardet`. The full rationale, the rejected alternatives, and the version-bump review trigger are in `docs/meta/ironledger-dependency-posture.md`, reviewed with this evidence.

## 4. Operator-authorization phrases

Both phrases are fixed, published strings, printed in the command's `--help` output. Neither is a secret; the gate's security value is the audit event and the safe-mode precondition, not phrase secrecy.

| Action | Expected phrase |
|---|---|
| `ironledger import <path>` | `import <resolved-inbox-path>` |
| `ironledger fitid-trust add --institution <id> --account <id>` | `trust <institution>/<account>` |

For an import, `<resolved-inbox-path>` is the fully resolved absolute path of the file inside the configured inbox. Without a TTY, pass the exact phrase with `--confirm`.

## 5. Spec §12 test-contract mapping

Each of the nine numbered items in `ironledger-phase-2a-ingestion-design.md` §12 maps to the covering test files and functions below. Coverage gaps are called out in section 6.

### §12.1 Re-import of an identical OFX and an identical CSV file produces zero duplicate rows

| Test file | Test function |
|---|---|
| `tests/test_ingest_pipeline.py` | `test_ofx_import_stages_rows_and_writes_one_audit_event` (baseline counts 2 source records, 2 staged transactions, 4 staged postings, 1 audit event) |
| `tests/test_ingest_pipeline.py` | `test_reimport_short_circuits_with_zero_records_and_one_more_audit_event` (second import of the same OFX: counts unchanged, `records_created == 0`, `short_circuited is True`, one additional audit event) |
| `tests/test_ingest_acquire.py` | `test_acquire_is_idempotent_on_content_regardless_of_filename` |
| `tests/test_ingest_records.py` | `test_write_source_record_is_idempotent` |
| `tests/test_ingest_stage.py` | `test_upsert_is_idempotent_on_fingerprint` (second `upsert_staged` returns the same id, `created is False`, one header and two postings remain) |
| `tests/test_cli_import.py` | `test_import_with_matching_confirm_exits_0_and_stages` (CLI import path, count baseline) |

### §12.2 `identity_method` is `fitid` with a trust row, `sha256_fallback` without; the two methods do not merge

| Test file | Test function |
|---|---|
| `tests/test_ingest_identity.py` | `test_method_is_fallback_without_a_trust_row` |
| `tests/test_ingest_identity.py` | `test_method_is_fitid_with_a_trust_row_and_a_fitid` |
| `tests/test_ingest_identity.py` | `test_fingerprint_changes_with_institution_account_key` (fingerprints differ when identity inputs differ, the mechanism by which fallback and FITID identities cannot collide) |

The non-merge property is documented in spec §9 and section 6 of this document. The FITID and SHA-256-fallback fingerprints differ by construction, so re-importing after a later `fitid-trust add` produces a second set of staged rows rather than merging; the Phase 2b reconcile pass is out of scope here.

### §12.3 Property tests: canonicalization stability, malformed and ambiguous-currency rejection, multi-currency accept, profile-without-currency reject

| Test file | Test function |
|---|---|
| `tests/test_ingest_identity.py` | `test_canonical_payee_order_nfc_then_casefold_then_collapse` |
| `tests/test_ingest_identity.py` | `test_fingerprint_is_stable_across_payee_whitespace_and_case` (parametrized over `"COFFEE BAR"`, `"coffee   bar"`, `"  Coffee Bar\t"`) |
| `tests/test_ingest_records.py` | `test_normalize_collapses_whitespace_and_nfc` |
| `tests/test_ingest_records.py` | `test_canonical_json_is_deterministic` |
| `tests/test_ingest_csv_engine.py` | `test_multi_currency_file_is_accepted_per_row` (rows resolve to `USD` and `EUR`, each staged under its own code) |
| `tests/test_ingest_csv_engine.py` | `test_profile_without_currency_source_is_rejected` (`ConfigError` before any row is staged) |
| `tests/test_ingest_csv_engine.py` | `test_parse_amount_rejects_non_decimal_residue` (`"twelve dollars"` rejected) |

### §12.4 Integer arithmetic across currency scales; float rejected; parentheses, trailing-minus, and split debit/credit sign conventions

| Test file | Test function |
|---|---|
| `tests/test_ingest_stage.py` | `test_minor_units_from_text_exact` (parametrized: `-12.99`/scale 2 → `-1299`, `2000.00`/scale 2 → `200000`, `-45`/scale 2 → `-4500`, `100`/scale 0 → `100`) |
| `tests/test_ingest_stage.py` | `test_minor_units_rejects_too_many_fraction_digits` (`1.239` at scale 2 rejected as not exactly representable) |
| `tests/test_ingest_csv_engine.py` | `test_parse_amount_to_text_sign_and_separator_conventions` (parametrized: `-12.99`, `(45.00)` → `-45.00`, `45.00-` → `-45.00`, `$1,234.56` → `1234.56`, `1,000.00` → `1000.00`) |
| `tests/test_ingest_csv_engine.py` | `test_split_debit_credit_columns` |
| `tests/test_ingest_csv_engine.py` | `test_floating_point_like_amount_with_exponent_is_rejected` (`1e3` rejected) |

### §12.5 Path traversal, symlink escape, UNC, device path, and disallowed type are rejected with nothing written

| Test file | Test function |
|---|---|
| `tests/test_ingest_inbox.py` | `test_traversal_outside_the_root_is_rejected` |
| `tests/test_ingest_inbox.py` | `test_symlink_escape_is_rejected` (skips when the Windows user lacks symlink-create privilege; see section 6) |
| `tests/test_ingest_inbox.py` | `test_disallowed_suffix_is_rejected` |
| `tests/test_ingest_inbox.py` | `test_directory_is_rejected` |
| `tests/test_ingest_inbox.py` | `test_valid_file_directly_in_inbox_resolves` (positive control) |
| `tests/test_cli_import.py` | `test_import_outside_inbox_exits_4` (rejection at the CLI layer, exit code 4) |

### §12.6 `import` with safe mode on, and with no valid confirmation, fail closed and audit `result = denied`

| Test file | Test function |
|---|---|
| `tests/test_cli_auth.py` | `test_safe_mode_on_denies_and_audits` |
| `tests/test_cli_auth.py` | `test_safe_mode_defaults_to_enabled_when_file_absent` |
| `tests/test_cli_auth.py` | `test_confirm_flag_mismatch_denies_and_audits` |
| `tests/test_cli_auth.py` | `test_no_confirmation_at_all_denies` |
| `tests/test_cli_auth.py` | `test_confirm_flag_match_authorizes` (positive control, mechanism `confirm-flag`, no audit event on success path before the action) |
| `tests/test_cli_auth.py` | `test_tty_prompt_match_authorizes` (positive control, mechanism `tty`) |
| `tests/test_cli_import.py` | `test_import_without_confirm_exits_3` |

### §12.7 Migration 0003 applies on a fresh database, is not applied twice, and leaves no partial schema version if interrupted

| Test file | Test function |
|---|---|
| `tests/test_migration_0003.py` | `test_migrate_reaches_version_three` |
| `tests/test_migration_0003.py` | `test_staged_postings_accepts_imported_named_and_contra_null` |
| `tests/test_migration_0003.py` | `test_imported_posting_may_not_have_null_account` (contra-only-null `CHECK`) |
| `tests/test_migration_0003.py` | `test_posting_index_is_unique_per_transaction` (`UNIQUE(staged_transaction_id, posting_index)`) |
| `tests/test_migration_0003.py` | `test_deleting_staged_transaction_cascades_to_postings` (cascade from `staged_transactions`) |
| `tests/test_migration_0003.py` | `test_deleting_source_record_is_restricted_by_a_posting` (`RESTRICT` to `source_records`) |
| `tests/test_migrations.py` | forward-only runner contract: fresh apply, repeat apply is a no-op, schema-version match, checksum, and interrupted-migration leave-no-partial-version cases (shared runner suite, unchanged from Phase 1) |

### §12.8 `verify_manifest` table-name injection regression from spec §11

| Test file | Test function |
|---|---|
| `tests/test_manifests_injection.py` | `test_unknown_table_name_fails_verification` |
| `tests/test_manifests_injection.py` | `test_injection_payload_table_name_fails_verification` (a `row_counts` key carrying a `DROP TABLE` payload fails verification cleanly, no SQL executed beyond the guarded count) |

Shipped in commit `eafe754`.

### §12.9 `review list` returns staged rows read-only and exposes no mutation path

| Test file | Test function |
|---|---|
| `tests/test_cli_review_list.py` | `test_review_list_json_returns_two_rows` (`--json` payload carries `staged_transaction_id`, `proposed_date`, `status`, `payee`, `posting_summary`) |
| `tests/test_cli_review_list.py` | `test_review_list_does_not_mutate` (audit-event count identical before and after) |

## 6. Test run

Command, run from `C:\dev\IronLedger`:

```powershell
$env:PYTHONPATH='src'; python -m pytest -q
```

```text
155 passed, 1 skipped in 1.09s
```

The count is 77 Phase 1 tests plus 78 new Phase 2a tests. The single skip is `test_symlink_escape_is_rejected` in `tests/test_ingest_inbox.py`: creating a symlink needs a privilege this Windows user account does not hold. `test_traversal_outside_the_root_is_rejected` exercises the same escape-rejection guard through a non-symlink path, so the guard is still covered.

## 7. Known coverage gaps and limitations

1. **`--allow-partial` is inert in Phase 2a.** The `ironledger import` CLI accepts `--allow-partial` and threads it into `pipeline.run_import(allow_partial=...)`, but the Phase 2a pipeline body never reads the flag. Import is unconditionally all-or-nothing for one file. Functional partial import and resume are deferred to a later phase. The flag is wired so the later phase changes the pipeline, not the command surface.

2. **UNC and device-path rejection is implemented but not separately tested.** `src/ironledger/ingest/inbox.py` rejects UNC and device paths before any filesystem call (`ALLOWED_SUFFIXES` guard plus explicit UNC and device checks), but `tests/test_ingest_inbox.py` exercises only traversal, symlink escape, disallowed suffix, and directory rejection. The UNC and device branches have no dedicated test. Low risk on a single-operator local host; add explicit cases if a later phase widens the inbox surface.

3. **Currency-scale coverage is scale 0 and scale 2.** `test_minor_units_from_text_exact` is parametrized over a scale-0 case (`100`/`0`) and scale-2 cases. A scale-3 currency is not separately parametrized. The minor-units routine takes the scale as a parameter and has no scale-specific branch, so scale-3 behavior follows from the same code path, but it is not asserted directly.

4. **Symlink-escape assertion is skipped on this host.** See section 6. The traversal test covers the same guard.

5. **Identity stability under row reordering is covered indirectly.** `record_index` is not part of the version-1 identity tuple (spec §9), and the fingerprint is a pure function of row fields, so reordering rows in a file cannot change any fingerprint. The canonicalization-stability tests assert payee whitespace, case, and NFC invariance directly; there is no dedicated test that permutes row order in a fixture and re-imports.

## 8. D-4: ingest inbox path

`config/filesystem-roots.json` `ingest_inbox` is unset in the repository. Only `config/filesystem-roots.example.json` is committed. The operator sets `ingest_inbox` to an absolute directory path, outside the repository and read-only to IronLedger, before the first real import. Phase 2a is built and tested against fixtures; a missing key fails closed with a `ConfigError` whose message names decision D-4 (`tests/test_ingest_inbox.py::test_missing_config_file_raises_config_error_naming_d4`, `test_missing_key_raises_config_error`). D-4 is not a code blocker for this gate.

## 9. Scope statement

This is focused-suite evidence only. Full-suite runs, live bank-file imports, and production evidence stay deferred and are not part of the Phase 2a exit gate.

## 10. Phase 2a exit recommendation

Tasks 1 through 14 of `docs/meta/plans/ironledger-phase-2a-plan.md` have implementation and 155 passing, 1 skipped focused tests. Every spec §12 item maps to named tests in section 5. The dependency posture is a single pure-Python parser dependency with a committed lockfile. The gaps in section 7 are documented limitations, not regressions.

Do not mark Phase 2a complete until the operator reviews this evidence and approves the exit gate in the transcript.

## 11. Exit gate decision

The operator approved the Phase 2a exit gate in the session transcript on 2026-09-03. Tasks 1 through 14 are accepted on focused-suite evidence. The section 7 gaps are carried forward as known limitations, not blockers. Phase 2b (reconcile, categorization, approval, compile to Beancount) is cleared to start. Full-suite runs, live bank-file imports, and production evidence remain deferred and out of scope for this gate.
