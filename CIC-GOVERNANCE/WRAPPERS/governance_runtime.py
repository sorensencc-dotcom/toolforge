"""Candidate gate mechanics. No activation authority."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


class GateError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}"); self.code = code


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class _LocalTicketLock:
    """Fair admission for threads before cross-process file-lock contention."""

    def __init__(self):
        self.condition = threading.Condition()
        self.next_ticket = 0
        self.serving = 0
        self.cancelled: set[int] = set()

    def acquire(self, deadline: float) -> int:
        with self.condition:
            ticket = self.next_ticket
            self.next_ticket += 1
            while ticket != self.serving:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    self.cancelled.add(ticket)
                    self.condition.notify_all()
                    raise GateError("LINEAGE_CONFLICT", "lock acquisition timeout")
                self.condition.wait(remaining)
            return ticket

    def release(self, ticket: int) -> None:
        with self.condition:
            if ticket != self.serving:
                raise RuntimeError("local ticket lock released out of order")
            self.serving += 1
            while self.serving in self.cancelled:
                self.cancelled.remove(self.serving)
                self.serving += 1
            self.condition.notify_all()


_LOCAL_LOCKS_GUARD = threading.Lock()
_LOCAL_LOCKS: dict[str, _LocalTicketLock] = {}


def _local_lock_for(path: Path) -> _LocalTicketLock:
    key = str(path.resolve()).casefold()
    with _LOCAL_LOCKS_GUARD:
        return _LOCAL_LOCKS.setdefault(key, _LocalTicketLock())


class AtomicFileLock:
    def __init__(self, path: str | Path, timeout_ms: int = 2000, stale_seconds: float = 30):
        self.path = Path(path); self.timeout_ms = timeout_ms; self.stale_seconds = stale_seconds; self.owned = False
        self.local_lock = _local_lock_for(self.path); self.local_ticket: int | None = None

    def acquire(self) -> None:
        deadline = time.monotonic() + self.timeout_ms / 1000
        try:
            self.local_ticket = self.local_lock.acquire(deadline)
            while True:
                try:
                    fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                    os.write(fd, canonical({"pid": os.getpid(), "created": time.time()})); os.close(fd)
                    self.owned = True; return
                except (FileExistsError, PermissionError):
                    try:
                        if time.time() - self.path.stat().st_mtime > self.stale_seconds:
                            self.path.unlink(missing_ok=True); continue
                    except FileNotFoundError:
                        continue
                    if time.monotonic() >= deadline:
                        raise GateError("LINEAGE_CONFLICT", "lock acquisition timeout")
                    time.sleep(0.01)
        except Exception:
            if self.local_ticket is not None:
                self.local_lock.release(self.local_ticket); self.local_ticket = None
            raise

    def release(self) -> None:
        if self.owned:
            try:
                self.path.unlink(missing_ok=True)
            finally:
                self.owned = False
                if self.local_ticket is not None:
                    self.local_lock.release(self.local_ticket); self.local_ticket = None

    def __enter__(self): self.acquire(); return self
    def __exit__(self, *_): self.release()


class HashChainLineage:
    def __init__(self, path: str | Path, timeout_ms: int = 2000, stale_seconds: float = 30):
        self.path = Path(path); self.path.parent.mkdir(parents=True, exist_ok=True); self.path.touch(exist_ok=True)
        self.lock_path = self.path.with_suffix(self.path.suffix + ".lock")
        self.timeout_ms = timeout_ms; self.stale_seconds = stale_seconds

    def records(self) -> list[dict[str, Any]]:
        rows=[]
        for number,line in enumerate(self.path.read_text(encoding="utf-8").splitlines(),1):
            if not line: continue
            try: rows.append(json.loads(line))
            except json.JSONDecodeError as exc: raise GateError("LINEAGE_CORRUPT", f"line {number}: {exc.msg}") from exc
        return rows

    def tail_hash(self) -> str:
        rows=self.records(); return rows[-1]["record_hash"] if rows else "0"*64

    def append(self, action: str, actor: str, artifact_id: str | None = None, _fail_after_bytes: int | None = None, **details: Any) -> dict[str, Any]:
        with AtomicFileLock(self.lock_path, self.timeout_ms, self.stale_seconds):
            rows=self.records(); previous=rows[-1]["record_hash"] if rows else "0"*64
            record={"lineage_id":f"LIN-{uuid.uuid4().hex}","timestamp":utc_now(),"action":action,
                    "actor":actor,"artifact_id":artifact_id,"previous_hash":previous,"details":details}
            record["record_hash"]=digest(canonical(record))
            encoded=(json.dumps(record,sort_keys=True,separators=(",", ":"))+"\n").encode("utf-8")
            if _fail_after_bytes is not None:
                with self.path.open("ab") as handle:
                    handle.write(encoded[:_fail_after_bytes]); handle.flush(); os.fsync(handle.fileno())
                raise GateError("INJECTED_FAILURE","mid-lineage write")
            with self.path.open("ab") as handle:
                handle.write(encoded); handle.flush(); os.fsync(handle.fileno())
            return record

    def verify(self) -> dict[str, Any]:
        previous="0"*64
        for index,record in enumerate(self.records(),1):
            stored=record.get("record_hash"); candidate=dict(record); candidate.pop("record_hash",None)
            if record.get("previous_hash") != previous or digest(canonical(candidate)) != stored:
                return {"valid":False,"corrupt_record":index}
            previous=stored
        return {"valid":True,"count":len(self.records()),"tail_hash":previous}

    def repair_partial_tail(self) -> Path | None:
        """Quarantine only invalid trailing bytes; preserve every valid record."""
        quarantine = None; corrupt = None
        with AtomicFileLock(self.lock_path, self.timeout_ms, self.stale_seconds):
            raw=self.path.read_bytes(); offset=0
            for line in raw.splitlines(keepends=True):
                try: json.loads(line)
                except json.JSONDecodeError:
                    corrupt=raw[offset:]; quarantine=self.path.with_suffix(self.path.suffix+f".corrupt-{uuid.uuid4().hex}")
                    quarantine.write_bytes(corrupt); self.path.write_bytes(raw[:offset])
                    break
                offset += len(line)
        if quarantine is not None:
            self.append("CORRUPT_RECORD","lineage-repair",quarantine=str(quarantine),corrupt_hash=digest(corrupt))
        return quarantine


class ArtifactStore:
    def __init__(self, root: str | Path, lineage: HashChainLineage):
        self.root=Path(root); self.root.mkdir(parents=True,exist_ok=True); self.lineage=lineage

    def path_for(self, artifact_id: str) -> Path: return self.root / f"{artifact_id}.json"
    def get(self, artifact_id: str) -> dict[str, Any]: return json.loads(self.path_for(artifact_id).read_text(encoding="utf-8"))
    def snapshot_hash(self) -> str:
        payload=[]
        for path in sorted(self.root.glob("*.json")): payload.append((path.name,path.read_bytes().hex()))
        return digest(canonical(payload))

    def commit(self, artifact_id: str, payload: dict[str, Any], actor: str, fail_at: str | None=None) -> dict[str, Any]:
        tx=f"TX-{uuid.uuid4().hex}"; target=self.path_for(artifact_id); temp=target.with_suffix(".tmp")
        existed=target.exists(); backup=target.read_bytes() if existed else None; start=time.monotonic()
        try:
            temp.write_bytes(canonical(payload)); os.replace(temp,target)
            if fail_at == "after_artifact": raise GateError("INJECTED_FAILURE","after artifact write")
            record=self.lineage.append("INGESTED",actor,artifact_id,_fail_after_bytes=24 if fail_at=="mid_lineage" else None,transaction_id=tx,artifact_hash=digest(target.read_bytes()))
            return {"transaction_id":tx,"lineage_id":record["lineage_id"],"elapsed_ms":(time.monotonic()-start)*1000}
        except Exception as exc:
            temp.unlink(missing_ok=True)
            if backup is None: target.unlink(missing_ok=True)
            else: target.write_bytes(backup)
            if fail_at == "mid_lineage": self.lineage.repair_partial_tail()
            self.lineage.append("ROLLBACK",actor,artifact_id,transaction_id=tx,failure_reason=str(exc))
            raise


class ActorRegistry:
    TRANSITIONS={"PENDING":"ACTIVE","ACTIVE":"SUSPENDED","SUSPENDED":"RETIRED"}
    def __init__(self,path: str|Path,lineage: HashChainLineage,bootstrap_hash: str|None=None):
        self.path=Path(path); self.lineage=lineage; self.bootstrap_hash=bootstrap_hash
        if not self.path.exists(): self.path.write_bytes(canonical({}))
        self._data=json.loads(self.path.read_text(encoding="utf-8"))
    def _load(self): return self._data
    def _save(self,data):
        temp=self.path.with_suffix(".tmp"); temp.write_bytes(canonical(data)); os.replace(temp,self.path); self._data=data
    def get(self,actor_id): return self._load().get(actor_id)
    def register(self,actor_id,display_name,actor_type,operator,bootstrap=None):
        import re
        if not re.fullmatch(r"ACT-[0-9]{8}-[0-9]{4}",actor_id): raise GateError("ACTOR_INVALID","actor_id format")
        data=self._load()
        if actor_id in data: raise GateError("ACTOR_EXISTS",actor_id)
        operator_row=data.get(operator); boot_ok=bootstrap and self.bootstrap_hash==digest(bootstrap.encode())
        if not boot_ok and (not operator_row or operator_row["state"]!="ACTIVE"): raise GateError("ACTOR_UNREGISTERED",operator)
        data[actor_id]={"actor_id":actor_id,"display_name":display_name,"actor_type":actor_type,"state":"PENDING","registered_by":operator}
        self._save(data); self.lineage.append("MUTATED",operator,details_type="ACTOR_REGISTERED",target_actor_id=actor_id); return data[actor_id]
    def transition(self,actor_id,state,operator,bootstrap=None):
        data=self._load(); row=data.get(actor_id)
        operator_row=data.get(operator); boot_ok=bootstrap and self.bootstrap_hash==digest(bootstrap.encode())
        if not boot_ok and (not operator_row or operator_row["state"]!="ACTIVE"): raise GateError("ACTOR_UNREGISTERED",operator)
        if not row or self.TRANSITIONS.get(row["state"])!=state: raise GateError("ACTOR_TRANSITION_INVALID",f"{actor_id} -> {state}")
        row["state"]=state; self._save(data); self.lineage.append("MUTATED",operator,details_type="ACTOR_STATE",target_actor_id=actor_id,state=state)
    def is_active(self,actor_id): return bool(self.get(actor_id) and self.get(actor_id)["state"]=="ACTIVE")
    def export(self): return list(self._load().values())
    def rotate_bootstrap(self,old,new):
        if self.bootstrap_hash!=digest(old.encode()): raise GateError("BOOTSTRAP_INVALID","old credential")
        self.bootstrap_hash=digest(new.encode())


class Publisher:
    def __init__(self,lineage:HashChainLineage,consumers:dict[str,Callable[[str,dict],None]],delays=(0,5,25,125,600),sleep=time.sleep):
        self.lineage=lineage; self.consumers=consumers; self.delays=delays; self.sleep=sleep; self.failed={}; self.delivered=set(); self.state_lock=threading.Lock()
    def _publish_consumer(self,cid,consumer,artifact_id,payload,parent_lineage_id):
        with self.state_lock:
            if (artifact_id,cid) in self.delivered: return True
        delivered=False
        for attempt,delay in enumerate(self.delays,1):
            self.sleep(delay)
            try:
                consumer(artifact_id,payload); outcome="SUCCESS"; reason=None; delivered=True
            except Exception as exc: outcome="FAILURE"; reason=str(exc)
            self.lineage.append("PUBLICATION_EVENT","governance-publisher",artifact_id,parent_lineage_id=parent_lineage_id,consumer_id=cid,attempt=attempt,outcome=outcome,failure_reason=reason)
            if delivered:
                with self.state_lock: self.delivered.add((artifact_id,cid))
                break
        return delivered
    def publish(self,artifact_id,payload,parent_lineage_id):
        pending=[]
        with self.state_lock:
            for cid,consumer in self.consumers.items():
                if (artifact_id,cid) not in self.delivered: pending.append((cid,consumer))
        with ThreadPoolExecutor(max_workers=max(1,len(pending))) as pool:
            results={cid:pool.submit(self._publish_consumer,cid,consumer,artifact_id,payload,parent_lineage_id) for cid,consumer in pending}
            failures=[cid for cid,future in results.items() if not future.result()]
        with self.state_lock:
            if failures: self.failed[artifact_id]={"payload":payload,"parent_lineage_id":parent_lineage_id,"consumers":failures}
        return {"status":"PUBLICATION_FAILED" if failures else "PUBLISHED","failed_consumers":failures}
    def republish(self,artifact_id):
        row=self.failed[artifact_id]; result=self.publish(artifact_id,row["payload"],row["parent_lineage_id"])
        if result["status"]=="PUBLISHED": self.failed.pop(artifact_id,None)
        return result
    def get_artifact_state(self,artifact_id):
        with self.state_lock:
            if artifact_id in self.failed: return "PUBLICATION_FAILED"
            if any(aid==artifact_id for aid,_ in self.delivered): return "PUBLISHED"
        return "UNKNOWN"


class ActivationController:
    REQUIRED={f"AMD-v2.4.0-GATE-0{i}-CLOSED" for i in range(1,5)}
    def __init__(self,gate_path,amendment_path,lineage:HashChainLineage,actors:ActorRegistry,status_path):
        self.gate_path=Path(gate_path); self.amendment_path=Path(amendment_path); self.lineage=lineage; self.actors=actors; self.status_path=Path(status_path)
    def validate(self,declaration):
        gates=json.loads(self.gate_path.read_text())["gates"]
        if any(gates[f"GATE-0{i}"]["status"]!="CLOSED" for i in range(1,5)): raise GateError("GATES_OPEN","GATE-01 through GATE-04 must close")
        amendments=json.loads(self.amendment_path.read_text()).get("amendments",[])
        ratified={a["amendment_id"] for a in amendments if a.get("status")=="RATIFIED"}
        if not self.REQUIRED <= ratified: raise GateError("AMENDMENTS_INCOMPLETE","four ratified closures required")
        if set(declaration.get("gate_closure_references",[]))!=self.REQUIRED: raise GateError("DECLARATION_INVALID","closure references")
        if declaration.get("lineage_tail_hash")!=self.lineage.tail_hash(): raise GateError("LINEAGE_CONFLICT","tail hash mismatch")
        if not self.actors.is_active(declaration.get("declared_by")): raise GateError("ACTOR_UNREGISTERED","declarer must be ACTIVE")
    def activate(self,declaration):
        self.validate(declaration)
        record=self.lineage.append("ACTIVATED",declaration["declared_by"],declaration_id=declaration["declaration_id"])
        self.status_path.write_bytes(canonical({"status":"OPERATIONAL","activation_lineage_id":record["lineage_id"]}))
        return record
