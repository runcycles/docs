# API Key Management in Cycles

Every request to the Cycles server requires an API key. This page explains how API keys work, how to create and manage them, and how they relate to tenant isolation.

## How API keys work

The Cycles server authenticates requests using the `X-Cycles-API-Key` header. Each API key is associated with exactly one tenant.

When a request arrives:

1. The server extracts the `X-Cycles-API-Key` header
2. Validates the key exists and is active
3. Derives the effective tenant from the key
4. Verifies that `subject.tenant` in the request body matches the key's tenant
5. If any check fails, returns `401 UNAUTHORIZED` or `403 FORBIDDEN`

This ensures strict tenant isolation — an API key for tenant A cannot create reservations or query balances for tenant B.

## Key states

An API key can be in one of three states:

| State | Meaning |
|---|---|
| `ACTIVE` | Key is valid and can be used for requests |
| `REVOKED` | Key has been manually disabled |
| `EXPIRED` | Key has passed its expiration date |

Only `ACTIVE` keys are accepted. Requests with `REVOKED` or `EXPIRED` keys receive `401 UNAUTHORIZED`.

## Creating API keys

API keys are managed through the [Cycles Admin](https://github.com/runcycles/cycles-server-admin) interface:

```bash
# Create a new API key for a tenant
curl -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_API_KEY" \
  -d '{
    "tenant_id": "acme",
    "name": "production-chatbot",
    "description": "Production chatbot key",
    "permissions": ["reservations:create", "reservations:commit", "reservations:release", "balances:read"]
  }'
```

Response:

```json
{
  "key_id": "key_abc123...",
  "key_secret": "cyc_live_abc123...",
  "key_prefix": "cyc_live_abc12",
  "tenant_id": "acme",
  "permissions": ["reservations:create", "reservations:commit", "reservations:release", "balances:read"],
  "created_at": "2026-03-01T00:00:00Z",
  "expires_at": "2026-05-30T00:00:00Z"
}
```

Store the API key securely. It is shown only once at creation time.

## Using API keys

### In the Spring Boot Starter

Configure the key in your project's `src/main/resources/application.yml`:

```yaml
cycles:
  api-key: ${CYCLES_API_KEY}
  base-url: https://cycles.example.com
  tenant: acme
```

Use an environment variable rather than hardcoding the key.

### In direct HTTP calls

Pass the key in the `X-Cycles-API-Key` header:

```bash
curl -X POST http://localhost:7878/v1/reservations \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: cyc_live_abc123..." \
  -d '{ ... }'
```

## Revoking API keys

Revoke a key to immediately block all requests using it:

```bash
curl -X DELETE http://localhost:7979/v1/admin/api-keys/key_abc123 \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"
```

Revocation is immediate. Any in-flight requests using the revoked key will fail on their next call to the Cycles server. Active reservations created with the revoked key remain valid until they expire or are committed/released.

## Key rotation

To rotate an API key without downtime:

1. Create a new key for the same tenant
2. Update your application configuration to use the new key
3. Deploy the configuration change
4. Verify traffic is flowing with the new key
5. Revoke the old key

Because both keys are valid during the transition, there is no interruption.

## Tenant isolation

API keys are the primary mechanism for tenant isolation in Cycles.

**Enforced behaviors:**

- A key for tenant A can only create reservations where `subject.tenant = "A"` (or where tenant is omitted, in which case the server uses the key's tenant)
- A key for tenant A cannot commit, release, or extend reservations owned by tenant B
- A key for tenant A cannot query balances for tenant B
- A key for tenant A cannot list reservations belonging to tenant B

**If the tenant is omitted from the Subject**, the server automatically sets it to the key's associated tenant. This is the recommended approach — configure the tenant at the key level and let the server enforce it.

## Best practices

### One key per environment

Use separate API keys for production, staging, and development, even within the same tenant. This makes it easy to revoke a single environment's access without affecting others.

### Use environment variables

Never hardcode API keys in source code:

```yaml
# Good
cycles:
  api-key: ${CYCLES_API_KEY}

# Bad
cycles:
  api-key: cyc_live_abc123...
```

### Minimal key scope

If you operate multiple tenants, issue one key per tenant. Do not share keys across tenants.

### Monitor key usage

Track which keys are making requests. If a key is compromised, revoke it immediately and issue a replacement.

## Error responses

| Error | HTTP | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing `X-Cycles-API-Key` header, or key is invalid/revoked/expired |
| `FORBIDDEN` | 403 | Key is valid but `subject.tenant` does not match the key's tenant |

## Next steps

- [Authentication and Tenancy](/protocol/authentication-tenancy-and-api-keys-in-cycles) — deeper dive into the auth model
- [Self-Hosting the Cycles Server](/quickstart/self-hosting-the-cycles-server) — deploy your own instance
- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — how authentication fits into the system
