# usagecheck — Integration Diagram

```
/usagecheck (or Claude Code hook stdin)
        |
        | skills/usagecheck/src/index.js: checkUsage()
        v
detectAgent()  -- env vars, or forced via the "agent" input
        |
        +-- claude-code --> readClaudeUsage()   hook payload or cached limits file (confirmed path)
        +-- codex ---------> readCodexUsage()   configured command or directory scan (heuristic)
        +-- grok ----------> readGrokUsage()    configured command or directory scan (heuristic)
        |
        v
normalized report: { status, agent, detection, available, usage, message, timestamp }
```

Optional `usagecheck.config.json` (`configPath` input) overrides the Codex and Grok command or scan directory. Details: [docs/USAGE.md](docs/USAGE.md).
