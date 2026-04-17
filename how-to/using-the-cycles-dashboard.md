---
title: "Using the Cycles Dashboard"
description: "Operator's tour of the Cycles Admin Dashboard — login, capability gating, 10 views, command palette, bulk action lanes, incident-response actions, and RESET_SPENT funding."
---

# Using the Cycles Dashboard

The [Cycles Admin Dashboard](/quickstart/deploying-the-cycles-dashboard) is a Vue 3 SPA that sits in front of `cycles-server-admin` and `cycles-server`. Everything it does is a call against those two backends — the dashboard itself holds no state. This page is the operator's tour: how to log in, what every page does, and which features are behind which admin key capability.

If you haven't deployed the dashboard yet, start with [Deploy the Cycles Admin Dashboard](/quickstart/deploying-the-cycles-dashboard). The examples below assume the dashboard is reachable at `https://admin.example.com`.

## Login and capability gating

The only credential the dashboard accepts is an admin API key. On the login page:

1. Enter the admin API key (the value of `ADMIN_API_KEY` on the server).
2. The dashboard calls `GET /v1/auth/introspect` to validate the key and retrieve the capability set.
3. Sidebar navigation, action buttons, and page access are all gated by capability booleans returned by introspect (`view_overview`, `view_budgets`, `edit_budgets`, `force_release_reservations`, etc.).

The key is stored in `sessionStorage` — it survives a page refresh but is cleared when the tab closes. It is never written to `localStorage` or a cookie. Idle timeout is 30 minutes; absolute timeout is 8 hours; the check runs every 15 seconds.

After 3 failed login attempts the dashboard enforces exponential backoff (5s → 10s → 20s → 40s → 60s cap). A 401 or 403 from any subsequent API call clears the session and redirects to login.

::: tip Treat the admin key like a root credential
There is no user login, no SSO out of the box. Rotate the key regularly, keep it in a secrets manager, and consider putting the dashboard behind SSO or VPN. The dashboard does not weaken this — it uses whatever key you give it.
:::

## The ten views

| View | Purpose |
|------|---------|
| Overview | Single-request aggregated health — entity counts, top offenders, failing webhooks, over-limit scopes |
| Tenants | Tenant list and detail, with nested Budgets / API Keys / Policies tabs |
| Tenant detail (`/tenants/:id`) | Per-tenant drill-down with hierarchy breadcrumbs (`tenant → workspace → app`) |
| Budgets | Tenant-scoped budget list with utilization and debt bars; inline `RESET` and `RESET_SPENT` |
| Events | Correlation-first investigation tool with expandable detail rows |
| API Keys (`/api-keys`) | Cross-tenant key list with masked IDs, permissions, status filters |
| Webhooks | Subscription health (green / yellow / red) plus delivery history, replay, and test |
| Webhook detail (`/webhooks/:id`) | Delivery timeline, last error, signature rotation, pause/resume |
| Reservations (`/reservations`) | Hung-reservation force-release during incident response (runtime-plane admin-on-behalf-of) |
| Audit | Compliance query tool with CSV / JSON export |

Most pages poll their backends on a page-specific interval — see the [deployment guide](/quickstart/deploying-the-cycles-dashboard#polling-cadence) for the cadence table. Audit is manual-only: you press **Run Query** explicitly to avoid drive-by queries against retention-expensive endpoints.

## Power-user features

### Command palette — `Cmd+K` / `Ctrl+K`

Press `Cmd+K` on macOS or `Ctrl+K` on Linux/Windows to open the palette. It searches tenants, budgets, webhooks, API keys, and reservations by ID or name, and exposes common incident actions (freeze budget, suspend tenant, revoke API key, pause webhook) without navigation. The palette respects capability gating — actions you cannot perform do not appear.

### Bulk action lanes

The Tenants and Webhooks pages expose a filter-then-bulk workflow:

1. Apply filters in the page toolbar (`status`, `plan`, `over_limit`, etc.) until the row count is what you want to act on.
2. Click **Bulk action**. A side panel opens with the `expected_count` pre-filled from the current filter.
3. Pick the action. Tenants: `SUSPEND`, `REACTIVATE`, `CLOSE`. Webhooks: `PAUSE`, `RESUME`, `DELETE`. A blast-radius summary confirms before execution.
4. The dashboard calls `POST /v1/admin/tenants/bulk-action` or `POST /v1/admin/webhooks/bulk-action` with the filter, the `expected_count` safety gate, and an idempotency key generated from the current session.
5. The result panel shows per-row `succeeded`, `failed`, `skipped` lists. Failed rows show the per-row `error_code`.

See [Using Bulk Actions](/how-to/using-bulk-actions-for-tenants-and-webhooks) for the full request shape and error taxonomy.

### Tenant hierarchy breadcrumbs

Tenant detail pages show the full scope hierarchy — `tenant → workspace → app → workflow` — as a breadcrumb trail. Clicking any segment navigates up the scope path without losing context (filters, tab selection, and expanded rows are preserved).

### RESET_SPENT inline funding

On the Budgets page, every row has a funding dropdown. Alongside `CREDIT`, `DEBIT`, `REPAY_DEBT`, and `RESET`, the dropdown exposes `RESET_SPENT` — the v0.1.25.18+ funding operation that clears `spent` without touching `allocated`, `reserved`, or `debt`. Picking it opens a confirmation dialog where you can either leave the new `spent` value at zero (monthly rollover) or enter an explicit starting value (prorated correction).

See [Rolling Over Billing Periods with RESET_SPENT](/how-to/rolling-over-billing-periods-with-reset-spent) for when to use each pattern.

## Incident-response actions

Every destructive action is one-click with a confirmation and a blast-radius summary:

| Action | Page | Backend call |
|--------|------|-------------|
| Freeze budget | Budgets / Budget detail | `PATCH /v1/admin/budgets?status=FROZEN` |
| Unfreeze budget | Budgets | `PATCH /v1/admin/budgets?status=ACTIVE` |
| Suspend tenant | Tenants / Tenant detail | `PATCH /v1/admin/tenants/{id}` |
| Reactivate tenant | Tenants | `PATCH /v1/admin/tenants/{id}` |
| Revoke API key | API Keys | `DELETE /v1/admin/api-keys/{id}` |
| Pause webhook | Webhooks / Webhook detail | `PATCH /v1/admin/webhooks/{id}` |
| Resume webhook | Webhooks | `PATCH /v1/admin/webhooks/{id}` |
| Test webhook | Webhook detail | `POST /v1/admin/webhooks/{id}/test` |
| Replay webhook delivery | Webhook detail | `POST /v1/admin/webhook-deliveries/{id}/replay` |
| Force-release reservation | Reservations / Reservation detail | `POST /v1/reservations/{id}/release` with `X-Admin-API-Key` |
| Emergency tenant-wide freeze | Tenant detail | Bulk freeze across all budgets for the tenant |

Force-release uses dual authentication — the dashboard's nginx routes `/v1/reservations*` to `cycles-server:7878` and the runtime server validates both keys before executing. The audit log tags the action `actor_type=admin_on_behalf_of`. See [Force-Releasing Stuck Reservations](/how-to/force-releasing-stuck-reservations-as-an-operator) for the underlying flow.

## Events investigation

The Events page is correlation-first, not time-first:

- Every row has a `correlation_id` (request-scoped) and `request_id` (hop-scoped). Clicking either filters to the full graph of related events across budgets, reservations, webhooks, and audit.
- Expandable detail rows show the full event payload — including `data`, `actor`, `metadata`, and delivery outcome if the event went out over a webhook.
- Filters: event type, category, tenant, scope, time range, correlation ID.

Events poll every 15 seconds (the most aggressive of any page) because incident response typically starts here.

## Audit page

Audit is the one page that is manual-only. You build a query, press **Run Query**, and the dashboard calls `GET /v1/admin/audit/logs` with the filter you built.

Supported filters mirror the audit endpoint: `tenant_id`, `actor_type`, `action_kind`, `idempotency_key`, `bulk_idempotency_key`, `request_id`, time range. Results can be exported as CSV or JSON for compliance review.

Failed-request entries (added in `cycles-server-admin` v0.1.25.20) are included in results. Their `tenant_id` is the sentinel `<unauthenticated>` and they carry `status` (HTTP code) and `error_code` fields. The tiered retention model applies — authenticated entries live 400 days by default, unauthenticated entries 30 days.

## Monitoring the dashboard itself

The dashboard is a static SPA and has no backend of its own, so its "health" is effectively the health of `cycles-server-admin`. Two good synthetic monitoring targets:

- `GET /v1/admin/overview` — if it returns 200, the full stack (Redis + admin + auth) is working.
- `GET /actuator/health` on the admin server — standard Spring Boot liveness.

Alert on the overview payload's `failing_webhooks` and `over_limit_scopes` arrays.

## Next steps

- [Deploy the Cycles Admin Dashboard](/quickstart/deploying-the-cycles-dashboard) — deployment, routing, and hardening
- [Using Bulk Actions](/how-to/using-bulk-actions-for-tenants-and-webhooks) — the API behind the bulk lanes
- [Force-Releasing Stuck Reservations](/how-to/force-releasing-stuck-reservations-as-an-operator) — runtime-plane incident response
- [Rolling Over Billing Periods with RESET_SPENT](/how-to/rolling-over-billing-periods-with-reset-spent) — the funding operation behind the Budgets page dropdown
- [Admin API reference](/admin-api/) — the endpoints every dashboard page calls
