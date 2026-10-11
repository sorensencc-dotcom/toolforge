# TRM DevOps Triage

Operational defect triage and resolution operator workflow for the TRM DevOps sync pipeline.

## Quick start

1. Open `dev/triage/queue.md` and claim an item by setting `- **Status:** IN_PROGRESS`.
2. Run extracted diagnostic commands (e.g. `gh run view --log-failed`).
3. Apply fixes and verify locally (`npm test`).
4. After explicit operator approval, set status to `RESOLVED` and prune with `node modules/trm-devops/dist/cli/index.js prune` from Toolforge root; build module first.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For detailed workflow:** See [docs/USAGE.md](docs/USAGE.md).
