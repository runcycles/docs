---
aside: false
outline: false
title: Admin API Reference
description: Interactive API reference for the RunCycles Admin API. Manage budgets, tenants, and governance policies.
---

<script setup lang="ts">
import adminSpec from '../public/admin-openapi.json'
</script>

# Admin API Reference

Interactive reference for the RunCycles Admin API. Use this API to operate tenants, API keys, budget ledgers, policies, webhooks, events, audit logs, and dashboard overview data.

::: tip Looking for operator workflows?
Start with the [Admin API Guide](/admin-api/guide) for curl examples, auth header guidance, tenant lifecycle behavior, budget operations, webhook replay, audit filters, and bulk actions.
:::

## Authentication

The admin server runs separately from the runtime API, usually on port `7979`.

| Header | Use for |
|---|---|
| `X-Admin-API-Key` | Bootstrap/admin operations such as tenant management, API key lifecycle, audit logs, overview data, auth introspection, and webhook security config. |
| `X-Cycles-API-Key` | Tenant-scoped operations such as budget creation, policy management, tenant self-service webhooks, tenant event reads, and balance reads. |

`admin:read` and `admin:write` act as wildcard permissions for read and write operations respectively when an endpoint accepts tenant-scoped API keys.

## Common entry points

- [Tenant and API key setup](/how-to/tenant-creation-and-management-in-cycles) — create tenants, issue keys, suspend or close tenants.
- [Budget allocation](/how-to/budget-allocation-and-management-in-cycles) — create, fund, freeze, unfreeze, reset, and inspect budget ledgers.
- [Admin overview](/how-to/using-the-cycles-dashboard) — understand the dashboard data served by `GET /v1/admin/overview`.
- [Webhooks](/how-to/managing-webhooks) — create subscriptions, inspect deliveries, replay events, and configure webhook URL security.
- [Tenant self-service webhooks](/how-to/webhook-integrations#tenant-self-service-webhooks) — let tenant API keys manage scoped webhook subscriptions and read their own event stream.
- [Bulk actions](/how-to/using-bulk-actions-for-tenants-and-webhooks) — suspend, reactivate, close, pause, resume, delete, credit, debit, reset, and repay many rows safely.
- [Searching and sorting](/how-to/searching-and-sorting-admin-list-endpoints) — use `search`, `sort_by`, `sort_dir`, filters, and cursor rules on list endpoints.

## Conformance note

Most admin endpoints are part of the `runcycles-reference` governance plane rather than the portable runtime protocol. The normative parts are called out in the [Admin API Guide](/admin-api/guide#tenant-management) and in the YAML spec.

<OASpec :spec="adminSpec" />
