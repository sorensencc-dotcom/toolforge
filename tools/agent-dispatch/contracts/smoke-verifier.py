import json
import sys

print(json.dumps({"valid": True, "contract_hash": "sha256:smoke-mock", "key_id": "smoke-operator-key"}))
sys.exit(0)
