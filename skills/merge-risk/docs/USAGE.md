# merge-risk Usage & Integration Guide

## Overview

The `merge-risk` skill automates the evaluation of pull request safety. It models Matt Pocock's 5-dimension risk scoring specification:

$$\text{Score} = \frac{2 \times \text{Impact} + 2 \times \text{Verification} + 1.5 \times \text{Rollback} + 1 \times \text{ErrorDetection} + 1 \times \text{Alignment}}{7.5}$$

### Risk Tiers
- **Low**: $\text{Score} < 1.5$
- **Medium**: $1.5 \le \text{Score} < 2.25$
- **High**: $\text{Score} \ge 2.25$

---

## Sensitive Touchpoint Detection

The evaluation flags sensitive touchpoints:
- Authentication & Sessions (`auth/`, `login`, `token`, `session`)
- Permissions & RBAC (`rbac`, `permission`, `gate`, `containment`)
- Secrets & Credentials (`secret`, `api_key`, `credentials`, `adc`)
- Data Migrations & Schema Alterations (`migration`, `schema`, `alter table`, `drop`)
- Infrastructure & Dependencies (`package.json`, `Dockerfile`, `workflow`, `.yml`)

---

## Integration with TRM Stage PR

`scripts/trm-stage-pr.mjs` integrates `evaluateMergeRisk` to assess incoming action cards before dispatching to remote agents:

```bash
# Check risk during staging
node scripts/trm-stage-pr.mjs --card-id=<cardId> --check-risk
```

If risk is scored as **high**, autonomous staging can require manual human Tier 1 sign-off before pushing remote branches.
