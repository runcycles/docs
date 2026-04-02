---
title: "Block the 201st Email Before It Sends"
description: "A support agent sent 200 collections emails instead of welcome emails. Total model spend: $1.40. Business impact: $50K+ in lost pipeline. No spending limit would have caught it."
---

# Block the 201st Email Before It Sends

A support agent was supposed to send welcome emails to new signups. A prompt regression changed "welcome" to "final payment reminder." The agent [sent 200 collections emails to new customers](/blog/ai-agent-action-control-hard-limits-side-effects). Total model spend: $1.40. Business impact: $50K+ in lost pipeline.

No spending limit would have caught this. The LLM calls were cheap. The damage was in what the agent *did*, not what it *spent*.

## Why budget limits aren't enough

Budget governance answers: "Can this agent afford to run?" Action authority answers: "Should this agent be allowed to do this?"

A support agent with a $5 budget can send 200 emails for $1.40 and stay well within its spending limit. The problem isn't cost — it's **consequence**. Some actions have blast radius far beyond their token cost:

- Sending emails to customers
- Deploying code to production
- Writing to a database
- Calling a rate-limited external API
- Triggering a webhook that fires a real-world action

These need their own limits, independent of dollar spend.

## How Cycles fixes it

Cycles supports `RISK_POINTS` — budgets denominated in consequence, not dollars. Assign a risk cost to each tool based on its blast radius:

```python
from runcycles_openai_agents import CyclesRunHooks, ToolRiskMap

hooks = CyclesRunHooks(
    tenant="acme",
    tool_risk=ToolRiskMap(
        mapping={
            "send_email": 50,        # high consequence
            "deploy_to_prod": 100,   # critical
            "search_knowledge": 0,   # safe — no reservation needed
            "read_docs": 0,          # safe
        },
        default_risk=1,
    ),
)
```

In the original incident, the agent sent 200 emails unchecked. With risk points, you decide how many is too many. A budget of 200 risk points with 50 points per email means the agent can send 4 emails before it's denied. A budget of 10,000 points with 50 per email caps it at 200 — and blocks email #201 before it executes.

The point isn't the specific number. It's that **every action is gated before execution** — not logged after the damage is done.

## What happens now

- **Safe actions are free.** Reading, searching, and reasoning cost zero risk points. The agent works normally for everything that doesn't have consequence.
- **Dangerous actions are gated.** Each email, deployment, or write operation consumes risk points. The agent's available actions shrink as it uses them.
- **The agent degrades, not crashes.** When email authority runs out, the agent can queue the remaining emails for human review instead of stopping entirely.
- **Per-agent isolation in multi-agent systems.** The researcher agent gets unlimited search but zero email authority. The executor agent gets tool authority but limited LLM budget. A bug in one can't trigger the other's capabilities.

## Cost and consequence together

The most powerful setup uses both dimensions on the same agent:

```python
# LLM calls check the dollar budget
@cycles(estimate=2_000_000, unit="USD_MICROCENTS",
        action_kind="llm.completion", action_name="gpt-4o")
def call_llm(prompt: str) -> str:
    ...

# Tool calls check the risk budget
@cycles(estimate=50, unit="RISK_POINTS",
        action_kind="tool.email", action_name="send_customer_email")
def send_email(to: str, body: str) -> str:
    ...
```

Each action checks its own unit's budget. The LLM call draws from the dollar budget. The email draws from the risk budget. Both enforced through the same protocol, with the same concurrency safety and scope hierarchy.

## Go deeper

- [Action Authority: Controlling What Agents Do](/concepts/action-authority-controlling-what-agents-do) — the conceptual foundation
- [Understanding Units](/protocol/understanding-units-in-cycles-usd-microcents-tokens-credits-and-risk-points) — USD_MICROCENTS, TOKENS, CREDITS, RISK_POINTS
- [OpenAI Agents SDK Integration](/how-to/integrating-cycles-with-openai-agents) — ToolRiskMap and per-tool governance
- [Beyond Budget: Action Authority](/blog/beyond-budget-how-cycles-controls-agent-actions) — real scenarios and multi-agent patterns
- [5 Failures Only Action Controls Would Prevent](/blog/ai-agent-action-failures-runtime-authority-prevents) — incidents where spend was negligible
