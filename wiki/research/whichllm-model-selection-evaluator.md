---
source_title: "WhichLLM v2.4.0 Model Selection Evaluator Specification"
repository: "Toolforge & CIC Evaluator Suite - Accession 88, Box 14"
document_date: "2026-08-23"
verification_status: "verified"
category: "master-kb"
topic: whichllm-model-selection-evaluator
status: active
synthesized_by: "qwen2.5:32b-instruct-q8_0"
last_updated: "2026-08-23T19:37:00.000Z"
---

# WhichLLM v2.4.0 Model Selection Evaluator

## Architecture & Purpose

The WhichLLM automated model selection matrix evaluates open-weight local and frontier LLMs for grounded tool execution and local RAG synthesis within the CIC agent mesh.

### Core Disciplines
1. **Simple tool calls**: Invoking single-tool materializers with exact arguments.
2. **Parallel tool calls**: Dispatching non-overlapping concurrent requests.
3. **Nested tool calls**: Resolving chained execution dependencies across components.
4. **Negative relevance rejections**: Refusing tool invocation on non-tool queries.

### Quantization & Memory Penalty
Dynamically calculates VRAM requirements against host physical memory profiles (`vram_gb`, `ram_gb`, `gpu_count`). Severe quantization degradation applies a proportional penalty to the composite BFCL score.

### Lineage & Self-Integrity
Emits `_integration/model_selection.json` with a SHA-256 integrity hash for auditing before executing research cycles.
