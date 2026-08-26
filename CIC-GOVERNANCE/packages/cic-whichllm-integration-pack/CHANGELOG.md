---
title: "CIC-WHICHLLM Integration Pack Changelog"
document_id: "CIC-WHICHLLM-INTEGRATION-PACK-CHANGELOG"
category: "manifest"
status: "candidate"
version: "1.0.0"
---

# Changelog

All notable changes to the CIC-WHICHLLM Integration Pack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-24

### Added
- **OpenRouterProvider**: OpenRouter cloud provider module with rate card mapping for free models (`openrouter/oxalpha` at $0.00/1M tokens) and deterministic exponential retries.
- **Model Allowlist Expansion**: Added `openrouter/`, `oxalpha`, and `anthropic/claude` model namespace prefixes to `GovernanceWrapper` allowlist.
- **Wire-Exact Lineage Hashing**: Integrated single-stringify payload hashing ensuring lineage `requestHash` matches exact transmitted HTTP wire bytes (`deriveId(payload)`).
- **Unit Test Suite**: Added 100% line coverage unit test suite for OpenRouterProvider in `tests/unit/openrouter-provider.test.js`.

## [1.0.0] - 2026-08-23

### Added
- **WhichLLMAdapter**: Deterministic adapter with SHA-256 derived IDs, canonical JSON serialization, and deterministic exponential backoff schedule.
- **GovernanceWrapper**: 5 mandatory CIC §2/S3-A1 governance checks (GC-01 Harvester Registration Integrity, GC-02 Payload Schema Compliance, GC-03 Prompt Policy Gate, GC-04 Model Allowlist Enforcement, and GC-05 Attestation Completeness).
- **LineageContract**: Append-only SHA-256 hash chain with deterministic genesis hash (`SHA-256("CIC:GENESIS:v2.4.0:§2/S3-A1")`), frozen entries, snapshot export, and tamper-evident restore verification.
- **HarvesterRegistry**: Singleton registry enforcing no hard deletes (R-REG-04), lifecycle status transitions, and pre-seeded default harvester (`cic-whichllm-default-v1`).
- **AdapterObserver**: Zero-dependency Prometheus metrics exporter and rolling span buffer with HTTP endpoint (/metrics, /dashboard, /health).
- **Ingestion Schema**: JSON Schema Draft 2020-12 definition with strict const checks, pattern validation, and governance attestation $defs.
- **Test Suite**: Zero-dependency test suites using Node 20 built-in test runner across unit, integration, and E2E scenarios.
- **Operator Scripts**: Health check, schema validator, and observer startup utility scripts.
