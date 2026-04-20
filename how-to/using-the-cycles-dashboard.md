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

The Tenants, Webhooks, and Budgets pages expose a filter-then-bulk workflow:

1. Apply filters in the page toolbar (`status`, `plan`, `over_limit`, etc.) until the row count is what you want to act on.
2. Click **Bulk action**. A side panel opens with the `expected_count` pre-filled from the current filter.
3. Pick the action. Tenants: `SUSPEND`, `REACTIVATE`, `CLOSE`. Webhooks: `PAUSE`, `RESUME`, `DELETE`. Budgets (v0.1.25.35+, requires admin v0.1.25.29+): `CREDIT`, `DEBIT`, `RESET`, `RESET_SPENT`, `REPAY_DEBT`. A blast-radius summary confirms before execution.
4. The dashboard calls `POST /v1/admin/tenants/bulk-action`, `/v1/admin/webhooks/bulk-action`, or `/v1/admin/budgets/bulk-action` with the filter, the `expected_count` safety gate, and an idempotency key generated from the current session.
5. The result panel shows per-row `succeeded`, `failed`, `skipped` lists — rendered in a `BulkActionResultDialog` (v0.1.25.34+) with per-row copy-ID affordances and operator-friendly error messages sourced from the shared `errorCodeMessages` catalog. Failed rows show the per-row `error_code`.

**Row-select variant (v0.1.25.36).** The Budgets view also supports row-select bulk Freeze and Unfreeze — select individual checkboxes across filtered rows rather than applying to the whole filter. Row-select bulk failures open the same `BulkActionResultDialog` with per-row status.

See [Using Bulk Actions](/how-to/using-bulk-actions-for-tenants-and-webhooks) for the full request shape and error taxonomy.

### Cross-surface correlation chip (v0.1.25.39)

Every row on Events, Audit, and WebhookDeliveries views carries a **correlation chip** with three identifiers — `trace_id`, `request_id`, `correlation_id` (see [Correlation and Tracing](/protocol/correlation-and-tracing-in-cycles) for what each one scopes). Clicking any identifier opens a pivot menu:

- Click `trace_id` on an Audit row → EventsView filtered to the same trace, plus a side panel with every webhook delivery dispatched under that trace.
- Click `trace_id` on an Events row → AuditView filtered to the originating entry.
- Click `correlation_id` on an EventTimeline row → EventsView filtered to all events in the same cluster (v0.1.25.37+).
- Copy-to-clipboard icon on the chip for sharing into tickets or chat.

This is how operator triage starts in v0.1.25: pull a `trace_id` out of a failing response header (`X-Cycles-Trace-Id`) or error body, paste into the dashboard command palette, and follow the chip through the four views. Requires `cycles-server-admin` v0.1.25.31+ for server-side support. See [Correlation and Tracing](/protocol/correlation-and-tracing-in-cycles).

### Tenant hierarchy breadcrumbs

Tenant detail pages show the full scope hierarchy — `tenant → workspace → app → workflow` — as a breadcrumb trail. Clicking any segment navigates up the scope path without losing context (filters, tab selection, and expanded rows are preserved).

### RESET_SPENT inline funding

On the Budgets page, every row has a funding dropdown. Alongside `CREDIT`, `DEBIT`, `REPAY_DEBT`, and `RESET`, the dropdown exposes `RESET_SPENT` — the v0.1.25.18+ funding operation that clears `spent` without touching `allocated`, `reserved`, or `debt`. Picking it opens a confirmation dialog where you can either leave the new `spent` value at zero (monthly rollover) or enter an explicit starting value (prorated correction).

See [Rolling Over Billing Periods with RESET_SPENT](/how-to/rolling-over-billing-periods-with-reset-spent) for when to use each pattern.

### Closed-tenant tombstone and cascade preview

As of v0.1.25.43 (consuming admin v0.1.25.36), the dashboard surfaces tenant-close cascade behavior through four coordinated affordances:

- **Closed-tenant banner.** When `tenant.status === 'CLOSED'`, an amber read-only banner renders at the top of `TenantDetailView`: *"Tenant closed — all owned objects are read-only."* Immediately answers the "why won't this unfreeze?" question on closed-tenant pages.
- **CLOSE confirm-dialog cascade preview.** Before closing, the confirmation dialog enumerates what will be terminated — owned budgets, webhook subscriptions, API keys, open reservations, with counts pulled from already-loaded tenant-detail state. Spells out *"This cannot be undone."* Useful for estimating blast radius before pulling the trigger.
- **`TENANT_CLOSED` 409 humanizer.** Any mutation that races the cascade (stale tab, deep-link, in-flight request) surfaces as *"Tenant is closed — this object is read-only."* instead of a raw 409. Lives alongside the existing error-code map in `errorCodeMessages.ts`.
- **Tenant-cascade audit + event chip.** `AuditView` and `EventTimeline` rows render a small amber "tenant cascade" chip when the event carries a `_via_tenant_cascade` suffix (`budget.closed_via_tenant_cascade`, `webhook.disabled_via_tenant_cascade`, `api_key.revoked_via_tenant_cascade`, `reservation.released_via_tenant_cascade`, or audit operation `tenant_close_cascade`). Lets operators visually distinguish cascade-triggered state changes from user-driven ones when correlating by `correlation_id`.

Requires admin v0.1.25.36. Running the dashboard against admin `.32` still renders the tombstone + dialog preview (pure client-side), but the cascade itself won't fire and frozen budgets on closed tenants continue to inflate the Overview alert counter. Running against `.35` works but leaves policy / api-key / webhook-admin mutations un-guarded against the Rule 2 MUST — `.36` completes the guard coverage.

See [Tenant-Close Cascade Semantics](/protocol/tenant-close-cascade-semantics) for the full protocol contract.

## Incident-response actions

Every destructive action is one-click with a confirmation and a blast-radius summary:

| Action | Page | Backend call |
|--------|------|-------------|
| Freeze budget | Budgets / Budget detail | `PATCH /v1/admin/budgets?status=FROZEN` |
| Unfreeze budget | Budgets | `PATCH /v1/admin/budgets?status=ACTIVE` |
| Bulk Freeze / Unfreeze budgets (v0.1.25.36+) | Budgets — row-select + floating toolbar | `POST /v1/admin/budgets/bulk-action` |
| Suspend tenant | Tenants / Tenant detail | `PATCH /v1/admin/tenants/{id}` |
| Reactivate tenant | Tenants | `PATCH /v1/admin/tenants/{id}` |
| Revoke API key | API Keys | `DELETE /v1/admin/api-keys/{id}` |
| Pause webhook | Webhooks / Webhook detail | `PATCH /v1/admin/webhooks/{id}` |
| Resume webhook | Webhooks | `PATCH /v1/admin/webhooks/{id}` |
| Test webhook | Webhook detail | `POST /v1/admin/webhooks/{id}/test` |
| Replay webhook delivery | Webhook detail | `POST /v1/admin/webhook-deliveries/{id}/replay` |
| Force-release reservation | Reservations / Reservation detail | `POST /v1/reservations/{id}/release` with `X-Admin-API-Key` |
| Emergency tenant-wide freeze | Tenant detail | Bulk freeze across all budgets for the tenant |
| Close tenant (cascades owned objects, v0.1.25.43+) | Tenants / Tenant detail | `PATCH /v1/admin/tenants/{id}` — dashboard shows cascade preview before confirming |

Force-release uses dual authentication — the dashboard's nginx routes `/v1/reservations*` to `cycles-server:7878` and the runtime server validates both keys before executing. The audit log tags the action `actor_type=admin_on_behalf_of`. See [Force-Releasing Stuck Reservations](/how-to/force-releasing-stuck-reservations-as-an-operator) for the underlying flow.

## Events investigation

The Events page is correlation-first, not time-first:

- Every row has a `correlation_id` (request-scoped) and `request_id` (hop-scoped). Clicking either filters to the full graph of related events across budgets, reservations, webhooks, and audit.
- Expandable detail rows show the full event payload — including `data`, `actor`, `metadata`, and delivery outcome if the event went out over a webhook.
- Filters: event type, category, tenant, scope, time range, correlation ID.

Events poll every 15 seconds (the most aggressive of any page) because incident response typically starts here.

Per-row **Copy JSON** (v0.1.25.37+) is available on every surface rendering an event, audit entry, event-timeline entry, or webhook delivery — part of the shared triage affordances extracted to the icon library in v0.1.25.40. The correlation chip (trace_id / request_id / correlation_id) is available on the same rows.

## Audit page

Audit is the one page that is manual-only. You build a query, press **Run Query**, and the dashboard calls `GET /v1/admin/audit/logs` with the filter you built.

Supported filters (v0.1.25.33 UI + v0.1.25.27 server DSL): `tenant_id`, `actor_type`, `action_kind`, `idempotency_key`, `bulk_idempotency_key`, `request_id`, `trace_id`, `error_code` (IN-list), `error_code_exclude` (NOT-IN-list), `status_min` / `status_max` (range), `operation` (IN-list), `resource_type` (typeahead + IN-list), free-text `search`, time range. Deep-link URL params (`?error_code_exclude=`, `?status_min=`) support sharable filter state. Results can be exported as CSV or JSON for compliance review.

Bulk-action audit rows expand into a structured detail panel (v0.1.25.38) that renders `succeeded_ids`, `failed_rows`, `skipped_rows`, `filter` echo, and `duration_ms` as a first-class layout instead of raw JSON — per-row copy affordances are wired for immediate triage.

Failed-request entries (added in `cycles-server-admin` v0.1.25.20) are included in results. In v0.1.25.28+ servers, their `tenant_id` is `__unauth__` (pre-auth failures) or `__admin__` (admin-plane ops); pre-.28 rows continue to show the historical `<unauthenticated>` literal. All three are queryable from the Audit filter dropdown. Tiered retention — authenticated entries live 400 days by default, unauthenticated entries 30 days.

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
