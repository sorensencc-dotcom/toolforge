# Plan Extractor Integration Usage Guide

## Overview

Unified entry point for CodeFlow extraction into CIC stores. Orchestrates multi-model analysis and persistence.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { ExtractorOrchestrator } from './src/index';

const store = {
  storeNodes: async (nodes) => { /* persist */ },
  storeEdges: async (edges) => { /* persist */ },
  storeSecurity: async (issues) => { /* persist */ },
  storePatterns: async (patterns) => { /* persist */ },
  storeImpact: async (impact) => { /* persist */ },
};

const orchestrator = new ExtractorOrchestrator('repo-id', '/path/to/repo', store);
const result = await orchestrator.run();
console.log('Extraction complete:', result);
```

## API Reference

### `ExtractorOrchestrator(repoId, repoPath, store, codeflowUrl?)`

Constructor for extraction orchestrator.

- `repoId`: Repository identifier
- `repoPath`: Local repository path
- `store`: Implementation of ExtractorStore interface
- `codeflowUrl`: CodeFlow analyzer URL (default: http://codeflow-analyzer:8080)

### `run(): Promise<ExtractorResult>`

Executes the extraction workflow:
1. Calls CodeFlow analyzer
2. Extracts nodes, edges, security issues, patterns
3. Persists results to store
4. Returns completion report

## Store Interface

```typescript
interface ExtractorStore {
  storeNodes(nodes: CicNode[]): Promise<void>;
  storeEdges(edges: CicEdge[]): Promise<void>;
  storeSecurity(issues: CicSecurityIssue[]): Promise<void>;
  storePatterns(patterns: CicPatternHit[]): Promise<void>;
  storeImpact(impact: CicImpact[]): Promise<void>;
}
```

## Examples

See `tests/test.ts` for usage examples.
