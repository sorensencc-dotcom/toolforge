"""Extended recursive gap mining engine with multi-pattern heuristic detectors."""

import json
import os

class GapMiningEngine:
    def __init__(self, canonical_records: list, specs_dir: str):
        self.canonical_records = canonical_records
        self.specs_dir = specs_dir
        os.makedirs(specs_dir, exist_ok=True)

    def mine_gaps(self) -> list:
        generated_tasks = []
        seq = 101
        mined_keys = set()

        known_vendors = ["bliss", "danly", "budd", "consolidated", "clearing"]
        known_contracts = ["w-535-ac", "contract", "w-535"]
        volume_keywords = ["per month", "per hour", "planes", "bombers per"]

        for record in self.canonical_records:
            fact_key = record.get("factKey")
            claim = record.get("claim", "")
            claim_lower = claim.lower()

            # Pattern 1: Parameter Specification Gap
            key_param = (fact_key, "parameter_specification")
            if "cast-iron automotive tooling" in claim_lower and "weight" not in claim_lower and key_param not in mined_keys:
                mined_keys.add(key_param)
                task_id = f"TASK-CIC-GAP-{seq}"
                task_spec = {
                    "specVersion": "research.task.v1",
                    "taskId": task_id,
                    "idempotencyKey": f"cic-wr-gap-param-{seq}",
                    "sourceTargets": [
                        {
                            "sourceId": "src-oralhist-wh-1954",
                            "sourceRevision": "sha256:f0fd4d00d59fdbcc161a09be83723676ac02726d22c501785e5a5b984be615a3",
                            "span": {"start": 970, "end": 1174}
                        }
                    ],
                    "exactQuestion": "What specific weight, structural steel, and holding fixture specifications were engineered for the B-24 tooling fixtures?",
                    "subject": "Rouge Tool Engineering Team",
                    "evidenceType": "fact",
                    "outputContract": "candidate.fact.v1",
                    "approvalRequired": True,
                    "provenanceGap": {
                        "triggeredByFactKey": fact_key,
                        "gapType": "parameter_specification"
                    }
                }
                spec_filename = f"task-gap-{seq}.json"
                spec_path = os.path.join(self.specs_dir, spec_filename)
                with open(spec_path, "w", encoding="utf-8") as f:
                    json.dump(task_spec, f, indent=2)

                generated_tasks.append({
                    "taskId": task_id,
                    "specPath": spec_path,
                    "gapType": "parameter_specification",
                    "triggeredBy": fact_key
                })
                seq += 1

            # Pattern 2: Vendor Identification Gap
            key_vendor = (fact_key, "vendor_identification")
            if ("tooling" in claim_lower or "dies" in claim_lower) and not any(v in claim_lower for v in known_vendors) and key_vendor not in mined_keys:
                mined_keys.add(key_vendor)
                task_id = f"TASK-CIC-GAP-{seq}"
                task_spec = {
                    "specVersion": "research.task.v1",
                    "taskId": task_id,
                    "idempotencyKey": f"cic-wr-gap-vendor-{seq}",
                    "sourceTargets": [
                        {
                            "sourceId": "src-wpb-report-1942",
                            "sourceRevision": "sha256:3881dc5969d508c37512170fbd7683c3e5f821e786cb7faec961598c6946161f",
                            "span": {"start": 750, "end": 904}
                        }
                    ],
                    "exactQuestion": "Which specific machine tool vendor supplied hydraulic stamping presses for Willow Run wing die fabrication?",
                    "subject": "E. W. Bliss Company / Machine Tooling Vendor",
                    "evidenceType": "fact",
                    "outputContract": "candidate.fact.v1",
                    "approvalRequired": True,
                    "provenanceGap": {
                        "triggeredByFactKey": fact_key,
                        "gapType": "vendor_identification"
                    }
                }
                spec_filename = f"task-gap-{seq}.json"
                spec_path = os.path.join(self.specs_dir, spec_filename)
                with open(spec_path, "w", encoding="utf-8") as f:
                    json.dump(task_spec, f, indent=2)

                generated_tasks.append({
                    "taskId": task_id,
                    "specPath": spec_path,
                    "gapType": "vendor_identification",
                    "triggeredBy": fact_key
                })
                seq += 1

            # Pattern 3: Contract Number Revision Gap
            key_contract = (fact_key, "contract_revision")
            if ("submissions" in claim_lower or "schedules" in claim_lower) and not any(c in claim_lower for c in known_contracts) and key_contract not in mined_keys:
                mined_keys.add(key_contract)
                task_id = f"TASK-CIC-GAP-{seq}"
                task_spec = {
                    "specVersion": "research.task.v1",
                    "taskId": task_id,
                    "idempotencyKey": f"cic-wr-gap-contract-{seq}",
                    "sourceTargets": [
                        {
                            "sourceId": "src-wpb-report-1942",
                            "sourceRevision": "sha256:3881dc5969d508c37512170fbd7683c3e5f821e786cb7faec961598c6946161f",
                            "span": {"start": 750, "end": 904}
                        }
                    ],
                    "exactQuestion": "What official War Department contract number governed the Willow Run tooling schedule submissions?",
                    "subject": "War Department / Ford Motor Company Contract",
                    "evidenceType": "fact",
                    "outputContract": "candidate.fact.v1",
                    "approvalRequired": True,
                    "provenanceGap": {
                        "triggeredByFactKey": fact_key,
                        "gapType": "contract_revision"
                    }
                }
                spec_filename = f"task-gap-{seq}.json"
                spec_path = os.path.join(self.specs_dir, spec_filename)
                with open(spec_path, "w", encoding="utf-8") as f:
                    json.dump(task_spec, f, indent=2)

                generated_tasks.append({
                    "taskId": task_id,
                    "specPath": spec_path,
                    "gapType": "contract_revision",
                    "triggeredBy": fact_key
                })
                seq += 1

            # Pattern 4: Production Volume Discrepancy Gap
            key_volume = (fact_key, "production_volume_discrepancy")
            if ("assembly line" in claim_lower or "assembly lines" in claim_lower) and not any(vk in claim_lower for vk in volume_keywords) and key_volume not in mined_keys:
                mined_keys.add(key_volume)
                task_id = f"TASK-CIC-GAP-{seq}"
                task_spec = {
                    "specVersion": "research.task.v1",
                    "taskId": task_id,
                    "idempotencyKey": f"cic-wr-gap-volume-{seq}",
                    "sourceTargets": [
                        {
                            "sourceId": "src-army-air-force-contract-1941-06",
                            "sourceRevision": "sha256:685d9cc103f5491746e7f72c333d0b78221dcbe5b298fb6603cf0265bc08072a",
                            "span": {"start": 560, "end": 701}
                        }
                    ],
                    "exactQuestion": "What target monthly production volume was mandated by AAF Materiel Command for Willow Run?",
                    "subject": "Army Air Force Materiel Command Volume Target",
                    "evidenceType": "fact",
                    "outputContract": "candidate.fact.v1",
                    "approvalRequired": True,
                    "provenanceGap": {
                        "triggeredByFactKey": fact_key,
                        "gapType": "production_volume_discrepancy"
                    }
                }
                spec_filename = f"task-gap-{seq}.json"
                spec_path = os.path.join(self.specs_dir, spec_filename)
                with open(spec_path, "w", encoding="utf-8") as f:
                    json.dump(task_spec, f, indent=2)

                generated_tasks.append({
                    "taskId": task_id,
                    "specPath": spec_path,
                    "gapType": "production_volume_discrepancy",
                    "triggeredBy": fact_key
                })
                seq += 1

        return generated_tasks
