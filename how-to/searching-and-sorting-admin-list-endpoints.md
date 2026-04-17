---
title: "Searching and Sorting Admin List Endpoints"
description: "Use search, sort_by, and sort_dir on Cycles admin list endpoints — tenants, budgets, API keys, webhooks, reservations, and audit logs — with correct cursor handling."
---

# Searching and Sorting Admin List Endpoints

The admin and runtime planes expose six list endpoints. As of `cycles-server-admin` v0.1.25.22 they all share a consistent query-parameter vocabulary for filtering, searching, sorting, and paginating. This page is the practical reference for using them from curl, scripts, and operator tools.

The endpoints:

| Endpoint | Plane | Added / enhanced |
|----------|-------|------------------|
| `GET /v1/admin/tenants` | Admin | search + sort v0.1.25.24 |
| `GET /v1/admin/budgets` | Admin | filters v0.1.25.22, sort v0.1.25.24 |
| `GET /v1/admin/api-keys` | Admin | cross-tenant v0.1.25.22 |
| `GET /v1/admin/webhooks` | Admin | search + sort v0.1.25.24 |
| `GET /v1/admin/audit/logs` | Admin | unauthenticated capture v0.1.25.20 |
| `GET /v1/reservations` | Runtime | sort v0.1.25.12 |

Older servers that predate these parameters simply ignore them — no 400 errors, no behavioural break. This is the **additive-parameter guarantee**: the admin spec treats new query parameters as purely additive, so clients can opt in when a cluster upgrades.

## Parameter vocabulary

### `search` (v0.1.25.25+)

A case-insensitive substring match over the endpoint's human-facing name fields. Maximum 128 characters. Longer strings return `400 INVALID_REQUEST`.

| Endpoint | Fields matched by `search` |
|----------|---------------------------|
| `/v1/admin/tenants` | `tenant_id`, `name` |
| `/v1/admin/budgets` | `scope`, `description` |
| `/v1/admin/api-keys` | `key_id`, `name`, `description` |
| `/v1/admin/webhooks` | `url`, `description` |

`search` is applied after other filters (`status`, `plan`, etc.) and is combined with them using AND semantics.

### `sort_by` and `sort_dir`

`sort_by` names the field to order on. `sort_dir` is `asc` or `desc`; defaults to `desc` when `sort_by` is provided and the parameter is otherwise ignored.

| Endpoint | Supported `sort_by` values |
|----------|---------------------------|
| `/v1/admin/tenants` | `tenant_id`, `name`, `status`, `created_at_ms` |
| `/v1/admin/budgets` | `scope`, `allocated`, `spent`, `remaining`, `utilization`, `created_at_ms` |
| `/v1/admin/api-keys` | `key_id`, `name`, `tenant_id`, `created_at_ms`, `last_used_at_ms`, `expires_at_ms` |
| `/v1/admin/webhooks` | `subscription_id`, `url`, `consecutive_failures`, `created_at_ms` |
| `/v1/reservations` | `reservation_id`, `tenant`, `scope_path`, `status`, `reserved`, `created_at_ms`, `expires_at_ms` |

Unknown `sort_by` or `sort_dir` values return `400 INVALID_REQUEST`. The reservation endpoint sorts the integer `amount` within the `reserved` key (well-defined under v0's single-unit-per-reservation invariant); `scope_path` sorts the canonical scope string lexicographically.

::: warning Default order changed in v0.1.25.24
The admin list endpoints `/v1/admin/budgets` and `/v1/admin/webhooks` changed their default sort from "Redis SCAN order" to `created_at_ms desc` in v0.1.25.24. If you had scripts that relied on the implicit ordering, pass `sort_by` explicitly. `/v1/admin/tenants`, `/v1/admin/api-keys`, and `/v1/reservations` retained SCAN order as default — pass `sort_by` if you need deterministic ordering on those too.
:::

### `cursor`, `limit`, `has_more`, `next_cursor`

Pagination is cursor-based:

- `limit` — maximum results per page. Endpoint-specific cap (typically 50 default, 200 max). Values outside the range return `400 INVALID_REQUEST`.
- `cursor` — opaque string from a previous response's `next_cursor`. Do not construct or modify it.
- `has_more` — boolean in the response. `true` means there is at least one more page.
- `next_cursor` — the value to pass as `cursor` on the next call. Absent when `has_more` is `false`.

### Cursor binding

When `sort_by` or filters are provided, the returned cursor is bound to the `(sort_by, sort_dir, filters)` tuple. Reusing a cursor under a different sort key, direction, or filter set returns `400 INVALID_REQUEST` with `error_code = CURSOR_INVALIDATED`.

**Reset the cursor whenever you change the sort key, sort direction, or any filter.** The client's job is to either preserve those parameters across all pages of a traversal or start over from page one.

### Cross-tenant listing (admin only)

Omitting the `tenant_id` query parameter on `/v1/admin/api-keys`, `/v1/admin/webhooks`, `/v1/admin/budgets`, and `/v1/admin/audit/logs` returns rows across all tenants (v0.1.25.22+). Authentication must be via `X-Admin-API-Key` for cross-tenant access — tenant-scoped `X-Cycles-API-Key` calls are limited to their own tenant.

When a cross-tenant listing paginates, the `next_cursor` encodes a composite `(tenant_id, key_id)` tuple so the traversal is stable even as tenants are added or removed mid-page.

## Recipes

### Oldest-expiring active reservations

Incident response — find reservations about to expire that are holding budget:

```bash
curl -G "http://localhost:7878/v1/reservations" \
  -H "X-Cycles-API-Key: $TENANT_API_KEY" \
  --data-urlencode "status=ACTIVE" \
  --data-urlencode "sort_by=expires_at_ms" \
  --data-urlencode "sort_dir=asc" \
  --data-urlencode "limit=50" | jq .
```

### Most-utilized budgets

Capacity review — find the budgets closest to exhaustion:

```bash
curl -G "http://localhost:7979/v1/admin/budgets" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  --data-urlencode "sort_by=utilization" \
  --data-urlencode "sort_dir=desc" \
  --data-urlencode "limit=25" | jq .
```

### Over-limit budgets with debt

Debt review — find scopes currently in overdraft:

```bash
curl -G "http://localhost:7979/v1/admin/budgets" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  --data-urlencode "over_limit=true" \
  --data-urlencode "has_debt=true" \
  --data-urlencode "sort_by=spent" \
  --data-urlencode "sort_dir=desc" | jq .
```

`over_limit`, `has_debt`, and `utilization_min` / `utilization_max` are budget-specific filters added in v0.1.25.22.

### Webhooks about to auto-disable

Health check — find subscriptions approaching the `disable_after_failures` threshold:

```bash
curl -G "http://localhost:7979/v1/admin/webhooks" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  --data-urlencode "sort_by=consecutive_failures" \
  --data-urlencode "sort_dir=desc" \
  --data-urlencode "limit=10" | jq .
```

### Search across tenants for a key

Audit — find every API key whose name contains "integration":

```bash
curl -G "http://localhost:7979/v1/admin/api-keys" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  --data-urlencode "search=integration" \
  --data-urlencode "sort_by=last_used_at_ms" \
  --data-urlencode "sort_dir=desc" | jq .
```

## Hydration cap on sorted reservation listings

On `/v1/reservations`, the sorted path caps the pre-sort working set at `SORTED_HYDRATE_CAP = 2000` rows per page (v0.1.25.13+). If your filter matches more than 2000 rows, the server logs a WARN and fills the page from the capped slice — the sort is only approximately global.

To see past the cap, narrow the filter: add `status`, `idempotency_key`, or a subject field (`workspace`, `app`, `workflow`, `agent`, `toolset`). The admin list endpoints do not apply an equivalent cap — they sort the full filtered set.

## Error reference

| `error_code` | Meaning |
|--------------|---------|
| `INVALID_REQUEST` | Unknown `sort_by`, unknown `sort_dir`, out-of-range `limit`, or `search` over 128 chars |
| `CURSOR_INVALIDATED` | Cursor reused under different sort key, direction, or filters |
| `FORBIDDEN` | Tenant-scoped key attempted a cross-tenant listing |
| `UNAUTHORIZED` | Invalid API key |

## Next steps

- [Admin API reference](/admin-api/) — full OpenAPI for each endpoint
- [Reservation Recovery and Listing](/protocol/reservation-recovery-and-listing-in-cycles) — reservation-specific sort and recovery patterns
- [Using Bulk Actions](/how-to/using-bulk-actions-for-tenants-and-webhooks) — bulk actions take the same filter shape as the list endpoints
- [API Key Management](/how-to/api-key-management-in-cycles) — cross-tenant key listing in practice
