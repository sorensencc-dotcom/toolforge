# Manifest validation

Manifest validation enforces structural schema compliance for skill manifests (`manifest.json`) and evaluates SemVer version constraints to ensure skills meet security, metadata, and compatibility requirements before submission or execution.

## Sub-features

- `manifest-schema` validates mandatory fields (`name`, `version`, `description`, `owner`, `runtime`, `entrypoint`).
- `manifest-format` enforces semantic constraints (email formatting for owner, kebab-case for skill name, minimum description length).
- `semver-resolution` resolves caret (`^`), tilde (`~`), wildcard (`*`), and inequality (`>=`, `<=`) constraints.
- `semver-prerelease` enforces strict SemVer 2.0.0 precedence rules for pre-release tags (`-alpha`, `-beta`, `-rc`).

## How to get to it (user POV)

- Run `node src/validators/manifest.js <path-to-manifest.json>`.
- Run `npm test` or invoke node test runner on `src/validators/manifest.test.js` and `src/validators/semver.test.js`.
- Execute `control-marketplace.mjs drive manifest-validation`.

## Driving it with control-marketplace

Preconditions:

- Marketplace doctor passes (`node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor`).

- **Execute automated validator test suite.** Run the validator verification driver:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs drive manifest-validation --run-id <run-id>`.
  Exit code `0` and console output shows:
  - `✔ Manifest Validator` (10/10 assertions pass).
  - `✔ SemVer: Parse Version`, `Compare Versions`, `Resolve Constraints`, `Pre-release Ordering` (50/50 assertions pass).
  - Summary: `ℹ pass 60`, `ℹ fail 0`.

- **Confirm proof artifact.** Inspect `evidence/verify-toolforge-marketplace/<run-id>/manifest-validation-proof.json`:
  Contains `verdict: "PASS"` and test execution summary confirming zero test regressions across schema and semver rules.

- **Direct schema test.** Invoke programmatic validator against a test payload:
  Run `node -e "import { validateManifest } from './src/validators/manifest.js'; console.log(validateManifest({ name: 'valid-skill', version: '1.0.0', description: 'A sufficiently long description for testing purposes', owner: 'dev@example.com', runtime: 'node', entrypoint: 'index.js' }));"`.
  Outputs `{ valid: true, errors: [] }`.

## Gotchas

- Manifest names must be lowercase alphanumeric with hyphens only; underscores or uppercase letters fail validation.
- Short descriptions (< 20 characters) fail schema validation.
- Zero-major caret constraints (e.g. `^0.2.0`) cap at `<0.3.0` under SemVer rules and will not match `0.9.0`.
