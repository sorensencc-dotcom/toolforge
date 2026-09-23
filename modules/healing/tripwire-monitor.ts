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
  private config: TripwireConfig;

  constructor(config?: Partial<TripwireConfig>) {
    this.config = {
      maxRedTests: config?.maxRedTests ?? 3,
      maxFileChurn: config?.maxFileChurn ?? 3,
      tokenBudget: config?.tokenBudget ?? 25000,
      wallClockTimeoutMs: config?.wallClockTimeoutMs ?? 15 * 60 * 1000
    };
  }

  /**
   * Evaluates the current execution telemetry against the strict safety configurations.
   * @param telemetry Active turn telemetry metrics
   * @returns TripwireVerdict indicating whether execution should be halted
   */
  public check(telemetry: ExecutionTelemetry): TripwireVerdict {
    // 1. Wall-clock Timeout Guard
    if (Date.now() - telemetry.startTime > this.config.wallClockTimeoutMs) {
      return { tripped: true, reason: 'TRIPWIRE_WALL_CLOCK_TIMEOUT' };
    }

    // 2. Token Budget Breach Guard
    if (telemetry.tokensConsumed > this.config.tokenBudget) {
      return { tripped: true, reason: 'TRIPWIRE_TOKEN_BUDGET_BREACH' };
    }

    // 3. Consecutive Red Tests Guard
    if (telemetry.consecutiveTestFailures >= this.config.maxRedTests) {
      return { tripped: true, reason: 'TRIPWIRE_CONSECUTIVE_RED_TESTS' };
    }

    // 4. File Churn Threshold Guard
    const editCounts = (telemetry.fileEditHistory || []).reduce((acc, edit) => {
      acc[edit.path] = (acc[edit.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [filePath, count] of Object.entries(editCounts)) {
      if (count >= this.config.maxFileChurn) {
        return { tripped: true, reason: `TRIPWIRE_FILE_CHURN: ${filePath}` };
      }
    }

    // 5. Diff Reversals Guard (Circular Loop Prevention)
    const seenDiffHashes = new Set<string>();
    for (const diff of (telemetry.diffHistory || [])) {
      if (!diff || diff.trim() === '') continue;
      const hash = crypto.createHash('sha256').update(diff.trim()).digest('hex');
      if (seenDiffHashes.has(hash)) {
        return { tripped: true, reason: 'TRIPWIRE_DIFF_REVERSAL' };
      }
      seenDiffHashes.add(hash);
    }

    return { tripped: false };
  }
}
