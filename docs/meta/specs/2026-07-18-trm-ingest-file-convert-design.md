# TRM `ingest --file` Auto-Conversion — Design

**Date:** 2026-07-18
**Status:** Design — pending user spec review

## Goal

Add a `--file <path>` option to `trm ingest` that converts a local `.docx`/`.pdf`/`.txt`/`.md` document to plain text and writes it directly to `sources/raw/SRC-###.txt`, closing the gap where raw-source-text writing has always been a manual, out-of-band step for every ingested source (confirmed: nothing in trm today writes `sources/raw/*.txt` automatically — `extract.ts:32` only ever *reads* it).

## Non-Goals

- Image/photo OCR or the CIC Harvester wiring (ImageAnalyzerV3, ReverseImageSearchExtractor) — separate, larger effort, not touched here.
- Any format beyond `.docx`/`.pdf`/`.txt`/`.md`.

## Architecture

### New module: `src/ingestion/fileConvert.ts`

```typescript
export async function convertFileToText(filePath: string): Promise<string>;
```

Dispatches by extension (case-insensitive):
- `.txt`, `.md` — read as-is via `fs.readFileSync(filePath, 'utf-8')`.
- `.docx` — `mammoth.extractRawText({ path: filePath })`, return `.value`.
- `.pdf` — `pdf-parse(fs.readFileSync(filePath))`, return `.text`.
- anything else — throw `Error` naming the extension and the four supported ones.

**Empty-content guard:** after conversion, if `text.trim().length === 0`, throw an error naming the file — a scanned/image-only document with no extractable text must fail loudly, not silently ingest a zero-content raw file that later shows up as "0 facts extracted" with no explanation.

**New dependencies:** `mammoth@1.12.0`, `pdf-parse@2.4.5` (both confirmed on the npm registry). This is new, separate work from the reporting-engine feature — that feature's "no new deps" constraint doesn't apply here.

### `runIngest` changes (`src/cli/commands/ingest.ts`)

```typescript
export async function runIngest(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; type: string; title: string; origin: string; url?: string; file?: string; dryRun?: boolean }
): Promise<SourceEntry | null> {
  const actor = resolveActor(root, cliArgs.actor);
  if (cliArgs.dryRun) return null;

  const url = cliArgs.url ?? (cliArgs.file ? `local:${path.basename(cliArgs.file)}` : undefined);
  if (!url) {
    throw new Error('trm ingest: either <url> or --file must be provided');
  }

  const text = cliArgs.file ? await convertFileToText(cliArgs.file) : undefined;

  const entry = addSource(root, topicPath, actor, { type: cliArgs.type, title: cliArgs.title, origin: cliArgs.origin, url });

  if (text !== undefined) {
    const rawPath = path.join(nodeDir(root, topicPath), 'sources', 'raw', `${entry.id}.txt`);
    fs.writeFileSync(rawPath, text);
  }

  return entry;
}
```

**Dry-run ordering:** unchanged from today's `ingest.ts` — the `dryRun` check runs first, before any conversion, addSource call, or write. This means a bad `--file` path or unsupported format will NOT surface during a dry run; it only surfaces on a real run. This is an intentional, accepted tradeoff (matches this file's existing early-return convention) — not a gap to fix here.

**Convert-before-`addSource` ordering:** `convertFileToText` runs before `addSource` (which writes `sources/metadata.json` and appends a lineage `INGEST` op), so an unsupported extension or empty-content error throws before any mutation happens — no orphaned source registration. The raw-file write itself still happens after `addSource`; if that write fails (disk full, permissions), the source is registered with no backing raw file. This residual case is accepted as non-fatal: `extract.ts:32` (`if (!fs.existsSync(rawFile)) continue;`) already silently skips any source with a missing raw file during extraction — the existing pipeline already tolerates this exact state, so no new error-handling code is needed to cover it.

### CLI wiring (`src/cli/index.ts`)

The `ingest` command's URL argument becomes optional, and the action handler becomes `async` (required — `convertFileToText` returns a `Promise`, and Commander does not await non-async `.action()` callbacks; an un-awaited async call here would fail silently as an unhandled rejection with no printed error):

```typescript
program
  .command('ingest <path> [url]')
  .requiredOption('--type <type>')
  .requiredOption('--title <title>')
  .requiredOption('--origin <origin>')
  .option('--actor <actor>')
  .option('--file <file>')
  .option('--dry-run')
  .action(async (path, url, opts) => {
    const entry = await runIngest(root, path, { ...opts, url, file: opts.file, dryRun: opts.dryRun });
    console.log(entry ? JSON.stringify(entry, null, 2) : '(dry-run, nothing written)');
  });
```

`SourceEntry.url` itself stays a required `string` at the type/schema level (no change to `metadata.schema.json`) — the optionality is only at the CLI argument layer; internally `runIngest` always resolves a concrete `url` value (either the caller's or the `local:` fallback) before calling `addSource`.

**`local:<basename>` collisions:** two different files sharing a filename (e.g. two different visits both producing an `index.docx`) get an identical derived `url` string. Not a correctness issue — `url` is not a uniqueness key anywhere in the schema or lookup code — just a citation-display nuance if it ever comes up.

## Error Handling

- Unsupported extension: `convertFileToText` throws before any I/O beyond the initial extension check.
- Empty extracted text: `convertFileToText` throws after conversion, before `addSource` is ever called (extension-check and empty-check both happen before the mutating `addSource` call, so neither failure mode leaves a partial/orphaned source registration).
- Missing/unreadable file: propagates the underlying `fs`/`mammoth`/`pdf-parse` error as-is (matches this codebase's existing convention of not wrapping filesystem errors, e.g. `readTopicMeta`'s raw `ENOENT` propagation).

## Testing

- **Unit — `convertFileToText`:** `.txt` and `.md` pass through unchanged; a real small `.docx` fixture converts to its known text; a real small `.pdf` fixture converts to its known text; unsupported extension throws naming the four supported types; a docx/pdf producing whitespace-only text throws the empty-content error.
- **Unit — `runIngest`:** existing behavior unchanged when `--file` is not given (url required, works exactly as before); with `--file` and no `url`, resolves to `local:<basename>` and writes `sources/raw/SRC-###.txt` with the converted content; with `--file` and no `url` AND no file (neither provided), throws the "either url or --file" error; dry-run with `--file` returns `null` and writes nothing (no raw file, no metadata).
- **Live smoke test:** re-run the Michigan Flight Museum ingestion from this session through the new `--file` flag against the real vault, confirming the resulting raw text matches (or improves on) the manually-extracted text used earlier, and that `trm validate` still passes clean.

## Spec Self-Review

- **Placeholder scan:** none.
- **Internal consistency:** `SourceEntry.url` stays required at the type/schema level while becoming optional only at the CLI-argument layer — stated explicitly to avoid the two being confused.
- **Scope check:** single cohesive unit (one new module + one modified command + CLI wiring); no decomposition needed.
- **Ambiguity check:** dry-run ordering, `addSource`-before-write ordering, async wiring requirement, and `local:` collision behavior are all stated explicitly as accepted tradeoffs rather than left as open questions (per the caveman-review pass on this design).
