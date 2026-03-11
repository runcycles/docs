# API Reference for the Cycles Protocol

This is a developer-friendly reference for every endpoint in the Cycles protocol. Each endpoint includes the request format, response format, and curl examples.

All requests require the `X-Cycles-API-Key` header for authentication.

## Common headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes (POST) | `application/json` |
| `X-Cycles-API-Key` | Yes | API key for authentication and tenant derivation |
| `X-Idempotency-Key` | No | Client-provided idempotency key (also accepted in the request body) |

## Common types

### Subject

The budgeting scope. At least one standard field is required.

```json
{
  "tenant": "acme",
  "workspace": "production",
  "app": "support-bot",
  "workflow": "refund-flow",
  "agent": "planner",
  "toolset": "search-tools",
  "dimensions": {
    "cost_center": "engineering",
    "run_id": "run-12345"
  }
}
```

All fields are optional except that at least one of `tenant`, `workspace`, `app`, `workflow`, `agent`, or `toolset` must be present. The `dimensions` field allows arbitrary key-value pairs for custom budgeting dimensions.

### Amount

```json
{
  "amount": 5000,
  "unit": "USD_MICROCENTS"
}
```

Units: `USD_MICROCENTS`, `TOKENS`, `CREDITS`, `RISK_POINTS`.

### Action

```json
{
  "kind": "llm.completion",
  "name": "openai:gpt-4o",
  "tags": ["customer-facing", "prod"]
}
```

### Caps (soft constraints)

Returned when the decision is `ALLOW_WITH_CAPS`:

```json
{
  "max_tokens": 500,
  "max_steps_remaining": 3,
  "tool_allowlist": ["search"],
  "tool_denylist": ["code_exec"],
  "cooldown_ms": 2000
}
```

### Error response

```json
{
  "error": "BUDGET_EXCEEDED",
  "message": "Insufficient budget in scope tenant:acme",
  "request_id": "req-abc-123",
  "details": {}
}
```

---

## POST /v1/reservations

Reserve budget before executing work.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | string | Yes | Unique key for idempotent retries |
| `subject` | Subject | Yes | Budgeting scope |
| `action` | Action | Yes | Action being budgeted |
| `estimate` | Amount | Yes | Estimated cost |
| `ttl_ms` | integer | No | Reservation TTL in ms (default: 60000, range: 1000–86400000) |
| `grace_period_ms` | integer | No | Grace period after TTL for late commits (default: 5000, range: 0–60000) |
| `overage_policy` | string | No | `REJECT` (default), `ALLOW_IF_AVAILABLE`, or `ALLOW_WITH_OVERDRAFT` |
| `dry_run` | boolean | No | If true, evaluate without reserving (default: false) |
| `metadata` | object | No | Arbitrary key-value metadata |

### Response (200 OK)

```json
{
  "reservation_id": "res-abc-123",
  "decision": "ALLOW",
  "expires_at_ms": 1710000060000,
  "affected_scopes": [
    "tenant:acme",
    "tenant:acme/workspace:production"
  ],
  "scope_path": "tenant:acme/workspace:production",
  "reserved": { "amount": 5000, "unit": "USD_MICROCENTS" },
  "balances": [
    {
      "scope": "tenant:acme",
      "remaining": { "amount": 95000, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 100000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 0, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 5000, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    }
  ],
  "caps": null,
  "reason_code": null,
  "retry_after_ms": null
}
```

When `decision` is `ALLOW_WITH_CAPS`, the `caps` field contains soft constraints.

When `decision` is `DENY` (dry_run only), the reservation is not created. For live reservations, insufficient budget returns a `409` error instead of `decision: DENY`.

When `reason_code` is present (on DENY), it provides a machine-readable reason for the denial. `retry_after_ms` optionally suggests when to retry.

### Dry run response

When `dry_run: true`, the response has the same structure but no reservation is persisted. The `reservation_id` and `expires_at_ms` fields are absent. The `affected_scopes` field is always populated, even when the decision is DENY.

### Example

```bash
curl -X POST http://localhost:7878/v1/reservations \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: your-api-key" \
  -d '{
    "idempotency_key": "req-001",
    "subject": {
      "tenant": "acme",
      "workspace": "production",
      "app": "chatbot"
    },
    "action": {
      "kind": "llm.completion",
      "name": "gpt-4o"
    },
    "estimate": {
      "amount": 5000,
      "unit": "USD_MICROCENTS"
    },
    "ttl_ms": 60000,
    "overage_policy": "REJECT"
  }'
```

### Error responses

| Code | Error | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Missing or invalid fields |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `FORBIDDEN` | Tenant mismatch |
| 409 | `BUDGET_EXCEEDED` | Insufficient budget |
| 409 | `OVERDRAFT_LIMIT_EXCEEDED` | Scope is over-limit |
| 409 | `DEBT_OUTSTANDING` | Scope has unpaid debt |
| 409 | `IDEMPOTENCY_MISMATCH` | Same key, different payload |

---

## POST /v1/reservations/{id}/commit

Record actual usage and release the unused remainder.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | string | Yes | Unique key for idempotent retries |
| `actual` | Amount | Yes | Actual cost consumed |
| `metrics` | object | No | Standard metrics (see below) |
| `metadata` | object | No | Arbitrary audit metadata |

#### Metrics object

```json
{
  "tokens_input": 150,
  "tokens_output": 80,
  "latency_ms": 320,
  "model_version": "gpt-4o-2024-08-06",
  "custom": { "cache_hit": true }
}
```

### Response (200 OK)

```json
{
  "status": "COMMITTED",
  "charged": { "amount": 3200, "unit": "USD_MICROCENTS" },
  "released": { "amount": 1800, "unit": "USD_MICROCENTS" },
  "balances": [
    {
      "scope": "tenant:acme",
      "scope_path": "tenant:acme",
      "remaining": { "amount": 96800, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 100000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 3200, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 0, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    }
  ]
}
```

### Example

```bash
curl -X POST http://localhost:7878/v1/reservations/res-abc-123/commit \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: your-api-key" \
  -d '{
    "idempotency_key": "commit-001",
    "actual": {
      "amount": 3200,
      "unit": "USD_MICROCENTS"
    },
    "metrics": {
      "tokens_input": 150,
      "tokens_output": 80,
      "latency_ms": 320
    }
  }'
```

### Error responses

| Code | Error | When |
|---|---|---|
| 400 | `UNIT_MISMATCH` | Commit unit differs from reservation unit |
| 403 | `FORBIDDEN` | Reservation owned by different tenant |
| 404 | `NOT_FOUND` | Reservation does not exist |
| 409 | `BUDGET_EXCEEDED` | Actual exceeds budget (REJECT or ALLOW_IF_AVAILABLE) |
| 409 | `OVERDRAFT_LIMIT_EXCEEDED` | Debt would exceed limit (ALLOW_WITH_OVERDRAFT) |
| 409 | `RESERVATION_FINALIZED` | Already committed or released |
| 410 | `RESERVATION_EXPIRED` | TTL + grace period elapsed |

---

## POST /v1/reservations/{id}/release

Cancel a reservation and return all reserved budget to the pool.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | string | Yes | Unique key for idempotent retries |
| `reason` | string | No | Human-readable reason for release |

### Response (200 OK)

```json
{
  "status": "RELEASED",
  "released": { "amount": 5000, "unit": "USD_MICROCENTS" },
  "balances": [
    {
      "scope": "tenant:acme",
      "scope_path": "tenant:acme",
      "remaining": { "amount": 100000, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 100000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 0, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 0, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    }
  ]
}
```

### Example

```bash
curl -X POST http://localhost:7878/v1/reservations/res-abc-123/release \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: your-api-key" \
  -d '{
    "idempotency_key": "release-001",
    "reason": "Task cancelled by user"
  }'
```

### Error responses

| Code | Error | When |
|---|---|---|
| 403 | `FORBIDDEN` | Reservation owned by different tenant |
| 404 | `NOT_FOUND` | Reservation does not exist |
| 409 | `RESERVATION_FINALIZED` | Already committed or released |
| 410 | `RESERVATION_EXPIRED` | TTL + grace period elapsed |

---

## POST /v1/reservations/{id}/extend

Extend the TTL of an active reservation. Used as a heartbeat for long-running operations.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | string | Yes | Unique key for idempotent retries |
| `extend_by_ms` | integer | Yes | Milliseconds to extend (range: 1–86400000) |
| `metadata` | object | No | Optional debugging/audit metadata |

### Response (200 OK)

```json
{
  "status": "ACTIVE",
  "expires_at_ms": 1710000120000
}
```

### Example

```bash
curl -X POST http://localhost:7878/v1/reservations/res-abc-123/extend \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: your-api-key" \
  -d '{
    "idempotency_key": "extend-001",
    "extend_by_ms": 60000
  }'
```

### Error responses

| Code | Error | When |
|---|---|---|
| 403 | `FORBIDDEN` | Reservation owned by different tenant |
| 404 | `NOT_FOUND` | Reservation does not exist |
| 409 | `RESERVATION_FINALIZED` | Already committed or released |
| 410 | `RESERVATION_EXPIRED` | Past TTL (no grace period for extend) |

---

## GET /v1/reservations

List reservations with optional filters and pagination.

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `tenant` | string | Filter by tenant |
| `workspace` | string | Filter by workspace |
| `app` | string | Filter by app |
| `workflow` | string | Filter by workflow |
| `agent` | string | Filter by agent |
| `toolset` | string | Filter by toolset |
| `status` | string | Filter by status: `ACTIVE`, `COMMITTED`, `RELEASED`, `EXPIRED` |
| `idempotency_key` | string | Filter by idempotency key |
| `limit` | integer | Max results (1–200, default: 50) |
| `cursor` | string | Opaque cursor from previous response |

### Response (200 OK)

```json
{
  "reservations": [
    {
      "reservation_id": "res-abc-123",
      "status": "ACTIVE",
      "subject": { "tenant": "acme", "workspace": "production" },
      "action": { "kind": "llm.completion", "name": "gpt-4o" },
      "reserved": { "amount": 5000, "unit": "USD_MICROCENTS" },
      "expires_at_ms": 1710000060000,
      "created_at_ms": 1710000000000,
      "scope_path": "tenant:acme/workspace:production",
      "affected_scopes": ["tenant:acme", "tenant:acme/workspace:production"]
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### Example

```bash
curl -s "http://localhost:7878/v1/reservations?tenant=acme&status=ACTIVE&limit=10" \
  -H "X-Cycles-API-Key: your-api-key"
```

---

## GET /v1/reservations/{id}

Get details of a specific reservation.

### Response (200 OK)

```json
{
  "reservation_id": "res-abc-123",
  "status": "COMMITTED",
  "idempotency_key": "req-001",
  "subject": { "tenant": "acme", "workspace": "production" },
  "action": { "kind": "llm.completion", "name": "gpt-4o" },
  "reserved": { "amount": 5000, "unit": "USD_MICROCENTS" },
  "committed": { "amount": 3200, "unit": "USD_MICROCENTS" },
  "created_at_ms": 1710000000000,
  "expires_at_ms": 1710000060000,
  "finalized_at_ms": 1710000045000,
  "scope_path": "tenant:acme/workspace:production",
  "affected_scopes": ["tenant:acme", "tenant:acme/workspace:production"],
  "metadata": {}
}
```

### Example

```bash
curl -s http://localhost:7878/v1/reservations/res-abc-123 \
  -H "X-Cycles-API-Key: your-api-key"
```

---

## POST /v1/decide

Evaluate a budget decision without creating a reservation. Useful for preflight checks, UI affordances, and routing decisions.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | string | Yes | Unique key for idempotent retries |
| `subject` | Subject | Yes | Budgeting scope |
| `action` | Action | Yes | Action being evaluated |
| `estimate` | Amount | Yes | Estimated cost to evaluate |
| `metadata` | object | No | Arbitrary metadata |

### Response (200 OK)

```json
{
  "decision": "ALLOW",
  "affected_scopes": [
    "tenant:acme",
    "tenant:acme/workspace:production"
  ],
  "caps": null,
  "reason_code": null,
  "retry_after_ms": null
}
```

The `reason_code` and `retry_after_ms` fields are present when the decision is `DENY`.

### Example

```bash
curl -X POST http://localhost:7878/v1/decide \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: your-api-key" \
  -d '{
    "idempotency_key": "decide-001",
    "subject": { "tenant": "acme", "workspace": "production" },
    "action": { "kind": "llm.completion", "name": "gpt-4o" },
    "estimate": { "amount": 5000, "unit": "USD_MICROCENTS" }
  }'
```

---

## GET /v1/balances

Query current budget state for one or more scopes.

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `tenant` | string | Filter by tenant |
| `workspace` | string | Filter by workspace |
| `app` | string | Filter by app |
| `workflow` | string | Filter by workflow |
| `agent` | string | Filter by agent |
| `toolset` | string | Filter by toolset |
| `include_children` | boolean | Include child scopes (default: false) |
| `limit` | integer | Max results (1–200, default: 50) |
| `cursor` | string | Opaque cursor from previous response |

At least one of `tenant`, `workspace`, `app`, `workflow`, `agent`, or `toolset` must be provided. The `tenant` parameter is validation-only: if provided, it must match the effective tenant derived from the API key.

### Response (200 OK)

```json
{
  "balances": [
    {
      "scope": "tenant:acme",
      "scope_path": "tenant:acme",
      "remaining": { "amount": 96800, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 100000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 3200, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 0, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    },
    {
      "scope": "workspace:production",
      "scope_path": "tenant:acme/workspace:production",
      "remaining": { "amount": 46800, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 50000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 3200, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 0, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### Example

```bash
curl -s "http://localhost:7878/v1/balances?tenant=acme&workspace=production" \
  -H "X-Cycles-API-Key: your-api-key"
```

---

## POST /v1/events

Record a direct debit event without a prior reservation. Used for post-hoc accounting when the reserve → commit lifecycle does not apply.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | string | Yes | Unique key for idempotent retries |
| `subject` | Subject | Yes | Budgeting scope |
| `action` | Action | Yes | Action being recorded |
| `actual` | Amount | Yes | Actual cost to record |
| `overage_policy` | string | No | `REJECT` (default), `ALLOW_IF_AVAILABLE`, or `ALLOW_WITH_OVERDRAFT` |
| `metrics` | object | No | Standard metrics |
| `client_time_ms` | integer | No | Client-side timestamp |
| `metadata` | object | No | Arbitrary metadata |

### Response (201 Created)

```json
{
  "status": "APPLIED",
  "event_id": "evt-abc-123",
  "balances": [
    {
      "scope": "tenant:acme",
      "scope_path": "tenant:acme",
      "remaining": { "amount": 95600, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 100000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 4400, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 0, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    }
  ]
}
```

### Example

```bash
curl -X POST http://localhost:7878/v1/events \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: your-api-key" \
  -d '{
    "idempotency_key": "evt-001",
    "subject": {
      "tenant": "acme",
      "workspace": "production"
    },
    "action": {
      "kind": "search.api",
      "name": "google-search"
    },
    "actual": {
      "amount": 1200,
      "unit": "USD_MICROCENTS"
    }
  }'
```

### Error responses

| Code | Error | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Missing or invalid fields |
| 400 | `UNIT_MISMATCH` | Unit not supported for scope |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `FORBIDDEN` | Tenant mismatch |
| 409 | `BUDGET_EXCEEDED` | Insufficient budget (REJECT or ALLOW_IF_AVAILABLE) |
| 409 | `OVERDRAFT_LIMIT_EXCEEDED` | Debt would exceed limit |
| 409 | `IDEMPOTENCY_MISMATCH` | Same key, different payload |

---

## Idempotency

All write operations require idempotency via the `idempotency_key` field in the request body. The `X-Idempotency-Key` header is also accepted; if both are provided, they must match.

- If you retry a request with the same key and the same payload, you get the original successful response. The operation is not applied again.
- If you reuse a key with a different payload, you get `409 IDEMPOTENCY_MISMATCH`.
- If the original request failed, retrying with the same key sends a fresh request.

Idempotency is scoped per (tenant, endpoint, idempotency_key).

## Next steps

- [Error Codes and Error Handling](/protocol/error-codes-and-error-handling-in-cycles) — detailed error code reference
- [Self-Hosting the Cycles Server](/quickstart/self-hosting-the-cycles-server) — deploy your own instance
- [Getting Started with the Spring Boot Starter](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — client integration
