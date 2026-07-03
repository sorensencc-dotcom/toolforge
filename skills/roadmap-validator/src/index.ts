/**
 * Roadmap Validator Skill
 *
 * Validates Toolforge ROADMAP.md files for:
 * - Presence of SYNC markers (<!-- SYNC:TOOLFORGE --> / <!-- END:SYNC -->)
 * - Valid markdown structure
 * - Content integrity
 * - File accessibility
 *
 * @see skill.json for metadata
 * @see docs/USAGE.md for documentation
 * @see tests/skill.test.ts for tests
 */

import * as fs from "fs";
import * as path from "path";

export interface RoadmapValidatorInput {
  /**
   * File path to ROADMAP.md to validate.
   */
  roadmapPath: string;

  /**
   * Enable detailed validation reporting.
   * @default false
   */
  verbose?: boolean;

  /**
   * Enforce strict validation (fail on warnings).
   * @default false
   */
  strict?: boolean;
}

export interface ValidationFinding {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  line?: number;
}

export interface RoadmapValidatorOutput {
  /**
   * Status of the validation.
   */
  status: "success" | "error";

  /**
   * Human-readable message.
   */
  message: string;

  /**
   * Validation result data.
   */
  data?: {
    isValid: boolean;
    findings: ValidationFinding[];
    syncMarkersPresent: boolean;
    contentLength: number;
    validated: string;
  };

  /**
   * Error code for failures.
   */
  code?: string;
}

/**
 * Main skill handler.
 *
 * Validates a ROADMAP.md file for Toolforge sync compliance.
 *
 * @param input - Validator input parameters
 * @returns Promise<RoadmapValidatorOutput> - Structured validation result
 */
export default async function handler(
  input: RoadmapValidatorInput
): Promise<RoadmapValidatorOutput> {
  try {
    // Validate required inputs
    if (
      !input ||
      typeof input.roadmapPath !== "string" ||
      !input.roadmapPath.trim()
    ) {
      return {
        status: "error",
        message: "Input validation failed: roadmapPath is required",
        code: "INVALID_INPUT",
      };
    }

    const roadmapPath = input.roadmapPath.trim();

    // Log if verbose
    if (input.verbose) {
      console.log(`[VALIDATOR] Validating: ${roadmapPath}`);
    }

    // Perform validation
    const result = await validateRoadmap(roadmapPath, input.verbose || false);

    // Check if strict mode enabled and warnings/errors present
    if (
      input.strict &&
      result.findings.some((f) => f.level === "error" || f.level === "warning")
    ) {
      return {
        status: "error",
        message: `Roadmap validation failed (strict mode): ${result.findings.length} issues found`,
        code: "VALIDATION_FAILED",
      };
    }

    // Return success with findings
    return {
      status: "success",
      message: `Roadmap validation complete: ${result.findings.length} findings`,
      data: result,
    };
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message: `Validation execution failed: ${errorMessage}`,
      code: "SKILL_ERROR",
    };
  }
}

/**
 * Perform the roadmap validation.
 *
 * Checks for:
 * - File existence and readability
 * - SYNC markers
 * - Markdown structure
 * - Content integrity
 *
 * @param roadmapPath - Path to ROADMAP.md
 * @param verbose - Enable detailed logging
 * @returns Promise<ValidationResult> - Validation findings
 */
async function validateRoadmap(
  roadmapPath: string,
  verbose: boolean
): Promise<{
  isValid: boolean;
  findings: ValidationFinding[];
  syncMarkersPresent: boolean;
  contentLength: number;
  validated: string;
}> {
  const findings: ValidationFinding[] = [];
  let content = "";
  let syncMarkersPresent = false;
  let contentLength = 0;

  // Check file exists
  if (!fs.existsSync(roadmapPath)) {
    findings.push({
      level: "error",
      code: "FILE_NOT_FOUND",
      message: `File does not exist: ${roadmapPath}`,
    });
    return {
      isValid: false,
      findings,
      syncMarkersPresent: false,
      contentLength: 0,
      validated: new Date().toISOString(),
    };
  }

  // Try to read file
  try {
    content = fs.readFileSync(roadmapPath, "utf-8");
    contentLength = content.length;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    findings.push({
      level: "error",
      code: "FILE_READ_ERROR",
      message: `Cannot read file: ${msg}`,
    });
    return {
      isValid: false,
      findings,
      syncMarkersPresent: false,
      contentLength: 0,
      validated: new Date().toISOString(),
    };
  }

  // Check for SYNC markers
  const openMarkerRegex = /<!-- SYNC:TOOLFORGE -->/;
  const closeMarkerRegex = /<!-- END:SYNC -->/;

  const hasOpenMarker = openMarkerRegex.test(content);
  const hasCloseMarker = closeMarkerRegex.test(content);

  syncMarkersPresent = hasOpenMarker && hasCloseMarker;

  if (!hasOpenMarker) {
    findings.push({
      level: "warning",
      code: "MISSING_OPEN_MARKER",
      message: "Missing opening sync marker: <!-- SYNC:TOOLFORGE -->",
    });
  }

  if (!hasCloseMarker) {
    findings.push({
      level: "warning",
      code: "MISSING_CLOSE_MARKER",
      message: "Missing closing sync marker: <!-- END:SYNC -->",
    });
  }

  // Check marker ordering (if both present)
  if (hasOpenMarker && hasCloseMarker) {
    const openIndex = content.indexOf("<!-- SYNC:TOOLFORGE -->");
    const closeIndex = content.indexOf("<!-- END:SYNC -->");
    if (closeIndex <= openIndex) {
      findings.push({
        level: "error",
        code: "MARKER_ORDER",
        message: "Closing marker appears before opening marker",
      });
    }
  }

  // Check if content between markers is non-empty
  if (hasOpenMarker && hasCloseMarker) {
    const openIndex = content.indexOf("<!-- SYNC:TOOLFORGE -->");
    const closeIndex = content.indexOf("<!-- END:SYNC -->");
    const betweenContent = content.substring(
      openIndex + "<!-- SYNC:TOOLFORGE -->".length,
      closeIndex
    );

    if (!betweenContent.trim()) {
      findings.push({
        level: "error",
        code: "EMPTY_SYNC_BLOCK",
        message: "Content between sync markers is empty",
      });
    }
  }

  // Check markdown structure
  if (!content.includes("#")) {
    findings.push({
      level: "warning",
      code: "NO_HEADERS",
      message: "No markdown headers found (# or ##)",
    });
  }

  // Check file size (warn if very large)
  if (contentLength > 100 * 1024) {
    findings.push({
      level: "warning",
      code: "LARGE_FILE",
      message: `File is quite large (${(contentLength / 1024).toFixed(1)} KB)`,
    });
  }

  if (verbose) {
    console.log(`[VALIDATOR] Validation complete: ${findings.length} findings`);
  }

  const isValid = !findings.some((f) => f.level === "error");

  return {
    isValid,
    findings,
    syncMarkersPresent,
    contentLength,
    validated: new Date().toISOString(),
  };
}

/**
 * Helper: Handle timeout.
 *
 * Called if skill exceeds the timeout configured in skill.json.
 */
export function handleTimeout(): void {
  console.error("[VALIDATOR] Timeout handler triggered");
}

/**
 * Helper: Handle permission error.
 *
 * Called if skill lacks required permissions.
 */
export function handlePermissionDenied(
  permission: string
): RoadmapValidatorOutput {
  return {
    status: "error",
    message: `Permission denied: ${permission}`,
    code: "PERMISSION_DENIED",
  };
}
