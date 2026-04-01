---
title: "What is Cycles?"
description: "Cycles is a runtime authority for autonomous agents that enforces hard spend limits on AI agents and workflows before expensive actions happen."
---

# What is Cycles?

Cycles is a **runtime authority for autonomous agents**. It enforces hard limits on agent spend and actions — **before they happen, not after**.

```python
@cycles(estimate=5000, action_kind="llm.completion", action_name="openai:gpt-4o")
def ask(prompt: str) -> str:
    return openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content
# Cycles are reserved before the action runs. If unavailable, execution is denied.
```

## The problem

Autonomous systems fail differently than traditional software. A runaway agent does not just burn dollars — **it creates unbounded exposure**.

That exposure can be financial: thousands of dollars in LLM calls accumulated before anyone notices. But it can just as easily be operational: records deleted, files overwritten, emails sent, orders placed, deployments triggered. In these cases, the damage is not measured primarily in cost, but in **consequence**.

Rate limiters control velocity — requests per second. They do not control total exposure: the cumulative cost, risk, or irreversible side effects a system is allowed to create before execution is halted. Nor do they constrain what each individual action is permitted to do.

> By the time an alert fires, the system has already acted. **Observation is useful for visibility. It is not enforcement.**

## See it in action

The [Demos](/demos/) page has self-contained scenarios you can run in 60 seconds — no LLM API key required:

- **Runaway Agent Demo** — same agent, same bug, two outcomes: without Cycles the agent burns ~$6 before being force-killed. With Cycles it stops cleanly at $1.00.
- **Action Authority Demo** — a support agent handles a billing dispute in four steps. Cycles allows internal actions but blocks the customer email before it executes.

## How Cycles solves it

Cycles enforces a budget decision before agent actions execute — LLM calls, tool invocations, API requests. Every action follows a **[Reserve-Commit lifecycle](/glossary#reservation)**:
> Cycles enforces where you instrument it. Uninstrumented code paths are unaffected.

```
1. Reserve    →  Lock estimated amount before the action runs
2. Execute    →  Call the LLM / tool / API
3. Commit     →  Record actual usage; unused budget is released automatically
```

If the budget is exhausted, the reservation is **denied before the action executes**.

::: code-group
```python [Python]
from runcycles import CyclesClient, CyclesConfig, cycles, set_default_client

client = CyclesClient(CyclesConfig.from_env())
set_default_client(client)

@cycles(estimate=5000, action_kind="llm.completion", action_name="openai:gpt-4o") # [!code focus]
def ask(prompt: str) -> str:
    return openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content

# Cycles are reserved before the action, committed after, released on failure.
result = ask("Summarize this document")
```
```typescript [TypeScript]
import { CyclesClient, CyclesConfig, withCycles, setDefaultClient } from "runcycles";

const client = new CyclesClient(CyclesConfig.fromEnv());
setDefaultClient(client);

const ask = withCycles( // [!code focus]
  { estimate: 5000, actionKind: "llm.completion", actionName: "openai:gpt-4o" }, // [!code focus]
  async (prompt: string) => {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0].message.content;
  },
);

const result = await ask("Summarize this document");
```
:::

## Key guarantees

| Guarantee | What it means |
|---|---|
| **Atomic reservation** | Budget is locked across all affected scopes in one operation — no partial locks |
| **Concurrency-safe** | Multiple agents sharing a budget cannot oversubscribe |
| **Idempotent** | Retries are safe; the same action cannot settle twice |
| **Pre-enforcement** | Budget is denied *before* the expensive action, not after |

## Multi-level scoping

Budgets are applied hierarchically. A single reservation can enforce limits at every level simultaneously:

```
tenant → workspace → app → workflow → agent → toolset
```

For example, a reservation with `tenant=acme, workspace=prod, app=chatbot` checks budget at:
- `tenant:acme`
- `tenant:acme/workspace:prod`
- `tenant:acme/workspace:prod/app:chatbot`

All three must have sufficient budget for the reservation to succeed.

## Architecture

```
┌──────────────────────────────┐
│      Your Application        │
│ @cycles / withCycles / MCP   │
└──────────────┬───────────────┘
               │ HTTP (port 7878)
               ▼
┌──────────────────────┐   ┌───────────────────────┐
│   Cycles Server      │   │  Cycles Admin Server  │
│ (runtime enforcement)│   │ (tenants/budgets/keys)│
│  Port 7878           │   │  Port 7979            │
└──────────┬───────────┘   └──────────┬────────────┘
           └──────────┬───────────────┘
                      ▼
             ┌──────────────────┐
             │     Redis 7+     │
             └────────┬─────────┘
                      │ BRPOP
                      ▼
             ┌──────────────────┐
             │  Events Service  │
             │  (webhooks, opt.)│
             │  Port 7980       │
             └──────────────────┘
```

Your application talks to the **Cycles Server** for runtime budget checks. The **Admin Server** manages tenants, API keys, and budget ledgers. The **Events Service** (optional) delivers webhook notifications asynchronously — see [Deploying the Events Service](/quickstart/deploying-the-events-service).

## Who uses Cycles

- **Platform teams** building multi-tenant agent runtimes
- **Framework authors** integrating budget enforcement into SDKs
- **Enterprise operators** needing audit-grade cost accountability
- **Teams building agents** that call paid APIs autonomously

## Choose your stack

Pick the quickstart that matches your environment:

| Stack | Guide | Time |
|-------|-------|------|
| **Python** | [Python Quickstart](/quickstart/getting-started-with-the-python-client) | ~5 min |
| **TypeScript / Node.js** | [TypeScript Quickstart](/quickstart/getting-started-with-the-typescript-client) | ~5 min |
| **Spring Boot / Java** | [Spring Boot Quickstart](/quickstart/getting-started-with-the-cycles-spring-boot-starter) | ~5 min |
| **Claude / Cursor / Windsurf** | [MCP Server Quickstart](/quickstart/getting-started-with-the-mcp-server) | ~3 min |
| **Full stack (Docker)** | [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) | ~10 min |

::: tip Not sure where to start?
Follow the [End-to-End Tutorial](/quickstart/end-to-end-tutorial) — it walks you from zero to a working budget-guarded app in 10 minutes.
:::

## Next steps

- [Choose a First Rollout](/quickstart/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails) — decide your adoption strategy
- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — how components interact
- [How Cycles Compares](/concepts/how-cycles-compares-to-rate-limiters-observability-provider-caps-in-app-counters-and-job-schedulers) — how Cycles compares to other alternatives

