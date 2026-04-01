---
title: "Cycles Security"
description: "Cycles security posture for AI agent budget enforcement: data residency, queryable event audit trail, tenant isolation, least-privilege API keys, and SOC 2 compliance status."
---

# Cycles Security

Cycles is infrastructure that sits in the execution path of autonomous agents. Security is a first-order concern.

## Data residency

All Cycles state lives in Redis.

- **Self-hosted**: Redis runs in your infrastructure. No data leaves your network. You control the region, the instance type, and the retention policy.
- **Managed cloud** (RunCycles.io): Redis runs in the cloud region you select at provisioning. Data does not leave the selected region.

Cycles stores budget state — reservation amounts, balances, event records, and tenant configuration. It does not store LLM prompts, responses, or any content from agent interactions.

## Event audit trail

Every budget operation — reservation, commit, release, event — creates a structured record:

| Field | Description |
|---|---|
| `reservation_id` / `event_id` | Unique identifier for the operation |
| `subject` | Full scope hierarchy (tenant, workspace, app, workflow, agent, toolset) |
| `action` | What happened (kind, name, tags) |
| `estimate` | Budget locked before execution (reservations) |
| `actual` | Usage recorded after execution (commits and events) |
| `status` | RESERVED, COMMITTED, RELEASED, EXPIRED, APPLIED |
| `metrics` | Operational metadata (tokens, latency, model version) |
| `metadata` | Arbitrary key-value pairs for audit context |

Every reservation, commit, release, and event is logged with the scope context needed for audit. The trail answers "which agent spent how much, on what, and when" from the budget ledger alone.

### Querying the audit trail

Events and reservations are queryable via the REST API:

```bash
# List reservations for a tenant
curl -s "http://localhost:7878/v1/reservations?tenant=acme-corp&status=COMMITTED" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY"

# Admin audit logs (administrative operations)
curl -s "http://localhost:7979/v1/admin/audit/logs?tenant_id=acme-corp&limit=50" \
  -H "X-Admin-API-Key: $ADMIN_KEY"
```

### Retention

- **Hot storage (Redis)**: 90 days — queryable via API in real time
- **Cold storage**: Export to S3, GCS, or any object store for long-term retention. Recommended: 1+ year for compliance

## Access control

Cycles separates the runtime plane from the management plane:

| Plane | Port | Access | Purpose |
|---|---|---|---|
| Runtime (Cycles Server) | 7878 | Application servers, via load balancer | Reserve, commit, check balances |
| Management (Admin Server) | 7979 | Operations team only, via VPN | Create tenants, manage API keys, set budgets |

```
┌─────────────────────────────────────────────────┐
│                Public Network                   │
│  Your App →                                     │
│           Load Balancer →                       │
│                     Cycles Server:7878          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Internal / VPN Only                │
│  Admin UI → Admin Server:7979                   │
│             Redis:6379                          │
└─────────────────────────────────────────────────┘
```

### API key security

- **Least-privilege**: Each key is scoped to specific permissions (e.g., `reservations:create`, `balances:read`). Application keys never get admin access.
- **Rotation**: Keys can be rotated without downtime — create new key, deploy, revoke old key.
- **Revocation**: Immediate. A revoked key is rejected on the next request.
- **Storage**: Keys should live in a secrets manager (AWS Secrets Manager, HashiCorp Vault), never in source control.

## Self-hosted vs managed cloud

| | Self-Hosted | Managed Cloud (RunCycles.io) |
|---|---|---|
| Data location | Your infrastructure | Cloud region you select |
| Network exposure | Your network only | TLS-terminated, access-controlled |
| Redis management | You operate | We operate |
| Admin server access | You control | Role-based access |
| Compliance scope | Your audit perimeter | SOC 2 Type I in progress |

## Webhook security

Cycles delivers events to external HTTP endpoints via webhooks. Three layers protect this surface:

### HMAC-SHA256 signature verification

Every webhook delivery includes an `X-Cycles-Signature` header containing `sha256=<hex>`, the HMAC-SHA256 of the raw JSON body using the subscription's signing secret as the key. Receivers **must** verify this header before processing the payload. This proves both the sender's identity (shared secret) and the body's integrity (hash match).

Signing secrets are generated at subscription creation and returned exactly once. They should be stored in a secrets manager, not in application code.

See [Webhook Integrations](/how-to/webhook-integrations#signature-verification) for verification code in Python, Node.js, Go, and Java.

### SSRF protection

Webhook URLs are validated on creation and update to prevent Server-Side Request Forgery:

- **HTTPS required** — HTTP URLs are rejected by default (`allow_http: false`)
- **Private IP blocking** — Resolved IPs are checked against private/reserved ranges (loopback, RFC 1918, link-local, IPv6 private). This check is always enforced regardless of configuration.
- **URL pattern allowlisting** — Optional `allowed_url_patterns` restrict accepted URLs to specific domains

Default blocked CIDRs: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1/128`, `fc00::/7`

Configuration is managed via `GET/PUT /v1/admin/config/webhook-security`. See the [Admin API Guide](/admin-api/guide#pillar-4-events--webhooks-v0125) for examples.

### Signing secret encryption at rest

Webhook signing secrets are encrypted in Redis using AES-256-GCM with a 12-byte random IV per encryption. The encryption key (`WEBHOOK_SECRET_ENCRYPTION_KEY`) must be shared across the admin, runtime, and events services. If not set, secrets are stored in plaintext (backward compatible for development).

### At-least-once delivery

Webhooks are delivered at least once. Network retries, service restarts, or replay operations may cause duplicate deliveries. Receivers should deduplicate using the `X-Cycles-Event-Id` header (unique per event). Store processed event IDs with a short TTL (e.g., 24 hours) to detect replays.

## Certification status

SOC 2 Type I certification is in progress for the managed cloud offering. This page and the [Security Hardening Guide](/how-to/security-hardening) document exactly what we log, how we store it, and how access is controlled.

For self-hosted deployments, Cycles runs entirely within your infrastructure and inherits your existing compliance posture.

## Next steps

- [Security Hardening Guide](/how-to/security-hardening) — operational security checklist for production deployments
- [Authentication and Tenancy](/protocol/authentication-tenancy-and-api-keys-in-cycles) — how API keys, tenants, and scopes work
- [API Key Management](/how-to/api-key-management-in-cycles) — key lifecycle, rotation, and least-privilege setup
