# Toolforge Index

Central index of all tools, daemons, scaffolds, and prototypes generated for Rewrite Labs and CIC.

This index provides a high-level overview of each tool, its purpose, and its integration points across the multi-repo ecosystem.

---

## MCP Servers (`mcp-servers/`)
Tools that expose MCP endpoints for ingestion, redesign, orchestration, or analysis.

| Tool | Description | Repos Touched |
|------|-------------|---------------|
| (add entries as created) | | |

---

## Adapters (`adapters/`)
Protocol bridges and integration layers.

| Adapter | Description | Upstream | Downstream |
|---------|-------------|----------|------------|
| | | | |

---

## Daemons (`daemons/`)
Background services, schedulers, and watchers.

| Daemon | Purpose | Schedule | Output |
|--------|---------|----------|--------|
| multiRepoRoadmapSync | Scans all Rewrite Labs + CIC repos and updates roadmap docs | Daily 09:00 UTC | Slack + OneDrive |

---

## Sync Tools (`sync-tools/`)
Roadmap sync, drift detection, multi-repo orchestration.

| Tool | Description | Repos | Output |
|------|-------------|-------|--------|
| multiRepoRoadmapSync | Unified drift detector + roadmap updater | All sorensencc-dotcom repos | Slack + OneDrive |

---

## Scaffolds (`scaffolds/`)
Starter templates for new tools.

| Scaffold | Purpose |
|----------|---------|
| _TEMPLATE | Standard folder + README for new tools |

---


## Prototypes (`prototypes/`)
Experimental tools, POCs, and research utilities.

| Prototype | Description |
|-----------|-------------|
| | |

---

## Utilities (`utilities/`)
Small scripts, helpers, and one-off tools.

| Utility | Description |
|---------|-------------|
| | |

---

## Notes
Toolforge is intentionally isolated from production repos to prevent pollution and maintain deterministic workflows.
