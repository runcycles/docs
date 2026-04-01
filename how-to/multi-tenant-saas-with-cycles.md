---
title: "Building a Multi-Tenant AI SaaS with Cycles"
description: "End-to-end guide for building a multi-tenant AI SaaS with per-customer budget isolation, plan-tier quotas, customer onboarding, and operational monitoring using Cycles."
---

# Building a Multi-Tenant AI SaaS with Cycles

This guide walks through building a multi-tenant AI SaaS where each customer gets independent budget isolation, plan-tier quotas, and real-time cost visibility. It covers architecture decisions, customer onboarding automation, per-tenant middleware, and operational monitoring.

For individual API details, see [Tenant Management](/how-to/tenant-creation-and-management-in-cycles), [Budget Allocation](/how-to/budget-allocation-and-management-in-cycles), and [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles).

## Architecture: tenant-per-customer

Each customer in your SaaS maps to a Cycles tenant. This gives you:

- **Complete blast-radius isolation** — one customer's runaway agent cannot affect others
- **Independent budget enforcement** — each tenant has its own budget hierarchy
- **Separate API keys** — cryptographic isolation at the protocol level
- **Per-tenant observability** — costs, usage, and denials scoped by customer

```
Your SaaS
├── Customer: Acme Corp        → Tenant: acme
│   ├── Production             → Workspace: prod
│   │   ├── Support bot        → Agent: support-bot
│   │   └── Research agent     → Agent: researcher
│   └── Staging                → Workspace: staging
├── Customer: Globex           → Tenant: globex
│   ├── Production             → Workspace: prod
│   └── Development            → Workspace: dev
```

The full scope hierarchy is: `tenant → workspace → app → workflow → agent → toolset`. Use as many or as few levels as you need — [scope derivation](/protocol/how-scope-derivation-works-in-cycles) handles gap-skipping automatically.

## Plan tiers with budget limits

Map your pricing tiers to budget allocations:

| Plan | Monthly budget | Overdraft | Max agents |
|------|---------------|-----------|------------|
| Free | $5 (500,000,000 microcents) | None | 1 |
| Pro | $50 (5,000,000,000 microcents) | $5 overdraft | 5 |
| Enterprise | $500 (50,000,000,000 microcents) | $50 overdraft | Unlimited |

When a customer hits their budget limit, Cycles returns `DENY` on the next reservation. Your application decides what happens: show an upgrade prompt, queue the request, or degrade to a cheaper model. See [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) for patterns.

## Customer onboarding workflow

When a new customer signs up, create their tenant, API key, and initial budget. This is a one-time setup via the Admin API.

### Python

```python
import httpx

ADMIN_URL = "http://localhost:7979"  # Admin Server
ADMIN_KEY = "your-admin-api-key"

headers = {"X-Cycles-API-Key": ADMIN_KEY, "Content-Type": "application/json"}

def onboard_customer(customer_id: str, plan: str) -> dict:
    """Create tenant, API key, and budget for a new customer."""

    # 1. Create the tenant
    tenant_resp = httpx.post(f"{ADMIN_URL}/v1/admin/tenants", headers=headers, json={
        "tenant_id": customer_id,
        "name": f"Customer {customer_id}",
        "metadata": {"plan": plan},
    })
    tenant_resp.raise_for_status()

    # 2. Create an API key for the tenant
    key_resp = httpx.post(f"{ADMIN_URL}/v1/admin/api-keys", headers=headers, json={
        "tenant_id": customer_id,
        "name": f"{customer_id}-runtime-key",
        "permissions": [
            "reservations:create", "reservations:commit",
            "reservations:release", "reservations:extend",
            "balances:read", "decide:execute", "events:create",
        ],
    })
    key_resp.raise_for_status()
    api_key = key_resp.json()["api_key"]

    # 3. Allocate budget based on plan
    budgets = {
        "free":       {"amount": 500_000_000, "overdraft": 0},
        "pro":        {"amount": 5_000_000_000, "overdraft": 500_000_000},
        "enterprise": {"amount": 50_000_000_000, "overdraft": 5_000_000_000},
    }
    plan_budget = budgets[plan]

    httpx.post(f"{ADMIN_URL}/v1/admin/budgets", headers=headers, json={
        "scope": f"tenant:{customer_id}",
        "unit": "USD_MICROCENTS",
        "operation": "CREDIT",
        "amount": plan_budget["amount"],
    }).raise_for_status()

    # Set overdraft limit if applicable
    if plan_budget["overdraft"] > 0:
        httpx.patch(f"{ADMIN_URL}/v1/admin/budgets", headers=headers, json={
            "scope": f"tenant:{customer_id}",
            "overdraft_limit": {"amount": plan_budget["overdraft"], "unit": "USD_MICROCENTS"},
        }).raise_for_status()

    return {"tenant_id": customer_id, "api_key": api_key, "plan": plan}
```

### TypeScript

```typescript
const ADMIN_URL = "http://localhost:7979";
const ADMIN_KEY = "your-admin-api-key";

const headers = {
  "X-Cycles-API-Key": ADMIN_KEY,
  "Content-Type": "application/json",
};

interface OnboardResult {
  tenantId: string;
  apiKey: string;
  plan: string;
}

async function onboardCustomer(
  customerId: string,
  plan: "free" | "pro" | "enterprise",
): Promise<OnboardResult> {
  // 1. Create the tenant
  await fetch(`${ADMIN_URL}/v1/admin/tenants`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tenant_id: customerId,
      name: `Customer ${customerId}`,
      metadata: { plan },
    }),
  });

  // 2. Create an API key for the tenant
  const keyResp = await fetch(`${ADMIN_URL}/v1/admin/api-keys`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tenant_id: customerId,
      name: `${customerId}-runtime-key`,
      permissions: [
        "reservations:create", "reservations:commit",
        "reservations:release", "reservations:extend",
        "balances:read", "decide:execute", "events:create",
      ],
    }),
  });
  const { api_key: apiKey } = await keyResp.json();

  // 3. Allocate budget based on plan
  const budgets = {
    free:       { amount: 500_000_000, overdraft: 0 },
    pro:        { amount: 5_000_000_000, overdraft: 500_000_000 },
    enterprise: { amount: 50_000_000_000, overdraft: 5_000_000_000 },
  };
  const planBudget = budgets[plan];

  await fetch(`${ADMIN_URL}/v1/admin/budgets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      scope: `tenant:${customerId}`,
      unit: "USD_MICROCENTS",
      operation: "CREDIT",
      amount: planBudget.amount,
    }),
  });

  if (planBudget.overdraft > 0) {
    await fetch(`${ADMIN_URL}/v1/admin/budgets`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        scope: `tenant:${customerId}`,
        overdraft_limit: { amount: planBudget.overdraft, unit: "USD_MICROCENTS" },
      }),
    });
  }

  return { tenantId: customerId, apiKey, plan };
}
```

## Per-tenant middleware

Extract the tenant from each request and scope all Cycles operations to that tenant. Store the customer's Cycles API key in your database and use it per-request, or use a shared runtime key with tenant validation.

### FastAPI

```python
from fastapi import Request, Header
from runcycles import CyclesClient, CyclesConfig, Subject

def get_tenant(x_tenant_id: str = Header(...)) -> str:
    return x_tenant_id

@app.middleware("http")
async def tenant_context(request: Request, call_next):
    tenant = request.headers.get("X-Tenant-ID")
    if not tenant:
        return JSONResponse({"error": "X-Tenant-ID header required"}, status_code=400)
    request.state.tenant = tenant
    return await call_next(request)
```

### Express

```typescript
import { Request, Response, NextFunction } from "express";

function tenantContext(req: Request, res: Response, next: NextFunction) {
  const tenant = req.headers["x-tenant-id"] as string;
  if (!tenant) {
    return res.status(400).json({ error: "X-Tenant-ID header required" });
  }
  res.locals.tenant = tenant;
  next();
}

app.use("/api", tenantContext);
```

### Using tenant in Cycles calls

Pass the tenant to every Cycles operation via the `Subject`:

```python
from runcycles import cycles

@cycles(
    estimate=2_000_000,
    action_kind="llm.completion",
    action_name="gpt-4o",
    tenant=request.state.tenant,  # scoped to requesting customer
)
async def handle_chat(prompt: str) -> dict:
    ...
```

Or with the programmatic client:

```python
from runcycles import Subject

subject = Subject(
    tenant=request.state.tenant,
    workspace="prod",
    agent="support-bot",
)
```

## Per-workspace environment isolation

Split each tenant's budget across environments to prevent staging and development from consuming production budget:

```python
def setup_workspace_budgets(customer_id: str, total_budget: int):
    """Split tenant budget: 80% prod, 15% staging, 5% dev."""
    allocations = {
        "prod": int(total_budget * 0.80),
        "staging": int(total_budget * 0.15),
        "dev": int(total_budget * 0.05),
    }

    for workspace, amount in allocations.items():
        httpx.post(f"{ADMIN_URL}/v1/admin/budgets", headers=headers, json={
            "scope": f"tenant:{customer_id}/workspace:{workspace}",
            "unit": "USD_MICROCENTS",
            "operation": "CREDIT",
            "amount": amount,
        }).raise_for_status()
```

Now development runaway loops burn the dev budget ($0.25), not the production budget ($4.00).

## Plan upgrades and downgrades

When a customer changes plans, adjust their budget:

```python
def upgrade_plan(customer_id: str, old_plan: str, new_plan: str):
    """Credit the difference between plans."""
    budgets = {
        "free": 500_000_000,
        "pro": 5_000_000_000,
        "enterprise": 50_000_000_000,
    }
    difference = budgets[new_plan] - budgets[old_plan]

    if difference > 0:
        # Upgrade: credit the difference
        httpx.post(f"{ADMIN_URL}/v1/admin/budgets", headers=headers, json={
            "scope": f"tenant:{customer_id}",
            "unit": "USD_MICROCENTS",
            "operation": "CREDIT",
            "amount": difference,
        }).raise_for_status()

    # Update tenant metadata
    httpx.patch(f"{ADMIN_URL}/v1/admin/tenants/{customer_id}", headers=headers, json={
        "metadata": {"plan": new_plan},
    }).raise_for_status()
```

For downgrades, the remaining budget stays as-is until the billing period resets. Use the `RESET` operation at the start of each billing cycle to set the new plan's allocation.

## Monthly budget reset

At the start of each billing period, reset budgets to the plan allocation:

```python
def monthly_reset(customer_id: str, plan: str):
    """Reset tenant budget for the new billing cycle."""
    budgets = {"free": 500_000_000, "pro": 5_000_000_000, "enterprise": 50_000_000_000}

    httpx.post(f"{ADMIN_URL}/v1/admin/budgets", headers=headers, json={
        "scope": f"tenant:{customer_id}",
        "unit": "USD_MICROCENTS",
        "operation": "RESET",
        "amount": budgets[plan],
    }).raise_for_status()
```

Run this from a cron job or billing system webhook. The `RESET` operation sets the allocated budget to the specified amount, clearing prior spend.

## Customer-facing usage dashboard

Expose per-tenant budget data so customers can see their own usage:

```python
from fastapi import Request

@app.get("/api/usage")
async def usage(request: Request):
    tenant = request.state.tenant
    client = request.app.state.cycles_client

    response = client.get_balances(tenant=tenant)
    if not response.is_success:
        return JSONResponse({"error": "Failed to fetch usage"}, status_code=500)

    balances = response.body.get("balances", [])
    return {
        "tenant": tenant,
        "balances": [
            {
                "scope": b["scope"],
                "allocated": b["allocated"],
                "spent": b["spent"],
                "remaining": b["remaining"],
                "is_over_limit": b.get("is_over_limit", False),
            }
            for b in balances
        ],
    }
```

## Handling budget exhaustion gracefully

When a customer hits their limit, your application should degrade gracefully rather than crash:

```python
from runcycles import BudgetExceededError

async def handle_request(prompt: str, tenant: str) -> dict:
    try:
        return await guarded_llm_call(prompt, tenant=tenant)
    except BudgetExceededError:
        # Option 1: Return a friendly error
        return {
            "content": None,
            "error": "budget_exceeded",
            "message": "You've used your monthly AI budget. Upgrade your plan or wait for the next billing cycle.",
            "upgrade_url": f"/billing/upgrade?tenant={tenant}",
        }
```

For more strategies, see [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer):

| Strategy | When to use |
|----------|-------------|
| **Show upgrade prompt** | Free-tier users hitting limits |
| **Queue for later** | Batch workloads that can wait |
| **Downgrade model** | Use a cheaper model (GPT-4o-mini instead of GPT-4o) |
| **Cache responses** | Repeat queries that have been answered before |
| **Disable feature** | Turn off expensive features while keeping basic ones |

## Suspending and closing tenants

When a customer churns or violates terms, suspend or close their tenant:

```python
def suspend_customer(customer_id: str):
    """Suspend: blocks new reservations, allows existing to complete."""
    httpx.patch(f"{ADMIN_URL}/v1/admin/tenants/{customer_id}", headers=headers, json={
        "status": "SUSPENDED",
    }).raise_for_status()

def close_customer(customer_id: str):
    """Close: blocks all operations. Irreversible."""
    httpx.patch(f"{ADMIN_URL}/v1/admin/tenants/{customer_id}", headers=headers, json={
        "status": "CLOSED",
    }).raise_for_status()
```

**SUSPENDED** blocks new reservations but lets in-flight work complete. **CLOSED** blocks everything and is irreversible. Use `SUSPENDED` first to allow graceful wind-down.

## Monitoring per-tenant health

Set up alerts for per-tenant budget exhaustion using [Webhook Integrations](/how-to/webhook-integrations):

```python
# Example: Slack alert when a tenant exceeds 80% of budget
# Configure via Admin API webhook:
# POST /v1/admin/webhooks
# {
#   "url": "https://hooks.slack.com/services/...",
#   "events": ["budget.threshold.reached"],
#   "filters": {"threshold_percent": 80}
# }
```

Key metrics to monitor per tenant:

| Metric | Alert threshold | Action |
|--------|----------------|--------|
| Budget utilization | > 80% | Notify customer, suggest upgrade |
| Budget utilization | > 95% | Internal alert, prepare for denial |
| Denial rate | > 10% | Customer likely hitting limits — outreach |
| Tenant status | SUSPENDED | Investigate, notify billing team |

See [Monitoring and Alerting](/how-to/monitoring-and-alerting) for PromQL queries and Grafana dashboards.

## Troubleshooting

### Common multi-tenant mistakes

**Inconsistent tenant IDs.** If some requests pass `tenant: "acme"` and others pass `tenant: "Acme"`, they hit different budget scopes. Normalize tenant IDs to lowercase at the middleware level.

**Missing X-Tenant-ID header.** Without tenant extraction, all requests share the default tenant's budget. Use middleware that rejects requests without the header.

**Shared API key across tenants.** Each API key is bound to one tenant. If you use a shared key, all requests are attributed to that key's tenant. Use per-tenant API keys for proper isolation.

**Budget allocated at wrong scope.** If you allocate budget at `tenant:acme` but your agents report with `tenant:acme/workspace:prod`, the workspace-level budget is missing and enforcement is skipped at that level. Allocate at the levels you want to enforce.

## Key points

- **One tenant per customer.** Map each SaaS customer to a Cycles tenant for complete budget isolation.
- **Plan tiers map to budget allocations.** Free, Pro, Enterprise plans differ in allocated budget and overdraft limits.
- **Automate onboarding.** Create tenant, API key, and budget in a single workflow when a customer signs up.
- **Extract tenant from every request.** Use middleware to ensure every Cycles call is scoped to the requesting customer.
- **Reset monthly.** Use the `RESET` budget operation at billing cycle boundaries.
- **Degrade gracefully.** When budget is exhausted, show upgrade prompts or switch to cheaper models.
- **Monitor per-tenant.** Alert on budget thresholds before customers are affected.

## Next steps

- [Tenant Creation and Management](/how-to/tenant-creation-and-management-in-cycles) — Admin API for tenant lifecycle
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — credit, debit, reset operations
- [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles) — how budget hierarchies work
- [API Key Management](/how-to/api-key-management-in-cycles) — per-tenant key creation and permissions
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — strategies for budget exhaustion
- [Webhook Integrations](/how-to/webhook-integrations) — per-tenant alerting via Slack, PagerDuty
- [Common Budget Patterns](/how-to/common-budget-patterns) — reusable budget recipes
- [Monitoring and Alerting](/how-to/monitoring-and-alerting) — operational dashboards
