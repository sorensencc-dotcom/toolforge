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
