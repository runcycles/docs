---
title: "Using Bulk Actions for Tenants and Webhooks"
description: "Suspend, reactivate, pause, resume, or delete tenants and webhooks in bulk against the Cycles admin API, with idempotency, 500-row safety gates, and per-row outcome buckets."
---

# Using Bulk Actions for Tenants and Webhooks

Bulk actions let a single admin call suspend hundreds of tenants, pause a fleet of noisy webhooks, or reactivate a batch after an incident is resolved. They ship in `cycles-server-admin` v0.1.25.26 against governance spec v0.1.25.21, and surface in the [Cycles Admin Dashboard](/quickstart/deploying-the-cycles-dashboard) as filter-then-bulk lanes on the Tenants and Webhooks pages.

The endpoints:

| Endpoint | Supported actions |
|----------|-------------------|
| `POST /v1/admin/tenants/bulk-action` | `SUSPEND`, `REACTIVATE`, `CLOSE` |
| `POST /v1/admin/webhooks/bulk-action` | `PAUSE`, `RESUME`, `DELETE` |

Both accept the same request shape and return the same response envelope.

## Request shape

Bulk actions operate on a filter expression, not an explicit ID list. You describe the target population with the same filters the list endpoints accept, then the server matches and applies the action atomically per row.

```bash
curl -X POST http://localhost:7979/v1/admin/tenants/bulk-action \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "SUSPEND",
    "idempotency_key": "ops-2026-04-17-freeze-abusers",
    "expected_count": 42,
    "filter": {
      "status": "ACTIVE",
      "search": "trial-"
    }
  }'
```

### Required fields

- **`action`** — one of the action values supported by the endpoint (see table above). Unknown values return `400 INVALID_REQUEST`.
- **`idempotency_key`** — stable, unique string. Replays within 15 minutes return the original response without re-executing. Required on every bulk call — there is no "best-effort" mode.
- **`filter`** — an object with the same filter keys the corresponding list endpoint supports. Tenant filters: `status`, `parent_tenant_id`, `observe_mode`, `search`. Webhook filters: `tenant_id`, `status`, `event_type`, `search`. An empty filter is rejected — the server refuses to act on "every tenant" or "every webhook" without at least one constraint. Unknown filter keys return `400 INVALID_REQUEST` (strict `additionalProperties: false`).

### Optional fields

- **`expected_count`** — safety gate. If the server resolves the filter to a different number of rows, the call fails with `409 COUNT_MISMATCH` and **no rows are touched**. Use this to catch drift between when you previewed the list and when you executed the bulk action.

## Response envelope

```json
{
  "action": "SUSPEND",
  "idempotency_key": "ops-2026-04-17-freeze-abusers",
  "total_matched": 42,
  "succeeded": [
    { "id": "tenant-abc" },
    { "id": "tenant-def" }
  ],
  "failed": [
    {
      "id": "tenant-ghi",
      "code": "INVALID_TRANSITION",
      "message": "cannot SUSPEND from CLOSED"
    }
  ],
  "skipped": [
    {
      "id": "tenant-jkl",
      "code": "ALREADY_IN_TARGET_STATE"
    }
  ]
}
```

Every row ends in exactly one of the three buckets:

- **`succeeded`** — the row transitioned to the target state.
- **`failed`** — the row matched the filter but the action could not apply (typically `INVALID_TRANSITION` — e.g., resuming a `DISABLED` webhook, suspending a `CLOSED` tenant).
- **`skipped`** — the row matched the filter but was already in the target state (e.g., a tenant already suspended when `action=SUSPEND`, a webhook already paused). Not an error — the bulk action is idempotent per row.

`total_matched` equals `succeeded.length + failed.length + skipped.length`. If you supplied `expected_count`, they are guaranteed equal — otherwise the call returned `409 COUNT_MISMATCH` before any row executed.

## Safety gates

### 500-row ceiling — `LIMIT_EXCEEDED`

Bulk actions cap at **500 matched rows per call**. If your filter resolves to more than 500 rows, the server returns HTTP 400 with `error_code: LIMIT_EXCEEDED`:

```json
{
  "error_code": "LIMIT_EXCEEDED",
  "message": "filter matches more than 500 tenants; narrow the filter and retry",
  "details": { "total_matched": 501 }
}
```

`total_matched` in the error details is a sentinel — the server fetches up to `cap + 1` rows and reports "501" to signal "over the limit" without hydrating the full set. No rows are touched. To proceed, narrow the filter (add `status`, `search`, or a scoping field) and run multiple calls with distinct idempotency keys.

### Count mismatch — `COUNT_MISMATCH`

If `expected_count` is provided and disagrees with the resolved match, the call returns HTTP 409:

```json
{
  "error_code": "COUNT_MISMATCH",
  "message": "expected_count 42 differs from server-counted matches 40",
  "details": { "total_matched": 40 }
}
```

Again, no rows are touched. Re-preview the list and retry with a corrected `expected_count`, or drop the gate if you accept the drift.

### Replay semantics

Bulk calls are idempotent on `idempotency_key`. A replay within the 15-minute window returns the original response verbatim — the server does not re-evaluate the filter on replay. After the window expires, the same key re-executes from scratch against live data.

## Audit trail

One audit entry is written per bulk invocation (not per row). Its metadata captures the full outcome:

```json
{
  "operation": "bulkActionTenants",
  "resource_type": "tenant",
  "resource_id": "bulk-action",
  "status": 200,
  "metadata": {
    "action": "SUSPEND",
    "total_matched": 42,
    "succeeded": 40,
    "failed": 1,
    "skipped": 1,
    "idempotency_key": "ops-2026-04-17-freeze-abusers"
  }
}
```

Query bulk-action entries:

```bash
curl -G "http://localhost:7979/v1/admin/audit/logs" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  --data-urlencode "operation=bulkActionTenants" | jq .
```

Per-row outcomes live in the response envelope, not the audit log — capture the response body to your runbook if you need a permanent record of which specific rows landed in each bucket.

## Recommended pattern

1. **Preview.** Call the matching list endpoint (`GET /v1/admin/tenants` or `GET /v1/admin/webhooks`) with the same filter. Note `total_count` if the server returns it, or paginate to count manually.
2. **Propose.** Compose the bulk request body. Set `idempotency_key` to something traceable back to an incident or runbook (`ops-INC-842-suspend-abusers`). Set `expected_count` to the preview count.
3. **Execute.** POST the bulk request. Capture the full response envelope to your runbook record.
4. **Reconcile.** Inspect `failed[]`. Investigate each `error_code` — bulk actions do not "retry until green"; follow-up fixes are manual.
5. **Audit.** Query audit logs by `bulk_idempotency_key` to confirm every row was logged and to export for compliance review.

::: tip Dashboard equivalent
The Tenants and Webhooks pages in the [dashboard](/quickstart/deploying-the-cycles-dashboard) expose the same flow as a visual lane: filter the list, preview the count, click **Bulk action**, confirm with a blast-radius summary, and see per-row results in a side panel. The dashboard sets `expected_count` automatically from the current filter count.
:::

## Error reference

| HTTP | `error_code` | Meaning |
|------|--------------|---------|
| 400 | `LIMIT_EXCEEDED` | Filter matched more than 500 rows. Narrow the filter. |
| 400 | `INVALID_REQUEST` | Unknown `action`, empty `filter`, unknown filter key (strict `additionalProperties: false`), or missing `idempotency_key`. |
| 401 | `UNAUTHORIZED` | Invalid or missing `X-Admin-API-Key`. |
| 409 | `COUNT_MISMATCH` | `expected_count` disagreed with resolved match count. Re-preview. |
| Per-row `code` | `INVALID_TRANSITION`, `ALREADY_IN_TARGET_STATE`, `ALREADY_DELETED` | Bucketed into `failed[]` or `skipped[]` — HTTP status is still 200. |

## Next steps

- [Tenant Creation and Management](/how-to/tenant-creation-and-management-in-cycles) — the single-entity endpoints bulk actions are built on
- [Managing Webhooks](/how-to/managing-webhooks) — per-subscription operations
- [Admin API reference](/admin-api/) — full OpenAPI
- [Searching and Sorting Admin List Endpoints](/how-to/searching-and-sorting-admin-list-endpoints) — how to narrow the filter before a bulk call
