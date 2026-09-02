# Context Manager Usage Guide

## Overview

Autonomous Execution Context Detection & Validation. Validates that autonomous mode is active and properly configured.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { AutonomousContextManager } from './src/index';

const manager = new AutonomousContextManager();

// Check if autonomous mode is active
if (manager.isAutonomousMode()) {
  console.log('Autonomous mode enabled');
  const context = manager.getContext();
}
```

## API Reference

### `isAutonomousMode(): boolean`

Checks if autonomous mode is currently active.

- Returns `false` if context is invalid, expired, or unavailable
- Validates context before returning status

### `getContext(): AutonomousContext | null`

Gets the current autonomous context if valid.

- Returns `null` if context is invalid or expired
- Returns `AutonomousContext` object with execution rules

## Configuration

Context validation requires `.autonomous-context.json` in the working directory with:
- `enabled`: boolean
- `approvalHash`: string (SHA256)
- `sessionId`: string (UUID)
- `expiresAt`: timestamp (milliseconds)
- `rules`: object with approval settings

Default expiry: 1 hour (3600000ms)

## Examples

See `tests/test.ts` for usage examples.
