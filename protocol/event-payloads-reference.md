---
title: "Event Payloads Reference"
description: "Complete payload reference for all Cycles webhook events — currently emitted and planned. Includes JSON examples, field definitions, and trigger conditions."
---

# Event Payloads Reference

This page documents the payload structure for every webhook event Cycles can emit. Each event wraps a standard envelope with an event-specific `data` object.

::: info Currently Emitted Events
As of v0.1.25.13, the runtime server emits **14 event types** (all five reservation-lifecycle events, the three budget-state-transition events, `event.applied`, and the budget-exhaust / over-limit / debt events). The admin server adds `budget.reset_spent` (v0.1.25.18). The remaining event types are **defined in the protocol** and will be emitted as the admin service and additional runtime hooks are wired up. Events marked as **Planned** below have their type registered in the protocol but are not yet emitted by any service.

The v0.1.25 protocol registers **41 event types** total across six categories (budget: 16, reservation: 5, tenant: 6, api_key: 6, policy: 3, system: 5).
:::

## Standard Envelope

Every event shares this envelope structure. The `data` field varies by event type.

```json
{
  "event_id": "evt_a1b2c3d4e5f67890",
  "event_type": "budget.exhausted",
  "category": "budget",
  "timestamp": "2026-04-01T14:32:00.123Z",
  "tenant_id": "acme-corp",
  "scope": "tenant:acme-corp/workspace:prod",
  "source": "cycles-server",
  "actor": {
    "type": "api_key",
    "key_id": "key_abc123",
    "source_ip": "10.0.1.50"
  },
  "data": { },
  "correlation_id": "req_789",
  "request_id": "req_789",
  "metadata": {}
}
```

### Envelope fields

| Field | Type | Always present | Description |
|---|---|---|---|
| `event_id` | string | Yes | Unique event identifier (format: `evt_*`). Use for deduplication. |
| `event_type` | string | Yes | Dotted event name (e.g., `budget.exhausted`) |
| `category` | string | Yes | One of: `budget`, `reservation`, `tenant`, `api_key`, `policy`, `system` |
| `timestamp` | string | Yes | ISO 8601 UTC timestamp |
| `tenant_id` | string | Yes | Tenant ID (system events use `__system__`) |
| `scope` | string | When applicable | Full scope path (e.g., `tenant:acme-corp/workspace:prod`) |
| `source` | string | Yes | Emitting service. Currently all events use `cycles-server`. Future releases may add `cycles-admin`. |
| `actor` | object | When applicable | Who triggered: `type` (`api_key`, `admin`, `system`), `key_id`, `source_ip` |
| `data` | object | Varies | Event-specific payload (see below). Some events emit `null`. |
| `correlation_id` | string | When provided | Links related events across a workflow |
| `request_id` | string | When provided | From `X-Request-Id` header on originating request |
| `metadata` | object | When provided | Operator-defined key-value pairs |

---

## Reservation Events

### `reservation.reserved` — Currently Emitted (v0.1.25.3)

**Trigger:** A reservation is created successfully.

**Emitted from:** `POST /v1/reservations` (ALLOW or ALLOW_WITH_CAPS response).

The envelope's `scope`, `tenant_id`, and `actor` fields identify the reservation context. The `data` payload carries the reservation identifier and the amount held.

---

### `reservation.committed` — Currently Emitted (v0.1.25.3)

**Trigger:** A reservation is committed with actual spend recorded.

**Emitted from:** `POST /v1/reservations/{id}/commit`.

If `actual > estimated`, a companion `reservation.commit_overage` event is also emitted (see below).

---

### `reservation.released` — Currently Emitted (v0.1.25.3)

**Trigger:** A reservation is cancelled.

**Emitted from:** `POST /v1/reservations/{id}/release`. If the release was performed by an admin operator (dual-auth path introduced in v0.1.25.8), the envelope's `actor.type` will be `admin` and the audit log records `metadata.actor_type=admin_on_behalf_of`.

---

### `reservation.extended` — Currently Emitted (v0.1.25.3)

**Trigger:** A reservation TTL is extended via heartbeat.

**Emitted from:** `POST /v1/reservations/{id}/extend`.

---

### `reservation.denied` — Currently Emitted

**Trigger:** A reservation or decide request returns DENY.

**Emitted from:** `POST /v1/reservations` (DENY response), `POST /v1/decide` (DENY response)

```json
{
  "event_type": "reservation.denied",
  "data": {
    "scope": "tenant:acme-corp/workspace:prod/workflow:support",
    "reason_code": "BUDGET_EXCEEDED",
    "requested_amount": 500000
  }
}
```

::: tip Fields populated at emission time
The `reservation.denied` event model defines 9 fields, but the current server emission populates `scope`, `reason_code`, and `requested_amount`. The remaining fields (`unit`, `remaining`, `action`, `subject`, `policy_id`, `deny_detail`) are defined in the model and may be populated in future releases.
:::

| Field | Type | Populated | Description |
|---|---|---|---|
| `scope` | string | Yes | Scope path that denied the reservation |
| `reason_code` | string | Yes | Why denied. Known values: `BUDGET_EXCEEDED`, `OVERDRAFT_LIMIT_EXCEEDED`, `DEBT_OUTSTANDING`, `BUDGET_FROZEN`, `BUDGET_CLOSED`. Open string — extensions (v0.1.26+) may emit additional values such as `ACTION_QUOTA_EXCEEDED`, `ACTION_KIND_DENIED`, `ACTION_KIND_NOT_ALLOWED`. |
| `requested_amount` | number | Yes | Amount the reservation requested |
| `unit` | string | Not yet | Budget unit (`USD_MICROCENTS`, `TOKENS`, `CREDITS`, `RISK_POINTS`) |
| `remaining` | number | Not yet | Budget remaining at the scope that denied |
| `action` | object | Not yet | Action metadata from the reservation request |
| `subject` | object | Not yet | Subject metadata from the reservation request |
| `policy_id` | string | Not yet | Policy ID that caused the denial, when applicable (added v0.1.25.8) |
| `deny_detail` | object | Not yet | Operator-grade structured context (added v0.1.25.8). Populated by extensions; may include `quota_violation`, `blocked_by_policy`, `blocked_by_scope`, `suggested_fix`. |

---

### `reservation.commit_overage` — Currently Emitted

**Trigger:** A commit's actual cost exceeds the original reservation estimate.

**Emitted from:** `POST /v1/reservations/{id}/commit` (when `actual > estimated`)

```json
{
  "event_type": "reservation.commit_overage",
  "data": {
    "reservation_id": "res_a1b2c3d4",
    "actual_amount": 480000
  }
}
```

::: tip Fields populated at emission time
The `reservation.commit_overage` event model defines 8 fields, but the current server emission populates `reservation_id` and `actual_amount`. The remaining 6 fields are defined in the model and may be populated in future releases. Note: the envelope `scope` field is also not set for this event — scope-filtered subscriptions will not match `commit_overage` events.
:::

| Field | Type | Populated | Description |
|---|---|---|---|
| `reservation_id` | string | Yes | The reservation that exceeded its estimate |
| `actual_amount` | number | Yes | Actual cost committed |
| `scope` | string | Not yet | Affected scope path |
| `unit` | string | Not yet | Budget unit |
| `estimated_amount` | number | Not yet | Original reservation estimate |
| `overage` | number | Not yet | Amount by which actual exceeded estimate |
| `overage_policy` | string | Not yet | Policy applied: `REJECT`, `ALLOW_IF_AVAILABLE`, `ALLOW_WITH_OVERDRAFT` |
| `debt_incurred` | number | Not yet | Debt created (only for `ALLOW_WITH_OVERDRAFT`) |

---

### `reservation.expired` — Currently Emitted

**Trigger:** A reservation TTL expires without being committed or released.

**Emitted from:** Background expiry sweeper (runs every 5 seconds by default)

```json
{
  "event_type": "reservation.expired",
  "data": {
    "reservation_id": "res_d4e5f678",
    "scope": "tenant:acme-corp/workspace:prod",
    "unit": "USD_MICROCENTS",
    "estimated_amount": 200000,
    "created_at": "2026-04-01T14:30:00.000Z",
    "expired_at": "2026-04-01T14:35:30.000Z",
    "ttl_ms": 300000,
    "extensions_used": 0
  }
}
```

| Field | Type | Description |
|---|---|---|
| `reservation_id` | string | The expired reservation |
| `scope` | string | Affected scope path |
| `unit` | string | Budget unit |
| `estimated_amount` | number | Amount that was held by the reservation |
| `created_at` | string | When the reservation was created (ISO 8601) |
| `expired_at` | string | When the reservation expired (ISO 8601) |
| `ttl_ms` | number | Effective TTL in milliseconds (computed as `expired_at - created_at`; includes extensions) |
| `extensions_used` | number | How many times the reservation was extended before expiry |

---

### `reservation.denial_rate_spike` — Planned

**Trigger:** Denial rate exceeds configured threshold within a rolling window.

::: warning Not Yet Emitted
This event type is defined in the protocol but not yet emitted by the Cycles server. It will be implemented in a future release.
:::

---

### `reservation.expiry_rate_spike` — Planned

**Trigger:** Expiry rate exceeds configured threshold within a rolling window.

::: warning Not Yet Emitted
This event type is defined in the protocol but not yet emitted by the Cycles server. It will be implemented in a future release.
:::

---

## Budget Events

### `budget.approaching_limit` — Currently Emitted (v0.1.25.3, dedup fixed v0.1.25.5)

**Trigger:** A scope's utilization crosses the configured "approaching" threshold (default **80%**).

**Emitted from:** `EventEmitterService.emitBalanceEvents()` on reservation / commit / event.

The envelope identifies the scope; the `data` payload reports `utilization`, `remaining`, and the threshold crossed. Subscriptions that want pager-ready escalation should filter on `event_type=budget.approaching_limit OR budget.at_limit OR budget.over_limit`.

---

### `budget.at_limit` — Currently Emitted (v0.1.25.3, dedup fixed v0.1.25.5)

**Trigger:** Utilization crosses the "at-limit" threshold (default **95%**).

**Emitted from:** Same emission path as `approaching_limit`. Dedup logic prevents re-emission while the scope remains in the same state band on subsequent mutations.

---

### `budget.over_limit` — Currently Emitted (v0.1.25.3, dedup fixed v0.1.25.5)

**Trigger:** Utilization reaches or exceeds **100%**.

**Emitted from:** Same emission path. Distinct from `budget.over_limit_entered`, which fires when debt first exceeds `overdraft_limit` under `ALLOW_WITH_OVERDRAFT`.

---

### `budget.reset_spent` — Currently Emitted (v0.1.25.18)

**Trigger:** An admin operator issues a `RESET_SPENT` funding operation on `POST /v1/admin/budgets/fund`.

**Emitted from:** `cycles-server-admin`. Distinct from `budget.reset` — `RESET` resizes the allocated ceiling and preserves `spent`; `RESET_SPENT` additionally clears (or overrides) `spent` for billing-period rollover.

The payload is an `EventDataBudgetLifecycle` with `spent` and `reserved` fields on `BudgetState`, plus an optional `spent_override_provided` boolean flag on the outer payload (`true` when the operator supplied an explicit `spent` value).

See [Rolling over billing periods with RESET_SPENT](/how-to/rolling-over-billing-periods-with-reset-spent) for operator guidance.

---

### `event.applied` — Currently Emitted (v0.1.25.3)

**Trigger:** A direct debit via `POST /v1/events` is applied successfully (no pre-reservation path).

**Emitted from:** Runtime events controller. The envelope's `scope` and `actor` identify the debit; the `data` payload reports the amount charged.

---

### `budget.exhausted` — Currently Emitted

**Trigger:** A budget's remaining amount reaches zero after a reservation or commit.

**Emitted from:** `EventEmitterService.emitBalanceEvents()` (when `remaining.amount == 0`)

```json
{
  "event_type": "budget.exhausted",
  "data": null
}
```

::: tip Envelope contains context
While the `data` field is `null` for this event, the envelope's `scope`, `tenant_id`, and `actor` fields identify which budget exhausted and what triggered it. Query the budget's current state via the admin API for balance details.
:::

---

### `budget.over_limit_entered` — Currently Emitted

**Trigger:** Debt exceeds the configured `overdraft_limit` on a budget with `ALLOW_WITH_OVERDRAFT` policy.

**Emitted from:** `EventEmitterService.emitBalanceEvents()` (when `is_over_limit` transitions to `true`)

```json
{
  "event_type": "budget.over_limit_entered",
  "data": {
    "scope": "tenant:acme-corp/workspace:prod",
    "unit": "USD_MICROCENTS",
    "debt": 1500000,
    "overdraft_limit": 1000000,
    "is_over_limit": true,
    "debt_utilization": 1.5
  }
}
```

| Field | Type | Description |
|---|---|---|
| `scope` | string | Affected scope path |
| `unit` | string | Budget unit |
| `debt` | number | Current debt amount |
| `overdraft_limit` | number | Configured overdraft ceiling |
| `is_over_limit` | boolean | Always `true` for this event |
| `debt_utilization` | number | Ratio: `debt / overdraft_limit` |

---

### `budget.debt_incurred` — Currently Emitted

**Trigger:** A commit creates new debt via `ALLOW_WITH_OVERDRAFT` policy (actual cost exceeds available budget).

**Emitted from:** `EventEmitterService.emitBalanceEvents()` (when new debt is created)

```json
{
  "event_type": "budget.debt_incurred",
  "data": {
    "scope": "tenant:acme-corp/workspace:prod",
    "unit": "USD_MICROCENTS",
    "total_debt": 750000,
    "overdraft_limit": 1000000
  }
}
```

::: tip Fields populated at emission time
The `budget.debt_incurred` event model defines 7 fields, but the current server emission populates `scope`, `unit`, `total_debt`, and `overdraft_limit`. The remaining fields (`reservation_id`, `debt_incurred`, `overage_policy`) are defined in the model and may be populated in future releases.
:::

| Field | Type | Populated | Description |
|---|---|---|---|
| `scope` | string | Yes | Affected scope path |
| `unit` | string | Yes | Budget unit |
| `total_debt` | number | Yes | Total accumulated debt on this scope |
| `overdraft_limit` | number | Yes | Configured overdraft ceiling |
| `reservation_id` | string | Not yet | Reservation whose commit caused the debt |
| `debt_incurred` | number | Not yet | New debt from this commit |
| `overage_policy` | string | Not yet | Policy applied (`ALLOW_WITH_OVERDRAFT`) |

---

### Planned Budget Events

The following budget events are defined in the protocol but not yet emitted. They will be implemented as admin service and budget lifecycle operations gain event hooks.

| Event Type | Trigger |
|---|---|
| `budget.created` | Budget ledger created via admin API |
| `budget.updated` | Budget configuration changed |
| `budget.funded` | CREDIT, DEBIT, RESET, or REPAY_DEBT funding operation |
| `budget.debited` | Funds removed from budget |
| `budget.reset` | Budget reset to new allocated amount |
| `budget.debt_repaid` | Outstanding debt repaid via REPAY_DEBT |
| `budget.frozen` | Budget status set to FROZEN |
| `budget.unfrozen` | Budget restored from FROZEN |
| `budget.closed` | Budget permanently closed |
| `budget.threshold_crossed` | Utilization crossed configured threshold (e.g., 80%, 95%) |
| `budget.over_limit_exited` | Debt dropped below overdraft limit after repayment |
| `budget.burn_rate_anomaly` | Spend rate exceeds baseline multiplier within window |

---

## Tenant, API Key, Policy, and System Events — Planned

The following event categories are fully defined in the protocol but are not yet emitted by any service. They will be implemented as the admin service gains event emission support.

### Tenant Events (6 types — all planned)

| Event Type | Trigger |
|---|---|
| `tenant.created` | New tenant provisioned |
| `tenant.updated` | Tenant configuration changed |
| `tenant.suspended` | Tenant set to SUSPENDED status |
| `tenant.reactivated` | Tenant restored from SUSPENDED |
| `tenant.closed` | Tenant permanently closed |
| `tenant.settings_changed` | Tenant default settings modified |

### API Key Events (6 types — all planned)

| Event Type | Trigger |
|---|---|
| `api_key.created` | New API key generated |
| `api_key.revoked` | API key permanently revoked |
| `api_key.expired` | API key reached expiration date |
| `api_key.permissions_changed` | API key permissions modified |
| `api_key.auth_failed` | Authentication attempt failed |
| `api_key.auth_failure_rate_spike` | Auth failure rate exceeded threshold |

### Policy Events (3 types — all planned)

| Event Type | Trigger |
|---|---|
| `policy.created` | New policy rule created |
| `policy.updated` | Policy configuration changed |
| `policy.deleted` | Policy removed |

### System Events (5 types — all planned)

| Event Type | Trigger |
|---|---|
| `system.store_connection_lost` | Redis connection failed |
| `system.store_connection_restored` | Redis connection recovered |
| `system.high_latency` | Server-side p99 latency exceeded threshold |
| `system.webhook_delivery_failed` | Webhook delivery permanently failed after all retries |
| `system.webhook_test` | Admin-initiated test webhook |

---

## Event Emission Summary

| Category | Total Defined | Currently Emitted | Planned |
|---|---|---|---|
| Reservation | 5 | 5 (`reserved`, `committed`, `released`, `extended`, `expired`) plus `denied` + `commit_overage` on the denial / overage paths | — |
| Budget | 16 | 7 (`exhausted`, `over_limit_entered`, `debt_incurred`, `approaching_limit`, `at_limit`, `over_limit`, `reset_spent`) + `event.applied` on direct debits | 9 |
| Tenant | 6 | 0 | 6 |
| API Key | 6 | 0 | 6 |
| Policy | 3 | 0 | 3 |
| System | 5 | 0 | 5 |
| **Total** | **41** | **14** | **27** |

For webhook delivery mechanics, retry schedule, and signature verification, see the [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol).

For integration examples (PagerDuty, Slack, ServiceNow), see [Webhook Integrations](/how-to/webhook-integrations).
