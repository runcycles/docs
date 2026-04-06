---
title: "Cycles vs LiteLLM: Budget Authority vs Proxy Budgets"
description: "LiteLLM has team budgets and rate limits. Cycles adds atomic reservations, action authority, and delegation attenuation. See where each fits in your stack."
---

# Cycles vs LiteLLM: Budget Authority vs Proxy Budgets

LiteLLM is one of the most popular LLM proxy layers. It routes model calls across providers with automatic fallback, and as of 2025-2026 has added team budgets, per-key spend limits, and rate limiting. If you're already running LiteLLM, you might wonder whether you need Cycles at all.

The answer depends on what failure modes you're trying to prevent.

## What each does

| | LiteLLM | Cycles |
|---|---|---|
| **Primary role** | LLM proxy — routing, fallback, cost tracking | Runtime authority — pre-execution enforcement |
| **When it acts** | At the model-call layer | At the agent-action layer |
| **Budget model** | Per-key and per-team spend limits | Per-tenant, per-workflow, per-run, per-action scope hierarchy |
| **Enforcement** | Block when `max_budget` exceeded | Atomic reserve-commit — budget locked before action |
| **Rate limiting** | RPM, TPM per key/team/user | Not a rate limiter — enforces per-action authority |
| **Action control** | Model access lists (which models a key can call) | [RISK_POINTS](/glossary#risk-points) — per-tool risk scoring and limits |
| **Multi-tenant** | Team/user isolation via `team_id` | Tenant-scoped API keys with hierarchical budget derivation |
| **Concurrency safety** | Eventually consistent (~10 request drift at high traffic) | Atomic Lua-scripted reservations (zero drift) |

## Where LiteLLM's budgets work well

LiteLLM's budget features are genuinely useful:

- **`max_budget` per key** blocks requests when a key's cumulative spend exceeds the cap
- **`soft_budget`** triggers alerts before the hard cutoff, giving teams time to respond
- **`budget_duration`** auto-resets budgets on configurable intervals
- **Per-team budgets** aggregate spend across all keys in a team
- **Webhook alerts** fire on `budget_crossed`, `threshold_crossed`, and `projected_limit_exceeded`

For teams that need basic cost control at the LLM proxy layer, this covers the common case well.

## Where the gaps appear

### 1. Concurrency safety

LiteLLM tracks spend via an in-memory cache synced to Redis every ~10ms. Under high concurrency, budget enforcement is eventually consistent — their docs note approximately 10 requests of drift at 100 RPS across 3 instances.

For a single-agent prototype, this is fine. For 20 concurrent agents sharing a $5 budget, 10 requests of drift at $0.50 each means $5 of overspend — a 100% overrun on a $5 budget. This is the [TOCTOU race condition](/glossary#) that atomic reservation systems are designed to prevent.

Cycles uses atomic Lua-scripted reservations: the budget check and the decrement happen in a single Redis operation. Zero drift, regardless of concurrency.

### 2. Action-level control

LiteLLM controls which **models** a key can access. It cannot control what **actions** an agent takes with those models.

An agent that sends 200 emails costs $1.40 in tokens. LiteLLM's budget wouldn't fire — the cost is trivial. But the action is catastrophic. Cycles' [RISK_POINTS](/how-to/assigning-risk-points-to-agent-tools) budget scores tools by blast radius (email = 40 points, deploy = 150 points, search = 0), limiting *what* the agent does, not just *how much it spends*.

### 3. Scope hierarchy and delegation

LiteLLM's budget model is two levels: team → key. Cycles supports arbitrary scope depth: tenant → workspace → app → workflow → agent → toolset. Each level can have its own budget, and [authority attenuates](/blog/agent-delegation-chains-authority-attenuation-not-trust-propagation) at each delegation hop — a sub-agent always gets less authority than its parent.

This matters for multi-agent systems where a single user request fans out into dozens of sub-agent calls. LiteLLM sees each call as an independent model request. Cycles sees the delegation chain and enforces aggregate limits across it.

### 4. Reserve-commit lifecycle

LiteLLM tracks spend after the fact — the cost is recorded when the model response arrives. If the response is expensive (long output, many tokens), the budget is already spent before LiteLLM knows the cost.

Cycles [reserves budget before the action](/blog/what-is-runtime-authority-for-ai-agents), executes only if approved, and commits the actual cost after. The unused difference is released. This means the budget is never unknowingly exceeded — the worst case is that reserved-but-uncommitted budget temporarily reduces available capacity.

## When you need both

LiteLLM and Cycles solve different problems at different layers:

```
Request flow:
  Agent decides to act
    → Cycles: "Should this action happen?" (reserve-commit, RISK_POINTS)
    → LiteLLM: "Which model should handle this?" (routing, fallback)
    → Provider: Execute the call
    → LiteLLM: Record cost, check key budget
    → Cycles: Commit actual cost, release unused reservation
```

LiteLLM is the **routing and model-access layer**. Cycles is the **authority and enforcement layer**. You can run both — LiteLLM handles model selection and provider fallback, Cycles handles budget authority and action control.

## When LiteLLM alone is enough

- Single-tenant, single-agent prototype
- No concurrent agents sharing budgets
- No action-level risk (agent only reads, never writes/sends/deploys)
- Budget overruns of ~10 requests are acceptable
- No delegation chains or multi-agent systems

## When you need Cycles

- Multiple concurrent agents sharing a budget
- Agent tools with side effects (email, deploy, database mutation)
- Multi-tenant SaaS with per-customer budget isolation
- Multi-agent delegation chains requiring authority attenuation
- Zero-tolerance for budget overruns (financial, compliance)

## Related

- [Cycles vs LLM Proxies and Observability Tools](/blog/cycles-vs-llm-proxies-and-observability-tools) — broader comparison
- [What Is Runtime Authority](/blog/what-is-runtime-authority-for-ai-agents) — the enforcement model
- [How Teams Control AI Agents Today](/blog/how-teams-control-ai-agents-today-and-where-it-breaks) — why proxy-layer controls break
