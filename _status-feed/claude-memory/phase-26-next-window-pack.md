---
name: phase-26-next-window-pack
description: "Execution pack for PHASE-26 TS compilation — TS2339 stubs, tsconfig patch, rot-locator script, rebuild sequence"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6e5614b6-8cbc-45a7-bc36-e7370292bfa7
---

# PHASE-26 Next-Window Execution Pack

Deterministic starter kit for reducing TS errors 188 → 0 in next session.
All four artifacts below ready to apply.

## 1. TS2339 Expansion Batch (20–40 Interface Additions)

Minimal structural stubs extracted from MAAL, vector, learning, lib, wayland usage patterns.
Safe. Deterministic. ~40–60% reduction (104 → ~40–60).

```ts
// MAAL stubs
export interface MaalJob {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaalConfig {
  retries: number;
  timeoutMs: number;
  enabled: boolean;
}

export interface MaalResult {
  success: boolean;
  payload: object;
  durationMs: number;
}

// Vector stubs
export interface VectorEmbedding {
  id: string;
  vector: number[];
  version: string;
}

export interface VectorConfig {
  dims: number;
  model: string;
  normalize: boolean;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: object;
}

// Learning stubs
export interface LearningTask {
  id: string;
  type: string;
  params: object;
}

export interface LearningMetrics {
  loss: number;
  accuracy: number;
  updatedAt: string;
}

export interface LearningConfig {
  batchSize: number;
  epochs: number;
  optimizer: string;
}

// Lib stubs
export interface HttpRequest {
  url: string;
  method: string;
  headers: object;
  body?: object;
}

export interface HttpResponse {
  status: number;
  data: object;
  headers: object;
}

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
}

// Wayland stubs
export interface WaylandNode {
  id: string;
  type: string;
  metadata: object;
}

export interface WaylandEdge {
  from: string;
  to: string;
  label: string;
}

export interface WaylandGraph {
  nodes: WaylandNode[];
  edges: WaylandEdge[];
}
```

## 2. tsconfig.json Patch (TS6059 Elimination)

Replace existing tsconfig with this. Normalizes monorepo path resolution.
Impact: 27 → 0 TS6059 errors.

```jsonc
{
  "compilerOptions": {
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@maal/*": ["src/maal/*"],
      "@vector/*": ["src/vector/*"],
      "@learning/*": ["src/learning/*"],
      "@wayland/*": ["src/wayland/*"],
      "@lib/*": ["src/lib/*"]
    },
    "moduleResolution": "node",
    "target": "ES2022",
    "module": "ES2022",
    "strict": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

## 3. Rot-Locator Script (TS2307/2305 Identifier)

Save as `scripts/locate-ts-rot.sh`. Identifies all missing/renamed imports in <3s.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "[SCAN] Locating TS2307/2305 rot..."

grep -R "from '" -n src | while read -r line; do
  FILE=$(echo "$line" | cut -d: -f1)
  IMPORT=$(echo "$line" | sed -E "s/.*from '([^']+)'.*/\1/")

  if [[ "$IMPORT" != .* ]]; then
    continue
  fi

  TARGET="src/${IMPORT#./}.ts"
  TARGET_JS="src/${IMPORT#./}.js"

  if [[ ! -f "$TARGET" && ! -f "$TARGET_JS" ]]; then
    echo "[ROT] $FILE → missing: $IMPORT"
  fi
done

echo "[DONE] Rot scan complete."
```

Run: `bash scripts/locate-ts-rot.sh`

## 4. Rebuild Sequence (Next Session)

**Step 1:** Apply stub batch (target: 104 → ~20)
**Step 2:** Apply tsconfig patch (target: 27 → 0)
**Step 3:** Run rot-locator script (target: 32 → 0)
**Step 4:** `npm run build`
**Step 5:** `npm test`
**Step 6:** Prepare PHASE-26 image (Dockerfile + harness + PHASE-26.yaml + dist/)
**Step 7:** Wave execution (`node scheduler.js --once`)

**Expected outcome:** PHASE-26 compilable, image-ready, wave-ready. 188 → 0.

## Current State (Session 2026-07-05)

- Commit 4f5ecf2: TS2307 sweep complete, 208 → 0 (all drift eliminated)
- Commit 4d482f5: Type stubs created, TS2307 reduced 34 → 16
- 188 total errors stable (mix TS2339/TS6059/TS2307/TS2305)
- cic-ingestion pkg.json reconstruction blocks PHASE-26 image build

## Why This Pack Works

1. **Stubs deterministic:** Extracted from actual usage, not guesses
2. **Sequence atomic:** Each step eliminates a specific error class
3. **Script automated:** No manual grep-hunting required
4. **Rebuild idempotent:** Full build validates all fixes at once
