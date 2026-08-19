#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cli.ts
var cli_exports = {};
__export(cli_exports, {
  runCli: () => runCli
});
module.exports = __toCommonJS(cli_exports);
var fs3 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// heuristics.json
var heuristics_default = {
  version: "1.0.0",
  lastUpdated: "2026-08-18",
  rules: [
    {
      id: "ban-throat-clearing",
      name: "Ban Throat Clearing",
      severity: "error",
      autofix: true,
      confidence: 1,
      advisory: false,
      category: "anti-slop",
      description: "Disallow conversational throat-clearing, pre-announcements, and sycophantic greetings at the beginning of prose paragraphs.",
      rationale: "Technical documentation should communicate essential information directly without introductory conversational fluff.",
      patterns: [
        "^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to|Of course)\\b[!,.:]?"
      ],
      passExample: "To configure the client, supply your API key in the environment.",
      failExample: "Certainly! In this section, we will delve into configuring the client."
    },
    {
      id: "ban-filler-adverbs",
      name: "Ban Filler Adverbs and Slop Words",
      severity: "warning",
      autofix: false,
      confidence: 0.85,
      advisory: false,
      category: "anti-slop",
      description: "Flag empty buzzwords, filler adverbs, and hyperbolic adjectives that dilute technical precision.",
      rationale: "Vague superlatives weaken the authority and density of engineering prose.",
      patterns: [
        "\\b(essentially|basically|crucial|game-changing|delve|delving|comprehensive|seamlessly|unleash|streamline)\\b"
      ],
      passExample: "This update reduces memory overhead by 40%.",
      failExample: "This game-changing update seamlessly and essentially eliminates overhead."
    },
    {
      id: "avoid-first-person-plural",
      name: "Avoid First-Person Plural",
      severity: "warning",
      autofix: false,
      confidence: 0.9,
      advisory: false,
      category: "google-style",
      description: "Flag first-person plural pronouns ('we', 'us', 'our', 'let\\'s') in technical instructions.",
      rationale: "Technical docs should focus on the reader and the system, avoiding ambiguous institutional 'we'.",
      patterns: [
        "\\b(we recommend|we suggest|we will|in our opinion|let's|our recommendation)\\b"
      ],
      passExample: "Install dependencies before starting the service.",
      failExample: "We recommend that you install dependencies first."
    },
    {
      id: "use-second-person",
      name: "Use Second Person or Imperative Mood",
      severity: "warning",
      autofix: false,
      confidence: 0.8,
      advisory: true,
      category: "google-style",
      description: "Encourage direct second-person address ('you') or direct imperative mood; flag third-person passive abstraction ('the developer must...').",
      rationale: "Direct instructions are clearer and more actionable than abstract descriptions of what an anonymous persona should do.",
      patterns: [
        "\\b(the user should|the developer should|the engineer must|the reader should)\\b"
      ],
      passExample: "You can configure the timeout in config.json.",
      failExample: "The developer should configure the timeout in config.json."
    },
    {
      id: "active-voice",
      name: "Use Active Voice",
      severity: "warning",
      autofix: false,
      confidence: 0.8,
      advisory: false,
      category: "google-style",
      description: "Flag passive voice constructs (auxiliary verb + past participle + optional 'by' agent) in technical instructions.",
      rationale: "Active voice makes the actor clear and sentences more concise.",
      patterns: [
        "\\b(is|are|was|were|been|being)\\s+(?:[a-z]+ed|built|run|written|sent|created|started)\\s+by\\b"
      ],
      passExample: "The scheduler triggers the backup job nightly.",
      failExample: "The backup job is triggered nightly by the scheduler."
    },
    {
      id: "assertion-density",
      name: "High Assertion Density and Metric Grounding",
      severity: "warning",
      autofix: false,
      confidence: 0.8,
      advisory: false,
      category: "anti-slop",
      description: "Flag qualitative performance assertions lacking concrete quantitative metrics or specific technical mechanisms.",
      rationale: "Unbacked assertions like 'vastly superior' or 'incredible speed' lack engineering utility without concrete measurements.",
      patterns: [
        "\\b(vastly superior|incredible speed|ultra fast|blazing fast|extremely powerful|game changing performance)\\b"
      ],
      passExample: "This refactoring reduces query latency from 120ms to 18ms by caching query plans.",
      failExample: "This refactoring provides vastly superior performance and incredible speed."
    },
    {
      id: "condition-before-action",
      name: "State Condition Before Action",
      severity: "warning",
      autofix: false,
      confidence: 0.75,
      advisory: false,
      category: "google-style",
      description: "State prerequisites or conditions before the imperative command rather than trailing after.",
      rationale: "Putting the condition first prevents the reader from executing an action before discovering it applies only conditionally.",
      patterns: [
        "^[A-Z][a-z]+\\s+.*\\s+(?:if you want to|in order to|if you need to)\\b"
      ],
      passExample: "To reload configuration, send SIGHUP to the process.",
      failExample: "Send SIGHUP to the process if you want to reload configuration."
    },
    {
      id: "heading-sentence-case",
      name: "Heading Sentence Case",
      severity: "error",
      autofix: true,
      confidence: 0.95,
      advisory: false,
      category: "google-style",
      description: "Enforce Sentence case for all markdown headings (h1-h6) while preserving acronyms and code identifiers.",
      rationale: "Google Developer Style mandates sentence case for all headings and section titles.",
      passExample: "## Deployment configuration and setup",
      failExample: "## Deployment Configuration And Setup"
    },
    {
      id: "descriptive-links",
      name: "Descriptive Link Text",
      severity: "error",
      autofix: false,
      confidence: 1,
      advisory: false,
      category: "google-style",
      description: "Flag generic or non-descriptive link anchor text ('here', 'click here', 'link', 'this page').",
      rationale: "Links must describe their target destination so readers understand where the link leads without surrounding context.",
      patterns: [
        "^(here|click here|link|this link|this page|read more|more info|website)$"
      ],
      passExample: "See the [PostgreSQL Connection Pooling Guide](docs/db.md).",
      failExample: "For connection pooling, click [here](docs/db.md)."
    },
    {
      id: "serial-comma",
      name: "Serial Oxford Comma",
      severity: "warning",
      autofix: false,
      confidence: 0.85,
      advisory: true,
      category: "google-style",
      description: "Encourage using the serial Oxford comma before the coordinating conjunction in lists of three or more items.",
      rationale: "Oxford commas prevent ambiguity in enumerations.",
      patterns: [
        "\\b[A-Za-z0-9_-]+,\\s+[A-Za-z0-9_-]+\\s+(?:and|or)\\s+[A-Za-z0-9_-]+\\b"
      ],
      passExample: "Supports JSON, YAML, and TOML formats.",
      failExample: "Supports JSON, YAML and TOML formats."
    },
    {
      id: "ordered-sequences",
      name: "Ordered vs Unordered Sequences",
      severity: "warning",
      autofix: false,
      confidence: 0.75,
      advisory: true,
      category: "google-style",
      description: "Advises using bulleted lists instead of numbered lists when list items are static descriptive points rather than chronological steps.",
      rationale: "Numbered lists imply mandatory sequential order; unordered bullet lists represent parallel properties or options.",
      passExample: "1. Clone the repository.\\n2. Install dependencies.\\n3. Run the test suite.",
      failExample: "1. High performance.\\n2. Modular design.\\n3. Comprehensive documentation."
    }
  ]
};

// src/linter.ts
var fs = __toESM(require("fs"));

// src/parser.ts
var import_unified = require("unified");
var import_remark_parse = __toESM(require("remark-parse"));
var import_remark_gfm = __toESM(require("remark-gfm"));
var import_remark_frontmatter = __toESM(require("remark-frontmatter"));
var import_unist_util_visit = require("unist-util-visit");
function parseMarkdown(content) {
  const processor = (0, import_unified.unified)().use(import_remark_parse.default).use(import_remark_frontmatter.default, ["yaml", "toml"]).use(import_remark_gfm.default);
  const ast = processor.parse(content);
  const proseNodes = [];
  const linkNodes = [];
  const comments = [];
  (0, import_unist_util_visit.visit)(ast, (node) => {
    if (node.type === "code" || node.type === "inlineCode" || node.type === "table" || node.type === "tableRow" || node.type === "tableCell" || node.type === "yaml" || node.type === "toml") {
      return;
    }
    if (node.type === "html") {
      const match = node.value.match(/^<!--\s*(.*?)\s*-->$/s);
      if (match) {
        comments.push({
          value: match[1].trim(),
          line: node.position?.start?.line ?? 1,
          column: node.position?.start?.column ?? 1
        });
      }
      return;
    }
    if (node.type === "link") {
      let linkText = "";
      if (node.children) {
        linkText = node.children.map((c) => c.value ?? "").join("");
      }
      linkNodes.push({
        text: linkText.trim(),
        url: node.url ?? "",
        line: node.position?.start?.line ?? 1,
        column: node.position?.start?.column ?? 1,
        endLine: node.position?.end?.line ?? 1,
        endColumn: node.position?.end?.column ?? 1
      });
      return;
    }
    if (node.type === "paragraph" || node.type === "heading") {
      let fullText = "";
      (0, import_unist_util_visit.visit)(node, (child) => {
        if (child.type === "text") {
          fullText += child.value;
        }
      });
      if (fullText.trim().length > 0) {
        proseNodes.push({
          type: node.type,
          text: fullText,
          line: node.position?.start?.line ?? 1,
          column: node.position?.start?.column ?? 1,
          endLine: node.position?.end?.line ?? 1,
          endColumn: node.position?.end?.column ?? 1,
          rawNode: node
        });
      }
    }
  });
  return { ast, proseNodes, linkNodes, comments };
}

// src/suppressions.ts
var SuppressionRegistry = class {
  directives = [];
  constructor(comments, currentDate = /* @__PURE__ */ new Date()) {
    this.parseDirectives(comments, currentDate);
  }
  parseDirectives(comments, currentDate) {
    const todayStr = currentDate.toISOString().slice(0, 10);
    for (const c of comments) {
      const disableMatch = c.value.match(/^heuristics-disable\s+([a-zA-Z0-9_-]+|all)(?:\s+author="([^"]*)")?(?:\s+reason="([^"]*)")?(?:\s+until="([^"]*)")?/);
      if (disableMatch) {
        const ruleId = disableMatch[1];
        const author = disableMatch[2] ?? "";
        const reason = disableMatch[3] ?? "";
        const until = disableMatch[4];
        let isExpired = false;
        if (until) {
          isExpired = todayStr > until;
        }
        this.directives.push({
          ruleId,
          author,
          reason,
          until,
          line: c.line,
          isExpired,
          active: !isExpired
        });
      }
    }
  }
  isSuppressed(ruleId, line) {
    for (const dir of this.directives) {
      if (dir.active && (dir.ruleId === ruleId || dir.ruleId === "all") && line >= dir.line) {
        return true;
      }
    }
    return false;
  }
  getDirectives() {
    return this.directives;
  }
};

// src/linter.ts
function getCatalog(customPath) {
  if (customPath) {
    return JSON.parse(fs.readFileSync(customPath, "utf8"));
  }
  return heuristics_default;
}
function lintText(content, options = {}) {
  const catalog = getCatalog();
  const parsed = parseMarkdown(content);
  const suppressions = new SuppressionRegistry(parsed.comments);
  const violations = [];
  for (const s of suppressions.getDirectives()) {
    if (s.isExpired) {
      violations.push({
        ruleId: "suppression-expired",
        ruleName: "Expired Suppression Directive",
        severity: "error",
        message: `Suppression for rule "${s.ruleId}" by author "${s.author}" expired on ${s.until}.`,
        line: s.line,
        column: 1,
        autofix: false,
        confidence: 1
      });
    }
  }
  for (const node of parsed.proseNodes) {
    for (const rule of catalog.rules) {
      if (!options.noSuppress && suppressions.isSuppressed(rule.id, node.line)) {
        continue;
      }
      if (rule.id === "ban-throat-clearing" && node.type === "paragraph") {
        const regex = /^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to|Of course)[!,.:]?\s*/i;
        const m = node.text.match(regex);
        if (m) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Avoid conversational throat-clearing opener: "${m[0].trim()}".`,
            line: node.line,
            column: node.column,
            autofix: true,
            confidence: rule.confidence,
            fix: {
              range: [0, m[0].length],
              text: ""
            }
          });
        }
      }
      if (rule.id === "ban-filler-adverbs") {
        const regex = /\b(essentially|basically|crucial|game-changing|delve|delving|comprehensive|seamlessly|unleash|streamline)\b/gi;
        let match;
        while ((match = regex.exec(node.text)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Avoid filler / slop word: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "avoid-first-person-plural") {
        const regex = /\b(we recommend|we suggest|we will|in our opinion|let's|our recommendation)\b/gi;
        let match;
        while ((match = regex.exec(node.text)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Avoid first-person plural in technical docs: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "use-second-person") {
        const regex = /\b(the user should|the developer should|the engineer must|the reader should)\b/gi;
        let match;
        while ((match = regex.exec(node.text)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Prefer direct imperative or second-person ("you") over third-person: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "active-voice") {
        const regex = /\b(is|are|was|were|been|being)\s+(?:[a-z]+ed|built|run|written|sent|created|started)(?:\s+[a-z]+)?\s+by\b/gi;
        let match;
        while ((match = regex.exec(node.text)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Passive voice construct detected: "${match[0]}". Use active voice.`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "assertion-density") {
        const regex = /\b(vastly superior|incredible speed|ultra fast|blazing fast|extremely powerful|game changing performance)\b/gi;
        let match;
        while ((match = regex.exec(node.text)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Qualitative assertion lacking quantitative grounding: "${match[0]}". Provide metrics.`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "condition-before-action") {
        const regex = /^[A-Z][a-z]+\s+.*\s+(?:if you want to|in order to|if you need to)\b/i;
        if (regex.test(node.text)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `State prerequisite/condition before command ("To X, run Y").`,
            line: node.line,
            column: node.column,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "heading-sentence-case" && node.type === "heading") {
        const words = node.text.split(/\s+/);
        let titleCaseCount = 0;
        for (let i = 1; i < words.length; i++) {
          const w = words[i];
          if (/^[A-Z][a-z]{3,}$/.test(w)) {
            titleCaseCount++;
          }
        }
        if (titleCaseCount >= 2) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Heading must be Sentence case: "${node.text}".`,
            line: node.line,
            column: node.column,
            autofix: true,
            confidence: rule.confidence
          });
        }
      }
      if (rule.id === "serial-comma") {
        const regex = /\b([A-Za-z0-9_-]+),\s+([A-Za-z0-9_-]+)\s+(and|or)\s+([A-Za-z0-9_-]+)\b/g;
        let match;
        while ((match = regex.exec(node.text)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Missing serial Oxford comma: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence
          });
        }
      }
    }
  }
  for (const link of parsed.linkNodes) {
    if (!options.noSuppress && suppressions.isSuppressed("descriptive-links", link.line)) {
      continue;
    }
    const genericLinkRegex = /^(here|click here|link|this link|this page|read more|more info|website)$/i;
    if (genericLinkRegex.test(link.text)) {
      violations.push({
        ruleId: "descriptive-links",
        ruleName: "Descriptive Link Text",
        severity: "error",
        message: `Generic link text "${link.text}" is not descriptive. Name the specific destination.`,
        line: link.line,
        column: link.column,
        autofix: false,
        confidence: 1
      });
    }
  }
  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;
  return {
    filePath: options.filePath,
    clean: violations.length === 0,
    errorCount,
    warningCount,
    violations,
    suppressions: suppressions.getDirectives()
  };
}
async function lintFile(filePath, options = {}) {
  const content = fs.readFileSync(filePath, "utf8");
  return lintText(content, { ...options, filePath });
}

// src/fixer.ts
var fs2 = __toESM(require("fs"));
var path = __toESM(require("path"));
function toSentenceCase(headingText) {
  const words = headingText.split(/(\s+)/);
  return words.map((w, index) => {
    if (index === 0 || /\s+/.test(w) || /^[A-Z0-9_]{2,}$/.test(w) || /^`.*`$/.test(w)) {
      return w;
    }
    return w.toLowerCase();
  }).join("");
}
function applyFixes(content, violations) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const hasBom = content.charCodeAt(0) === 65279;
  let text = hasBom ? content.slice(1) : content;
  let appliedCount = 0;
  const lines = text.split(/\r?\n/);
  for (const v of violations) {
    if (!v.autofix || v.confidence < 0.95) {
      continue;
    }
    const lineIdx = v.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    const line = lines[lineIdx];
    if (v.ruleId === "ban-throat-clearing") {
      const regex = /^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to|Of course)[!,.:]?\s*/i;
      const newLine = line.replace(regex, "");
      if (newLine !== line) {
        lines[lineIdx] = newLine.charAt(0).toUpperCase() + newLine.slice(1);
        appliedCount++;
      }
    }
    if (v.ruleId === "heading-sentence-case") {
      const match = line.match(/^(#{1,6}\s+)(.*)$/);
      if (match) {
        lines[lineIdx] = match[1] + toSentenceCase(match[2]);
        appliedCount++;
      }
    }
  }
  let fixedContent = lines.join(eol);
  if (hasBom) {
    fixedContent = "\uFEFF" + fixedContent;
  }
  return {
    originalContent: content,
    fixedContent,
    appliedCount,
    clean: appliedCount > 0
  };
}
async function safeFixFile(filePath, options = {}) {
  const content = fs2.readFileSync(filePath, "utf8");
  const lintRes = lintText(content, { filePath });
  const fixRes = applyFixes(content, lintRes.violations);
  if (options.dryRun || fixRes.appliedCount === 0) {
    return {
      ...fixRes,
      filePath
    };
  }
  const pid = process.pid;
  const timestamp = Date.now();
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const tmpPath = path.join(dir, `${base}.${pid}.${timestamp}.tmp`);
  let backupPath;
  if (!options.noBackup) {
    let bakSuffix = "";
    let counter = 0;
    while (fs2.existsSync(path.join(dir, `${base}.${timestamp}.bak${bakSuffix}`))) {
      counter++;
      bakSuffix = `.${counter}`;
    }
    backupPath = path.join(dir, `${base}.${timestamp}.bak${bakSuffix}`);
  }
  try {
    const fd = fs2.openSync(tmpPath, "w");
    fs2.writeFileSync(fd, fixRes.fixedContent, "utf8");
    fs2.fsyncSync(fd);
    fs2.closeSync(fd);
    if (backupPath) {
      fs2.copyFileSync(filePath, backupPath);
    }
    fs2.copyFileSync(tmpPath, filePath);
    return {
      ...fixRes,
      filePath,
      backupPath
    };
  } catch (err) {
    if (backupPath && fs2.existsSync(backupPath)) {
      try {
        fs2.copyFileSync(backupPath, filePath);
      } catch (_) {
      }
    }
    throw err;
  } finally {
    if (fs2.existsSync(tmpPath)) {
      try {
        fs2.unlinkSync(tmpPath);
      } catch (_) {
      }
    }
  }
}

// src/formatters.ts
function formatStylish(results) {
  let output = "";
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const res of results) {
    if (res.violations.length === 0) continue;
    output += `
${res.filePath ?? "stdin"}
`;
    for (const v of res.violations) {
      const color = v.severity === "error" ? "\x1B[31merror\x1B[0m" : "\x1B[33mwarning\x1B[0m";
      output += `  ${v.line}:${v.column}  ${color}  ${v.message}  \x1B[90m${v.ruleId}\x1B[0m
`;
      if (v.severity === "error") totalErrors++;
      else totalWarnings++;
    }
  }
  const total = totalErrors + totalWarnings;
  if (total > 0) {
    output += `
\x1B[1m\x1B[31m\u2716 ${total} problem${total === 1 ? "" : "s"} (${totalErrors} error${totalErrors === 1 ? "" : "s"}, ${totalWarnings} warning${totalWarnings === 1 ? "" : "s"})\x1B[0m
`;
  } else {
    output += `
\x1B[32m\u2714 All writing heuristics passed successfully!\x1B[0m
`;
  }
  return output;
}
function formatJson(results) {
  const totalFiles = results.length;
  let totalErrors = 0;
  let totalWarnings = 0;
  const allSuppressions = [];
  for (const r of results) {
    totalErrors += r.errorCount;
    totalWarnings += r.warningCount;
    allSuppressions.push(...r.suppressions);
  }
  return JSON.stringify(
    {
      summary: {
        filesScanned: totalFiles,
        errors: totalErrors,
        warnings: totalWarnings,
        clean: totalErrors === 0 && totalWarnings === 0
      },
      suppressions: allSuppressions,
      files: results
    },
    null,
    2
  );
}
function formatSarif(results) {
  const runs = [
    {
      tool: {
        driver: {
          name: "toolforge-writing-heuristics",
          informationUri: "https://github.com/sorensencc-dotcom/toolforge",
          rules: [
            { id: "ban-throat-clearing", name: "Ban Throat Clearing" },
            { id: "heading-sentence-case", name: "Heading Sentence Case" },
            { id: "descriptive-links", name: "Descriptive Links" }
          ]
        }
      },
      results: results.flatMap(
        (r) => r.violations.map((v) => ({
          ruleId: v.ruleId,
          level: v.severity === "error" ? "error" : "warning",
          message: { text: v.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: r.filePath ?? "stdin" },
                region: { startLine: v.line, startColumn: v.column }
              }
            }
          ]
        }))
      )
    }
  ];
  return JSON.stringify({ version: "2.1.0", $schema: "https://schemastore.azurewebsites.net/schemas/v2.1.0/sarif-schema.json", runs }, null, 2);
}

// src/cli.ts
async function runCli(argv = process.argv.slice(2)) {
  const command = argv[0] ?? "check";
  const flags = argv.slice(1);
  const isStdin = flags.includes("--stdin");
  const isStrict = flags.includes("--strict");
  const isDryRun = flags.includes("--dry-run");
  const formatFlag = flags.find((f) => f.startsWith("--format="));
  const format = formatFlag ? formatFlag.split("=")[1] : "stylish";
  const globs = flags.filter((f) => !f.startsWith("--") && f !== command);
  if (command === "--help" || command === "-h" || flags.includes("--help")) {
    process.stdout.write(`Toolforge Writing Heuristics Linter & Fixer
Usage:
  lint-heuristics check [globs...] [--stdin] [--strict] [--format=stylish|json|sarif]
  lint-heuristics fix [globs...] [--stdin] [--dry-run]

`);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write("1.0.0\n");
    return 0;
  }
  if (isStdin) {
    const input = fs3.readFileSync(0, "utf8");
    if (command === "fix") {
      const lintRes = lintText(input);
      const fixRes = applyFixes(input, lintRes.violations);
      process.stdout.write(fixRes.fixedContent);
      return 0;
    } else {
      const res = lintText(input, { strict: isStrict });
      if (format === "json") process.stdout.write(formatJson([res]));
      else if (format === "sarif") process.stdout.write(formatSarif([res]));
      else process.stderr.write(formatStylish([res]));
      if (res.errorCount > 0 || isStrict && res.warningCount > 0) {
        return 1;
      }
      return 0;
    }
  }
  const files = [];
  for (const g of globs) {
    if (fs3.existsSync(g)) {
      const stat = fs3.statSync(g);
      if (stat.isDirectory()) {
        const findMd = (d) => {
          for (const item of fs3.readdirSync(d)) {
            const full = path2.join(d, item);
            if (fs3.statSync(full).isDirectory()) findMd(full);
            else if (full.endsWith(".md")) files.push(full);
          }
        };
        findMd(g);
      } else {
        files.push(g);
      }
    }
  }
  if (files.length === 0) {
    if (globs.length > 0) {
      process.stderr.write(`No markdown files found matching pattern: ${globs.join(" ")}
`);
      return 2;
    }
    process.stdout.write("No files specified. Run with --help for usage.\n");
    return 0;
  }
  if (command === "fix") {
    let anyFixed = false;
    for (const f of files) {
      const res = await safeFixFile(f, { dryRun: isDryRun });
      if (res.appliedCount > 0) {
        anyFixed = true;
        process.stdout.write(`${isDryRun ? "[DRY RUN] " : ""}Fixed ${res.appliedCount} issues in ${f}
`);
      }
    }
    if (!anyFixed) {
      process.stdout.write("No autofixable issues found.\n");
    }
    return 0;
  }
  const results = [];
  for (const f of files) {
    results.push(await lintFile(f, { strict: isStrict }));
  }
  if (format === "json") process.stdout.write(formatJson(results) + "\n");
  else if (format === "sarif") process.stdout.write(formatSarif(results) + "\n");
  else process.stdout.write(formatStylish(results));
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);
  if (totalErrors > 0 || isStrict && totalWarnings > 0) {
    return 1;
  }
  return 0;
}
runCli().then((code) => {
  if (code !== 0) process.exit(code);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runCli
});
