# Rewrite Labs Orchestrator Usage Guide

## Overview

Orchestrates multi-stage development pipelines and handles blockers. Coordinates phases, stages, and dependencies.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { RewriteLabsOrchestrator } from './src/index';

const orchestrator = new RewriteLabsOrchestrator();

// Start pipeline orchestration
const result = await orchestrator.orchestratePipeline('delivery-pipeline-1');
console.log(`Pipeline stages: ${result.stages.length}`);
console.log(`Current stage: ${result.currentStage}`);

// Handle blockers
if (result.blockers.length > 0) {
  const resolution = await orchestrator.handleBlocker(result.blockers[0].id);
  console.log('Blocker resolved:', resolution);
}
```

## API Reference

### `orchestratePipeline(pipelineId: string): Promise<PipelineStatus>`

Orchestrates a multi-stage pipeline.

Returns:
- `stages`: Array of pipeline stages
- `currentStage`: Active stage ID
- `progress`: Overall progress percentage
- `blockers`: List of identified blockers
- `dependencies`: Stage dependency graph

### `handleBlocker(blockerId: string): Promise<BlockerResolution>`

Attempts to resolve a pipeline blocker.

### `getStatus(): OrchestrationStatus`

Returns current orchestration status across all pipelines.

## Pipeline Stages

Pipelines progress through:
1. **Plan** - Scope and requirements
2. **Design** - Architecture and design
3. **Build** - Implementation
4. **Test** - Verification and validation
5. **Deploy** - Release and rollout
6. **Monitor** - Observability and health

## Examples

See `tests/test.ts` for usage examples.
