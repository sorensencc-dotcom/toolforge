import json
from pathlib import Path
from ops import validate_hash_chain, verify_immutable_storage, recompute_seal_hash, verify_governance_signature, emit_event
from ops import register_artifact, publish_artifact, lock_lineage, freeze_promotion
from ops import validate_wrapper_logs, resolve_actor, fault_replay, detect_fs_type, submit_ratification
from ops import compute_drift, semantic_diff, validate_treatment_graph, check_redesign_alignment

ROOT = Path(__file__).parent

def workflow_SVW():
    seal = "seal-789"; h = recompute_seal_hash.recompute_seal_hash({"artifact_bytes": b"sealed-artifact"})
    if h.get("status") != "OK": return h
    checks = [validate_hash_chain.validate_hash_chain({"prev_id":"prev-123","current_id":"curr-456","seal_id":seal}), verify_governance_signature.verify_governance_signature({"seal_hash":h["seal_hash"],"gov_sig_profile":{"prefix":h["seal_hash"][:4]}}), emit_event.emit_event({"type":"seal_verified","seal_id":seal})]
    return {"status":"OK","seal_hash":h["seal_hash"]} if all(x.get("status")=="OK" for x in checks) else {"status":"FAIL","detail":checks}

def workflow_PSPW():
    artifact=ROOT/"sample_artifact.bin"; artifact.write_bytes(b"sample-artifact"); seal="seal-789"
    results=[register_artifact.register_artifact({"seal_id":seal,"manifest_path":str(artifact)}), publish_artifact.publish_artifact({"seal_id":seal,"artifact_path":str(artifact)}), lock_lineage.lock_lineage({"seal_id":seal}), freeze_promotion.freeze_promotion({"seal_id":seal}), emit_event.emit_event({"type":"artifact_published","seal_id":seal})]
    return {"status":"OK","registry_id":results[0].get("registry_id"),"store_ref":results[1].get("store_ref")} if all(x.get("status")=="OK" for x in results) else {"status":"FAIL","detail":results}

def workflow_GRW():
    log=ROOT/"wrapper.log"; log.write_text("GOV_WRAPPER_OK\n"); actor=resolve_actor.resolve_actor({"actor_placeholder":"governance-actor"})
    results=[validate_wrapper_logs.validate_wrapper_logs({"log_path":str(log)}),actor,fault_replay.fault_replay({"test_case_id":"TC-PS-03","seal_id":"seal-789"}),detect_fs_type.detect_fs_type({"mount_point":str(ROOT)}),submit_ratification.submit_ratification({"seal_id":"seal-789","actor_id":actor.get("actor_id")})]
    return {"status":"OK","ratification_packet_id":results[-1].get("ratification_packet_id")} if all(x.get("status")=="OK" for x in results) else {"status":"FAIL","detail":results}

def workflow_PSDAW():
    b=ROOT/"baseline.txt"; s=ROOT/"sealed.txt"; b.write_text("line1\nline2\nline3\n"); s.write_text("line1\nline2\nline3\n"); graph=ROOT/"treatment_graph.json"; graph.write_text(json.dumps({"nodes":[],"edges":[]})); signal=ROOT/"redesign_signal.json"; signal.write_text(json.dumps({"alignment":True}))
    drift=compute_drift.compute_drift({"seal_id":"seal-789","baseline_ref":str(b),"sealed_ref":str(s),"ceiling":0.03}); diff=semantic_diff.semantic_diff({"baseline_ref":str(b),"sealed_ref":str(s)}); results=[drift,diff,validate_treatment_graph.validate_treatment_graph({"treatment_graph_ref":str(graph)}),check_redesign_alignment.check_redesign_alignment({"redesign_signal_ref":str(signal)}),emit_event.emit_event({"type":"drift_audit_completed","seal_id":"seal-789"})]
    return {"status":"OK","drift_score":drift.get("drift_score"),"diff_report":diff.get("semantic_diff_report")} if all(x.get("status")=="OK" for x in results) else {"status":"FAIL","detail":results}

DISPATCH={"SVW":workflow_SVW,"PSPW":workflow_PSPW,"GRW":workflow_GRW,"PSDAW":workflow_PSDAW}
CASES=[("TC-PS-01","SVW"),("TC-PS-02","PSPW"),("TC-PS-03","GRW"),("TC-PS-04","PSDAW")]
if __name__ == "__main__":
    failed=False
    for cid,wf in CASES:
        result=DISPATCH[wf](); print(f"Running {cid} -> workflow {wf}"); print("Result:",result)
        if result.get("status")!="OK": print(f"[FAIL] {cid}"); failed=True
        else: print(f"[OK] {cid} passed")
    raise SystemExit(1 if failed else 0)
