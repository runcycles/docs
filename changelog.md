---
title: "Changelog"
description: "Release history and version notes for the Cycles Protocol, server, admin API, Python client, TypeScript client, and Spring Boot starter."
---

# Changelog

Release history for the Cycles Protocol and reference implementations.

## v0.1.24 — March 2026 (Current)

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
- New endpoint: `PATCH /v1/admin/policies/{policy_id}` — update all mutable policy fields (name, description, priority, caps, overage policy, TTL override, rate limits, effective dates, status)
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
| `@runcycles/openclaw-budget-guard` | 0.2.0 | v0.1.23+, v0.1.24+ |
| Cycles Server | v0.1.24 | Protocol v0.1.24 |
| Cycles Admin Server | v0.1.24 | Protocol v0.1.24 |

All 0.2.0 SDKs are backward-compatible with server v0.1.23. New v0.1.24 features (budget patch, policy patch, capped `ALLOW_IF_AVAILABLE` commits) require server v0.1.24.

---

*For detailed API changes, see the [Cycles Protocol specification](https://github.com/runcycles/cycles-protocol).*
