---
title: "LangGraph Budget Control: Bounding Durable Execution, Retries, and Fan-Out"
date: 2026-03-22
author: Cycles Team
tags: [langgraph, budgets, engineering, durable-execution, best-practices]
description: "LangGraph runs pause, resume, retry, and fan out. Without node-level budget reservations, durable execution turns cost spikes into cost cliffs."
blog: true
sidebar: false
---

# LangGraph Budget Control: Bounding Durable Execution, Retries, and Fan-Out

A team builds an insurance claim processor in LangGraph. The graph has six nodes — classify, extract, validate, enrich, review, decide — with checkpointing enabled so runs can pause and resume. It works well in development.

In production, a batch of 200 claims kicks off on Tuesday morning. The "enrich" node hits a third-party rate limit. LangGraph's retry logic resumes from the last checkpoint and replays the node. But the retry re-executes the upstream nodes too — classify, extract, validate — because the checkpoint was saved before all three committed. Each replay costs $0.45 per claim. Across 200 claims, that is $270 in duplicate spend on top of the original $180. Total bill: $450 instead of $180.

Then it gets worse. Twelve claims trigger the "review" node to fan out into four parallel sub-graphs — one per policy type. Each sub-graph retries independently when it encounters the same rate limit. Fan-out multiplies the cost exposure by 4× per claim. Those 12 claims alone burn through $960 in an hour.

The provider dashboard shows the spike at 6 PM when someone checks. The team's $500/month spending cap hasn't triggered — it's March 4th, and the monthly total is only at $1,410.

Durable execution makes agents more reliable. It also makes cost failures more expensive — because every retry, resume, and fan-out replays work that already cost money.

<!-- more -->

## Why Durable Execution Changes the Budget Problem

One-shot agents have a simple cost model: one pass through the workflow, one bill. If the run fails, you lose that run's cost. The waste is bounded.

Durable graph agents — whether built on LangGraph, Temporal, or Restate — break this model. Runs checkpoint, pause, resume, retry, and branch. The cost of a single logical run is not "one pass." It is the sum of every attempt, across every checkpoint, across every branch.

Three properties of durable execution change how budget exposure works:

**Checkpoints create replay surfaces.** When a graph resumes from a checkpoint, it can re-execute nodes that already consumed tokens and triggered side effects. If the budget system does not know which nodes already ran, it cannot prevent double-charging.

**Retries compound across graph depth.** A retry at the graph level replays multiple nodes. A retry at the node level replays multiple LLM calls within that node. If both layers have retry policies, the total cost is the product, not the sum. A 3× graph retry with 3× node retry produces up to 9× the expected cost for a single pass.

**Fan-out multiplies exposure.** Parallel branches in a graph execute concurrently, each consuming budget independently. Four branches sharing a $40 budget can each see "$40 remaining," each proceed, and spend $160 total — because a simple balance check is not an atomic reservation.

| Property | One-shot agent | Durable graph agent |
|---|---|---|
| Retry cost | Replays full run | Replays from checkpoint — may re-execute completed nodes |
| Fan-out cost | Sequential, predictable | Parallel, multiplicative |
| Failure blast radius | One run's budget | Accumulated spend across all attempts |
| Budget check timing | Before each LLM call | Before each LLM call + before each node + before each retry |
| Concurrency risk | Low (single thread) | High (parallel branches, shared budget) |

This is not a theoretical concern. It is the default behavior of any graph-based agent framework with persistence and retry logic enabled. The framework does its job — making execution reliable. The missing piece is making execution **bounded**.

## The Four Budget Problems in LangGraph Workflows

Each problem maps to a specific failure mode in graph-based execution.

### 1. Replayed nodes re-spend

A graph resumes from a checkpoint after a transient failure. The upstream nodes — which already ran, consumed tokens, and produced results — execute again. Each replay triggers real LLM calls with real cost. Without idempotent cost tracking, you pay twice for work that already succeeded.

This is invisible in simple testing because you rarely resume from checkpoints during development. It surfaces in production when your persistence layer is doing exactly what it should: recovering gracefully from failures.

### 2. Retry storms at graph depth

LangGraph supports retry policies at multiple levels: individual tool calls, node-level retries, and graph-level restarts. Each layer is reasonable in isolation. Together, they multiply.

A graph with 3 retries per node and 3 retries per graph can produce up to 9 executions of a single node. Add an SDK-level retry on transient HTTP errors (another 3×), and you are looking at 27 executions of a node you expected to run once. At $0.45 per node execution, a $0.45 step becomes a $12.15 step.

This is the same geometric multiplication pattern behind the [retry storm failure that cost $1,800 in 12 minutes](/blog/ai-agent-failures-budget-controls-prevent). Durable execution does not prevent retry storms — it makes them more likely, because the framework is designed to keep trying.

### 3. Fan-out branches racing for shared budget

A LangGraph node fans out into four parallel sub-graphs. Each sub-graph checks the remaining budget before starting. All four see "$40 remaining" because they check concurrently. All four proceed. Total spend: $160.

This is the concurrency problem that breaks every application-level budget checker. A variable in memory, a row in a database, even a Redis counter — none of these provide the atomic reserve-and-deduct semantics needed when multiple branches spend from the same budget simultaneously. The fundamental issue is that [a checker is not an authority](/blog/vibe-coding-budget-wrapper-vs-budget-authority).

### 4. Checkpoint-unaware budget state

If budget tracking lives in application memory — a counter, a running total, a class variable — it is lost when the process restarts. LangGraph checkpoints the graph state. It does not checkpoint your budget counter.

When the graph resumes from a checkpoint, the agent's state is restored. The budget counter resets to zero. The actual spend does not. The agent now believes it has a full budget and proceeds to spend it again.

This failure mode is unique to durable execution. One-shot agents don't survive process restarts, so in-memory budget tracking, while fragile, at least fails safely — the agent dies with the process. Durable agents survive restarts by design. Their budget tracking must survive too.

## The Pattern: Reserve at the Node, Settle at the Edge

The [reserve-commit lifecycle](/blog/ai-agent-budget-control-enforce-hard-spend-limits) already solves the core problem of pre-execution budget enforcement. For durable graph execution, the same pattern applies — but scoped to the graph's structure:

**Run-level budget.** A total ceiling for the entire graph execution, including all retries and fan-outs. This is the outer bound. No combination of retries, replays, or parallel branches can exceed it.

**Node-level reservation.** Before each node executes, reserve the estimated cost from the run budget. The reservation is atomic — if the budget is insufficient, the node does not start. The run receives a clear budget-exhausted signal instead of silently proceeding.

**Idempotent commit.** When a node completes, commit the actual cost with a unique execution identifier (run ID + node ID + attempt number). If the same node replays on retry or resume, the commit operation recognizes the duplicate and does not charge again. The node ran once; it pays once.

**Retry-safe settlement.** On retry, check whether a reservation for this node-execution already exists. If it was committed (node completed successfully), skip the reservation — the cost is already settled. If it was reserved but never committed (the process crashed mid-execution), release the stale reservation and create a fresh one.

**Fan-out budget scoping.** Each parallel branch receives a sub-budget carved atomically from the parent budget. Branch A gets $10, Branch B gets $10, Branch C gets $10, Branch D gets $10. The parent's budget decreases by $40 in a single atomic operation. No branch can overspend because each sub-budget is a hard ceiling, not a shared pool.

| LangGraph event | Budget action | What it prevents |
|---|---|---|
| Graph start | Create run budget | Unbounded total spend |
| Node entry | Reserve from run budget | Node executing without budget |
| LLM call within node | Check reservation covers call | Mid-node overrun |
| Node completion | Commit actual cost (idempotent) | Double-charging on replay |
| Node failure + retry | Release uncommitted reservation, re-reserve | Leaked reservations |
| Fan-out (parallel branches) | Allocate sub-budgets from parent | Concurrent overspend |
| Fan-in (join) | Reconcile sub-budget actuals to parent | Accounting drift |
| Graph completion | Settle run budget, release unused | Over-reservation |

## What This Looks Like in Practice

Cycles integrates with LangChain and LangGraph through a callback handler that wraps every LLM call with a reservation. The handler creates a reservation on `on_llm_start`, commits on `on_llm_end`, and releases on `on_llm_error`:

```python
from langchain_openai import ChatOpenAI
from runcycles import CyclesClient, CyclesConfig, Subject

client = CyclesClient(CyclesConfig.from_env())

handler = CyclesBudgetHandler(
    client=client,
    subject=Subject(
        tenant="acme",
        workflow="claims-processing",
        agent="classifier",
    ),
)

llm = ChatOpenAI(model="gpt-4o", callbacks=[handler])
```

Every LLM call the graph makes — across nodes, retries, and fan-out branches — gets a pre-execution budget check. The handler tracks reservations by LangChain's `run_id`, so concurrent calls within parallel branches are handled correctly.

For fan-out, each sub-graph uses a scoped subject with its own budget allocation:

```python
# Parent carves sub-budgets for parallel branches
for branch in ["liability", "medical", "property", "general"]:
    branch_handler = CyclesBudgetHandler(
        client=client,
        subject=Subject(
            tenant="acme",
            workflow="claims-processing",
            agent=f"review-{branch}",
        ),
    )
    # Each branch is budget-bounded independently
    run_branch(state, callbacks=[branch_handler])
```

Idempotency keys on reservations and commits ensure that replayed nodes do not double-charge. The key includes the run ID, node ID, and attempt number — so a retried node creates a new reservation, while a replayed-from-checkpoint node recognizes the existing commit.

For the full callback handler implementation and runnable examples, see [Integrating Cycles with LangChain](/how-to/integrating-cycles-with-langchain).

## What Happens Without Node-Level Budget Control

The difference is not subtle. It is the difference between a cost surprise and a cost bound.

| Scenario | Without node-level control | With Cycles |
|---|---|---|
| Graph resumes from checkpoint | All nodes re-execute, full cost repeated | Idempotent commit skips already-settled nodes |
| 3-level nested retry | Up to 27× cost multiplier (3×3×3) | Run budget caps total across all retries |
| 4-way fan-out, $40 remaining | All 4 branches proceed, $160 spent | Sub-budgets: 4 × $10, total capped at $40 |
| Process crash mid-node | Reservation leaked, budget permanently reduced | Uncommitted reservation auto-released on retry |
| Overnight batch of 500 graph runs | No per-run limit, total cost unknown until morning | Each run bounded, batch total = sum of run budgets |

The insurance claim processor from the opening scenario would have stopped at $180. The retry replays would have been idempotent — committed nodes would not re-charge. The fan-out branches would have received sub-budgets. The run-level ceiling would have prevented any single execution from exceeding its allocation.

## Next steps

- [Integrating Cycles with LangChain](/how-to/integrating-cycles-with-langchain) — full callback handler implementation for LangChain and LangGraph
- [AI Agent Budget Control: Enforce Hard Spend Limits](/blog/ai-agent-budget-control-enforce-hard-spend-limits) — the reserve-commit pattern in depth
- [5 Real-World AI Agent Failures That Budget Controls Would Have Prevented](/blog/ai-agent-failures-budget-controls-prevent) — retry storm and infinite loop cost math
- [You Can Vibe Code a Budget Wrapper](/blog/vibe-coding-budget-wrapper-vs-budget-authority) — why a checker is not enough when agents fan out
- [Multi-Tenant AI Cost Control](/blog/multi-tenant-ai-cost-control-per-tenant-budgets-quotas-isolation) — per-tenant budgets for teams running LangGraph in multi-tenant platforms
