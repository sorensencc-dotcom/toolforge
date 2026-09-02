import * as fs from "fs";
import * as path from "path";

export interface ManifestSkill {
  id: string;
  name: string;
  timestamps?: {
    created?: string | null;
    lastValidation?: string | null;
    lastRun?: string | null;
  };
}

export interface HealthMonitorParams {
  manifestPath?: string;
  skillsDir?: string;
  staleDays?: number;
  cwd?: string;
}

export interface HealthReport {
  reportDate: string;
  totalSkills: number;
  neverRun: string[];
  stale: string[];
  orphanedManifestEntries: string[];
  unregisteredDirs: string[];
  healthScore: number;
  recommendations: string[];
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function runSkillHealthMonitor(params: HealthMonitorParams = {}): HealthReport {
  const cwd = params.cwd || process.cwd();
  const staleDays = params.staleDays ?? 30;
  const manifestPath = path.resolve(cwd, params.manifestPath || "toolforge/manifest.json");
  const skillsDir = path.resolve(cwd, params.skillsDir || "toolforge/skills");

  if (!fs.existsSync(manifestPath)) {
    throw Object.assign(new Error(`manifest not found: ${manifestPath}`), {
      code: "MANIFEST_NOT_FOUND",
    });
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    skills: ManifestSkill[];
  };
  const skills = manifest.skills || [];

  const dirEntries = fs.existsSync(skillsDir)
    ? fs
        .readdirSync(skillsDir)
        .filter((f) => fs.statSync(path.join(skillsDir, f)).isDirectory())
        .filter((f) => !f.startsWith("_"))
    : [];
  const dirSet = new Set(dirEntries);
  const manifestIds = new Set(skills.map((s) => s.id));

  const neverRun: string[] = [];
  const stale: string[] = [];

  for (const skill of skills) {
    const ts = skill.timestamps;
    if (!ts || !ts.lastRun) {
      neverRun.push(skill.id);
    }
    const lastValidation = ts?.lastValidation;
    if (!lastValidation || daysSince(lastValidation) > staleDays) {
      stale.push(skill.id);
    }
  }

  const orphanedManifestEntries = skills
    .map((s) => s.id)
    .filter((id) => !dirSet.has(id));

  const unregisteredDirs = dirEntries.filter((d) => !manifestIds.has(d));

  let score = 100;
  score -= Math.min(orphanedManifestEntries.length * 15, 60);
  score -= Math.min(unregisteredDirs.length * 10, 40);
  score -= Math.min(stale.length * 2, 20);
  score -= Math.min(neverRun.length * 1, 10);
  score = Math.max(0, Math.round(score));

  const recommendations: string[] = [];
  if (orphanedManifestEntries.length > 0) {
    recommendations.push(
      `${orphanedManifestEntries.length} manifest entr${orphanedManifestEntries.length === 1 ? "y points" : "ies point"} at a missing directory: ${orphanedManifestEntries.join(", ")}`
    );
  }
  if (unregisteredDirs.length > 0) {
    recommendations.push(
      `${unregisteredDirs.length} skill dir${unregisteredDirs.length === 1 ? "" : "s"} not in manifest.json: ${unregisteredDirs.join(", ")}`
    );
  }
  if (stale.length > 0) {
    recommendations.push(`${stale.length} skill(s) unvalidated for >${staleDays} days`);
  }
  if (neverRun.length > 0) {
    recommendations.push(`${neverRun.length} skill(s) have never recorded a run`);
  }
  if (recommendations.length === 0) {
    recommendations.push("Ecosystem nominal — manifest and directory listing agree, all skills recently validated");
  }

  return {
    reportDate: new Date().toISOString(),
    totalSkills: skills.length,
    neverRun,
    stale,
    orphanedManifestEntries,
    unregisteredDirs,
    healthScore: score,
    recommendations,
  };
}

if (require.main === module) {
  try {
    const report = runSkillHealthMonitor();
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.healthScore < 60 ? 1 : 0);
  } catch (e) {
    console.error("skill-health-monitor failed:", (e as Error).message);
    process.exit(1);
  }
}

export default runSkillHealthMonitor;
