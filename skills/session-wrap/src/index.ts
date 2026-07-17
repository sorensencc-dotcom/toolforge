import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process"; // noqa: SEC-AUDITOR: execFileSync with a fixed command ("git") and array args, no shell interpolation -- not the string-concat injection pattern this rule targets (Tier 1 approved)

const PREFIX_RE = /^\[(claude|copilot|gemini|human)\]/;

export interface DocUpdate {
  path: string;
  content: string;
}

export interface SessionWrapParams {
  commitMessage: string;
  summary?: string;
  docUpdates?: DocUpdate[];
  stageFiles?: string[];
  stageAll?: boolean;
  dryRun?: boolean;
  cwd?: string;
}

export interface DocUpdateResult {
  path: string;
  status: "written" | "would-write" | "error";
  error?: string;
}

export interface SessionWrapReport {
  summary: string;
  checklistItems: string[];
  nextSteps: string[];
}

export interface SessionWrapResult {
  success: boolean;
  commitHash: string | null;
  docUpdates: DocUpdateResult[];
  stagedFiles: string[];
  skippedCommit: boolean;
  report: SessionWrapReport;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function writeDocUpdates(
  docUpdates: DocUpdate[],
  cwd: string,
  dryRun: boolean
): DocUpdateResult[] {
  return docUpdates.map((update) => {
    const absPath = path.resolve(cwd, update.path);
    try {
      if (!dryRun) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, update.content, "utf-8");
      }
      return { path: update.path, status: dryRun ? "would-write" : "written" } as DocUpdateResult;
    } catch (e) {
      return { path: update.path, status: "error", error: (e as Error).message } as DocUpdateResult;
    }
  });
}

function resolveStageSet(
  cwd: string,
  docUpdates: DocUpdate[],
  stageFiles: string[],
  stageAll: boolean
): string[] {
  if (stageAll) {
    return ["-A"];
  }
  const explicit = new Set<string>([
    ...docUpdates.map((d) => d.path),
    ...stageFiles,
  ]);
  return Array.from(explicit);
}

export async function sessionWrap(params: SessionWrapParams): Promise<SessionWrapResult> {
  const cwd = params.cwd || process.cwd();
  const dryRun = params.dryRun ?? false;
  const stageAll = params.stageAll ?? false;
  const docUpdates = params.docUpdates ?? [];
  const stageFiles = params.stageFiles ?? [];

  if (!PREFIX_RE.test(params.commitMessage)) {
    throw Object.assign(
      new Error(
        `commitMessage must start with [claude]|[copilot]|[gemini]|[human], got: "${params.commitMessage}"`
      ),
      { code: "BAD_COMMIT_PREFIX" }
    );
  }

  const docResults = writeDocUpdates(docUpdates, cwd, dryRun);
  const failedDocs = docResults.filter((r) => r.status === "error");

  const stagePaths = resolveStageSet(cwd, docUpdates, stageFiles, stageAll);

  let stagedFiles: string[] = [];
  let commitHash: string | null = null;
  let skippedCommit = false;

  if (!dryRun && failedDocs.length === 0) {
    if (stagePaths.length > 0) {
      git(cwd, ["add", ...stagePaths]);
    }
    stagedFiles = git(cwd, ["diff", "--cached", "--name-only"])
      .split("\n")
      .filter(Boolean);

    if (stagedFiles.length === 0) {
      skippedCommit = true;
    } else {
      git(cwd, ["commit", "-m", params.commitMessage]);
      commitHash = git(cwd, ["rev-parse", "HEAD"]);
    }
  } else if (dryRun) {
    stagedFiles = stageAll ? ["<all modified files>"] : Array.from(
      new Set([...docUpdates.map((d) => d.path), ...stageFiles])
    );
  }

  const success = failedDocs.length === 0;

  const report: SessionWrapReport = {
    summary: params.summary || "",
    checklistItems: [
      docUpdates.length > 0
        ? `Doc updates: ${docResults.filter((r) => r.status !== "error").length}/${docUpdates.length} written`
        : "Doc updates: none",
      skippedCommit ? "Commit: skipped (nothing staged)" : commitHash ? `Commit: ${commitHash.slice(0, 8)}` : "Commit: dry-run",
    ],
    nextSteps: skippedCommit
      ? ["No changes were staged — confirm this session had no file output before wrapping."]
      : [],
  };

  return {
    success,
    commitHash,
    docUpdates: docResults,
    stagedFiles,
    skippedCommit,
    report,
  };
}

export default sessionWrap;
