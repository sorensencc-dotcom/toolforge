# Permission Governor Usage Guide

## Overview

Auto-approval of whitelisted operations with cache and bottleneck analysis. Governance layer for permission validation.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { PermissionGovernor } from './src/index';

const governor = new PermissionGovernor();

// Check if operation is whitelisted
if (governor.isWhitelisted('deploy')) {
  console.log('Operation approved');
}

// Analyze bottlenecks
const bottlenecks = governor.analyzeBottleneck();
console.log('Bottleneck analysis:', bottlenecks);
```

## API Reference

### `isWhitelisted(operation: string): boolean`

Determines if an operation is in the approval whitelist.

### `analyzeBottleneck(): BottleneckReport`

Analyzes current permission bottlenecks and cache performance.

### `getCacheStats(): CacheMetrics`

Returns cache performance metrics.

## Configuration

Whitelist operations in `src/permission-config.json`:

```json
{
  "whitelisted": ["deploy", "publish", "release"],
  "cacheMaxAge": 3600000,
  "maxRetries": 3
}
```

## Examples

See `tests/test.ts` for usage examples.
