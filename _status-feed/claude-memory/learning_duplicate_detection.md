---
name: learning-duplicate-detection
description: "During file reorg, check inbound links across repo to identify canonical file, not just filenames/timestamps"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0df381f-758f-4ca2-a228-6908dcc220f7
  modified: 2026-07-19T19:24:25.651Z
---

**Rule**: When two files could plausibly be "the duplicate" during file reorganization, check every inbound link across the repo (not just filenames or timestamps) to identify which is actually canonical.

**Why**: Filename patterns and timestamps are ambiguous. Inbound links reveal which file is actually referenced by the codebase. 2026-07-16: This method caught a wrong assumption in design for one pair and found two additional undetected duplicates that neither the original design nor plan had caught.

**How to apply**:
```bash
# For suspected duplicates file1.md and file2.md:
grep -r "file1\|file2" . --include="*.md" --include="*.json" | grep -v "^Binary"
```

Whichever file has more inbound references is canonical; the other is the duplicate.

**Pattern**: Add this check to file-reorg design phase before execution begins. Prevents wrong assumptions about which file is "the real one."

**Reference**: Retro 2026-07-16-5.json, process_learnings[3]
