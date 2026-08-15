import * as crypto from 'crypto';

export interface TripwireConfig {
  maxRedTests: number;         // Default: 3
  maxFileChurn: number;        // Default: 3
  tokenBudget: number;         // Hard token cap for local + frontier budget
  wallClockTimeoutMs: number;  // Default: 15-20 min timeout (900000 - 1200000 ms)
}

export interface FileEditEntry {
  path: string;
  hash: string;
}

export interface ExecutionTelemetry {
  startTime: number;
  tokensConsumed: number;
  consecutiveTestFailures: number;
  fileEditHistory: FileEditEntry[];
  diffHistory: string[];
}

export interface TripwireVerdict {
  tripped: boolean;
  reason?: 'TRIPWIRE_WALL_CLOCK_TIMEOUT' | 'TRIPWIRE_TOKEN_BUDGET_BREACH' | 'TRIPWIRE_CONSECUTIVE_RED_TESTS' | string;
}

/**
 * TripwireMonitor
 * Evaluates running agent telemetry turn-by-turn.
 * Implements the 5 core mechanical tripwires outlined in Field Manual No. 11.
 */
export class TripwireMonitor {
  constructor(private config: TripwireConfig) {}

  /**
   * Evaluates the current execution telemetry against the strict safety configurations.
   * @param telemetry Active turn telemetry metrics
   * @returns TripwireVerdict indicating whether execution should be halted
   */
  public check(telemetry: ExecutionTelemetry): TripwireVerdict {
    // 1. Wall-clock Timeout Guard
    const elapsed = Date.now() - telemetry.startTime;
    if (elapsed > this.config.wallClockTimeoutMs) {
      return {
        tripped: true,
        reason: `TRIPWIRE_WALL_CLOCK_TIMEOUT: Elapsed execution time of ${Math.round(elapsed / 1000)}s exceeded hard timeout limit of ${Math.round(this.config.wallClockTimeoutMs / 1000)}s.`
      };
    }

    // 2. Token Budget Breach Guard
    if (telemetry.tokensConsumed > this.config.tokenBudget) {
      return {
        tripped: true,
        reason: `TRIPWIRE_TOKEN_BUDGET_BREACH: Consumed ${telemetry.tokensConsumed} tokens, exceeding the set limit of ${this.config.tokenBudget} tokens.`
      };
    }

    // 3. Consecutive Red Tests Guard
    if (telemetry.consecutiveTestFailures >= this.config.maxRedTests) {
      return {
        tripped: true,
        reason: `TRIPWIRE_CONSECUTIVE_RED_TESTS: Test suite has failed consecutively ${telemetry.consecutiveTestFailures} times, hitting the limits of the local retry loop.`
      };
    }

    // 4. File Churn Threshold Guard
    const editCounts = telemetry.fileEditHistory.reduce((acc, edit) => {
      acc[edit.path] = (acc[edit.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [filePath, count] of Object.entries(editCounts)) {
      if (count >= this.config.maxFileChurn) {
        return {
          tripped: true,
          reason: `TRIPWIRE_FILE_CHURN: File "${filePath}" has been edited ${count} times during this self-healing loop without passing validation gates.`
        };
      }
    }

    // 5. Diff Reversals Guard (Circular Loop Prevention)
    const seenDiffHashes = new Set<string>();
    for (const diff of telemetry.diffHistory) {
      if (!diff || diff.trim() === '') continue;
      const hash = crypto.createHash('sha256').update(diff).digest('hex');
      if (seenDiffHashes.has(hash)) {
        return {
          tripped: true,
          reason: `TRIPWIRE_DIFF_REVERSAL: Detected a circular patching loop. The model generated a diff that matches a previous failed state (SHA-256: ${hash.substring(0, 8)}).`
        };
      }
      seenDiffHashes.add(hash);
    }

    return { tripped: false };
  }
}
