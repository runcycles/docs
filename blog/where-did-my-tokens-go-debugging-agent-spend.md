---
title: "Where Did My Tokens Go? Debugging Agent Spend at Production Scale"
date: 2026-04-19
author: Albert Mavashev
tags: [engineering, debugging, observability, agents, cost-attribution, runtime-authority]
description: "The bill tripled, agents look fine, proxy dashboard shows only totals. Debug agent spend with scope paths, event streams, correlation IDs — the five events that answer why LLM token cost spiked."
blog: true
sidebar: false
featured: false
head:
  - - meta
    - name: keywords
      content: "agent cost debugging, llm token attribution, which tool call cost most, why is my agent using so many tokens, debugging ai agent spend, budget.debited event stream, cycles scope path, agent observability debugging, ai agent cost breakdown, per-agent cost attribution"
---

# Where Did My Tokens Go? Debugging Agent Spend at Production Scale

The bill just tripled. Your agents aren't doing anything new. You open the LLM proxy dashboard and see the total — yes, token usage is up — but the dashboard only shows you *how much*, not *who, where, or why*. An engineer sitting in front of that dashboard at 9am on a Tuesday has maybe thirty minutes to figure out which tool call cost the most before finance escalates.

This is LLM token attribution at production scale — debugging AI agent spend when the proxy can't tell you *which agent, which workflow, which tool call* drove the spike. This post is about the data model you actually need to answer the question. Not which observability tool to buy — which **fields on which events** let you drill from "total spend tripled" down to "this workflow, this agent, this tool call, this API key, this correlation ID." The answer in Cycles is three primitives: **scope path, event stream, correlation ID.** Everything else is filtering.

<!-- more -->

## Why LLM-proxy observability stops short

Proxy tools (LiteLLM, Helicone, OpenRouter, Langfuse) sit between your code and the model provider. They see *every request*, so they can tell you totals, per-model breakdowns, per-API-key breakdowns. That's genuinely useful for a single-agent app.

It stops being useful the moment your system has any of:

- Multiple agents that share an API key (now the proxy lumps them together)
- A single agent that runs in multiple workflows (which workflow spiked?)
- Tool calls that chain (the expensive tool is N layers deep)
- Multi-tenant architecture (which customer's agent?)
- Background vs. interactive work on the same key (which drove the spike?)

The proxy's attribution ceiling is **whatever the caller labels the request with.** If your code sends `user: "alice"` in the OpenAI request, you can filter to Alice. If it doesn't, you can't. And most agent frameworks don't inject hierarchical labels — they call the model provider directly, the proxy sees a raw LLM request, and the tree of "which part of my system caused this" is lost by the time the proxy reports it.

That's not a tool problem. That's a **data-model problem**. The tree has to be captured at enforcement time, not reconstructed after the fact.

## The three primitives Cycles uses

Every `reserve` and `commit` in Cycles — and every event that drops out — carries three structural attribution fields:

**`scope` (a path).** Not a flat label. A path like `tenant:acme-corp/workspace:prod/app:support-bot/workflow:handoff/agent:planner/toolset:web-search`. Six levels deep is the current shape; the depth is a design choice that makes prefix queries cheap. You filter at any depth: "everything under `tenant:acme-corp/workspace:prod`" or "just this one agent instance."

**`actor` (the principal).** Type, key ID, source IP. This is who/what initiated the action at the API boundary — an API key, a service account, a system process. Two agents sharing a budget scope still have distinct actors, so "who spent the money" is separable from "whose budget paid for it."

**`correlation_id` and `request_id`.** The trace primitives. Every Cycles call echoes these back and stamps them on every event. If your agent framework threads them through to the LLM request — or if you log them next to the LLM call — you can pivot from "this event shows a 5000-token commit" to "this exact request in your code" in one hop.

These three fields are what make the event stream navigable — a structural commitment that *everything* that affects spend carries enough metadata to find its origin.

## The five events that answer "why is my agent using so many tokens"

Cycles emits [41 event types](/protocol/webhook-event-delivery-protocol); this post is about the five that do real debugging work when the bill surprises you.

### 1. `budget.debited` — the ground truth

This fires on every commit. The payload's `data.scope`, `data.spent`, `data.remaining`, combined with the top-level `actor` and `correlation_id`, is the raw material:

```json
{
  "event_id": "evt_a1b2...",
  "event_type": "budget.debited",
  "timestamp": "2026-04-19T14:02:11Z",
  "tenant_id": "acme-corp",
  "scope": "tenant:acme-corp/workspace:prod/agent:support-bot",
  "actor": {"type": "api_key", "key_id": "key_abc123"},
  "data": {
    "ledger_id": "led_xyz",
    "scope": "tenant:acme-corp/workspace:prod/agent:support-bot",
    "unit": "TOKENS",
    "allocated": 1000000,
    "remaining": 420000,
    "spent": 580000
  },
  "correlation_id": "req_0af3",
  "request_id": "req_0af3"
}
```

Stream this to any SIEM / warehouse / webhook endpoint and you can answer: "group all commits for the last 24 hours by `scope` prefix, sort by sum of debit amount descending." The noisy scope floats to the top. That *is* the debugging answer — no ML, no heuristics, just `GROUP BY scope`.

### 2. `reservation.commit_overage` — the estimator is wrong

This fires when the actual commit exceeded the reserved estimate. The payload carries `estimated_amount`, `actual_amount`, `overage`, and the overage policy that decided what to do about it:

```json
{
  "event_type": "reservation.commit_overage",
  "data": {
    "reservation_id": "res_xyz",
    "scope": "tenant:acme-corp/workspace:prod/agent:planner",
    "unit": "TOKENS",
    "estimated_amount": 500,
    "actual_amount": 3200,
    "overage": 2700,
    "overage_policy": "ALLOW_IF_AVAILABLE",
    "debt_incurred": 0
  }
}
```

If this event fires frequently for one scope, the estimator there is wrong — which is a *specific*, actionable finding covered at length in [estimate drift: the silent killer of enforcement](/blog/estimate-drift-silent-killer-of-enforcement). The debugging move is to correlate the overage scope with a spend spike on the same scope in `budget.debited`; if they match, you've found the leak.

### 3. `reservation.expired` — reserved but never used

A reservation that expired means the agent reserved budget, then never committed. Either the agent crashed, timed out, or the framework lost track. The payload shows what was held and for how long:

```json
{
  "event_type": "reservation.expired",
  "data": {
    "reservation_id": "res_abc",
    "scope": "tenant:acme-corp/workspace:prod/agent:web-crawler",
    "unit": "TOKENS",
    "estimated_amount": 10000,
    "created_at": "2026-04-19T13:58:02Z",
    "expired_at": "2026-04-19T13:59:02Z",
    "ttl_ms": 60000,
    "extensions_used": 0
  }
}
```

A healthy system produces a trickle of these (a client crash, a timeout). A flood of them means a specific scope has broken commit-path plumbing — reservations are being made but the commit call never lands. That reservation-to-commit ratio is the signal. Most LLM proxies can't show it at all, because they only see completed requests.

### 4. `budget.burn_rate_anomaly` — the spike detector

Cycles tracks the trailing burn rate per budget and fires this event when the rate exceeds a baseline multiplier within a configured window. It's the "wake up at 3am" event: something is spending faster than it was yesterday, in a way that's not explainable by normal traffic. Combined with `budget.debited` timestamps, it narrows *when* the spike started. Combined with `actor.key_id` on events in that window, it narrows *which principal is driving it.*

### 5. `reservation.denial_rate_spike` — the inverse signal

A denial-rate spike means more reservations are failing than usual. On its own that's a *reduction* in spend. But it's a debugging primitive because it localises broken clients: if `scope X` starts seeing denied reservations at 10× the normal rate, either the budget is wrong for the workload or the estimator on that scope produces numbers too large to reserve. When denial rate and spend both spike on related scopes, suspect a retry loop committing under a different scope.

## The four debugging moves that use all three primitives

Concretely — what do you actually type to pivot from "bill is 3×" to "root cause"?

**Move 1: Top-N by scope.** Stream `budget.debited` for the window; group by `data.scope`; sort by sum of `data.spent` delta. The top scope prefix is the first candidate. If the top scope is a tenant you didn't expect to spike, the investigation is now "what changed for that tenant." If it's a workflow, drill to agents inside it.

**Move 2: Actor decomposition within a scope.** Once you've narrowed to a scope, stream events filtered by `scope`; group by `actor.key_id`. This tells you *who* is spending on that scope. Shared budget with distinct actors is the most common multi-agent pattern, and the actor field is what un-shares it.

**Move 3: Overage-to-commit correlation.** If `reservation.commit_overage` count is up for the suspect scope, the estimator is leaking. This is a different root cause than "traffic genuinely increased" — the fix is estimator recalibration, not capacity planning.

**Move 4: Correlation ID trace.** Pick one expensive commit; grab the `correlation_id`; grep your application logs. You now have the exact function call, prompt, tool invocation. This is the step that closes the loop — event attribution tells you *where*, but `correlation_id` is what tells you *what code* ran.

Without step 4, the first three moves tell you where to look but not what to fix. With step 4, you end with a diff in a specific file.

## What the admin dashboard does on top of this

The [Cycles admin dashboard](/quickstart/deploying-the-cycles-dashboard) is a UI over the same event stream and scope-tree APIs. It doesn't see anything the event stream doesn't see. What it adds is the filter/group/sort operations prebuilt — "show me spend by scope for the last 24 hours" is a page, not a query you write. For a one-off incident at 9am, that matters. The stream is authoritative; the dashboard is fast.

The reason to publish the event stream as the primary interface — not the dashboard — is that every team eventually wants to pipe these events into their own SIEM, data warehouse, or oncall system. If the dashboard is the only view, that integration is a scraping project. If the stream is, it's a webhook subscription.

## The non-goal: cost *prediction*

This post is deliberately about *attribution*, not prediction. "Will this change cost more next month" is a different problem — you need historical spend trends, traffic forecasts, and model-pricing assumptions. The attribution story ends at "here's what happened and why"; it's the input to the prediction story, not a substitute for it.

That distinction matters because **you cannot attribute spend you didn't structurally capture.** A dashboard over unstructured logs cannot produce a scope-tree decomposition no matter how good the UI is.

## Bottom line

When the bill surprises you, the question you're asking is structural: which part of the system produced this spend, who initiated it, and what code ran? The answer needs three fields captured at the moment of authority — scope path, actor, correlation ID — on every event the system emits. Cycles captures those. The five events above turn them into concrete debugging moves: top-N by scope, actor decomposition, overage correlation, correlation-ID trace.

The observability tools that only see totals aren't wrong. They're answering a different question. Attribution is a data-model commitment you make upstream, not a chart you add downstream.

---

*Related reading: [estimate drift: the silent killer of enforcement](/blog/estimate-drift-silent-killer-of-enforcement) for the `commit_overage` deep-dive, [webhook event delivery protocol](/protocol/webhook-event-delivery-protocol) for the full event reference, [real-time budget alerts for AI agents](/blog/real-time-budget-alerts-for-ai-agents) for the alerting side of the same stream.*
