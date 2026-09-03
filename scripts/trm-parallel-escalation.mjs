#!/usr/bin/env node

/**
 * TRM Tier-2 Diagnostic Engine: Parallel Escalation
 * Executed when Tier-1 fails or returns low confidence. Dispatches deep research
 * via the Parallel CLI or API, utilizing "Basis" grounded citation tracking.
 *
 * Usage: node trm-parallel-escalation.mjs "<raw_error_or_stack_trace>"
 */

import { execFileSync } from "node:child_process";

export async function dispatchParallelEscalation(stackTrace) {
  console.log("[Tier-2] Escalating to Parallel for deep agentic research with Basis grounding...");

  const prompt = `DevOps investigation for CI failure:
${stackTrace}

Formulate a concrete remediation patch and citation basis.`;

  // First check if parallel-cli is installed and authenticated
  try {
    const output = execFileSync("parallel-cli", ["task", "create", prompt, "--json"], {
      encoding: "utf8",
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const parsed = JSON.parse(output);
    return {
      status: "RESOLVED",
      engine: "Parallel CLI Agentic Loop",
      confidence: 0.95,
      basis_citations: parsed.citations || [],
      remediation: {
        action: "COMPLEX_REMEDIATION_PATCH",
        description: parsed.summary || "Parallel deep research identified remediation path.",
        detailedAnalysis: parsed.report || "",
        yamlPatch: parsed.patch || null
      }
    };
  } catch (cliErr) {
    // If CLI isn't installed or fails, try API if PARALLEL_API_KEY is present
    const apiKey = process.env.PARALLEL_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://api.parallel.ai/v1/tasks", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            objective: prompt,
            max_duration_seconds: 120,
            temperature: 0.1
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return {
          status: "RESOLVED",
          engine: "Parallel REST API",
          confidence: 0.95,
          basis_citations: data.citations || [],
          remediation: {
            action: "COMPLEX_REMEDIATION_PATCH",
            description: data.summary || "Parallel deep research identified remediation path.",
            detailedAnalysis: data.report || "",
            yamlPatch: data.extracted_patch || null
          }
        };
      } catch (apiErr) {
        return {
          status: "FAILED",
          engine: "Parallel API",
          confidence: 0.0,
          error: apiErr.message
        };
      }
    }

    return {
      status: "FAILED",
      engine: "Parallel",
      confidence: 0.0,
      error: `Parallel CLI execution failed: ${cliErr.message}`
    };
  }
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith("trm-parallel-escalation.mjs")) {
  const inputLog = process.argv[2] || "";
  if (!inputLog) {
    console.error("Usage: node trm-parallel-escalation.mjs \"<log_string>\"");
    process.exit(1);
  }
  dispatchParallelEscalation(inputLog).then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
}
