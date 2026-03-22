---
title: "Action Authority: Controlling What Agents Do"
description: "Action authority governs what actions an agent can take, independent of cost. Toolset-scoped budgets with risk points enforce hard limits on side effects."
---

# Action Authority: Controlling What Agents Do

Budget authority controls how much an agent spends. Action authority controls what it does.

Both are dimensions of [runtime authority](/blog/what-is-runtime-authority-for-ai-agents) — the pre-execution control layer that decides whether an agent's next action should proceed. Budget authority caps financial exposure. Action authority caps operational exposure: emails sent, deploys triggered, records modified, files deleted.

## Why cost budgets are not enough

A support agent that sends 200 customer emails costs $1.40 in model tokens. A per-run budget of $100, $50, even $5 would not have stopped a single email. The risk was not monetary — it was reputational, operational, and commercial.

Dollar budgets are the wrong unit for action authority. The problem is not "the agent spent too much." The problem is "the agent did something it should not have done."

## RISK_POINTS — budgeting what money cannot measure

Cycles supports a **RISK_POINTS** unit for exactly this problem. Instead of denominating budgets in dollars or tokens, teams assign point values to each action class based on blast radius:

| Action | Risk points | Rationale |
|--------|------------|-----------|
| Read CRM record | 0 | No side effects |
| Add internal note | 1 | Low blast radius, reversible |
| Send customer email | 50 | High blast radius, irreversible |
| Trigger deployment | 100 | Production impact |

A workflow gets a fixed risk-point budget. Every consequential action deducts from it. When the budget is exhausted, the agent can still read and reason — but it cannot act.

## Toolset-scoped budgets

Action authority works through **toolset-scoped budgets** — separate budgets for different categories of tools within the same agent run:

- **Internal tools** (CRM reads, note-taking) get a generous risk-point budget
- **External tools** (customer email, deploy) get a restrictive one

The agent can exhaust its email budget while still having full access to internal tools. The [three-way decision model](/protocol/caps-and-the-three-way-decision-model-in-cycles) (ALLOW, ALLOW_WITH_CAPS, DENY) governs the degradation: the agent continues useful work while dangerous capabilities are removed from its reach.

## Graceful degradation, not hard stops

Action authority does not require killing the agent. As risk-point budget decreases, capabilities degrade:

- **0–50% consumed**: Full tool access
- **50–80%**: High-blast-radius actions disabled (email, deploy)
- **80–100%**: Read-only mode (search, summarize)
- **100%**: No further actions

This is the "disable" degradation strategy applied to action authority rather than cost control. See [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer).

## Next steps

- [Glossary: Action Authority](/glossary#action-authority) — formal definition
- [AI Agent Action Control: Hard Limits on Side Effects](/blog/ai-agent-action-control-hard-limits-side-effects) — deep dive on the problem and solution
- [Action Authority Demo](/demos/) — a support agent where Cycles allows internal actions but blocks the customer email
- [Exposure](/concepts/exposure-why-rate-limits-leave-agents-unbounded) — the broader concept of unbounded agent risk
