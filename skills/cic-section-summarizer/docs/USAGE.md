# CIC Section Summarizer Usage Guide

## Overview

Auto-summarize CIC phase progress and files reviewed. Generates progress reports for governance phases.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { summarizeSection } from './src/index';

const summary = summarizeSection({
  sectionId: 'phase-27-wave-a',
  files: ['index.ts', 'utils.ts', 'spec.md']
});

console.log(`Progress: ${summary.percentComplete}%`);
console.log(`Status: ${summary.status}`);
console.log(`Blockers: ${summary.blockers.join(', ')}`);
```

## API Reference

### `summarizeSection(params: SummarizeSectionParams): SummarizeSectionResult`

Generates a progress summary for a CIC section.

**Parameters:**
- `sectionId`: Required. Section/phase identifier
- `files`: Optional. List of files reviewed in section

**Returns:**
- `sectionId`: Section identifier
- `percentComplete`: Progress percentage (0-100)
- `filesReviewed`: Count of files analyzed
- `status`: 'near-complete' | 'in-progress'
- `blockers`: List of identified blockers
- `missingTests`: Files without test coverage
- `nextSteps`: Recommended next actions

## Examples

See `tests/test.ts` for usage examples.
