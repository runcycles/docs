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

### Using the Cycles Admin API

Create budget ledgers and fund them via the admin API. Budget operations require a tenant-scoped API key (`X-Cycles-API-Key`):

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
curl -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme/USD_MICROCENTS/fund" \
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

curl -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme%2Fworkspace:production/USD_MICROCENTS/fund" \
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

If a scope has no budget allocated (allocated = 0), any reservation targeting it will be denied with `BUDGET_EXCEEDED`.

If a scope is not configured at all, the behavior depends on the server implementation. The reference server treats unconfigured scopes as having zero allocation.

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

## Adjusting budgets

### Increasing a budget

Increase the `allocated` value to give a scope more room. This takes effect immediately — the next reservation check will use the new value.

### Decreasing a budget

Decrease the `allocated` value. If the new value is less than `spent + reserved`, existing reservations are not affected, but new reservations may be denied.

### Resetting budgets

To reset a scope for a new billing period, use the `RESET` funding operation:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme/USD_MICROCENTS/fund" \
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

### Funding after overdraft

If a scope has accumulated debt through `ALLOW_WITH_OVERDRAFT` commits, repay it:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme/USD_MICROCENTS/fund" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "REPAY_DEBT",
    "amount": { "amount": 500000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "repay-001"
  }'
```

While `debt > 0`, new reservations against that scope are blocked with `DEBT_OUTSTANDING`.

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
