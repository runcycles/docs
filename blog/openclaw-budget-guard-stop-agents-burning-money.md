---
title: "Your OpenClaw Agent Has No Spending Limit — Here's How to Fix That"
date: 2026-03-26
author: Cycles Team
tags: [openclaw, budgets, agents, runtime-authority, cost-control, plugin, tool-limits]
description: "OpenClaw agents can call any model, invoke any tool, and retry indefinitely — with no budget enforcement. The cycles-openclaw-budget-guard plugin adds hard spend limits, tool call caps, and graceful degradation with zero code changes."
blog: true
sidebar: false
---

# Your OpenClaw Agent Has No Spending Limit — Here's How to Fix That

An OpenClaw agent picks up a customer support ticket. It calls GPT-4o to draft a response, invokes a web search tool to verify facts, decides the answer isn't good enough, and loops. Each iteration costs $0.08. After 200 iterations — about 90 seconds — the bill is $16 and the agent is still going. Nobody noticed because it's 2 AM.

This is not a hypothetical. It's the default behavior of every OpenClaw agent that doesn't have budget enforcement. There is no built-in spending limit. There is no call cap. There is no circuit breaker. The agent runs until the task succeeds, the context window fills up, or someone kills the process.

The [`cycles-openclaw-budget-guard`](https://github.com/runcycles/cycles-openclaw-budget-guard) plugin fixes this. Install it, add four lines of config, and every model call and tool invocation is budget-checked before execution. No code changes to your agent.

<!-- more -->

## Five problems you didn't know you had

If you're running OpenClaw agents in production — or plan to — these will hit you eventually.

### 1. Runaway spend

An agent stuck in a retry loop, a quality-check loop, or a recursive research task can burn through your entire API budget in minutes. Provider spending caps (OpenAI, Anthropic) are account-wide, monthly, and react too slowly. By the time the cap kicks in, the damage is done.

**What the plugin does:** Every model call and tool invocation reserves budget *before* execution via a [Cycles server](/quickstart/what-is-cycles). When the budget is exhausted, the next call is blocked — not the one after the alert fires.

### 2. Uncontrolled side-effects

Cost isn't the only risk. An agent can send 100 emails, trigger 50 deployments, write to production databases, or call external APIs — all in a single session. Cost limits don't help here. An email costs fractions of a cent but can cause real damage.

**What the plugin does:** [`toolCallLimits`](/how-to/integrating-cycles-with-openclaw#tool-call-limits) cap the number of times a specific tool can be invoked per session. Set `"send_email": 10` and the 11th call is blocked, regardless of budget.

### 3. Noisy neighbors

In a multi-tenant platform or a team with shared API keys, one user's runaway agent consumes the entire budget. Other agents — serving other users — start failing because there's nothing left.

**What the plugin does:** Budgets are scoped per [user, session, or team](/how-to/integrating-cycles-with-openclaw#per-user-and-per-session-scoping). Each agent draws from its own allocation. One user's spike doesn't affect anyone else.

### 4. No visibility into what agents spend

The agent session ends. You know it cost *something*, but you don't know which tools were expensive, which models it chose, or how many calls it made. Debugging a cost spike means digging through API provider dashboards and correlating timestamps.

**What the plugin does:** Every session produces a [cost breakdown](/how-to/integrating-cycles-with-openclaw#session-analytics-and-cost-breakdown) — per-tool cost, per-model cost, invocation counts, and remaining budget. Attached to context metadata and optionally sent to a webhook.

### 5. Graceless failure

The simplest budget enforcement is a hard stop: budget gone, agent dead. But that's a terrible user experience. The agent was in the middle of generating a 2,000-word report and just... stopped.

**What the plugin does:** Before hard limits kick in, the plugin [degrades gracefully](/how-to/integrating-cycles-with-openclaw#graceful-degradation-strategies). It switches to cheaper models (Opus to Sonnet to Haiku), reduces output length, disables expensive tools, and injects budget warnings into the system prompt so the model itself starts conserving resources. The agent finishes the task — just more frugally.

## What it looks like

Install the plugin (no code changes to your agent):

```bash
openclaw plugins install @runcycles/openclaw-budget-guard
openclaw plugins enable openclaw-budget-guard
```

Add minimal config to your `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "my-org",
          "cyclesBaseUrl": "http://localhost:7878",
          "cyclesApiKey": "cyc_live_..."
        }
      }
    }
  }
}
```

That's it. Every model call and tool invocation is now budget-guarded.

For production, add model fallbacks and tool costs:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "my-org",
          "failClosed": true,
          "modelFallbacks": {
            "claude-opus-4-20250514": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]
          },
          "modelBaseCosts": {
            "claude-opus-4-20250514": 1500000,
            "claude-sonnet-4-20250514": 300000,
            "claude-haiku-4-5-20251001": 100000
          },
          "toolBaseCosts": {
            "web_search": 500000,
            "code_execution": 1000000
          },
          "toolCallLimits": {
            "send_email": 10,
            "deploy": 3
          },
          "lowBudgetStrategies": ["downgrade_model", "disable_expensive_tools", "limit_remaining_calls"],
          "maxRemainingCallsWhenLow": 5
        }
      }
    }
  }
}
```

When budget runs low, the plugin automatically:

1. **Downgrades models** — Opus to Sonnet to Haiku, based on what the remaining budget can afford
2. **Disables expensive tools** — blocks tools above a cost threshold
3. **Caps remaining calls** — limits total calls to prevent runaway loops
4. **Tells the agent** — injects budget status into the system prompt so the model self-regulates

When budget is exhausted, execution stops with a clear error:

```
Budget exhausted (remaining: 0, tenant=my-org, budget=my-app).
Execution blocked by cycles-openclaw-budget-guard.
To resume, increase the budget via the Cycles API or contact your admin.
```

## How it works under the hood

The plugin hooks into five OpenClaw lifecycle events:

| Hook | What happens |
|------|-------------|
| `before_model_resolve` | Reserves budget for the model call. Downgrades if budget is low. Blocks if exhausted. |
| `before_prompt_build` | Injects budget status into the system prompt ("Budget is low — prefer cheaper tools"). |
| `before_tool_call` | Checks tool permissions and call limits. Reserves budget. Blocks if denied. |
| `after_tool_call` | Commits the actual cost (or estimate if actual isn't available). |
| `agent_end` | Releases orphaned reservations. Builds session summary with full cost breakdown. |

Every reservation follows the Cycles [reserve-commit-release](/protocol/how-reserve-commit-works-in-cycles) protocol. Budget is deducted atomically on the server — no race conditions, no double-spend, no stale reads.

## Try it without a server

Don't have a Cycles server yet? Use dry-run mode:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "dev",
          "cyclesBaseUrl": "http://unused",
          "cyclesApiKey": "unused",
          "dryRun": true,
          "dryRunBudget": 500000000,
          "logLevel": "debug"
        }
      }
    }
  }
}
```

All plugin behavior works identically — model downgrade, tool limits, prompt hints, session summaries — but budget is tracked in-memory. No server required.

## Who this is for

- **Teams running OpenClaw agents in production** — you need hard limits before an overnight run becomes a $2,000 invoice
- **Multi-tenant platforms** — your users need isolated budgets so one customer's agent doesn't drain another's allocation
- **Anyone building with consequential tools** — if your agent can send emails, create tickets, trigger deployments, or write to databases, you need call limits, not just cost limits
- **Cost-conscious teams** — model downgrade and graceful degradation let you ship capable agents on tight budgets

## Get started

```bash
openclaw plugins install @runcycles/openclaw-budget-guard
```

Full documentation: [Integrating Cycles with OpenClaw](/how-to/integrating-cycles-with-openclaw)

Source code: [github.com/runcycles/cycles-openclaw-budget-guard](https://github.com/runcycles/cycles-openclaw-budget-guard)

To deploy a Cycles server: [Deploying the Full Cycles Stack](/quickstart/deploying-the-full-cycles-stack)

To see budget enforcement in action: [Runaway Agent Demo](https://github.com/runcycles/cycles-runaway-demo)
