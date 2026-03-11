# Reservation TTL, Grace Period, and Extend in Cycles

Reservations in Cycles do not live forever.

Every reservation has a time-to-live (TTL). When the TTL expires, the reservation is released automatically, and the held budget returns to the available pool.

This is by design.

Without TTL, a crashed client or lost network connection could lock budget indefinitely. That would create phantom consumption — budget that appears used but is not serving any real work.

TTL prevents that. But it also creates a design question: how should long-running work keep its reservation alive?

That is where extend comes in.

## How TTL works

When a reservation is created, the server sets an expiration time:

```
expires_at_ms = created_at_ms + ttl_ms
```

The default TTL is 60 seconds (`ttl_ms: 60000`).

The allowed range is 1 second to 24 hours (`1000` to `86400000` milliseconds).

When the clock passes `expires_at_ms`, the reservation enters expiration processing. If it has not been committed or released, the server marks it as `EXPIRED` and returns the reserved budget to the available pool.

## How grace period works

Real systems have in-flight operations. A commit request may be in transit when the TTL expires.

The grace period provides a short window after TTL expiration during which commits and releases are still accepted:

```
hard_expiry = expires_at_ms + grace_period_ms
```

The default grace period is 5 seconds (`grace_period_ms: 5000`).

The allowed range is 0 to 60 seconds (`0` to `60000` milliseconds).

During the grace period:

- commit and release are still accepted
- extend is not accepted (the reservation must be extended before TTL expires)

After the grace period, the reservation is finalized as `EXPIRED`. Any attempt to commit or release returns `410 RESERVATION_EXPIRED`.

### Why the grace period maximum is 60 seconds

The 60-second ceiling is an interoperability constraint. Longer grace periods would extend the window during which a crashed client can keep budget locked, increasing the risk of zombie reservations.

For operations that need more time, use extend as a heartbeat rather than relying on a long grace period.

## How extend works

`POST /v1/reservations/{reservation_id}/extend` extends the TTL of an active reservation.

The `extend_by_ms` parameter is added to the current `expires_at_ms` (not to the request time):

```
new_expires_at_ms = current_expires_at_ms + extend_by_ms
```

The allowed range for `extend_by_ms` is 1 millisecond to 24 hours (`1` to `86400000` milliseconds).

Extend requires an `idempotency_key`. Replaying the same request with the same idempotency key returns the original response.

### What extend does not change

Extend updates only the expiration time. It does not change:

- the reserved amount
- the unit
- the subject
- the action
- the scope path
- the affected scopes

The reservation is the same reservation. It just lives longer.

### Error conditions

- If the reservation is already `COMMITTED` or `RELEASED`: `409 RESERVATION_FINALIZED`
- If the reservation has already expired (past `expires_at_ms`): `410 RESERVATION_EXPIRED`
- If the reservation was never created: `404 NOT_FOUND`

Note: extend must happen before TTL expires, not during the grace period. The grace period only covers commit and release.

## The heartbeat pattern

For long-running workflows, the recommended approach is:

1. Create a reservation with a short TTL (10–30 seconds)
2. Start a background heartbeat that calls extend at regular intervals (typically TTL / 2)
3. When work completes, commit actual usage
4. If the heartbeat stops (crash, timeout), the reservation expires naturally and budget is returned

This pattern keeps budget locked only while the client is actively running. If the client crashes, the reservation expires quickly and budget is freed.

### Example timing

- TTL: 20 seconds
- Heartbeat interval: 10 seconds (TTL / 2)
- Grace period: 5 seconds

The client creates a reservation at T=0.

At T=10, T=20, T=30, etc., the client calls extend.

If the client crashes at T=25, the reservation was last extended to T=30. At T=30, the grace period begins. At T=35, the reservation expires and budget is released.

Total lockout after crash: ~10 seconds.

Compare this to a single 10-minute TTL, where a crash at T=1 would lock budget for 9 minutes plus grace period.

## The Spring Boot client handles this automatically

The `@Cycles` annotation in the Spring Boot client automatically schedules heartbeat extensions:

- The heartbeat interval is `ttlMs / 2` (minimum 1 second)
- Extensions are scheduled on a background thread
- The heartbeat stops when the method returns (commit or release)

This means most users do not need to implement extend logic manually.

## Choosing TTL values

### Short TTL (10–30 seconds)

Best for:

- model calls and tool invocations that complete quickly
- actions with predictable duration
- systems where fast budget recovery matters

### Medium TTL (30–120 seconds)

Best for:

- multi-step workflows
- actions with moderate latency
- systems using heartbeat extension

### Long TTL (2–60 minutes)

Best for:

- batch processing
- background jobs with known duration
- systems where extend is not practical

Use long TTLs sparingly. They increase the risk of zombie reservations.

## Choosing grace period values

### Default (5 seconds)

Sufficient for most synchronous operations where commits arrive shortly after execution.

### Higher (10–30 seconds)

Useful for:

- streaming model calls with high latency
- slow external APIs
- actions where commit may be delayed by processing

### Zero

Use zero grace period when:

- strict TTL enforcement is required
- the client always commits well before expiration
- zombie prevention is a priority

## Common mistakes

### Mistake 1: Using large TTLs instead of heartbeats

A 10-minute TTL works but locks budget for the full duration if the client crashes. Prefer short TTLs with extend.

### Mistake 2: Relying on grace period for normal operation

The grace period is a safety net, not a design tool. If commits routinely arrive during the grace period, the TTL is too short.

### Mistake 3: Forgetting to handle RESERVATION_EXPIRED

If a commit arrives after the grace period, it will be rejected. The system should handle this gracefully — retry with a new reservation if the work succeeded, or accept the loss.

### Mistake 4: Extending after TTL expires

Extend must happen before `expires_at_ms`. If the client waits too long between heartbeats, the reservation may expire before the next extend arrives.

## Summary

Reservations in Cycles are time-bounded by design:

- **TTL** controls how long budget is held
- **Grace period** provides a short safety window after TTL for in-flight commits
- **Extend** refreshes TTL as a heartbeat for long-running operations

The recommended pattern for most systems:

- Keep TTL short (10–30 seconds)
- Use extend as a heartbeat (interval = TTL / 2)
- Set grace period to 5–10 seconds
- Handle RESERVATION_EXPIRED gracefully

This keeps budget locked only while work is actively running, and recovers quickly when clients crash.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
