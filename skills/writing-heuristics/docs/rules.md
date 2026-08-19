# Technical Writing Heuristics Reference Manual

**Catalog Version:** 1.0.0
**Last Updated:** 2026-08-18
**Total Rules:** 11

---

## Catalog Index

| Rule ID | Name | Severity | Handling | Category |
|---|---|---|---|---|
| `ban-throat-clearing` | Ban Throat Clearing | `error` | Autofix (Safe) | anti-slop |
| `ban-filler-adverbs` | Ban Filler Adverbs and Slop Words | `warning` | Manual | anti-slop |
| `avoid-first-person-plural` | Avoid First-Person Plural | `warning` | Manual | google-style |
| `use-second-person` | Use Second Person or Imperative Mood | `warning` | Manual | google-style |
| `active-voice` | Use Active Voice | `warning` | Manual | google-style |
| `assertion-density` | High Assertion Density and Metric Grounding | `warning` | Manual | anti-slop |
| `condition-before-action` | State Condition Before Action | `warning` | Manual | google-style |
| `heading-sentence-case` | Heading Sentence Case | `error` | Autofix (Safe) | google-style |
| `descriptive-links` | Descriptive Link Text | `error` | Manual | google-style |
| `serial-comma` | Serial Oxford Comma | `warning` | Manual | google-style |
| `ordered-sequences` | Ordered vs Unordered Sequences | `warning` | Manual | google-style |

---

## Detailed Rule Specifications

### Ban Throat Clearing (`ban-throat-clearing`)

- **Category**: anti-slop
- **Severity**: `error`
- **Confidence Score**: 1
- **Autofix Support**: Yes (Confidence >= 0.95)
- **Description**: Disallow conversational throat-clearing, pre-announcements, and sycophantic greetings at the beginning of prose paragraphs.
- **Rationale**: Technical documentation should communicate essential information directly without introductory conversational fluff.

- **Token Patterns**:
  - `^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to|Of course)\b[!,.:]?`

#### Examples

**Pass:**
> To configure the client, supply your API key in the environment.

**Fail:**
> Certainly! In this section, we will delve into configuring the client.

---

### Ban Filler Adverbs and Slop Words (`ban-filler-adverbs`)

- **Category**: anti-slop
- **Severity**: `warning`
- **Confidence Score**: 0.85
- **Autofix Support**: No
- **Description**: Flag empty buzzwords, filler adverbs, and hyperbolic adjectives that dilute technical precision.
- **Rationale**: Vague superlatives weaken the authority and density of engineering prose.

- **Token Patterns**:
  - `\b(essentially|basically|crucial|game-changing|delve|delving|comprehensive|seamlessly|unleash|streamline)\b`

#### Examples

**Pass:**
> This update reduces memory overhead by 40%.

**Fail:**
> This game-changing update seamlessly and essentially eliminates overhead.

---

### Avoid First-Person Plural (`avoid-first-person-plural`)

- **Category**: google-style
- **Severity**: `warning`
- **Confidence Score**: 0.9
- **Autofix Support**: No
- **Description**: Flag first-person plural pronouns ('we', 'us', 'our', 'let\'s') in technical instructions.
- **Rationale**: Technical docs should focus on the reader and the system, avoiding ambiguous institutional 'we'.

- **Token Patterns**:
  - `\b(we recommend|we suggest|we will|in our opinion|let's|our recommendation)\b`

#### Examples

**Pass:**
> Install dependencies before starting the service.

**Fail:**
> We recommend that you install dependencies first.

---

### Use Second Person or Imperative Mood (`use-second-person`)

- **Category**: google-style
- **Severity**: `warning`
- **Confidence Score**: 0.8
- **Autofix Support**: No
- **Description**: Encourage direct second-person address ('you') or direct imperative mood; flag third-person passive abstraction ('the developer must...').
- **Rationale**: Direct instructions are clearer and more actionable than abstract descriptions of what an anonymous persona should do.

- **Token Patterns**:
  - `\b(the user should|the developer should|the engineer must|the reader should)\b`

#### Examples

**Pass:**
> You can configure the timeout in config.json.

**Fail:**
> The developer should configure the timeout in config.json.

---

### Use Active Voice (`active-voice`)

- **Category**: google-style
- **Severity**: `warning`
- **Confidence Score**: 0.8
- **Autofix Support**: No
- **Description**: Flag passive voice constructs (auxiliary verb + past participle + optional 'by' agent) in technical instructions.
- **Rationale**: Active voice makes the actor clear and sentences more concise.

- **Token Patterns**:
  - `\b(is|are|was|were|been|being)\s+(?:[a-z]+ed|built|run|written|sent|created|started)\s+by\b`

#### Examples

**Pass:**
> The scheduler triggers the backup job nightly.

**Fail:**
> The backup job is triggered nightly by the scheduler.

---

### High Assertion Density and Metric Grounding (`assertion-density`)

- **Category**: anti-slop
- **Severity**: `warning`
- **Confidence Score**: 0.8
- **Autofix Support**: No
- **Description**: Flag qualitative performance assertions lacking concrete quantitative metrics or specific technical mechanisms.
- **Rationale**: Unbacked assertions like 'vastly superior' or 'incredible speed' lack engineering utility without concrete measurements.

- **Token Patterns**:
  - `\b(vastly superior|incredible speed|ultra fast|blazing fast|extremely powerful|game changing performance)\b`

#### Examples

**Pass:**
> This refactoring reduces query latency from 120ms to 18ms by caching query plans.

**Fail:**
> This refactoring provides vastly superior performance and incredible speed.

---

### State Condition Before Action (`condition-before-action`)

- **Category**: google-style
- **Severity**: `warning`
- **Confidence Score**: 0.75
- **Autofix Support**: No
- **Description**: State prerequisites or conditions before the imperative command rather than trailing after.
- **Rationale**: Putting the condition first prevents the reader from executing an action before discovering it applies only conditionally.

- **Token Patterns**:
  - `^[A-Z][a-z]+\s+.*\s+(?:if you want to|in order to|if you need to)\b`

#### Examples

**Pass:**
> To reload configuration, send SIGHUP to the process.

**Fail:**
> Send SIGHUP to the process if you want to reload configuration.

---

### Heading Sentence Case (`heading-sentence-case`)

- **Category**: google-style
- **Severity**: `error`
- **Confidence Score**: 0.95
- **Autofix Support**: Yes (Confidence >= 0.95)
- **Description**: Enforce Sentence case for all markdown headings (h1-h6) while preserving acronyms and code identifiers.
- **Rationale**: Google Developer Style mandates sentence case for all headings and section titles.

#### Examples

**Pass:**
> ## Deployment configuration and setup

**Fail:**
> ## Deployment Configuration And Setup

---

### Descriptive Link Text (`descriptive-links`)

- **Category**: google-style
- **Severity**: `error`
- **Confidence Score**: 1
- **Autofix Support**: No
- **Description**: Flag generic or non-descriptive link anchor text ('here', 'click here', 'link', 'this page').
- **Rationale**: Links must describe their target destination so readers understand where the link leads without surrounding context.

- **Token Patterns**:
  - `^(here|click here|link|this link|this page|read more|more info|website)$`

#### Examples

**Pass:**
> See the [PostgreSQL Connection Pooling Guide](docs/db.md).

**Fail:**
> For connection pooling, click [here](docs/db.md).

---

### Serial Oxford Comma (`serial-comma`)

- **Category**: google-style
- **Severity**: `warning`
- **Confidence Score**: 0.85
- **Autofix Support**: No
- **Description**: Encourage using the serial Oxford comma before the coordinating conjunction in lists of three or more items.
- **Rationale**: Oxford commas prevent ambiguity in enumerations.

- **Token Patterns**:
  - `\b[A-Za-z0-9_-]+,\s+[A-Za-z0-9_-]+\s+(?:and|or)\s+[A-Za-z0-9_-]+\b`

#### Examples

**Pass:**
> Supports JSON, YAML, and TOML formats.

**Fail:**
> Supports JSON, YAML and TOML formats.

---

### Ordered vs Unordered Sequences (`ordered-sequences`)

- **Category**: google-style
- **Severity**: `warning`
- **Confidence Score**: 0.75
- **Autofix Support**: No
- **Description**: Advises using bulleted lists instead of numbered lists when list items are static descriptive points rather than chronological steps.
- **Rationale**: Numbered lists imply mandatory sequential order; unordered bullet lists represent parallel properties or options.

#### Examples

**Pass:**
> 1. Clone the repository.\n2. Install dependencies.\n3. Run the test suite.

**Fail:**
> 1. High performance.\n2. Modular design.\n3. Comprehensive documentation.

---
