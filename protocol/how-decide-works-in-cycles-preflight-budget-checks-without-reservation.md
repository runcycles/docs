# How Decide Works in Cycles: Preflight Budget Checks Without Reservation

Sometimes a system needs to know whether an action would be allowed before committing to it.

Not to reserve budget.
Not to begin execution.
Just to ask: **is there room?**

That is what the decide endpoint does.

## What decide is

`POST /v1/decide` evaluates a budget request against current scope balances and returns a decision — without creating a reservation or modifying any budget state.

It is a read-only preflight check.

The response tells you:

- **ALLOW** — sufficient budget exists
- **ALLOW_WITH_CAPS** — sufficient budget exists, but soft constraints apply
- **DENY** — insufficient budget or policy block

No budget is held. No reservation is created. No commit or release is needed afterward.

## When to use decide

Decide is useful when the system needs budget awareness without budget commitment.

### 1. UI gating

Before showing an action button to a user, the frontend can check whether the action would be allowed under current budget.

If the answer is DENY, the UI can disable the button, show a warning, or suggest a cheaper alternative.

### 2. Planning and routing

An agent or orchestrator may need to decide between multiple possible actions based on budget availability.

Decide lets the system evaluate options without locking budget for all of them.

### 3. Pre-validation before expensive setup

Some workflows require setup steps before the actual model or tool call. Decide lets the system check budget feasibility before investing in that setup.

### 4. Soft-landing signals

The decide endpoint can return caps (via ALLOW_WITH_CAPS) that signal the system should adjust its behavior — use fewer tokens, avoid certain tools, or slow down — without denying execution outright.

### 5. Dashboard and operator visibility

Operators can use decide to evaluate hypothetical scenarios against live budget state without affecting production accounting.

## How decide works in the protocol

A decide request includes:

- **subject** — the budget scopes to evaluate (tenant, workspace, app, workflow, agent, toolset, dimensions)
- **action** — the proposed action (kind, name, optional tags)
- **estimate** — the amount the action would need
- **idempotency_key** — for request deduplication

The server evaluates the request against current balances and returns:

- **decision** — ALLOW, ALLOW_WITH_CAPS, or DENY
- **caps** — soft constraints (only present when decision is ALLOW_WITH_CAPS)
- **reason_code** — machine-readable reason when decision is DENY
- **retry_after_ms** — optional guidance on when to retry
- **affected_scopes** — which scopes were evaluated

## Decide does not guarantee future reservation

An important subtlety: decide is a point-in-time evaluation.

If decide returns ALLOW at time T, a subsequent reservation at time T+1 may still fail if concurrent activity consumed budget in between.

Decide is advisory. It reflects current state, not a promise about future state.

For guaranteed budget holds, use reservations.

## Decide and debt/overdraft

When a scope has outstanding debt or is in over-limit state, decide returns `DENY` with an appropriate reason code.

Unlike reservations, decide does not return `409` errors for debt or over-limit conditions. It always returns a `200` response with a decision value.

This makes decide safe to call in any context without needing error handling for budget state issues.

## Decide vs dry_run

Both decide and `dry_run: true` on a reservation request evaluate budget without modifying state. But they serve different purposes:

- **decide** is a lightweight check that returns a decision and optional caps
- **dry_run** evaluates the full reservation path including scope derivation, affected scopes, and balance snapshots

Use decide for quick feasibility checks. Use dry_run for full shadow-mode evaluation of reservation logic.

## A practical example

An agent is planning its next step. It has two options:

1. Call a large model (estimated 8,000 tokens)
2. Call a smaller model (estimated 2,000 tokens)

Before choosing, the agent calls decide for each option:

- Option 1: decide returns DENY (run budget is too low)
- Option 2: decide returns ALLOW

The agent routes to the smaller model without ever creating a reservation for the larger one.

This avoids wasting budget on reservation overhead for paths that would be denied.

## When not to use decide

Decide is not a substitute for reservations.

If the system needs:

- guaranteed budget holds before execution
- concurrency-safe budget enforcement
- commit/release lifecycle tracking

then create a reservation instead.

Decide is for asking questions. Reservations are for taking action.

## Summary

Decide provides a read-only preflight check against live budget state.

It helps systems:

- gate actions before committing to them
- route between alternatives based on budget availability
- check feasibility without locking budget
- receive soft-landing signals via caps

It is advisory, not binding. For guaranteed budget holds, use reservations.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
