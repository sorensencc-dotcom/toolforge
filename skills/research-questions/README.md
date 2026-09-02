# Research Questions

Generate and resolve TRM research questions from a curator-approved batch. Prompt-only skill — no code entrypoint; the agent follows [SKILL.md](SKILL.md) directly.

## Quick Start

`/research-questions <topic>`, or run after `curator-decision-processor` finishes a batch.

## What it does

- Runs `scan-gaps.mjs` to draft questions
- Vision-reads local archive photos first for low-confidence/gap questions, falls back to WebSearch
- Closes, escalates, or leaves questions open based on judged confidence
- Writes `research-questions.json` and recomputes `focus-areas.json` via `update-focus-areas.mjs`

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
