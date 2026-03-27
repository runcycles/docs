---
title: "We Gave Our OpenClaw Agent a $5 Budget and Watched It Adapt"
date: 2026-03-27
author: Albert Mavashev
tags: [openclaw, budgets, agents, graceful-degradation, model-downgrade, production, cost-control, ai-agent-cost, llm-cost-management]
description: "An OpenClaw research agent hits a complex query that would cost $12. With a $5 Cycles budget, it downgrades models, disables expensive tools, self-regulates via prompt hints, and completes the task for $4.85. Here's exactly what happened."
blog: true
sidebar: false
---

# We Gave Our OpenClaw Agent a $5 Budget and Watched It Adapt

Most AI agent cost controls are kill switches. Budget runs out, agent dies mid-task, user gets nothing. [Cycles](https://runcycles.io) does something different: it makes the agent *adapt*.

A research agent running on OpenClaw picks up a complex competitive analysis. It starts with Claude Opus to draft the report, calls web search to find market data, runs code execution to build charts, and iterates. Normal sessions cost $2–4. This one is harder — it needs 3x the usual tool calls.

Without budget enforcement, the session would have cost $12. The agent doesn't know or care. It calls whatever model and tool the task needs, and the bill arrives later.

We set a $5 budget using the [`cycles-openclaw-budget-guard`](https://github.com/runcycles/cycles-openclaw-budget-guard) plugin and let it run. It didn't stop. It *adapted*.

At $3.50 remaining, the plugin switched the model from Opus to Sonnet. At $1.50, it blocked code execution (too expensive per call). It injected "budget is low — prefer cheaper tools" into the system prompt, and the model started writing shorter responses and skipping optional searches. The task completed with $0.15 to spare. The report was slightly less polished, but the analysis was correct, the data was there, and the bill was $4.85 instead of $12.

That's the difference between a kill switch and [runtime authority](/concepts/what-is-runtime-authority-for-ai-agents).

> **TL;DR:** Install the plugin, set a budget, and your OpenClaw agent automatically downgrades models, disables expensive tools, and self-regulates when budget gets tight — instead of crashing.

<!-- more -->

## What the logs looked like

Here's the plugin output from that session, at info level — no debug mode needed:

```
Cycles Budget Guard for OpenClaw v0.7.5
  tenant: research-team
  defaultModelName: claude-opus-4-20250514
  failClosed: true
  lowBudgetThreshold: 150000000

Model reserved: claude-opus-4-20250514 (estimate=15000000, remaining=500000000)
Model committed: claude-opus-4-20250514 (cost=15000000 USD_MICROCENTS)
Tool reserved: web_search (estimate=5000000, remaining=485000000)
Tool committed: web_search (cost=5000000 USD_MICROCENTS)
Model reserved: claude-opus-4-20250514 (estimate=15000000, remaining=480000000)
Model committed: claude-opus-4-20250514 (cost=15000000 USD_MICROCENTS)
...
Budget level changed: healthy → low (remaining=150000000)
Budget low — downgrading model claude-opus-4-20250514 → claude-sonnet-4-20250514
Model reserved: claude-sonnet-4-20250514 (estimate=3000000, remaining=147000000)
...
Tool "code_execution" blocked: cost 10000000 exceeds expensive threshold 5000000
...
Model committed: claude-sonnet-4-20250514 (cost=3000000 USD_MICROCENTS)
Agent session budget summary: remaining=15000000 spent=485000000 reservations=34
```

Every reservation, commit, downgrade, and block is visible. No digging through provider dashboards. This is what AI agent cost management looks like when it's built into the execution lifecycle — not bolted on after the fact.

## What the agent saw

When budget dropped below `lowBudgetThreshold`, the plugin injected this into the system prompt:

```
Budget: 35000000 USD_MICROCENTS remaining. Budget is low — prefer cheaper models
and avoid expensive tools. 7% of budget remaining. Est. ~11 tool calls and
~3 model calls remaining at current rate. Limit responses to 1024 tokens.
```

The model read this and self-regulated. It stopped running optional web searches. It wrote tighter prose. It skipped the summary paragraph it usually generates. Nobody told it to do this — it just responded to the constraint, the same way a human would if told "you have 5 minutes left."

This is the part that surprises most teams: **budget-aware agents are better agents.** When the model knows resources are limited, it focuses. Fewer tangents, less padding, more direct answers. The prompt hint turns a blunt cost limit into a soft constraint the model can reason about.

## What the session summary told us

```json
{
  "remaining": 15000000,
  "spent": 485000000,
  "costBreakdown": {
    "model:claude-opus-4-20250514": { "count": 8, "totalCost": 120000000 },
    "model:claude-sonnet-4-20250514": { "count": 14, "totalCost": 42000000 },
    "tool:web_search": { "count": 9, "totalCost": 45000000 },
    "tool:code_execution": { "count": 3, "totalCost": 30000000 }
  },
  "unconfiguredTools": [
    { "name": "read_file", "callCount": 4, "estimatedTotalCost": 4000000 }
  ]
}
```

Three things jumped out:

1. **Opus cost $1.20 for 8 calls. Sonnet cost $0.42 for 14 calls.** Sonnet handled nearly twice as many calls for a third of the cost. Users didn't notice the switch.

2. **Code execution was blocked after 3 calls.** Each call cost $0.10. The `disable_expensive_tools` strategy kicked in at low budget. The agent compensated by describing the analysis in text instead of generating charts.

3. **`read_file` was unconfigured.** The session summary flagged it — 4 calls using the default estimate. Now we know to add it to `toolBaseCosts`.

## Three patterns we discovered

After running this config across hundreds of sessions, three patterns emerged that changed how we think about LLM cost management.

### Model downgrade is usually invisible

Sonnet's output quality for most tasks is 90–95% of Opus. In our research agent, users couldn't tell which model generated which paragraphs. The 5x cost reduction was real; the quality difference was not.

The key is configuring the fallback chain correctly. `"claude-opus-4-20250514": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]` gives the plugin two steps to try. It picks the cheapest model that fits within the remaining budget.

### Tool limits catch more bugs than budget limits

A `toolCallLimits: { "web_search": 20 }` caught a search loop that budget enforcement alone would have allowed to continue. Each search cost $0.005 — cheap individually, but 200 of them would have consumed the entire budget on a single tool. The limit fired at call #21 and the agent adapted by working with the data it already had.

### The session summary is your tuning guide

Every session produces a cost breakdown. After a week, patterns are obvious: which tools are overpriced in your estimates, which models are being downgraded too aggressively, which tools need explicit `toolCallLimits`. The `unconfiguredTools` list is a concrete TODO — no guessing about what to configure next.

## The config that made it work

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "cyclesBaseUrl": "${CYCLES_BASE_URL}",
          "cyclesApiKey": "${CYCLES_API_KEY}",
          "tenant": "research-team",
          "defaultModelName": "claude-opus-4-20250514",
          "modelFallbacks": {
            "claude-opus-4-20250514": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]
          },
          "modelBaseCosts": {
            "claude-opus-4-20250514": 15000000,
            "claude-sonnet-4-20250514": 3000000,
            "claude-haiku-4-5-20251001": 1000000
          },
          "toolBaseCosts": {
            "web_search": 5000000,
            "code_execution": 10000000,
            "read_file": 1000000
          },
          "toolCallLimits": {
            "web_search": 20,
            "code_execution": 10
          },
          "lowBudgetStrategies": ["downgrade_model", "reduce_max_tokens", "disable_expensive_tools"],
          "maxTokensWhenLow": 1024,
          "expensiveToolThreshold": 5000000,
          "lowBudgetThreshold": 150000000,
          "failClosed": true
        }
      }
    }
  }
}
```

> **New to Cycles?** [Cycles](https://runcycles.io) is an open-source runtime authority system for AI agents. It enforces budgets, action limits, and resource boundaries — before execution, not after. The [`cycles-openclaw-budget-guard`](https://github.com/runcycles/cycles-openclaw-budget-guard) plugin brings Cycles to OpenClaw with zero code changes. See [What is Cycles?](/quickstart/what-is-cycles) to learn more.

## What we'd change

Three things we learned the hard way:

**Enable `enableEventLog` from day one.** When a session behaves unexpectedly, the event log tells you exactly what happened — which tools were blocked, when models were downgraded, why a reservation was denied. Without it, you're reading tea leaves from the session summary.

**Model costs are estimates.** The plugin reserves a fixed amount per Opus call regardless of how many tokens are actually used. A short response costs the same as a long one. The `modelCostEstimator` callback can improve this if you have a proxy that tracks token usage, but out of the box, expect ±20% variance.

**OpenClaw doesn't pass the model name in hook events.** We had to add `defaultModelName` to the config because the `before_model_resolve` event only contains `{ prompt }`. We've filed a [feature request](https://github.com/openclaw/openclaw/issues/55771) — until it's resolved, set `defaultModelName` to your agent's model.

## Try it on your next session

```bash
openclaw plugins install @runcycles/openclaw-budget-guard
```

Start with [dry-run mode](/how-to/integrating-cycles-with-openclaw#try-it-without-a-server) to see the degradation behavior without a Cycles server. Then [deploy the full stack](/quickstart/deploying-the-full-cycles-stack) and watch your agent adapt instead of crash.

Full documentation: [Integrating Cycles with OpenClaw](/how-to/integrating-cycles-with-openclaw)

Source code: [github.com/runcycles/cycles-openclaw-budget-guard](https://github.com/runcycles/cycles-openclaw-budget-guard)

## Related reading

- [Your OpenClaw Agent Has No Spending Limit — Here's How to Fix That](/blog/openclaw-budget-guard-stop-agents-burning-money) — the first post in this series, covering the five problems the plugin solves
- [Your AI Agent Just Burned $6 in 30 Seconds](/blog/runaway-demo-agent-cost-blowup-walkthrough) — step-by-step walkthrough of a runaway agent demo with Cycles
- [AI Agent Budget Control: Enforce Hard Spend Limits](/blog/ai-agent-budget-control-enforce-hard-spend-limits) — why cost control must happen before execution
- [Degradation Paths in Cycles](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — deny, downgrade, disable, or defer
- [How Much Do AI Agents Cost?](/blog/how-much-do-ai-agents-cost) — the economics of agent execution
