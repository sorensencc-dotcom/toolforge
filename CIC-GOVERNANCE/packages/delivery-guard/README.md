---
title: "Delivery guard adapter contract"
document_id: "CIC-DELIVERY-GUARD-README"
category: "readme"
type: package-documentation
status: "active"
version: "0.1.0"
---

# Delivery guard adapter contract

Repository adapters provide a strict configuration object to
`validateAdapterConfig`:

```js
{
  repository: { id: 'repo-name', root: '.' },
  generatedPaths: ['.ijfw/**', 'dist/**'],
  automationPaths: ['.github/workflows/**', 'scripts/**'],
  testCommands: ['npm test'],
  hookInstaller: {
    command: 'node scripts/setup-git-hook.mjs',
    installedPath: '.git/hooks/pre-commit'
  }
}
```

Path values are repository-relative and cannot traverse to a parent. Generated
and automation path lists, test commands, and hook installer fields are
required. The validator returns the original configuration when valid and
throws `AdapterConfigError` with structured `issues` when invalid.
## Generated-path glob grammar

`generatedPaths` accepts repository-relative patterns using this complete grammar:

- `/` separates path segments; `\` is normalized to `/` for Windows adapters.
- `*` matches zero or more characters within one segment.
- `?` matches exactly one character within one segment.
- `**` matches zero or more characters across segments. A `**/` sequence also matches zero or more complete directory segments.
- All other characters match literally.

Character classes (`[]`), brace expansion (`{}`), extglob (`!()`, `?()`, `+()`, `*()`, and `@()`), alternation (`|`), anchors, escapes, absolute paths, and parent traversal are unsupported. The classifier rejects any configured pattern containing unsupported syntax before examining paths, so unsupported patterns cannot silently classify generated files as authored.

The package public API is `src/index.js`, which exports both `validateAdapterConfig` and `classifyDiff`.