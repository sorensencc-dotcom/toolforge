import { test, describe, it } from "node:test";
import assert from "node:assert";

// Custom interfaces matching the v1.0 specification
export interface VikingReport {
  token_delta: {
    tokens_loaded: number;
    tokens_saved_vs_L2: number;
    percent_reduction: number;
  };
  cache_effect: "preserved" | "extended" | "invalidated" | "fragmented";
  mode_alignment: {
    mode_choice_correct: boolean;
    reasoning?: string;
  };
  context_pressure: {
    usage_pct: number;
    risk_level: "low" | "moderate" | "high" | "critical";
  };
  model_suitability: "optimal" | "acceptable" | "suboptimal" | "degraded";
  roundtrip_avoidance_score: number; // Integer between 0 and 3
}

// 1. Precise Implementation of the validateReport Contract
export function validateReport(report: any): asserts report is VikingReport {
  if (!report || typeof report !== "object") {
    throw new Error("Report must be a non-null object");
  }

  // A. Validate Token Delta & Savings
  if (!report.token_delta || typeof report.token_delta !== "object") {
    throw new Error("Missing token_delta object");
  }
  const { tokens_loaded, tokens_saved_vs_L2, percent_reduction } =
    report.token_delta;
  if (typeof tokens_loaded !== "number" || tokens_loaded < 0) {
    throw new Error("tokens_loaded must be a non-negative number");
  }
  if (typeof tokens_saved_vs_L2 !== "number" || tokens_saved_vs_L2 < 0) {
    throw new Error("tokens_saved_vs_L2 must be a non-negative number");
  }
  if (
    typeof percent_reduction !== "number" ||
    percent_reduction < 0 ||
    percent_reduction > 100
  ) {
    throw new Error("percent_reduction must be a number between 0 and 100");
  }

  // B. Validate Cache Effect
  const allowedCacheEffects = [
    "preserved",
    "extended",
    "invalidated",
    "fragmented",
  ];
  if (!allowedCacheEffects.includes(report.cache_effect)) {
    throw new Error(
      `Invalid cache_effect: ${report.cache_effect}. Must be one of ${allowedCacheEffects.join(", ")}`,
    );
  }

  // C. Validate Mode Alignment
  if (!report.mode_alignment || typeof report.mode_alignment !== "object") {
    throw new Error("Missing mode_alignment object");
  }
  if (typeof report.mode_alignment.mode_choice_correct !== "boolean") {
    throw new Error("mode_choice_correct must be a boolean");
  }

  // D. Validate Context Window Pressure
  if (!report.context_pressure || typeof report.context_pressure !== "object") {
    throw new Error("Missing context_pressure object");
  }
  const { usage_pct, risk_level } = report.context_pressure;
  if (typeof usage_pct !== "number" || usage_pct < 0 || usage_pct > 100) {
    throw new Error("usage_pct must be a percentage between 0 and 100");
  }
  const allowedRiskLevels = ["low", "moderate", "high", "critical"];
  if (!allowedRiskLevels.includes(risk_level)) {
    throw new Error(
      `Invalid risk_level: ${risk_level}. Must be one of ${allowedRiskLevels.join(", ")}`,
    );
  }

  // E. Validate Model-Tier Suitability
  const allowedSuitability = [
    "optimal",
    "acceptable",
    "suboptimal",
    "degraded",
  ];
  if (!allowedSuitability.includes(report.model_suitability)) {
    throw new Error(
      `Invalid model_suitability: ${report.model_suitability}. Must be one of ${allowedSuitability.join(", ")}`,
    );
  }

  // F. Validate Roundtrip Avoidance Score
  const rta = report.roundtrip_avoidance_score;
  if (typeof rta !== "number" || !Number.isInteger(rta) || rta < 0 || rta > 3) {
    throw new Error(
      "roundtrip_avoidance_score must be an integer between 0 and 3",
    );
  }
}

// 2. Mock MCP Server Endpoint Wrapper implementing the Fail-Closed Invariant
export const VIKING_REPORT_INVALID_CODE = -32005;

export interface McpSuccessResponse {
  jsonrpc: "2.0";
  id: number | string;
  result: {
    content: Array<{ type: "text"; text: string }>;
    report: VikingReport;
  };
}

export interface McpErrorResponse {
  jsonrpc: "2.0";
  id: number | string;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

export function handleMcpRead(
  id: number | string,
  rawContent: string,
  rawReport: any,
): McpSuccessResponse | McpErrorResponse {
  try {
    // Fail-closed execution: validation MUST complete before returning payload
    validateReport(rawReport);

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: rawContent }],
        report: rawReport,
      },
    };
  } catch (err: any) {
    // Intercept and return the exact spec-compliant error structure
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: VIKING_REPORT_INVALID_CODE,
        message: `VIKING_REPORT_INVALID: ${err.message}`,
        data: {
          original_error: err.message,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }
}

// 3. Complete Automated Test Suite
describe("Viking VFS Telemetry and Reporting Contract Validation", () => {
  const validReportFixture: VikingReport = {
    token_delta: {
      tokens_loaded: 288,
      tokens_saved_vs_L2: 271,
      percent_reduction: 48.5,
    },
    cache_effect: "extended",
    mode_alignment: {
      mode_choice_correct: true,
      reasoning: "Correctly chose L1 overview over L2 payload for design scan",
    },
    context_pressure: {
      usage_pct: 12.4,
      risk_level: "low",
    },
    model_suitability: "optimal",
    roundtrip_avoidance_score: 3,
  };

  it("should successfully pass validation with a structurally perfect telemetry report", () => {
    assert.doesNotThrow(() => {
      validateReport(validReportFixture);
    });
  });

  it("should fail validation if tokens_loaded is a negative number", () => {
    const malformed = {
      ...validReportFixture,
      token_delta: { ...validReportFixture.token_delta, tokens_loaded: -10 },
    };
    assert.throws(
      () => validateReport(malformed),
      /tokens_loaded must be a non-negative number/,
    );
  });

  it("should fail validation if percent_reduction is out of percentage boundaries", () => {
    const malformed = {
      ...validReportFixture,
      token_delta: {
        ...validReportFixture.token_delta,
        percent_reduction: 105.2,
      },
    };
    assert.throws(
      () => validateReport(malformed),
      /percent_reduction must be a number between 0 and 100/,
    );
  });

  it("should fail validation on an invalid cache_effect choice", () => {
    const malformed = {
      ...validReportFixture,
      cache_effect: "shattered" as any,
    };
    assert.throws(
      () => validateReport(malformed),
      /Invalid cache_effect: shattered/,
    );
  });

  it("should fail validation if context usage percentage is out of range", () => {
    const malformed = {
      ...validReportFixture,
      context_pressure: { usage_pct: 101, risk_level: "critical" as any },
    };
    assert.throws(
      () => validateReport(malformed),
      /usage_pct must be a percentage between 0 and 100/,
    );
  });

  it("should fail validation on invalid risk_level keys", () => {
    const malformed = {
      ...validReportFixture,
      context_pressure: { usage_pct: 55, risk_level: "extreme" as any },
    };
    assert.throws(
      () => validateReport(malformed),
      /Invalid risk_level: extreme/,
    );
  });

  it("should fail validation if roundtrip_avoidance_score is outside the 0-3 range", () => {
    const malformed = {
      ...validReportFixture,
      roundtrip_avoidance_score: 4,
    };
    assert.throws(
      () => validateReport(malformed),
      /roundtrip_avoidance_score must be an integer between 0 and 3/,
    );
  });

  it("should fail validation if roundtrip_avoidance_score is not a whole integer", () => {
    const malformed = {
      ...validReportFixture,
      roundtrip_avoidance_score: 2.5,
    };
    assert.throws(
      () => validateReport(malformed),
      /roundtrip_avoidance_score must be an integer/,
    );
  });

  it("should return a success MCP frame if validation succeeds", () => {
    const content = "# Workspace Overview\nActive database has 15 docs.";
    const response = handleMcpRead("req-001", content, validReportFixture);

    assert.ok("result" in response);
    assert.strictEqual(response.result.content[0].text, content);
    assert.deepStrictEqual(response.result.report, validReportFixture);
  });

  it("should intercept validation failures and abort with a fail-closed -32005 error code", () => {
    const content = "# Malformed Run";
    const malformedReport = {
      ...validReportFixture,
      model_suitability: "unsupported_model" as any,
    };

    const response = handleMcpRead("req-002", content, malformedReport);

    assert.ok("error" in response);
    assert.strictEqual(response.error.code, VIKING_REPORT_INVALID_CODE);
    assert.match(
      response.error.message,
      /VIKING_REPORT_INVALID: Invalid model_suitability: unsupported_model/,
    );
    assert.ok(response.error.data?.timestamp);
  });
});
