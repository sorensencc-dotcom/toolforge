#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const STANDARD_SCENARIOS = Object.freeze([
  { id: 'ci-defect-triage', name: 'CI Defect Triage', task: 'Root-cause a workflow failure from GitHub Actions logs across three target modules.' },
  { id: 'module-relationship-mapping', name: 'Module Relationship Mapping', task: 'Trace downstream consumers of a modified core interface.' },
  { id: 'contract-enum-validation', name: 'Contract and Enum Validation', task: 'Verify cross-repository enum consistency across @toolforge packages.' },
  { id: 'wiki-autoheal-scan', name: 'Wiki Autoheal Scan', task: 'Audit broken link anchors and metadata frontmatter across vault nodes.' },
  { id: 'full-feature-audit', name: 'Full Feature Audit', task: 'Perform a multi-file architectural review across the repository.' },
]);

const NUMERIC_FIELDS = ['total_input_tokens', 'total_output_tokens', 'rpc_call_count', 'resource_read_count', 'l2_read_count'];
const STATUS_START = '<!-- VIKING_BENCHMARK_START -->';
const STATUS_END = '<!-- VIKING_BENCHMARK_END -->';

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function reduction(baseline, viking) {
  return baseline === 0 ? 0 : round(((baseline - viking) / baseline) * 100);
}

function validateResult(result, label) {
  if (!result || typeof result !== 'object') throw new TypeError(`${label} must return metrics`);
  for (const field of NUMERIC_FIELDS) {
    if (!Number.isFinite(result[field]) || result[field] < 0) {
      throw new TypeError(`${label}.${field} must be a non-negative finite number`);
    }
  }
  if (result.l2_read_count > result.resource_read_count) {
    throw new RangeError(`${label}.l2_read_count cannot exceed resource_read_count`);
  }
  if (typeof result.outcome_fingerprint !== 'string' || !result.outcome_fingerprint) {
    throw new TypeError(`${label}.outcome_fingerprint must be a non-empty string`);
  }
  if (!result.tokenizer || typeof result.tokenizer.name !== 'string') {
    throw new TypeError(`${label}.tokenizer must include a name and exact flag`);
  }
}

async function executeMeasured(execute, input, clock) {
  const startedAt = clock();
  const result = await execute(input);
  const normalized = { ...result, wall_clock_time_ms: result?.wall_clock_time_ms ?? clock() - startedAt };
  if (!Number.isFinite(normalized.wall_clock_time_ms) || normalized.wall_clock_time_ms < 0) {
    throw new TypeError(`${input.scenario.id}/${input.mode}.wall_clock_time_ms must be non-negative`);
  }
  validateResult(normalized, `${input.scenario.id}/${input.mode}`);
  return normalized;
}

function aggregateRuns(runs) {
  const aggregate = {};
  for (const field of [...NUMERIC_FIELDS, 'wall_clock_time_ms']) {
    aggregate[field] = round(median(runs.map((run) => run[field])));
  }
  aggregate.l2_escalation_rate_percent = aggregate.resource_read_count === 0
    ? 0
    : round((aggregate.l2_read_count / aggregate.resource_read_count) * 100);
  return aggregate;
}

const unique = (values) => [...new Set(values)];

export async function runVikingTokenBenchmark({ execute, scenarios = STANDARD_SCENARIOS, repetitions = 3, clock = () => performance.now() } = {}) {
  if (typeof execute !== 'function') throw new TypeError('execute must be a function');
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new RangeError('repetitions must be a positive integer');
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('scenarios must be a non-empty array');

  const scenarioReports = [];
  const publicationBlockers = [];
  const tokenizerNames = [];

  for (const scenario of scenarios) {
    const runs = { baseline: [], viking: [] };
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const baseline = await executeMeasured(execute, { scenario, mode: 'baseline', repetition }, clock);
      const viking = await executeMeasured(execute, { scenario, mode: 'viking', repetition }, clock);
      if (baseline.outcome_fingerprint !== viking.outcome_fingerprint) {
        throw new Error(`Outcome fingerprint mismatch for ${scenario.id} repetition ${repetition}`);
      }
      for (const result of [baseline, viking]) {
        tokenizerNames.push(result.tokenizer.name);
        if (result.tokenizer.exact !== true) publicationBlockers.push('Token counts were not produced by an exact tokenizer.');
      }
      runs.baseline.push(baseline);
      runs.viking.push(viking);
    }

    const baseline = aggregateRuns(runs.baseline);
    const viking = aggregateRuns(runs.viking);
    scenarioReports.push({
      ...scenario,
      baseline,
      viking,
      delta: {
        input_token_reduction_percent: reduction(baseline.total_input_tokens, viking.total_input_tokens),
        output_token_reduction_percent: reduction(baseline.total_output_tokens, viking.total_output_tokens),
        wall_clock_change_percent: baseline.wall_clock_time_ms === 0 ? 0 : round(((viking.wall_clock_time_ms - baseline.wall_clock_time_ms) / baseline.wall_clock_time_ms) * 100),
        rpc_call_change: round(viking.rpc_call_count - baseline.rpc_call_count),
      },
    });
  }

  if (unique(tokenizerNames).length > 1) publicationBlockers.push('Benchmark runs used inconsistent tokenizers.');
  const summaryBaselineInput = round(median(scenarioReports.map((item) => item.baseline.total_input_tokens)));
  const summaryVikingInput = round(median(scenarioReports.map((item) => item.viking.total_input_tokens)));
  const vikingResourceReads = scenarioReports.reduce((sum, item) => sum + item.viking.resource_read_count, 0);
  const vikingL2Reads = scenarioReports.reduce((sum, item) => sum + item.viking.l2_read_count, 0);
  const blockers = unique(publicationBlockers);
  const medianPair = (field) => ({
    baseline: round(median(scenarioReports.map((item) => item.baseline[field]))),
    viking: round(median(scenarioReports.map((item) => item.viking[field]))),
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    repetitions,
    tokenizer: unique(tokenizerNames),
    publication_eligible: blockers.length === 0,
    publication_blockers: blockers,
    targets: { input_token_reduction_percent: { minimum: 60, stretch: 80 }, l2_escalation_rate_percent: { maximum: 20 } },
    summary: {
      total_input_tokens: { baseline: summaryBaselineInput, viking: summaryVikingInput },
      total_output_tokens: medianPair('total_output_tokens'),
      wall_clock_time_ms: medianPair('wall_clock_time_ms'),
      rpc_call_count: medianPair('rpc_call_count'),
      input_token_reduction_percent: reduction(summaryBaselineInput, summaryVikingInput),
      l2_escalation_rate_percent: vikingResourceReads === 0 ? 0 : round((vikingL2Reads / vikingResourceReads) * 100),
    },
    scenarios: scenarioReports,
  };
}

export function renderDailyStatusDelta(report) {
  const { summary } = report;
  return [
    STATUS_START,
    '## Viking VFS Token Benchmark',
    '',
    `- Generated: ${report.generated_at}`,
    `- Repetitions per mode: ${report.repetitions}`,
    `- Input tokens: ${summary.total_input_tokens.baseline} baseline -> ${summary.total_input_tokens.viking} Viking (${summary.input_token_reduction_percent.toFixed(2)}% reduction)`,
    `- Wall clock: ${summary.wall_clock_time_ms.baseline} ms baseline -> ${summary.wall_clock_time_ms.viking} ms Viking`,
    `- RPC calls: ${summary.rpc_call_count.baseline} baseline -> ${summary.rpc_call_count.viking} Viking`,
    `- Viking L2 escalation rate: ${summary.l2_escalation_rate_percent.toFixed(2)}%`,
    `- Publication eligible: ${report.publication_eligible ? 'yes' : 'no'}`,
    STATUS_END,
  ].join('\n');
}

export function updateDailyStatus(content, report) {
  const section = renderDailyStatusDelta(report);
  const pattern = new RegExp(`${STATUS_START}[\\s\\S]*?${STATUS_END}`);
  return pattern.test(content) ? content.replace(pattern, section) : `${content.trimEnd()}\n\n${section}\n`;
}

function parseArgs(argv) {
  const options = { repetitions: 3 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--adapter') options.adapter = argv[++index];
    else if (flag === '--output') options.output = argv[++index];
    else if (flag === '--daily-status') options.dailyStatus = argv[++index];
    else if (flag === '--repetitions') options.repetitions = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!options.adapter) throw new Error('--adapter <module> is required');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const adapter = await import(pathToFileURL(path.resolve(options.adapter)).href);
  if (typeof adapter.executeBenchmarkRun !== 'function') throw new TypeError('Adapter must export executeBenchmarkRun(input)');
  const report = await runVikingTokenBenchmark({ execute: adapter.executeBenchmarkRun, repetitions: options.repetitions });
  const outputPath = path.resolve(options.output ?? path.join('logs', 'benchmarks', `viking-token-savings-${Date.now()}.json`));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (options.dailyStatus) {
    const statusPath = path.resolve(options.dailyStatus);
    let content = '';
    try { content = await readFile(statusPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(path.dirname(statusPath), { recursive: true });
    await writeFile(statusPath, updateDailyStatus(content, report), 'utf8');
  }
  process.stdout.write(`${outputPath}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
