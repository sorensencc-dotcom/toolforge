"""Process-level Gate-04 evidence driver for Windows/NTFS."""

from __future__ import annotations

import argparse
import ctypes
import json
import multiprocessing as mp
import os
import queue
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "WRAPPERS"))

from governance_runtime import AtomicFileLock, GateError, HashChainLineage, utc_now


def _writer(path: str, count: int, start: Any, results: Any) -> None:
    lineage = HashChainLineage(path)
    failures = []
    start.wait()
    for sequence in range(count):
        try:
            lineage.append("MUTATED", f"PROC-{os.getpid()}", sequence=sequence)
        except Exception as exc:
            failures.append({
                "sequence": sequence,
                "type": type(exc).__name__,
                "code": getattr(exc, "code", None),
                "message": str(exc),
            })
    results.put({"pid": os.getpid(), "failures": failures})


def _hold_lock(lock_path: str, ready: Any, seconds: float) -> None:
    with AtomicFileLock(lock_path, timeout_ms=5000):
        ready.set()
        time.sleep(seconds)


def _partial_writer(path: str) -> None:
    lineage = HashChainLineage(path)
    try:
        lineage.append("MUTATED", f"PROC-{os.getpid()}", _fail_after_bytes=24)
    except GateError:
        os._exit(17)
    os._exit(0)


def _run_batch(path: Path, processes: int, writes_each: int, join_seconds: float = 30) -> dict[str, Any]:
    path.touch(exist_ok=True)
    context = mp.get_context("spawn")
    start = context.Event()
    results = context.Queue()
    workers = [context.Process(target=_writer, args=(str(path), writes_each, start, results)) for _ in range(processes)]
    for worker in workers:
        worker.start()
    started = time.monotonic()
    start.set()
    for worker in workers:
        worker.join(join_seconds)
    elapsed_ms = round((time.monotonic() - started) * 1000, 3)
    hung = [worker.pid for worker in workers if worker.is_alive()]
    for worker in workers:
        if worker.is_alive():
            worker.terminate()
            worker.join(5)
    messages = []
    deadline = time.monotonic() + 3
    while len(messages) < processes and time.monotonic() < deadline:
        try:
            messages.append(results.get(timeout=0.1))
        except queue.Empty:
            pass
    failures = [failure for message in messages for failure in message["failures"]]
    lineage = HashChainLineage(path)
    records = lineage.records()
    return {
        "expected_writes": processes * writes_each,
        "observed_writes": len(records),
        "elapsed_ms": elapsed_ms,
        "worker_messages": len(messages),
        "exit_codes": [worker.exitcode for worker in workers],
        "hung_processes": hung,
        "writer_failures": failures,
        "unique_lineage_ids": len({record["lineage_id"] for record in records}),
        "hash_chain": lineage.verify(),
        "lock_leftover": lineage.lock_path.exists(),
    }


def _filesystem_type(path: Path) -> str:
    if os.name != "nt":
        return "NON_WINDOWS"
    volume = Path(path.anchor or "C:\\")
    fs_name = ctypes.create_unicode_buffer(261)
    volume_name = ctypes.create_unicode_buffer(261)
    serial = ctypes.c_ulong()
    max_component = ctypes.c_ulong()
    flags = ctypes.c_ulong()
    ok = ctypes.windll.kernel32.GetVolumeInformationW(
        str(volume), volume_name, len(volume_name), ctypes.byref(serial),
        ctypes.byref(max_component), ctypes.byref(flags), fs_name, len(fs_name)
    )
    return fs_name.value if ok else "UNKNOWN"


def _case(test_id: str, action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    started = time.monotonic()
    try:
        details = action()
        passed = bool(details.pop("passed"))
        failure = None
    except Exception as exc:
        details = {}
        passed = False
        failure = {"type": type(exc).__name__, "message": str(exc)}
    return {
        "test_id": test_id,
        "outcome": "PASS" if passed else "FAIL",
        "execution_time_ms": round((time.monotonic() - started) * 1000, 3),
        "failure": failure,
        "details": details,
    }


def run(output: Path) -> dict[str, Any]:
    context = mp.get_context("spawn")
    cases = []
    with tempfile.TemporaryDirectory(prefix="gate04-r2-", dir=ROOT / "tests") as temp:
        work = Path(temp)

        def tc001() -> dict[str, Any]:
            path = work / "tc001.jsonl"
            lineage = HashChainLineage(path)
            ready = context.Event()
            holder = context.Process(target=_hold_lock, args=(str(lineage.lock_path), ready, 0.3))
            holder.start()
            if not ready.wait(5):
                raise RuntimeError("holder did not acquire lock")
            started = time.monotonic()
            lineage.append("MUTATED", "CONTENDER")
            wait_ms = round((time.monotonic() - started) * 1000, 3)
            holder.join(5)
            verified = lineage.verify()
            return {"passed": holder.exitcode == 0 and wait_ms >= 200 and verified["valid"], "wait_ms": wait_ms, "holder_exit": holder.exitcode, "hash_chain": verified}

        def tc002() -> dict[str, Any]:
            path = work / "tc002.jsonl"
            lineage = HashChainLineage(path)
            ready = context.Event()
            holder = context.Process(target=_hold_lock, args=(str(lineage.lock_path), ready, 2.4))
            holder.start()
            if not ready.wait(5):
                raise RuntimeError("holder did not acquire lock")
            started = time.monotonic()
            code = None
            try:
                lineage.append("MUTATED", "CONTENDER")
            except GateError as exc:
                code = exc.code
            elapsed_ms = round((time.monotonic() - started) * 1000, 3)
            holder.join(5)
            return {"passed": code == "LINEAGE_CONFLICT" and elapsed_ms <= 2100 and holder.exitcode == 0, "code": code, "elapsed_ms": elapsed_ms, "holder_exit": holder.exitcode}

        def tc003() -> dict[str, Any]:
            path = work / "tc003.jsonl"
            lineage = HashChainLineage(path)
            lineage.lock_path.write_text("stale", encoding="utf-8")
            old = time.time() - 31
            os.utime(lineage.lock_path, (old, old))
            lineage.append("MUTATED", "RECOVERY")
            verified = lineage.verify()
            return {"passed": len(lineage.records()) == 1 and verified["valid"] and not lineage.lock_path.exists(), "hash_chain": verified}

        def tc004() -> dict[str, Any]:
            result = _run_batch(work / "tc004.jsonl", 50, 1)
            result["passed"] = result["observed_writes"] == 50 and result["unique_lineage_ids"] == 50 and result["hash_chain"]["valid"] and not result["hung_processes"] and not result["writer_failures"]
            return result

        def tc005() -> dict[str, Any]:
            path = work / "tc005.jsonl"
            lineage = HashChainLineage(path)
            lineage.append("MUTATED", "BASELINE")
            worker = context.Process(target=_partial_writer, args=(str(path),))
            worker.start()
            worker.join(10)
            quarantine = lineage.repair_partial_tail()
            records = lineage.records()
            verified = lineage.verify()
            return {"passed": worker.exitcode == 17 and quarantine is not None and quarantine.exists() and records[-1]["action"] == "CORRUPT_RECORD" and verified["valid"], "worker_exit": worker.exitcode, "quarantine": quarantine.name if quarantine else None, "hash_chain": verified}

        def tc006() -> dict[str, Any]:
            lineage = HashChainLineage(work / "tc006.jsonl")
            for _ in range(100):
                lineage.append("MUTATED", "SEQUENTIAL")
            verified = lineage.verify()
            return {"passed": verified["valid"] and verified["count"] == 100, "hash_chain": verified}

        def tc007() -> dict[str, Any]:
            lineage = HashChainLineage(work / "tc007.jsonl")
            for _ in range(100):
                lineage.append("MUTATED", "BASELINE")
            rows = lineage.records()
            rows[49]["actor"] = "CORRUPTED"
            lineage.path.write_text("".join(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n" for row in rows), encoding="utf-8")
            verified = lineage.verify()
            return {"passed": not verified["valid"] and verified["corrupt_record"] == 50, "hash_chain": verified}

        def tc008() -> dict[str, Any]:
            result = _run_batch(work / "tc008.jsonl", 10, 10)
            result["passed"] = result["observed_writes"] == 100 and result["unique_lineage_ids"] == 100 and result["hash_chain"]["valid"] and not result["hung_processes"] and not result["writer_failures"]
            return result

        for test_id, action in [
            ("TC-04-001", tc001), ("TC-04-002", tc002), ("TC-04-003", tc003), ("TC-04-004", tc004),
            ("TC-04-005", tc005), ("TC-04-006", tc006), ("TC-04-007", tc007), ("TC-04-008", tc008),
        ]:
            cases.append(_case(test_id, action))

    passed = sum(case["outcome"] == "PASS" for case in cases)
    result = {
        "driver_version": "1.0.0-candidate.1",
        "gate_id": "GATE-04",
        "executed_at": utc_now(),
        "environment": {
            "platform": sys.platform,
            "python": sys.version.split()[0],
            "filesystem": _filesystem_type(ROOT),
            "root": str(ROOT).replace("\\", "/"),
        },
        "cases": cases,
        "total": len(cases),
        "passed": passed,
        "failed": len(cases) - passed,
        "overall_result": "PASS" if passed == len(cases) else "FAIL",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    temp_output = output.with_suffix(output.suffix + ".tmp")
    temp_output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_output, output)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.output)
    print(json.dumps({"gate_id": result["gate_id"], "result": result["overall_result"], "passed": result["passed"], "failed": result["failed"]}))
    return 0 if result["overall_result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
