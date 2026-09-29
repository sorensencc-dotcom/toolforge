import fs from 'node:fs';
import path from 'node:path';
import { validateWeeklyRetroReport } from '../icf/reporting/src/weekly-retro-contract.mjs';

const retroData = {
  date: "2026-09-26",
  window: "7d",
  metrics: {
    commits: 42,
    contributors: 2,
    prs_merged: null,
    prs_referenced: 7,
    insertions: 4892,
    deletions: 340,
    net_loc: 4552,
    logical_sloc_added: 3910,
    test_loc: 1120,
    test_ratio: 0.23,
    active_days: 5,
    sessions: 9,
    deep_sessions: 4,
    medium_sessions: 3,
    micro_sessions: 2,
    avg_session_minutes: 62,
    loc_per_session_hour: 580,
    feat_pct: 0.45,
    fix_pct: 0.25,
    docs_pct: 0.20,
    chore_pct: 0.10,
    peak_hour: 22,
    ai_assisted_commits: 12,
    focus_score: 0.85,
    focus_area: "Ironbots Fleet & ICF Dashboard"
  },
  authors: {
    "Chris Sorensen": {
      "commits": 38,
      "insertions": 4650,
      "deletions": 310,
      "test_ratio": 0.23,
      "top_area": "scripts/, icf/, modules/"
    }
  },
  automation: {
    "toolforge-release-bot": {
      "commits": 4,
      "insertions": 242,
      "deletions": 30
    }
  },
  version_range: ["2.66.2", "2.68.0"],
  release_commits: 4,
  streak_days: 6,
  user_streak_days: 6,
  streak_anchor: "2026-09-26",
  tweetable: "Week of Sep 26: 42 commits, 9 Ironbots unattended fleet deployed with S4U automation, real-time SSE live stream, zero-token local Ollama bridge, 100% test pass across 24 suites.",
  test_health: {
    total_test_files: 192,
    regression_test_commits: 0,
    test_files_changed: 14
  },
  backlog: {
    total_open: 4,
    p0_p1: 1,
    p2: 3,
    completed_this_period: 4,
    added_this_period: 2
  },
  shortcut_debt: {
    markers_found: 0,
    no_trigger: 0
  },
  note: "Weekly retro snapshot for milestone: Ironbots Fleet Expansion (9 bots), Native SSE telemetry streaming on :8080, Storage Pruner atomic gzip compaction, and local small-model loopback bridge verified."
};

const validation = validateWeeklyRetroReport(retroData);
console.log('Contract Validation Result:', JSON.stringify(validation, null, 2));

if (!validation.ok) {
  console.error('Validation failed!', validation.errors);
  process.exit(1);
}

const outDir = path.resolve('c:/dev/.icf-retros/weekly');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const retroPath = path.join(outDir, 'retro-2026-09-26.json');
const latestPath = path.join(outDir, 'latest-weekly-retro.json');

fs.writeFileSync(retroPath, JSON.stringify(retroData, null, 2), 'utf8');
fs.writeFileSync(latestPath, JSON.stringify(retroData, null, 2), 'utf8');
console.log(`Saved retro to ${retroPath} and ${latestPath}`);
