/**
 * Template Skill
 *
 * This is a reference implementation template for Toolforge skills.
 * Customize this file with your skill's logic.
 *
 * @see skill.json for metadata
 * @see docs/USAGE.md for documentation
 * @see tests/skill.test.ts for tests
 */

export interface SkillInput {
  /**
   * Required input parameter.
   */
  input1: string;

  /**
   * Optional boolean flag for verbose logging.
   * @default false
   */
  verbose?: boolean;
}

export interface SkillOutput {
  /**
   * Status of the operation.
   */
  status: "success" | "error";

  /**
   * Human-readable message.
   */
  message: string;

  /**
   * Optional data payload for successful results.
   */
  data?: Record<string, any>;

  /**
   * Error code for failures.
   */
  code?: string;
}

/**
 * Main skill handler.
 *
 * This function is the entry point for the skill. It should:
 * 1. Validate inputs
 * 2. Perform the skill's work
 * 3. Return structured output
 * 4. Handle errors gracefully
 *
 * @param input - Skill input parameters
 * @returns Promise<SkillOutput> - Structured result
 */
export default async function handler(input: SkillInput): Promise<SkillOutput> {
  try {
    // Validate required inputs
    if (!input || typeof input.input1 !== "string" || !input.input1.trim()) {
      return {
        status: "error",
        message: "Input validation failed: input1 is required and must be non-empty",
        code: "INVALID_INPUT"
      };
    }

    // Optional: Log with verbose mode
    if (input.verbose) {
      console.log(`[SKILL] Processing input: ${input.input1}`);
    }

    // Perform work
    const result = await doWork(input.input1);

    // Return success
    return {
      status: "success",
      message: "Work completed successfully",
      data: result
    };
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message: `Skill execution failed: ${errorMessage}`,
      code: "SKILL_ERROR"
    };
  }
}

/**
 * Perform the skill's actual work.
 *
 * Replace this with your skill's implementation.
 *
 * @param input - The input string to process
 * @returns Promise<Record<string, any>> - Result data
 */
async function doWork(input: string): Promise<Record<string, any>> {
  // Simulate async work (replace with real implementation)
  return {
    processed: input,
    timestamp: new Date().toISOString(),
    length: input.length
  };
}

/**
 * Helper: Handle timeout.
 *
 * Called if skill exceeds the timeout configured in skill.json.
 * Cleanup resources here before timeout kills the process.
 */
export function handleTimeout(): void {
  console.error("[SKILL] Timeout handler triggered");
  // Cleanup: close connections, release resources, etc.
}

/**
 * Helper: Handle permission error.
 *
 * Called if skill lacks required permissions (from skill.json).
 * Use for graceful degradation or fallback behavior.
 */
export function handlePermissionDenied(permission: string): SkillOutput {
  return {
    status: "error",
    message: `Permission denied: ${permission}`,
    code: "PERMISSION_DENIED"
  };
}
