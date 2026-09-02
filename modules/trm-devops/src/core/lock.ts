import fs from "node:fs";
import path from "node:path";

export interface LockData {
  pid: number;
  time: number;
}

export class FileLock {
  public readonly filePath: string;
  public readonly lockPath: string;
  public readonly timeoutMs: number;
  public readonly staleAgeMs: number;

  constructor(filePath: string, timeoutMs: number = 5000, staleAgeMs: number = 30000) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.timeoutMs = timeoutMs;
    this.staleAgeMs = staleAgeMs;
  }

  public async acquire(): Promise<boolean> {
    const startTime = Date.now();
    let currentDelay = 50;

    const lockDir = path.dirname(this.lockPath);
    if (!fs.existsSync(lockDir)) {
      fs.mkdirSync(lockDir, { recursive: true });
    }

    while (true) {
      if (Date.now() - startTime >= this.timeoutMs) {
        throw new Error(
          `Timeout exceeded (${this.timeoutMs}ms) while attempting to acquire lock: ${this.lockPath}`
        );
      }

      // Check for stale lock
      try {
        if (fs.existsSync(this.lockPath)) {
          const stats = fs.statSync(this.lockPath);
          if (Date.now() - stats.mtimeMs > this.staleAgeMs) {
            try {
              fs.unlinkSync(this.lockPath);
            } catch (unlinkErr: any) {
              if (unlinkErr?.code !== "ENOENT") {
                // Ignore if unlinked concurrently by another process
              }
            }
          }
        }
      } catch {
        // Race condition: file may have been modified or deleted between existsSync and statSync
      }

      // Attempt atomic file creation with 'wx' flag
      try {
        const payload: LockData = {
          pid: process.pid,
          time: Date.now(),
        };
        fs.writeFileSync(this.lockPath, JSON.stringify(payload), { flag: "wx" });
        return true;
      } catch (err: any) {
        if (err?.code === "EEXIST") {
          const elapsed = Date.now() - startTime;
          if (elapsed >= this.timeoutMs) {
            throw new Error(
              `Timeout exceeded (${this.timeoutMs}ms) while attempting to acquire lock: ${this.lockPath}`
            );
          }

          // Exponential backoff starting at 50ms with +/-20% jitter up to 2000ms max
          const jitterMultiplier = 0.8 + Math.random() * 0.4;
          const delay = Math.min(2000, Math.round(currentDelay * jitterMultiplier));
          const remaining = this.timeoutMs - elapsed;
          const waitTime = Math.min(delay, Math.max(1, remaining + 1));

          await new Promise((resolve) => setTimeout(resolve, waitTime));
          currentDelay = Math.min(2000, currentDelay * 2);
          continue;
        }
        throw err;
      }
    }
  }

  public release(): void {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
