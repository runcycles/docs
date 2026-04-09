---
title: "Admin API Guide"
description: "How to use the Cycles Admin API for tenant management, API key lifecycle, budget operations, and policy configuration."
---

# Admin API Guide

The Cycles Admin API runs on port **7979** (separate from the runtime API on port 7878) and provides endpoints for managing tenants, API keys, budgets, and policies.

**Authentication:** Budget create and list use `X-Cycles-API-Key` with `budgets:write` / `budgets:read` permission. Budget fund accepts either `X-Cycles-API-Key` or `X-Admin-API-Key` (with `tenant_id` query param). Budget patch, freeze, and unfreeze use `X-Admin-API-Key`. The `admin:write` and `admin:read` permissions act as wildcards — `admin:write` satisfies any `*:write` requirement. See the [budget allocation guide](/how-to/budget-allocation-and-management-in-cycles) for details.

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
      "balances:read",
      "events:create"
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

Operations: `CREDIT` (add funds), `DEBIT` (remove funds), `RESET` (reset to specified amount), `REPAY_DEBT` (reduce outstanding debt).

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

Returns the single budget ledger for an exact scope + unit pair. Also accepts `X-Admin-API-Key` with `tenant_id` query param.

### Dashboard overview

*New in v0.1.25.5:*

```bash
curl -s "http://localhost:7979/v1/admin/overview?tenant_id=acme-corp" \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

Returns a summary view of budgets, active reservations, and recent events for a tenant. Designed for admin dashboard UIs.

### API key introspection

*New in v0.1.25.5:*

```bash
curl -s "http://localhost:7979/v1/auth/introspect" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" | jq .
```

Returns the authenticated key's tenant, permissions, and expiration. Useful for debugging auth issues.

## Policy management

::: warning v0 limitation
In v0, policies are **stored but not yet enforced at runtime**. The protocol server (port 7878) does not evaluate admin-defined policies when processing reservations, commits, or events. Enforcement is planned for a future version. Today, the only policy-like behavior enforced at runtime is the `overage_policy` resolved from the request or the tenant's `default_commit_overage_policy`.
:::

### Create a policy

```bash
curl -s -X POST http://localhost:7979/v1/admin/policies \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "limit-gpt4",
    "scope_pattern": "tenant:acme-corp/agent:*",
    "caps": {"max_tokens": 4096},
    "overage_policy": "REJECT",
    "priority": 100
  }' | jq .
```

### Update a policy

*New in v0.1.24:*

```bash
curl -s -X PATCH http://localhost:7979/v1/admin/policies/{policy_id} \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "caps": {"max_tokens": 8192},
    "status": "ACTIVE"
  }' | jq .
```

## Audit logs

Query the audit trail for compliance and debugging:

```bash
curl -s 'http://localhost:7979/v1/admin/audit-logs?tenant_id=acme-corp&limit=10' \
  -H "X-Admin-API-Key: admin-bootstrap-key" | jq .
```

## Pillar 4: Events & Webhooks (v0.1.25)

The admin server provides 20 webhook/event endpoints for real-time observability:

- **Webhook management**: create, list, get, update, delete, test subscriptions
- **Event query**: list and retrieve events by tenant, type, category, time range
- **Delivery tracking**: list delivery attempts per subscription with status/date filters
- **Event replay**: re-deliver historical events to a subscription
- **Security config**: manage webhook URL SSRF protection (blocked CIDRs, HTTPS enforcement)
- **Tenant self-service**: tenants manage their own webhooks at `/v1/webhooks` (26 of 40 event types)

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

See [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol) for the full 40-event-type reference and delivery specification. See [Webhook Integrations](/how-to/webhook-integrations) for PagerDuty, Slack, and ServiceNow examples.

## Next steps

- [Webhook Integrations](/how-to/webhook-integrations) — PagerDuty, Slack, ServiceNow examples
- [Admin API Reference (Interactive)](/admin-api/) — full OpenAPI explorer
- [Tenant Management](/how-to/tenant-creation-and-management-in-cycles) — tenant lifecycle patterns
- [API Key Management](/how-to/api-key-management-in-cycles) — key rotation and permissions
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — budget hierarchy patterns
