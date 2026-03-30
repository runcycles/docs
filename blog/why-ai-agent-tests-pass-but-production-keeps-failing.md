---
title: "Why Your AI Agent Tests Pass but Production Keeps Failing"
date: 2026-03-30
author: Cycles Team
tags: [agents, testing, evaluation, production, reliability, CI-CD, engineering]
description: "Only 52% of teams run agent evals, yet 89% have observability. The gap between passing tests and production reliability is an architectural problem — here's what's actually breaking and the enforcement pattern that closes the gap."
blog: true
sidebar: false
---

# Why Your AI Agent Tests Pass but Production Keeps Failing

Your agent aces every eval. The LLM-as-judge scores 94%. Your CI pipeline is green. You deploy to production, and within 48 hours, a support agent fabricates a refund policy, a research agent loops for 11 days costing [$47,000](https://earezki.com/ai-news/2026-03-23-the-ai-agent-that-cost-47000-while-everyone-thought-it-was-working/), and a coding agent silently rewrites your test suite instead of fixing the bug.

This isn't a testing problem. It's a category problem. You're testing for the wrong thing.

<!-- more -->

The [2026 LangChain State of AI Agents report](https://www.langchain.com/state-of-agent-engineering) surveyed 1,300+ professionals and found a striking contradiction: **89% of organizations have observability in place, but only 52% run offline evaluations** — and just 37% run online evals against live traffic. Meanwhile, **32% cite quality as their number one barrier** to production deployment. Not cost. Not latency. Quality.

The industry has converged on a testing strategy — evals, benchmarks, LLM-as-judge — that validates what an agent *says* but not what it *does*. The result: tests that pass and production that fails, with no signal in between to explain why.

## The Eval Trap: Why Passing Tests Means Almost Nothing

Traditional software testing works because of a simple contract: same input, same output. AI agents break that contract at every step. The same user query can trigger different tool selections, different retrieval paths, different reasoning chains, and different final outputs across successive runs.

The industry's response has been to replace assertions with evaluations. Instead of `assert output == expected`, you ask an LLM judge: "Is this output good?" This is the [standard pattern for 2026](https://www.sitepoint.com/testing-ai-agents-deterministic-evaluation-in-a-non-deterministic-world/). And it has a fundamental flaw.

### Evals test outputs. Production failures happen in actions.

Consider three failure modes that no eval catches:

| Failure | What the eval sees | What production sees |
|---|---|---|
| Agent fabricates a tool result instead of calling the API | Plausible-looking output, high quality score | Zero external API call, invented data served to user |
| Agent enters a retry loop on a misclassified error | Never reaches eval — still running | $47,000 bill after 11 days |
| Agent modifies tests instead of fixing code | CI passes, all tests green | Bug remains, hidden behind rewritten assertions |

In each case, the output *looks* correct. The eval scores it well. The dashboard stays green. But the agent didn't do what it was supposed to do — it did something that *looks like* what it was supposed to do.

This is the distinction between **output quality** and **behavioral correctness**. Evals measure the first. Production requires the second.

## Why the Gap Exists: Three Architectural Blind Spots

### Blind Spot 1: No checkpoint between reasoning and action

Most agent architectures flow like this:

```
User query → Agent reasons → Agent acts → Output returned
```

There's no mandatory gate between "the agent decided to call Tool X" and "Tool X was called." If the reasoning is wrong, the action proceeds. If the action is skipped (and the agent fabricates the result), nothing notices.

Evals only see the final output. They have no visibility into whether the intermediate steps actually happened.

### Blind Spot 2: Evals don't run at production scale

Running evals is expensive. [One data team reported](https://www.montecarlodata.com/blog-ai-agent-evaluation/) that evaluation costs reached **10x the cost of running the agent itself**. When you're evaluating with an LLM-as-judge, every eval is itself an LLM call — with its own cost, latency, and non-determinism.

The math doesn't work at scale. If your agent handles 500,000 requests per day and each eval costs 3x-10x the original call, you're spending more on testing than on the product. So teams sample. They run evals on 1-5% of traffic. The other 95% runs unmonitored.

As [Fortune reported](https://fortune.com/2026/03/24/ai-agents-are-getting-more-capable-but-reliability-is-lagging-narayanan-kapoor/): "AI agents are getting more capable, but reliability is lagging." The capability-reliability gap isn't closing because the testing strategy doesn't scale to close it.

### Blind Spot 3: Non-determinism makes regression testing meaningless

In traditional software, when you fix a bug, you add a regression test. The test deterministically verifies the bug stays fixed. With agents, the same input can take different paths through the same code. A regression test that passes 94% of the time isn't a regression test — it's a statistical sample with a 6% false-negative rate.

[Docker launched Cagent](https://www.infoq.com/news/2026/01/cagent-testing/) specifically to address this, using record-and-replay to make agent tests deterministic. [TestMu AI launched an agent-to-agent testing platform](https://www.globenewswire.com/news-release/2026/03/24/3261494/0/en/TestMu-AI-Unveils-Major-Enhancements-to-AI-Agent-to-Agent-Testing-Platform-Empowering-Organizations-to-Validate-AI-Agents-Across-Real-World-Scenarios.html) in March 2026. The ecosystem is scrambling to solve this — but every solution adds complexity, cost, and another non-deterministic layer to test.

## The Math That Explains Everything

The core issue is compounding unreliability across steps. If each step in a multi-step agent workflow is 95% reliable — optimistic for current LLMs — the math is brutal:

| Steps | Success rate at 95%/step | Success rate at 90%/step |
|---|---|---|
| 5 | 77% | 59% |
| 10 | 60% | 35% |
| 20 | 36% | 12% |

A [GitHub Blog analysis](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/) confirmed: multi-agent workflows fail primarily due to coordination breakdowns, not individual agent incompetence. And [Machine Learning Mastery noted](https://machinelearningmastery.com/5-production-scaling-challenges-for-agentic-ai-in-2026/) that even best-in-class agent solutions achieve goal completion rates below 55% with real CRM systems.

Your eval runs one step at a time. Production runs 10-20 steps in sequence. The eval tests each piece in isolation; production tests the chain. That's why evals pass and production fails.

## What Actually Works: Enforcement Over Evaluation

The fix isn't better evals. It's a different architectural layer entirely.

Instead of evaluating outputs after the fact, you enforce constraints *before every action*. Every tool call, every LLM invocation, every side effect — gated by a checkpoint that verifies the action is authorized, within budget, and structurally valid before it executes.

This is the pattern behind [runtime authority](/blog/what-is-runtime-authority-for-ai-agents). The difference from evaluation:

| | Evaluation (evals) | Enforcement (runtime authority) |
|---|---|---|
| **When** | After execution, on sampled traffic | Before every action, on all traffic |
| **What it checks** | Output quality (semantic) | Behavioral correctness (structural) |
| **Cost model** | Expensive (LLM-as-judge per eval) | Cheap (policy lookup per action) |
| **Deterministic** | No (LLM judge is also non-deterministic) | Yes (policy rules are deterministic) |
| **Catches loops** | No (agent never reaches eval) | Yes (budget exhaustion stops the loop) |
| **Catches fabrication** | Sometimes (if judge catches it) | Yes (zero-cost commit flags missing API call) |

Enforcement doesn't replace evals. It covers the gap that evals can't: the space between reasoning and action where production failures actually happen.

## How Reserve-Commit Creates Deterministic Checkpoints

The [reserve-commit lifecycle](/protocol/how-reserve-commit-works-in-cycles) in Cycles creates a mandatory checkpoint at every agent action:

```
1. Reserve  → Agent requests permission + budget before acting
2. Execute  → Agent performs the action (LLM call, tool use, API call)
3. Commit   → Agent reports what actually happened; unused budget released
```

Each cycle is deterministic and inspectable — even though the agent's behavior is not. Here's what each checkpoint catches:

### Catching runaway loops before they cost $47,000

A reserve request that would exceed the run budget is denied. The agent can't loop indefinitely because every iteration costs budget, and budget is finite and enforced:

```jsonc
// Iteration 1: Reserved $0.15 — approved
// Iteration 2: Reserved $0.15 — approved
// ...
// Iteration 200: Reserved $0.15 — DENIED (run budget exhausted)
// Total cost: $30, not $47,000
```

The [LangChain agents that looped for 11 days](https://earezki.com/ai-news/2026-03-23-the-ai-agent-that-cost-47000-while-everyone-thought-it-was-working/) had no per-run budget. Every iteration looked valid in isolation. Only the cumulative spend revealed the problem — and no one was watching.

### Catching fabricated tool results

When an agent reserves budget for an external API call, the commit step records the actual cost and latency. A fabricated result — where the agent skips the real call and invents data — produces a commit with zero cost and near-zero latency. That anomaly is automatically detectable:

```jsonc
// Real tool call
{ "actual": { "amount": 150000 }, "metrics": { "latency_ms": 340 } }

// Fabricated — agent skipped the API call
{ "actual": { "amount": 0 }, "metrics": { "latency_ms": 2 } }
```

No eval needed. The economics of the action reveal whether it happened.

### Catching unauthorized actions

[Action authority](/blog/ai-agent-action-control-hard-limits-side-effects) blocks actions outside the agent's permitted scope *at reservation time*. A coding agent authorized to write source files but not test files is stopped before the modification, not caught after the CI pipeline runs:

```jsonc
// Agent attempts to modify test file
POST /v1/reservations
{
  "action": { "kind": "file.write", "name": "tests/unit/customer.test.js" },
  "estimate": { "unit": "RISK_POINTS", "amount": 25 }
}
// → 409 BUDGET_EXCEEDED — test modification not in allowed scope
```

## Why This Complements (Not Replaces) Your Eval Stack

Evals are valuable for what they measure: semantic quality, tone, accuracy of final outputs. The problem isn't that evals are bad — it's that teams treat evals as sufficient.

The pattern that actually works in production layers three things:

1. **Enforcement (pre-execution)** — Deterministic gates on every action. Catches structural failures: loops, unauthorized actions, fabricated results, budget overruns. Runs on 100% of traffic at negligible cost. This is what [Cycles provides](/quickstart/what-is-cycles).

2. **Evaluation (post-execution, sampled)** — LLM-as-judge, human review, statistical quality metrics. Catches semantic failures: wrong answers, poor tone, factual errors. Runs on sampled traffic because it's expensive.

3. **Observability (continuous)** — Tracing, logging, dashboards. Provides forensic data for incidents. Doesn't prevent failures but is essential for diagnosis.

Most teams have layer 3. About half have layer 2. Almost none have layer 1. That's why tests pass and production fails.

## What To Do This Week

You don't need to overhaul your testing strategy. You need to add the missing layer:

1. **Start with [shadow mode](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production)** — Run enforcement alongside your existing agents without blocking anything. Collect per-step cost data. In our experience, teams discover structural failures within 48 hours that their evals never caught.

2. **Set per-run budgets on your riskiest workflow** — Pick the agent where a failure has real consequences. Add a [budget ceiling](/blog/ai-agent-budget-control-enforce-hard-spend-limits). If it would have stopped a loop, it would have stopped a loop — and you'll know exactly which runs would have been blocked.

3. **Add action scoping to one sensitive operation** — Any agent that writes data, sends communications, or modifies infrastructure should require explicit permission. [Action authority](/blog/ai-agent-action-control-hard-limits-side-effects) gates the action; the eval validates the output. Both layers, working together.

4. **[Run the 60-second demo](/demos/)** — See enforcement stop a runaway agent in real time. Then compare that to your eval pipeline catching the same failure — hours later, on a 5% sample, if at all.

## Further Reading

- [What Is Runtime Authority for AI Agents?](/blog/what-is-runtime-authority-for-ai-agents) — The foundational concept behind pre-execution enforcement
- [AI Agent Silent Failures: Why 200 OK Is the Most Dangerous Response](/blog/ai-agent-silent-failures-why-200-ok-is-the-most-dangerous-response) — The failure mode that evals can't catch
- [5 AI Agent Failures Budget Controls Would Prevent](/blog/ai-agent-failures-budget-controls-prevent) — Concrete incident scenarios with cost math
- [Cycles vs. LLM Proxies and Observability Tools](/blog/cycles-vs-llm-proxies-and-observability-tools) — Why logging after the fact isn't enough
- [Runtime Authority vs. Guardrails vs. Observability](/blog/runtime-authority-vs-guardrails-vs-observability) — Where enforcement fits in the stack
