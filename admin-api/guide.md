---
title: "Admin API Guide"
description: "How to use the Cycles Admin API for tenant management, API key lifecycle, budget operations, and policy configuration."
---

# Admin API Guide

The Cycles Admin API runs on port **7979** (separate from the runtime API on port 7878) and provides endpoints for managing tenants, API keys, budgets, and policies.

**Authentication:** Budget create uses `X-Cycles-API-Key` with `budgets:write` permission. Budget list and fund accept either `X-Cycles-API-Key` or `X-Admin-API-Key` (admin requires `tenant_id` query param). Budget patch, freeze, and unfreeze use `X-Admin-API-Key`. The `admin:write` and `admin:read` permissions act as wildcards — `admin:write` satisfies any `*:write` requirement. See the [budget allocation guide](/how-to/budget-allocation-and-management-in-cycles) for details.

For the full interactive API reference, see the [Admin API Reference](/admin-api/).

## Authentication

The admin API uses two authentication mechanisms:

```bash
# Tenant/key/policy/webhook management + budget PATCH/freeze/unfreeze
-H "X-Admin-API-Key: $ADMIN_KEY"

# Budget create (tenant-scoped)
-H "X-Cycles-API-Key: $CYCLES_API_KEY"  # requires budgets:write or admin:write

# Budget list, fund (dual-auth — either works)
-H "X-Cycles-API-Key: $CYCLES_API_KEY"  # tenant derived from key
-H "X-Admin-API-Key: $ADMIN_KEY"        # requires tenant_id query param
```

The admin key is set via the `ADMIN_API_KEY` environment variable. `admin:write` acts as a wildcard that satisfies any `*:write` permission. `admin:read` satisfies any `*:read` permission. Budget patch, freeze, and unfreeze require the admin bootstrap key. Budget list and fund accept either auth method (v0.1.25.5+) — when using `X-Admin-API-Key`, the `tenant_id` query parameter is required.

## Tenant management

### Create a tenant

```bash
curl -s -X POST http://localhost:7979/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "Acme Corporation"
  }' | jq .
```

### Update tenant configuration

Tenant-level defaults control reservation TTL limits and the default overage policy:

```bash
curl -s -X PATCH http://localhost:7979/v1/admin/tenants/acme-corp \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "default_reservation_ttl_ms": 60000,
    "max_reservation_ttl_ms": 300000,
    "max_reservation_extensions": 10,
    "default_commit_overage_policy": "ALLOW_IF_AVAILABLE"
  }' | jq .
```

### Suspend or close a tenant

```bash
curl -s -X PATCH http://localhost:7979/v1/admin/tenants/acme-corp \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{"status": "SUSPENDED"}' | jq .
```

Status values: `ACTIVE`, `SUSPENDED`, `CLOSED`.

## API key management

### Create a key

```bash
curl -s -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "production-key",
    "permissions": [
      "reservations:create",
      "reservations:commit",
      "reservations:release",
      "reservations:extend",
      "reservations:list",
      "balances:read"
    ]
  }' | jq .
```

The response includes `key_secret` (e.g., `cyc_live_abc123...`). **Save it immediately — the secret is only shown once.**

### List keys for a tenant

```bash
curl -s http://localhost:7979/v1/admin/api-keys?tenant_id=acme-corp \
  -H "X-Admin-API-Key: admin-bootstrap-key" | jq .
```

### Update a key

*New in v0.1.25.7:*

```bash
curl -s -X PATCH http://localhost:7979/v1/admin/api-keys/{key_id} \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{
    "permissions": ["reservations:create", "reservations:commit", "reservations:release", "balances:read", "budgets:write"],
    "name": "support-bot-v2"
  }' | jq .
```

Updates key permissions, scope_filter, name, description, or metadata without rotating the secret. Emits `api_key.permissions_changed` when permissions or scope_filter change. Returns 400 for invalid permission names, 409 for revoked or expired keys.

### Revoke a key

```bash
curl -s -X DELETE http://localhost:7979/v1/admin/api-keys/{key_id} \
  -H "X-Admin-API-Key: admin-bootstrap-key"
```

## Budget management

### Create a budget ledger

```bash
curl -s -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "scope": "tenant:acme-corp",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 100000000, "unit": "USD_MICROCENTS" }
  }' | jq .
```

The tenant is derived from the authenticated API key — no `tenant_id` field in the request body.

### Fund an existing budget (CREDIT)

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme-corp&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "CREDIT",
    "amount": { "amount": 50000000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "fund-acme-001"
  }' | jq .
```

Operations: `CREDIT` (add funds), `DEBIT` (remove funds), `RESET` (resize `allocated` ceiling, preserving `spent`/`reserved`/`debt`), `RESET_SPENT` (start new billing period — set `allocated`, clear `spent` or set via optional `spent` override, preserve `reserved`/`debt`), `REPAY_DEBT` (reduce outstanding debt).

### Patch budget settings

*New in v0.1.24:*

```bash
curl -s -X PATCH 'http://localhost:7979/v1/admin/budgets?scope=tenant:acme-corp&unit=USD_MICROCENTS' \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{
    "commit_overage_policy": "REJECT",
    "overdraft_limit": { "amount": 10000000, "unit": "USD_MICROCENTS" }
  }' | jq .
```

This atomically recalculates `is_over_limit` based on the new settings.

### Freeze a budget

*New in v0.1.25.6:*

```bash
curl -s -X POST 'http://localhost:7979/v1/admin/budgets/freeze?scope=tenant:acme-corp&unit=USD_MICROCENTS' \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{"reason": "Investigating runaway agent"}' | jq .
```

Transitions budget status from ACTIVE → FROZEN. All new reservations, commits, and fund operations against this budget will be blocked (reservations return `BUDGET_FROZEN`, commits and fund return 409). Existing active reservations can only be released, not committed. Emits a `budget.frozen` event.

### Unfreeze a budget

```bash
curl -s -X POST 'http://localhost:7979/v1/admin/budgets/unfreeze?scope=tenant:acme-corp&unit=USD_MICROCENTS' \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{"reason": "Investigation complete, resuming"}' | jq .
```

Transitions FROZEN → ACTIVE. Reservations resume. Emits a `budget.unfrozen` event. Returns 409 if the budget is already active or has been closed.

### Look up a specific budget

*New in v0.1.25.5:*

```bash
curl -s "http://localhost:7979/v1/admin/budgets/lookup?scope=tenant:acme-corp/workspace:prod&unit=USD_MICROCENTS" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" | jq .
```

Returns the single budget ledger for an exact scope + unit pair. Also accepts `X-Admin-API-Key` — no `tenant_id` needed because the budget is uniquely identified by the (scope, unit) pair.

### Dashboard overview

*New in v0.1.25.5:*

```bash
curl -s "http://localhost:7979/v1/admin/overview" \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

Returns a server-wide summary: entity counts (tenants, budgets, webhooks), top offenders, and recent event summaries. Designed for admin dashboard UIs — this endpoint is what powers the Overview page in the [Cycles Admin Dashboard](/quickstart/deploying-the-cycles-dashboard).

### API key introspection

*New in v0.1.25.5:*

```bash
curl -s "http://localhost:7979/v1/auth/introspect" \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

Returns server-level auth introspection. Useful for debugging auth configuration. Admin-key only.

## Policy management

::: warning v0 limitation
In v0, policies are **stored but not yet enforced at runtime**. The protocol server (port 7878) does not evaluate admin-defined policies when processing reservations, commits, or events. Enforcement is planned for a future version. Today, the only policy-like behavior enforced at runtime is the `overage_policy` resolved from the request or the tenant's `default_commit_overage_policy`.
:::

### Create a policy

```bash
curl -s -X POST http://localhost:7979/v1/admin/policies \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "name": "limit-gpt4",
    "scope_pattern": "tenant:acme-corp/agent:*",
    "caps": {"max_tokens": 4096},
    "commit_overage_policy": "REJECT",
    "priority": 100
  }' | jq .
```

### Update a policy

*New in v0.1.24:*

```bash
curl -s -X PATCH http://localhost:7979/v1/admin/policies/{policy_id} \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "caps": {"max_tokens": 8192},
    "status": "ACTIVE"
  }' | jq .
```

## Audit logs

Query the audit trail for compliance and debugging:

```bash
curl -s 'http://localhost:7979/v1/admin/audit/logs?tenant_id=acme-corp&limit=10' \
  -H "X-Admin-API-Key: admin-bootstrap-key" | jq .
```

## Pillar 4: Events & Webhooks (v0.1.25)

The admin server provides 20 webhook/event endpoints for real-time observability:

- **Webhook management**: create, list, get, update, delete, test subscriptions
- **Event query**: list and retrieve events by tenant, type, category, time range
- **Delivery tracking**: list delivery attempts per subscription with status/date filters
- **Event replay**: re-deliver historical events to a subscription
- **Security config**: manage webhook URL SSRF protection (blocked CIDRs, HTTPS enforcement)
- **Tenant self-service**: tenants manage their own webhooks at `/v1/webhooks` (27 of 41 event types)

Events are emitted by admin controllers (tenant, budget, api-key, policy operations) and delivered asynchronously by the events service (`cycles-server-events`). See [Webhooks and Events](/concepts/webhooks-and-events) for architecture details.

**Create a webhook subscription** (add `?tenant_id=acme-corp` to scope to a tenant; omit for system-wide):

```bash
curl -X POST 'http://localhost:7979/v1/admin/webhooks?tenant_id=acme-corp' \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-endpoint.example.com/webhook",
    "event_types": ["budget.exhausted", "reservation.denied"]
  }'
```

The response includes `subscription_id` and `signing_secret` (auto-generated, returned only once).

**List webhooks:**

```bash
curl -s 'http://localhost:7979/v1/admin/webhooks?tenant_id=acme-corp' \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

**Test a webhook** (sends a `system.webhook_test` event):

```bash
curl -X POST http://localhost:7979/v1/admin/webhooks/whsub_abc123/test \
  -H "X-Admin-API-Key: $ADMIN_KEY"
```

**Query deliveries for a subscription:**

```bash
curl -s 'http://localhost:7979/v1/admin/webhooks/whsub_abc123/deliveries?status=FAILED' \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

**Replay events** (re-deliver events from a time range):

```bash
curl -X POST http://localhost:7979/v1/admin/webhooks/whsub_abc123/replay \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from": "2026-04-01T00:00:00Z", "to": "2026-04-01T12:00:00Z"}'
```

**Query events:**

```bash
curl -s 'http://localhost:7979/v1/admin/events?tenant_id=acme-corp&event_type=budget.exhausted&limit=10' \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

**View webhook security config:**

```bash
curl -s http://localhost:7979/v1/admin/config/webhook-security \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
# Returns: {"blocked_cidr_ranges": [...], "allow_http": false, "allowed_url_patterns": []}
```

**Update webhook security config** (enable HTTP for local dev):

```bash
curl -X PUT http://localhost:7979/v1/admin/config/webhook-security \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"allow_http": true, "blocked_cidr_ranges": []}'
```

**Tenant self-service** (using `X-Cycles-API-Key` with `webhooks:write` permission):

```bash
curl -X POST http://localhost:7979/v1/webhooks \
  -H "X-Cycles-API-Key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://my-app.example.com/cycles-webhook",
    "event_types": ["budget.exhausted", "budget.threshold_crossed"]
  }'
```

See [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol) for the full 41-event-type reference and delivery specification. See [Webhook Integrations](/how-to/webhook-integrations) for PagerDuty, Slack, and ServiceNow examples.

## List-endpoint features (v0.1.25.22+)

Six admin list endpoints (`/v1/admin/tenants`, `/api-keys`, `/budgets`, `/webhooks/subscriptions`, `/events`, `/audit/logs`) gained three operator features across the v0.1.25.22–.25 window. See [Searching and sorting admin list endpoints](/how-to/searching-and-sorting-admin-list-endpoints) for the full cursor-invalidation rules.

**Cross-tenant lists (v0.1.25.22).** `GET /v1/admin/api-keys` and `GET /v1/admin/budgets` accept an omitted `tenant_id` under admin auth — the walk covers every tenant and returns a composite cursor (`{tenantId}|{keyId}` or `{tenantId}|{ledgerId}`). Dashboards that previously ran N+1 per-tenant loops should replace them with a single cross-tenant call.

**Budget filters (v0.1.25.22).** `GET /v1/admin/budgets` adds `over_limit` (boolean), `has_debt` (boolean), `utilization_min` (`[0,1]`), and `utilization_max` (`[0,1]`). AND-combined with every other filter; applied before cursor traversal so pagination stays stable. `utilization_min > utilization_max` → 400.

**Server-side sort (v0.1.25.24).** `sort_by` + `sort_dir` on all six endpoints. Per-endpoint whitelists; unknown keys → 400. `listBudgets` and `listWebhookSubscriptions` **change default row order** (utilization DESC / consecutive_failures DESC) — pass `sort_by=created_at&sort_dir=desc` to restore prior behavior.

**Free-text search (v0.1.25.25).** `search` query param on all six endpoints. Case-insensitive substring match on natural identifier fields, ≤128 characters, AND-combined with other filters.

## Audit log failure capture (v0.1.25.20)

`GET /v1/admin/audit/logs` now returns entries for **failed** requests (401/403/400/404/409/500) alongside successes. Each failure entry carries `status`, `error_code`, `metadata.error_message` (sanitized, 1024-char capped), `metadata.method`, `metadata.path`, and — on 500 — `metadata.exception_class`.

Pre-auth failures are attributed to the sentinel tenant `<unauthenticated>`. Query them directly:

```bash
curl -s 'http://localhost:7979/v1/admin/audit/logs?tenant_id=%3Cunauthenticated%3E&limit=50' \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

**Tiered TTL defaults** (SOC2 compliant out of the box): authenticated entries retained 400 days, unauthenticated entries 30 days. Set either `audit.retention.authenticated.days` or `audit.retention.unauthenticated.days` to `0` for indefinite retention. See [Server Configuration Reference → Audit log retention](/configuration/server-configuration-reference-for-cycles#audit-log-retention).

**Semantic change for consumers.** Queries without a `status` filter (or with `status=4xx/5xx`) now surface failure entries that didn't exist in v0.1.25.19. Dashboards that assumed "audit entry exists ⇒ operation succeeded" must switch to checking `status` or `error_code`.

## Bulk actions (v0.1.25.26)

Two filter-driven bulk endpoints for operators who need to suspend / reactivate / close many tenants — or pause / resume / delete many webhooks — in a single atomic call.

```bash
curl -X POST http://localhost:7979/v1/admin/tenants/bulk-action \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": { "status": "ACTIVE", "search": "preview-" },
    "action": "SUSPEND",
    "expected_count": 12,
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**Safety gates:**
- Empty filter → 400 (prevents accidental all-rows action).
- More than 500 matches → 400 `LIMIT_EXCEEDED` with `total_matched` in the body.
- `expected_count` mismatch → 409 `COUNT_MISMATCH` with no writes.
- `idempotency_key` required; 15-minute replay window returns the cached outcome.

**Response envelope** splits results three ways:

```json
{
  "action": "SUSPEND",
  "total_matched": 12,
  "succeeded": ["tenant_1", "tenant_2", "..."],
  "failed": [{"id": "tenant_7", "error_code": "INVALID_TRANSITION", "message": "..."}],
  "skipped": [{"id": "tenant_9", "reason": "ALREADY_IN_TARGET_STATE"}],
  "idempotency_key": "..."
}
```

Supported actions: `SUSPEND | REACTIVATE | CLOSE` on `/v1/admin/tenants/bulk-action`; `PAUSE | RESUME | DELETE` on `/v1/admin/webhooks/bulk-action`.

See [Using bulk actions for tenants and webhooks](/how-to/using-bulk-actions-for-tenants-and-webhooks) for idempotency patterns, filter construction, and operator workflow.

## Admin-on-behalf-of (v0.1.25.14 / v0.1.25.16)

Several mutating endpoints accept admin auth with an explicit `tenant_id` in the body — useful for onboarding, migration, and incident response:

- `POST /v1/admin/budgets` (budget creation)
- `POST /v1/admin/policies`, `PATCH /v1/admin/policies/{id}` (policy creation + update)
- Six tenant-scoped webhook endpoints: `GET /v1/webhooks`, `GET/PATCH/DELETE /v1/webhooks/{id}`, `POST /v1/webhooks/{id}/test`, `GET /v1/webhooks/{id}/deliveries`

All admin-driven mutations tag the audit entry with `metadata.actor_type=admin_on_behalf_of` so the provenance is queryable. `POST /v1/webhooks` (create) remains tenant-only — admin-creating-on-tenant-behalf would obscure the audit trail.

Incident-response bonus: `POST /v1/reservations/{id}/release` on the runtime server (port 7878) also accepts `X-Admin-API-Key` as of cycles-server v0.1.25.8 — see [Force-releasing stuck reservations as an operator](/how-to/force-releasing-stuck-reservations-as-an-operator).

## Next steps

- [Webhook Integrations](/how-to/webhook-integrations) — PagerDuty, Slack, ServiceNow examples
- [Admin API Reference (Interactive)](/admin-api/) — full OpenAPI explorer
- [Tenant Management](/how-to/tenant-creation-and-management-in-cycles) — tenant lifecycle patterns
- [API Key Management](/how-to/api-key-management-in-cycles) — key rotation and permissions
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — budget hierarchy patterns
