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

## Next steps

- [Admin API Reference (Interactive)](/admin-api/) — full OpenAPI explorer
- [Tenant Management](/how-to/tenant-creation-and-management-in-cycles) — tenant lifecycle patterns
- [API Key Management](/how-to/api-key-management-in-cycles) — key rotation and permissions
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — budget hierarchy patterns
