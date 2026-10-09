# Lean Proof Verification Harness

Formal theorem proving, tactic validation, and invariant verification harness for Lean 4 and agent logic specs.

## Features
- **Parser & AST Analysis**: Extracts theorem signatures, tactic blocks, definitions, and declared axioms.
- **Obligation & Invariant Auditing**: Rejects unproven subgoals (`sorry`, `admit`), syntax bracket errors, and ungrounded axioms in strict mode.
- **Compiler Pipeline**: Dispatches to local `lean`/`lake` compiler with fallback to AST-based static verification.
- **Cost-Routing Gateway Tier 2 Integration**: Automatically routes complex tactic obligations to Tier 2 Frontier models.

## Usage

```typescript
import { LeanVerifier } from './lean-verifier.js';

const verifier = new LeanVerifier();
const result = await verifier.verify({
  source: 'theorem add_comm (n m : Nat) : n + m = m + n := sorry',
  strict: true,
});
console.log(result.status); // OPEN_OBLIGATIONS
```
