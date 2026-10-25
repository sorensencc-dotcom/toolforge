# Skill discovery

Skill discovery lets users and automated agents browse available catalog skills, filter skills by technical category, and query the catalog using keyword searches across names and descriptions.

## Sub-features

- `discovery-list` returns published skills paginated by limit and offset.
- `discovery-filter` narrows skills matching a specific category slug (e.g. `linting`, `auth`, `testing`).
- `discovery-search` performs substring and full-text keyword searches across skill names and descriptions.
- `discovery-cli` formats skill discovery output into readable terminal summaries.

## How to get to it (user POV)

- Run `toolforge list` in the terminal to inspect available skills.
- Run `toolforge list --category <category>` to filter skills by category.
- Run `toolforge search <query>` to search for skills matching a keyword.
- Open `http://localhost:5173` in a web browser and use the search bar or category pills.
- Send HTTP `GET /api/v1/skills` or `GET /api/v1/skills/search?q=<query>`.

## Driving it with control-marketplace

Preconditions:

- Marketplace doctor passes (`node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor`).
- An active API server or mock server is listening at `--api-url` (or port 3000).

- **List skills via CLI.** Fetch the default catalogue:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- list --api-url <url> --limit 10`.
  Output shows `Available Skills (N total):` followed by names, categories, ratings, and owners.

- **Filter by category via CLI.** Query skills in the `linting` category:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- list --category linting --api-url <url>`.
  Every returned skill has `Category: linting`.

- **Search by keyword via CLI.** Query skills matching `auth`:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- search auth --api-url <url>`.
  Output shows `Search Results for "auth"` with installation hint commands `toolforge install <name>`.

- **Verify API response shape directly.** Execute an HTTP GET against `/api/v1/skills`:
  Run `curl -s "<url>/api/v1/skills?limit=5"`.
  Response contains a JSON object `{ "data": [ ... ] }` with valid skill entries.

## Gotchas

- Omitting `--api-url` defaults to `http://localhost:3000`. If the API server is not running on port 3000, CLI commands will exit 1 with `ECONNREFUSED`.
- The CLI enforces a maximum `--limit` of 100 entries per request; requests requesting higher counts are capped at 100.
- Keyword queries with empty or whitespace-only strings return HTTP 400 (`Query parameter q is required`).
