---
title: "WhichLLM TensorFold Multi-Precision Quantization Gap (GAP-WHICHLLM-TENSORFOLD-001)"
source_title: "WhichLLM TensorFold Gap Specification"
repository: "WhichLLM / TRM Vault"
document_date: "2026-10-10"
verification_status: "verified"
category: "research"
topic: "whichllm-tensorfold-architecture"
status: "active"
gap_id: "GAP-WHICHLLM-TENSORFOLD-001"
synthesized_by: "antigravity"
last_updated: "2026-10-10T19:05:00Z"
---

# WhichLLM TensorFold Multi-Precision Quantization Gap

> Research node evaluating the TensorFold architecture integration for WhichLLM hardware-aware model routing and speculative multi-precision decoding.

## 1. Problem Statement & Scope

As open-weight LLMs scale across local edge devices and multi-GPU nodes in the CIC agent mesh, memory bandwidth bottlenecks degrade time-to-first-token (TTFT) and decode throughput. The TensorFold proposal introduces:
1. **Dynamic Tensor Folding**: Selective bit-width precision scaling (FP8, INT4, AWQ) per attention block based on query complexity.
2. **Speculative Sub-Model Drafting**: Pairing a small folded model (e.g. 1.5B–3B parameter draft model) with an unquantized verification model.
3. **Hardware-Aware Selection Metrics**: Integrating VRAM headroom and PCIe/Thunderbolt bus telemetry into the WhichLLM BFCL evaluator.

## 2. Technical Evaluation Criteria

- **BFCL Score Preservation**: Folded quantization must preserve `composite_bfcl_score >= 0.85` for tool-use authority.
- **Latency Constraints**: Must achieve sub-200ms TTFT on local Ollama / vLLM endpoints.
- **Memory Footprint**: Target $\le 8\text{ GB}$ total VRAM allocation for unified edge execution.

## 3. Implementation Pathway

1. Define TensorFold calibration profiles in `configs/whichllm-profiles.yaml`.
2. Benchmark draft-to-verifier acceptance ratios in `whichllm-bfcl-evaluator.py`.
3. Wire telemetry hooks into `TorqueQueryOrchestrator.mjs`.
