import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Claude Code settings - alwaysLoad is false for MCP servers", () => {
  const settings = JSON.parse(fs.readFileSync("C:/Users/soren/.claude/settings.json", "utf8"));
  assert.ok(settings.mcpServers, "settings.mcpServers must exist");

  for (const [serverName, config] of Object.entries(settings.mcpServers)) {
    assert.equal(
      config.alwaysLoad,
      false,
      `Expected mcpServer '${serverName}' to have alwaysLoad: false`
    );
  }
});

test("Claude Code settings - Agent Teams and Subagent model configured", () => {
  const settings = JSON.parse(fs.readFileSync("C:/Users/soren/.claude/settings.json", "utf8"));
  assert.ok(settings.env, "settings.env must exist");
  assert.equal(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, "1");
  assert.equal(settings.env.CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL, "claude-3-5-sonnet");
});

test("Agent frontmatter - repo-governance-auditor has autoCompactWindow", () => {
  const content = fs.readFileSync("C:/dev/.claude/agents/repo-governance-auditor.md", "utf8");
  assert.match(content, /^autoCompactWindow:\s*0\.5$/m, "autoCompactWindow: 0.5 must be defined in frontmatter");
});
