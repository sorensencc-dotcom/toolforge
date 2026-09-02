"""Deterministic Gate-02 publication evidence driver."""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "WRAPPERS"))

from governance_runtime import ArtifactStore, HashChainLineage, Publisher, utc_now


def _filesystem_type(path: Path) -> str:
    if os.name != "nt": return "NON_WINDOWS"
    fs_name=ctypes.create_unicode_buffer(261); volume_name=ctypes.create_unicode_buffer(261)
    serial=ctypes.c_ulong(); max_component=ctypes.c_ulong(); flags=ctypes.c_ulong()
    ok=ctypes.windll.kernel32.GetVolumeInformationW(str(Path(path.anchor or "C:\\")),volume_name,len(volume_name),ctypes.byref(serial),ctypes.byref(max_component),ctypes.byref(flags),fs_name,len(fs_name))
    return fs_name.value if ok else "UNKNOWN"


def _case(test_id: str, action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    started=time.monotonic()
    try:
        details=action(); passed=bool(details.pop("passed")); failure=None
    except Exception as exc:
        details={}; passed=False; failure={"type":type(exc).__name__,"message":str(exc)}
    return {"test_id":test_id,"outcome":"PASS" if passed else "FAIL","execution_time_ms":round((time.monotonic()-started)*1000,3),"failure":failure,"details":details}


def run(output: Path) -> dict[str, Any]:
    cases=[]
    with tempfile.TemporaryDirectory(prefix="gate02-r2-",dir=ROOT/"tests") as temp:
        work=Path(temp)

        def tc001():
            lineage=HashChainLineage(work/"tc001.jsonl"); received=[]
            publisher=Publisher(lineage,{"consumer":lambda artifact,payload:received.append((artifact,payload))},delays=(0,),sleep=lambda _:None)
            result=publisher.publish("ART-02-001",{"value":1},"LIN-PARENT")
            return {"passed":result["status"]=="PUBLISHED" and received==[("ART-02-001",{"value":1})] and publisher.get_artifact_state("ART-02-001")=="PUBLISHED","result":result,"received":len(received)}

        def tc002():
            lineage=HashChainLineage(work/"tc002.jsonl"); store=ArtifactStore(work/"store",lineage)
            store.commit("ART-02-002",{"value":2},"ACTOR"); before=store.path_for("ART-02-002").read_bytes()
            publisher=Publisher(lineage,{"consumer":lambda *_:(_ for _ in ()).throw(RuntimeError("down"))},sleep=lambda _:None)
            result=publisher.publish("ART-02-002",{"value":2},"LIN-PARENT"); after=store.path_for("ART-02-002").read_bytes()
            return {"passed":result["status"]=="PUBLICATION_FAILED" and before==after,"artifact_hash":hashlib.sha256(after).hexdigest(),"attempts":len([r for r in lineage.records() if r["action"]=="PUBLICATION_EVENT"])}

        def tc003():
            lineage=HashChainLineage(work/"tc003.jsonl"); sleeps=[]
            Publisher(lineage,{"consumer":lambda *_:(_ for _ in ()).throw(RuntimeError("down"))},sleep=sleeps.append).publish("ART-02-003",{},"LIN-PARENT")
            return {"passed":sleeps==[0,5,25,125,600],"scheduled_delays":sleeps}

        def tc004():
            lineage=HashChainLineage(work/"tc004.jsonl")
            publisher=Publisher(lineage,{"consumer":lambda *_:(_ for _ in ()).throw(RuntimeError("down"))},sleep=lambda _:None)
            publisher.publish("ART-02-004",{},"LIN-PARENT"); events=lineage.records()
            passed=publisher.get_artifact_state("ART-02-004")=="PUBLICATION_FAILED" and len(events)==5 and all(e["details"]["parent_lineage_id"]=="LIN-PARENT" and e["details"]["outcome"]=="FAILURE" for e in events)
            return {"passed":passed,"state":publisher.get_artifact_state("ART-02-004"),"events":len(events),"attempts":[e["details"]["attempt"] for e in events]}

        def tc005():
            lineage=HashChainLineage(work/"tc005.jsonl"); available={"value":False}; received=[]
            def consumer(artifact,payload):
                if not available["value"]: raise RuntimeError("down")
                received.append(artifact)
            publisher=Publisher(lineage,{"consumer":consumer},delays=(0,),sleep=lambda _:None)
            first=publisher.publish("ART-02-005",{},"LIN-PARENT"); available["value"]=True; second=publisher.republish("ART-02-005")
            events=lineage.records()
            return {"passed":first["status"]=="PUBLICATION_FAILED" and second["status"]=="PUBLISHED" and received==["ART-02-005"] and all(e["details"]["parent_lineage_id"]=="LIN-PARENT" for e in events),"first":first["status"],"second":second["status"],"events":len(events)}

        def tc006():
            lineage=HashChainLineage(work/"tc006.jsonl"); received=[]
            publisher=Publisher(lineage,{"consumer":lambda artifact,payload:received.append(artifact)},delays=(0,),sleep=lambda _:None)
            publisher.publish("ART-02-006",{},"LIN-PARENT"); publisher.publish("ART-02-006",{},"LIN-PARENT")
            return {"passed":received==["ART-02-006"] and len(lineage.records())==1,"consumer_deliveries":len(received),"events":len(lineage.records())}

        def tc007():
            lineage=HashChainLineage(work/"tc007.jsonl"); delivered=threading.Event(); release=threading.Event(); times={}
            def bad(*_): release.wait(0.5); raise RuntimeError("down")
            def good(*_): times["good_ms"]=(time.monotonic()-started)*1000; delivered.set()
            publisher=Publisher(lineage,{"bad":bad,"good":good},delays=(0,),sleep=lambda _:None); started=time.monotonic()
            result=publisher.publish("ART-02-007",{},"LIN-PARENT"); release.set()
            return {"passed":delivered.is_set() and times.get("good_ms",1000)<250 and result["status"]=="PUBLICATION_FAILED","good_delivery_ms":round(times.get("good_ms",-1),3),"failed_consumers":result["failed_consumers"]}

        def tc008():
            lineage=HashChainLineage(work/"tc008.jsonl")
            Publisher(lineage,{"consumer":lambda *_:None},delays=(0,),sleep=lambda _:None).publish("ART-02-008",{},"LIN-PARENT")
            event=lineage.records()[0]; details=event["details"]
            required={"parent_lineage_id","consumer_id","attempt","outcome","failure_reason"}
            return {"passed":event["action"]=="PUBLICATION_EVENT" and required<=details.keys() and details["parent_lineage_id"]=="LIN-PARENT","event":event}

        actions=[tc001,tc002,tc003,tc004,tc005,tc006,tc007,tc008]
        cases=[_case(f"TC-02-{index:03d}",action) for index,action in enumerate(actions,1)]

    passed=sum(case["outcome"]=="PASS" for case in cases)
    result={"driver_version":"1.0.0-candidate.1","gate_id":"GATE-02","executed_at":utc_now(),"environment":{"platform":sys.platform,"python":sys.version.split()[0],"filesystem":_filesystem_type(ROOT),"root":str(ROOT).replace("\\","/")},"cases":cases,"total":8,"passed":passed,"failed":8-passed,"overall_result":"PASS" if passed==8 else "FAIL"}
    output.parent.mkdir(parents=True,exist_ok=True); temporary=output.with_suffix(output.suffix+".tmp")
    temporary.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8"); os.replace(temporary,output)
    return result


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("--output",type=Path,required=True); args=parser.parse_args()
    result=run(args.output); print(json.dumps({"gate_id":result["gate_id"],"result":result["overall_result"],"passed":result["passed"],"failed":result["failed"]})); return 0 if result["overall_result"]=="PASS" else 1


if __name__=="__main__": raise SystemExit(main())
