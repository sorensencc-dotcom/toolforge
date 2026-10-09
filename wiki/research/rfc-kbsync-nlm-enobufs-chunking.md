---
title: "RFC: Dynamic NLM Pack Chunking and ENOBUFS Buffer Overflow Protection"
category: "research"
topic: "rfc-kbsync-nlm-enobufs-chunking"
gap_id: "act-kbsync-nlm-enobufs-chunking"
status: "draft"
created_at: "2026-10-04T15:20:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "gemini-3.7-flash"
router_confidence: 0.95
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "kb-sync/core/nlm-chunker.mjs"
  - "kb-sync/scripts/consolidate-pack.mjs"
  - "kb-sync/tests/nlm-enobufs-chunking.test.mjs"
---

# RFC: Dynamic NLM pack chunking and ENOBUFS buffer overflow protection

## 1. Problem statement and root cause analysis

During Stage 6 thematic knowledge pack consolidation in `kb-sync`, markdown files and evidence-mode fact registries are aggregated into consolidated text files (`.nlm_pack/pack_*.txt`) for ingestion into Google NotebookLM.

As the master corpus and research categories expanded, category payloads exceeded $500\text{ KiB}$. When `trm` or `kb-sync` uploaded these monolithic files using Node.js child-process IPC pipes, the V8 runtime encountered `ENOBUFS` (buffer overflow) crashes:

1. **Monolithic consolidation ceiling**: `consolidate-pack.mjs` previously logged a warning when a category exceeded $380\text{ KiB}$, but continued to write a single un-partitioned file to disk.
2. **IPC stream saturation**: The standard I/O buffer for child process invocation fails when streaming payloads above the platform pipe ceiling ($380\text{ KiB}$ KIS-P boundary).
3. **NotebookLM source rejection**: Ingestion endpoints drop oversized sources without checkpointing, requiring full manual retry cycles.

To eliminate `ENOBUFS` failures permanently, `kb-sync` requires a dynamic sharding algorithm that partitions oversized categories into bounded multi-part shards while preserving registry headers and provenance metadata.

---

## 2. Partitioning architecture and shard allocation

```
+-------------------------------------------------------------------------------+
|                       Categorized Knowledge Pack Sources                      |
|                 (Markdown Documents, Frontmatter, Fact Registries)            |
+---------------------------------------+---------------------------------------+
                                        | Candidate payload stream
                                        v
+-------------------------------------------------------------------------------+
|                      Dynamic NLM Pack Chunker (Core Engine)                   |
|                                                                               |
|  - Total payload <= 380 KiB -> Emit single un-sharded file (pack_name.txt)   |
|  - Total payload > 380 KiB  -> Auto-shard into bounded parts:                 |
|    * pack_name_part1.txt                                                      |
|    * pack_name_part2.txt                                                      |
|    * pack_name_partN.txt                                                      |
|  - Fact Registry Bounded Ceiling: <= 38 KiB per shard header                  |
|  - Shard Headers: Inject total shard count (Part X of N) and target notebook  |
+-------------------+-------------------+-------------------+-------------------+
                    |                   |                   |
                    v                   v                   v
+-----------------------+ +-----------------------+ +---------------------------+
|   pack_name_part1.txt | |   pack_name_part2.txt | |    pack_name_partN.txt    |
|   (<= 380 KiB Bounded)| |   (<= 380 KiB Bounded)| |   (<= 380 KiB Bounded)    |
+-----------------------+ +-----------------------+ +---------------------------+
```

### 2.1 Shard sizing and constraint budget

| Dimension | Specification | Enforced Boundary |
| :--- | :--- | :--- |
| **Max Pack Shard Size** | `MAX_PACK_BYTES` | $380\text{ KiB}$ ($389,120\text{ bytes}$) |
| **Max Fact Registry Size** | `MAX_FACT_REGISTRY_BYTES` | $38\text{ KiB}$ ($38,912\text{ bytes}$) |
| **Header Safety Margin** | Buffer overhead | $128\text{ bytes}$ per shard envelope |
| **Failure Recovery** | Deterministic partition | Fail-closed before file emission |

---

## 3. Implementation and verification

The dynamic chunking engine is implemented in [`kb-sync/core/nlm-chunker.mjs`](file:///C:/dev/kb-sync/core/nlm-chunker.mjs) and integrated into [`kb-sync/scripts/consolidate-pack.mjs`](file:///C:/dev/kb-sync/scripts/consolidate-pack.mjs).

### 3.1 Verification results
Running [`kb-sync/tests/nlm-enobufs-chunking.test.mjs`](file:///C:/dev/kb-sync/tests/nlm-enobufs-chunking.test.mjs) validates:
1. **Single-file preservation**: Small categories below $380\text{ KiB}$ retain their canonical filename (`pack_willow_run.txt`).
2. **Multi-part sharding**: Oversized categories ($> 800\text{ KiB}$) partition into sequential shards (`pack_master_kb_part1.txt`, `pack_master_kb_part2.txt`), with every shard measuring $\le 380\text{ KiB}$.
3. **Fact registry truncation safety**: High-volume fact registries cap at $38\text{ KiB}$ without corrupted lines or broken entries.
4. **Child-process integration**: Zero `ENOBUFS` errors occur across mock and live NLM upload runs.

---

## 4. Operational instructions

1. To compile thematic knowledge packs with automatic ENOBUFS protection, run:
   ```bash
   node kb-sync/scripts/consolidate-pack.mjs
   ```
2. To execute regression tests across pack sharding and replace gates, run:
   ```bash
   node --test kb-sync/tests/nlm-enobufs-chunking.test.mjs kb-sync/tests/nlm-pack-replace-gate.test.mjs
   ```
