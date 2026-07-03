# Template Skill

Template skill demonstrating Toolforge skill structure.

**Status**: Template (reference only)  
**Version**: 0.1.0  
**Runtime**: TypeScript

---

## What is This?

This is a reference scaffold for creating new Toolforge skills. Copy this entire directory and customize the files.

---

## Structure

```
_TEMPLATE/
├── skill.json           # Metadata (REQUIRED - edit this first)
├── README.md            # This file (quick reference)
├── src/
│   └── index.ts         # Implementation (REQUIRED)
├── tests/
│   └── skill.test.ts    # Test suite (REQUIRED)
└── docs/
    └── USAGE.md         # Full documentation (REQUIRED)
```

---

## Getting Started

1. Copy template:
   ```bash
   cp -r _TEMPLATE my-new-skill
   ```

2. Edit `skill.json`:
   - Change `id` (kebab-case)
   - Change `name` (display name)
   - Set `category`
   - Update `description`
   - Update `inputs`/`outputs`

3. Implement `src/index.ts`:
   - Export default handler function
   - Match signature in skill.json
   - Handle all error conditions

4. Write tests in `tests/skill.test.ts`:
   - Test happy path
   - Test error conditions
   - Test all inputs

5. Document in `docs/USAGE.md`:
   - Purpose
   - Inputs/outputs with examples
   - Error handling
   - Dependencies
   - Related skills

6. Register in `manifest.json`:
   ```json
   {
     "name": "my-new-skill",
     "category": "skills",
     "version": "0.1.0",
     "path": "skills/my-new-skill"
   }
   ```

7. Sync to distributed instance:
   ```bash
   .\toolforgeSkillSync.ps1 my-new-skill
   ```

---

## Metadata Fields

See [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md) for complete schema.

Key fields:
- `id`: Unique identifier (kebab-case, 3-50 chars)
- `version`: Semantic version (X.Y.Z)
- `inputs`: Required and optional parameters
- `outputs`: Success and error return shapes
- `permissions`: Required capabilities
- `errorConditions`: Documented failures

---

## Implementation Pattern

```typescript
// src/index.ts

export interface SkillInput {
  input1: string;
  verbose?: boolean;
}

export interface SkillOutput {
  status: string;
  message: string;
  data?: Record<string, any>;
}

export default async function handler(input: SkillInput): Promise<SkillOutput> {
  try {
    // Validate input
    if (!input.input1) {
      throw new Error("INVALID_INPUT: input1 required");
    }

    // Implement logic
    const result = await doWork(input.input1);

    // Return success
    return {
      status: "success",
      message: "Work completed",
      data: result
    };
  } catch (error) {
    // Handle error
    throw {
      status: "error",
      message: error.message,
      code: "HANDLER_ERROR"
    };
  }
}

async function doWork(input: string): Promise<any> {
  // Implementation here
  return {};
}
```

---

## Testing Pattern

```typescript
// tests/skill.test.ts

import handler from "../src/index.ts";

describe("Template Skill", () => {
  it("should succeed with valid input", async () => {
    const result = await handler({ input1: "test" });
    expect(result.status).toBe("success");
  });

  it("should fail with missing input", async () => {
    try {
      await handler({ input1: "" });
      fail("Should have thrown");
    } catch (error) {
      expect(error.message).toContain("INVALID_INPUT");
    }
  });
});
```

---

## Before Submitting

Checklist:
- [ ] skill.json is valid JSON
- [ ] All required metadata fields present
- [ ] src/index.ts compiles and exports default
- [ ] tests/ directory has test suite
- [ ] Tests pass: `npm test`
- [ ] docs/USAGE.md is complete
- [ ] README.md updated with skill details
- [ ] No console.log (use structured logging)
- [ ] Error handling covers all error conditions
- [ ] Dependencies documented

---

## Submit for Review

1. Check skill into git
2. Create pull request
3. Reference this template
4. Explain integration points (CIC, distributed, etc.)

---

## See Also

- [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md) — Full validation spec
- [../README.md](../README.md) — Skillpack overview
- [../../manifest.json](../../manifest.json) — Tool registry
- [../../GOVERNANCE.md](../../GOVERNANCE.md) — Code standards

---
