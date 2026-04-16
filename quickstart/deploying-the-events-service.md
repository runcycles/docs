---
title: "Deploying the Events Service"
description: "How to deploy the Cycles events service (cycles-server-events) for async webhook delivery with HMAC signing, exponential retry, and auto-disable."
---

# Deploying the Events Service

The events service (`cycles-server-events`, port 7980) delivers webhook events asynchronously — use it to get real-time alerts in Slack, PagerDuty, or your own systems when budgets run out, thresholds are crossed, or reservations are denied.

It is optional — the admin and runtime servers operate normally without it. When deployed, it consumes delivery jobs from Redis and sends HTTP POST requests to webhook endpoints with HMAC-SHA256 signatures.

## Quick start with Docker

If you already have the full stack running via [Deploying the Full Cycles Stack](/quickstart/deploying-the-full-cycles-stack), uncomment the `cycles-events` block in your `docker-compose.yml` and restart. Otherwise, use the full-stack compose from the admin repo:

```bash
# From the cycles-server-admin directory
export WEBHOOK_SECRET_ENCRYPTION_KEY=$(openssl rand -base64 32)
docker compose -f docker-compose.full-stack.yml up
```

Services: Redis (6379), Admin (7979), Runtime (7878), Events (7980).

## Standalone deployment

### From pre-built image

```bash
docker run -d --name cycles-events \
  -p 7980:7980 \
  -e REDIS_HOST=redis.example.com \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=your-redis-password \
  -e WEBHOOK_SECRET_ENCRYPTION_KEY=your-base64-key \
  ghcr.io/runcycles/cycles-server-events:0.1.25.5
```

### From JAR

```bash
REDIS_HOST=redis.example.com \
REDIS_PORT=6379 \
REDIS_PASSWORD=your-redis-password \
WEBHOOK_SECRET_ENCRYPTION_KEY=your-base64-key \
java -jar cycles-server-events-*.jar
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `REDIS_HOST` | Redis hostname (shared with admin and runtime servers) |
| `REDIS_PORT` | Redis port (default: 6379) |
| `REDIS_PASSWORD` | Redis password (empty for no auth) |

### Recommended

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | (empty) | AES-256-GCM key for signing secret decryption. Base64-encoded 32 bytes. Must match admin and runtime. Generate: `openssl rand -base64 32`. If empty, secrets are read as plaintext. |

### Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `dispatch.pending.timeout-seconds` | 5 | BRPOP blocking timeout (seconds) |
| `dispatch.retry.poll-interval-ms` | 5000 | How often to check for ready retries (ms) |
| `dispatch.http.timeout-seconds` | 30 | HTTP request timeout for webhook delivery |
| `dispatch.http.connect-timeout-seconds` | 5 | HTTP connect timeout |
| `MAX_DELIVERY_AGE_MS` | 86400000 | Deliveries older than this auto-fail (24h) |
| `EVENT_TTL_DAYS` | 90 | Redis TTL for event records |
| `DELIVERY_TTL_DAYS` | 14 | Redis TTL for delivery records |
| `RETENTION_CLEANUP_INTERVAL_MS` | 3600000 | ZSET index cleanup interval (1h) |

### Full configuration example

```bash
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
WEBHOOK_SECRET_ENCRYPTION_KEY=K7x2mP9qR4sT6wB1cD3fG5hJ8kL0nA2=
dispatch.pending.timeout-seconds=5
dispatch.retry.poll-interval-ms=5000
dispatch.http.timeout-seconds=30
dispatch.http.connect-timeout-seconds=5
MAX_DELIVERY_AGE_MS=86400000
EVENT_TTL_DAYS=90
DELIVERY_TTL_DAYS=14
RETENTION_CLEANUP_INTERVAL_MS=3600000
```

## Health check

The events service exposes a Spring Boot Actuator health endpoint:

```bash
curl http://localhost:7980/actuator/health
# {"status":"UP"}
```

In Docker, the Dockerfile includes a built-in health check (30s interval, 60s start period, 5 retries).

## What happens when the events service is down

1. **Admin and runtime servers are unaffected** — event emission is fire-and-forget, never blocks API responses
2. **Events and deliveries accumulate in Redis** — `event:{id}` keys (90-day TTL), `delivery:{id}` keys (14-day TTL), `dispatch:pending` list grows
3. **Redis memory is bounded** — TTLs ensure keys auto-expire even if never consumed
4. **When the events service restarts:**
   - Stale deliveries (older than `MAX_DELIVERY_AGE_MS`, default 24h) are immediately marked FAILED
   - Fresh deliveries are processed normally via BRPOP
   - `RetentionCleanupService` trims orphaned ZSET index entries hourly
5. **No data loss for events** — event records persist in Redis for 90 days regardless of delivery status

## Scaling

Multiple events service instances can safely BRPOP from the same `dispatch:pending` list — BRPOP is atomic, so each delivery is processed by exactly one consumer. No distributed locking is needed.

## Next steps

- [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol) — full event type catalog and delivery specification
- [Managing Webhooks](/how-to/managing-webhooks) — create, test, and monitor webhooks
- [Webhook Integrations](/how-to/webhook-integrations) — PagerDuty, Slack, ServiceNow examples
- [Configuration Reference](/configuration/server-configuration-reference-for-cycles#events-service-configuration) — all events service settings
- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — how the events service fits in the system
