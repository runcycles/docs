---
title: "Concurrent Agent Overspend"
description: "How concurrent agents sharing a budget can collectively exceed limits due to race conditions, and how Cycles prevents it."
---

# Concurrent Agent Overspend

A failure mode where multiple agents sharing a budget each pass local checks but collectively exceed the limit.

## The incident

A platform runs 5 agents concurrently, all spending against the same team budget of $10. Each agent checks the remaining balance before making a call and sees $8 remaining. All 5 proceed simultaneously, each spending $3. Total spend: $15 — exceeding the $10 budget by 50%.

### The race condition

```
Time 0: Budget = $10.00
Agent A checks balance → $10.00 remaining → proceeds
Agent B checks balance → $10.00 remaining → proceeds
Agent C checks balance → $10.00 remaining → proceeds
Agent D checks balance → $10.00 remaining → proceeds
Agent E checks balance → $10.00 remaining → proceeds

All 5 agents call LLM simultaneously, each spending ~$3.00

Time 1: Budget = $10.00 - $15.00 = -$5.00 (overspent)
```

### Why read-then-act doesn't work

The check-then-spend pattern is a classic [TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use) race. The balance read is stale by the time the spend occurs. This is true even with database transactions — unless the balance check and the deduction are atomic.

### Without Cycles

Application-level balance checks are not concurrency-safe. Even "careful" implementations using database locks often miss edge cases under high concurrency.

### With Cycles

Cycles reservation is **atomically concurrency-safe**. Each reservation locks the requested amount across all affected scopes in a single Redis Lua script. No partial locks, no race conditions:

```
Time 0: Budget = $10.00
Agent A reserves $3.00 → ALLOW ($7.00 remaining, $3.00 reserved)
Agent B reserves $3.00 → ALLOW ($4.00 remaining, $6.00 reserved)
Agent C reserves $3.00 → ALLOW ($1.00 remaining, $9.00 reserved)
Agent D reserves $3.00 → DENY  (only $1.00 remaining)
Agent E reserves $3.00 → DENY  (only $1.00 remaining)
```

Agents D and E are denied *before any LLM call is made*. The budget is never exceeded.

## Key points

- **Balance reads are informational, not authoritative.** Querying `/v1/balances` tells you the current state, but it does not reserve anything. Two agents can read the same balance and both decide to spend.
- **Reservations are authoritative.** A successful reservation guarantees the budget is locked for that agent. Other agents see the reduced remaining balance.
- **The `remaining` field accounts for reservations.** It equals `allocated - spent - reserved - debt`. Active reservations reduce `remaining` even before they commit.

## Real-world scenarios

This pattern appears in:

- **Multi-agent workflows** where agents share a team or project budget
- **Webhook-triggered processing** where multiple events arrive simultaneously
- **Batch processing** with parallel workers
- **Auto-scaling** where new instances start making calls before the budget is recalculated

## Prevention

1. **Always reserve before spending.** Never rely on balance reads for authorization.
2. **Use hierarchical scopes.** Even if agents have individual budgets, a shared parent scope acts as a hard cap.
3. **Design for denial.** Agents that can't reserve budget should degrade gracefully, not crash.

## Next steps

- [Idempotency, Retries and Concurrency](/concepts/idempotency-retries-and-concurrency-why-cycles-is-built-for-real-failure-modes) — how Cycles handles concurrency
- [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles) — hierarchical budget enforcement
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — handling denial gracefully
