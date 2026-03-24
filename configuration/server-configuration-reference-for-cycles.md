---
title: "Server Configuration Reference for Cycles"
description: "Complete reference for all Cycles server and admin server configuration properties, including Redis, expiry, logging, and Spring Boot actuator settings."
---

# Server Configuration Reference for Cycles

This is the complete reference for all configuration properties available in the Cycles server.

The server uses Spring Boot's configuration system. Properties can be set in `application.properties`, `application.yml`, or via environment variables.

## Server properties

| Property | Default | Env Variable | Description |
|---|---|---|---|
| `server.port` | `7878` | `SERVER_PORT` | HTTP port the server listens on |
| `spring.application.name` | `cycles-protocol-service` | — | Application name |

## Redis connection

| Property | Default | Env Variable | Description |
|---|---|---|---|
| `redis.host` | `localhost` | `REDIS_HOST` | Redis server hostname |
| `redis.port` | `6379` | `REDIS_PORT` | Redis server port |
| `redis.password` | (empty) | `REDIS_PASSWORD` | Redis password (optional) |

The server uses a JedisPool with a maximum of 50 connections by default. Redis 7+ is required for Lua script compatibility.

## Reservation expiry

| Property | Default | Env Variable | Description |
|---|---|---|---|
| `cycles.expiry.interval-ms` | `5000` | `CYCLES_EXPIRY_INTERVAL_MS` | How often the background expiry sweep runs (ms) |

The expiry sweep scans for reservations past their TTL and marks them as `EXPIRED`, releasing their reserved budget back to the affected scopes.

### Tuning the sweep interval

- **Lower values** (e.g., 1000ms): expired reservations are cleaned up faster, budget is returned sooner. Increases Redis load slightly.
- **Higher values** (e.g., 30000ms): less Redis overhead, but expired reservations hold budget longer before cleanup.

For most deployments, the default 5000ms is a good balance.

## JSON serialization

| Property | Default | Description |
|---|---|---|
| `spring.jackson.serialization.write-dates-as-timestamps` | `false` | Dates are ISO-8601 strings, not timestamps |
| `spring.jackson.deserialization.fail-on-unknown-properties` | `true` | Reject requests with unknown fields |
| `spring.jackson.default-property-inclusion` | `non_null` | Omit null fields from responses |

These settings enforce strict request validation and clean responses.

## Logging

| Property | Default | Description |
|---|---|---|
| `logging.level.root` | `INFO` | Root log level |
| `logging.level.io.runcycles.protocol` | `DEBUG` | Cycles-specific log level |
| `logging.pattern.console` | `%d{...} [%thread] %-5level %logger{36} - %msg%n` | Log format |

### Recommended production settings

```properties
logging.level.root=WARN
logging.level.io.runcycles.protocol=INFO
```

### Debugging

For troubleshooting, enable DEBUG on the data layer:

```properties
logging.level.io.runcycles.protocol.data=DEBUG
```

This logs Lua script execution details, scope derivation, and balance calculations.

## OpenAPI / Swagger

| Property | Default | Description |
|---|---|---|
| `springdoc.api-docs.path` | `/api-docs` | Path for the OpenAPI JSON spec |
| `springdoc.swagger-ui.path` | `/swagger-ui.html` | Path for the Swagger UI |
| `springdoc.swagger-ui.enabled` | `true` | Enable Swagger UI |

To disable Swagger UI in production:

```properties
springdoc.swagger-ui.enabled=false
```

The OpenAPI spec at `/api-docs` can remain enabled for tooling.

## Actuator / health checks

| Property | Default | Description |
|---|---|---|
| `management.endpoints.web.exposure.include` | `health,info` | Exposed actuator endpoints |
| `management.endpoint.health.show-details` | `when-authorized` | Show health details |

### Available health endpoints

```
GET /actuator/health   — basic health check
GET /actuator/info     — application info
```

### Adding more endpoints

To expose additional actuator endpoints:

```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
```

## Security configuration

The server's security is configured in `SecurityConfig.java`. The following paths are public (no API key required):

- `/api-docs/**` — OpenAPI spec
- `/swagger-ui/**` — Swagger UI
- `/swagger-ui.html` — Swagger UI entry point
- `/swagger-resources/**` — Swagger resource endpoints
- `/v3/api-docs/**` — OpenAPI v3 spec
- `/webjars/**` — WebJar resources
- `/favicon.ico` — Favicon
- `/.well-known/**` — Well-known endpoints
- `/actuator/health` — Health check (exact path only, not sub-paths)

All other paths require a valid `X-Cycles-API-Key` header.

## Full configuration example

```properties
# Server
server.port=7878

# Redis
redis.host=${REDIS_HOST:localhost}
redis.port=${REDIS_PORT:6379}
redis.password=${REDIS_PASSWORD:}

# Expiry
cycles.expiry.interval-ms=5000

# JSON
spring.jackson.serialization.write-dates-as-timestamps=false
spring.jackson.deserialization.fail-on-unknown-properties=true
spring.jackson.default-property-inclusion=non_null

# Logging
logging.level.root=INFO
logging.level.io.runcycles.protocol=DEBUG

# Swagger
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.enabled=true

# Actuator
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=when-authorized
```

## Environment variable reference

Quick reference for setting all properties via environment variables:

| Variable | Maps to |
|---|---|
| `REDIS_HOST` | `redis.host` |
| `REDIS_PORT` | `redis.port` |
| `REDIS_PASSWORD` | `redis.password` |
| `SERVER_PORT` | `server.port` |
| `CYCLES_EXPIRY_INTERVAL_MS` | `cycles.expiry.interval-ms` |

---

## Admin Server Configuration

The Cycles Admin Server (`cycles-admin-service`) is a separate service that manages tenants, API keys, budgets, and policies. It runs on port 7979 by default and shares the same Redis instance as the Cycles Server.

### Admin server properties

| Property | Default | Env Variable | Description |
|---|---|---|---|
| `server.port` | `7979` | `SERVER_PORT` | HTTP port the admin server listens on |
| `admin.api-key` | (empty) | `ADMIN_API_KEY` | Master admin key for `X-Admin-API-Key` header |
| `redis.host` | (required) | `REDIS_HOST` | Redis server hostname |
| `redis.port` | (required) | `REDIS_PORT` | Redis server port |
| `redis.password` | (required) | `REDIS_PASSWORD` | Redis password (set empty string if none) |

### Admin authentication

The admin server uses two authentication schemes:

| Header | Variable | Purpose |
|---|---|---|
| `X-Admin-API-Key` | `ADMIN_API_KEY` | System-level operations (tenant CRUD, API key management, audit logs) |
| `X-Cycles-API-Key` | — | Tenant-scoped operations (budget ledgers, policies, reservations) |

For the full endpoint-to-header mapping with required permissions, see the [Architecture Overview — Authentication](/quickstart/architecture-overview-how-cycles-fits-together#authentication).

### Admin server full configuration example

```properties
# Server
server.port=7979
spring.application.name=cycles-admin-service

# Redis (same instance as cycles-server)
redis.host=${REDIS_HOST}
redis.port=${REDIS_PORT}
redis.password=${REDIS_PASSWORD}

# Admin key
admin.api-key=${ADMIN_API_KEY:}

# JSON
spring.jackson.serialization.write-dates-as-timestamps=false
spring.jackson.deserialization.fail-on-unknown-properties=false
spring.jackson.default-property-inclusion=non_null

# Logging
logging.level.root=INFO
logging.level.io.runcycles.admin=DEBUG

# Swagger
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.enabled=true

# Actuator
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=when-authorized
```

### Security note

The admin server exposes powerful management operations. In production:

- Run the admin server on an internal network not accessible to application traffic
- Use a strong, randomly generated `ADMIN_API_KEY`
- Consider disabling Swagger UI (`springdoc.swagger-ui.enabled=false`)

## Next steps

- [Deploying the Full Cycles Stack](/quickstart/deploying-the-full-cycles-stack) — end-to-end deployment guide
- [Self-Hosting the Cycles Server](/quickstart/self-hosting-the-cycles-server) — deployment guide
- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — system design
- [Client Configuration Reference](/configuration/client-configuration-reference-for-cycles-spring-boot-starter) — client-side properties
