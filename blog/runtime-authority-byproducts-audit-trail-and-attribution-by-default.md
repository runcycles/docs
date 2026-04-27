---
title: "The Audit Trail You Didn't Know You Were Building: Cycles as Evidence by Default"
date: 2026-04-27
author: Cycles Team
tags: [runtime-authority, governance, audit, finops, compliance, costs, agents, engineering]
description: "Runtime authority's hidden byproduct: a protocol-native audit trail and per-subject cost ledger for AI agents — EU AI Act and FinOps evidence by default."
blog: true
sidebar: false
featured: false
---

# The Audit Trail You Didn't Know You Were Building: Cycles as Evidence by Default

A platform-engineering lead got three questions in one week:

- The CFO: *"What does it cost to serve customer X this quarter?"*
- The auditor: *"Show me evidence that the agent's spending was authorized, with rationale and timestamp."*
- The data team: *"Why is our AI bill 6× engineering's? Can you break it down by team?"*

Three different buyers. Three different vocabularies. One underlying need: a record of every agent action — *who*, *what*, *when*, *how much*, and *with what authority*.

The lead's existing tools couldn't answer any of them cleanly. The provider invoice was one line. The APM trace had spans but no costs. The SIEM logged tool calls but not money. Each question would have meant a separate instrumentation project.

It turns out the data was already there. The team had deployed [Cycles](/quickstart/what-is-cycles) for runtime authority — to stop runaway spend and block risky actions before they execute. The byproduct of that enforcement is a complete, signed, idempotent ledger of every metered agent action. The lead had been sitting on the answer to all three questions for months.

This post is about that byproduct. What runtime authority *also* gives you when you turn it on, and why three different teams in your org each get something they've been struggling to build.

<!-- more -->

## What runtime authority actually persists

The Cycles protocol mediates every agent action through a four-step lifecycle: [decide → reserve → commit → release](/protocol/how-reserve-commit-works-in-cycles). The framing in the docs is a control story — *no action proceeds until the budget is locked, and we know exactly how much was used after.* That control story is the headline.

The bookkeeping story is the byproduct. Each lifecycle step persists a structured record:

| Step | What it records | Why it matters as evidence |
|---|---|---|
| `decide()` | subject (six-level hierarchy), action kind/name, estimate, decision (`ALLOW` / `ALLOW_WITH_CAPS` / `DENY`), `reason_code`, `affected_scopes`, `idempotency_key`, timestamp | Pre-action authorization with machine-readable rationale |
| `reserve` | actual lock against the budget, hold token, expiry | Authoritative "we said yes and here's what we held" |
| `commit` | actual cost (separate from estimate), final balance impact, lifecycle close | Authoritative "this is what was used" |
| `release` / `expired-reservation` | unused portion returned to the budget | Authoritative "this is what was given back" |

The [subject hierarchy](/protocol/how-scope-derivation-works-in-cycles) on every record is `tenant → workspace → app → workflow → agent → toolset`. Every entry in the ledger carries all six levels. That means cost attribution is *structural* — you don't infer "this run belonged to customer X" from a SQL join across log streams. The customer is a field on the record.

What you have, after running with Cycles in production for a quarter, is a multi-million-row ledger with fields that look like rows in a financial system: *who*, *what*, *when*, *how much committed against estimate*, *which authority granted it*. That's the data exhaust. We argue it's also the deliverable.

## Buyer #1: Risk and Compliance

Regulators have caught up to the AI agent surface. The [EU AI Act's Article 12](/blog/ai-agent-governance-framework-nist-eu-ai-act-iso-42001-owasp-runtime-enforcement) requires high-risk AI systems to maintain logs of decisions and rationale, with a defined retention period and the ability to produce them on request. SOC 2 Type II auditors increasingly add agentic systems to scope and ask for evidence of *control* — not just observation. ISO 42001 builds the same logging obligations into AI management system certification.

The standard pattern for satisfying these is to bolt on an audit logger after the fact: pick fields, write to a separate store, hope the schema covers what an auditor will ask for. The pattern is fragile because it's *secondary* — the auditor and the engineer disagree on what's worth logging, and engineering wins by default.

Cycles flips that. The decide-commit pair is the enforcement layer *and* the audit log. Every record carries:

- The subject (six-level hierarchy, complete attribution)
- The decision and the `reason_code` (machine-readable rationale)
- The idempotency key (proof of exactly-once handling on retries)
- The timestamp and the actor

When an auditor asks *"can you show me an action that was attempted but blocked, with reason and authority?"* the answer is a query against the ledger. When they ask *"how do you prove this record wasn't fabricated after the fact?"* the answer is the [HMAC-SHA256-signed webhook delivery](/blog/webhook-idempotency-patterns-for-ai-agent-budget-events) that wrote it to the customer's audit store at event time, with a unique `X-Cycles-Event-Id` for deduplication.

The companion post — [The AI Agent Governance Framework](/blog/ai-agent-governance-framework-nist-eu-ai-act-iso-42001-owasp-runtime-enforcement) — maps specific regulatory clauses to runtime enforcement controls. This post is the inverse: it explains why the protocol *already* produces the evidence those clauses ask for, before anyone tells you the regulator is asking.

## Buyer #2: Finance and FP&A

The CFO's question — *what does it cost to serve customer X?* — is a unit-economics question. It's the question that any company building AI features into a product with a revenue model has to answer eventually, and most can't.

The reason most can't is that the cost data lives in three places: the LLM provider invoice (one line), the application logs (per-request token counts that nobody aggregates by customer), and the cloud bill (compute and storage, customer-agnostic). To get cost-per-customer you have to stitch.

Cycles' subject hierarchy collapses the stitch. Every commit is already tagged with the customer (`tenant`), the feature (`app`), the workflow, and the agent. Aggregating by `tenant` gives cost-per-customer. Aggregating by `app` gives cost-per-feature. Aggregating by `workflow` gives cost-per-conversation. The math is `SELECT SUM(committed) GROUP BY ...`.

The deep dive on cost-per-conversation, cost-per-user, cohort margin, and the full unit-economics picture is in [AI Agent Unit Economics: Cost and Margin Analysis](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin). Read that for the math.

What that post doesn't lead with is **forecasting**. Once you have a quarter of structured commit data, the trajectory is computable. Token velocity per workflow, peak vs average, the slope of the spend curve as a feature scales — these are the inputs to next-quarter financial planning. They're also the data you bring into a board meeting when an investor asks about COGS for the AI feature: not a slide that says "estimated $X per seat," but a chart with actuals and a credibility-bearing forecast.

The before-and-after for a finance team:

| Question | Without per-action ledger | With Cycles ledger |
|---|---|---|
| What did customer X cost? | Estimate from logs + heuristic | `GROUP BY tenant` on commit data |
| What's the margin on Feature Y? | "Hard to say" | Cost subtracted from feature revenue |
| What's the run-rate trajectory? | Provider invoice + spreadsheet | Live aggregation against committed data |
| Which 5 customers drive 50% of spend? | Quarter-end exercise | Standing query |

None of this requires Cycles to be a billing engine or a financial data warehouse. It just has to be the *source of truth* the warehouse pulls from.

## Buyer #3: Platform Engineering — chargeback and showback

The third buyer is closer to home. Every platform team running AI infrastructure inside a larger company is being asked the same question with increasing pointedness: *which team is burning the AI budget?*

Today the answer is usually some version of *"I don't know — the OpenAI bill is one number."* That answer was acceptable when the AI bill was a footnote on the cloud spend. It stops being acceptable when the AI line passes the database line, which is happening.

Cycles' subject hierarchy gives platform teams a clean answer: workspace and app levels are the natural mapping for organizational structure. A `workspace` corresponds to a team, an `app` corresponds to a service or product surface, and the `tenant` corresponds to the company or environment. Issuing API keys per workspace gives the platform team a metered surface that maps cleanly to cost centers.

Querying [GET /v1/balances](/protocol/how-scope-derivation-works-in-cycles) on a tenant returns balances at every scope underneath:

```json
{
  "tenant": "acme",
  "workspace_balances": {
    "data-team":         { "spent": 184_320, "remaining":  15_680 },
    "engineering":       { "spent":  41_200, "remaining": 158_800 },
    "product-research":  { "spent":  72_500, "remaining":  27_500 }
  }
}
```

The data team's question — *why is our AI bill 6× engineering's?* — answers itself. The chargeback report becomes a standing query, not a quarter-end fire drill.

A side benefit worth flagging: this kills shadow AI spend. Engineers can't quietly move workloads off the metered surface unless they leave Cycles entirely, and leaving Cycles costs them the runtime authority that's stopping the runaway loops they've already been bitten by. The metering is sticky because the enforcement is valuable — different from observability tools, which tend to atrophy because nobody's blocked when they're missing.

## What makes this a ledger, not a log

A reasonable objection: every observability tool produces records. Why call this a ledger?

The distinction matters. A *log* is an append-only stream optimized for debugging — high-cardinality, tolerant of duplicates and gaps, generally not signed. A *ledger* is a record system you can settle accounts against — idempotent, signed, with provenance per record.

Cycles' record stream satisfies the ledger criteria, by protocol design:

- **Idempotency keys are required**, not optional, on `decide`, `reserve`, `commit`, and `events` operations. The [glossary entry](/glossary#idempotency-key) makes this explicit: *"an idempotency_key ensures a protocol operation is processed exactly once, even if the request is retried due to network failures or timeouts."* Retries don't double-charge.
- **Webhook deliveries are HMAC-SHA256 signed** with a unique `X-Cycles-Event-Id` per event, delivered with at-least-once semantics. Subscribers dedupe by event ID and verify the signature; the protocol guarantees they can detect tampering and replay.
- **Events carry W3C trace context** (`traceparent` / `X-Cycles-Trace-Id`), which means cross-system correlation — the ledger entry, the application trace, and the LLM provider span can be tied together by ID, not by timestamp guesswork.

That's the difference between a Datadog APM trace (a log of what happened) and a row in a financial system (a record you can audit, settle, and certify). For deeper coverage of the webhook-delivery side, see [Webhook Idempotency Patterns for AI Agent Budget Events](/blog/webhook-idempotency-patterns-for-ai-agent-budget-events).

Honest scoping: Cycles is not a billing engine, not a SIEM, and not a FinOps platform. It's the *source of truth* that all three plug into. Datadog, Honeycomb, CloudZero, Splunk, and the various LLMOps platforms each cover slices of the larger story. Cycles produces the data they assume someone else generates.

## What this post does not yet claim

Some byproducts are real but require additional integration work, and we don't want to overclaim:

- **Pricing-model enablement.** Usage-based pricing, credit wallets, and tiered plans need a billing engine downstream. Cycles produces the metering input that Stripe/Lago/Orb consume; we don't produce invoices.
- **Carbon and ESG reporting.** Token counts feed carbon estimates well, but Cycles doesn't ship the carbon-coefficient mapping. The plumbing is there; the partnership work isn't.
- **VC and acquisition due diligence.** The data exists in the ledger; turning it into a board deck or an acquisition data room is on you. We're not in the analyst-services business.

These are roadmap pointers and partner-integration territory, not features being claimed today.

## Why this matters more than it sounds

Most AI infrastructure layers solve one buyer's problem. Observability platforms serve operations. The OpenAI dashboard serves engineers. A separate audit log serves compliance — usually built reactively after a question is asked.

The Cycles ledger is unusual because the same record system answers all three buyers. Risk and compliance get the decide-with-rationale + signed delivery. Finance gets per-subject cost attribution. Platform engineering gets workspace-level chargeback. The reason it works is that each of those buyers is asking the same underlying question — *"who took which action with what authority and at what cost"* — phrased in three different professional vocabularies.

You build the enforcement layer because runaway spend and risky actions are real and acute. You get the ledger because the act of enforcing produces records that, by protocol design, are structured the way an auditor, a CFO, and a platform engineer all need them.

The circuit-breaker framing is the front door. The ledger is the back office that keeps the company running.

## Related reading

- [AI Agent Unit Economics: Cost and Margin Analysis](/blog/ai-agent-unit-economics-cost-per-conversation-per-user-margin) — cost per conversation, per user, per cohort; margin analysis using Cycles' subject hierarchy
- [The AI Agent Governance Framework](/blog/ai-agent-governance-framework-nist-eu-ai-act-iso-42001-owasp-runtime-enforcement) — mapping NIST, EU AI Act, ISO 42001, and OWASP requirements to runtime enforcement controls
- [Webhook Idempotency Patterns for AI Agent Budget Events](/blog/webhook-idempotency-patterns-for-ai-agent-budget-events) — exactly-once webhook delivery patterns
- [Operational Runbook: Using Cycles Runtime Events](/blog/operational-runbook-using-cycles-runtime-events) — turning the same event stream into PagerDuty / Slack / auto-remediation signal
- [Where Did My Tokens Go? Debugging Agent Spend](/blog/where-did-my-tokens-go-debugging-agent-spend) — observability companion for the cost-attribution flow
- [How decide() works in Cycles](/protocol/how-decide-works-in-cycles-preflight-budget-checks-without-reservation) — preflight budget checks and the decision API
- [How scope derivation works in Cycles](/protocol/how-scope-derivation-works-in-cycles) — the six-level subject hierarchy and how it's resolved
