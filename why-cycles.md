---
title: "Why Cycles"
description: "Why CTOs, security teams, and finance leaders choose Cycles for runtime budget authority over autonomous AI agents."
---

# Why Cycles

Cycles is the runtime authority layer for autonomous agents. It makes a deterministic allow/deny decision before every LLM call, tool invocation, or side effect — so agents cannot spend more than you authorize.

<details>
<summary><strong>CTO / VP Engineering — Contain blast radius, protect margins</strong></summary>

Every agent action passes through a reserve-commit gate. Before an LLM call executes, Cycles atomically checks the budget and locks the estimated cost. If the budget is exhausted, the call is denied and the agent degrades gracefully — cheaper model, shorter response, or explicit stop.

Without this gate, a single runaway agent can burn **$4,200 in three hours**. A coding agent hit an ambiguous error, retried with expanding context windows, and looped 240 times before anyone noticed. With a $15 per-run budget in Cycles, the same agent stops after 8 iterations and surfaces the problem immediately.

Blast radius is bounded at every level: per-run, per-workflow, per-tenant. One bad agent cannot starve the platform. Budgets are hierarchical — tenant, workspace, app, workflow, agent — so you set ceilings at the level that matches your architecture.

The margin impact is direct. Teams pricing AI features at $15/user/month see actual costs balloon to $11.50/user without enforcement — a 23% gross margin against an 80% target. With per-user budget caps, the same feature runs at 68% margin. The enforcement layer is what makes unit economics predictable.

[Why rate limits are not enough →](/concepts/why-rate-limits-are-not-enough-for-autonomous-systems)

</details>

<details>
<summary><strong>Security / Compliance — Every action is auditable</strong></summary>

Every reservation, commit, release, and event in Cycles creates a structured, queryable record. Each record includes: tenant ID, full scope hierarchy (workspace, app, workflow, agent), amount reserved, amount committed, timestamp, status, and arbitrary metadata.

This means every budget decision — every allow and every deny — is logged with the context needed for audit. You can answer "which agent spent how much, on what, and when" from the event log alone, without reconstructing it from scattered application logs.

The event log is queryable via the REST API. Retention is 90 days in hot storage (Redis), with export to cold storage (S3, GCS) for long-term compliance. The admin server records audit logs for all administrative operations — API key creation, tenant changes, budget modifications.

Access control separates the runtime plane (port 7878, scoped API keys with least-privilege permissions) from the management plane (port 7979, admin-only, never exposed to the public internet). API keys support rotation, revocation, and per-permission scoping.

Self-hosted deployments keep all data in your infrastructure — nothing leaves your network. SOC 2 Type I is in progress for the managed cloud offering.

[Event log API →](/protocol/how-events-work-in-cycles-direct-debit-without-reservation) · [Security hardening →](/how-to/security-hardening)

</details>

<details>
<summary><strong>Finance — From unpredictable spend to bounded unit economics</strong></summary>

A team estimated $800/month for a customer support agent based on prototype traffic. The first production invoice was $4,200. The per-token pricing was exactly right — the call volume was not. Agents averaged 11 LLM calls per conversation instead of the 3 assumed in the estimate. Retries doubled call counts on bad days. Context windows grew with each turn.

This is the norm, not the exception. Without pre-execution enforcement, agent costs follow a heavy-tail distribution where the top 10% of users consume 72% of spend. One user triggered 340 conversations in a month and cost $310 alone — wiping out the margin from 50+ light users.

Cycles bounds this tail. A $15/month per-user cap turns a 23% gross margin feature into a 68% gross margin feature, with only 5% of users ever hitting the limit. A $15 per-run cap prevents the $4,200 tool loop entirely — the agent stops at $15 and surfaces the problem for human review instead of silently burning budget.

Budget enforcement is not a cost center. It is the mechanism that makes AI feature unit economics predictable and protectable.

[The $800→$4,200 story →](/blog/how-much-do-ai-agents-cost) · [Unit economics analysis →](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin)

</details>

---

## Get started

- [What is Cycles?](/quickstart/what-is-cycles) — 5-minute overview
- [End-to-End Tutorial](/quickstart/end-to-end-tutorial) — from zero to working enforcement in 30 minutes
- [5 Failures Budget Controls Would Prevent](/blog/ai-agent-failures-budget-controls-prevent) — the incidents, with dollar math
