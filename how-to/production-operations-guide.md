---
title: "Production Operations Guide"
description: "Run Cycles reliably in production with Redis configuration, high availability, backup strategies, and operational best practices."
---

# Production Operations Guide

This guide covers what you need to run Cycles reliably in production. It assumes you've already deployed the stack per [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) and are preparing for production traffic.

::: info
Cycles stores all state in Redis. Redis availability directly determines Cycles availability. Plan your Redis deployment accordingly.
:::

## Redis configuration for production

Cycles stores all state in Redis. Redis availability directly determines Cycles availability.

### Persistence

Enable both RDB snapshots and AOF append-only logging:

```conf
# redis.conf
save 900 1        # Snapshot every 15 min if at least 1 key changed
save 300 10       # Snapshot every 5 min if at least 10 keys changed
appendonly yes     # Enable AOF
appendfsync everysec  # Fsync once per second (good balance of safety and performance)
```

In Docker Compose:

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --save "900 1" --save "300 10"
  volumes:
    - redis-data:/data
```

### Memory management

Set a max memory limit and eviction policy:

```conf
maxmemory 2gb
maxmemory-policy noeviction  # IMPORTANT: never evict budget data
```

**Always use `noeviction`**. Evicting budget keys silently loses budget state. It is better for Redis to reject writes (causing reservation failures that can be retried) than to silently drop data.

### High availability

For production, consider:

- **Redis Sentinel** — automatic failover with a primary + replica setup. Good for most deployments.
- **Redis Cluster** — sharded across multiple nodes. Required for very large deployments.

Cycles uses Lua scripts for atomic operations. All keys for a single reservation operation are in the same Redis keyspace, so single-instance and Sentinel setups work out of the box. For Redis Cluster, ensure the key prefix strategy keeps related keys on the same shard.

### Backup strategy

- **Automated RDB snapshots** stored offsite (S3, GCS, etc.)
- **AOF backups** for point-in-time recovery
- **Test restores regularly** — untested backups are not backups

## Cycles Server configuration

### Running multiple instances

The Cycles Server is stateless. You can run multiple instances behind a load balancer:

```yaml
cycles-server-1:
  image: ghcr.io/runcycles/cycles-server:0.1.24.1
  environment:
    REDIS_HOST: redis-primary
    REDIS_PORT: 6379
    REDIS_PASSWORD: ${REDIS_PASSWORD}

cycles-server-2:
  image: ghcr.io/runcycles/cycles-server:0.1.24.1
  environment:
    REDIS_HOST: redis-primary
    REDIS_PORT: 6379
    REDIS_PASSWORD: ${REDIS_PASSWORD}
```

Any load balancing strategy works (round-robin, least-connections). No sticky sessions required.

### Health checks

Both servers expose Spring Boot Actuator health endpoints:

```bash
# Cycles Server
curl http://localhost:7878/actuator/health

# Admin Server
curl http://localhost:7979/actuator/health
```

Configure your load balancer or orchestrator to check these endpoints.

### JVM tuning

The default JVM settings work for most deployments. For high-throughput environments:

```bash
JAVA_OPTS="-Xms512m -Xmx1g -XX:+UseG1GC"
```

### Reservation expiry

The server runs a background sweep to expire stale reservations:

```yaml
cycles:
  expiry:
    interval-ms: 5000  # Default: sweep every 5 seconds
```

Reduce the interval for tighter TTL enforcement. Increase it to reduce Redis load if TTL precision is not critical.

For listing and recovering stale or orphaned reservations after client crashes, see [Reservation Recovery and Listing](/protocol/reservation-recovery-and-listing-in-cycles).

## Network architecture

### Recommended topology

```
┌─────────────────┐
│  Load Balancer   │
│  (port 7878)     │  ← Application traffic (public or internal)
└────────┬─────────┘
         │
    ┌────┴────┐
    │ Cycles  │ ← Multiple instances for HA
    │ Server  │
    └────┬────┘
         │
    ┌────┴────┐
    │  Redis  │ ← Internal network only
    └─────────┘

┌──────────────────┐
│  Admin Server    │  ← Internal/VPN only (port 7979)
│  (management)    │
└────────┬─────────┘
         │
    ┌────┴────┐
    │  Redis  │ ← Same Redis instance
    └─────────┘
```

### Network isolation

- **Cycles Server** (port 7878): Accessible to your application. Can be on an internal network or behind an API gateway.
- **Admin Server** (port 7979): **Internal access only.** This manages tenants, API keys, and budgets. Never expose to the public internet.
- **Redis** (port 6379): **Internal access only.** Never expose directly.

### TLS termination

Terminate TLS at the load balancer or API gateway. The Cycles Server itself runs plain HTTP. Example with nginx:

```nginx
server {
    listen 443 ssl;
    server_name cycles.internal.example.com;

    ssl_certificate /etc/ssl/certs/cycles.crt;
    ssl_certificate_key /etc/ssl/private/cycles.key;

    location / {
        proxy_pass http://cycles-server:7878;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Capacity planning

### Rules of thumb

- **Redis memory:** ~1 KB per active reservation, ~500 bytes per budget ledger. 1 GB of Redis memory supports roughly 500K concurrent reservations.
- **Server CPU:** Each reservation involves 1 Redis Lua script execution (~1ms). A single server instance can handle thousands of reservations per second.
- **Latency:** Expect <5ms for reservation operations on a well-configured setup (server co-located with Redis).

### Scaling triggers

Add more Cycles Server instances when:
- Response latency exceeds 50ms at p99
- CPU utilization exceeds 70%

Scale Redis when:
- Memory utilization exceeds 80%
- Command latency exceeds 5ms

## Upgrade procedures

### Rolling upgrade

Since the Cycles Server is stateless, you can do rolling upgrades with zero downtime:

1. Pull the new image: `docker pull ghcr.io/runcycles/cycles-server:NEW_VERSION`
2. Stop one instance at a time
3. Start the new version
4. Verify health check passes
5. Repeat for remaining instances

### Version compatibility

The Cycles protocol is versioned (`/v1`). Minor version upgrades (e.g., 0.1.23 → 0.1.24) are backward-compatible. Check the [changelog](/changelog) for breaking changes before major upgrades.

### Rollback

If an upgrade causes issues:

1. Stop the new version
2. Start the previous version
3. Redis state is compatible across minor versions

## Logging

### Log levels

Configure via Spring Boot:

```yaml
logging:
  level:
    io.runcycles: INFO      # Application logs
    org.springframework: WARN # Framework logs
```

Set `io.runcycles: DEBUG` for troubleshooting (includes full request/response logging).

### Structured logging

Add JSON logging for log aggregation systems:

```yaml
logging:
  pattern:
    console: '{"timestamp":"%d","level":"%p","logger":"%c","message":"%m"}%n'
```

Or use the Spring Boot JSON logging starter for full structured output.

## Operational runbooks

### Budget exhaustion alert

**Symptom:** Applications report `BUDGET_EXCEEDED` errors.

**Response:**
1. Check which scope is exhausted: `GET /v1/balances?tenant=...`
2. Determine if this is expected (legitimate traffic) or unexpected (runaway agent)
3. If expected: fund the budget via admin API (`POST .../fund` with `CREDIT`)
4. If unexpected: check active reservations for anomalies (`GET /v1/reservations?status=ACTIVE`)

### Reservation leak

**Symptom:** Budget `reserved` amount grows but `spent` stays flat. Reservations are being created but never committed or released.

**Response:**
1. List active reservations: `GET /v1/reservations?status=ACTIVE`
2. Check for reservations past their expected TTL
3. The expiry sweep should eventually clean these up. If it's not running, check the server logs.
4. Investigate the client application — it may be failing to commit or release.

### Commit failure after successful LLM call

**Symptom:** An LLM call (or other side-effecting action) completes successfully, but the subsequent commit to Cycles fails. The work happened and incurred real cost, but the budget ledger does not reflect it.

**Why this happens:**
- Transient network error between client and Cycles Server
- Cycles Server restart or Redis outage at commit time
- Client process crash after the LLM call but before commit

**What the retry engine does:**

All three clients (Python, TypeScript, Spring Boot) include a commit retry engine enabled by default. When a commit fails with a transport error or 5xx response, the engine retries with exponential backoff (default: 5 attempts over ~30 seconds). This handles most transient failures automatically.

**When retry is not enough:**

If all retries are exhausted or the client process crashes entirely, the reservation remains in `ACTIVE` state until it expires (based on TTL + grace period). After expiry, the reserved budget is returned to the pool. The actual cost is unaccounted for — the budget appears more available than it really is.

**Response:**
1. **Check for expired reservations that were never committed:**
   ```bash
   curl -s "http://localhost:7878/v1/reservations?tenant=acme-corp&status=EXPIRED" \
     -H "X-Cycles-API-Key: $API_KEY" | jq '.reservations[] | {reservation_id, scope_path, estimate: .estimate.amount, created_at, expired_at}'
   ```
2. **Reconcile using events:** For each expired reservation that represents real work, record the actual cost as a standalone event:
   ```bash
   curl -s -X POST http://localhost:7878/v1/events \
     -H "Content-Type: application/json" \
     -H "X-Cycles-API-Key: $API_KEY" \
     -d '{
       "idempotency_key": "reconcile-<reservation_id>",
       "subject": { "tenant": "acme-corp" },
       "action": { "kind": "reconciliation", "name": "commit-failure-recovery" },
       "actual": { "unit": "USD_MICROCENTS", "amount": <actual_cost> },
       "overage_policy": "ALLOW_WITH_OVERDRAFT",
       "metadata": { "original_reservation_id": "<reservation_id>" }
     }'
   ```
3. **Monitor commit failure rates.** A sustained increase in commit failures signals infrastructure issues. Track the ratio of committed vs. expired reservations.

**Prevention:**
- Keep retry enabled (default) with aggressive settings for critical workloads
- Use `ALLOW_WITH_OVERDRAFT` overage policy for must-record actions so reconciliation events are always accepted
- Ensure client processes have graceful shutdown hooks that commit or release active reservations
- Set up alerts on the expired reservation count (see [Monitoring and Alerting](/how-to/monitoring-and-alerting))

### Redis connection loss

**Symptom:** All reservation operations fail with 500 errors.

**Response:**
1. Check Redis connectivity: `redis-cli ping`
2. Check server logs for connection errors
3. Restart the Cycles Server if Redis connection pool is exhausted
4. Active reservations with remaining TTL are preserved in Redis and will resume when connectivity returns

## Next steps

- [Client Performance Tuning](/how-to/client-performance-tuning) — timeout, retry, and connection pool optimization
- [Security Hardening](/how-to/security-hardening) — Redis AUTH, TLS, key rotation
- [Monitoring and Alerting](/how-to/monitoring-and-alerting) — metrics and alerting setup
- [Server Configuration Reference](/configuration/server-configuration-reference-for-cycles) — all configuration properties
