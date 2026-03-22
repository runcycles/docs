---
title: "Authentication, Tenancy, and API Keys in Cycles"
description: "How Cycles authenticates API requests and scopes all budget operations to tenants using API keys. Covers key creation, tenant isolation, and the security model."
---

# Authentication, Tenancy, and API Keys in Cycles

Every request to the Cycles API is authenticated. Every budget operation is tenant-scoped.

These two properties — authentication and tenancy — are foundational. They determine who is making the request, which budgets are visible, and which reservations can be accessed.

## How authentication works

Cycles authenticates requests using the `X-Cycles-API-Key` header.

Every request must include this header. If it is missing or the key is invalid, the server returns `401 UNAUTHORIZED`.

```
X-Cycles-API-Key: your-api-key
```

There is no session, no token exchange, no OAuth flow. Authentication is a single header on every request.

## The effective tenant

From the API key (or other auth context), the server determines an **effective tenant**.

The effective tenant is the identity that governs all budget operations for that request:

- which budgets can be queried
- which reservations can be created
- which reservations can be committed, released, or extended
- which balances are visible

The effective tenant is not sent by the client. It is derived by the server from the authentication context.

## Tenant validation on every request

Every request that includes a `Subject` must have a `tenant` field that matches the effective tenant.

If the client sends `subject.tenant = "acme"` but the API key maps to tenant `"beta"`, the server returns `403 FORBIDDEN`.

This is a normative rule: the server **must** reject any request where `subject.tenant` does not match the effective tenant.

This prevents one tenant from creating reservations, recording events, or querying budgets against another tenant's scopes.

## Reservation ownership

Every reservation is bound to the effective tenant at creation time.

Any subsequent operation on that reservation — commit, release, extend, or get — must come from the same effective tenant.

If a different tenant attempts to access the reservation, the server returns `403 FORBIDDEN`, even if the reservation ID is known.

This means:

- tenant A cannot commit tenant B's reservation
- tenant A cannot release tenant B's reservation
- tenant A cannot extend tenant B's reservation
- tenant A cannot view tenant B's reservation details

Reservation ownership is enforced at the protocol level, not by convention.

## Balance visibility

Balance queries are tenant-scoped.

The server only returns balances within the effective tenant's scope. If the `tenant` query parameter is provided, it is validation-only — it must match the effective tenant, or the server returns `403 FORBIDDEN`.

If the `tenant` parameter is omitted, the effective tenant is used automatically.

A tenant cannot query another tenant's balances under any circumstances.

## Tenant validation on listing endpoints

The reservation listing endpoint (`GET /v1/reservations`) follows the same tenancy rules:

- results are scoped to the effective tenant
- if the `tenant` query parameter is provided, it must match the effective tenant
- if it does not match, the server returns `403 FORBIDDEN`

This ensures that listing and recovery operations are always tenant-isolated.

## The decide endpoint and tenancy

The decide endpoint (`POST /v1/decide`) follows the same rule: `subject.tenant` must match the effective tenant.

Even though decide is a read-only preflight check that does not modify budget state, it still enforces tenant isolation.

## How the X-Cycles-Tenant response header works

The server may include an `X-Cycles-Tenant` response header on any response.

This header contains the effective tenant identifier derived from the authentication context.

It is useful for:

- debugging tenant mismatch errors
- confirming which tenant the server resolved from the API key
- logging and correlation in multi-tenant environments

This header is optional in v0 implementations.

## Practical implications

### One API key per tenant (typical)

Most deployments map each API key to exactly one tenant. This makes tenant validation automatic — the client sets `subject.tenant` to match its key, and all operations are scoped correctly.

### Multi-tenant API keys (advanced)

Some deployments may use API keys that can operate on behalf of multiple tenants. In this case, the effective tenant derivation logic is implementation-specific and may involve additional headers or request context.

The protocol does not define how effective tenant is derived — only that it must be derived and enforced consistently.

### Tenant mismatch debugging

When a `403 FORBIDDEN` error occurs, the most common cause is a tenant mismatch:

- the `subject.tenant` in the request does not match the effective tenant from the API key
- a commit or release targets a reservation owned by a different tenant
- a balance query specifies a tenant that does not match the API key

Check the `X-Cycles-Tenant` response header (if present) to see which tenant the server resolved.

## Security properties

The authentication and tenancy model provides several guarantees:

- **Isolation**: tenants cannot see or modify each other's budgets, reservations, or balances
- **Ownership**: reservations are permanently bound to the creating tenant
- **Validation**: every request is checked against the effective tenant before processing
- **Consistency**: the same tenancy rules apply to all endpoints (reserve, commit, release, extend, decide, events, balances, listing)

These properties hold regardless of whether the client is trusted. The server enforces them on every request.

## Summary

Authentication in Cycles is a single API key header (`X-Cycles-API-Key`) on every request.

The server derives an effective tenant from the key and enforces tenant isolation across all operations:

- **Subject.tenant** must match the effective tenant on every mutation and query
- **Reservation ownership** is enforced on commit, release, extend, and get
- **Balance visibility** is scoped to the effective tenant
- **403 FORBIDDEN** is returned for any tenant mismatch

This ensures that budget governance is always tenant-isolated, even in shared deployments.

## Next steps

- [Tenant Creation and Management](/how-to/tenant-creation-and-management-in-cycles) — create, configure, and manage tenants via the Admin API
- [API Key Management](/how-to/api-key-management-in-cycles) — create and rotate tenant-scoped API keys
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — set up budgets at tenant and sub-scopes
- [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles) — how tenant scopes fit into the budget hierarchy
- [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) — set up the Cycles infrastructure from scratch
- Integrate with [Python](/quickstart/getting-started-with-the-python-client), [TypeScript](/quickstart/getting-started-with-the-typescript-client), or [Spring AI](https://github.com/runcycles/cycles-spring-boot-starter)
