"""Batch task generator scanning corpus documents to issue research.task.v1 specifications."""

import hashlib
import json
import os

class BatchTaskGenerator:
    def __init__(self, corpus_dir: str, specs_dir: str):
        self.corpus_dir = corpus_dir
        self.specs_dir = specs_dir
        os.makedirs(specs_dir, exist_ok=True)

    def scan_and_generate_batch_tasks(self) -> list:
        generated_specs = []
        seq = 201

        batch_targets = [
            {
                "sourceId": "src-bfrc-accession-1941-05",
                "start": 420,
                "end": 614,
                "question": "How many master toolmakers were allocated at Rouge in May 1941 for B-24 wing die tooling?",
                "subject": "Rouge Tool and Die Plant"
            },
            {
                "sourceId": "src-army-air-force-contract-1941-06",
                "start": 380,
                "end": 554,
                "question": "What parallel assembly line dimensions were specified in the June 1941 AAF evaluation memo?",
                "subject": "Army Air Force Materiel Command / Willow Run Layout"
            }
        ]

        for target in batch_targets:
            source_id = target["sourceId"]
            filepath = os.path.join(self.corpus_dir, f"{source_id}.txt")
            if not os.path.exists(filepath):
                continue

            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            file_digest = f"sha256:{hashlib.sha256(content.encode('utf-8')).hexdigest()}"
            task_id = f"TASK-CIC-BATCH-{seq}"
            
            task_spec = {
                "specVersion": "research.task.v1",
                "taskId": task_id,
                "idempotencyKey": f"cic-wr-batch-{seq}",
                "sourceTargets": [
                    {
                        "sourceId": source_id,
                        "sourceRevision": file_digest,
                        "span": {
                            "start": target["start"],
                            "end": target["end"]
                        }
                    }
                ],
                "exactQuestion": target["question"],
                "subject": target["subject"],
                "evidenceType": "fact",
                "outputContract": "candidate.fact.v1",
                "approvalRequired": True
            }

            spec_filename = f"task-batch-{seq}.json"
            spec_path = os.path.join(self.specs_dir, spec_filename)
            with open(spec_path, "w", encoding="utf-8") as f:
                json.dump(task_spec, f, indent=2)

            generated_specs.append({
                "taskId": task_id,
                "specPath": spec_path,
                "sourceId": source_id
            })
            seq += 1

        return generated_specs
