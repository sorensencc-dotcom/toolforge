# CIC Roadmap Updater Usage Guide

## Overview

Calculates progress and updates versions for CIC roadmaps. Maintains semantic versioning and phase tracking.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { CicRoadmapUpdater } from './src/index';

const updater = new CicRoadmapUpdater();

// Calculate phase progress
const progress = updater.calculateProgress('phase-27');
console.log(`Phase progress: ${progress}%`);

// Update version
await updater.updateVersion('phase-27', '27.1.0');
console.log('Version updated');

// Sync all roadmap state
await updater.syncRoadmap();
```

## API Reference

### `calculateProgress(phaseId: string): number`

Calculates completion percentage for a phase.

- Returns: 0-100 percentage
- Based on: committed items, completed items, blockers

### `updateVersion(phaseId: string, version: string): Promise<void>`

Updates phase version with semantic versioning validation.

- Validates semver format (major.minor.patch)
- Updates roadmap JSON
- Triggers dependent phase recalculations

### `syncRoadmap(): Promise<void>`

Synchronizes all roadmap state and versions. Recalculates dependencies and impact.

## Version Format

Follow semantic versioning:
```
phase-N.minor.patch
27.1.0   = Phase 27, first minor release, patch 0
27.2.1   = Phase 27, second minor release, patch 1
```

## Examples

See `tests/test.ts` for usage examples.
