import * as fs from 'fs';
import * as path from 'path';
import { PercentileStats } from './collectors';
import { ThresholdFlag } from './assertions';

export interface ScenarioMetrics {
  multiplier: number;
  concurrency: number;
  cycleIntervalMs: number;
  registry: {
    opLatencyMs: PercentileStats;
    opsTotal: number;
  };
  manifest: {
    pushSuccessRate: number;
    pushLatencyMs: PercentileStats;
    pushCount: number;
    pullSuccessRate: number;
    pullLatencyMs: PercentileStats;
    pullCount: number;
  };
  syncStateChurn: {
    mutationsPerSecond: number;
  };
  heartbeat: {
    targetIntervalMs: number;
    observedIntervalMs: PercentileStats;
    driftMs: number;
  };
  retryBackoff: {
    observedDelaysMs: number[];
    expectedDelaysMs: number[];
    matched: boolean;
  };
  errorEnvelope: {
    conformsToAdapterResponse: boolean;
    sampleMismatches: Array<{ got: unknown; expected: string }>;
  };
  hashConsistency: {
    pulledHashesAlwaysMatchAPush: boolean;
    tornDetected: number;
  };
  thresholdFlags: ThresholdFlag[];
}

export interface LoadTestReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  mockServerBaseUrl: string;
  scenarios: ScenarioMetrics[];
}

export class ReportWriter {
  async writeReport(report: LoadTestReport, outputDir: string): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON report
    const jsonPath = path.join(outputDir, 'report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Write markdown summary
    const mdPath = path.join(outputDir, 'summary.md');
    const markdown = this.generateMarkdown(report);
    fs.writeFileSync(mdPath, markdown);
  }

  private generateMarkdown(report: LoadTestReport): string {
    const lines: string[] = [
      `# Load Test Report`,
      ``,
      `**Run ID:** ${report.runId}`,
      `**Started:** ${report.startedAt}`,
      `**Finished:** ${report.finishedAt}`,
      `**Mock Server Base URL:** ${report.mockServerBaseUrl}`,
      ``,
    ];

    for (const scenario of report.scenarios) {
      lines.push(`## Multiplier ${scenario.multiplier}x (${scenario.concurrency} concurrent gateways)`);
      lines.push(``);

      lines.push(`### Registry Operations`);
      lines.push(`- Total Operations: ${scenario.registry.opsTotal}`);
      lines.push(`- P50 Latency: ${scenario.registry.opLatencyMs.p50}ms`);
      lines.push(`- P95 Latency: ${scenario.registry.opLatencyMs.p95}ms`);
      lines.push(`- P99 Latency: ${scenario.registry.opLatencyMs.p99}ms`);
      lines.push(``);

      lines.push(`### Manifest Operations`);
      lines.push(`- Push Success Rate: ${(scenario.manifest.pushSuccessRate * 100).toFixed(1)}%`);
      lines.push(`  - P99 Latency: ${scenario.manifest.pushLatencyMs.p99}ms`);
      lines.push(`- Pull Success Rate: ${(scenario.manifest.pullSuccessRate * 100).toFixed(1)}%`);
      lines.push(`  - P99 Latency: ${scenario.manifest.pullLatencyMs.p99}ms`);
      lines.push(``);

      lines.push(`### Sync State`);
      lines.push(`- Churn: ${scenario.syncStateChurn.mutationsPerSecond.toFixed(2)} mutations/sec`);
      lines.push(``);

      lines.push(`### Heartbeat`);
      lines.push(`- Target Interval: ${scenario.heartbeat.targetIntervalMs}ms`);
      lines.push(`- Observed P50: ${scenario.heartbeat.observedIntervalMs.p50}ms`);
      lines.push(`- Observed P95: ${scenario.heartbeat.observedIntervalMs.p95}ms`);
      lines.push(`- Drift: ${scenario.heartbeat.driftMs}ms`);
      lines.push(``);

      lines.push(`### Retry/Backoff`);
      lines.push(`- Expected Delays: ${scenario.retryBackoff.expectedDelaysMs.join(', ')}ms`);
      lines.push(`- Pattern Matched: ${scenario.retryBackoff.matched ? 'Yes' : 'No'}`);
      lines.push(``);

      lines.push(`### Error Envelope`);
      lines.push(
        `- Conforms to AdapterResponse: ${scenario.errorEnvelope.conformsToAdapterResponse ? 'Yes' : 'No'}`
      );
      if (scenario.errorEnvelope.sampleMismatches.length > 0) {
        lines.push(`- Sample Mismatches:`);
        for (const mismatch of scenario.errorEnvelope.sampleMismatches.slice(0, 3)) {
          lines.push(
            `  - Got: ${JSON.stringify(mismatch.got)}, Expected: ${mismatch.expected}`
          );
        }
      }
      lines.push(``);

      lines.push(`### Hash Consistency`);
      lines.push(`- Pulled hashes always match a push: ${scenario.hashConsistency.pulledHashesAlwaysMatchAPush ? 'Yes' : 'No'}`);
      lines.push(`- Torn hashes detected: ${scenario.hashConsistency.tornDetected}`);
      lines.push(``);

      if (scenario.thresholdFlags.length > 0) {
        lines.push(`### Threshold Flags`);
        for (const flag of scenario.thresholdFlags) {
          const status = flag.exceeded ? '⚠️ EXCEEDED' : '✓';
          lines.push(
            `- ${status} ${flag.metric}: ${flag.observed} (threshold: ${flag.threshold})`
          );
        }
        lines.push(``);
      }

      lines.push(`---`);
      lines.push(``);
    }

    return lines.join('\n');
  }
}

export function generateRunId(): string {
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `run-${iso}`;
}
