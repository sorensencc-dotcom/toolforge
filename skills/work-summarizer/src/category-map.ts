// Canonical 17-category taxonomy for work classification
// Shared across Work-Summarizer, CIC Dashboard, Drift Engine, MAAL routing

export const CATEGORY_MAP = {
  "CIC Ingestion": {
    keywords: ["ingestion", "adapters", "webhooks", "routes"],
    paths: [
      "../../../cic-ingestion/src/ingestion",
      "../../../cic-ingestion/src/adapters",
      "../../../cic-ingestion/src/webhooks",
      "../../../cic-ingestion/src/routes"
    ]
  },
  "CIC Drift Engine": {
    keywords: ["drift", "driftScore", "semanticVariance", "lengthDelta"],
    paths: ["../../../cic-ingestion/src/drift"]
  },
  "CIC Extractors": {
    keywords: ["extractor", "detector", "extraction"],
    paths: ["../../../cic-ingestion/src/extractors", "../../../cic-ingestion/src/detectors"]
  },
  "CIC Harvester": {
    keywords: ["harvester", "harvest"],
    paths: [
      "../../../cic-ingestion/src/harvester"
    ]
  },
  "CIC Orchestrator": {
    keywords: ["orchestrator", "orchestrate"],
    paths: [
      "../../../cic-ingestion/src/orchestrator"
    ]
  },
  "Governance": {
    keywords: ["governance", "audit", "policy"],
    paths: ["cic/src/governance", "cic/toolforge", "cic/torquequery"]
  },
  "Governance SLO": {
    keywords: ["slo", "latency", "threshold"],
    paths: ["cic/src/governance/slo"]
  },
  "Governance Rollback": {
    keywords: ["rollback", "canary", "promotion"],
    paths: ["cic/src/governance/rollback"]
  },
  "Rewrite Labs": {
    keywords: ["rewrite", "rl-"],
    paths: []
  },
  "Offline Runtime Integration": {
    keywords: ["runtime", "executor", "sandbox"],
    paths: ["cic-runtime/src"]
  },
  "Documentation": {
    keywords: ["doc", "readme", "guide"],
    paths: [],
    extensions: [".md", ".txt"]
  },
  "Roadmap": {
    keywords: ["roadmap", "milestone", "planning"],
    paths: ["docs/roadmaps"],
    filenames: ["*roadmap*", "*ROADMAP*"]
  },
  "Memory and Observability": {
    keywords: ["memory", "observe", "telemetry"],
    paths: ["../../../cic-ingestion/src/memory", "../../../cic-ingestion/src/metrics"]
  },
  "Learning and Evaluation": {
    keywords: ["learning", "maal", "eval"],
    paths: ["../../../cic-ingestion/src/learning"]
  },
  "Validation and Testing": {
    keywords: ["test", "validation", "verify"],
    paths: ["../../../cic-ingestion/src/validation", "../../../cic-ingestion/src/harness"]
  },
  "Automation and Configuration": {
    keywords: ["automation", "config", "schedule"],
    paths: ["../../../cic-ingestion/src/automation", "../../../cic-ingestion/src/config"]
  },
  "Miscellaneous": {
    keywords: [],
    paths: []
  }
};

export type CategoryName = keyof typeof CATEGORY_MAP;

export function getCategoryForPath(filePath: string): CategoryName {
  const normalized = filePath.toLowerCase().replace(/\\/g, "/");

  // Check extension first (Documentation priority)
  if (normalized.endsWith(".md")) {
    return "Documentation";
  }

  // Check exact path matches (high priority)
  for (const [category, config] of Object.entries(CATEGORY_MAP)) {
    if (config.paths && config.paths.length > 0) {
      for (const pathFragment of config.paths) {
        if (normalized.includes(pathFragment.toLowerCase())) {
          return category as CategoryName;
        }
      }
    }
  }

  // Check keywords
  for (const [category, config] of Object.entries(CATEGORY_MAP)) {
    if (config.keywords && config.keywords.length > 0) {
      for (const keyword of config.keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
          return category as CategoryName;
        }
      }
    }
  }

  return "Miscellaneous";
}

export function getAllCategories(): CategoryName[] {
  return Object.keys(CATEGORY_MAP) as CategoryName[];
}
