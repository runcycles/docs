---
title: "Rolling Over Billing Periods with RESET_SPENT"
description: "Use the RESET_SPENT funding operation in Cycles to start a new billing period without disturbing reservations or debt — the difference between RESET_SPENT and RESET."
---

# Rolling Over Billing Periods with RESET_SPENT

Budget ledgers in Cycles track four counters: `allocated`, `spent`, `reserved`, and `debt`. At the end of a billing period — monthly, weekly, or whatever your plan defines — you typically want to carry forward the *allocation* and clear the *spend*, while preserving in-flight reservations and any debt that should persist into the next period.

That is exactly what `RESET_SPENT` does. It was added in `cycles-server-admin` v0.1.25.18 as a narrower alternative to the existing `RESET` operation, and is available as a funding operation on `POST /v1/admin/budgets/fund`.

## RESET vs RESET_SPENT

The two operations are easy to confuse. Here is how they differ:

| Operation | Sets `allocated` | Clears `spent` | Preserves `reserved` | Preserves `debt` |
|-----------|------------------|----------------|----------------------|------------------|
| `RESET` | **Yes** — to the `amount` in the request | No — preserved | Yes | Yes |
| `RESET_SPENT` | **Optional** — defaults to existing allocation | **Yes** — cleared (or set to the value in the request) | Yes | Yes |

- **`RESET`** changes the size of the budget. The allocation counter is rewritten to whatever you passed in. `spent` carries over. Use this when a customer upgrades or downgrades mid-period.
- **`RESET_SPENT`** starts a new billing period. The `spent` counter is zeroed out (or set to a specific starting value, e.g., for a prorated correction). `allocated` is left alone unless you explicitly pass a new value.

The protocol was missing a way to roll over `spent` without either also rewriting `allocated` or issuing a corrective `DEBIT`, both of which were error-prone. `RESET_SPENT` closes that gap.

## Basic monthly rollover

The most common case — a cron job that runs at the start of each billing period and zeroes out spend while keeping the allocation intact:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme-corp&unit=USD_MICROCENTS" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "RESET_SPENT",
    "idempotency_key": "rollover-acme-2026-05",
    "reason": "Monthly rollover for billing period 2026-05"
  }'
```

After this call:

- `allocated` — unchanged.
- `spent` — zero.
- `reserved` — unchanged. Any reservations that were live at the moment of the call continue to hold their budget, and commit normally.
- `debt` — unchanged.
- `remaining` — recomputed as `allocated - reserved - debt`.

The idempotency key should encode the tenant and the period being started. If the cron retries, the replay returns the original response and the counters do not move twice.

## Prorated corrections

If a customer upgrades mid-period and you need to credit back some of the spend they incurred on the old plan, you can pass an explicit `spent` value instead of clearing to zero:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme-corp&unit=USD_MICROCENTS" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "RESET_SPENT",
    "idempotency_key": "prorate-acme-2026-04-17",
    "spent": { "amount": 3200000, "unit": "USD_MICROCENTS" },
    "reason": "Prorated spend after mid-period plan change"
  }'
```

This sets `spent` to exactly `3200000` microcents rather than zero. Use this pattern for:

- Plan changes where the carry-over spend is recalculated
- Refunds issued as a spend reduction rather than an allocation increase
- Migration from a legacy billing system where opening balances are non-zero

## Why reserved and debt are preserved

This is deliberate and matches how production systems actually roll over:

- **Reserved budget represents in-flight work.** An agent that started a reservation at 23:59:58 is still executing at 00:00:02. Zeroing `reserved` would cause its commit to double-count (the commit would subtract from the fresh period's budget while the reservation's hold was already released). Preserving `reserved` lets the existing reservation commit cleanly.
- **Debt represents money you've already let the tenant spend past the cap.** If the old period ended in overdraft, that debt is a real liability. It should either roll forward (the default) or be repaid explicitly with `REPAY_DEBT`. Silently clearing debt at rollover would erase the accounting.

If you want to explicitly zero out reservations or debt, use the targeted operations (`POST /v1/reservations/{id}/release` or a `REPAY_DEBT` funding call) alongside the `RESET_SPENT` call.

## Events emitted

A successful `RESET_SPENT` emits `budget.reset_spent` (v0.1.25.18+). The payload includes both the pre-rollover `spent` value and the post-rollover value — useful for downstream billing systems that want to archive the period's total on the event stream rather than polling balances.

```json
{
  "event_type": "budget.reset_spent",
  "data": {
    "ledger_id": "led_acme_default",
    "scope": "tenant:acme-corp",
    "unit": "USD_MICROCENTS",
    "allocated": 100000000,
    "spent_before": 87340000,
    "spent_after": 0,
    "reserved": 1200000,
    "debt": 0
  }
}
```

See the [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol) for the full event envelope.

## Scheduling the rollover

Cycles does not schedule rollovers for you — there is no built-in cron. You run the rollover however fits your operational model:

- **External cron.** A scheduled job that reads a list of active tenants from your own tenancy database and calls `RESET_SPENT` for each on the first of the month.
- **Stripe webhook-driven.** A handler for Stripe's `invoice.finalized` event that rolls over the corresponding tenant as part of invoice reconciliation.
- **Event-driven.** Subscribe to `budget.threshold_crossed` at 100% utilization and roll over automatically if your plan logic calls for it.

In every case, make the idempotency key include the target period, so a retry or duplicate trigger does not double-rollover.

## Common mistakes

- **Using `RESET` when you meant `RESET_SPENT`.** `RESET` rewrites `allocated` — it does not clear spend. If you call `RESET` with the same `amount` as the previous period, you've changed nothing. Use `RESET_SPENT` to zero out spend.
- **Zeroing out before in-flight reservations commit.** `RESET_SPENT` preserves reservations by design, so this is handled — but if you write custom tooling that manually sets `spent` to zero, remember to leave `reserved` alone.
- **Forgetting to roll over debt deliberately.** If your plan says debt should not carry between periods, issue an explicit `REPAY_DEBT` before the rollover (with the corresponding accounting entry in your billing system). `RESET_SPENT` on its own will leave debt untouched.
- **Not generating a unique idempotency key per period.** Reusing `rollover-acme` month after month means the second month is a replay of the first, returning the first month's response and moving nothing.

## Next steps

- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — the full funding operation catalog
- [Admin API reference](/admin-api/) — OpenAPI definitions for `/v1/admin/budgets/fund`
- [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol) — `budget.reset_spent` event details
- [Multi-Tenant SaaS with Cycles](/how-to/multi-tenant-saas-with-cycles) — where rollover fits in a SaaS billing cycle
