# TRM Reporting Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `trm report <path>` command that reads a vault topic node's existing data and generates a Cast Iron Charlie–styled HTML research report via a two-stage export→render pipeline.

**Architecture:** `exportBundle()` reads a topic node (`topic.json`, `sources/metadata.json`, `extracts/extract.json`) and produces a versioned `ReportBundle` JSON — the only contract the render stage depends on. `renderHtml()` takes that bundle and produces an HTML string via plain template-literal substitution (no templating library), with defensive HTML-escaping, category-grouping, and orphaned-source-reference handling. `runReport()` wires both stages together, validates `--theme` before either stage runs, and writes both the bundle and the rendered HTML to `<vault-root>/reports/`.

**Tech Stack:** TypeScript, Node `node:fs`/`node:path`/`node:crypto`, existing trm test runner (Jest, per `package.json`).

## Global Constraints

- Bundle schema fields exactly as specified: `version`, `topicPath`, `topicSlug`, `generatedAt`, `sourceCount`, `factCount`, `stats: {sourceCount, factCount}`, `facts: [{text, sourceId, confidence, categories}]`, `sources: [{id, type, title, origin, url, addedAt}]`, `theme` (spec §Stage 1).
- `topicSlug` is the full topic path with `/` replaced by `-` (e.g. `charlie/cuba` → `charlie-cuba`), never leaf-only (spec Refinement 3).
- Only `theme === "cic"` is implemented in v1; any other value is a hard error, validated in the CLI command layer *before* `exportBundle` runs, and again in `renderHtml` as a second guard (spec §CLI wiring, §Data Flow).
- A fact groups under `categories[0]` only, never duplicated across sections; empty `categories` → `"Uncategorized"` (spec Refinement 1).
- All bundle-derived strings injected into HTML pass through an `escapeHtml()` helper before injection (spec Refinement 2).
- A fact's `sourceId` with no match in `bundle.sources[]` renders `[Unknown Source]`, not a crash or `undefined` (spec Refinement 4).
- Output filenames: `<topicSlug>-<timestamp>.json` / `.html` in `<vault-root>/reports/`, where `<timestamp>` is `Date.now()` plus a 4-hex-char random suffix, guarding against same-millisecond collisions (spec §CLI wiring).
- `reports/` directory created recursively before writing (spec §CLI wiring).
- No new dependencies — `commander` + `ajv` remain the only runtime deps (spec §Stage 2).

---

### Task 1: `ReportBundle` type + `exportBundle()`

**Files:**
- Create: `C:\dev\trm\src\reporting\types.ts`
- Create: `C:\dev\trm\src\reporting\exportBundle.ts`
- Test: `C:\dev\trm\tests\reporting\exportBundle.test.ts`

**Interfaces:**
- Consumes: `readTopicMeta(root: string, topicPath: string): TopicMeta` (`src/core/topicNode.ts:11`); `nodeDir(root: string, topicPath: string): string` and `splitPath(topicPath: string): string[]` (`src/core/paths.ts`); `SourceEntry` shape `{id, type, title, origin, url, added_at, actor}` (`src/core/sourceIngest.ts:7-14`, read from `sources/metadata.json`); `Fact` shape `{id, text, source_id, confidence, categories}` (`src/scoring/types.ts:3-8`, read from `extracts/extract.json`).
- Produces: `ReportBundle` interface and `exportBundle(root: string, topicPath: string, theme?: string): ReportBundle`, both from `src/reporting/types.ts` and `src/reporting/exportBundle.ts` respectively — consumed by Task 2 (`renderHtml`) and Task 3 (`runReport`).

- [ ] **Step 1: Write `ReportBundle` type**

```typescript
// C:\dev\trm\src\reporting\types.ts
export interface ReportBundleFact {
  text: string;
  sourceId: string;
  confidence: number;
  categories: string[];
}

export interface ReportBundleSource {
  id: string;
  type: string;
  title: string;
  origin: string;
  url: string;
  addedAt: string;
}

export interface ReportBundle {
  version: string;
  topicPath: string;
  topicSlug: string;
  generatedAt: string;
  sourceCount: number;
  factCount: number;
  stats: {
    sourceCount: number;
    factCount: number;
  };
  facts: ReportBundleFact[];
  sources: ReportBundleSource[];
  theme: string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// C:\dev\trm\tests\reporting\exportBundle.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runIngest } from '../../src/cli/commands/ingest';
import { exportBundle } from '../../src/reporting/exportBundle';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-report-'));
  fs.writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' })
  );
  return root;
}

function writeExtract(root: string, topicPath: string, facts: unknown[]) {
  const dir = path.join(root, 'topics', ...topicPath.split('/'), 'extracts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify({ facts }));
}

describe('exportBundle', () => {
  it('produces a bundle with correct shape, counts, and unchanged topicPath', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    runIngest(root, 'charlie/cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Doc', origin: 'LOC', url: 'x' });
    writeExtract(root, 'charlie/cuba', [
      { id: 'FCT-001', text: 'A fact.', source_id: 'SRC-001', confidence: 0.9, categories: ['biography'] },
    ]);

    const bundle = exportBundle(root, 'charlie/cuba');

    expect(bundle.version).toBe('1.0.0');
    expect(bundle.topicPath).toBe('charlie/cuba');
    expect(bundle.sourceCount).toBe(1);
    expect(bundle.factCount).toBe(1);
    expect(bundle.stats).toEqual({ sourceCount: 1, factCount: 1 });
    expect(bundle.facts[0]).toEqual({ text: 'A fact.', sourceId: 'SRC-001', confidence: 0.9, categories: ['biography'] });
    expect(bundle.sources[0].id).toBe('SRC-001');
    expect(bundle.theme).toBe('cic');
  });

  it('flattens a nested topic path into a hyphenated slug', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    const bundle = exportBundle(root, 'charlie/cuba');
    expect(bundle.topicSlug).toBe('charlie-cuba');
  });

  it('treats a missing extract.json as zero facts, not an error', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    const bundle = exportBundle(root, 'charlie/cuba');
    expect(bundle.facts).toEqual([]);
    expect(bundle.factCount).toBe(0);
  });

  it('throws if the topic node does not exist', () => {
    const root = makeRoot();
    expect(() => exportBundle(root, 'nonexistent/topic')).toThrow();
  });

  it('defaults theme to "cic" when not specified', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    const bundle = exportBundle(root, 'charlie/cuba');
    expect(bundle.theme).toBe('cic');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd C:\dev\trm && npx jest tests/reporting/exportBundle.test.ts`
Expected: FAIL — `Cannot find module '../../src/reporting/exportBundle'`

- [ ] **Step 4: Write the implementation**

```typescript
// C:\dev\trm\src\reporting\exportBundle.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir, splitPath } from '../core/paths';
import { readTopicMeta } from '../core/topicNode';
import { Fact } from '../scoring/types';
import { SourceEntry } from '../core/sourceIngest';
import { ReportBundle } from './types';

interface SourceMetadataFile {
  sources: SourceEntry[];
}

interface ExtractFile {
  facts: Fact[];
}

function readSources(root: string, topicPath: string): SourceEntry[] {
  const file = path.join(nodeDir(root, topicPath), 'sources', 'metadata.json');
  if (!fs.existsSync(file)) return [];
  const parsed: SourceMetadataFile = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return parsed.sources;
}

function readFacts(root: string, topicPath: string): Fact[] {
  const file = path.join(nodeDir(root, topicPath), 'extracts', 'extract.json');
  if (!fs.existsSync(file)) return [];
  const parsed: ExtractFile = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return parsed.facts;
}

export function exportBundle(root: string, topicPath: string, theme = 'cic'): ReportBundle {
  readTopicMeta(root, topicPath); // throws ENOENT if the node doesn't exist

  const sources = readSources(root, topicPath);
  const facts = readFacts(root, topicPath);
  const topicSlug = splitPath(topicPath).join('-');

  return {
    version: '1.0.0',
    topicPath,
    topicSlug,
    generatedAt: new Date().toISOString(),
    sourceCount: sources.length,
    factCount: facts.length,
    stats: {
      sourceCount: sources.length,
      factCount: facts.length,
    },
    facts: facts.map((f) => ({
      text: f.text,
      sourceId: f.source_id,
      confidence: f.confidence,
      categories: f.categories,
    })),
    sources: sources.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      origin: s.origin,
      url: s.url,
      addedAt: s.added_at,
    })),
    theme,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd C:\dev\trm && npx jest tests/reporting/exportBundle.test.ts`
Expected: PASS, 5/5

- [ ] **Step 6: Commit**

```bash
cd C:\dev\trm
git add src/reporting/types.ts src/reporting/exportBundle.ts tests/reporting/exportBundle.test.ts
git commit -m "feat: add ReportBundle type and exportBundle()"
```

---

### Task 2: `renderHtml()`

**Files:**
- Create: `C:\dev\trm\src\reporting\renderHtml.ts`
- Test: `C:\dev\trm\tests\reporting\renderHtml.test.ts`

**Interfaces:**
- Consumes: `ReportBundle`, `ReportBundleFact`, `ReportBundleSource` from `../reporting/types` (Task 1).
- Produces: `renderHtml(bundle: ReportBundle): string` from `src/reporting/renderHtml.ts` — consumed by Task 3 (`runReport`).

- [ ] **Step 1: Write the failing test**

```typescript
// C:\dev\trm\tests\reporting\renderHtml.test.ts
import { renderHtml } from '../../src/reporting/renderHtml';
import { ReportBundle } from '../../src/reporting/types';

function baseBundle(overrides: Partial<ReportBundle> = {}): ReportBundle {
  return {
    version: '1.0.0',
    topicPath: 'charlie/cuba',
    topicSlug: 'charlie-cuba',
    generatedAt: '2026-07-18T00:00:00.000Z',
    sourceCount: 0,
    factCount: 0,
    stats: { sourceCount: 0, factCount: 0 },
    facts: [],
    sources: [],
    theme: 'cic',
    ...overrides,
  };
}

describe('renderHtml', () => {
  it('renders topic name, fact text, and source citation', () => {
    const bundle = baseBundle({
      sourceCount: 1,
      factCount: 1,
      stats: { sourceCount: 1, factCount: 1 },
      sources: [{ id: 'SRC-001', type: 'pdf', title: 'Doc Title', origin: 'LOC', url: 'https://x', addedAt: '2026-07-18T00:00:00.000Z' }],
      facts: [{ text: 'A plain fact.', sourceId: 'SRC-001', confidence: 0.9, categories: ['biography'] }],
    });
    const html = renderHtml(bundle);
    expect(html).toContain('charlie/cuba');
    expect(html).toContain('A plain fact.');
    expect(html).toContain('Doc Title');
  });

  it('throws on an unsupported theme', () => {
    const bundle = baseBundle({ theme: 'not-cic' });
    expect(() => renderHtml(bundle)).toThrow(/theme/i);
  });

  it('renders cleanly with empty facts and sources', () => {
    const html = renderHtml(baseBundle());
    expect(html).toContain('charlie/cuba');
    expect(html).not.toContain('undefined');
  });

  it('escapes HTML special characters in fact text and source titles', () => {
    const bundle = baseBundle({
      sourceCount: 1,
      factCount: 1,
      stats: { sourceCount: 1, factCount: 1 },
      sources: [{ id: 'SRC-001', type: 'pdf', title: '<script>alert(1)</script>', origin: 'LOC', url: 'https://x', addedAt: '2026-07-18T00:00:00.000Z' }],
      facts: [{ text: 'A fact with <b>tags</b> & "quotes".', sourceId: 'SRC-001', confidence: 0.9, categories: [] }],
    });
    const html = renderHtml(bundle);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;tags&lt;/b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quotes&quot;');
  });

  it('groups a multi-category fact under only its first category, never duplicated', () => {
    const bundle = baseBundle({
      factCount: 1,
      stats: { sourceCount: 0, factCount: 1 },
      facts: [{ text: 'Multi-cat fact.', sourceId: 'SRC-001', confidence: 0.9, categories: ['economics', 'geopolitics'] }],
    });
    const html = renderHtml(bundle);
    const occurrences = html.split('Multi-cat fact.').length - 1;
    expect(occurrences).toBe(1);
    expect(html).toContain('economics');
    expect(html.indexOf('economics')).toBeLessThan(html.indexOf('Multi-cat fact.'));
  });

  it('groups a no-category fact under "Uncategorized"', () => {
    const bundle = baseBundle({
      factCount: 1,
      stats: { sourceCount: 0, factCount: 1 },
      facts: [{ text: 'No-category fact.', sourceId: 'SRC-001', confidence: 0.9, categories: [] }],
    });
    const html = renderHtml(bundle);
    expect(html).toContain('Uncategorized');
  });

  it('renders "[Unknown Source]" for a fact whose sourceId has no match', () => {
    const bundle = baseBundle({
      factCount: 1,
      stats: { sourceCount: 0, factCount: 1 },
      facts: [{ text: 'Orphaned fact.', sourceId: 'SRC-999', confidence: 0.9, categories: [] }],
    });
    const html = renderHtml(bundle);
    expect(html).toContain('[Unknown Source]');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\dev\trm && npx jest tests/reporting/renderHtml.test.ts`
Expected: FAIL — `Cannot find module '../../src/reporting/renderHtml'`

- [ ] **Step 3: Write the implementation**

```typescript
// C:\dev\trm\src\reporting\renderHtml.ts
import { ReportBundle, ReportBundleFact, ReportBundleSource } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CIC_CSS = `
:root {
  --ink: #1a1a1a; --muted: #555; --rule: #c8b89a; --accent: #8b3a2a;
  --bg: #fdfaf6; --font-body: 'Crimson Pro', Georgia, serif; --font-ui: 'Source Sans 3', system-ui, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-body); font-size: 11.5pt; line-height: 1.65; color: var(--ink); background: var(--bg); max-width: 820px; margin: 0 auto; }
.cover { min-height: 40vh; display: flex; flex-direction: column; justify-content: center; padding: 60px; border-bottom: 3px solid var(--rule); }
.cover-label { font-family: var(--font-ui); font-size: 9pt; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); margin-bottom: 20px; }
.cover h1 { font-size: 30pt; font-weight: 600; margin-bottom: 12px; }
.cover-subtitle { font-size: 13pt; font-style: italic; color: var(--muted); }
.section { padding: 40px 60px; border-bottom: 1px solid var(--rule); }
h2 { font-family: var(--font-ui); font-size: 9pt; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); margin-bottom: 16px; padding-bottom: 6px; border-bottom: 1px solid var(--rule); }
h3 { font-size: 13pt; font-weight: 600; margin: 20px 0 8px; }
.stats-bar { display: flex; gap: 30px; flex-wrap: wrap; }
.stat-item { display: flex; flex-direction: column; }
.stat-value { font-size: 22pt; font-weight: 600; color: var(--accent); }
.stat-label { font-family: var(--font-ui); font-size: 8.5pt; color: var(--muted); text-transform: uppercase; }
.evidence-item { margin-bottom: 14px; padding-left: 14px; border-left: 2px solid var(--rule); }
.ev-citation { font-size: 10.5pt; }
.ev-meta { font-family: var(--font-ui); font-size: 8.5pt; color: var(--muted); }
.fact-item { margin-bottom: 12px; padding-left: 14px; border-left: 2px solid var(--rule); }
.fact-meta { font-family: var(--font-ui); font-size: 8.5pt; color: var(--muted); display: block; margin-top: 2px; }
`;

function groupFactsByCategory(facts: ReportBundleFact[]): Map<string, ReportBundleFact[]> {
  const groups = new Map<string, ReportBundleFact[]>();
  for (const fact of facts) {
    const category = fact.categories[0] ?? 'Uncategorized';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(fact);
  }
  return groups;
}

function citationFor(sourceId: string, sources: ReportBundleSource[]): string {
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return '[Unknown Source]';
  return `${escapeHtml(source.title)} (${escapeHtml(source.origin)})`;
}

function renderStatsBar(bundle: ReportBundle): string {
  return `
<div class="section">
  <h2>Research at a Glance</h2>
  <div class="stats-bar">
    <div class="stat-item"><span class="stat-value">${bundle.stats.sourceCount}</span><span class="stat-label">Sources</span></div>
    <div class="stat-item"><span class="stat-value">${bundle.stats.factCount}</span><span class="stat-label">Facts</span></div>
  </div>
</div>`;
}

function renderNarrative(bundle: ReportBundle): string {
  return `
<div class="section">
  <h2>Narrative Research Summary</h2>
  <p>[Manual narrative summary for ${escapeHtml(bundle.topicPath)} goes here.]</p>
</div>`;
}

function renderEvidenceRegister(bundle: ReportBundle): string {
  const items = bundle.sources
    .map(
      (s, i) => `
<div class="evidence-item">
  <div class="ev-citation">[${i + 1}] "${escapeHtml(s.title)}" — ${escapeHtml(s.origin)}. ${escapeHtml(s.url)}</div>
  <div class="ev-meta">Type: ${escapeHtml(s.type)} · Added: ${escapeHtml(s.addedAt)}</div>
</div>`
    )
    .join('');
  return `
<div class="section">
  <h2>Evidence Register</h2>
  ${items}
</div>`;
}

function renderFactsList(bundle: ReportBundle): string {
  const groups = groupFactsByCategory(bundle.facts);
  const sections = [...groups.entries()]
    .map(([category, facts]) => {
      const items = facts
        .map(
          (fact) => `
<div class="fact-item">
  <p>${escapeHtml(fact.text)}</p>
  <span class="fact-meta">confidence: ${fact.confidence} · source: ${citationFor(fact.sourceId, bundle.sources)}</span>
</div>`
        )
        .join('');
      return `<h3>${escapeHtml(category)}</h3>${items}`;
    })
    .join('');
  return `
<div class="section">
  <h2>Facts</h2>
  ${sections}
</div>`;
}

export function renderHtml(bundle: ReportBundle): string {
  if (bundle.theme !== 'cic') {
    throw new Error(`renderHtml: unsupported theme "${bundle.theme}" (only "cic" is implemented)`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(bundle.topicPath)} — Research Report</title>
<style>${CIC_CSS}</style>
</head>
<body>
<div class="cover">
  <div class="cover-label">TRM Research Report</div>
  <h1>${escapeHtml(bundle.topicPath)}</h1>
  <div class="cover-subtitle">Generated ${escapeHtml(bundle.generatedAt)}</div>
</div>
${renderStatsBar(bundle)}
${renderNarrative(bundle)}
${renderEvidenceRegister(bundle)}
${renderFactsList(bundle)}
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\dev\trm && npx jest tests/reporting/renderHtml.test.ts`
Expected: PASS, 7/7

- [ ] **Step 5: Commit**

```bash
cd C:\dev\trm
git add src/reporting/renderHtml.ts tests/reporting/renderHtml.test.ts
git commit -m "feat: add renderHtml() with escaping, category grouping, orphan-ref handling"
```

---

### Task 3: `runReport()` CLI command + wiring

**Files:**
- Create: `C:\dev\trm\src\cli\commands\report.ts`
- Modify: `C:\dev\trm\src\cli\index.ts` (add import + command registration)
- Test: `C:\dev\trm\tests\cli\report.test.ts`

**Interfaces:**
- Consumes: `exportBundle(root, topicPath, theme?)` (Task 1), `renderHtml(bundle)` (Task 2).
- Produces: `runReport(root: string, topicPath: string, cliArgs: { theme?: string }): { bundlePath: string; htmlPath: string }` from `src/cli/commands/report.ts` — consumed by `cli/index.ts`'s `report` command.

- [ ] **Step 1: Write the failing test**

```typescript
// C:\dev\trm\tests\cli\report.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runIngest } from '../../src/cli/commands/ingest';
import { runReport } from '../../src/cli/commands/report';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-report-cli-'));
  fs.writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' })
  );
  return root;
}

describe('runReport', () => {
  it('writes a bundle.json and .html file under reports/, named from the flattened slug', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    runIngest(root, 'charlie/cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Doc', origin: 'LOC', url: 'x' });

    const { bundlePath, htmlPath } = runReport(root, 'charlie/cuba', {});

    expect(fs.existsSync(bundlePath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(path.basename(bundlePath)).toMatch(/^charlie-cuba-\d+-[0-9a-f]{4}\.json$/);
    expect(path.dirname(bundlePath)).toBe(path.join(root, 'reports'));

    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
    expect(bundle.topicPath).toBe('charlie/cuba');

    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('charlie/cuba');
  });

  it('creates the reports/ directory if it does not exist yet', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    expect(fs.existsSync(path.join(root, 'reports'))).toBe(false);
    runReport(root, 'charlie/cuba', {});
    expect(fs.existsSync(path.join(root, 'reports'))).toBe(true);
  });

  it('rejects an unsupported theme before touching the filesystem', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    expect(() => runReport(root, 'charlie/cuba', { theme: 'bogus' })).toThrow(/theme/i);
    expect(fs.existsSync(path.join(root, 'reports'))).toBe(false);
  });

  it('produces distinct filenames on two immediate successive calls', () => {
    const root = makeRoot();
    runCreate(root, 'charlie/cuba', { actor: 'ACTOR-001' });
    const first = runReport(root, 'charlie/cuba', {});
    const second = runReport(root, 'charlie/cuba', {});
    expect(first.htmlPath).not.toBe(second.htmlPath);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\dev\trm && npx jest tests/cli/report.test.ts`
Expected: FAIL — `Cannot find module '../../src/cli/commands/report'`

- [ ] **Step 3: Write the implementation**

```typescript
// C:\dev\trm\src\cli\commands\report.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { exportBundle } from '../../reporting/exportBundle';
import { renderHtml } from '../../reporting/renderHtml';

const SUPPORTED_THEMES = ['cic'];

export function runReport(
  root: string,
  topicPath: string,
  cliArgs: { theme?: string }
): { bundlePath: string; htmlPath: string } {
  const theme = cliArgs.theme ?? 'cic';
  if (!SUPPORTED_THEMES.includes(theme)) {
    throw new Error(`trm report: unsupported theme "${theme}" (supported: ${SUPPORTED_THEMES.join(', ')})`);
  }

  const bundle = exportBundle(root, topicPath, theme);
  const html = renderHtml(bundle);

  const reportsDir = path.join(root, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const suffix = crypto.randomBytes(2).toString('hex');
  const stamp = `${Date.now()}-${suffix}`;
  const bundlePath = path.join(reportsDir, `${bundle.topicSlug}-${stamp}.json`);
  const htmlPath = path.join(reportsDir, `${bundle.topicSlug}-${stamp}.html`);

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
  fs.writeFileSync(htmlPath, html);

  return { bundlePath, htmlPath };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\dev\trm && npx jest tests/cli/report.test.ts`
Expected: PASS, 4/4

- [ ] **Step 5: Wire into `cli/index.ts`**

Change the top of the file from:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runCreate } from './commands/create';
import { runIngest } from './commands/ingest';
import { runExtract } from './commands/extract';
import { runScore } from './commands/score';
import { runCrosslink } from './commands/crosslink';
import { runVersionBump } from './commands/versionBump';
import { runValidate } from './commands/validate';
import { assertSafeRoot } from '../core/rootSafety';

const root = process.cwd();
assertSafeRoot(root);
const program = new Command();
```

to:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runCreate } from './commands/create';
import { runIngest } from './commands/ingest';
import { runExtract } from './commands/extract';
import { runScore } from './commands/score';
import { runCrosslink } from './commands/crosslink';
import { runVersionBump } from './commands/versionBump';
import { runValidate } from './commands/validate';
import { runReport } from './commands/report';
import { assertSafeRoot } from '../core/rootSafety';

const root = process.cwd();
assertSafeRoot(root);
const program = new Command();
```

Then add, after the existing `extract` command block (near `src/cli/index.ts:39-47`):

```typescript
program
  .command('report <path>')
  .option('--theme <theme>')
  .action((path, opts) => {
    const { bundlePath, htmlPath } = runReport(root, path, { theme: opts.theme });
    console.log(bundlePath);
    console.log(htmlPath);
  });
```

- [ ] **Step 6: Full test suite passes**

Run: `cd C:\dev\trm && npx jest`
Expected: PASS, all suites (23 pre-existing + 3 new = 26 suites), 0 failures

- [ ] **Step 7: Typecheck**

Run: `cd C:\dev\trm && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Build**

Run: `cd C:\dev\trm && npx tsc`
Expected: no errors, `dist/cli/commands/report.js` and `dist/reporting/*.js` produced

- [ ] **Step 9: Live smoke test — generate a real report from the vault**

Run:
```bash
cd /c/Users/soren/trm-vault
node C:/dev/trm/dist/cli/index.js report charlie/cuba
```
Expected: exits 0, prints two paths under `trm-vault/reports/`, both files exist. Open the printed `.html` path in a browser (or `Read` it) to visually confirm cover/stats/evidence/facts sections render with the real `charlie/cuba` data (7 sources, 85 facts) and no `undefined`/raw-HTML artifacts.

Also confirm the guardrail still fires correctly for this new command (it's wired through the same `cli/index.ts` entrypoint as every other command):
```bash
cd /c/dev/charlie-deep-research
node C:/dev/trm/dist/cli/index.js report charlie/cuba
```
Expected: exits non-zero, stderr contains `trm refuses to run`.

- [ ] **Step 10: Commit**

```bash
cd C:\dev\trm
git add src/cli/commands/report.ts src/cli/index.ts tests/cli/report.test.ts
git commit -m "feat: wire trm report CLI command"
```

---

## Self-Review Notes

- **Spec coverage:** §Goal → Task 3 Step 9. §Non-Goals → no tasks created for entity graph/timeline/gap/PDF/Word/PPT/exec-summary/pluggable-theming, matching the spec's explicit exclusions. §Stage 1 (bundle schema, incl. Refinement 3 slug flattening) → Task 1. §Stage 2 (escaping, category grouping incl. Refinement 1, orphan-ref fallback incl. Refinement 4) → Task 2. §CLI wiring (fail-fast theme validation, timestamp+random-suffix collision guard, recursive mkdir) → Task 3. §Output Location → Task 3 (`reports/` at vault root). §Error Handling (`exportBundle` ENOENT via `readTopicMeta`, `renderHtml` theme throw, empty-array handling) → Task 1 Step 2 test 4, Task 2 Step 1 tests 2/3. §Testing (unit + CLI + live smoke, incl. the fail-fast-before-I/O and collision-guard tests added in the caveman-review pass) → Task 1 Step 2, Task 2 Step 1, Task 3 Steps 1 and 9.
- **Placeholder scan:** none — every step has complete, runnable code; the narrative section's bracketed placeholder text is the spec's own explicit "manual-fill" design, not an unfinished plan step.
- **Type consistency:** `ReportBundle`/`ReportBundleFact`/`ReportBundleSource` (Task 1) used identically in Task 2's `renderHtml` signature and Task 3's `runReport`; `exportBundle(root, topicPath, theme?)` and `renderHtml(bundle)` signatures match between their Task 1/2 definitions and Task 3's call sites.
