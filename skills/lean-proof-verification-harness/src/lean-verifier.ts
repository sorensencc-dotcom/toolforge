import { execSync } from 'child_process'; // noqa: SEC-AUDITOR - requires invoking local lean/lake compiler binary
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LeanVerifyOptions {
  strict?: boolean;
  targetTheorem?: string;
  timeoutMs?: number;
}

export interface LeanTheoremInfo {
  name: string;
  kind: 'theorem' | 'lemma' | 'def' | 'axiom' | 'example';
  signature: string;
  proofBody: string;
  isProven: boolean;
  hasSorry: boolean;
  tacticsUsed: string[];
  lineNumber: number;
}

export interface LeanDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  theorem?: string;
}

export interface LeanVerificationResult {
  status: 'VERIFIED' | 'OPEN_OBLIGATIONS' | 'FAILED';
  theoremsFound: number;
  theoremsVerified: number;
  sorryCount: number;
  axiomsUsed: string[];
  theorems: LeanTheoremInfo[];
  diagnostics: LeanDiagnostic[];
  compilerUsed: boolean;
  verificationDurationMs: number;
}

export class LeanProofVerifier {
  private hasLeanToolchain: boolean | null = null;

  constructor() {
    this.checkToolchain();
  }

  private checkToolchain(): boolean {
    if (this.hasLeanToolchain !== null) return this.hasLeanToolchain;
    try {
      execSync('lean --version', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
      this.hasLeanToolchain = true;
    } catch {
      this.hasLeanToolchain = false;
    }
    return this.hasLeanToolchain;
  }

  /**
   * Main verification entrypoint for Lean 4 source or invariant specifications.
   */
  public async verify(source: string, options: LeanVerifyOptions = {}): Promise<LeanVerificationResult> {
    const startTime = Date.now();
    const strict = options.strict !== false;
    let code = source.trim();

    // If source is an existing file path, read it
    if (fs.existsSync(code) && fs.statSync(code).isFile()) {
      code = fs.readFileSync(code, 'utf8');
    }

    const diagnostics: LeanDiagnostic[] = [];
    const theorems = this.extractTheorems(code);
    const axioms = this.extractAxioms(code);

    let sorryCount = 0;
    let verifiedCount = 0;

    for (const thm of theorems) {
      if (options.targetTheorem && thm.name !== options.targetTheorem) {
        continue;
      }

      if (thm.hasSorry) {
        sorryCount++;
        diagnostics.push({
          severity: strict ? 'error' : 'warning',
          message: `Theorem "${thm.name}" contains unresolved obligation ('sorry' or 'admit')`,
          line: thm.lineNumber,
          theorem: thm.name,
        });
      } else if (thm.isProven) {
        verifiedCount++;
      }
    }

    // Check syntax bracket balancing
    const balanceErrors = this.checkBracketBalancing(code);
    diagnostics.push(...balanceErrors);

    // If real Lean 4 compiler is present, execute it
    let compilerUsed = false;
    if (this.hasLeanToolchain && !options.targetTheorem) {
      try {
        const compilerResult = this.runLeanCompiler(code, options.timeoutMs || 10000);
        compilerUsed = true;
        if (!compilerResult.success) {
          diagnostics.push({
            severity: 'error',
            message: compilerResult.output || 'Lean 4 compiler reported errors',
          });
        }
      } catch (err: any) {
        diagnostics.push({
          severity: 'error',
          message: `Lean compiler execution error: ${err.message}`,
        });
      }
    }

    // Determine overall status
    const hasErrors = diagnostics.some((d) => d.severity === 'error');
    let status: 'VERIFIED' | 'OPEN_OBLIGATIONS' | 'FAILED' = 'VERIFIED';

    if (hasErrors) {
      status = 'FAILED';
    } else if (sorryCount > 0) {
      status = 'OPEN_OBLIGATIONS';
    }

    const duration = Date.now() - startTime;

    return {
      status,
      theoremsFound: theorems.length,
      theoremsVerified: verifiedCount,
      sorryCount,
      axiomsUsed: axioms,
      theorems,
      diagnostics,
      compilerUsed,
      verificationDurationMs: duration,
    };
  }

  /**
   * Extracts Lean 4 theorem, lemma, def, and example declarations.
   */
  public extractTheorems(code: string): LeanTheoremInfo[] {
    const lines = code.split('\n');
    const theorems: LeanTheoremInfo[] = [];

    // Match keywords: theorem, lemma, def, example
    const declRegex = /^(theorem|lemma|def|example)\s+([a-zA-Z0-9_'.]+)?\s*([^:=]*)(:=|\bby\b)([\s\S]*)$/;
    const declStartRegex = /^(theorem|lemma|def|example)\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (declStartRegex.test(line)) {
        // Collect block until next declaration or end of block
        let block = lines[i];
        let j = i + 1;
        while (j < lines.length && !declStartRegex.test(lines[j].trim())) {
          block += '\n' + lines[j];
          j++;
        }

        const match = block.match(declRegex) || lines[i].match(/^(theorem|lemma|def|example)\s+([a-zA-Z0-9_'.]+)?/);
        const kind = (match?.[1] || 'theorem') as 'theorem' | 'lemma' | 'def' | 'example';
        const name = match?.[2] || `anonymous_${i + 1}`;
        const signature = match?.[3]?.trim() || line;
        const proofBody = block;

        const hasSorry = /\b(sorry|admit)\b/.test(proofBody);
        const tactics = this.extractTactics(proofBody);
        const isProven = !hasSorry && (tactics.length > 0 || proofBody.includes(':=') || proofBody.includes('rfl'));

        theorems.push({
          name,
          kind,
          signature,
          proofBody,
          isProven,
          hasSorry,
          tacticsUsed: tactics,
          lineNumber: i + 1,
        });
      }
    }

    return theorems;
  }

  /**
   * Extracts declared or utilized axioms in the file.
   */
  public extractAxioms(code: string): string[] {
    const axioms: string[] = [];
    const lines = code.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^axiom\s+([a-zA-Z0-9_'.]+)/);
      if (match && match[1]) {
        axioms.push(match[1]);
      }
    }
    return axioms;
  }

  /**
   * Extracts common Lean 4 tactics used in proof blocks.
   */
  private extractTactics(proofBody: string): string[] {
    const knownTactics = [
      'intro',
      'intros',
      'rfl',
      'simp',
      'exact',
      'apply',
      'cases',
      'induction',
      'rewrite',
      'rw',
      'contradiction',
      'omega',
      'decide',
      'aesop',
      'linarith',
      'ring',
      'constructor',
      'assumption',
      'revert',
    ];

    const found: Set<string> = new Set();
    for (const tac of knownTactics) {
      const re = new RegExp(`\\b${tac}\\b`);
      if (re.test(proofBody)) {
        found.add(tac);
      }
    }
    return Array.from(found);
  }

  /**
   * Validates delimiter and bracket integrity.
   */
  private checkBracketBalancing(code: string): LeanDiagnostic[] {
    const diagnostics: LeanDiagnostic[] = [];
    const stack: { char: string; line: number }[] = [];
    const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };
    const opens = new Set(['(', '{', '[']);

    const lines = code.split('\n');
    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const line = lines[lineNum - 1];
      // Skip line comments
      const uncommented = line.split('--')[0];

      for (let i = 0; i < uncommented.length; i++) {
        const c = uncommented[i];
        if (opens.has(c)) {
          stack.push({ char: c, line: lineNum });
        } else if (pairs[c]) {
          const last = stack.pop();
          if (!last || last.char !== pairs[c]) {
            diagnostics.push({
              severity: 'error',
              message: `Mismatched closing delimiter '${c}'`,
              line: lineNum,
            });
          }
        }
      }
    }

    if (stack.length > 0) {
      const unclosed = stack.pop()!;
      diagnostics.push({
        severity: 'error',
        message: `Unclosed delimiter '${unclosed.char}' opened at line ${unclosed.line}`,
        line: unclosed.line,
      });
    }

    return diagnostics;
  }

  /**
   * Executes local Lean compiler binary against temporary test file.
   */
  private runLeanCompiler(code: string, timeoutMs: number): { success: boolean; output: string } {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `lean_verify_${Date.now()}.lean`);
    try {
      fs.writeFileSync(tmpFile, code, 'utf8');
      const output = execSync(`lean "${tmpFile}"`, {
        encoding: 'utf8',
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { success: true, output };
    } catch (err: any) {
      const output = err.stdout || err.stderr || err.message;
      return { success: false, output };
    } finally {
      if (fs.existsSync(tmpFile)) {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }
  }
}

export async function runLeanVerification(
  source: string,
  options: LeanVerifyOptions = {}
): Promise<LeanVerificationResult> {
  const verifier = new LeanProofVerifier();
  return verifier.verify(source, options);
}
