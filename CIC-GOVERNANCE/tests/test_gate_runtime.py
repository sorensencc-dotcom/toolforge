import importlib.util
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

ROOT=Path(__file__).parents[1]; PATH=ROOT/"WRAPPERS"/"governance_runtime.py"
spec=importlib.util.spec_from_file_location("cic_gate_runtime",PATH); rt=importlib.util.module_from_spec(spec); sys.modules[spec.name]=rt; spec.loader.exec_module(rt)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); self.lineage=rt.HashChainLineage(self.root/"lineage.jsonl",timeout_ms=2000,stale_seconds=30)
    def tearDown(self): self.tmp.cleanup()


class Gate01TransactionTests(Base):
    def setUp(self): super().setUp(); self.store=rt.ArtifactStore(self.root/"artifacts",self.lineage)
    def test_clean_commit(self):
        result=self.store.commit("ART-1",{"x":1},"ACT-1"); self.assertEqual({"x":1},self.store.get("ART-1")); self.assertTrue(result["transaction_id"].startswith("TX-"))
    def test_rollback_removes_new_artifact(self):
        before=self.store.snapshot_hash()
        with self.assertRaises(rt.GateError): self.store.commit("ART-1",{"x":1},"ACT-1",fail_at="after_artifact")
        self.assertEqual(before,self.store.snapshot_hash())
    def test_rollback_restores_existing_bytes(self):
        self.store.commit("ART-1",{"x":1},"ACT-1"); before=self.store.path_for("ART-1").read_bytes()
        with self.assertRaises(rt.GateError): self.store.commit("ART-1",{"x":2},"ACT-1",fail_at="after_artifact")
        self.assertEqual(before,self.store.path_for("ART-1").read_bytes())
    def test_rollback_has_no_ingested_for_failed_artifact(self):
        with self.assertRaises(rt.GateError): self.store.commit("ART-X",{},"ACT-1",fail_at="after_artifact")
        self.assertEqual(["ROLLBACK"],[r["action"] for r in self.lineage.records()])
    def test_mid_lineage_write_rollback(self):
        before=self.store.snapshot_hash()
        with self.assertRaises(rt.GateError): self.store.commit("ART-MID",{"x":1},"ACT-1",fail_at="mid_lineage")
        rows=self.lineage.records(); actions=[r["action"] for r in rows]
        self.assertEqual(before,self.store.snapshot_hash())
        self.assertNotIn("INGESTED",actions)
        self.assertEqual(["CORRUPT_RECORD","ROLLBACK"],actions)
        self.assertTrue(Path(rows[0]["details"]["quarantine"]).exists())
        self.assertTrue(self.lineage.verify()["valid"])
    def test_rollback_record_contains_transaction(self):
        with self.assertRaises(rt.GateError): self.store.commit("ART-X",{},"ACT-1",fail_at="after_artifact")
        self.assertTrue(self.lineage.records()[0]["details"]["transaction_id"].startswith("TX-"))
    def test_independent_transactions(self):
        errors=[]
        def run(i):
            try: self.store.commit(f"ART-{i}",{"i":i},"ACT-1",fail_at="after_artifact" if i==1 else None)
            except Exception as exc: errors.append(exc)
        threads=[threading.Thread(target=run,args=(i,)) for i in (1,2)]
        [t.start() for t in threads]; [t.join() for t in threads]
        self.assertFalse(self.store.path_for("ART-1").exists()); self.assertTrue(self.store.path_for("ART-2").exists())
    def test_rollback_under_500ms(self):
        start=time.monotonic()
        with self.assertRaises(rt.GateError): self.store.commit("ART-X",{},"ACT-1",fail_at="after_artifact")
        self.assertLess((time.monotonic()-start)*1000,500)


class Gate02PublicationTests(Base):
    def test_success(self):
        got=[]; p=rt.Publisher(self.lineage,{"c":lambda aid,payload:got.append(aid)},delays=(0,))
        self.assertEqual("PUBLISHED",p.publish("ART-1",{},"LIN-1")["status"]); self.assertEqual(["ART-1"],got)
    def test_failure_does_not_touch_artifact(self):
        store=rt.ArtifactStore(self.root/"a",self.lineage); store.commit("ART-1",{"x":1},"ACT-1")
        p=rt.Publisher(self.lineage,{"c":lambda *_:(_ for _ in ()).throw(RuntimeError("down"))},delays=(0,0))
        p.publish("ART-1",{},"LIN-1"); self.assertEqual({"x":1},store.get("ART-1"))
    def test_retry_count(self):
        calls=[]
        def fail(*_): calls.append(1); raise RuntimeError("down")
        rt.Publisher(self.lineage,{"c":fail},delays=(0,0,0)).publish("ART-1",{},"LIN-1"); self.assertEqual(3,len(calls))
    def test_retry_schedule(self):
        sleeps=[]
        p=rt.Publisher(self.lineage,{"c":lambda *_:(_ for _ in ()).throw(RuntimeError("down"))},sleep=sleeps.append)
        p.publish("ART-1",{},"LIN-1"); self.assertEqual([0,5,25,125,600],sleeps)
    def test_failed_queryable(self):
        p=rt.Publisher(self.lineage,{"c":lambda *_:(_ for _ in ()).throw(RuntimeError())},delays=(0,))
        p.publish("ART-1",{},"LIN-1"); self.assertIn("ART-1",p.failed); self.assertEqual("PUBLICATION_FAILED",p.get_artifact_state("ART-1"))
    def test_failed_state_has_five_linked_events(self):
        p=rt.Publisher(self.lineage,{"c":lambda *_:(_ for _ in ()).throw(RuntimeError("down"))},sleep=lambda _:None)
        p.publish("ART-1",{},"LIN-PARENT"); rows=self.lineage.records()
        self.assertEqual("PUBLICATION_FAILED",p.get_artifact_state("ART-1")); self.assertEqual(5,len(rows))
        self.assertTrue(all(r["details"]["parent_lineage_id"]=="LIN-PARENT" and r["details"]["outcome"]=="FAILURE" for r in rows))
    def test_manual_republish(self):
        calls=[]
        def flaky(*_):
            calls.append(1)
            if len(calls)==1: raise RuntimeError()
        p=rt.Publisher(self.lineage,{"c":flaky},delays=(0,)); p.publish("ART-1",{},"LIN-1"); self.assertEqual("PUBLISHED",p.republish("ART-1")["status"])
    def test_idempotent_success(self):
        calls=[]; p=rt.Publisher(self.lineage,{"c":lambda *_:calls.append(1)},delays=(0,)); p.publish("ART-1",{},"LIN-1"); p.publish("ART-1",{},"LIN-1"); self.assertEqual(1,len(calls))
    def test_consumer_isolation(self):
        got=[]; p=rt.Publisher(self.lineage,{"bad":lambda *_:(_ for _ in ()).throw(RuntimeError()),"good":lambda *_:got.append(1)},delays=(0,)); p.publish("ART-1",{},"LIN-1"); self.assertEqual([1],got)
    def test_event_logging(self):
        rt.Publisher(self.lineage,{"c":lambda *_:None},delays=(0,)).publish("ART-1",{},"LIN-1"); row=self.lineage.records()[0]; self.assertEqual("PUBLICATION_EVENT",row["action"]); self.assertEqual("LIN-1",row["details"]["parent_lineage_id"])


class Gate03ActorTests(Base):
    def make(self): return rt.ActorRegistry(self.root/"actors.json",self.lineage,rt.digest(b"boot"))
    def seed(self):
        r=self.make(); r.register("ACT-20260713-0001","Owner","HUMAN","bootstrap",bootstrap="boot"); r.transition("ACT-20260713-0001","ACTIVE","bootstrap",bootstrap="boot"); return r
    def test_persistence_restart(self): self.seed(); self.assertTrue(self.make().is_active("ACT-20260713-0001"))
    def test_skip_transition_rejected(self):
        r=self.make(); r.register("ACT-20260713-0001","Owner","HUMAN","bootstrap",bootstrap="boot")
        with self.assertRaises(rt.GateError): r.transition("ACT-20260713-0001","RETIRED","bootstrap",bootstrap="boot")
    def test_inactive_actor(self):
        r=self.make(); r.register("ACT-20260713-0001","Owner","HUMAN","bootstrap",bootstrap="boot"); self.assertFalse(r.is_active("ACT-20260713-0001"))
    def test_mutation_lineage(self): self.seed(); self.assertEqual(["MUTATED","MUTATED"],[x["action"] for x in self.lineage.records()])
    def test_id_format(self):
        with self.assertRaises(rt.GateError): self.make().register("bad","X","HUMAN","bootstrap",bootstrap="boot")
    def test_lookup(self): self.assertEqual("Owner",self.seed().get("ACT-20260713-0001")["display_name"])
    def test_export_no_credentials(self): self.assertNotIn("credential",json.dumps(self.seed().export()).lower())
    def test_bootstrap_rotation(self):
        r=self.make(); r.rotate_bootstrap("boot","new")
        with self.assertRaises(rt.GateError): r.register("ACT-20260713-0001","X","HUMAN","bootstrap",bootstrap="boot")
    def test_retired_terminal(self):
        r=self.seed(); r.transition("ACT-20260713-0001","SUSPENDED","ACT-20260713-0001"); r.transition("ACT-20260713-0001","RETIRED","bootstrap",bootstrap="boot")
        with self.assertRaises(rt.GateError): r.transition("ACT-20260713-0001","ACTIVE","bootstrap",bootstrap="boot")


class Gate04LineageTests(Base):
    def test_exclusive_lock(self):
        lock=rt.AtomicFileLock(self.lineage.lock_path,timeout_ms=30); lock.acquire()
        with self.assertRaises(rt.GateError): rt.AtomicFileLock(self.lineage.lock_path,timeout_ms=10).acquire()
        lock.release()
    def test_timeout_code(self):
        lock=rt.AtomicFileLock(self.lineage.lock_path,timeout_ms=30); lock.acquire()
        try:
            with self.assertRaises(rt.GateError) as c: rt.AtomicFileLock(self.lineage.lock_path,timeout_ms=10).acquire()
            self.assertEqual("LINEAGE_CONFLICT",c.exception.code)
        finally: lock.release()
    def test_stale_expiry(self):
        self.lineage.lock_path.write_text("stale"); old=time.time()-1; os.utime(self.lineage.lock_path,(old,old))
        with rt.AtomicFileLock(self.lineage.lock_path,timeout_ms=50,stale_seconds=.01): self.assertTrue(True)
    def test_unique_ids_concurrent(self):
        errors=[]
        def write():
            try:self.lineage.append("MUTATED","A")
            except Exception as exc:errors.append(exc)
        ts=[threading.Thread(target=write) for _ in range(50)]; [t.start() for t in ts]; [t.join() for t in ts]
        ids=[r["lineage_id"] for r in self.lineage.records()]; self.assertEqual(50,len(set(ids))); self.assertFalse(errors)
    def test_partial_repair(self):
        self.lineage.append("MUTATED","A"); self.lineage.path.write_bytes(self.lineage.path.read_bytes()+b'{"partial"')
        q=self.lineage.repair_partial_tail(); self.assertTrue(q.exists()); self.assertEqual("CORRUPT_RECORD",self.lineage.records()[-1]["action"])
    def test_hash_chain_normal(self):
        [self.lineage.append("MUTATED","A") for _ in range(100)]; self.assertTrue(self.lineage.verify()["valid"])
    def test_hash_break_detection(self):
        self.lineage.append("MUTATED","A"); rows=self.lineage.records(); rows[0]["actor"]="X"; self.lineage.path.write_text(json.dumps(rows[0])+"\n")
        self.assertEqual(1,self.lineage.verify()["corrupt_record"])
    def test_ten_writer_stress(self):
        barrier=threading.Barrier(10); failures=[]
        def batch():
            barrier.wait()
            for _ in range(10):
                try: self.lineage.append("MUTATED","A")
                except Exception as exc: failures.append(exc)
        ts=[threading.Thread(target=batch) for _ in range(10)]; [t.start() for t in ts]; [t.join() for t in ts]
        self.assertFalse(failures); self.assertEqual(100,len(self.lineage.records())); self.assertTrue(self.lineage.verify()["valid"])


class Gate05ActivationTests(Base):
    def test_open_gates_block_activation(self):
        gates=self.root/"gates.json"; gates.write_text(json.dumps({"gates":{f"GATE-0{i}":{"status":"OPEN"} for i in range(1,6)}}))
        amendments=self.root/"a.json"; amendments.write_text('{"amendments":[]}'); actors=rt.ActorRegistry(self.root/"actors.json",self.lineage,rt.digest(b"boot"))
        c=rt.ActivationController(gates,amendments,self.lineage,actors,self.root/"status.json")
        with self.assertRaises(rt.GateError) as caught: c.activate({})
        self.assertEqual("GATES_OPEN",caught.exception.code); self.assertFalse((self.root/"status.json").exists())


if __name__=="__main__": unittest.main()
