---
title: "Error Codes and Error Handling in Cycles"
description: "Reference for all Cycles error codes and structured error responses, with guidance on handling each failure condition in client applications."
---

# Error Codes and Error Handling in Cycles

Cycles uses structured error responses with specific error codes for every failure condition.

Understanding these codes is essential for building a production integration. Each code tells the client exactly what happened and what to do about it.

## Error response format

Every error response follows the same structure:

```json
{
  "error": "BUDGET_EXCEEDED",
  "message": "Insufficient budget in scope tenant:acme",
  "request_id": "req-abc-123",
  "details": {}
}
```

- **error** — a machine-readable error code from the fixed enum
- **message** — a human-readable explanation
- **request_id** — a unique identifier for debugging and support
- **details** — optional additional context

## The error codes

Cycles defines 15 error codes, each with a specific HTTP status code and meaning.

### INVALID_REQUEST (400)

The request is malformed or missing required fields.

Common causes:

- missing required fields (subject, action, estimate, idempotency_key)
- Subject with only `dimensions` and no standard field (tenant, workspace, app, workflow, agent, toolset)
- field values exceeding length limits
- invalid parameter values

**What to do:** fix the request. This is not retryable without changes.

### UNAUTHORIZED (401)

The `X-Cycles-API-Key` header is missing or the API key is invalid.

**What to do:** check the API key configuration. Not retryable without a valid key.

### FORBIDDEN (403)

The request is authenticated but not authorized for the target resource.

Common causes:

- Subject.tenant does not match the effective tenant derived from the API key
- attempting to commit/release/extend a reservation owned by a different tenant
- querying balances for a different tenant

**What to do:** ensure the tenant in the Subject matches the API key's tenant. Not retryable without fixing the tenant mismatch.

### NOT_FOUND (404)

The specified reservation does not exist.

This is different from RESERVATION_EXPIRED — a 404 means the reservation was never created, while RESERVATION_EXPIRED means it existed but its TTL has passed.

**What to do:** verify the reservation ID. If the client lost the ID, use `GET /v1/reservations` with the `idempotency_key` filter to recover it.

### BUDGET_EXCEEDED (409)

Budget is insufficient for the requested operation.

This appears in three contexts:

1. **Reservation:** the scope does not have enough remaining budget for the estimate
2. **Commit with REJECT policy:** actual exceeds reserved
3. **Event with REJECT policy:** insufficient budget for the event amount

Note: commits with ALLOW_IF_AVAILABLE never return 409. Instead, the charge is capped to the available remaining budget.

**What to do:** depends on context:

- for reservations: degrade (smaller model, fewer tools), defer, or deny the action
- for commits: the work already happened — consider switching to ALLOW_IF_AVAILABLE or ALLOW_WITH_OVERDRAFT
- for events: adjust the amount or change the overage policy

### BUDGET_FROZEN (409)

The budget scope has been frozen by an operator. Operations that would modify the budget (reserve, commit, event) are rejected while the scope is frozen.

**What to do:** wait for the operator to unfreeze the budget, or escalate. Not retryable until the freeze is lifted.

### BUDGET_CLOSED (409)

The budget scope has been permanently closed. No further budget operations are allowed against this scope.

**What to do:** create a new budget scope or contact the operator. Not retryable against this scope.

### RESERVATION_EXPIRED (410)

The reservation's TTL plus grace period has elapsed.

The reservation has been finalized as EXPIRED and its budget has been returned to the pool. The spec defines this error for commit, release, extend, and GET. The reference implementation returns `200` with `"status": "EXPIRED"` on GET instead, allowing clients to inspect expired reservation details for debugging.

**What to do:** create a new reservation if the work still needs to proceed. If the work already completed, the usage may need to be recorded as an event instead.

### RESERVATION_FINALIZED (409)

An operation was attempted on a reservation that is already in a terminal state (COMMITTED or RELEASED).

This typically happens when trying to extend a reservation that has already been committed.

**What to do:** no action needed on the reservation. If the extend was meant to keep a different reservation alive, check the reservation ID.

### IDEMPOTENCY_MISMATCH (409)

The same idempotency key was used with a different request payload.

This means the client sent a request with an idempotency key that was already used for a different operation.

**What to do:** use a unique idempotency key for each distinct operation. If this is a legitimate retry, ensure the request payload matches the original exactly.

### UNIT_MISMATCH (400)

The unit in the request does not match the expected unit.

Common causes:

- committing with a different unit than the reservation was created with (e.g., reserving in TOKENS, committing in USD_MICROCENTS)
- creating an event with a unit not supported for the target scope

**What to do:** ensure the unit is consistent across the reservation lifecycle. Check that the commit or event uses the same unit as the reservation or scope.

### OVERDRAFT_LIMIT_EXCEEDED (409)

Appears in two contexts:

1. **During commit:** when `overage_policy=ALLOW_WITH_OVERDRAFT` and `(current_debt + delta) > overdraft_limit`
2. **During reservation:** when the scope is in over-limit state (`is_over_limit=true`) due to prior concurrent commits pushing debt past the limit

**What to do:**

- if during commit: the debt limit has been reached. The work already happened. An operator needs to fund the scope.
- if during reservation: the scope is blocked. Wait for debt to be repaid, or escalate to an operator. The client should retry with exponential backoff.

### DEBT_OUTSTANDING (409)

A new reservation was attempted against a scope that has outstanding debt (debt > 0).

Even if the scope has not exceeded its overdraft limit, any debt blocks new reservations until it is repaid.

**What to do:** wait for debt to be repaid through budget funding. Retry with exponential backoff, or escalate to an operator.

Note: when `is_over_limit=true`, the server returns `OVERDRAFT_LIMIT_EXCEEDED` instead of `DEBT_OUTSTANDING`, even if debt > 0. `OVERDRAFT_LIMIT_EXCEEDED` takes precedence.

### MAX_EXTENSIONS_EXCEEDED (409)

The tenant's `max_reservation_extensions` limit has been reached for this reservation. No further extensions are allowed.

**What to do:** commit or release the reservation. If more time is needed, create a new reservation after committing the current one.

### INTERNAL_ERROR (500)

An unexpected server error occurred.

**What to do:** retry with exponential backoff. If the error persists, contact the Cycles server operator.

## Error handling by operation

### Reserve errors

| Error | HTTP | Meaning |
|---|---|---|
| BUDGET_EXCEEDED | 409 | Insufficient budget |
| BUDGET_FROZEN | 409 | Budget scope is frozen |
| BUDGET_CLOSED | 409 | Budget scope is permanently closed |
| OVERDRAFT_LIMIT_EXCEEDED | 409 | Scope is over-limit |
| DEBT_OUTSTANDING | 409 | Scope has unresolved debt |
| IDEMPOTENCY_MISMATCH | 409 | Same key, different payload |
| INVALID_REQUEST | 400 | Malformed request |
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Tenant mismatch |

### Decide errors

| Error | HTTP | Meaning |
|---|---|---|
| INVALID_REQUEST | 400 | Malformed request |
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Tenant mismatch |
| IDEMPOTENCY_MISMATCH | 409 | Same key, different payload |

Note: decide returns `200` with `decision: DENY` for budget or debt conditions, not a `409` error.

### Commit errors

| Error | HTTP | Meaning |
|---|---|---|
| BUDGET_EXCEEDED | 409 | Actual exceeds budget (REJECT only) |
| BUDGET_FROZEN | 409 | Budget scope is frozen |
| BUDGET_CLOSED | 409 | Budget scope is permanently closed |
| OVERDRAFT_LIMIT_EXCEEDED | 409 | Debt would exceed limit (ALLOW_WITH_OVERDRAFT) |
| RESERVATION_EXPIRED | 410 | Past TTL + grace period |
| RESERVATION_FINALIZED | 409 | Already committed or released |
| UNIT_MISMATCH | 400 | Unit differs from reservation |
| NOT_FOUND | 404 | Reservation never existed |
| IDEMPOTENCY_MISMATCH | 409 | Same key, different payload |
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Reservation owned by different tenant |

### Release errors

| Error | HTTP | Meaning |
|---|---|---|
| RESERVATION_EXPIRED | 410 | Past TTL + grace period |
| RESERVATION_FINALIZED | 409 | Already committed or released |
| IDEMPOTENCY_MISMATCH | 409 | Same key, different payload |
| NOT_FOUND | 404 | Reservation never existed |
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Reservation owned by different tenant |

### Extend errors

| Error | HTTP | Meaning |
|---|---|---|
| INVALID_REQUEST | 400 | Missing or invalid fields |
| RESERVATION_EXPIRED | 410 | Past TTL (no grace period for extend) |
| RESERVATION_FINALIZED | 409 | Already committed or released |
| MAX_EXTENSIONS_EXCEEDED | 409 | Tenant max_reservation_extensions limit reached |
| IDEMPOTENCY_MISMATCH | 409 | Same key, different payload |
| NOT_FOUND | 404 | Reservation never existed |
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Reservation owned by different tenant |

### Event errors

| Error | HTTP | Meaning |
|---|---|---|
| BUDGET_EXCEEDED | 409 | Insufficient budget (REJECT only) |
| BUDGET_FROZEN | 409 | Budget scope is frozen |
| BUDGET_CLOSED | 409 | Budget scope is permanently closed |
| OVERDRAFT_LIMIT_EXCEEDED | 409 | Debt would exceed limit (ALLOW_WITH_OVERDRAFT) |
| UNIT_MISMATCH | 400 | Unit not supported for scope |
| INVALID_REQUEST | 400 | Malformed request |
| UNAUTHORIZED | 401 | Invalid API key |
| FORBIDDEN | 403 | Tenant mismatch |
| IDEMPOTENCY_MISMATCH | 409 | Same key, different payload |

## Idempotency and error handling

Errors interact with idempotency in specific ways:

- **Successful replay:** if you retry a request with the same idempotency key and payload, you get the original successful response. The operation is not applied again.
- **Payload mismatch:** if you reuse a key with a different payload, you get `409 IDEMPOTENCY_MISMATCH`.
- **Failed original:** if the original request failed (e.g., BUDGET_EXCEEDED), retrying with the same key sends a fresh request. Idempotency only applies to successful operations.

## The request_id field

Every error response includes a `request_id`.

This is a server-generated identifier useful for:

- correlating errors with server logs
- debugging with the Cycles server operator
- tracking specific failures in client-side monitoring

Log the request_id when handling errors.

## Summary

Cycles provides 15 specific error codes that tell the client exactly what went wrong:

- **400** for request validation issues (INVALID_REQUEST, UNIT_MISMATCH)
- **401** for authentication failures (UNAUTHORIZED)
- **403** for authorization failures (FORBIDDEN)
- **404** for missing reservations (NOT_FOUND)
- **409** for budget and state conflicts (BUDGET_EXCEEDED, BUDGET_FROZEN, BUDGET_CLOSED, OVERDRAFT_LIMIT_EXCEEDED, DEBT_OUTSTANDING, RESERVATION_FINALIZED, IDEMPOTENCY_MISMATCH, MAX_EXTENSIONS_EXCEEDED)
- **410** for expired reservations (RESERVATION_EXPIRED)
- **500** for server errors (INTERNAL_ERROR)

Handling these codes correctly is the difference between a fragile integration and a production-grade one.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Python using the [Python Client](/quickstart/getting-started-with-the-python-client)
- Integrate with TypeScript using the [TypeScript Client](/quickstart/getting-started-with-the-typescript-client)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
