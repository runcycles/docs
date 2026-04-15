---
title: "Changelog"
description: "Release history and version notes for the Cycles Protocol, server, admin API, Python client, TypeScript client, and Spring Boot starter."
---

# Changelog

Release history for the Cycles Protocol and reference implementations.

## v0.1.25 — April 2026 (Current)

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
| `runcycles` (Python) | 0.2.0 | v0.1.23+, v0.1.24+ |
| `runcycles` (TypeScript) | 0.2.0 | v0.1.23+, v0.1.24+ |
| `cycles-client-java-spring` | 0.2.0 | v0.1.23+, v0.1.24+ |
| `@runcycles/mcp-server` | 0.2.0 | v0.1.23+, v0.1.24+ |
| `@runcycles/openclaw-budget-guard` | 0.8.0 | v0.1.23+, v0.1.24+ |
| Cycles Server | v0.1.25 | Protocol v0.1.25 |
| Cycles Admin Server | v0.1.25 | Protocol v0.1.25 (governance base v0.1.25.14, semantic base v0.1.25.9) |

All 0.2.0 SDKs are backward-compatible with server v0.1.23. New v0.1.24 features (budget patch, policy patch, capped `ALLOW_IF_AVAILABLE` commits) require server v0.1.24+. New v0.1.25 features (event emission, webhook delivery, events service, `policy_id` / `deny_detail` on `reservation.denied`) require server v0.1.25.

---

*For detailed API changes, see the [Cycles Protocol specification](https://github.com/runcycles/cycles-protocol).*
