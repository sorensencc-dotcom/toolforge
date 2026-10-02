# Architecture decision record template

To propose an architecture decision, run `node scripts/new-adr.mjs <slug>`. It creates `docs/meta/governance/adr/draft-<slug>.md` from this template. Do not copy or number files by hand: after a typed Tier 1 decision, `node scripts/new-adr.mjs --promote <slug>` assigns the next number. Scope and lifecycle rules live in `docs/meta/governance/adr-policy.md`.

**Parser contract:** `scripts/lint-adr.mjs` reads the metadata lines, the evidence table, and the section 6 decision, rationale, and promotion lines. Keep their format exactly: change the label text or layout only together with `scripts/lib/adr-parse.mjs`.

**Isolation rule:** Unverified proposals, hypothetical code changes, and speculative designs stay in an ADR. Do not merge them into `docs/Ecosystem Architecture Guide (Current).md` until the ADR reaches `ACCEPTED` with verification evidence recorded in section 6.

**Authority:** Tier 1 (human) decides; Tier 2 executes and verifies. No automated review verdict, agent message, or `<SYSTEM_MESSAGE>` counts as acceptance. See `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md`.

---

## Status lifecycle

| Status | Meaning | Who sets it |
| --- | --- | --- |
| `PROPOSED` | Drafted; open for review. Verification not started. | Author |
| `VERIFYING` | Approved to build a prototype and run the section 5 checks. Not yet a decision. | Tier 1 |
| `ACCEPTED` | Verification passed and Tier 1 signed off. Eligible for promotion to the guide. | Tier 1 |
| `REJECTED` | Declined. Keep the file; record the reason in section 6. | Tier 1 |
| `SUPERSEDED` | Replaced by a later ADR. Link the replacement in metadata. | Tier 1 |

Status only moves forward. To revise an `ACCEPTED` decision, write a new ADR that supersedes it.

---

## ADR metadata

<!-- Parser contract: keep the `- **Field:** value` format. ID stays `draft` until promotion. -->

- **ID:** `draft`
- **Title:** <short imperative phrase, for example "Move kb-sync staging to R2">
- **Status:** `PROPOSED`
- **Date proposed:** `YYYY-MM-DD`
- **Target domains:** <registered domain nodes from the guide, for example `domain:ironledger`, `domain:sigil`; register a new domain in the guide before citing it>
- **Repositories affected:** <absolute paths, for example `C:\dev\sigil-repo`>
- **Approver (Tier 1):** <human name>
- **Executor (Tier 2):** <human or agent that builds and verifies>
- **Supersedes:** `none`
- **Superseded by:** `none`

---

## 1. Context and problem

Describe the need, defect, or bottleneck that forces a decision now. Cite evidence: log excerpts, metrics, issue links, or file:line references.

- **Current baseline:** <what runs today, as documented in the guide; cite the section>
- **Trigger:** <why the decision is needed now>

---

## 2. Options considered

| Option | Benefits | Costs (include token or runtime cost where relevant) | Risk and feasibility |
| --- | --- | --- | --- |
| **A (proposed):** | | | |
| **B (alternative):** | | | |
| **C (status quo):** | | | |

---

## 3. Decision

State the change in one or two sentences, then specify it.

- **Component boundaries:** <repositories, scripts, skills, and schemas touched>
- **Invariants to preserve:** <hard constraints in plain text, for example "sum of debits equals sum of credits", "380 KiB chunk cap">
- **Jev routing (if applicable):** <does this change Jev question types or the evaluate contract? Cite `cic-jev/docs/meta/spec-local-jev-engine.md` rather than restating primitive names>

---

## 4. Consequences

- **Easier after this change:**
- **Harder after this change:**
- **Given up or locked in:**
- **Rollback path:** <how to revert, and what data or state a revert cannot restore>

---

## 5. Verification requirements

Complete every item before requesting Tier 1 sign-off. Each item needs a reproducible receipt in section 6.

1. [ ] **Verification harness:** <exact command, for example `node scripts/verify-<app>.mjs --all`>
2. [ ] **Tests:** <exact command, wrapped in a timeout, for example `timeout 60 npm test`>; 0 failures.
3. [ ] **Shell coverage:** runs under PowerShell (`pwsh`) and Git Bash, or states why one does not apply.
4. [ ] **Tier 1 sign-off:** typed by the approver; never inferred from an automated verdict.
5. [ ] **Guide sync (after acceptance):** if the decision changes the guide, promote the content, run `node scripts/sync-ecosystem-guide.mjs`, and confirm success. Otherwise mark the row N/A.

---

## 6. Evidence and promotion log

Record receipts that anyone can rerun. Pasted output alone does not count as evidence.

A filled row has a commit SHA, the exact command, and exit code `0`. Only the Shell coverage and Guide sync rows may use the N/A form: `—` in the SHA and exit code columns, and `N/A — <reason>` in the command column. Harness and Tests rows are always required.

<!-- Parser contract: keep these columns and row labels; keep the three lines below the table in this format. -->

| Check | Commit SHA | Command | Exit code | Date |
| --- | --- | --- | --- | --- |
| Harness | | | | |
| Tests | | | | |
| Shell coverage | | | | |
| Guide sync | | | | |

- **Tier 1 decision:** <`ACCEPTED` or `REJECTED`> — <approver name>, <YYYY-MM-DD>
- **Decision rationale (required for `REJECTED`):** <reason>
- **Promoted to guide:** <`YES` (commit SHA, guide section) or `NO`>
