---
title: "Reservation Recovery and Listing in Cycles"
description: "How to list, filter, and recover reservations in Cycles when clients crash or lose reservation IDs. Includes query parameters and recovery strategies."
---

# Reservation Recovery and Listing in Cycles

In production systems, things go wrong.

A client crashes after creating a reservation but before storing the reservation ID. A network partition delays a commit. An operator needs to find stuck reservations that are holding budget.

The Cycles protocol provides two endpoints for these situations:

- `GET /v1/reservations` — list and filter reservations
- `GET /v1/reservations/{reservation_id}` — get details for a specific reservation

Both are optional in v0 deployments, but they are essential for production operations.

## Recovering a lost reservation ID

The most common recovery scenario: a client created a reservation, received the response, but crashed before persisting the `reservation_id`.

The reservation exists on the server. Budget is held. But the client has no way to commit or release it.

The solution is to query by idempotency key:

```
GET /v1/reservations?idempotency_key=my-unique-key-123
```

Since idempotency keys are unique per (effective tenant, endpoint, idempotency_key), this query returns at most one matching reservation.

The client recovers the `reservation_id` and can then commit or release as needed.

This is why idempotency keys should be generated and persisted before creating the reservation — they serve as the recovery handle.

## Listing reservations

The listing endpoint supports several filters:

### By status

```
GET /v1/reservations?status=ACTIVE
```

Reservation statuses are:

- **ACTIVE** — the reservation is live and budget is held
- **COMMITTED** — actual usage has been recorded
- **RELEASED** — the reservation was canceled and budget returned
- **EXPIRED** — the TTL (plus grace period) elapsed without commit or release

Filtering by `status=ACTIVE` is the most operationally useful — it shows all reservations currently holding budget.

### By subject fields

```
GET /v1/reservations?tenant=acme&app=support-bot
GET /v1/reservations?workflow=refund-assistant
```

Subject filters match against the canonical Subject fields: tenant, workspace, app, workflow, agent, and toolset.

Filtering on custom dimensions is out of scope for v0.

### By idempotency key

```
GET /v1/reservations?idempotency_key=run-abc-step-3
```

Returns at most one reservation matching the key. This is the primary recovery mechanism.

### Pagination

Responses are paginated:

- `limit` — maximum results per page (1–200, default 50)
- `cursor` — opaque cursor from a previous response
- `has_more` — whether more results exist
- `next_cursor` — cursor for the next page

## Getting reservation details

```
GET /v1/reservations/{reservation_id}
```

Returns the full state of a specific reservation:

- **reservation_id** — the unique identifier
- **status** — current lifecycle state (ACTIVE, COMMITTED, RELEASED, EXPIRED)
- **subject** — the original Subject (tenant, workspace, app, etc.)
- **action** — the original Action (kind, name, tags)
- **reserved** — the amount that was reserved
- **committed** — the amount that was committed (if status is COMMITTED)
- **created_at_ms** — when the reservation was created
- **expires_at_ms** — when the reservation expires (or expired)
- **finalized_at_ms** — when the reservation was committed, released, or expired
- **scope_path** — the canonical scope path
- **affected_scopes** — all scopes impacted by this reservation
- **idempotency_key** — the creation idempotency key (if the server persists it)
- **metadata** — any metadata attached to the reservation

This endpoint is useful for debugging specific reservations and understanding their full lifecycle.

## Tenancy enforcement

Both listing and detail endpoints enforce tenant isolation:

- results are scoped to the effective tenant derived from the API key
- if a `tenant` query parameter is provided, it must match the effective tenant
- attempting to get details for a reservation owned by a different tenant returns `403 FORBIDDEN`

A tenant cannot see or access another tenant's reservations.

## Use cases

### Stuck reservation detection

Periodically query `GET /v1/reservations?status=ACTIVE` and check for reservations with `expires_at_ms` in the past that have not yet been finalized.

These may indicate server-side cleanup delays or edge cases worth investigating.

### Budget leak investigation

When budget appears lower than expected, list active reservations to see what is currently held:

```
GET /v1/reservations?status=ACTIVE&tenant=acme&app=support-bot
```

This shows all live reservations holding budget for that app. High counts or large reserved amounts may explain the discrepancy.

### Post-incident analysis

After a budget incident, query reservations by workflow or agent to understand the pattern:

```
GET /v1/reservations?workflow=refund-assistant&status=COMMITTED
```

This shows all committed reservations for that workflow, which helps trace what consumed the budget.

### Client crash recovery

When a client restarts after a crash:

1. Check local state for any in-progress reservation IDs
2. For any missing IDs, query by the idempotency key that was generated before the reservation
3. For each recovered reservation, check its status:
   - **ACTIVE**: commit or release depending on whether work completed
   - **EXPIRED**: the budget was already returned; create a new reservation if work needs to continue
   - **COMMITTED** or **RELEASED**: no action needed

This recovery pattern depends on the client generating and persisting idempotency keys before creating reservations.

## Error conditions

### GET /v1/reservations (listing)

- `400 INVALID_REQUEST` — malformed query parameters
- `401 UNAUTHORIZED` — invalid API key
- `403 FORBIDDEN` — tenant mismatch

### GET /v1/reservations/{reservation_id} (detail)

- `401 UNAUTHORIZED` — invalid API key
- `403 FORBIDDEN` — reservation owned by a different tenant
- `404 NOT_FOUND` — reservation never existed
- `410 RESERVATION_EXPIRED` — reservation has expired

Note: the spec defines 410 for expired reservations on GET. However, the reference implementation returns `200` with `"status": "EXPIRED"` in the response body, so clients can inspect reservation details for debugging and recovery. Implementations may choose either behavior.

## Summary

The reservation listing and detail endpoints provide operational visibility and recovery capabilities:

- **Recovery**: query by idempotency key to recover lost reservation IDs
- **Monitoring**: list active reservations to understand what is holding budget
- **Debugging**: get full reservation details including status, amounts, scopes, and timestamps
- **Investigation**: filter by subject fields and status for post-incident analysis

These endpoints are optional in v0, but essential for production operations where client crashes, network issues, and budget investigations are a reality.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Python using the [Python Client](/quickstart/getting-started-with-the-python-client)
- Integrate with TypeScript using the [TypeScript Client](/quickstart/getting-started-with-the-typescript-client)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
