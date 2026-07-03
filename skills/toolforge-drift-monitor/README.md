# Toolforge Drift Monitor

Detects drift between canonical, distributed, manifest, and Cowork systems. Runs daily on Task Scheduler.

## Installation

Requires: Node 18+, PowerShell 7+

## Usage

```bash
npx toolforge drift-monitor --check <all|canonical|distributed|manifest|cowork>
```

## Metadata

- **Category**: monitoring
- **Owner**: soren
- **Runtime**: TypeScript
- **Timeout**: 30s
- **Schedule**: Daily 09:00 UTC

## Output

Reports to Slack on drift detection via webhook.

## API

See `src/index.ts` for interface.
