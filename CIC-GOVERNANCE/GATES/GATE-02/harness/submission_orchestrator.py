"""Fail-closed Gate-02 R2 submission orchestration."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "WRAPPERS"))

from governance_runtime import HashChainLineage, utc_now


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(report_path: Path, actor: str) -> tuple[dict, list[str]]:
    findings = []
    report_text = report_path.read_text(encoding="utf-8")
    report = json.loads(report_text)
    registry = json.loads((ROOT / "WRAPPERS" / "actor-registry.json").read_text(encoding="utf-8"))
    actor_row = registry.get(actor)
    if not actor_row or actor_row.get("state") != "ACTIVE":
        findings.append("ACTOR_UNREGISTERED")
    if report.get("gate_id") != "GATE-02" or report.get("report_id") != "CIC-TEST-REPORT-GATE-02-R2":
        findings.append("REPORT_ID_INVALID")
    if report.get("overall_result") != "PASS" or report.get("passed") != 8 or report.get("failed") != 0:
        findings.append("R2_EVIDENCE_INCOMPLETE")
    if not report.get("_submission_ready"):
        findings.append("REPORT_NOT_SUBMISSION_READY")
    if report.get("submitted_for_ratification"):
        findings.append("REPORT_ALREADY_SUBMITTED")
    if "FILL_IN" in report_text:
        findings.append("REPORT_PLACEHOLDERS_PRESENT")
    gates = json.loads((ROOT / "MANIFEST" / "gate-registry.json").read_text(encoding="utf-8"))["gates"]
    if gates["GATE-02"]["status"] != "OPEN":
        findings.append("GATE_NOT_OPEN")
    return report, findings


def _atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def submit(report_path: Path, actor: str, amendment_id: str, confirmation_path: Path) -> dict:
    report, findings = validate(report_path, actor)
    if findings:
        raise RuntimeError(";".join(findings))
    lineage = HashChainLineage(ROOT / "LINEAGE" / "CIC-Lineage-v2.4.jsonl")
    artifact_store = ROOT / "artifacts"
    artifact_store.mkdir(parents=True, exist_ok=True)
    artifact = artifact_store / f"{report['report_id']}.json"
    existed = artifact.exists()
    backup = artifact.read_bytes() if existed else None
    temporary = artifact.with_suffix(".tmp")
    transaction_id = f"TX-{hashlib.sha256((report['report_id'] + utc_now()).encode()).hexdigest()[:32]}"
    ingested = None
    try:
        shutil.copyfile(report_path, temporary)
        os.replace(temporary, artifact)
        ingested = lineage.append(
            "INGESTED", actor, report["report_id"], transaction_id=transaction_id,
            report_hash=_hash(artifact), gate_id="GATE-02"
        )
        confirmed = lineage.append(
            "CONFIRMED", actor, report["report_id"], transaction_id=transaction_id,
            parent_lineage_id=ingested["lineage_id"], amendment_id=amendment_id
        )
        submitted_at = utc_now()
        report["submitted_for_ratification"] = submitted_at
        _atomic_json(report_path, report)
        amendment = {
            "amendment_id": amendment_id,
            "title": "GATE-02 closure - Publication and Retries",
            "status": "PROPOSED",
            "submitted_date": submitted_at[:10],
            "ratified_date": None,
            "submitted_by": actor,
            "ratified_by": None,
            "affected_sections": ["CIC-GATE-SPEC-001 section 4", "MANIFEST/gate-registry.json"],
            "change_summary": "Propose GATE-02 closure after deterministic R2 passed 8/8.",
            "breaking_change": False,
            "linked_lineage_id": confirmed["lineage_id"],
            "linked_report_id": report["report_id"],
        }
        _atomic_json(ROOT / "AMENDMENTS" / f"{amendment_id}.draft.json", amendment)
        confirmation = {
            "status": "SUBMITTED_FOR_RATIFICATION",
            "gate_id": "GATE-02",
            "gate_state": "OPEN",
            "report_id": report["report_id"],
            "report_result": report["overall_result"],
            "amendment_id": amendment_id,
            "amendment_status": "PROPOSED",
            "actor": actor,
            "transaction_id": transaction_id,
            "ingested_lineage_id": ingested["lineage_id"],
            "confirmed_lineage_id": confirmed["lineage_id"],
            "lineage_tail_hash": lineage.tail_hash(),
            "submitted_at": submitted_at,
        }
        _atomic_json(confirmation_path, confirmation)
        return confirmation
    except Exception as exc:
        temporary.unlink(missing_ok=True)
        if backup is None:
            artifact.unlink(missing_ok=True)
        else:
            artifact.write_bytes(backup)
        quarantine = lineage.repair_partial_tail()
        lineage.append(
            "ROLLBACK", actor, report.get("report_id"), transaction_id=transaction_id,
            failure_reason=str(exc), ingested_lineage_id=ingested["lineage_id"] if ingested else None,
            quarantine=str(quarantine) if quarantine else None
        )
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate")
    submit_parser = subparsers.add_parser("submit")
    for command_parser in (validate_parser, submit_parser):
        command_parser.add_argument("--report", type=Path, required=True)
        command_parser.add_argument("--actor", required=True)
    submit_parser.add_argument("--amendment", required=True)
    submit_parser.add_argument("--confirmation", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "validate":
        report, findings = validate(args.report, args.actor)
        print(json.dumps({"report_id": report.get("report_id"), "valid": not findings, "findings": findings}))
        return 0 if not findings else 1
    confirmation = submit(args.report, args.actor, args.amendment, args.confirmation)
    print(json.dumps(confirmation))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
