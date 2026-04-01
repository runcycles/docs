---
title: Webhooks and Events
description: How Cycles emits events and delivers them to external systems via webhooks
---

# Webhooks and Events

Cycles emits **events** for every observable state change — budget exhaustion, reservation denials, tenant lifecycle changes, API key operations, and system health. **Webhooks** deliver these events to external endpoints via HTTP POST with HMAC-SHA256 signatures.

## Core Concepts

### Events

An event is an immutable record of a state change. Every event has:
- **event_type** — dotted format like `budget.exhausted` or `reservation.denied`
- **category** — one of: budget, reservation, tenant, api_key, policy, system
- **tenant_id** — which tenant is affected
- **source** — which service emitted it (`cycles-server`, `cycles-admin`, `expiry-sweeper`)
- **data** — event-specific payload (varies by type)

Events are stored in Redis with a 90-day TTL (configurable).

### Webhook Subscriptions

A subscription defines which events to deliver and where:
- **url** — HTTPS endpoint to receive HTTP POST requests
- **event_types** — specific events to receive (e.g., `["budget.exhausted", "reservation.denied"]`)
- **event_categories** — receive all events in a category (additive with event_types)
- **signing_secret** — HMAC-SHA256 key for payload verification

### Delivery Semantics

- **At-least-once** — events may be delivered more than once. Deduplicate using `event_id`.
- **Ordered within tenant** — events for the same tenant are dispatched in order.
- **Non-blocking** — webhook delivery never blocks the API operation that produced the event.
- **Retry with backoff** — failed deliveries retry with exponential backoff (default: 5 retries).
- **Auto-disable** — subscriptions are disabled after consecutive failures (default: 10).

## Architecture

```
Admin server (CRUD) ──┐
                      ├── event:{id} + delivery:{id} + LPUSH dispatch:pending
Runtime server (reserve/commit) ──┘
                              │
                         Redis ─┤
                              │
Events service (port 7980) ─── BRPOP → HTTP POST with X-Cycles-Signature
```

The events service is **optional**. If not deployed, events accumulate in Redis with TTL and are delivered when the service starts.

## 40 Event Types

| Category | Count | Examples |
|---|---|---|
| budget | 15 | `budget.exhausted`, `budget.threshold_crossed`, `budget.over_limit_entered`, `budget.funded` |
| reservation | 5 | `reservation.denied`, `reservation.commit_overage`, `reservation.expired` |
| tenant | 6 | `tenant.created`, `tenant.suspended`, `tenant.closed` |
| api_key | 6 | `api_key.created`, `api_key.revoked`, `api_key.auth_failed` |
| policy | 3 | `policy.created`, `policy.updated`, `policy.deleted` |
| system | 5 | `system.store_connection_lost`, `system.webhook_delivery_failed` |

## Tenant Self-Service

Tenants can create their own webhook subscriptions via `/v1/webhooks` (requires `webhooks:write` permission). Tenant webhooks are restricted to budget, reservation, and tenant events (26 of 40 types).

## Security

- **HMAC-SHA256** — every delivery includes `X-Cycles-Signature: sha256=<hex>` for payload verification
- **Encryption at rest** — signing secrets encrypted in Redis with AES-256-GCM
- **SSRF prevention** — private IP ranges blocked by default, HTTPS required in production

## Learn More

- [Webhook Integrations Guide](/how-to/webhook-integrations) — PagerDuty, Slack, ServiceNow examples with code
- [Security Hardening](/how-to/security-hardening) — webhook URL security and secret rotation
- [Production Operations](/how-to/production-operations-guide) — events service deployment and failure handling
