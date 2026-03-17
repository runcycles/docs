---
title: "What is Cycles?"
description: "Cycles is a budget authority for autonomous execution that enforces hard spend limits on AI agents and workflows before expensive actions happen."
---

# What is Cycles?

Cycles is a **budget authority for autonomous execution**. It enforces hard limits on agent spend and actions — **before they happen, not after**.

```python
@cycles(estimate=5000, action_kind="llm.completion", action_name="openai:gpt-4o")
def ask(prompt: str) -> str:
    return openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content
# Budget is reserved before the call. If exhausted, the call is blocked — not billed.
```

## The problem

Autonomous systems fail differently than traditional software. A runaway agent does not just burn dollars — **it creates unbounded exposure**.

That exposure can be financial: thousands of dollars in LLM calls accumulated before anyone notices. But it can just as easily be operational: records deleted, files overwritten, emails sent, orders placed, deployments triggered. In these cases, the damage is not measured primarily in cost, but in **consequence**.

Rate limiters control velocity — requests per second. They do not control total exposure: the cumulative cost, risk, or irreversible side effects a system is allowed to create before execution is halted. Nor do they constrain what each individual action is permitted to do.

By the time an alert fires, the system has already acted. **Observation is useful for visibility. It is not enforcement.**

## See it in action

The [Runaway Agent Demo](https://github.com/runcycles/cycles-runaway-demo) shows this failure mode — and Cycles preventing it — in under 60 seconds. No LLM API key required.

```bash
git clone https://github.com/runcycles/cycles-runaway-demo
cd cycles-runaway-demo
python3 -m venv .venv && source .venv/bin/activate
pip install -r agent/requirements.txt
./demo.sh # [!code focus]
```

Same agent. Same bug. Two outcomes: without Cycles the agent burns ~$6 in 30 seconds. With Cycles it stops cleanly at $1.00.

## How Cycles solves it

Cycles enforces a budget decision before agent actions execute — LLM calls, tool invocations, API requests. Every action follows a **Reserve-Commit lifecycle**:
> Cycles enforces where you instrument it. Uninstrumented code paths are unaffected.

```
1. Reserve    →  Lock estimated cost before the action runs
2. Execute    →  Call the LLM / tool / API
3. Commit     →  Record actual cost; unused budget is released automatically
```

If the budget is exhausted, the reservation is **denied before any money is spent**.

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

# Budget is reserved before the call, committed after, released on failure.
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
│  @cycles / withCycles / HTTP │
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
             ┌──────────────┐
             │   Redis 7+   │
             └──────────────┘
```

Your application talks to the **Cycles Server** for runtime budget checks. The **Admin Server** manages tenants, API keys, and budget ledgers.

## Who uses Cycles

- **Platform teams** building multi-tenant agent runtimes
- **Framework authors** integrating budget enforcement into SDKs
- **Enterprise operators** needing audit-grade cost accountability
- **Teams building agents** that call paid APIs autonomously

## Next steps

- [End-to-End Tutorial](/quickstart/end-to-end-tutorial) — zero to a working budget-guarded app in 10 minutes
- [Choose a First Rollout](/quickstart/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails) — decide your adoption strategy
- [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) — set up the Cycles infrastructure
- [Python Quickstart](/quickstart/getting-started-with-the-python-client) — add Cycles to a Python app
- [TypeScript Quickstart](/quickstart/getting-started-with-the-typescript-client) — add Cycles to a TypeScript app
- [Spring Boot Quickstart](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — add Cycles to a Spring app
- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — how components interact
- [How Cycles Compares](/concepts/how-cycles-compares-to-rate-limiters-observability-provider-caps-in-app-counters-and-job-schedulers) — how Cycles compares to other alternatives

