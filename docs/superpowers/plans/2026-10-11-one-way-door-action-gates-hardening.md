# One-Way Door Action Gates Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Toolforge's One-Way vs. Two-Way Door Action Classifier & Execution Gates middleware against timing attacks, path traversals, and non-deterministic gate ID drift identified during caveman review.

**Architecture:**
- Cryptographic confirmation verification enforces constant-time equality via `crypto.timingSafeEqual` with buffer length gating.
- Gate ID generation enforces deterministic recursive key sorting across action parameters to eliminate hash drift.
- Bounded path checking normalizes paths and enforces boundary containment to prevent traversal jailbreaks.
- Visual gating prompts clearly differentiate the HMAC approval token from raw gate IDs.

**Tech Stack:** Node.js 24 ESM, `node:crypto`, `node:path`, `node:test`, `node:assert/strict`.

## Global Constraints
- Target repo: `sorensencc-dotcom/toolforge`
- Node 24 ESM strictly without external runtime dependencies (zero new npm packages).
- Strict TDD cycle: test must fail or verify attack surface before implementing fix.
- All tests must pass via `node --test tests/one-way-door-action-gates.test.mjs`.

---

### Task 1: Cryptographic Timing-Safe Comparison & Import Cleanup

**Files:**
- Modify: `modules/OneWayDoorActionGate.mjs:1-3,115-128`
- Test: `tests/one-way-door-action-gates.test.mjs`

**Interfaces:**
- Consumes: `generateConfirmationToken(gateId, secretKey)`
- Produces: `verifyConfirmationToken(token, gateId, secretKey): boolean` (constant-time evaluation)

- [ ] **Step 1: Write the failing test for timing-safe verification and edge cases**

Add tests to `tests/one-way-door-action-gates.test.mjs`:
```javascript
test('verifyConfirmationToken - safely rejects null, empty, or mismatched length tokens without throwing', () => {
  assert.equal(verifyConfirmationToken(null, 'gate-123'), false);
  assert.equal(verifyConfirmationToken('', 'gate-123'), false);
  assert.equal(verifyConfirmationToken('short', 'gate-123'), false);
  assert.equal(verifyConfirmationToken(12345, 'gate-123'), false);
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `node --test tests/one-way-door-action-gates.test.mjs`
Expected: Passes initial type check, but relies on vulnerable string comparison.

- [ ] **Step 3: Implement constant-time comparison in `verifyConfirmationToken`**

In `modules/OneWayDoorActionGate.mjs`:
```javascript
export function verifyConfirmationToken(token, gateId, secretKey = 'default-toolforge-gate-secret') {
  if (!token || typeof token !== 'string') return false;
  const expected = generateConfirmationToken(gateId, secretKey);
  const bufA = Buffer.from(token, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/one-way-door-action-gates.test.mjs`
Expected: PASS (13/13 tests pass)

- [ ] **Step 5: Commit changes**

```bash
git add modules/OneWayDoorActionGate.mjs tests/one-way-door-action-gates.test.mjs
git commit -m "fix(security): enforce timing-safe equality on confirmation tokens"
```

---

### Task 2: Deterministic Parameter Canonicalization for Gate ID Invariance

**Files:**
- Modify: `modules/OneWayDoorActionGate.mjs:160-175`
- Test: `tests/one-way-door-action-gates.test.mjs`

**Interfaces:**
- Consumes: `toolName: string`, `params: object`
- Produces: `computeGateId(toolName, params): string` (invariant to key ordering)

- [ ] **Step 1: Write the failing test for parameter key permutation invariance**

Add test to `tests/one-way-door-action-gates.test.mjs`:
```javascript
test('Interceptor - computeGateId is invariant to object key ordering permutations', () => {
  const interceptor = new OneWayDoorInterceptor();
  const id1 = interceptor.computeGateId('delete_file', { path: 'a.txt', recursive: true, force: false });
  const id2 = interceptor.computeGateId('delete_file', { force: false, path: 'a.txt', recursive: true });
  assert.equal(id1, id2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/one-way-door-action-gates.test.mjs`
Expected: FAIL due to differing JSON stringification orders (`assert.equal(id1, id2)` fails).

- [ ] **Step 3: Implement deterministic key sorting in `computeGateId`**

In `modules/OneWayDoorActionGate.mjs`:
```javascript
export function canonicalizeValue(val) {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalizeValue);
  const sorted = {};
  for (const k of Object.keys(val).sort()) {
    sorted[k] = canonicalizeValue(val[k]);
  }
  return sorted;
}

computeGateId(toolName, params) {
  const canonical = {
    toolName,
    params: canonicalizeValue(params)
  };
  const raw = JSON.stringify(canonical);
  return `gate-${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/one-way-door-action-gates.test.mjs`
Expected: PASS (14/14 tests pass)

- [ ] **Step 5: Commit changes**

```bash
git add modules/OneWayDoorActionGate.mjs tests/one-way-door-action-gates.test.mjs
git commit -m "fix(gates): canonicalize parameter keys in computeGateId"
```

---

### Task 3: Path Traversal Hardening for Bounded Scratchpad Enforcement

**Files:**
- Modify: `modules/OneWayDoorActionGate.mjs:200-225`
- Test: `tests/one-way-door-action-gates.test.mjs`

**Interfaces:**
- Consumes: `params.path: string`, `allowedBoundedPrefixes: string[]`
- Produces: Bounded validation blocking `../` directory escapes

- [ ] **Step 1: Write the failing test for path traversal jailbreak attempts**

Add test to `tests/one-way-door-action-gates.test.mjs`:
```javascript
test('Interceptor - blocks directory traversal attempts escaping bounded scratchpad', async () => {
  const interceptor = new OneWayDoorInterceptor();
  const escapeAttempt = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: 'scratch/../../src/core.js', content: 'malicious' }
  });
  assert.equal(escapeAttempt.status, 'BLOCKED_BY_GATE');
  assert.equal(escapeAttempt.breach, 'BOUNDARY_EXCEEDED');
  assert.ok(escapeAttempt.reason.includes('breaches bounded') || escapeAttempt.reason.includes('traversal'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/one-way-door-action-gates.test.mjs`
Expected: FAIL because raw prefix check permits `'scratch/../../src/core.js'`.

- [ ] **Step 3: Implement path normalization and root containment verification**

In `modules/OneWayDoorActionGate.mjs`:
```javascript
const targetPath = params.path || params.filePath || params.file || '';
if (targetPath) {
  const normalized = path.normalize(targetPath).replace(/\\/g, '/');
  if (normalized.startsWith('../') || normalized.includes('/../') || path.isAbsolute(targetPath)) {
    return {
      status: 'BLOCKED_BY_GATE',
      reversibility: REVERSIBILITY.BOUNDED,
      breach: 'BOUNDARY_EXCEEDED',
      gateId,
      reason: `Action target breaches bounded scratchpad limits (${targetPath})`
    };
  }
  const isBounded = this.allowedBoundedPrefixes.some(prefix =>
    normalized.startsWith(prefix) || normalized.includes(`/${prefix}`)
  );
  if (!isBounded) {
    return {
      status: 'BLOCKED_BY_GATE',
      reversibility: REVERSIBILITY.BOUNDED,
      breach: 'BOUNDARY_EXCEEDED',
      gateId,
      reason: `Action target breaches bounded scratchpad limits (${targetPath})`
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/one-way-door-action-gates.test.mjs`
Expected: PASS (15/15 tests pass)

- [ ] **Step 5: Commit changes**

```bash
git add modules/OneWayDoorActionGate.mjs tests/one-way-door-action-gates.test.mjs
git commit -m "fix(gates): harden bounded scratchpad against path traversal"
```

---

### Task 4: Visual Prompt Clarity & Full Regression Suite

**Files:**
- Modify: `modules/OneWayDoorActionGate.mjs:130-155`
- Modify: `docs/toolforge/ACTION_REVERSIBILITY_TAXONOMY.md`
- Test: `tests/one-way-door-action-gates.test.mjs`

- [ ] **Step 1: Update visual gating prompt with approval token generation hint**

In `modules/OneWayDoorActionGate.mjs`:
```javascript
export function formatGatingPrompt(gateInfo) {
  const {
    gateId,
    toolName,
    params,
    riskClassification = 'CRITICAL',
    reversibility = REVERSIBILITY.IRREVERSIBLE,
    diffSummary = 'No diff available'
  } = gateInfo;

  return [
    '=================================================================',
    ' ⚠️  ONE-WAY DOOR EXECUTION GATE (ACTION CONFIRMATION REQUIRED)',
    '=================================================================',
    ` Tool:           ${toolName}`,
    ` Risk Level:     ${riskClassification}`,
    ` Reversibility:  ${reversibility}`,
    ` Gate ID:        ${gateId}`,
    ` Target/Params:  ${JSON.stringify(params)}`,
    ` Impact/Diff:    ${diffSummary}`,
    '-----------------------------------------------------------------',
    ' This action is irreversible. Autonomous execution is paused.',
    ` To approve, provide confirmation token for gate: ${gateId}`,
    '================================================================='
  ].join('\n');
}
```

- [ ] **Step 2: Run full regression test suite**

Run: `node --test tests/one-way-door-action-gates.test.mjs tests/agent-egress-guard.test.mjs tests/scoped-filesystem-permission-harness.test.mjs`
Expected: 100% PASS with 0 failures across all 28+ test assertions.

- [ ] **Step 3: Commit changes**

```bash
git add modules/OneWayDoorActionGate.mjs docs/toolforge/ACTION_REVERSIBILITY_TAXONOMY.md tests/one-way-door-action-gates.test.mjs
git commit -m "docs(gates): update prompt label clarity and documentation"
```
