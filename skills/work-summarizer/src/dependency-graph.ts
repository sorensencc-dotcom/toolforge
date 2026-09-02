// Dependency graph over real 17-category taxonomy from category-map.ts
// Derived from actual CIC/RL repo structure and module relationships

export const CATEGORY_GRAPH: Record<string, string[]> = {
  "CIC Ingestion": ["CIC Extractors", "CIC Drift Engine"],
  "CIC Drift Engine": ["CIC Ingestion", "Memory and Observability"],
  "CIC Extractors": ["CIC Ingestion", "Rewrite Labs"],
  "CIC Harvester": ["CIC Drift Engine", "Memory and Observability"],
  "CIC Orchestrator": ["CIC Ingestion", "CIC Drift Engine"],
  "Governance": ["Governance SLO", "Governance Rollback", "Memory and Observability"],
  "Governance SLO": ["Governance"],
  "Governance Rollback": ["Governance", "CIC Drift Engine"],
  "Rewrite Labs": ["CIC Extractors", "Documentation"],
  "Offline Runtime Integration": ["CIC Orchestrator", "CIC Drift Engine"],
  "Documentation": [],
  "Roadmap": ["Governance"],
  "Memory and Observability": ["Governance", "Learning and Evaluation"],
  "Learning and Evaluation": ["Governance", "CIC Drift Engine"],
  "Validation and Testing": ["CIC Ingestion", "Learning and Evaluation"],
  "Automation and Configuration": ["CIC Orchestrator", "Memory and Observability"],
  "Miscellaneous": []
};

export interface CrossImpact {
  source: string;
  affected_categories: string[];
  impact_level: "critical" | "high" | "medium" | "low";
  dependency_type: string;
}

export function getCrossImpact(activeCategories: string[]): CrossImpact[] {
  const impacts: CrossImpact[] = [];
  const impactedSet = new Set<string>();

  for (const cat of activeCategories) {
    const neighbors = CATEGORY_GRAPH[cat] ?? [];

    for (const neighbor of neighbors) {
      if (!impactedSet.has(`${cat}→${neighbor}`)) {
        impactedSet.add(`${cat}→${neighbor}`);

        // Determine impact level based on subsystem type
        let level: "critical" | "high" | "medium" | "low" = "medium";
        if (
          cat.includes("Governance") ||
          cat.includes("Drift Engine") ||
          neighbor.includes("Governance") ||
          neighbor.includes("Drift Engine")
        ) {
          level = "critical";
        } else if (
          cat.includes("Ingestion") ||
          cat.includes("Extractors") ||
          neighbor.includes("Ingestion") ||
          neighbor.includes("Extractors")
        ) {
          level = "high";
        } else if (
          cat.includes("Documentation") ||
          neighbor.includes("Documentation")
        ) {
          level = "low";
        }

        impacts.push({
          source: cat,
          affected_categories: [neighbor],
          impact_level: level,
          dependency_type: `${cat.toLowerCase()} → ${neighbor.toLowerCase()}`
        });
      }
    }
  }

  return impacts;
}
