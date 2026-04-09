---
title: "Budget Allocation and Management in Cycles"
description: "How budget allocation works in Cycles — set up scope-level budgets, fund them, reset for billing periods, and manage hierarchical budget structures."
---

# Budget Allocation and Management in Cycles

Before you can enforce budgets with Cycles, budgets need to be allocated to scopes. This page explains how budget allocation works, how to set it up, and how to manage budgets over time.

## What is allocation?

Allocation is the total budget assigned to a scope. It is the ceiling against which reservations and commits are measured.

The formula for remaining budget is:

```
remaining = allocated - spent - reserved - debt
```

A reservation succeeds only if `remaining >= estimate` across all affected scopes.

## How allocation works

Each scope in Cycles has an `allocated` value. When a client creates a reservation, the server checks the allocated budget for every scope in the derived hierarchy.

For example, if a reservation targets:

```json
{
  "tenant": "acme",
  "workspace": "production",
  "app": "chatbot"
}
```

Three scopes are checked:

- `tenant:acme` — must have sufficient remaining budget
- `tenant:acme/workspace:production` — must have sufficient remaining budget
- `tenant:acme/workspace:production/app:chatbot` — must have sufficient remaining budget

All three must pass for the reservation to succeed.

## Setting budgets

Budget allocation is managed through the [Cycles Admin Server](https://github.com/runcycles/cycles-server-admin) API (port 7979 by default). The admin server and the runtime Cycles server share the same Redis instance.

### Authentication

Budget, policy, and balance endpoints on the admin server require a tenant-scoped API key (`X-Cycles-API-Key`) with the appropriate admin permissions:

- **`admin:write`** — required for creating budgets, funding, resetting, updating budgets, and managing policies
- **`admin:read`** — required for querying budgets and policies

Default API keys (with only `reservations:*` and `balances:read`) will receive a `403 INSUFFICIENT_PERMISSIONS` error on budget endpoints. You must explicitly include `admin:write` and/or `admin:read` when [creating the key](/how-to/api-key-management-in-cycles#available-permissions).

::: warning X-Admin-API-Key vs X-Cycles-API-Key
The bootstrap admin key (`X-Admin-API-Key`) is used for tenant management, API key management, audit log access, **and budget PATCH** (overdraft settings are admin-only). Budget create, fund, and list require `X-Cycles-API-Key` with admin permissions.
:::

### Using the Cycles Admin API

Create budget ledgers and fund them via the admin API:

```bash
# Create a tenant budget ledger
curl -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "scope": "tenant:acme",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 1000000, "unit": "USD_MICROCENTS" }
  }'

# Fund the budget
curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "CREDIT",
    "amount": { "amount": 1000000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "fund-acme-001"
  }'

# Create a workspace budget within that tenant
curl -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "scope": "tenant:acme/workspace:production",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 500000, "unit": "USD_MICROCENTS" }
  }'

curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme/workspace:production&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "CREDIT",
    "amount": { "amount": 500000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "fund-acme-prod-001"
  }'
```

::: info Note
Tenants and API keys must be created first using the admin key (`X-Admin-API-Key`). See [Deploying the Full Cycles Stack](/quickstart/deploying-the-full-cycles-stack) for the complete bootstrap sequence.
:::

### Budget hierarchy

Budgets are independent at each scope level. A tenant budget of 1,000,000 does not automatically distribute to child scopes.

You set the allocated amount at each level you want to control:

| Scope | Allocated | Purpose |
|---|---|---|
| `tenant:acme` | 1,000,000 | Global cap for the tenant |
| `tenant:acme/workspace:production` | 500,000 | Cap for the production environment |
| `tenant:acme/workspace:production/app:chatbot` | 100,000 | Cap for the chatbot app |

A reservation for 10,000 against the chatbot scope must pass all three levels.

### Unallocated scopes

If a scope has a budget ledger with zero allocation (`allocated = 0`), any reservation targeting it will be denied with `BUDGET_EXCEEDED` (409). The ledger exists but has no room.

If a scope has no budget ledger at all, it is **skipped** during enforcement — it does not block the reservation. This is different from zero allocation: a missing ledger is ignored, a zero-allocation ledger is enforced.

### How budget lookup works during reservations

When the server processes a reservation, it derives scope paths from the subject (e.g., `tenant:acme`, `tenant:acme/workspace:prod`, `tenant:acme/workspace:prod/app:chatbot`) and checks each for a budget ledger:

1. Scopes **with** a budget ledger are checked for sufficient funds
2. Scopes **without** a budget ledger are skipped — they do not block the reservation
3. If **no** derived scope has a budget ledger, the reservation is rejected with `NOT_FOUND` (404)
4. If **any** budgeted scope has insufficient funds, the reservation is rejected with `BUDGET_EXCEEDED` (409)

This means you only need budgets at the scope levels where you want enforcement. For example, if you only set a tenant-level budget, workspace and app scopes are skipped — the tenant budget is the only constraint.

| Scenario | Result |
|---|---|
| Budget at tenant only, reservation targets tenant/workspace/app | Reserves against tenant budget; workspace and app skipped |
| Budget at tenant and app, not workspace | Reserves against both; workspace skipped |
| No budget at any scope | `NOT_FOUND` (404) |
| Budget exists with zero allocation | `BUDGET_EXCEEDED` (409) |

## Common allocation patterns

### Flat tenant budgets

The simplest approach: allocate a single budget at the tenant level.

```
tenant:acme → allocated: 1,000,000
```

Every reservation by tenant `acme` draws from this single pool. No per-workspace or per-app limits.

### Tenant + workspace budgets

Add workspace-level budgets for environment isolation:

```
tenant:acme                          → allocated: 1,000,000
tenant:acme/workspace:production     → allocated: 500,000
tenant:acme/workspace:staging        → allocated: 200,000
tenant:acme/workspace:development    → allocated: 300,000
```

Production cannot consume more than 500,000, even if the tenant has remaining budget elsewhere.

### Per-workflow run budgets

For short-lived workflows, allocate budgets per run using the workflow field:

```
tenant:acme/workspace:production/workflow:run-12345 → allocated: 50,000
```

This caps a single workflow execution at 50,000 units.

### Per-agent budgets

For multi-agent systems, allocate per agent:

```
tenant:acme/workspace:production/agent:planner   → allocated: 100,000
tenant:acme/workspace:production/agent:executor   → allocated: 200,000
tenant:acme/workspace:production/agent:reviewer   → allocated: 50,000
```

### Using custom dimensions

For budgeting dimensions that don't fit the standard hierarchy, use the `dimensions` field:

```
tenant:acme/dimensions:cost_center=engineering → allocated: 500,000
tenant:acme/dimensions:cost_center=marketing   → allocated: 200,000
```

## Updating budget configuration

Use `PATCH /v1/admin/budgets?scope={scope}&unit={unit}` to update mutable budget properties without re-creating the ledger:

```bash
curl -s -X PATCH "http://localhost:7979/v1/admin/budgets?scope=tenant:acme&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{
    "overdraft_limit": { "amount": 500000, "unit": "USD_MICROCENTS" },
    "commit_overage_policy": "ALLOW_WITH_OVERDRAFT",
    "metadata": { "cost_center": "engineering" }
  }' | jq .
```

You can update:

- **`overdraft_limit`** — maximum allowed debt. When changed, `is_over_limit` is atomically recalculated.
- **`commit_overage_policy`** — per-ledger overage policy override (`REJECT`, `ALLOW_IF_AVAILABLE`, `ALLOW_WITH_OVERDRAFT`).
- **`metadata`** — key-value pairs for external references (replaces the full metadata object).

Fields not included in the request are left unchanged. Returns `404` if the budget does not exist, `403` for tenant mismatch, and `409` if the budget is `CLOSED`.

## Freezing and unfreezing budgets

*New in v0.1.25.6.*

Use freeze to immediately halt all new reservations against a budget without deleting or modifying it. This is useful during incident investigations, compliance holds, or when a runaway agent is detected.

### Freeze

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/freeze?scope=tenant:acme&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{"reason": "Investigating runaway agent in support workflow"}' | jq .
```

All new reservations return `DENY` with reason code `BUDGET_FROZEN`, and fund operations return 409. Existing active reservations continue until they commit or expire. Emits a `budget.frozen` webhook event.

### Unfreeze

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/unfreeze?scope=tenant:acme&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{"reason": "Investigation complete — root cause was prompt loop, now fixed"}' | jq .
```

Transitions FROZEN → ACTIVE. Reservations resume immediately. Emits a `budget.unfrozen` webhook event. Returns 409 if the budget is already active or closed.

::: tip When to freeze vs. adjust budget
**Freeze** when you need to stop all activity immediately while investigating. The budget allocation and history are preserved. **Adjust the budget** (PATCH or fund) when you want to change how much is available. Freeze is an operational control; budget adjustment is a financial control.
:::

## Adjusting budget allocation

### Increasing a budget

Increase the `allocated` value to give a scope more room. This takes effect immediately — the next reservation check will use the new value.

### Decreasing a budget

Decrease the `allocated` value. If the new value is less than `spent + reserved`, existing reservations are not affected, but new reservations may be denied.

### Resetting budgets

To reset a scope for a new billing period, use the `RESET` funding operation:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "RESET",
    "amount": { "amount": 1000000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "reset-march-2026",
    "reason": "Monthly budget reset"
  }'
```

`RESET` sets `allocated = amount` and recalculates `remaining = amount - reserved - spent - debt`. Release any active reservations first to avoid unexpected budget pressure.

::: info Why budgets cannot be deleted
The admin API has no delete endpoint for budgets. A budget ledger is the permanent audit record for all spend within a scope — committed reservations reference it, and historical balances are derived from it. Deleting a ledger would create orphaned transactions and break spend reporting.

To decommission a budget: `RESET` its allocation to zero (or `DEBIT` the remaining balance). No new reservations will be approved against a zero-balance scope. The ledger stays in the system for historical queries but has no operational cost.
:::

### Funding after overdraft

If a scope has accumulated debt through `ALLOW_WITH_OVERDRAFT` commits, repay it:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "REPAY_DEBT",
    "amount": { "amount": 500000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "repay-001"
  }'
```

While `debt > 0` and no `overdraft_limit` is configured, new reservations against that scope are blocked with `DEBT_OUTSTANDING`. When an `overdraft_limit > 0` is set, debt within the limit does not block new reservations.

## Monitoring budgets

Use the `GET /v1/balances` endpoint to check budget state:

```bash
curl -s "http://localhost:7878/v1/balances?tenant=acme" \
  -H "X-Cycles-API-Key: your-api-key"
```

This returns the current state for all scopes matching the filter:

```json
{
  "balances": [
    {
      "scope": "tenant:acme",
      "scope_path": "tenant:acme",
      "remaining": { "amount": 750000, "unit": "USD_MICROCENTS" },
      "allocated": { "amount": 1000000, "unit": "USD_MICROCENTS" },
      "spent": { "amount": 200000, "unit": "USD_MICROCENTS" },
      "reserved": { "amount": 50000, "unit": "USD_MICROCENTS" },
      "debt": { "amount": 0, "unit": "USD_MICROCENTS" },
      "overdraft_limit": { "amount": 0, "unit": "USD_MICROCENTS" },
      "is_over_limit": false
    }
  ]
}
```

Key fields to monitor:

- **remaining** — how much room is left
- **reserved** — how much is currently held by active reservations
- **debt** — any overdraft accumulation
- **is_over_limit** — whether the scope is blocked

## Managing policies

Policies define caps, rate limits, and behavioral overrides matched by scope pattern. Create a policy to enforce rules across matching scopes:

```bash
curl -s -X POST http://localhost:7979/v1/admin/policies \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "name": "production-limits",
    "scope_pattern": "tenant:acme-corp/workspace:production/*",
    "priority": 10,
    "commit_overage_policy": "REJECT",
    "rate_limits": {
      "max_reservations_per_minute": 100,
      "max_commits_per_minute": 100
    },
    "caps": {
      "max_tokens": 4096
    }
  }' | jq .
```

### Updating a policy

Use `PATCH /v1/admin/policies/{policy_id}` to modify mutable fields without re-creating the policy:

```bash
curl -s -X PATCH "http://localhost:7979/v1/admin/policies/$POLICY_ID" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "priority": 20,
    "caps": { "max_tokens": 8192 },
    "rate_limits": {
      "max_reservations_per_minute": 200,
      "max_commits_per_minute": 200
    }
  }' | jq .
```

You can update: `name`, `description`, `priority`, `caps`, `commit_overage_policy`, `reservation_ttl_override`, `rate_limits`, `effective_from`, `effective_until`, and `status`. Fields not included in the request are left unchanged. Set `status` to `DISABLED` to deactivate a policy without deleting it.

## Summary

Budget allocation in Cycles:

- Is set per scope independently
- Is enforced atomically across the full scope hierarchy for each reservation
- Can be adjusted at any time with immediate effect
- Requires explicit allocation at every scope level you want to control
- Supports flat, hierarchical, per-run, per-agent, and custom dimension patterns

## Next steps

- [Tenants, Scopes, and Budgets](/how-to/understanding-tenants-scopes-and-budgets-in-cycles) — how tenants, scopes, and budgets work together as a unified model
- [Tenant Creation and Management](/how-to/tenant-creation-and-management-in-cycles) — create and configure tenants before allocating budgets
- [Querying Balances](/protocol/querying-balances-in-cycles-understanding-budget-state) — detailed balance query guide
- [Debt and Overdraft](/protocol/debt-overdraft-and-the-over-limit-model-in-cycles) — how overdraft affects allocation
- [How Scope Derivation Works](/protocol/how-scope-derivation-works-in-cycles) — how scopes are derived from Subjects
