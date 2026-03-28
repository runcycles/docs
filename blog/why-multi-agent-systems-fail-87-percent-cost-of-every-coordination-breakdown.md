---
title: "Multi-Agent Systems Fail Up to 87% of the Time — Here's What Each Failure Actually Costs"
date: 2026-03-28
author: Cycles Team
tags: [multi-agent, failures, cost, coordination, production, MAST, runtime-authority, engineering]
description: "UC Berkeley's MAST taxonomy found 14 failure modes across 1,600+ multi-agent traces with 41–87% failure rates. Nobody measured what each failure costs. We did the math."
blog: true
sidebar: false
---

# Multi-Agent Systems Fail Up to 87% of the Time — Here's What Each Failure Actually Costs

A team deploys a four-agent research pipeline: Planner, Researcher, Analyst, Writer. In development, it works 90% of the time and costs $3.50 per run. In production, failure rate climbs to 55%. Each failure triggers retries, context regrowth, and cascading delegation — turning a $3.50 run into a $40+ recovery sequence. The monitoring dashboard shows 200 OK on every API call. The invoice shows $12,000 for a week that should have cost $2,800.

Nobody tracks the cost of failures that look like successes.

<!-- more -->

That's the gap between failure *rate* research and failure *cost* research. UC Berkeley's [MAST taxonomy](https://arxiv.org/abs/2503.13657) — the first systematic study of multi-agent LLM failures — analyzed 1,600+ execution traces across seven frameworks and found failure rates ranging from 41% to 86.7%. The taxonomy identifies 14 distinct failure modes in three categories. It tells you *how* multi-agent systems break. It doesn't tell you what each break costs.

This post fills that gap. We map each MAST failure category to its cost signature — the specific mechanism by which a coordination breakdown becomes a line item on your invoice — and show where runtime authority prevents the cost from compounding.

## The Numbers: 14 Failure Modes, Three Categories, 41–87% Failure Rates

The [MAST study](https://sky.cs.berkeley.edu/project/mast/) (Cemri et al., NeurIPS 2025 Spotlight) analyzed traces from MetaGPT, ChatDev, HyperAgent, OpenManus, AppWorld, Magentic-One, and AG2. The failures clustered into three categories:

| Category | Share of Failures | Example Modes |
|---|---|---|
| **Inter-agent misalignment** | 36.9% | Wrong assumptions propagated, conversation resets, lost handoff context |
| **Task verification failures** | 29.4% | Agent marks task complete when it isn't, skips validation, accepts wrong output |
| **System design issues** | 33.7% | Role overlap, missing escalation paths, scope ambiguity, tool misassignment |

The failure rates varied by framework — from 41% (best) to 86.7% (worst) — but every framework exhibited all three categories. Better models helped: GPT-4 reduced failures compared to CodeLlama. But even with the strongest model, failure rates remained above 40%. The paper's key insight: **better system design improved outcomes more than better models** — up to 15.6% improvement from architectural changes alone.

A [follow-up study (SEMAP)](https://arxiv.org/html/2510.12120) using protocol-driven agent engineering demonstrated up to 69.6% reduction in failures by enforcing structured communication protocols between agents. The problem isn't the models. It's what happens between them.

## What Each Failure Category Actually Costs

None of the failure taxonomy research measures cost. They measure success/failure as a binary. But in production, failure isn't binary — it's a spectrum from "slightly wrong output" to "$47,000 recursive loop." The cost depends on what the system does *after* the failure occurs.

Here's the cost model for each category:

### Category 1: Inter-Agent Misalignment (36.9% of failures)

**What happens:** Agent A passes context to Agent B. Agent B misinterprets it, proceeds with wrong assumptions, and produces output that Agent C builds on. The error propagates through the chain. By the time it surfaces — if it surfaces at all — three agents have consumed tokens based on a wrong premise.

**Cost signature: Token multiplication through error propagation.**

[Google DeepMind research](https://arxiv.org/abs/2406.04692) measured 17× error amplification in multi-agent delegation chains. A single misaligned handoff doesn't just waste one agent's compute — it poisons every downstream agent's work.

| Agents in chain | Expected cost | Cost with one misaligned handoff | Multiplier |
|---|---|---|---|
| 2 | $1.20 | $3.60 | 3× |
| 3 | $2.80 | $11.20 | 4× |
| 4 | $4.50 | $31.50 | 7× |
| 5+ | $7.00 | $49.00+ | 7–17× |

The multiplier is non-linear because each downstream agent receives a *longer* context (the original plus the wrong output), making every subsequent call more expensive. And when the final output is wrong, the entire chain retries — doubling the cost again.

**Real-world example:** A coding pipeline where a Planner agent decomposes a task incorrectly. The Coder agent writes code for the wrong decomposition. The Reviewer agent flags failures. The system retries the entire chain. Three full passes before succeeding: 3× the expected cost, with the third pass carrying the accumulated context of the first two.

### Category 2: Task Verification Failures (29.4% of failures)

**What happens:** An agent declares a task complete when it isn't. The system moves forward. Downstream agents build on an incomplete foundation. The error is discovered late — by a human, a test suite, or never.

**Cost signature: Wasted work plus late-stage rework.**

This is the failure mode behind the [$47,000 recursive agent loop](https://earezki.com/ai-news/2026-03-23-the-ai-agent-that-cost-47000-while-everyone-thought-it-was-working/) that ran for 11 days. Two agents passed each other outputs that both considered "complete." Neither verified. The monitoring stack showed 200 OK on every call. The spend accumulated silently because the system had no mechanism to ask: "Is this work unit actually done?"

| Verification failure type | Typical cost impact | Detection latency |
|---|---|---|
| Premature completion (agent skips steps) | 2–3× (rework) | Hours to days |
| False positive validation (agent says "pass" on wrong output) | 4–8× (cascade + rework) | Days to weeks |
| Recursive non-convergence (agents loop without progress) | 10–100× (unbounded) | Until budget exhausted |

The [LangChain State of AI Agents report](https://www.langchain.com/state-of-agent-engineering) found that quality is the #1 barrier to production for 32% of respondents — and verification failures are the primary mechanism by which quality degrades at scale.

### Category 3: System Design Issues (33.7% of failures)

**What happens:** Agents have overlapping responsibilities, ambiguous scope boundaries, or missing escalation paths. Two agents attempt the same subtask. An agent makes tool calls it shouldn't. A delegation chain has no depth limit.

**Cost signature: Redundant compute plus concurrency overruns.**

This is where the O(n²) coordination overhead documented in [ICLR 2026 multi-agent research](https://llmsresearch.substack.com/p/what-iclr-2026-taught-us-about-multi) becomes a cost problem. At 5+ agents, coordination tokens — messages between agents about who does what — can exceed the tokens spent on actual work.

| Agents | Work tokens | Coordination tokens | Coordination overhead |
|---|---|---|---|
| 2 | 10,000 | 2,000 | 20% |
| 3 | 15,000 | 6,000 | 40% |
| 5 | 25,000 | 25,000 | 100% |
| 8 | 40,000 | 96,000 | 240% |

At 8 agents, you're spending 2.4× more on coordination than on work. And when two agents collide on the same subtask due to role ambiguity, both consume full resources — doubling the cost of that subtask for zero additional value.

## The Compound Effect: What 50% Failure Rate Actually Costs

When you combine all three failure categories, the cost impact compounds. Here's a realistic scenario for a production multi-agent system processing 1,000 runs per day:

| Metric | Healthy run | Failed run (avg) | Daily blend at 50% failure |
|---|---|---|---|
| Token consumption | 45,000 | 180,000 | 112,500 |
| API calls | 12 | 47 | 29.5 |
| Cost per run | $3.50 | $18.40 | $10.95 |
| **Daily cost (1,000 runs)** | **$3,500** | **$18,400** | **$10,950** |

At a 50% failure rate — which is *optimistic* relative to MAST's findings — daily spend is 3.1× higher than expected. Over a month, that's $328,500 instead of $105,000. The $223,500 difference is the cost of coordination failures that your monitoring never attributes to coordination.

96% of organizations report generative AI costs higher than expected at production scale, according to [Deloitte's 2026 analysis](https://www.openpr.com/news/4371590/ai-agents-surge-in-2026-boom-token-crisis-threatens). Token prices have fallen 280× in two years, but enterprise bills are *increasing* — because multi-agent architectures multiply consumption faster than prices fall.

## Why Observability Doesn't Catch This

Standard monitoring shows:
- **Per-call metrics:** Latency, status code, token count. All green.
- **Aggregate metrics:** Total spend, total calls, average latency. Trending up, but slowly enough to look like growth.
- **Provider dashboards:** Monthly total by model. No breakdown by agent, scope, or failure mode.

What's missing:
- **Per-agent, per-run cost attribution.** Which agent in the chain caused the blowout?
- **Failure-cost correlation.** How much did each failed run cost vs. each successful one?
- **Coordination overhead tracking.** What percentage of tokens went to agent-to-agent communication vs. actual work?
- **Pre-execution cost projection.** Before the run starts, what's the maximum it can cost?

Observability tells you the temperature of the room. It doesn't stop the thermostat from running up the bill. As we covered in [Cycles vs LLM Proxies and Observability Tools](/blog/cycles-vs-llm-proxies-and-observability-tools), observability platforms record what happened — they don't prevent what's about to happen.

## How Runtime Authority Contains the Blast Radius

Runtime authority doesn't fix coordination — it bounds the cost of coordination failures. Every agent call requires a budget reservation *before* execution. When the budget is exhausted, the next call is denied. The failure still occurs, but the cost is capped.

Here's how each MAST failure category maps to runtime authority enforcement:

### Inter-agent misalignment → Per-agent budget boundaries

Each agent in the chain gets its own budget scope. When Agent B misinterprets Agent A's context and starts a wasteful chain of calls, it hits its own budget limit — not the system's total budget:

```
Planner  → scope: workflow:research/agent:planner    budget: $2.00
Researcher → scope: workflow:research/agent:researcher  budget: $5.00
Analyst  → scope: workflow:research/agent:analyst    budget: $8.00
Writer   → scope: workflow:research/agent:writer     budget: $3.00
```

If the Researcher misaligns and burns through its $5.00 on a wrong-premise investigation, it gets a `409 BUDGET_EXCEEDED` — not a quiet degradation that poisons the Analyst's work too. The [reserve-commit pattern](/protocol/how-reserve-commit-works-in-cycles) ensures every call is accounted for before execution.

The error propagation multiplier drops from 7–17× to 1–2× because the blast radius is contained to the failing agent's scope.

### Task verification failures → Per-run budget caps

Recursive non-convergence — agents looping without progress — is the most expensive failure mode. Without a cap, it runs until someone notices or the provider rate-limits you.

With a per-run budget, the loop is bounded:

```
Run budget: $15.00
Iteration 1-4: $3.50 each → $14.00 committed
Iteration 5: Reserve $3.50 → DENY (budget: $1.00 remaining)
```

The run fails, but at $15 — not $47,000. The system can [gracefully degrade](/blog/ai-agent-failures-budget-controls-prevent): fall back to a simpler strategy, escalate to a human, or return a partial result with a cost-exceeded flag.

### System design issues → Scope-isolated coordination budgets

When agents have overlapping responsibilities and two attempt the same subtask, both consume budget. With scope isolation, you can enforce that each subtask has a single budget allocation:

```
Subtask "data-extraction" → scope: workflow:research/task:data-extraction
  budget: $4.00 (shared across all agents claiming this task)
```

The first agent to reserve against this scope gets the budget. If a second agent attempts the same subtask, the reservation reflects the remaining budget — preventing redundant work from doubling costs. This is the [multi-tenant isolation pattern](/blog/multi-tenant-ai-cost-control-per-tenant-budgets-quotas-isolation) applied at the task level.

## The Math: Guarded vs. Unguarded at Scale

Returning to the 1,000 runs/day scenario, here's the impact of runtime authority:

| Metric | Unguarded (50% failure) | Guarded (50% failure, bounded) |
|---|---|---|
| Failed run cost (avg) | $18.40 | $8.20 (capped at 2.3× healthy) |
| Daily cost | $10,950 | $5,850 |
| Monthly cost | $328,500 | $175,500 |
| **Monthly savings** | — | **$153,000** |

The failure rate doesn't change — that requires better system design, structured protocols, and the kind of architectural work the MAST and SEMAP research recommends. What changes is the cost of each failure. Runtime authority turns unbounded failures into bounded ones.

And the per-agent, per-run budget data creates the attribution layer that observability alone can't provide. When you can see that `agent:analyst` is consuming 4× its expected budget on 30% of runs, you know exactly where to invest in better coordination — which is what the MAST research says matters more than model upgrades.

## What To Do Now

If you're building or operating multi-agent systems:

1. **Measure your actual failure rate.** Run the [MAST annotator](https://github.com/multi-agent-systems-failure-taxonomy/MAST) (`pip install agentdash`) against your traces. The number will be higher than you think.

2. **Calculate your failure cost multiplier.** Compare per-run cost for successful vs. failed runs. If the ratio is above 3×, coordination failures are a significant budget line item.

3. **Start with per-agent budget boundaries.** Even before optimizing coordination, [scope each agent's budget independently](/blog/multi-agent-budget-control-crewai-autogen-openai-agents-sdk). This bounds the blast radius of any single coordination failure.

4. **Add per-run caps for recursive workflows.** Any multi-agent workflow with retry logic or iterative refinement needs a hard ceiling. The [reserve-commit pattern](/blog/ai-agent-budget-control-enforce-hard-spend-limits) provides this without code changes to your agent logic.

5. **Use the cost data to prioritize design fixes.** Runtime authority doesn't replace good system design — it gives you the data to invest in the right design improvements. When you see that inter-agent misalignment costs you $4,000/day, you know that structured handoff protocols (like SEMAP's approach) are worth building.

The MAST research proves that multi-agent failures are systematic, not random. Runtime authority ensures those systematic failures have a predictable, bounded cost — and generates the per-agent attribution data you need to fix the root causes.

## Sources

Research and data referenced in this post:

- [MAST: Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — Cemri et al., UC Berkeley. NeurIPS 2025 Spotlight. 1,600+ annotated traces, 14 failure modes, 41–87% failure rates across 7 frameworks
- [MAST Project Page — UC Berkeley Sky Computing Lab](https://sky.cs.berkeley.edu/project/mast/) — Dataset, taxonomy, and annotator tools
- [SEMAP: Protocol-Driven Multi-Agent Engineering](https://arxiv.org/html/2510.12120) — Up to 69.6% failure reduction through structured communication protocols
- [Why Your Multi-Agent System Is Failing: The 17× Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) — Google DeepMind error amplification research
- [What ICLR 2026 Taught Us About Multi-Agent Failures](https://llmsresearch.substack.com/p/what-iclr-2026-taught-us-about-multi) — O(n²) coordination overhead, latency bottlenecks, communication efficiency
- [LangChain State of AI Agents](https://www.langchain.com/state-of-agent-engineering) — 57% have agents in production, quality is #1 barrier (32%)
- [The $47,000 AI Agent Loop](https://earezki.com/ai-news/2026-03-23-the-ai-agent-that-cost-47000-while-everyone-thought-it-was-working/) — 11-day recursive loop, March 2026
- [AI Agent Token Crisis: Deloitte's Paradox](https://www.openpr.com/news/4371590/ai-agents-surge-in-2026-boom-token-crisis-threatens) — 280× price drop, rising enterprise bills, 96% report higher-than-expected costs
- [Multi-Agent System Reliability: Failure Patterns and Production Validation](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) — Cascading failures, race conditions, retry amplification
- [5 Production Scaling Challenges for Agentic AI in 2026](https://machinelearningmastery.com/5-production-scaling-challenges-for-agentic-ai-in-2026/) — 78% pilots, 14% production scale, build-vs-operate imbalance

## Further Reading

- [Multi-Agent Budget Control: CrewAI, AutoGen, OpenAI](/blog/multi-agent-budget-control-crewai-autogen-openai-agents-sdk) — Per-agent budget patterns for popular frameworks
- [AI Agent Silent Failures: Why 200 OK Is the Most Dangerous Response](/blog/ai-agent-silent-failures-why-200-ok-is-the-most-dangerous-response) — When failures look like successes
- [AI Agent Budget Control: Enforce Hard Spend Limits](/blog/ai-agent-budget-control-enforce-hard-spend-limits) — The reserve-commit pattern that bounds runaway cost
- [5 AI Agent Failures Budget Controls Would Prevent](/blog/ai-agent-failures-budget-controls-prevent) — Specific failure scenarios with dollar math
- [Cycles vs LLM Proxies and Observability Tools](/blog/cycles-vs-llm-proxies-and-observability-tools) — Why monitoring alone isn't enforcement
- [The True Cost of Uncontrolled AI Agents](/blog/true-cost-of-uncontrolled-agents) — The observability gap and why dashboards fail
