---
title: "How Events Work in Cycles: Direct Debit Without Reservation"
description: "Understand how Cycles events record usage directly without a reservation, for known-cost or externally sourced budget charges."
---

# How Events Work in Cycles: Direct Debit Without Reservation

The core Cycles lifecycle is reserve → execute → commit.

That pattern works well when the system can estimate exposure before execution, hold bounded room, and reconcile actual usage afterward.

But not every action fits that pattern.

Sometimes the cost is already known.
Sometimes the work already happened.
Sometimes reservation overhead is not justified.
Sometimes the system is recording usage from an external source that Cycles does not control.

That is where events come in.

## What events are

An event in Cycles is a direct debit against a budget scope — without creating a reservation first.

The API endpoint is `POST /v1/events`.

Instead of:

1. reserve
2. execute
3. commit

an event does:

1. record actual usage directly

The server applies the usage atomically across all derived scopes, just like a commit would, but without the preceding reservation step.

## When to use events

Events are useful when:

- the cost is already known before the call
- the action already completed outside of Cycles
- reservation overhead is not justified for the action class
- the system is importing historical or external usage into the budget ledger
- the action is low-risk and does not need pre-execution budget authorization

### Examples

- recording a model call that already happened through an external gateway
- importing usage from a billing provider into Cycles for unified budget tracking
- logging a known-cost action like sending an email or creating a ticket
- accounting for background work that was not instrumented with reserve/commit
- migrating from a legacy usage system into Cycles

## When not to use events

Events should not replace reservations for actions where pre-execution budget control matters.

If the system needs to:

- decide whether work is allowed before it runs
- hold bounded room before expensive execution
- protect against concurrent over-consumption
- enforce run-level or workflow-level budget ceilings proactively

then reserve → commit is the right pattern.

Events are post-hoc accounting. Reservations are pre-execution control.

Both are useful. They solve different problems.

## How events work in the protocol

An event request includes:

- **subject** — the budget scopes to charge (tenant, workspace, app, workflow, agent, toolset, dimensions)
- **action** — what happened (kind, name, optional tags)
- **actual** — the amount consumed (unit and amount)
- **idempotency_key** — ensures the same event is not recorded twice
- **overage_policy** — what happens if budget is insufficient (REJECT, ALLOW_IF_AVAILABLE, or ALLOW_WITH_OVERDRAFT)
- **metrics** — optional operational metadata (tokens_input, tokens_output, latency_ms, model_version, custom)
- **client_time_ms** — optional client-observed timestamp (advisory only, not used for budget enforcement)
- **metadata** — optional arbitrary key-value metadata for audit or debugging

The server applies the charge atomically across all derived scopes, or rejects the entire event.

On success, the response includes:

- `status: APPLIED`
- `event_id` — a unique identifier for the event
- `balances` — updated balance state for affected scopes

## Overage policies on events

Events support the same three overage policies as commits:

### REJECT (default)

If the actual amount exceeds the available budget, the event is rejected with `409 BUDGET_EXCEEDED`.

This is the safest default. It prevents any accounting that would put the scope into negative remaining.

### ALLOW_IF_AVAILABLE

If sufficient budget remains across all affected scopes, the full actual amount is applied atomically. If any scope has insufficient remaining, the entire event is rejected with `409 BUDGET_EXCEEDED`.

This is useful when the system should apply the charge only if fully covered, but not create debt.

### ALLOW_WITH_OVERDRAFT

If budget is insufficient, the system creates debt up to the scope's overdraft limit. If debt would exceed the overdraft limit, the event is rejected with `409 OVERDRAFT_LIMIT_EXCEEDED`.

This is useful for ensuring the ledger always reflects reality, even when budget is tight.

## Idempotency

Events are idempotent.

If the same `idempotency_key` is sent again with the same payload, the server returns the original response without applying the charge a second time.

If the same key is sent with a different payload, the server returns `409 IDEMPOTENCY_MISMATCH`.

This makes events safe under retries.

## Events vs reservations

| | Reservations | Events |
|---|---|---|
| Pre-execution control | Yes | No |
| Budget held before work | Yes | No |
| Commit/release lifecycle | Yes | No |
| Idempotent | Yes | Yes |
| Scope derivation | Yes | Yes |
| Overage policies | Yes | Yes |
| Best for | Actions with uncertain cost | Actions with known cost |

## A practical example

Suppose an external gateway processes a model call and reports back that it consumed 4,200 tokens.

The system can record this in Cycles with a single event:

- subject: tenant `acme`, app `support-bot`
- action: kind `llm.completion`, name `openai:gpt-4o-mini`
- actual: 4200 TOKENS
- overage_policy: ALLOW_IF_AVAILABLE

The server applies this charge across all derived scopes (tenant, app) and returns the updated balances.

No reservation was needed because the work already happened and the cost is already known.

## When to combine events with reservations

Many systems use both patterns.

For example:

- **reservations** for model calls and tool invocations that the system controls directly
- **events** for external usage imports, historical data, or low-cost background work

This gives the system pre-execution control where it matters most, and simple accounting everywhere else.

## Summary

Events provide a way to record known usage directly against budget scopes without the overhead of a reservation lifecycle.

They are useful for:

- known-cost actions
- external usage imports
- retroactive accounting
- low-risk actions where reservation is not justified

They support the same overage policies, idempotency, and scope derivation as reservations.

The key difference: reservations authorize work before it happens. Events record work after it happens.

Both are part of a complete Cycles deployment.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Python using the [Python Client](/quickstart/getting-started-with-the-python-client)
- Integrate with TypeScript using the [TypeScript Client](/quickstart/getting-started-with-the-typescript-client)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
