"""CIC governance validation candidate. Not active without Tier 1 ratification."""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SPEC_VERSION = "2.4.0"
ARTIFACT_ID = re.compile(r"^ART-[0-9]{8}-[0-9]{4}$")
SEMVER = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
ACTIONS = {"INGEST", "UPDATE", "DEPRECATE", "RETIRE"}
LINEAGE_ACTION = {"INGEST": "INGESTED", "UPDATE": "UPDATED", "DEPRECATE": "DEPRECATED", "RETIRE": "RETIRED"}
REQUIRED = {"artifact_id", "artifact_version", "spec_version", "source_hash", "actor", "action", "payload", "timestamp"}
ALLOWED = REQUIRED | {"parent_artifact_id", "tags", "notes"}


class GovernanceViolation(ValueError):
    def __init__(self, status_code: int, code: str, findings: list[str]):
        super().__init__(f"{code}: {'; '.join(findings)}")
        self.status_code = status_code
        self.code = code
        self.findings = findings


def canonical_payload(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def payload_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_payload(payload)).hexdigest()


def parse_timestamp(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("timestamp must be string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed


@dataclass(frozen=True)
class LineageRecord:
    lineage_id: str
    timestamp: str
    artifact_id: str
    artifact_version: str
    action: str
    actor: str
    spec_version: str
    parent_lineage_id: str | None
    hash: str
    notes: str = ""


class LineageStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(exist_ok=True)

    def records(self) -> list[dict[str, Any]]:
        result = []
        with self.path.open("r", encoding="utf-8") as handle:
            for number, line in enumerate(handle, 1):
                if line.strip():
                    try:
                        result.append(json.loads(line))
                    except json.JSONDecodeError as exc:
                        raise GovernanceViolation(500, "LINEAGE_CORRUPT", [f"line {number}: {exc.msg}"]) from exc
        return result

    def find_artifact(self, artifact_id: str) -> dict[str, Any] | None:
        return next((r for r in reversed(self.records()) if r["artifact_id"] == artifact_id), None)

    def append(self, record: LineageRecord) -> None:
        existing = self.records()
        if any(r["lineage_id"] == record.lineage_id for r in existing):
            raise GovernanceViolation(409, "LINEAGE_CONFLICT", ["duplicate lineage_id"])
        encoded = json.dumps(asdict(record), sort_keys=True, separators=(",", ":")) + "\n"
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())


class GovernanceEngine:
    def __init__(self, lineage: LineageStore, registered_actors: Iterable[str]):
        self.lineage = lineage
        self.registered_actors = frozenset(registered_actors)

    def validate(self, submission: dict[str, Any]) -> None:
        findings: list[str] = []
        missing = sorted(REQUIRED - submission.keys())
        extra = sorted(submission.keys() - ALLOWED)
        if missing: findings.append(f"missing fields: {', '.join(missing)}")
        if extra: findings.append(f"unknown fields: {', '.join(extra)}")
        if findings: raise GovernanceViolation(400, "SCHEMA_INVALID", findings)

        if not ARTIFACT_ID.fullmatch(str(submission["artifact_id"])): findings.append("artifact_id format invalid")
        if not SEMVER.fullmatch(str(submission["artifact_version"])): findings.append("artifact_version must be strict semver")
        if submission["spec_version"] != SPEC_VERSION: findings.append("spec_version must equal 2.4.0")
        if submission["action"] not in ACTIONS: findings.append("action invalid")
        if not isinstance(submission["payload"], dict): findings.append("payload must be object")
        if not isinstance(submission["actor"], str) or not submission["actor"].strip(): findings.append("actor must be non-empty")
        if not SHA256.fullmatch(str(submission["source_hash"])): findings.append("source_hash format invalid")
        if isinstance(submission.get("tags", []), list) and len(submission.get("tags", [])) > 10: findings.append("tags exceeds 10")
        if not isinstance(submission.get("tags", []), list): findings.append("tags must be array")
        if len(str(submission.get("notes", ""))) > 1000: findings.append("notes exceeds 1000 characters")
        try: parse_timestamp(submission["timestamp"])
        except (TypeError, ValueError): findings.append("timestamp must be ISO-8601 with timezone")
        if submission["action"] == "DEPRECATE" and not submission.get("parent_artifact_id"):
            findings.append("DEPRECATE requires parent_artifact_id")
        if isinstance(submission["payload"], dict) and payload_hash(submission["payload"]) != submission["source_hash"]:
            findings.append("source_hash does not match canonical payload")
        if findings: raise GovernanceViolation(400, "SCHEMA_INVALID", findings)

        if submission["actor"] not in self.registered_actors:
            raise GovernanceViolation(403, "ACTOR_UNREGISTERED", [submission["actor"]])

        if submission["action"] in {"UPDATE", "DEPRECATE", "RETIRE"}:
            parent = submission.get("parent_artifact_id")
            if not parent or not self.lineage.find_artifact(parent):
                raise GovernanceViolation(409, "LINEAGE_CONFLICT", ["parent artifact not found"])

    def ingest(self, submission: dict[str, Any]) -> dict[str, Any]:
        self.validate(submission)
        existing = self.lineage.records()
        parent = self.lineage.find_artifact(submission.get("parent_artifact_id", ""))
        now = datetime.now(timezone.utc)
        record = LineageRecord(
            lineage_id=f"LIN-{now:%Y%m%d}-{len(existing)+1:04d}",
            timestamp=now.isoformat().replace("+00:00", "Z"),
            artifact_id=submission["artifact_id"], artifact_version=submission["artifact_version"],
            action=LINEAGE_ACTION[submission["action"]], actor=submission["actor"],
            spec_version=SPEC_VERSION, parent_lineage_id=parent["lineage_id"] if parent else None,
            hash=submission["source_hash"], notes=submission.get("notes", ""),
        )
        self.lineage.append(record)
        return {"status_code": 200, "code": "ACCEPTED", "lineage_id": record.lineage_id}


if __name__ == "__main__":
    raise SystemExit("Library candidate. Import GovernanceEngine; no active service entrypoint.")
