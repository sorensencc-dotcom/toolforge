# Agent Drift Detector Usage Guide

## Overview

Detect schema drift in agent messages and APIs. Monitors for protocol violations and version mismatches.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { AgentDriftDetector } from './src/index';

const detector = new AgentDriftDetector();

// Detect schema drift in a message
const driftReport = detector.detectSchemaShift({
  type: 'message',
  payload: { /* agent message */ }
});

if (driftReport.driftDetected) {
  console.log('Schema drift detected:', driftReport.changes);
}
```

## API Reference

### `detectSchemaShift(message: object): DriftReport`

Detects schema divergence from canonical agent message format.

Returns object with:
- `driftDetected`: boolean
- `changes`: Array of detected schema changes
- `severity`: 'low' | 'medium' | 'high'

### `validateAgentSchema(message: object): boolean`

Validates message against canonical schema.

### `reportDrift(): DriftAnalysisReport`

Generates comprehensive drift analysis report across all monitored agents.

## Monitored Fields

- Message type and version
- Payload structure
- Timestamp and session ID
- Required headers
- Security signatures

## Examples

See `tests/test.ts` for usage examples.
