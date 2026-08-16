---
name: feedback-reduce-prompts
description: "User preference — too many prompts/questions during work, want more autonomous execution"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 17f1198e-3730-4433-8b16-f492ccb56939
---

**Don't generate unnecessary prompts or questions mid-task.** Execute within established scope; ask only for genuine blockers (reversible operations, missing critical context, ambiguous user intent).

**Why:** Excessive prompting interrupts flow and defeats the point of having an autonomous agent.

**How to apply:** When you have enough information to proceed (user said "fix", "go", task is clear from context), just do it. Prompts for permission on read-only work, tool-use verification for non-destructive operations, or AskUserQuestion for style preferences are noise during execution. Save questions for planning/design phases or when genuinely stuck.
