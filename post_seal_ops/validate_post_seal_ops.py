import sys
import json
import yaml
from pathlib import Path

REQUIRED_MODULE_FIELDS = ["module", "workflows", "events", "execution_contract", "registry", "test_harness"]
REQUIRED_WORKFLOWS = ["SVW", "PSPW", "GRW", "PSDAW"]
REQUIRED_EVENTS = ["seal_verified", "artifact_published", "drift_audit_completed"]
REQUIRED_CONTRACT_GUARANTEES = ["deterministic_execution", "append_only_storage", "lineage_lock_enforced", "event_emission_required"]
REQUIRED_REGISTRY_ROUTES = {"SVW": "seal_verification_report.json", "PSPW": "publication_certificate.md", "GRW": "ratification_packet/", "PSDAW": "drift_audit_report.json"}
REQUIRED_TEST_CASES = {"TC-PS-01": "SVW", "TC-PS-02": "PSPW", "TC-PS-03": "GRW", "TC-PS-04": "PSDAW"}

def fail(msg):
    print(f"[FAIL] {msg}")
    sys.exit(1)

def ok(msg):
    print(f"[OK] {msg}")

def load_module(path):
    text = Path(path).read_text()
    try:
        return json.loads(text) if path.endswith(".json") else yaml.safe_load(text)
    except Exception as e:
        fail(f"Failed to parse module: {e}")

def validate_top_level(m):
    for f in REQUIRED_MODULE_FIELDS:
        if f not in m: fail(f"Missing top-level field: {f}")
    ok("Top-level fields present")

def validate_module_block(m):
    blk = m["module"]
    for k in ["id", "namespace"]:
        if k not in blk or not blk[k]: fail(f"module.{k} missing or empty")
    if blk["id"] != "post_seal_ops": fail("module.id must be 'post_seal_ops'")
    ok("Module block valid")

def validate_workflows(m):
    for w in REQUIRED_WORKFLOWS:
        if w not in m["workflows"]: fail(f"Missing workflow: {w}")
        if "steps" not in m["workflows"][w] or not m["workflows"][w]["steps"]: fail(f"Workflow {w} has no steps")
    ok("Workflows present and non-empty")

def validate_events(m):
    for e in REQUIRED_EVENTS:
        if e not in m["events"]: fail(f"Missing event: {e}")
        if "fields" not in m["events"][e]: fail(f"Event {e} missing fields")
    ok("Events present with fields")

def validate_execution_contract(m):
    guarantees = m["execution_contract"].get("guarantees")
    if not isinstance(guarantees, list): fail("execution_contract.guarantees missing or not list")
    missing = set(REQUIRED_CONTRACT_GUARANTEES) - set(guarantees)
    if missing: fail(f"execution_contract.guarantees missing: {missing}")
    ok("Execution contract guarantees valid")

def validate_registry(m):
    routes = {r.get("workflow"): r.get("produces") for r in m["registry"].get("routes", [])}
    for wf, expected in REQUIRED_REGISTRY_ROUTES.items():
        if wf not in routes: fail(f"registry missing workflow: {wf}")
        if routes[wf] != expected: fail(f"registry route mismatch for {wf}")
    ok("Registry routes valid")

def validate_test_harness(m):
    cases = {c.get("id"): c.get("workflow") for c in m["test_harness"].get("matrix", [])}
    for cid, wf in REQUIRED_TEST_CASES.items():
        if cid not in cases: fail(f"Missing test case: {cid}")
        if cases[cid] != wf: fail(f"Test case {cid} bound incorrectly")
    ok("Test harness matrix valid")

def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_post_seal_ops.py post_seal_ops.yaml")
        sys.exit(1)
    module = load_module(sys.argv[1])
    validate_top_level(module); validate_module_block(module); validate_workflows(module)
    validate_events(module); validate_execution_contract(module); validate_registry(module)
    validate_test_harness(module); ok("post_seal_ops module VALID")

if __name__ == "__main__": main()
