---
title: "Security Hardening"
description: "Security best practices for production Cycles deployments including network isolation, API key rotation, and access control."
---

# Security Hardening

This guide covers security best practices for a production Cycles deployment.

::: warning Critical
The Admin Server (port 7979) should **never** be exposed to the public internet. It has full control over tenants, API keys, and budgets.
:::

## Network isolation

### Separate management and runtime planes

The Admin Server (port 7979) manages tenants, API keys, and budgets. It should **never be accessible from the public internet**.

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

### Firewall rules

| Source | Destination | Port | Allow |
|---|---|---|---|
| Application servers | Cycles Server | 7878 | Yes |
| Operations team (VPN) | Admin Server | 7979 | Yes |
| Cycles Server | Redis | 6379 | Yes |
| Admin Server | Redis | 6379 | Yes |
| Public internet | Admin Server | 7979 | **No** |
| Public internet | Redis | 6379 | **No** |

## Redis security

### Authentication

Always set a strong Redis password in production:

```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes

cycles-server:
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD}

cycles-admin:
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD}
```

Generate a strong password:

```bash
openssl rand -base64 32
```

### Redis TLS

For environments where Redis traffic crosses network boundaries, enable TLS:

```conf
# redis.conf
tls-port 6380
port 0  # Disable non-TLS port
tls-cert-file /etc/redis/tls/redis.crt
tls-key-file /etc/redis/tls/redis.key
tls-ca-cert-file /etc/redis/tls/ca.crt
```

### Redis ACLs

Restrict the Cycles service account to only the commands it needs:

```conf
# redis.conf
user cycles on >${REDIS_PASSWORD} ~cycles:* ~budget:* ~reservation:* ~tenant:* ~apikey:* ~audit:* +@all
user default off
```

### Disable dangerous commands

```conf
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""
```

## API key management

### Key rotation

API keys should be rotated regularly:

1. Create a new key with the same permissions
2. Update the application configuration to use the new key
3. Verify the application works with the new key
4. Revoke the old key

```bash
# 1. Create new key
NEW_KEY=$(curl -s -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "prod-key-v2",
    "permissions": ["reservations:create","reservations:commit","reservations:release","reservations:extend","balances:read","decide","events:create"]
  }' | jq -r '.key_secret')

# 2. Update application config (deploy with new key)
# 3. Verify application health

# 4. Revoke old key
curl -s -X DELETE "http://localhost:7979/v1/admin/api-keys/${OLD_KEY_ID}" \
  -H "X-Admin-API-Key: $ADMIN_KEY"
```

### Least-privilege permissions

Only grant the permissions each component needs:

| Component | Permissions needed |
|---|---|
| Application (runtime) | `reservations:create`, `reservations:commit`, `reservations:release`, `reservations:extend`, `balances:read` |
| Monitoring service | `balances:read`, `reservations:list` |
| Batch processor | `reservations:create`, `reservations:commit`, `events:create` |
| Preflight checker | `decide` |

Don't give application keys full permissions when they only need a subset.

### Admin key security

The `ADMIN_API_KEY` (used in the `X-Admin-API-Key` header) has full administrative access. Protect it:

- Store in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Never commit to source control
- Rotate on a schedule
- Limit who can access it

### Key storage in applications

```bash
# Good: environment variables from secrets manager
export CYCLES_API_KEY=$(aws secretsmanager get-secret-value --secret-id cycles/api-key --query SecretString --output text)

# Bad: hardcoded in source code
# CYCLES_API_KEY = "cyc_live_abc123..."  # NEVER DO THIS
```

## Audit logging

The Admin Server records audit logs for administrative operations. Use these for:

- **Compliance:** Track who created/modified/revoked API keys
- **Incident response:** Determine when a tenant or budget was changed
- **Access review:** Identify unused or over-privileged keys

Query audit logs:

```bash
curl -s "http://localhost:7979/v1/admin/audit-logs?tenant_id=acme-corp&limit=50" \
  -H "X-Admin-API-Key: $ADMIN_KEY" | jq .
```

### Retention policy

- **Hot storage (Redis):** 90 days — queryable via the API
- **Cold storage:** Export to S3/GCS/etc. for long-term retention (1+ year recommended for compliance)

Set up a periodic export job to archive audit logs before they expire from Redis.

## TLS for client-to-server communication

Terminate TLS at the load balancer or reverse proxy. See the [Production Operations Guide](/how-to/production-operations-guide) for nginx configuration.

For service-to-service communication within a trusted network (e.g., Kubernetes cluster), plain HTTP to the Cycles Server is acceptable if network policies restrict access.

## Container security

### Run as non-root

The Cycles Server Docker images run as a non-root user by default. Verify:

```bash
docker run --rm ghcr.io/runcycles/cycles-server:latest whoami
```

### Pin image versions

Use specific version tags, not `latest`:

```yaml
image: ghcr.io/runcycles/cycles-server:0.1.23  # Pinned
# NOT: ghcr.io/runcycles/cycles-server:latest   # Unpinned
```

### Read-only filesystem

Mount the container filesystem as read-only:

```yaml
cycles-server:
  image: ghcr.io/runcycles/cycles-server:0.1.23
  read_only: true
  tmpfs:
    - /tmp
```

## Security checklist

- [ ] Admin Server not accessible from public internet
- [ ] Redis not accessible from public internet
- [ ] Redis password set and stored in secrets manager
- [ ] API keys use least-privilege permissions
- [ ] Admin key stored in secrets manager, not in source control
- [ ] TLS termination configured for client-facing traffic
- [ ] Container images pinned to specific versions
- [ ] Audit log retention policy defined
- [ ] Key rotation schedule established
- [ ] Dangerous Redis commands disabled

## Next steps

- [Production Operations Guide](/how-to/production-operations-guide) — deployment and infrastructure
- [Monitoring and Alerting](/how-to/monitoring-and-alerting) — metrics and alerting
- [API Key Management](/how-to/api-key-management-in-cycles) — key lifecycle management
