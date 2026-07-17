# session-wrap — Usage

## Basic wrap, no doc updates

```ts
import sessionWrap from "../src/index";

await sessionWrap({
  commitMessage: "[claude] Phase 47.1: implemented feature X",
  summary: "Implemented X, added tests, updated docs",
});
```

If nothing is dirty in the resolved stage set, the commit is skipped
(`skippedCommit: true`) rather than erroring.

## With doc updates (only these paths get staged)

```ts
await sessionWrap({
  commitMessage: "[claude] Phase 47.2: docs",
  docUpdates: [
    { path: "docs/FEATURE.md", content: "# Feature\n..." },
    { path: "HANDOFF.md", content: "# Next session\n..." },
  ],
});
```

## Staging additional files explicitly

```ts
await sessionWrap({
  commitMessage: "[human] manual fix",
  stageFiles: ["src/fix.ts", "tests/fix.test.ts"],
});
```

## Opting into git add -A (use sparingly — see SKILL.md rationale)

```ts
await sessionWrap({
  commitMessage: "[claude] full sweep",
  stageAll: true,
});
```

## Dry run

```ts
const plan = await sessionWrap({
  commitMessage: "[claude] preview",
  docUpdates: [{ path: "NOTES.md", content: "..." }],
  dryRun: true,
});
// plan.docUpdates[0].status === "would-write", no git operations run
```
