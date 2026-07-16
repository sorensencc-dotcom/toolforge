# Toolforge Submission Validator — Integration Diagram

**Status: IMPLEMENTED**

```
toolforge-cli (submit command)
      |
      | npm run validate -- <skill-path>
      v
toolforge-submission-validator (node/ts)
      |
      +--> checks: manifest_valid, tests_pass, docs_complete, governance_aligned
      |
      v
ConformanceReport JSON (recommendation: approve | hold | reject)
      |
      v
Tier 1 review (caveman_review: pending until manual approval)
      |
      v
toolforge-registry-manager (-Action add, on approval)
```
