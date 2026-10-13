# Representative retrieval acceptance

Result: **REJECTED**. No threshold candidate satisfies the frozen tuning gate. Keep default threshold `0.7` and the existing model configuration.

## Evidence

Operator approved seven source documents: six from `C:\dev\docs`, plus `rewrite-mcp/docs/rewrite-labs-repomix-harvester-integration.md`. Byte-preserving snapshots total 117,706 bytes. Exports contain 476 paragraphs. Shared governance documents use the CIC test namespace with shared provenance; Harvester supplies dedicated RewriteLabs coverage. Every export uses `UNKNOWN` evidence status rather than treating document approval or implementation claims as verified research.

Manifest SHA-256: `44663ede256d3bc7e8234a69d30655d0a7013af69f9becd2477bf26c29fbd74c`. Source hashes, expected document/chunk labels, 18 tuning queries, and 52 validation queries were frozen before scores. Duplicate labeling found 1,036 exact chunk pairs, including repeated structural boilerplate, and no document pairs above the declared token-Jaccard near-duplicate cutoff of 0.8.

The real sync CLI indexed the approved corpus into dev/UAT `bhezixgmkhpndmezgsxk`. Real MCP stdio searches used two signed project readers and pinned local identity `ollama:qwen3-embedding:4b@df5bd2e3c74cd8d069d21dc038f1b359fcdc9458fce1c99bd43c9eb1518ff907:1536`. A transparent loopback relay logged actual local batch progress without changing inputs or vectors. No external embedding requests occurred. Scores use global authorized top results; no fixture-only filtering or reranking.

## Measurements

| Set | Expected-passage hits at 0.7 | Negative false accepts |
| --- | --- | --- |
| Tuning | 3/14 (21.4%) | 0/4 |
| Validation | 4/28 (14.3%) | 1/24 |
| Validation CIC positives | 3/24 (12.5%) | - |
| Validation RewriteLabs positives | 1/4 (25.0%) | - |

Validation includes 12 confusing negatives and 12 unrelated negatives. The sole false accept belongs to the confusing group: "How does repository ingestion repair customer secrets automatically?" Top similarity is `0.730728`, with runner-up margin `0.000104`. No unrelated negative exceeded `0.7`.

Only 11/28 validation positives returned a frozen expected passage even at threshold zero. This is a diagnostic for this passage-label set, not a threshold proposal. Tuning alone selected no candidate; validation therefore ran once at unchanged default `0.7`. Validation scores were not used to retune.

Signed project filters denied opposite-project results for both readers; a foreign `other` duplicate remained inaccessible. Status filtering excluded the run's `UNKNOWN` documents from `VERIFIED` results. Selected/default threshold behavior was checked through MCP for every validation query. Independent cleanup rediscovered publications by unique run paths, deleted documents and chunks, verified absence, deleted both temporary users, verified their absence, and removed temporary exports. Snapshots and detailed evidence remain local. Baseline documents, Auth settings, production, and model defaults were not changed.

## Limits and next action

Ground truth enumerates preselected anchor-bearing passages, not every defensible answer passage. Some returned passages may answer a question without matching those labels; this score is strict expected-passage recall, not document-level recall or human answer-quality accuracy. Review missed-query labels and paragraph boundaries before choosing a model or ranking change. Any next experiment needs fresh independent validation; this validation set is spent.

RewriteLabs has one approved source and four validation positives. Corpus covers governance and infrastructure rather than primary historical research. All records use one evidence status; the status test proves exclusion, not ranking across multiple statuses. These limits prevent a broader readiness claim.

Two earlier indexing attempts scored no queries and verified cleanup. The first hit a 60-second per-document timeout. The second received an Ollama HTTP 400; an identical approved local batch later returned HTTP 200. Before scoring, the evaluator was corrected to compare frozen content hashes because the search RPC does not return chunk indexes. Final attempt completed 2026-10-12 at 23:47 EDT with verified cleanup and no runtime error. Harness completion is separate from the rejected quality result.

Detailed machine-readable evidence: [Frozen labels and measured results](research-store-representative-2026-10-12.json).
