---
title: "Budget Limits for Claude Code, Cursor, and Windsurf via MCP"
date: 2026-03-19
author: Cycles Team
tags: [mcp, claude-code, cursor, windsurf, budgets, agents]
description: "Add hard budget limits to Claude Code, Cursor, and Windsurf sessions — config-only enforcement via MCP, zero code changes."
blog: true
sidebar: false
---

# Budget Limits for Claude Code, Cursor, and Windsurf via MCP

A developer starts a Claude Code session at 2 PM to refactor an authentication module. The agent reads 40 files, generates test suites, rewrites three services, discovers a dependency conflict, and spirals into a research loop — reading documentation, trying alternative approaches, generating more tests. At 5 PM the developer checks the bill: $47.

The agent was productive. It was also unsupervised for three hours. No one told it to stop after $10. Nothing in Claude Code, Cursor, or Windsurf provides a built-in mechanism to say "stop spending after this amount." The host runs the agent. The agent calls tools. Nothing in that loop enforces a dollar ceiling.

<!-- more -->

## The Unsupervised Session Problem

MCP hosts — Claude Code, Cursor, Windsurf — are built for long autonomous sessions. A developer starts a task, the agent runs independently, calling tools, reading files, making model calls, sometimes for hours. That is the value proposition: autonomous productivity.

But autonomy without a budget boundary creates open-ended economic exposure.

Traditional API usage is human-paced. A developer writes a prompt, gets a response, writes the next prompt. Each request has a natural pause where a human is in the loop. In a coding agent session, the agent decides when to make the next call, how many files to read, whether to retry, whether to spawn sub-tasks. The developer is not watching every step — they are writing code in another tab, or they walked away to get coffee.

Three characteristics make MCP host sessions uniquely expensive when things go sideways:

1. **Long duration** — sessions run for minutes to hours, not milliseconds. A 3-hour Claude Code session with continuous tool use generates far more API calls than any single-request integration.
2. **Tool-heavy** — each tool call can trigger further LLM calls. Reading a file, searching a codebase, generating code, running tests — the agent chains these together, and each link in the chain costs money.
3. **Self-directed** — the agent decides the next step. If it thinks "I should read 20 more files to understand this better," it does. If it decides to regenerate a test suite three times, it does. There is no approval gate between steps.

| | Traditional API call | MCP host session |
|---|---|---|
| Duration | Milliseconds to seconds | Minutes to hours |
| Who decides next action | Human or application | Agent |
| Tool calls per session | 1 | 10–500+ |
| Cost predictability | High | Low |
| Human oversight | Per-request | Periodic check-in |

The result: a single MCP host session can cost more than thousands of traditional API calls — and the developer has no visibility into the running total until after the fact. For the broader argument about uncontrolled agent spend, see [The True Cost of Uncontrolled AI Agents](/blog/true-cost-of-uncontrolled-agents). For why post-hoc controls do not stop the next action, see [AI Agent Budget Control: Enforce Hard Spend Limits](/blog/ai-agent-budget-control-enforce-hard-spend-limits).

## Zero-Code Budget Enforcement via MCP

The key differentiator for MCP hosts: you do not need to write any code.

The Cycles MCP Server is added to the host's configuration file. The agent discovers it as a tool provider through MCP's standard tool discovery protocol. From that point, the agent has access to budget tools — `cycles_reserve`, `cycles_commit`, `cycles_release`, `cycles_check_balance`, `cycles_decide`, and more. No SDK. No wrapper functions. No changes to the agent or its code.

**Claude Code:**

```bash
claude mcp add cycles -- npx -y @runcycles/mcp-server
```

```bash
export CYCLES_API_KEY=cyc_live_...
export CYCLES_BASE_URL=http://localhost:7878
```

**Cursor / Windsurf:**

```json
{
  "mcpServers": {
    "cycles": {
      "command": "npx",
      "args": ["-y", "@runcycles/mcp-server"],
      "env": {
        "CYCLES_API_KEY": "cyc_live_...",
        "CYCLES_BASE_URL": "http://localhost:7878"
      }
    }
  }
}
```

**Claude Desktop:**

```json
{
  "mcpServers": {
    "cycles": {
      "command": "npx",
      "args": ["-y", "@runcycles/mcp-server"],
      "env": {
        "CYCLES_API_KEY": "cyc_live_...",
        "CYCLES_BASE_URL": "http://localhost:7878"
      }
    }
  }
}
```

That is the entire setup. No `pip install`. No npm dependency in the project. No code changes to the agent. The budget tools appear alongside the agent's other tools, and the agent can call them as part of its normal reasoning loop.

For local development without a running Cycles server, enable mock mode by setting `CYCLES_MOCK=true` — the server returns realistic responses with deterministic data, no API key required. For complete per-host setup instructions, see [Getting Started with the MCP Server](/quickstart/getting-started-with-the-mcp-server). For how the MCP server fits into the full stack, see [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together).

## Session-Level and Tool-Level Budget Enforcement

Two levels of enforcement matter for MCP host sessions:

### Session-level budget

Cap the total spend for an entire coding session. Before the first costly operation, the agent checks its session budget. Every subsequent tool call draws from this pool. When the pool is exhausted, the session winds down gracefully.

**Scope:** `tenant:dev-team/workflow:{session_id}` — budget of $10 for this session.

This is the ceiling. No matter how many tool calls the agent makes, no matter how many files it reads or tests it generates, the session cannot exceed $10.

### Tool-level budget

Each individual LLM call or expensive tool invocation gets its own reservation within the session scope. This prevents any single operation from consuming the whole session budget — a GPT-4o call with a 128k context window cannot drain the entire $10 in one step.

Here is how the two levels interact during a typical coding session:

```
Session starts → cycles_check_balance (remaining: $10.00)
  │
  ├─ Step 1:  cycles_reserve ($0.50) → ALLOW
  │           execute (read files, plan approach)
  │           cycles_commit ($0.32) → remaining: $9.68
  │
  ├─ Step 2:  cycles_reserve ($0.50) → ALLOW
  │           execute (generate code)
  │           cycles_commit ($0.41) → remaining: $9.27
  │
  ├─ ...steps 3-17 proceed normally...
  │           remaining: $1.80
  │
  ├─ Step 18: cycles_reserve ($0.50) → ALLOW_WITH_CAPS
  │           caps: { maxTokens: 500, maxStepsRemaining: 3 }
  │           execute with constraints → shorter response
  │           cycles_commit ($0.15) → remaining: $1.65
  │
  ├─ Step 19: cycles_reserve ($0.50) → ALLOW_WITH_CAPS
  │           caps: { maxTokens: 256, toolDenylist: ["web_search"] }
  │           execute with constraints
  │           cycles_commit ($0.10) → remaining: $1.55
  │
  └─ Step 20: cycles_reserve ($0.50) → DENY
              session winds down → agent summarizes work done
```

This flow happens within the agent's normal tool-calling loop. The developer sees the budget state reflected in the agent's output — "budget is getting tight, wrapping up" — and the session ends cleanly instead of running indefinitely.

For the six MCP integration patterns (simple reserve/commit, preflight, graceful degradation, long-running, fire-and-forget, multi-step), see [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp). For per-run and per-conversation budget recipes, see [Common Budget Patterns](/how-to/common-budget-patterns).

## The Three-Way Decision: What Happens When Budget Gets Tight

This is where MCP-based enforcement becomes more useful than a simple kill switch.

When the session budget is getting low, the runtime authority does not just deny — it returns `ALLOW_WITH_CAPS` with constraints the agent can use to self-regulate:

- **`maxTokens: 500`** — the agent generates shorter responses, completing the thought in fewer words
- **`maxStepsRemaining: 3`** — the agent knows to wrap up in three more steps, so it prioritizes finishing the current task over starting new ones
- **`toolDenylist: ["web_search", "code_execution"]`** — expensive tools are disabled, but the agent can still reason, read files, and provide answers
- **`cooldownMs: 5000`** — the agent slows down, waiting five seconds between operations to conserve budget for higher-value steps

Consider a concrete scenario: a developer is using Claude Code to refactor a payment service. The session has used $8 of a $10 budget. The next `cycles_reserve` returns `ALLOW_WITH_CAPS` with `maxStepsRemaining: 5` and `toolDenylist: ["web_search"]`. The agent:

1. Finishes the current refactoring task with shorter responses
2. Skips the "let me research best practices for payment idempotency" step it was planning
3. Commits the changes it has made so far
4. Tells the developer: "Session budget is nearly exhausted. I've completed the core refactoring. The idempotency improvements can be done in a follow-up session."

Without enforcement, the agent would have kept going — researching, generating, testing — until the developer checked the bill and found a $47 surprise.

| Decision | What the agent sees | What the agent does |
|---|---|---|
| `ALLOW` | Full budget available | Proceed normally — read files, generate code, run tests |
| `ALLOW_WITH_CAPS` | Budget getting tight, caps returned | Shorter responses, fewer tools, plan to wrap up |
| `DENY` | Budget exhausted | Stop gracefully, summarize work done, inform developer |

For the full protocol reference on the three-way decision model, see [Caps and the Three-Way Decision Model](/protocol/caps-and-the-three-way-decision-model-in-cycles). For designing degradation strategies, see [Degradation Paths: Deny, Downgrade, Disable, or Defer](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer).

## Wrapper vs. Authority: Why Config Beats Code

A natural objection: "Can I just put budget tracking in my agent's system prompt?"

Yes, you can tell the agent to count tokens and stop after a threshold. Some developers do this. But prompt-based budget tracking is a wrapper, not an authority. The agent is policing itself — and agents are not reliable self-policers.

Prompt-based tracking breaks in practice because:

- **Agents hallucinate token counts.** An agent told to "track your token usage" will estimate, round, lose count, or simply stop tracking after the context grows long enough.
- **Instructions degrade under long contexts.** A system prompt instruction to "stop after $10" competes with every other instruction in the context. In a 100k-token conversation, budget tracking is easily forgotten.
- **No atomicity.** If two concurrent sessions share a budget, prompt-based tracking cannot prevent both from spending simultaneously. Each agent sees its own estimate of what is left.
- **No enforcement.** The agent can choose to ignore its own tracking. A runtime authority cannot be ignored — it returns ALLOW or DENY, and the tool call does not happen.

The MCP-based approach is structurally different. The runtime authority is an external process with its own state, atomicity guarantees, and enforcement semantics. The agent calls `cycles_reserve` and gets back a decision. It cannot negotiate, hallucinate, or reason its way around that decision. The money is either available or it is not.

For the extended argument about why the gap between a wrapper and an authority is larger than it looks, see [Vibe Coding a Budget Wrapper vs. Owning a Runtime Authority](/blog/vibe-coding-budget-wrapper-vs-budget-authority).

## Next steps

- **[Getting Started with the MCP Server](/quickstart/getting-started-with-the-mcp-server)** — per-host configuration for Claude Desktop, Claude Code, Cursor, and Windsurf
- **[Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp)** — advanced patterns: preflight decisions, graceful degradation, long-running operations, fire-and-forget events
- **[Caps and the Three-Way Decision Model](/protocol/caps-and-the-three-way-decision-model-in-cycles)** — protocol reference for ALLOW, ALLOW_WITH_CAPS, and DENY
- **[End-to-End Tutorial](/quickstart/end-to-end-tutorial)** — walk through the complete reserve-commit lifecycle hands-on
- **[Vibe Coding a Budget Wrapper vs. Owning a Runtime Authority](/blog/vibe-coding-budget-wrapper-vs-budget-authority)** — why external runtime authority beats self-policing
