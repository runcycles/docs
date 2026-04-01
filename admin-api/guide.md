---
title: "Admin API Guide"
description: "How to use the Cycles Admin API for tenant management, API key lifecycle, budget operations, and policy configuration."
---

# Admin API Guide

The Cycles Admin API runs on port **7979** (separate from the runtime API on port 7878) and provides endpoints for managing tenants, API keys, budgets, and policies. All requests use the `X-Admin-API-Key` header.

For the full interactive API reference, see the [Admin API Reference](/admin-api/).

## Authentication

```bash
# All admin requests use this header
-H "X-Admin-API-Key: admin-bootstrap-key"
```

The admin key is set via the `ADMIN_API_KEY` environment variable when starting the admin server.

## Tenant management

### Create a tenant

```bash
curl -s -X POST http://localhost:7979/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "Acme Corporation",
    "status": "ACTIVE"
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
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "scope": "tenant:acme-corp",
    "unit": "USD_MICROCENTS",
    "allocated": 100000000
  }' | jq .
```

### Fund an existing budget (CREDIT)

```bash
curl -s -X POST http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme-corp&unit=USD_MICROCENTS \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "operation": "CREDIT",
    "amount": 50000000
  }' | jq .
```

Operations: `CREDIT` (add funds), `DEBIT` (remove funds), `RESET` (reset to specified amount), `REPAY_DEBT` (reduce outstanding debt).

### Patch budget settings

*New in v0.1.24:*

```bash
curl -s -X PATCH 'http://localhost:7979/v1/admin/budgets?scope=tenant:acme-corp&unit=USD_MICROCENTS' \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "commit_overage_policy": "REJECT",
    "overdraft_limit": 10000000
  }' | jq .
```

This atomically recalculates `is_over_limit` based on the new settings.

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
