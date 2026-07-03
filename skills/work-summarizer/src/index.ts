import { readdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  ensureDir,
  normalizeWindowDates,
  formatDateISO,
  loadRegistry
} from "./utils.js";
import { getCategoryForPath, getAllCategories } from "./category-map.js";
import { getDiffStat, analyzeRepoActivity } from "./diff-engine.js";
import {
  scanTranscriptsForDrift,
  scoreDriftLikelihood,
  summarizeDriftSignals
} from "./drift-detector.js";
import {
  aggregateDailyReports,
  getAggregationStats,
  shouldFullRescan
} from "./weekly-aggregator.js";
import {
  buildRoutingArtifact,
  writeRoutingArtifact,
  SubsystemActivity
} from "./routing-artifact.js";
import { getCrossImpact } from "./dependency-graph.js";
import { extractTranscriptExcerpts } from "./transcript-excerpts.js";
import { AnthropicProvider, LLMSynthesis } from "./llm-provider.js";

export interface SkillInput {
  mode?: "daily" | "weekly";
  registryPath?: string;
  transcriptsRoot?: string;
  outputDir?: string;
  queueDir?: string;
  includeRoutingArtifact?: boolean;
  reasoningEnabled?: boolean;
  anthropicModel?: string;
  reasoningTimeoutMs?: number;
}

export interface SkillOutput {
  status: "ok" | "error";
  message: string;
  data?: any;
}

async function run(input: SkillInput): Promise<SkillOutput> {
  try {
    const mode = input.mode ?? "daily";
    const registryPath =
      input.registryPath ?? "C:\\dev\\repo-registry.json";
    const transcriptsRoot =
      input.transcriptsRoot ?? "C:\\Users\\soren\\.claude\\projects";
    const outputDir =
      input.outputDir ?? "C:\\dev\\CIP\\CIC\\logs\\work-summaries";
    const queueDir =
      input.queueDir ?? "C:\\dev\\CIC\\ingestion\\queue";
    const includeRoutingArtifact = input.includeRoutingArtifact ?? false;
    const reasoningEnabled = input.reasoningEnabled ?? false;
    const anthropicModel =
      input.anthropicModel ?? "claude-haiku-4-5-20251001";
    const reasoningTimeoutMs = input.reasoningTimeoutMs ?? 30000;

    ensureDir(outputDir);

    const registry = loadRegistry(registryPath);
    if (!registry.repos || registry.repos.length === 0) {
      return {
        status: "error",
        message: "Registry empty or missing",
        data: undefined
      };
    }

    const repoPaths = registry.repos.map(r => r.path);
    const { start, end } = normalizeWindowDates(mode);

    // Weekly: try aggregated daily reports first
    let allModifiedFiles: string[] = [];
    let shouldDoFullScan = true;
    let aggregatedCategoryData: Record<string, number> | null = null;

    if (mode === "weekly") {
      const agg = aggregateDailyReports(outputDir, "weekly");
      if (!shouldFullRescan(agg)) {
        shouldDoFullScan = false;
        aggregatedCategoryData = agg.aggregated_categories;
        allModifiedFiles = []; // Not using file list from aggregation, just category counts
      }
    }

    // Full scan if daily or aggregation insufficient; build repo_deltas inline
    const diffResultCache: Record<string, any[]> = {};
    const repo_deltas: any[] = [];
    const scannedRepos = new Set<string>();

    if (shouldDoFullScan) {
      for (const repoPath of repoPaths) {
        if (!existsSync(repoPath)) continue;
        scannedRepos.add(repoPath);
        try {
          const diffEntries = getDiffStat(repoPath);
          diffResultCache[repoPath] = diffEntries;
          for (const entry of diffEntries) {
            allModifiedFiles.push(entry.file);
          }

          // Build repo delta inline with cached diff results
          const activity = analyzeRepoActivity(repoPath);
          const activeSubsystems = new Set<string>();
          for (const entry of diffEntries) {
            const category = getCategoryForPath(entry.file);
            activeSubsystems.add(category);
          }

          repo_deltas.push({
            repo_name: repoPath.split("\\").pop() || repoPath,
            files_changed: activity.filesChanged,
            lines_added: activity.linesAdded,
            lines_deleted: activity.linesDeleted,
            active_subsystems: Array.from(activeSubsystems)
          });
        } catch {
          // Skip repos we can't diff
        }
      }
    } else {
      // Aggregated path: still populate repo_deltas with basic metadata, but empty active_subsystems
      for (const repoPath of repoPaths) {
        if (!existsSync(repoPath)) {
          scannedRepos.add(repoPath);
          continue;
        }
        scannedRepos.add(repoPath);
        try {
          const activity = analyzeRepoActivity(repoPath);
          repo_deltas.push({
            repo_name: repoPath.split("\\").pop() || repoPath,
            files_changed: activity.filesChanged,
            lines_added: activity.linesAdded,
            lines_deleted: activity.linesDeleted,
            active_subsystems: [] // Empty on aggregated path since diffResultCache not populated
          });
        } catch {
          // Skip repos we can't diff
        }
      }
    }

    // Classify files by category
    const workByCategory: Record<string, number> = {};
    for (const category of getAllCategories()) {
      workByCategory[category] = 0;
    }

    if (aggregatedCategoryData) {
      // Use aggregated data from previous daily reports
      Object.assign(workByCategory, aggregatedCategoryData);
    } else {
      // Classify files from current scan
      for (const file of allModifiedFiles) {
        const category = getCategoryForPath(file);
        workByCategory[category] = (workByCategory[category] ?? 0) + 1;
      }
    }

    // Scan transcripts for drift
    const driftSignal = scanTranscriptsForDrift(transcriptsRoot);
    const driftScore = scoreDriftLikelihood(driftSignal);

    // Compute active categories (count > 0)
    const activeCategories = Object.entries(workByCategory)
      .filter(([, count]) => count > 0)
      .map(([cat]) => cat);

    // Compute cross-repo impacts
    const crossImpacts = getCrossImpact(activeCategories);

    // Extract transcript excerpts
    const transcriptExcerpts = extractTranscriptExcerpts(
      transcriptsRoot,
      allModifiedFiles,
      activeCategories
    );

    // Initialize synthesis result
    let synthesis: LLMSynthesis | null = null;
    let synthesisError: string | null = null;

    // Call LLM reasoning if enabled and API key available
    if (reasoningEnabled && process.env.ANTHROPIC_API_KEY) {
      try {
        const provider = new AnthropicProvider(
          process.env.ANTHROPIC_API_KEY,
          anthropicModel,
          reasoningTimeoutMs
        );

        synthesis = await provider.synthesize({
          period: mode,
          activeCategories,
          workByCategory,
          allModifiedFiles,
          repo_deltas,
          driftSignal,
          crossImpacts,
          transcriptExcerpts
        });
      } catch (error: any) {
        synthesisError = error?.message || "Unknown LLM error";
      }
    }

    // Detect risks (empty categories)
    const risks: string[] = [];
    for (const [category, count] of Object.entries(workByCategory)) {
      if (count === 0) {
        risks.push(`No activity in ${category}`);
      }
    }
    if (synthesisError) {
      risks.push(`LLM reasoning synthesis skipped: ${synthesisError}`);
    }

    // Build report
    const report: any = {
      schema_version: "4.0.0",
      period: mode,
      window_start: start.toISOString(),
      window_end: end.toISOString(),
      generated_at: new Date().toISOString(),
      repos_scanned: scannedRepos.size,
      repos_skipped_missing: repoPaths.filter(p => !scannedRepos.has(p)),
      modified_files: allModifiedFiles.length,
      transcript_sessions_scanned: driftSignal.sessions_scanned ?? 0,
      transcript_files_touched: driftSignal.files.length,
      work_by_category: workByCategory,
      drift_signals: {
        type: driftSignal.type,
        count: driftSignal.count,
        score: driftScore,
        summary: summarizeDriftSignals(driftSignal)
      },
      repo_deltas,
      subsystem_impacts: synthesis?.subsystem_impacts ?? [],
      cross_repo_impacts: synthesis?.cross_repo_impacts ?? [],
      transcript_excerpts: transcriptExcerpts.map((exc, idx) => ({
        ...exc,
        reasoning_summary:
          synthesis?.transcript_reasoning?.[`[${idx}]`] ?? undefined
      })),
      notable_changes:
        synthesis?.notable_changes ??
        allModifiedFiles.slice(0, 5).map(f => ({
          title: f.split("\\").pop() || f,
          description: "File modified",
          risk_level: "low" as const
        })),
      risks_or_followups:
        synthesis?.risks_or_followups ??
        risks.map(r => ({
          area: "General",
          risk_summary: r,
          recommended_next_steps: []
        })),
      message:
        synthesis?.message ??
        (allModifiedFiles.length === 0
          ? "No changes detected"
          : `Scanned ${repoPaths.length} repos, found ${allModifiedFiles.length} modified files`)
    };

    // Write JSON report
    const reportFilename = `work-summary-${mode}-${formatDateISO(end)}.json`;
    const reportPath = join(outputDir, reportFilename);
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    // Write TXT summary
    const txtContent = `
Work Summary Report
Mode: ${mode.toUpperCase()}
Period: ${formatDateISO(start)} to ${formatDateISO(end)}
Generated: ${new Date().toISOString()}

Repositories Scanned: ${repoPaths.length}
Modified Files: ${allModifiedFiles.length}
Drift Signals: ${driftSignal.count}

Activity by Category:
${Object.entries(workByCategory)
  .filter(([, count]) => count > 0)
  .map(([cat, count]) => `  ${cat}: ${count}`)
  .join("\n")}

Notable Changes:
${allModifiedFiles.slice(0, 10).map(f => `  - ${f}`).join("\n")}

${
  risks.length > 0
    ? `Risks/Followups:\n${risks.map(r => `  - ${r}`).join("\n")}`
    : "No risks detected."
}
    `.trim();

    const txtPath = join(outputDir, reportFilename.replace(".json", ".txt"));
    writeFileSync(txtPath, txtContent, "utf-8");

    // Write routing artifact if requested
    if (includeRoutingArtifact) {
      const subsystemActivity: SubsystemActivity[] = [];
      for (const [category, count] of Object.entries(workByCategory)) {
        if (count > 0) {
          subsystemActivity.push({
            subsystem: category,
            category,
            file_count: count,
            activity_type: ["modification"],
            complexity: count > 10 ? "major" : count > 5 ? "moderate" : "minor",
            drift_detected: driftSignal.count > 0
          });
        }
      }

      const artifact = buildRoutingArtifact(
        mode,
        subsystemActivity,
        driftSignal,
        []
      );

      writeRoutingArtifact(artifact, queueDir);
    }

    return {
      status: "ok",
      message: report.message,
      data: report
    };
  } catch (error: any) {
    return {
      status: "error",
      message: error?.message || "Unknown error",
      data: undefined
    };
  }
}

export default run;
