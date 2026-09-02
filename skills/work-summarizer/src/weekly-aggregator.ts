import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { formatDateISO, getLastNDays } from "./utils.js";

export interface DailyReport {
  period: "daily";
  window_start: string;
  window_end: string;
  repos_scanned: number;
  modified_files: number;
  work_by_category: Record<string, number>;
  schema_version?: string;
}

export interface WeeklyAggregation {
  days_available: number;
  days_missing: string[];
  total_repos_scanned: number;
  total_files_modified: number;
  aggregated_categories: Record<string, number>;
  daily_reports_merged: number;
}

export function loadDailyReport(
  reportPath: string
): DailyReport | null {
  try {
    if (!existsSync(reportPath)) return null;
    const content = readFileSync(reportPath, "utf-8");
    const data = JSON.parse(content);

    // Validate schema_version is >= 3.0.0 for proper v3 format
    if (data.schema_version) {
      const version = data.schema_version;
      const major = parseInt(version.split(".")[0], 10);
      if (major < 3) {
        return null; // Old schema, force full rescan
      }
    }

    return data as DailyReport;
  } catch {
    return null;
  }
}

export function aggregateDailyReports(
  logsDir: string,
  mode: "weekly" | "daily" = "weekly"
): WeeklyAggregation {
  const result: WeeklyAggregation = {
    days_available: 0,
    days_missing: [],
    total_repos_scanned: 0,
    total_files_modified: 0,
    aggregated_categories: {},
    daily_reports_merged: 0
  };

  const daysToCheck = mode === "weekly" ? 7 : 1;
  const lastNDays = getLastNDays(daysToCheck);

  for (const date of lastNDays) {
    const dateStr = formatDateISO(date);
    const reportPath = join(logsDir, `work-summary-daily-${dateStr}.json`);

    const daily = loadDailyReport(reportPath);
    if (daily) {
      result.days_available++;
      result.daily_reports_merged++;
      result.total_repos_scanned += daily.repos_scanned;
      result.total_files_modified += daily.modified_files;

      // Merge category counts
      for (const [category, count] of Object.entries(
        daily.work_by_category
      )) {
        result.aggregated_categories[category] =
          (result.aggregated_categories[category] ?? 0) + count;
      }
    } else {
      result.days_missing.push(dateStr);
    }
  }

  return result;
}

export function getAggregationStats(agg: WeeklyAggregation): {
  coverage: number;
  coverage_pct: string;
  avg_files_per_day: number;
  most_active_category: string | null;
  activity_level: string;
} {
  const daysExpected = agg.days_available + agg.days_missing.length;
  const coverage = agg.days_available / daysExpected;
  const coverage_pct = `${Math.round(coverage * 100)}%`;

  const avgFilesPerDay =
    agg.days_available > 0
      ? Math.round(agg.total_files_modified / agg.days_available)
      : 0;

  let mostActiveCategory: string | null = null;
  let maxCount = 0;
  for (const [category, count] of Object.entries(
    agg.aggregated_categories
  )) {
    if (count > maxCount) {
      maxCount = count;
      mostActiveCategory = category;
    }
  }

  let activityLevel = "low";
  if (agg.total_files_modified > 50) activityLevel = "high";
  else if (agg.total_files_modified > 20) activityLevel = "medium";

  return {
    coverage,
    coverage_pct,
    avg_files_per_day: avgFilesPerDay,
    most_active_category: mostActiveCategory,
    activity_level: activityLevel
  };
}

export function shouldFullRescan(
  agg: WeeklyAggregation,
  minCoverage: number = 0.5
): boolean {
  // Rescan if we're missing more than half the days
  const daysExpected =
    agg.days_available + agg.days_missing.length;
  const coverage = agg.days_available / daysExpected;
  return coverage < minCoverage;
}
