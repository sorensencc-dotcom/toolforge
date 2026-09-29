# Ironbots Fleet Status Monitor - Usage Guide

## Quickstart

```typescript
import handler from '../src/index.js';

const result = await handler({
  action: 'aggregate',
  statusFeedDir: '_status-feed',
  verbose: true
});

console.log(`Fleet Score: ${result.fleetScore}/100`);
console.log(`Healthy Tasks: ${result.healthyCount}/${result.totalTasks}`);
```

## Actions

### `status`
Performs a fast, non-blocking inspection of all bot task artifacts.

### `aggregate`
Performs a full health evaluation, computing fleet health scores and identifying alert triggers.

### `diagnose`
Returns verbose failure details and stack traces for all degraded or failing tasks.
