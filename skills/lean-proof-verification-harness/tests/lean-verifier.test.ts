import { LeanProofVerifier, runLeanVerification } from '../src/lean-verifier';

describe('Lean Proof Verification Harness (ACT-01)', () => {
  let verifier: LeanProofVerifier;

  beforeEach(() => {
    verifier = new LeanProofVerifier();
  });

  describe('Theorem & Declaration Parsing', () => {
    test('extracts theorems, lemmas, defs, and examples', () => {
      const code = [
        'theorem nat_add_zero (n : Nat) : n + 0 = n := by',
        '  rfl',
        '',
        'lemma nat_zero_add (n : Nat) : 0 + n = n := by',
        '  simp',
        '',
        'def double (n : Nat) : Nat :=',
        '  n + n',
        '',
        'example (p q : Prop) (hp : p) (hq : q) : p /\\ q := by',
        '  exact And.intro hp hq'
      ].join('\n');

      const thms = verifier.extractTheorems(code);
      expect(thms.length).toBe(4);
      expect(thms.map((t) => t.name)).toEqual([
        'nat_add_zero',
        'nat_zero_add',
        'double',
        'anonymous_10',
      ]);
      expect(thms[0].isProven).toBe(true);
      expect(thms[0].hasSorry).toBe(false);
      expect(thms[0].tacticsUsed).toContain('rfl');
    });

    test('extracts declared axioms', () => {
      const code = [
        'axiom law_of_excluded_middle (p : Prop) : p Or Not p',
        'axiom choice {alpha : Sort u} : Nonempty alpha -> alpha',
        '',
        'theorem sample (p : Prop) : p Or Not p := by',
        '  exact law_of_excluded_middle p'
      ].join('\n');

      const axioms = verifier.extractAxioms(code);
      expect(axioms).toEqual(['law_of_excluded_middle', 'choice']);
    });
  });

  describe('Verification & Obligation Checking', () => {
    test('verifies complete proof without sorry as VERIFIED', async () => {
      const code = [
        'theorem and_comm (p q : Prop) : p /\\ q -> q /\\ p := by',
        '  intro h',
        '  exact And.intro h.right h.left'
      ].join('\n');

      const result = await verifier.verify(code, { strict: true });
      expect(result.status).toBe('VERIFIED');
      expect(result.theoremsFound).toBe(1);
      expect(result.theoremsVerified).toBe(1);
      expect(result.sorryCount).toBe(0);
      expect(result.diagnostics.length).toBe(0);
    });

    test('flags sorry/admit as FAILED in strict mode', async () => {
      const code = [
        'theorem fermat_last_theorem (n : Nat) (hn : n > 2) :',
        '  forall a b c : Nat, a^n + b^n = c^n -> a * b * c = 0 := by',
        '  sorry'
      ].join('\n');

      const result = await verifier.verify(code, { strict: true });
      expect(result.status).toBe('FAILED');
      expect(result.theoremsFound).toBe(1);
      expect(result.sorryCount).toBe(1);
      expect(result.theoremsVerified).toBe(0);
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });

    test('marks sorry as OPEN_OBLIGATIONS in non-strict mode', async () => {
      const code = [
        'theorem partial_lemma (n : Nat) : n + 1 > n := by',
        '  sorry'
      ].join('\n');

      const result = await verifier.verify(code, { strict: false });
      expect(result.status).toBe('OPEN_OBLIGATIONS');
      expect(result.sorryCount).toBe(1);
    });

    test('detects mismatched delimiter brackets as syntax failure', async () => {
      const code = [
        'theorem broken_syntax (n : Nat) : n + (0 = n := by',
        '  rfl'
      ].join('\n');

      const result = await verifier.verify(code);
      expect(result.status).toBe('FAILED');
      expect(result.diagnostics.some((d) => d.message.includes('Unclosed delimiter'))).toBe(true);
    });

    test('supports targeted single theorem verification', async () => {
      const code = [
        'theorem thm_a : 1 = 1 := by rfl',
        'theorem thm_b : 2 = 2 := by sorry'
      ].join('\n');

      const result = await verifier.verify(code, { targetTheorem: 'thm_a', strict: true });
      expect(result.status).toBe('VERIFIED');
      expect(result.theoremsVerified).toBe(1);
    });
  });

  describe('Runner Interface', () => {
    test('executes runLeanVerification helper cleanly', async () => {
      const res = await runLeanVerification('theorem reflexive_eq (x : Nat) : x = x := by rfl');
      expect(res.status).toBe('VERIFIED');
      expect(res.theoremsFound).toBe(1);
    });
  });
});
