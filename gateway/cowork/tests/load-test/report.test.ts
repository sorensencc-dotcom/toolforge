import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReportWriter, generateRunId, LoadTestReport } from '../../load-test/report';

describe('Report', () => {
  describe('generateRunId', () => {
    it('generates a valid run ID', () => {
      const runId = generateRunId();
      expect(runId).toMatch(/^run-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });
  });

  describe('ReportWriter', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it('writes JSON report with correct schema', async () => {
      const report: LoadTestReport = {
        runId: 'test-run-1',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        mockServerBaseUrl: 'http://localhost:3000',
        scenarios: [
          {
            multiplier: 1,
            concurrency: 5,
            cycleIntervalMs: 30000,
            registry: {
              opLatencyMs: { p50: 10, p95: 20, p99: 30 },
              opsTotal: 100,
            },
            manifest: {
              pushSuccessRate: 0.95,
              pushLatencyMs: { p50: 50, p95: 100, p99: 150 },
              pushCount: 100,
              pullSuccessRate: 0.98,
              pullLatencyMs: { p50: 40, p95: 80, p99: 120 },
              pullCount: 100,
            },
            syncStateChurn: {
              mutationsPerSecond: 5.5,
            },
            heartbeat: {
              targetIntervalMs: 30000,
              observedIntervalMs: { p50: 29000, p95: 31000, p99: 32000 },
              driftMs: 1000,
            },
            retryBackoff: {
              observedDelaysMs: [100, 300, 1000],
              expectedDelaysMs: [100, 300, 1000],
              matched: true,
            },
            errorEnvelope: {
              conformsToAdapterResponse: false,
              sampleMismatches: [
                {
                  got: { error: 'unauthorized' },
                  expected: 'AdapterResponse',
                },
              ],
            },
            hashConsistency: {
              pulledHashesAlwaysMatchAPush: true,
              tornDetected: 0,
            },
            thresholdFlags: [
              {
                metric: 'test_metric',
                observed: 5000,
                threshold: 5000,
                exceeded: false,
              },
            ],
          },
        ],
      };

      const writer = new ReportWriter();
      await writer.writeReport(report, tmpDir);

      const jsonPath = path.join(tmpDir, 'report.json');
      expect(fs.existsSync(jsonPath)).toBe(true);

      const content = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.runId).toBe('test-run-1');
      expect(parsed.scenarios.length).toBe(1);
      expect(parsed.scenarios[0].multiplier).toBe(1);
    });

    it('writes markdown summary', async () => {
      const report: LoadTestReport = {
        runId: 'test-run-2',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        mockServerBaseUrl: 'http://localhost:3000',
        scenarios: [
          {
            multiplier: 1,
            concurrency: 5,
            cycleIntervalMs: 30000,
            registry: {
              opLatencyMs: { p50: 10, p95: 20, p99: 30 },
              opsTotal: 100,
            },
            manifest: {
              pushSuccessRate: 0.95,
              pushLatencyMs: { p50: 50, p95: 100, p99: 150 },
              pushCount: 100,
              pullSuccessRate: 0.98,
              pullLatencyMs: { p50: 40, p95: 80, p99: 120 },
              pullCount: 100,
            },
            syncStateChurn: {
              mutationsPerSecond: 5.5,
            },
            heartbeat: {
              targetIntervalMs: 30000,
              observedIntervalMs: { p50: 29000, p95: 31000, p99: 32000 },
              driftMs: 1000,
            },
            retryBackoff: {
              observedDelaysMs: [100, 300, 1000],
              expectedDelaysMs: [100, 300, 1000],
              matched: true,
            },
            errorEnvelope: {
              conformsToAdapterResponse: false,
              sampleMismatches: [],
            },
            hashConsistency: {
              pulledHashesAlwaysMatchAPush: true,
              tornDetected: 0,
            },
            thresholdFlags: [],
          },
        ],
      };

      const writer = new ReportWriter();
      await writer.writeReport(report, tmpDir);

      const mdPath = path.join(tmpDir, 'report.md');
      const mdContent = fs.readFileSync(mdPath, 'utf-8');
      expect(mdContent).toContain('# Load Test Report');
      expect(mdContent).toContain('Multiplier 1x');
      expect(mdContent).toContain('95.0%');
    });

    it('creates output directory if it does not exist', async () => {
      const newDir = path.join(tmpDir, 'nested', 'dir');
      const report: LoadTestReport = {
        runId: 'test-run-3',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        mockServerBaseUrl: 'http://localhost:3000',
        scenarios: [],
      };

      const writer = new ReportWriter();
      await writer.writeReport(report, newDir);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.existsSync(path.join(newDir, 'report.json'))).toBe(true);
    });
  });
});
