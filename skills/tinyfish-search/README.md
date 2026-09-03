# TinyFish Search

Fail-closed Toolforge skill wrapping the TinyFish AI Search and Fetch SDK (`@tiny-fish/sdk`).

## Quickstart

```typescript
import { tinyfish_search, tinyfish_extract } from "./dist/index.js";

// Search
const searchResult = await tinyfish_search({ objective: "PostgreSQL 17 release notes" });
if (searchResult.ok) {
  console.log(searchResult.data.results);
}

// Extract clean Markdown
const extractResult = await tinyfish_extract({ urls: ["https://example.com"] });
if (extractResult.ok) {
  console.log(extractResult.data.results[0].markdown);
}
```

## Governance

See [docs/USAGE.md](docs/USAGE.md) for rate limits, timeout semantics, and error codes.

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Toolforge conventions.
