---
title: "Security"
description: "Cycles security posture: data residency, event audit trail, access control, and compliance."
---

# Security

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
  -H "Authorization: Bearer $CYCLES_API_KEY"

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
│  Your App → Load Balancer → Cycles Server:7878  │
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

## Certification status

SOC 2 Type I certification is in progress for the managed cloud offering. This page and the [Security Hardening Guide](/how-to/security-hardening) document exactly what we log, how we store it, and how access is controlled.

For self-hosted deployments, Cycles runs entirely within your infrastructure and inherits your existing compliance posture.

## Next steps

- [Security Hardening Guide](/how-to/security-hardening) — operational security checklist for production deployments
- [Authentication and Tenancy](/protocol/authentication-tenancy-and-api-keys-in-cycles) — how API keys, tenants, and scopes work
- [API Key Management](/how-to/api-key-management-in-cycles) — key lifecycle, rotation, and least-privilege setup
