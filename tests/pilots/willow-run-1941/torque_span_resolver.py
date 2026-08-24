"""TorqueQuery span and revision resolver for controlled evidence pipeline."""

import hashlib
import os

class TorqueSpanResolver:
    def __init__(self, corpus_dir: str):
        self.corpus_dir = corpus_dir

    def resolve_source(self, source_id: str) -> str:
        filename = f"{source_id}.txt"
        filepath = os.path.join(self.corpus_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Source document not found: {filepath}")
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

    def get_source_revision(self, source_id: str) -> str:
        content = self.resolve_source(source_id)
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        return f"sha256:{digest}"

    def extract_span(self, source_id: str, start: int, end: int) -> dict:
        content = self.resolve_source(source_id)
        if start < 0 or end > len(content) or start >= end:
            raise ValueError(f"Invalid span range [{start}:{end}] for source length {len(content)}")
        
        span_text = content[start:end]
        span_digest = hashlib.sha256(span_text.encode("utf-8")).hexdigest()
        span_hash = f"sha256:{span_digest}"
        source_revision = self.get_source_revision(source_id)

        return {
            "sourceId": source_id,
            "sourceRevision": source_revision,
            "span": {"start": start, "end": end},
            "spanText": span_text,
            "spanHash": span_hash
        }
