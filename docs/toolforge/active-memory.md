# Active memory

Active memory keeps facts, decisions, constraints, and failures across agent sessions. Toolforge stores each entry in an encrypted SQLite file inside the workspace and appends the entries that match a query to a system prompt.

## Commands

Run each command from the workspace root, or pass `--workspace <path>`.

```bash
toolforge memory add "Never force-push to main" --kind constraint --tag git
toolforge memory list --kind constraint --tag git --json
toolforge memory prune --older-than 30 --dry-run
toolforge memory prune --id <entry-id>
```

- `memory add <text>` stores an entry. `--kind` takes `fact` (the default), `decision`, `constraint`, or `failure`. Repeat `--tag` to add several tags. Toolforge stores tags in lowercase. `--tag CI` matches an entry tagged `ci`. `--source` defaults to `cli`.
- `memory list` prints every entry. Filter with `--kind` and `--tag`, and add `--json` for machine-readable output.
- `memory prune` removes the entries that match every selector you pass: `--id`, `--older-than <days>`, and `--kind`. To remove every entry, pass `--all` on its own. To preview a prune, add `--dry-run`. Prune without a selector fails and removes nothing.

## Storage and encryption

Entries live in `<workspace>/.toolforge/memory.db`, which `.gitignore` excludes. The entry id, kind, and timestamps stay in plaintext columns so prune can select on them. Toolforge encrypts the text, tags, and source with AES-256-GCM, using a random 12-byte IV per row. The store records its schema version in `PRAGMA user_version` and refuses a file written by a newer schema.

Toolforge resolves the key in this order:

1. When `TOOLFORGE_MEMORY_KEY` is set, Toolforge uses it. It must hold 64 hex characters (32 bytes).
2. Otherwise, Toolforge reads `~/.toolforge/memory.key`. On first use, it creates a random 32-byte key file with mode `0600`.

A store remembers which key created it. Opening it with any other key fails with a key mismatch error and returns no data. Back up the key file, because a store without its key cannot be read.

## Prompt injection

Import the helpers from `src/memory/inject.js`:

```js
import { openMemoryStore } from './src/memory/store.js';
import { injectActiveMemory } from './src/memory/inject.js';

const store = openMemoryStore({ dbPath: '.toolforge/memory.db' });
const prompt = injectActiveMemory(systemPrompt, store.list(), userQuery);
store.close();
```

`injectActiveMemory` ranks entries by keyword overlap between the query and each entry's text and tags. Constraints and decisions get a fixed boost, entries with no overlap stay out, and ties go to the newer entry. It packs entries in rank order into an `<active-memory>` block with one `- [kind] text` line per entry and appends the block to the prompt.

The whole block stays within 1500 estimated tokens, counted as `Math.ceil(characters / 4)`. To change the cap, pass `{ maxTokens }`. The packer skips an entry that does not fit, and a smaller entry ranked below it can still fit. When no entry qualifies, the prompt comes back unchanged.

Injection treats entry text as data. It collapses line breaks to spaces and escapes `<active-memory>` tags inside an entry, so a stored entry cannot end the block or add lines. To get the selected entries without building a prompt, call `selectMemoryForPrompt(entries, query, { maxTokens })`.

## Not in scope

- No vector or embedding index exists. Ranking is keyword based, so an entry that shares no words with the query is never selected.
- This repository has no central agent runner, so nothing injects memory automatically. Each caller imports `src/memory/inject.js` and passes its own entries and query.
