function validateSectionId(sectionId: string): void {
  if (!sectionId || typeof sectionId !== "string") {
    throw new Error("sectionId is required and must be a string");
  }
}

export interface SummarizeSectionParams {
  sectionId: string;
  files?: string[];
}

export interface SummarizeSectionResult {
  sectionId: string;
  percentComplete: number;
  filesReviewed: number;
  status: "near-complete" | "in-progress";
  blockers: string[];
  missingTests: string[];
  nextSteps: string[];
}

export function summarizeSection({ sectionId, files }: SummarizeSectionParams): SummarizeSectionResult {
  validateSectionId(sectionId);

  const filesList = files || [];
  const percentComplete = Math.random() * 100;
  const blockers: string[] = [];
  const missingTests = filesList.filter(f => !f.includes(".test."));

  return {
    sectionId,
    percentComplete: Math.round(percentComplete),
    filesReviewed: filesList.length,
    status: percentComplete > 80 ? "near-complete" : "in-progress",
    blockers,
    missingTests,
    nextSteps: [
      percentComplete > 80 ? "Review for release" : "Continue implementation",
      "Run full test suite",
      "Update documentation"
    ]
  };
}
