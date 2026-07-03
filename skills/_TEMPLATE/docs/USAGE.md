# Template Skill — Usage Guide

Complete documentation for the Template Skill.

**Version**: 0.1.0  
**Runtime**: TypeScript  
**Status**: Template (reference)

---

## Overview

The Template Skill demonstrates the required structure and conventions for Toolforge skills. Use this as a scaffold for creating new skills.

### Purpose

Process input data and return structured results. This is a reference implementation—replace with your skill's actual purpose.

### Quick Example

```typescript
const result = await handler({
  input1: "hello world",
  verbose: true
});

// Result:
// {
//   status: "success",
//   message: "Work completed successfully",
//   data: {
//     processed: "hello world",
//     timestamp: "2026-06-28T10:00:00.000Z",
//     length: 11
//   }
// }
```

---

## Inputs

### Required

#### `input1` (string)

**Description**: Primary input parameter (required, non-empty).

**Constraints**:
- Type: string
- Min length: 1 character
- Max length: unbounded

**Example**:
```json
{
  "input1": "hello world"
}
```

### Optional

#### `verbose` (boolean)

**Description**: Enable verbose logging output.

**Default**: `false`

**Constraints**:
- Type: boolean
- Values: true or false

**Example**:
```json
{
  "input1": "hello world",
  "verbose": true
}
```

---

## Outputs

### Success Output

Returned when the skill executes successfully.

```json
{
  "status": "success",
  "message": "Work completed successfully",
  "data": {
    "processed": "hello world",
    "timestamp": "2026-06-28T10:00:00.000Z",
    "length": 11
  }
}
```

**Fields**:
- `status` (string): Always "success"
- `message` (string): Human-readable result message
- `data` (object): Payload containing result details
  - `processed` (string): The processed input
  - `timestamp` (string): ISO 8601 timestamp
  - `length` (number): Length of processed input

### Error Output

Returned when the skill encounters an error.

```json
{
  "status": "error",
  "message": "Input validation failed: input1 is required",
  "code": "INVALID_INPUT"
}
```

**Fields**:
- `status` (string): Always "error"
- `message` (string): Error description
- `code` (string): Error code for programmatic handling

---

## Error Codes

| Code | Trigger | Handling | Notes |
|------|---------|----------|-------|
| `INVALID_INPUT` | Missing or invalid input1 | Fail | Check input constraints |
| `SKILL_ERROR` | Unexpected execution error | Fail | Check logs for details |
| `TIMEOUT` | Execution exceeds 30s | Fail | Increase timeout if needed |
| `PERMISSION_DENIED` | Insufficient permissions | Fail | Grant required permissions |

---

## Permissions

The skill requires the following permissions:

### Required
- `read:repo` — Read repository contents

### Optional
- `write:file` — Write files (if modifying data)

### Restricted
- `delete:permanent` — Permanent deletion not allowed

---

## Dependencies

### Internal
- None (this is a template)

### External
- None (uses only Node.js built-ins)

---

## Usage Examples

### Basic Usage

```typescript
import handler from "./src/index.ts";

const result = await handler({ input1: "data" });
console.log(result);
```

### With Verbose Mode

```typescript
const result = await handler({
  input1: "data",
  verbose: true
});
// Logs: [SKILL] Processing input: data
```

### Error Handling

```typescript
const result = await handler({ input1: "" });

if (result.status === "error") {
  console.error(`Error: ${result.message} (${result.code})`);
  // Error: Input validation failed: input1 is required (INVALID_INPUT)
}
```

### Integration with Toolforge

```bash
# Run via Toolforge
./run-tool.ps1 -Run template-skill -Input '{"input1":"data"}'

# Inspect skill
./run-tool.ps1 -Inspect template-skill

# List available skills
./run-tool.ps1 -List -Category skills
```

---

## Related Skills

- None (this is a template)

Replace with actual related skills when creating your skill.

---

## Troubleshooting

### Input Validation Failure

**Problem**: `INVALID_INPUT` error

**Solution**: Ensure `input1` is:
- Provided (not empty)
- A non-empty string
- Properly formatted JSON

**Example**:
```typescript
// ✓ Correct
{ input1: "hello" }

// ✗ Wrong
{ input1: "" }           // empty
{ input1: null }         // null
{ input1: undefined }    // missing
```

### Timeout Error

**Problem**: Skill execution times out after 30 seconds

**Solution**: 
- Optimize doWork() function
- Process data more efficiently
- Request timeout increase in skill.json

### Permission Denied

**Problem**: Skill lacks required permissions

**Solution**:
- Check required permissions in skill.json
- Grant permissions via Toolforge security policy
- Use only permitted operations

---

## Testing

Run the test suite:

```bash
npm test
```

Test coverage includes:
- Happy path (valid input)
- Error cases (missing/invalid input)
- Edge cases (long strings, special chars)
- Output format validation

Add more tests for your skill's specific scenarios.

---

## Support

For issues or questions:

1. Check [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md) for framework docs
2. Review [skill.json](../skill.json) metadata
3. Check test suite in [tests/](../tests/)
4. See [../../GOVERNANCE.md](../../GOVERNANCE.md) for standards

---

## Version History

### 0.1.0 (2026-06-28)
- Initial template release
- Reference implementation
- Full test coverage

---
