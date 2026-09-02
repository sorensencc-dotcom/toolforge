"""Deterministic validation gate for evidence pipeline."""

import hashlib

class ValidationGate:
    def __init__(self, resolver):
        self.resolver = resolver
        self.processed_idempotency_keys = set()

    def validate_candidate(self, task_spec: dict, candidate: dict, expected_span_hash: str = None) -> tuple[bool, str]:
        idempotency_key = task_spec.get("idempotencyKey")
        if idempotency_key in self.processed_idempotency_keys:
            return False, f"Duplicate idempotency key rejected: {idempotency_key}"

        source_id = candidate["sourceId"]
        start = candidate["span"]["start"]
        end = candidate["span"]["end"]
        
        # 1. Re-read text span and verify hash
        try:
            source_content = self.resolver.resolve_source(source_id)
            extracted_text = source_content[start:end]
            recalculated_hash = f"sha256:{hashlib.sha256(extracted_text.encode('utf-8')).hexdigest()}"
        except Exception as e:
            return False, f"Source resolution failure: {str(e)}"

        check_hash = expected_span_hash or candidate["spanHash"]
        if recalculated_hash != check_hash:
            return False, f"Span hash mismatch: recalculated {recalculated_hash} != expected {check_hash}"

        # 2. Substring containment check
        subject_tokens = [t for t in candidate["subject"].replace("/", " ").split() if len(t) > 3]
        match_count = sum(1 for token in subject_tokens if token.lower() in extracted_text.lower() or token.lower() in candidate["claim"].lower())
        if subject_tokens and match_count == 0:
            return False, f"Subject tokens {subject_tokens} not grounded in extracted text"

        # Register idempotency key upon successful validation
        self.processed_idempotency_keys.add(idempotency_key)
        return True, "Validation passed"
