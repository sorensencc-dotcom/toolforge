#!/usr/bin/env node
/**
 * scripts/compile-weekly-retro.mjs
 * 
 * Deterministic Weekly Retro Compiler & Publisher.
 * Ingests Git history, Meridian session telemetry, test suites, and debt markers
 * to compile a schema-validated Weekly Retro Report for the ICF Dashboard.
 * 
 * Runs 100% autonomously, headless, and zero-token.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateWeeklyRetroReport } from '../icf/reporting/src/weekly-retro-contract.mjs';
import { buildWeeklyRetroArtifact } from '../icf/reporting/src/publication-artifact.mjs';
import { CATEGORY_REGISTRY, normalizeCategoryMetrics } from '../icf/reporting/src/category-contract.mjs';
import { summarizeBacklog } from './backlog-summary.mjs';
import {
  buildTweetable,
  computeSessions,
  computeStreak,
  countActiveDays,
  countPrReferences,
  isSourceFile,
  localDay,
  topDirectories
} from './retro-metrics.mjs';
import { collectMeridianWeek, DEFAULT_MERIDIAN_DB } from '../modules/telemetry/meridian-telemetry.mjs';
import { buildReportActions } from './retro-report-actions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RETRO_DIR = path.resolve(REPO_ROOT, '.icf-retros', 'weekly');

function parseArgs() {
  const args = process.argv.slice(2);
  let date = null;
  let dryRun = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--verbose') {
      verbose = true;
    }
  }

  if (!date) {
    // Default to the previous Saturday or current date
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
    const daysSinceSaturday = (dayOfWeek + 1) % 7;
    const target = new Date(now);
    if (daysSinceSaturday > 0) {
      target.setDate(now.getDate() - daysSinceSaturday);
    }
    date = target.toISOString().slice(0, 10);
  }

  return { date, dryRun, verbose };
}

function shiftDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function isTestFile(filepath) {
  const norm = filepath.replace(/\\/g, '/').toLowerCase();
  return (
    norm.includes('.test.') ||
    norm.includes('.spec.') ||
    norm.includes('/__tests__/') ||
    norm.includes('/tests/') ||
    norm.includes('/test/')
  );
}

export function compileWeeklyRetro(targetDate = '2026-10-03', options = {}) {
  const sinceDate = shiftDateString(targetDate, -6);
  const sinceIso = `${sinceDate}T00:00:00`;
  const untilIso = `${targetDate}T23:59:59`;

  // 1. Gather Git Commit Logs
  const gitLogRaw = execFileSync(
    'git',
    [
      'log',
      `--since=${sinceIso}`,
      `--until=${untilIso}`,
      '--numstat',
      '--format=COMMIT_START:%H|%an|%aI|%s'
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );

  const rawBlocks = gitLogRaw.split('COMMIT_START:').filter(Boolean);
  const commitList = [];
  const authorsMap = {};
  const automationMap = {};
  let totalInsertions = 0;
  let totalDeletions = 0;
  let totalTestLoc = 0;
  const commitTypes = { feat: 0, fix: 0, docs: 0, chore: 0, test: 0, refactor: 0 };
  const hourDistribution = {};
  const testFilesChangedSet = new Set();
  const versionsSeen = [];
  const commitDays = [];
  const commitTimes = [];
  const allFiles = [];
  const filesByAuthor = {};
  let totalSourceInsertions = 0;

  for (const block of rawBlocks) {
    const lines = block.trim().split(/\r?\n/);
    const header = lines[0];
    const [hash, author, dateStr, subject] = header.split('|');
    const numstatLines = lines.slice(1);

    let commitInsertions = 0;
    let commitDeletions = 0;
    let commitTestLoc = 0;

    for (const stat of numstatLines) {
      const parts = stat.trim().split(/\t+/);
      if (parts.length >= 3) {
        const ins = parseInt(parts[0], 10) || 0;
        const del = parseInt(parts[1], 10) || 0;
        const file = parts[2];
        allFiles.push(file);
        (filesByAuthor[author] ||= []).push(file);
        if (isSourceFile(file) && !isTestFile(file)) totalSourceInsertions += ins;

        commitInsertions += ins;
        commitDeletions += del;
        if (isTestFile(file)) {
          commitTestLoc += ins;
          testFilesChangedSet.add(file);
        }
      }
    }

    totalInsertions += commitInsertions;
    totalDeletions += commitDeletions;
    totalTestLoc += commitTestLoc;

    const commitDate = new Date(dateStr);
    const hour = commitDate.getHours();
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    commitDays.push(localDay(dateStr));
    commitTimes.push(commitDate.getTime());

    // Categorize commit type
    const lowerSub = subject.toLowerCase();
    if (lowerSub.startsWith('feat')) commitTypes.feat++;
    else if (lowerSub.startsWith('fix')) commitTypes.fix++;
    else if (lowerSub.startsWith('docs')) commitTypes.docs++;
    else if (lowerSub.startsWith('chore')) commitTypes.chore++;
    else if (lowerSub.startsWith('test')) commitTypes.test++;
    else if (lowerSub.startsWith('refactor')) commitTypes.refactor++;
    else commitTypes.feat++;

    // Version tags from release commits
    const releaseMatch = subject.match(/chore\(release\):\s*v?([0-9]+\.[0-9]+\.[0-9]+)/i);
    if (releaseMatch) {
      versionsSeen.push(releaseMatch[1]);
    }

    // Author tracking
    const isBot = /bot|automation|actions/i.test(author);
    const targetMap = isBot ? automationMap : authorsMap;
    if (!targetMap[author]) {
      targetMap[author] = {
        commits: 0,
        insertions: 0,
        deletions: 0,
        test_loc: 0,
        top_area: ''
      };
    }
    targetMap[author].commits++;
    targetMap[author].insertions += commitInsertions;
    targetMap[author].deletions += commitDeletions;
    targetMap[author].test_loc += commitTestLoc;

    commitList.push({ hash, author, subject, commitDate });
  }

  // Find peak hour
  let peakHour = 0;
  let maxHourCount = 0;
  for (const [h, count] of Object.entries(hourDistribution)) {
    if (count > maxHourCount) {
      maxHourCount = count;
      peakHour = parseInt(h, 10);
    }
  }

  // Version range
  const currentVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
  let versionRange = [currentVersion, currentVersion];
  if (versionsSeen.length > 0) {
    versionRange = [versionsSeen[versionsSeen.length - 1], versionsSeen[0]];
  }

  // Total commits & author normalization
  const totalCommits = commitList.length;
  const categorizedTotal = (commitTypes.feat + commitTypes.fix + commitTypes.docs + commitTypes.chore) || 1;
  const featPct = Math.round((commitTypes.feat / categorizedTotal) * 100) / 100;
  const fixPct = Math.round((commitTypes.fix / categorizedTotal) * 100) / 100;
  const docsPct = Math.round((commitTypes.docs / categorizedTotal) * 100) / 100;
  const chorePct = Math.round((commitTypes.chore / categorizedTotal) * 100) / 100;

  for (const a of Object.keys(authorsMap)) {
    const d = authorsMap[a];
    d.test_ratio = d.insertions > 0 ? Math.round((d.test_loc / d.insertions) * 100) / 100 : 0;
    delete d.test_loc;
  }
  for (const [name, entry] of [...Object.entries(authorsMap), ...Object.entries(automationMap)]) {
    entry.top_area = topDirectories(filesByAuthor[name] || []).join(', ');
  }

  // 2. Meridian Telemetry
  let meridianTotals = { tracked_minutes: 0, minutes_by_category: {} };
  try {
    const meridian = collectMeridianWeek(options.meridianDbPath || DEFAULT_MERIDIAN_DB, targetDate);
    if (meridian.available && meridian.totals) {
      meridianTotals = meridian.totals;
    }
  } catch {}

  const sessionStats = computeSessions(commitTimes);
  const sessionsCount = sessionStats.sessions;
  const deepSessions = sessionStats.deep;
  const mediumSessions = sessionStats.medium;
  const microSessions = sessionStats.micro;
  const activeMinutes = meridianTotals.tracked_minutes || sessionStats.totalMinutes;

  // 3. Count Total Test Files on Disk
  let totalTestFiles = 0;
  try {
    const testFilesOutput = execFileSync(
      'git',
      ['ls-files', '*.test.js', '*.test.ts', '*.test.mjs', '*__tests__*'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    totalTestFiles = testFilesOutput.split(/\r?\n/).filter(Boolean).length;
  } catch {}

  // 4. Shortcut Debt & Backlog Markers
  let shortcutMarkersFound = 0;
  try {
    const grepOutput = execFileSync(
      'git',
      ['grep', '-i', 'ponytail:', '--', '*.mjs', '*.ts', '*.js'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    shortcutMarkersFound = grepOutput.split(/\r?\n/).filter(Boolean).length;
  } catch {}

  const netLoc = totalInsertions - totalDeletions;
  const logicalSlocAdded = totalSourceInsertions;
  const testRatio = totalInsertions > 0 ? Math.round((totalTestLoc / totalInsertions) * 100) / 100 : 0;
  const aiAssistedCommits = Number(execFileSync(
    'git',
    [
      'rev-list', '--count', `--since=${sinceIso}`, `--until=${untilIso}`,
      '-i', '-E', '--grep=^Co-Authored-By:.*(Claude|Codex|Copilot|Gemini)', 'HEAD'
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  ).trim());
  const streakHistory = execFileSync(
    'git',
    ['log', `--since=${shiftDateString(targetDate, -120)}T00:00:00`, `--until=${untilIso}`, '--format=%an|%aI'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  ).split(/\r?\n/).filter(Boolean).map(line => {
    const [name, iso] = line.split('|');
    return { name, day: localDay(iso) };
  });
  const streakDays = computeStreak(streakHistory.map(entry => entry.day), targetDate);
  const userStreakDays = computeStreak(
    streakHistory.filter(entry => !/bot|automation|actions/i.test(entry.name)).map(entry => entry.day),
    targetDate
  );

  const retroData = {
    date: targetDate,
    window: "7d",
    actions: buildReportActions({ targetDate, todosFile: path.join(REPO_ROOT, 'TODOS.md') }),
    metrics: {
      commits: totalCommits,
      contributors: Object.keys(authorsMap).length,
      prs_merged: null,
      prs_referenced: countPrReferences(commitList.map(commit => commit.subject)),
      insertions: totalInsertions,
      deletions: totalDeletions,
      net_loc: netLoc,
      logical_sloc_added: logicalSlocAdded,
      test_loc: totalTestLoc,
      test_ratio: testRatio,
      active_days: countActiveDays(commitDays),
      sessions: sessionsCount,
      deep_sessions: deepSessions,
      medium_sessions: mediumSessions,
      micro_sessions: microSessions,
      avg_session_minutes: sessionStats.avgMinutes,
      loc_per_session_hour: activeMinutes > 0 ? Math.round(logicalSlocAdded / (activeMinutes / 60)) : 0,
      feat_pct: featPct,
      fix_pct: fixPct,
      docs_pct: docsPct,
      chore_pct: chorePct,
      peak_hour: peakHour,
      ai_assisted_commits: aiAssistedCommits,
      focus_score: null,
      focus_area: topDirectories(allFiles, 3).join(', ')
    },
    authors: authorsMap,
    automation: automationMap,
    version_range: versionRange,
    release_commits: versionsSeen.length,
    streak_days: streakDays,
    user_streak_days: userStreakDays,
    streak_anchor: targetDate,
    tweetable: buildTweetable({ date: targetDate, commits: totalCommits, versionRange, testFiles: totalTestFiles }),
    test_health: {
      total_test_files: totalTestFiles,
      regression_test_commits: commitList.filter(commit => /regression/i.test(commit.subject)).length,
      test_files_changed: testFilesChangedSet.size
    },
    backlog: summarizeBacklog(options.todosPath || path.join(REPO_ROOT, 'TODOS.md'), sinceDate, targetDate),
    shortcut_debt: {
      markers_found: shortcutMarkersFound,
      no_trigger: 0
    },
    note: `Deterministic weekly retro compiled for week ending ${targetDate}: ${totalCommits} commits across versions ${versionRange[0]} → ${versionRange[1]}.`
  };

  return retroData;
}

export async function compileAndPublish(targetDate, options = {}) {
  const retroData = compileWeeklyRetro(targetDate, options);
  const validation = validateWeeklyRetroReport(retroData);

  if (!validation.ok) {
    throw new Error(`Weekly retro contract validation failed:\n${validation.errors.join('\n')}`);
  }

  if (options.dryRun) {
    console.log('[compile-weekly-retro] Dry run validation PASSED:');
    console.log(JSON.stringify(retroData, null, 2));
    return retroData;
  }

  if (!fs.existsSync(RETRO_DIR)) {
    fs.mkdirSync(RETRO_DIR, { recursive: true });
  }

  const normalized = normalizeCategoryMetrics(retroData, { registry: CATEGORY_REGISTRY, allowPartial: true });
  const definitions = new Map(CATEGORY_REGISTRY.categories.map(category => [category.id, category]));
  const categories = normalized.map(category => {
    const definition = definitions.get(category.category_id);
    const measured = category.metrics.filter(metric => metric.state !== 'unavailable').length;
    return {
      id: category.category_id,
      name: definition.label,
      summary: `${measured} of ${category.metrics.length} category metrics measured from the weekly report.`
    };
  });
  const evidence = normalized.flatMap(category => {
    const definition = definitions.get(category.category_id);
    return category.metrics
      .filter(metric => metric.state !== 'unavailable' && metric.value !== null)
      .map(metric => ({
        label: `${definition.label}: ${metric.metric_id} = ${metric.value}`,
        source: metric.source_field,
        category: category.category_id
      }));
  });

  const artifact = buildWeeklyRetroArtifact({
    report: retroData,
    categories,
    evidence,
    actions: retroData.actions || []
  });

  const runFile = path.join(RETRO_DIR, `retro-${targetDate}.json`);
  const latestFile = path.join(RETRO_DIR, 'latest-weekly-retro.json');

  const atomicWrite = async (dest, payload) => {
    const tmp = `${dest}.tmp-${process.pid}`;
    await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tmp, dest);
  };

  await atomicWrite(runFile, artifact);
  await atomicWrite(latestFile, artifact);

  console.log(`[compile-weekly-retro] ✔ Successfully published weekly retro:`);
  console.log(`  - Run File:    ${runFile}`);
  console.log(`  - Latest File: ${latestFile}`);
  console.log(`  - Metrics:     ${retroData.metrics.commits} commits, ${retroData.metrics.insertions} insertions, ${retroData.version_range.join(' → ')}`);

  return artifact;
}

// Direct CLI entrypoint
const isDirectEntry = process.argv[1] && (
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase() ||
  process.argv[1].replace(/\\/g, '/').endsWith('compile-weekly-retro.mjs')
);

if (isDirectEntry) {
  const args = parseArgs();
  compileAndPublish(args.date, args)
    .catch(err => {
      console.error('[compile-weekly-retro] ✖ Error:', err.message);
      process.exit(1);
    });
}
