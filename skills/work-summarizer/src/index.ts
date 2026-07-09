/**
 * work-summarizer
 * Daily/weekly work summaries with pluggable reasoning
 */

export async function main(input: {
  mode?: "daily" | "weekly";
  registryPath?: string;
  transcriptsRoot?: string;
  outputDir?: string;
  reasoningEnabled?: boolean;
}): Promise<{ 
  status: string; 
  period?: string;
  repos_scanned?: number;
}> {
  console.log(`Generating ${input.mode || "daily"} work summary`);

  return {
    status: "stub",
    period: input.mode || "daily",
    repos_scanned: 0,
  };
}

export default main;
