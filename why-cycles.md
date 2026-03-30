---
title: "Why Cycles"
description: "For B2B SaaS teams shipping AI agents to customers — blast radius containment, auditable event trails, and bounded unit economics per tenant."
---

# Why Cycles

If you're a B2B SaaS team shipping AI agents to customers — support copilots, coding assistants, document processors, workflow automations — Cycles is the [runtime authority](/blog/what-is-runtime-authority-for-ai-agents) layer that enforces hard limits on spend and actions before every LLM call, tool invocation, and side effect. Per-tenant, per-workflow, per-run. So one customer's runaway agent never blows through another customer's budget, and your feature margin stays predictable.

## What Cycles solves

**Protect margin.** Agent costs follow a heavy-tail distribution — the top 10% of users consume [72% of total spend](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin). Without per-user budget caps, a feature priced for 80% gross margin [delivers 23%](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin). Cycles bounds the tail so unit economics stay predictable.

**Contain cross-tenant blast radius.** A single runaway agent can burn [$4,200 in three hours](/blog/ai-agent-failures-budget-controls-prevent). Cycles enforces hierarchical budgets — tenant, workspace, workflow, run — so one customer's bad agent cannot starve the platform or another customer's allocation.

**Audit every action.** Every reservation, commit, and event creates a structured record with full scope context. Queryable via API, 90-day hot retention, exportable to cold storage. No log reconstruction required — the budget ledger is the audit trail. [Details →](/security)

**Gate high-consequence actions.** A support agent [sent 200 collections emails instead of welcome emails](/blog/ai-agent-action-control-hard-limits-side-effects). Total model spend: $1.40. Business impact: $50K+ in lost pipeline. No spending limit would have caught it. Cycles supports [RISK_POINTS](/concepts/action-authority-controlling-what-agents-do) — budgets denominated in blast radius, not dollars — so agents can read and reason freely while dangerous capabilities (email, deploy, delete) are gated separately.

---

## By role

<details>
<summary><strong>CTO / VP Engineering — Contain blast radius, protect margins</strong></summary>

Every agent action passes through a reserve-commit gate. Before an LLM call executes, Cycles atomically checks the budget and locks the estimated cost. If the budget is exhausted, the call is denied and the agent degrades gracefully — cheaper model, shorter response, or explicit stop.

Without this gate, a single runaway agent can burn **$4,200 in three hours** — a coding agent hit an ambiguous error, retried with expanding context windows, and [looped 240 times before anyone noticed](/blog/ai-agent-failures-budget-controls-prevent). With a $15 per-run budget in Cycles, the same agent stops after 8 iterations and surfaces the problem immediately.

Blast radius is bounded at every level: per-run, per-workflow, per-tenant. One bad agent cannot starve the platform. Budgets are hierarchical — tenant, workspace, app, workflow, agent — so you set ceilings at the level that matches your architecture.

The margin impact is direct. In one [unit economics analysis](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin), a team pricing an AI feature at $15/user/month saw costs hit $11.50/user — a 23% margin against an 80% target. Per-user caps restore it to 68%.

Cost is the first dimension. [Action authority](/concepts/action-authority-controlling-what-agents-do) is the second — gating what agents do, not just what they spend, via risk-point budgets per toolset.

[Why rate limits are not enough →](/concepts/why-rate-limits-are-not-enough-for-autonomous-systems)

</details>

<details>
<summary><strong>Security / Compliance — Every action is auditable</strong></summary>

Every reservation, commit, release, and event in Cycles creates a structured, queryable record. Each record includes: full scope hierarchy (tenant, workspace, app, workflow, agent, toolset), amounts reserved and committed, timestamp, status, and arbitrary metadata.

This means every budget operation — every reservation, commit, release, and event — is logged with the context needed for audit. You can answer "which agent spent how much, on what, and when" from the event log alone, without reconstructing it from scattered application logs.

The event log is queryable via the REST API. Retention is 90 days in hot storage (Redis), with export to cold storage (S3, GCS) for long-term compliance. The admin server records audit logs for all administrative operations — API key creation, tenant changes, budget modifications.

Access control separates the runtime plane (port 7878, scoped API keys with least-privilege permissions) from the management plane (port 7979, admin-only, never exposed to the public internet). API keys support rotation, revocation, and per-permission scoping.

Self-hosted deployments keep all data in your infrastructure — nothing leaves your network. SOC 2 Type I is in progress for the managed cloud offering.

[Security overview →](/security) · [Event log API →](/protocol/how-events-work-in-cycles-direct-debit-without-reservation) · [Security hardening →](/how-to/security-hardening)

</details>

<details>
<summary><strong>Finance — From unpredictable spend to bounded unit economics</strong></summary>

In one [real deployment](/blog/how-much-do-ai-agents-cost), a team estimated $800/month for a customer support agent based on prototype traffic. The first production invoice was $4,200. The per-token pricing was exactly right — the call volume was not. Agents averaged 11 LLM calls per conversation instead of the 3 assumed in the estimate. Retries doubled call counts on bad days.

This is the norm. In a [unit economics analysis](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin) of an AI copilot feature, the top 10% of users consumed 72% of total spend. One user triggered 340 conversations in a month and cost $310 alone — wiping out the margin from 50+ light users.

Cycles bounds this tail. In the same analysis, a $15/month per-user cap turned a 23% gross margin into 68%, with only 5% of users ever hitting the limit. A $15 per-run cap prevents the [$4,200 tool loop](/blog/ai-agent-failures-budget-controls-prevent) entirely — the agent stops at $15 and surfaces the problem for human review.

Budget enforcement is not a cost center. It is the mechanism that makes AI feature unit economics predictable.

</details>

---

## Get started

- [What is Cycles?](/quickstart/what-is-cycles) — 5-minute overview
- [End-to-End Tutorial](/quickstart/end-to-end-tutorial) — from zero to working enforcement in 30 minutes
- [5 Failures Budget Controls Would Prevent](/blog/ai-agent-failures-budget-controls-prevent) — cost incidents, with dollar math
- [5 Failures Only Action Controls Would Prevent](/blog/ai-agent-action-failures-runtime-authority-prevents) — action incidents, where the spend was negligible
