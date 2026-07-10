function validateRoadmapInputs(roadmap: any, progress: any): void {
  if (!roadmap || typeof roadmap !== "object") {
    throw new Error("roadmap is required and must be an object");
  }
  if (!progress || typeof progress !== "object") {
    throw new Error("progress is required and must be an object");
  }
}

export interface Roadmap {
  version: string;
  phases: any[];
}

export interface Progress {
  completedPhases?: any[];
  newItems?: any[];
}

export interface UpdateRoadmapParams {
  roadmap: Roadmap;
  progress: Progress;
}

export interface NewEntry {
  id: string;
  name: string;
  status: "pending";
  effort: string;
}

export interface UpdateRoadmapResult {
  currentVersion: string;
  suggestedVersion: string;
  percentComplete: number;
  completedPhases: number;
  totalPhases: number;
  newEntries: NewEntry[];
  recommendation: "major_bump" | "patch_bump";
}

export function updateRoadmap({ roadmap, progress }: UpdateRoadmapParams): UpdateRoadmapResult {
  validateRoadmapInputs(roadmap, progress);

  const currentVersion = roadmap.version || "1.0.0";
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  const completedPhases = (progress.completedPhases || []).length;
  const totalPhases = (roadmap.phases || []).length;
  const percentComplete = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  let newVersion = currentVersion;
  if (percentComplete >= 100) {
    newVersion = `${major + 1}.0.0`;
  } else if (percentComplete >= 50) {
    newVersion = `${major}.${minor + 1}.0`;
  } else if (percentComplete > 0) {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  const newEntries: NewEntry[] = (progress.newItems || []).map((item: any, idx: number) => ({
    id: `phase-${major}-${minor + 1}`,
    name: item.name || `New Phase ${idx + 1}`,
    status: "pending" as const,
    effort: item.effort || "unknown"
  }));

  return {
    currentVersion,
    suggestedVersion: newVersion,
    percentComplete: Math.round(percentComplete),
    completedPhases,
    totalPhases,
    newEntries,
    recommendation: percentComplete >= 100 ? "major_bump" : "patch_bump"
  };
}
