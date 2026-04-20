---
title: "Changelog"
description: "Release history and version notes for the Cycles Protocol, server, admin API, Python client, TypeScript client, and Spring Boot starter."
---

# Changelog

Release history for the Cycles Protocol and reference implementations.

## v0.1.25.x — patch releases (April 2026)

Since the initial v0.1.25 Events & Webhooks release, each component has shipped a stream of patch releases. Wire format is stable within `0.1.x`; every change below is **additive** unless explicitly marked breaking.

**Current component versions:**

| Component | Version | Release date |
|---|---|---|
| Protocol spec (runtime) | v0.1.25 (revision 2026-04-18) | 2026-04-18 |
| Governance spec (admin) | v0.1.25.28 | 2026-04-18 |
| `cycles-server` (runtime) | v0.1.25.15 | 2026-04-18 |
| `cycles-server-admin` | v0.1.25.32 | 2026-04-18 |
| `cycles-server-events` | v0.1.25.9 | 2026-04-18 |
| `cycles-dashboard` | v0.1.25.42 | 2026-04-19 |

### Runtime server (`cycles-server`)

- **v0.1.25.15** (2026-04-18) — **Runtime audit-log retention TTL.** New `audit.retention.days` config (default `400`, env `AUDIT_RETENTION_DAYS`) applies a TTL to `audit:log:{id}` keys — previously these persisted indefinitely until Redis eviction, silently escaping the authenticated-tier retention the admin plane applies. New `audit.sweep.cron` (default `0 0 3 * * *`, env `AUDIT_SWEEP_CRON`) prunes stale ZSET pointers. Set to `0` for indefinite retention.
- **v0.1.25.14** (2026-04-18) — **W3C Trace Context correlation.** Every response now carries `X-Cycles-Trace-Id` (32-hex lowercase). Inbound precedence: `traceparent` → `X-Cycles-Trace-Id` → server-generate. New optional `trace_id` field on `ErrorResponse`, `Event`, `WebhookDelivery`, `AuditLogEntry`. `WebhookDelivery` also gains `trace_flags` and `traceparent_inbound_valid`. Malformed inbound correlation headers are tolerated (fall through to next rule) — server never rejects on a bad header. SLF4J MDC carries `traceId` alongside `requestId`. `ReservationExpiryService` mints a fresh trace_id per sweep batch so sibling `reservation.expired` events correlate. See [Correlation and Tracing](/protocol/correlation-and-tracing-in-cycles).
- **v0.1.25.13** (2026-04-16) — `SORTED_HYDRATE_CAP = 2000` guard on `GET /v1/reservations` sorted path. Capped WARN log; cursor page still fills from the capped slice. Narrow filters to see past the cap.
- **v0.1.25.12** (2026-04-16) — `GET /v1/reservations` accepts `sort_by` and `sort_dir` query params. Valid keys: `reservation_id`, `tenant`, `scope_path`, `status`, `reserved`, `created_at_ms`, `expires_at_ms`. Default `desc`. Opaque sorted cursor binds to the `(sort_by, sort_dir, filters)` tuple; reusing under a different tuple returns HTTP 400.
- **v0.1.25.10** (2026-04-14) — Seven domain-level Prometheus counters (`cycles_reservations_reserve_total`, `..._commit_total`, `..._release_total`, `..._extend_total`, `..._expired_total`, `cycles_events_total`, `cycles_overdraft_incurred_total`). New flag `cycles.metrics.tenant-tag.enabled` (default `true`) controls per-tenant cardinality. **Fixed** — `reservation.expired` webhook now actually fires (was no-op since v0.1.25.3 due to wrong Redis key prefix).
- **v0.1.25.8** (2026-04-13) — **Admin-on-behalf-of release.** `POST /v1/reservations/{id}/release` accepts either `X-Cycles-API-Key` (tenant) or `X-Admin-API-Key` (admin). Admin-driven releases write audit entries with `actor_type=admin_on_behalf_of`. New property `admin.api-key` for admin key configuration.
- **v0.1.25.6** (2026-04-10) — Reserve / commit / decide now distinguish `UNIT_MISMATCH` from `BUDGET_NOT_FOUND` when a scope has a budget under a different unit.
- **v0.1.25.5** (2026-04-08) — Fixed duplicate emission of `budget.approaching_limit`, `budget.at_limit`, `budget.over_limit`, `debt.incurred` on multi-scope operations.
- **v0.1.25.4** (2026-04-07) — Event payloads now include all fields webhook consumers need for correct dedup/ordering (`reservation_id`, `scope`, `unit`, `actor`, timestamps).
- **v0.1.25.3** (2026-04-03) — Runtime event emission wired: `reservation.reserved`, `reservation.committed`, `reservation.released`, `reservation.expired`, `reservation.extended`, `event.applied`, plus budget-state transitions (`budget.approaching_limit`, `budget.at_limit`, `budget.over_limit`).
- **v0.1.25.2** (2026-04-02) — `getBalances` and `listReservations` lowercase the stored scope before segment matching.
- **v0.1.25.1** (2026-04-01) — Initial runtime event emission. `EventEmitterService` with async, non-blocking emission on a dedicated daemon thread pool. TTL retention — `EVENT_TTL_DAYS` (90) / `DELIVERY_TTL_DAYS` (14). Pipelined event save + subscription lookup for near-zero overhead on non-event paths. **Fixed** — `reservation.commit_overage` now emits only when `actual > estimate` (was firing on every commit).

### Admin server (`cycles-server-admin`)

- **v0.1.25.32** (2026-04-18) — **Lenient deserialization on cross-plane read schemas.** `Event` and `WebhookDelivery` now set `@JsonIgnoreProperties(ignoreUnknown = true)` at the class level. Runtime is the authoritative writer of these records; admin only reads them. Previously admin POJOs were strict, so runtime shipping an additive field in a patch would break `listEvents` / `listWebhookDeliveries` until admin lockstep-updated. Now runtime can ship additive fields without forcing an admin release. Internal only — no wire contract change.
- **v0.1.25.31** (2026-04-18) — **W3C Trace Context cross-surface correlation** — server-side implementation of spec v0.1.25.28. New optional `trace_id` (32-hex) on `ErrorResponse`, `AuditLogEntry`, `Event` response bodies. New `X-Cycles-Trace-Id` response header on every response (2xx, 4xx, 5xx). Inbound precedence: `traceparent` → `X-Cycles-Trace-Id` → server-generate. New exact-match query params on `GET /v1/admin/audit/logs` and `GET /v1/admin/events`: `trace_id`, `request_id`. `WebhookDelivery` persists `trace_id` + `trace_flags` + `traceparent_inbound_valid` so the events sidecar can construct outbound `traceparent` preserving inbound sampling. Historical entries without `trace_id` continue to round-trip through strict Jackson. See [Correlation and Tracing](/protocol/correlation-and-tracing-in-cycles).
- **v0.1.25.30** (2026-04-18) — **Bulk-action audit metadata enrichment.** Single `AuditLogEntry` per bulk-action invocation (`bulkActionTenants`, `bulkActionWebhooks`, `bulkActionBudgets`) now carries the full per-row outcome arrays plus filter echo plus wall-clock `duration_ms`. New keys: `succeeded_ids`, `failed_rows`, `skipped_rows`, `filter`. Worst-case audit row size ~40KB at 500-row cap. Fully additive — existing metadata keys unchanged; spec `AuditLogEntry.metadata` is already typed `object` with `additionalProperties: true` so no info.version bump. Triage now works from audit alone without re-running the op.
- **v0.1.25.29** (2026-04-18) — **Budget bulk-action endpoint.** `POST /v1/admin/budgets/bulk-action` — AdminKeyAuth only. Five actions: `CREDIT`, `DEBIT`, `RESET`, `REPAY_DEBT`, `RESET_SPENT`. `filter.tenant_id` REQUIRED (cross-tenant budget bulk out of scope — 400 if blank). `amount` required for all 5 actions; `spent` honored only on `RESET_SPENT`. Filter mirrors `listBudgets` — `scope_prefix`, `unit`, `status`, `over_limit`, `has_debt`, `utilization_min/max`, `search`. Same 500-row cap, `expected_count`, idempotency-key safety gates as tenants/webhooks bulk. Per-row idempotency derived from `{bulkKey}:{scope}:{unit}` so retrying the failed subset cannot double-apply. Aligned with governance-admin spec v0.1.25.26.
- **v0.1.25.28** (2026-04-17) — **Audit `tenant_id` sentinel split.** The previous single `<unauthenticated>` sentinel is replaced by two: `__admin__` (admin-plane operations not scoped to a tenant, authenticated-tier retention, never sampled) and `__unauth__` (pre-auth failures, unauthenticated-tier retention, subject to sampling). URL-safe underscored form — no percent-encoding needed. **Migration:** dashboards and auditor queries using `?tenant_id=<unauthenticated>` keep matching historical rows but stop matching fresh writes; migrate to `__unauth__` or `__admin__`. Historical rows age out on the correct schedule. Aligned with governance-admin spec v0.1.25.25.
- **v0.1.25.27** (2026-04-17) — **Audit log filter DSL upgrade** on `GET /v1/admin/audit/logs`. New params: `error_code` (array, maxItems 25, IN-list, NULL-excluding), `error_code_exclude` (NOT-IN-list, NULL-passing, combinable with `error_code`), `status_min` / `status_max` (integer range, mutex with exact `status`). `operation` and `resource_type` promoted from scalar to array (comma-separated; single scalar still parses). `search` match set extended to include `error_code` + `operation` in addition to `resource_id` / `log_id`. Aligned with governance-admin spec v0.1.25.24.
- **v0.1.25.26** (2026-04-17) — **Bulk-action endpoints.** `POST /v1/admin/tenants/bulk-action` (SUSPEND | REACTIVATE | CLOSE) and `POST /v1/admin/webhooks/bulk-action` (PAUSE | RESUME | DELETE). Filter-only body (no id arrays), 500-row hard cap (`LIMIT_EXCEEDED` on overflow), optional `expected_count` → 409 `COUNT_MISMATCH` if the list changed between preview and submit. Response envelope splits `succeeded[]` / `failed[]` / `skipped[]`. `idempotency_key` required; 15-minute replay window served from the new `IdempotencyStore` primitive.
- **v0.1.25.25** (2026-04-17) — **Free-text `search` query param** on six admin list endpoints (`/v1/admin/tenants`, `.../api-keys`, `.../budgets`, `.../webhooks/subscriptions`, `.../events`, `.../audit/logs`). Case-insensitive substring match, ≤128 characters, AND-combined with every other filter. Pre-.25 servers ignore the unknown param (additive guarantee).
- **v0.1.25.24** (2026-04-16) — `sort_by` + `sort_dir` on the six list endpoints. Per-endpoint whitelists; unknown keys → 400 `INVALID_REQUEST`. **Default ordering changes for `listBudgets` (`utilization DESC`) and `listWebhookSubscriptions` (`consecutive_failures DESC`)** — callers relying on the prior set-iteration order must pass `sort_by=created_at&sort_dir=desc` explicitly. Total-order cursor with primary-key tie-breaker; `SORTED_HYDRATE_CAP = 2000` on time-indexed endpoints.
- **v0.1.25.23** (2026-04-16) — `BudgetLedger.tenant_id` exposed on the wire (`@JsonInclude(NON_NULL)`). Cross-tenant list responses now carry per-row tenant attribution without scope-string parsing.
- **v0.1.25.22** (2026-04-16) — **Cross-tenant list** for `GET /v1/admin/api-keys` and `GET /v1/admin/budgets` under `AdminKeyAuth`. Omit `tenant_id` to walk every tenant; composite cursor `{tenantId}|{keyId}` / `{tenantId}|{ledgerId}`. Four new budget filters: `over_limit`, `has_debt`, `utilization_min`, `utilization_max`. Deleted-cursor-tenant handling skips forward instead of stalling.
- **v0.1.25.20** (2026-04-16) — **Audit log now captures failed requests** (401/403/400/404/409/500) with `error_code`, sanitized `metadata.error_message`, `metadata.method`, `metadata.path`. New sentinel tenant `<unauthenticated>` for pre-auth failures. **Tiered TTL** with SOC2-compliant defaults: `audit.retention.authenticated.days=400`, `audit.retention.unauthenticated.days=30` (both `0` = indefinite). Optional `audit.sample.unauthenticated` for DDoS exposure. Daily index sweep `audit.sweep.cron` (default `0 0 3 * * *`). New counter `cycles_admin_audit_writes_total{path_class, outcome}` — **alert on `outcome=error` nonzero**. **Semantic change**: dashboards that assumed "audit entry exists ⇒ operation succeeded" must now check `status` / `error_code`.
- **v0.1.25.19** (2026-04-16) — `GET /v1/auth/introspect` accepts both `AdminKeyAuth` and `ApiKeyAuth`. Tenant keys return `auth_type=tenant` shape with `tenant_id`, optional `scope_filter`, and a per-capability boolean table. Admin-plane capabilities forced to `false` under tenant auth.
- **v0.1.25.18** (2026-04-15) — **`RESET_SPENT` funding operation** on `POST /v1/admin/budgets/fund`. Clears (or overrides) `spent` for billing-period rollover, distinct from `RESET` which preserves `spent`. Optional `spent >= 0` override for migration / proration / credit-back. New event `budget.reset_spent`. `BudgetFundingResponse` gains nullable `previous_spent` + `new_spent`.
- **v0.1.25.17** (2026-04-14) — Fixed cjson empty-array round-trip bug that dropped records from `GET /v1/admin/api-keys` (and defensively on `Policy.caps.tool_allowlist` / `tool_denylist` / `Tenant.metadata`). `revokeApiKey` on already-revoked key now returns 409 `KEY_REVOKED` (was 200).
- **v0.1.25.16** (2026-04-13) — Dual-auth on six tenant-scoped webhook endpoints (`GET/PATCH/DELETE /v1/webhooks/{id}`, `POST /v1/webhooks/{id}/test`, `GET /v1/webhooks`, `GET /v1/webhooks/{id}/deliveries`). Admin operators can pause / inspect / force-delete tenant webhooks during incident response. `POST /v1/webhooks` (create) remains tenant-only.
- **v0.1.25.15** (2026-04-13) — `ScopeValidator` enforces canonical scope grammar (`tenant:<id>` first; canonical kind order `tenant → workspace → app → workflow → agent → toolset`; wildcards only terminal in policy patterns).
- **v0.1.25.14** (2026-04-13) — Dual-auth on `POST /v1/admin/budgets`, `POST /v1/admin/policies`, `PATCH /v1/admin/policies/{id}`. Admin auth requires `tenant_id` in the body; audit-log records `actor_type=admin_on_behalf_of`.
- **v0.1.25.13** (2026-04-13) — Fixed CORS `allowedMethods` missing `PUT`, which blocked browser dashboards from calling `PUT /v1/admin/config/webhook-security`.
- **v0.1.25.12** (2026-04-12) — Targeted 404/409 error responses on admin endpoints; documented 400 across every admin operation; spec-compliance hardening pass.
- **v0.1.25.11** (2026-04-12) — Contract testing default ON. `*ControllerTest` validates every 2xx/4xx/5xx JSON body against the pinned spec at build time. Offline builds: `CONTRACT_VALIDATION_ENABLED=false`.
- **v0.1.25.10** (2026-04-12) — Typed `Permission` enum + `Capabilities` class; spec-compliance hardening.

### Events service (`cycles-server-events`)

- **v0.1.25.9** (2026-04-18) — **Management port split.** `health`, `info`, and `prometheus` actuator endpoints moved from public API port `7980` to a dedicated management port (default `9980`, env `MANAGEMENT_PORT`). **Migration:** Prometheus scrape configs must update target port from `:7980` → `:9980`; kubelet probes and Docker `HEALTHCHECK` same. Published Docker image `HEALTHCHECK` already updated. No wire-format change for dispatch. Expose `7980` publicly; keep `9980` internal-only.
- **v0.1.25.8** (2026-04-18) — **Cross-surface correlation on `WebhookDelivery`.** Three new OPTIONAL fields: `trace_id` (captured at dispatch time from originating event), `trace_flags` (W3C trace-flags byte for outbound `traceparent`), `traceparent_inbound_valid` (whether upstream sent valid W3C traceparent). Aligns with governance-admin spec v0.1.25.28. Dispatcher honors `trace_flags` when `traceparent_inbound_valid=true`, otherwise defaults to `01` (sampled). Proactive `trace_id` stamping on `Delivery` as rolling-upgrade safety net for pre-.31 admin servers.
- **v0.1.25.7** (2026-04-18) — **trace_id and W3C Trace Context headers on every outbound webhook delivery.** New outbound headers: `X-Cycles-Trace-Id` (always present), `traceparent: 00-<trace_id>-<16-hex-span>-<flags>` (fresh span-id per delivery, never reused from inbound), `X-Request-Id` (when event carries `request_id`). New `Event.trace_id` field, optional. Non-fatal `trace_id_shape` validation rule — malformed `trace_id` increments `cycles_webhook_events_payload_invalid_total{rule="trace_id_shape"}` and the dispatcher falls back to minting a fresh id so outbound header stays well-formed. Aligns with governance-admin spec v0.1.25.27.
- **v0.1.25.6** (2026-04-16) — `BUDGET_RESET_SPENT` added to the `EventType` vocabulary. **Eight new Prometheus metrics** under `cycles_webhook_*`: `delivery_attempts_total`, `delivery_success_total`, `delivery_failed_total`, `delivery_retried_total`, `delivery_stale_total`, `subscription_auto_disabled_total`, `events_payload_invalid_total`, plus `cycles_webhook_delivery_latency_seconds` timer. `cycles.metrics.tenant-tag.enabled` flag mirrors the runtime. Non-fatal `EventPayloadValidator` on every ingested event (WARN + counter on violation; never drops).
- **v0.1.25.5** (2026-04-08) — **Force HTTP/1.1 on outbound webhook deliveries.** Fixes silent body-drop against HTTP/2 reverse proxies that upgrade to h2c.
- **v0.1.25.4** (2026-04-07) — `SubscriptionRepository.updateDeliveryState` switched to partial merge (previously overwrote admin-side PATCH writes under contention).
- **v0.1.25.3** (2026-04-03) — `micrometer-registry-prometheus` dependency added (`/actuator/prometheus` was 404 without it). Typed `DeliveryStatus` / `WebhookStatus` enums.
- **v0.1.25.1** (2026-04-01) — Initial release. Redis-driven dispatcher consuming `dispatch:pending` via BRPOP. HMAC-SHA256 signing, exponential-backoff retry, auto-disable after consecutive failures. AES-256-GCM encryption of signing secrets at rest (`WEBHOOK_SECRET_ENCRYPTION_KEY`, 32-byte key). TTL retention (90d events / 14d deliveries). Configurable `dispatch.http.connect-timeout-seconds` + `dispatch.http.timeout-seconds`.

### Dashboard (`cycles-dashboard`)

- **v0.1.25.42** (2026-04-19) — Security: base-image bumps (`nginx:1.27-alpine` → `nginx:1.29-alpine`, `node:20.19` → `20.20`) resolving 57 Alpine-layer CVEs flagged by Trivy.
- **v0.1.25.41** (2026-04-19) — Dependabot-bundled dependency bumps including `vue-router 4.6.4 → 5.0.4` (major, no breaking changes for this app). TypeScript typecheck clean; 742 tests green.
- **v0.1.25.40** (2026-04-19) — **Shared icon library** at `src/components/icons/` — 24 reusable SVG components (CopyJsonIcon, CopyIcon, KebabIcon, etc.). Stroke-width unified to `1.5`; four icons upgraded to Heroicons v2 geometry. Copy JSON moved from dedicated rows/columns to overlay icons and kebab menus — WebhookDetailView delivery column shrinks 88px → 40px; panels lose ~35–50px footer rows.
- **v0.1.25.39** (2026-04-18) — **Cross-surface trace / request correlation chip** on Events, Audit, and WebhookDeliveries rows. Click `trace_id` on Audit → EventsView filtered to the same trace; click `trace_id` on Events → AuditView filtered to originating entry. Requires `cycles-server-admin` v0.1.25.31+. **Webhook delivery history fixes:** interface field mapping (`http_status` → `response_status`, `delivered_at` → `completed_at`), StatusBadge delivery-status colors, Error column on FAILED rows, CSV export enrichment.
- **v0.1.25.38** (2026-04-18) — **Structured bulk-action audit detail** in AuditView expanded row. Renders `succeeded_ids` / `failed_rows` / `skipped_rows` / `filter` echo / `duration_ms` as a first-class layout (not raw JSON). Requires `cycles-server-admin` v0.1.25.30+.
- **v0.1.25.37** (2026-04-18) — **Per-row Copy JSON** affordance across EventsView, AuditView, EventTimeline, WebhookDeliveries. Row-select bulk failures open `BulkActionResultDialog`. EventTimeline `correlation_id` click → EventsView filtered.
- **v0.1.25.36** (2026-04-18) — **BudgetsView row-select + bulk Freeze / Unfreeze.** Row-select checkboxes + floating bulk toolbar mirror the TenantsView pattern.
- **v0.1.25.35** (2026-04-18) — **Budget bulk-action UI.** Filter-apply toolbar on BudgetsView for `CREDIT`, `DEBIT`, `RESET`, `RESET_SPENT`, `REPAY_DEBT`. Requires `cycles-server-admin` v0.1.25.29+.
- **v0.1.25.34** (2026-04-18) — **`BulkActionResultDialog` component** — per-row outcome triage for bulk operations. New `errorCodeMessages.ts` utility — single source of truth for operator-facing error code prose.
- **v0.1.25.33** (2026-04-18) — **AuditView filter DSL completeness** against governance-admin v0.1.25.24: `error_code_exclude`, `operation` IN-list, `resource_type` typeahead datalist, `status_min` / `status_max` range. Deep-link support via query params.
- **v0.1.25.28** (2026-04-17) — Bulk-action UI on TenantsView + WebhooksView (filter-apply path in addition to row-select). Image tag `ghcr.io/runcycles/cycles-dashboard:0.1.25.28`. Spec alignment bumped to v0.1.25.23. CI gate runs 6 new e2e bulk-action probes (empty filter → 400, invalid action → 400, zero-match → 200, idempotency replay, webhook mirror) against the published image on every release.
- **v0.1.25.27** — Free-text `search` wired into six admin list views (Tenants, Budgets, ApiKeys, Audit, Webhooks, Events). Debounced page-1 refetch honors cursor-tuple invalidation. Client-side fallback on pre-.25 servers. **RESET_SPENT funding** operation available from BudgetDetail → Fund (requires admin v0.1.25.18+).
- **v0.1.25.26** — V4 server-side sort across six admin views + `ReservationsView` (runtime plane). TenantsView "+N more" and inline child-links thread `?parent=<src>` so the back arrow returns to the source parent. Scale hardening: row virtualization via `@tanstack/vue-virtual` across seven list views; pagination + N+1 mitigation; cancel-button on long exports; dark-mode and a11y (WCAG AA) passes.
- **v0.1.25.22** — ApiKeysView + BudgetsView consume the cross-tenant `/v1/admin/api-keys` and `/v1/admin/budgets` endpoints. `BudgetLedger.tenant_id` rendered as a first-class column.
- New routes introduced across the window: `/api-keys` (first-class cross-tenant list), `/reservations` (runtime-plane force-release), `/tenants/:id` (detail with parent/children breadcrumb), `/webhooks/:id` (single subscription detail).
- Global command palette: `Cmd/Ctrl+K` or `/` opens a tenant search (3-page prefetch, 60s cache, substring filter, "Load more" for scale).

---

## v0.1.25 — April 2026 (Initial release)

**Pillar 4: Events & Webhooks (Observability Plane)**

New event-driven observability system spanning all three services.

**Protocol spec (non-breaking, guidance only):**
- Added WEBHOOK EVENT GUIDANCE section documenting 41 event types, payload schema, delivery protocol, and X-Cycles-Signature HMAC verification
- No new API endpoints — guidance is informational, not normative

**Admin server (20 new endpoints):**
- 12 admin webhook/event endpoints at `/v1/admin/webhooks` and `/v1/admin/events`
- 8 tenant self-service endpoints at `/v1/webhooks` and `/v1/events` (requires `webhooks:read/write`, `events:read`)
- `GET/PUT /v1/admin/config/webhook-security` — SSRF protection with blocked CIDR ranges
- 41 event types across 6 categories: budget (16), reservation (5), tenant (6), api_key (6), policy (3), system (5)
- Event emission wired into all existing controllers

**Runtime server (event emission):**
- `reservation.denied` on DENY decision (reserve and decide endpoints)
- `reservation.commit_overage` on commit with actual > estimated

**Events delivery service (`cycles-server-events`, port 7980):**
- Async webhook delivery via BRPOP from shared Redis dispatch queue
- HMAC-SHA256 payload signing (`X-Cycles-Signature: sha256=<hex>`)
- Exponential backoff retry, auto-disable after consecutive failures
- Stale delivery protection (>24h deliveries auto-fail on pickup)

**Security:**
- AES-256-GCM encryption for signing secrets at rest (`WEBHOOK_SECRET_ENCRYPTION_KEY` env var)
- Webhook URL SSRF protection: private IPs blocked by default, HTTPS required in production

**Data retention:**
- Event keys: 90-day Redis TTL (configurable via `EVENT_TTL_DAYS`)
- Delivery keys: 14-day Redis TTL (configurable via `DELIVERY_TTL_DAYS`)
- ZSET index cleanup: hourly via RetentionCleanupService

**Testing:** 530 tests across 3 services (events: 114, admin: 319, server: 97), all 95%+ coverage. Full-stack E2E test (23 assertions) verified across all services via Docker.

---

## v0.1.24 — March 2026

::: danger Migration required — default overage policy changed
The default `commit_overage_policy` changed from **`REJECT`** to **`ALLOW_IF_AVAILABLE`**. If you relied on `REJECT` as the implicit default, reservations and commits that previously failed will now succeed and may allow overspend. To preserve the previous behavior, explicitly set `overagePolicy = "REJECT"` on your decorators/annotations, or update tenant defaults via `PATCH /v1/admin/tenants/{id}` with `"default_commit_overage_policy": "REJECT"`.
:::

**Protocol (breaking):**
- Default overage policy changed from `REJECT` to `ALLOW_IF_AVAILABLE`
- `ALLOW_IF_AVAILABLE` commits now always succeed: when remaining budget can't cover the full overage delta, the charge is capped to estimate + available remaining and `is_over_limit` is set to block future reservations
- `is_over_limit` extended to also cover capped `ALLOW_IF_AVAILABLE` commits
- `CommitResponse.charged` may now be less than `actual` when overage is capped
- `EventCreateResponse` now includes optional `charged` field (present when `ALLOW_IF_AVAILABLE` caps the charge to remaining budget)
- Three new error codes: `BUDGET_FROZEN` (409), `BUDGET_CLOSED` (409), `MAX_EXTENSIONS_EXCEEDED` (409) — error code count increased from 12 to 15

**Server:**
- Updated commit Lua script with capped-delta logic for `ALLOW_IF_AVAILABLE`
- Updated default fallback in reservation and commit paths from `REJECT` to `ALLOW_IF_AVAILABLE`

**Admin Server:**
- Default tenant `default_commit_overage_policy` changed from `REJECT` to `ALLOW_IF_AVAILABLE`
- New endpoint: `PATCH /v1/admin/budgets?scope=&unit=` — update `overdraft_limit`, `commit_overage_policy`, and `metadata` on existing budgets with atomic `is_over_limit` recalculation
- Budget fund and patch endpoints now use query parameters (`?scope=...&unit=...`) instead of path variables for consistency with the balances API
- New endpoint: `PATCH /v1/admin/policies/{policy_id}` — update all mutable policy fields (name, description, priority, caps, overage policy, TTL override, rate limits, effective dates, status). Note: policy runtime enforcement is deferred to a future version; policies are stored but not yet evaluated by the protocol server
- Tenant update extended with `default_reservation_ttl_ms`, `max_reservation_ttl_ms`, and `max_reservation_extensions` — reservation TTL is now configurable per-tenant
- Budget metadata support on create and update

## v0.1.23 — March 2026

**Protocol:**
- Complete OpenAPI 3.1.0 specification
- 9 protocol endpoints: decide, reserve, list, get, commit, release, extend, balances, events
- 4 unit types: USD_MICROCENTS, TOKENS, CREDITS, RISK_POINTS
- 3 overage policies: REJECT, ALLOW_IF_AVAILABLE, ALLOW_WITH_OVERDRAFT
- Subject hierarchy: tenant, workspace, app, workflow, agent, toolset
- Dry-run mode for shadow evaluation
- Reservation TTL with grace period and extend
- Idempotent operations with per-endpoint scoping
- 12 error codes with structured error responses
- Caps and three-way decision model (ALLOW, ALLOW_WITH_CAPS, DENY)
- Debt and overdraft model

**Server:**
- Spring Boot 3.5 + Java 21 runtime
- Redis 7+ with Lua scripts for atomic operations
- Docker images on GHCR
- Health check endpoint (Spring Boot Actuator)
- Request ID generation and tracking

**Admin Server:**
- Tenant lifecycle management (ACTIVE, SUSPENDED, CLOSED)
- API key management with granular permissions
- Budget ledger CRUD with funding operations (CREDIT, DEBIT, RESET, REPAY_DEBT)
- Policy management with scope patterns
- Audit logging
- Cursor-based pagination

**Client SDKs:**
- Python: `runcycles` — decorator, programmatic, and async APIs
- TypeScript: `runcycles` — withCycles HOF, reserveForStream, programmatic APIs
- Java/Spring: `cycles-client-java-spring` — @Cycles annotation with SpEL expressions

**Integrations:**
- OpenAI, Anthropic, LangChain (Python)
- OpenAI, Anthropic, LangChain.js, Vercel AI SDK, AWS Bedrock, Google Gemini, Express (TypeScript)
- Spring AI (Java)
- OpenClaw agent framework (TypeScript)

---

## Version compatibility

| SDK / Component | Version | Compatible server |
|---|---|---|
| `runcycles` (Python) | 0.3.0 | v0.1.23+, v0.1.24+, v0.1.25+ |
| `runcycles` (TypeScript) | 0.2.0 | v0.1.23+, v0.1.24+, v0.1.25+ |
| `runcycles` (Rust) | 0.2.3 | v0.1.23+, v0.1.24+, v0.1.25+ |
| `cycles-client-java-spring` | 0.2.0 | v0.1.23+, v0.1.24+, v0.1.25+ |
| `@runcycles/mcp-server` | 0.2.2 | v0.1.23+, v0.1.24+, v0.1.25+ |
| `@runcycles/openclaw-budget-guard` | 0.8.2 | v0.1.23+, v0.1.24+, v0.1.25+ |
| Cycles Server (runtime) | v0.1.25.15 | Protocol v0.1.25 (revision 2026-04-18) |
| Cycles Admin Server | v0.1.25.32 | Governance spec v0.1.25.28 |
| Cycles Events Service | v0.1.25.9 | Shared Redis dispatch queue |
| Cycles Dashboard | v0.1.25.42 | Admin v0.1.25.31+ (correlation chip); v0.1.25.29+ (budget bulk); v0.1.25.18+ (RESET_SPENT) |

All current SDK versions are backward-compatible with server v0.1.23. New v0.1.24 features (budget patch, policy patch, capped `ALLOW_IF_AVAILABLE` commits) require server v0.1.24+. New v0.1.25 features (event emission, webhook delivery, events service, `policy_id` / `deny_detail` on `reservation.denied`) require server v0.1.25.

### Minimum versions for specific features

| Feature | Minimum component |
|---|---|
| W3C Trace Context (`trace_id` on responses + audit/events filter) | `cycles-server` v0.1.25.14, `cycles-server-admin` v0.1.25.31, `cycles-server-events` v0.1.25.7, `cycles-dashboard` v0.1.25.39 |
| Runtime audit-log retention TTL (`AUDIT_RETENTION_DAYS`) | `cycles-server` v0.1.25.15 |
| Events service management port split (9980) | `cycles-server-events` v0.1.25.9 |
| Bulk-action audit metadata enrichment (`succeeded_ids`, `failed_rows`, `filter`, `duration_ms`) | `cycles-server-admin` v0.1.25.30 |
| Budget bulk-action endpoint (`POST /v1/admin/budgets/bulk-action`) | `cycles-server-admin` v0.1.25.29, `cycles-dashboard` v0.1.25.35 |
| Audit tenant sentinel split (`__admin__` / `__unauth__`) | `cycles-server-admin` v0.1.25.28 |
| Audit log filter DSL (`error_code_exclude`, `status_min/max`, array `operation`/`resource_type`) | `cycles-server-admin` v0.1.25.27, `cycles-dashboard` v0.1.25.33 |
| Sorted pagination on `GET /v1/reservations` (`sort_by`, `sort_dir`) | `cycles-server` v0.1.25.12 |
| Admin-on-behalf-of release (`X-Admin-API-Key` on `/v1/reservations/{id}/release`) | `cycles-server` v0.1.25.8 |
| Bulk-action endpoints on tenants + webhooks | `cycles-server-admin` v0.1.25.26 |
| Free-text `search` on admin list endpoints | `cycles-server-admin` v0.1.25.25 |
| Server-side sort on admin list endpoints | `cycles-server-admin` v0.1.25.24 |
| Cross-tenant list for API keys + budgets | `cycles-server-admin` v0.1.25.22 |
| Failed-request audit capture + tiered TTL | `cycles-server-admin` v0.1.25.20 |
| `RESET_SPENT` funding operation | `cycles-server-admin` v0.1.25.18 |
| Dual-auth on tenant webhook endpoints | `cycles-server-admin` v0.1.25.16 |
| Webhook delivery via HTTP/1.1 (h2c fix) | `cycles-server-events` v0.1.25.5 |

---

*For detailed API changes, see the [Cycles Protocol specification](https://github.com/runcycles/cycles-protocol).*
