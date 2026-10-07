import { LeanProofVerifier, LeanVerifyOptions, LeanVerificationResult } from './lean-verifier';

export * from './lean-verifier';

/**
 * Main programmatic execution entrypoint.
 */
export async function runLeanVerification(
  source: string,
  options: LeanVerifyOptions = {}
): Promise<LeanVerificationResult> {
  const verifier = new LeanProofVerifier();
  return verifier.verify(source, options);
}

// Direct CLI invocation
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))) {
  const args = process.argv.slice(2);
  const source = args[0] || 'theorem add_comm (n m : Nat) : n + m = m + n := by omega';
  const strict = !args.includes('--no-strict');

  runLeanVerification(source, { strict })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'FAILED' ? 1 : 0);
    })
    .catch((err) => {
      console.error('[Lean Verification Error]', err);
      process.exit(1);
    });
}
