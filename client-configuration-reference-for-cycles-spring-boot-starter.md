# Client Configuration Reference for the Cycles Spring Boot Starter

This is the complete reference for all configuration properties available in the Cycles Spring Boot Starter.

All properties are under the `cycles` prefix in your `application.yml` or `application.properties`.

## Required properties

| Property | Type | Description |
|---|---|---|
| `cycles.base-url` | String | Base URL of the Cycles server (e.g., `http://localhost:7878`) |
| `cycles.api-key` | String | API key for authentication |

If either is missing or blank, the application will fail to start with a configuration error.

## Subject defaults

These properties set default values for the Subject fields used in `@Cycles` annotations. They apply to all annotated methods unless overridden at the annotation level or by a `CyclesFieldResolver`.

| Property | Type | Default | Description |
|---|---|---|---|
| `cycles.tenant` | String | (none) | Default tenant |
| `cycles.workspace` | String | (none) | Default workspace |
| `cycles.app` | String | (none) | Default application name |
| `cycles.workflow` | String | (none) | Default workflow |
| `cycles.agent` | String | (none) | Default agent |
| `cycles.toolset` | String | (none) | Default toolset |

### Resolution order

For each Subject field, the starter resolves the value using this priority:

1. **Annotation attribute** — if set on the `@Cycles` annotation, it wins
2. **Configuration property** — if set in `application.yml`
3. **CyclesFieldResolver bean** — if a bean named after the field exists (e.g., a bean named `"tenant"` implementing `CyclesFieldResolver`)

If none of these provide a value, the field is omitted from the request.

## HTTP configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `cycles.http.connect-timeout` | Duration | `2s` | TCP connection timeout to the Cycles server |
| `cycles.http.read-timeout` | Duration | `5s` | Read timeout for responses from the Cycles server |

Duration values use Spring Boot duration syntax: `2s`, `500ms`, `1m`, etc.

### Example

```yaml
cycles:
  http:
    connect-timeout: 3s
    read-timeout: 10s
```

For long-running operations where the server may take longer to respond (e.g., under heavy load), increase the read timeout.

## Retry configuration

Controls the commit retry engine for transient failures.

| Property | Type | Default | Description |
|---|---|---|---|
| `cycles.retry.enabled` | boolean | `true` | Enable automatic commit retries |
| `cycles.retry.max-attempts` | int | `5` | Maximum number of retry attempts |
| `cycles.retry.initial-delay` | Duration | `500ms` | Delay before the first retry |
| `cycles.retry.multiplier` | double | `2.0` | Backoff multiplier between retries |
| `cycles.retry.max-delay` | Duration | `30s` | Maximum delay between retries |

### How retry works

When a commit fails with a transport error or 5xx response, the retry engine schedules a retry using exponential backoff:

```
Attempt 1: wait 500ms
Attempt 2: wait 1000ms
Attempt 3: wait 2000ms
Attempt 4: wait 4000ms
Attempt 5: wait 8000ms (capped at max-delay)
```

Non-retryable errors (4xx responses) are not retried.

### Disabling retry

```yaml
cycles:
  retry:
    enabled: false
```

### Aggressive retry for critical commits

```yaml
cycles:
  retry:
    max-attempts: 10
    initial-delay: 200ms
    multiplier: 1.5
    max-delay: 60s
```

## Full configuration example

```yaml
cycles:
  # Required
  base-url: ${CYCLES_BASE_URL:http://localhost:7878}
  api-key: ${CYCLES_API_KEY}

  # Subject defaults
  tenant: acme
  workspace: production
  app: support-bot

  # HTTP settings
  http:
    connect-timeout: 2s
    read-timeout: 5s

  # Commit retry
  retry:
    enabled: true
    max-attempts: 5
    initial-delay: 500ms
    multiplier: 2.0
    max-delay: 30s
```

## Equivalent application.properties

```properties
cycles.base-url=${CYCLES_BASE_URL:http://localhost:7878}
cycles.api-key=${CYCLES_API_KEY}
cycles.tenant=acme
cycles.workspace=production
cycles.app=support-bot
cycles.http.connect-timeout=2s
cycles.http.read-timeout=5s
cycles.retry.enabled=true
cycles.retry.max-attempts=5
cycles.retry.initial-delay=500ms
cycles.retry.multiplier=2.0
cycles.retry.max-delay=30s
```

## Auto-configured beans

The starter auto-configures the following beans, all with `@ConditionalOnMissingBean` so you can override any of them:

| Bean | Type | Purpose |
|---|---|---|
| `cyclesWebClient` | `WebClient` | HTTP client with configured timeouts |
| `cyclesClient` | `CyclesClient` | Protocol client (`DefaultCyclesClient`) |
| `cyclesExpressionEvaluator` | `CyclesExpressionEvaluator` | SpEL evaluator |
| `cyclesRequestBuilderService` | `CyclesRequestBuilderService` | Builds protocol request bodies |
| `cyclesValueResolutionService` | `CyclesValueResolutionService` | Resolves Subject field values |
| `commitRetryEngine` | `CommitRetryEngine` | Handles commit retries (`InMemoryCommitRetryEngine`) |
| `cyclesLifecycleService` | `CyclesLifecycleService` | Orchestrates the full lifecycle |
| `cyclesAspect` | `CyclesAspect` | AOP aspect for `@Cycles` annotation |

### Overriding a bean

To replace any auto-configured bean, define your own:

```java
@Configuration
public class CustomCyclesConfig {

    @Bean
    public CyclesClient cyclesClient() {
        // Your custom implementation
        return new MyCustomCyclesClient();
    }
}
```

The auto-configuration will skip creating its default `CyclesClient` when it detects yours.

## Environment-specific configuration

### Using Spring profiles

```yaml
# application.yml (shared)
cycles:
  tenant: acme
  retry:
    enabled: true

---
# application-dev.yml
cycles:
  base-url: http://localhost:7878
  api-key: dev-key

---
# application-prod.yml
cycles:
  base-url: https://cycles.internal.example.com
  api-key: ${CYCLES_API_KEY}
  http:
    read-timeout: 10s
```

### Using environment variables

Every property can be set via environment variables using Spring Boot's relaxed binding:

| Property | Environment variable |
|---|---|
| `cycles.base-url` | `CYCLES_BASE_URL` |
| `cycles.api-key` | `CYCLES_API_KEY` |
| `cycles.tenant` | `CYCLES_TENANT` |
| `cycles.http.connect-timeout` | `CYCLES_HTTP_CONNECT_TIMEOUT` |
| `cycles.retry.max-attempts` | `CYCLES_RETRY_MAX_ATTEMPTS` |

## Next steps

- [Getting Started with the Spring Boot Starter](/getting-started-with-the-cycles-spring-boot-starter) — quick start guide
- [SpEL Expression Reference](/spel-expression-reference-for-cycles) — expression syntax
- [Custom Field Resolvers](/custom-field-resolvers-in-cycles) — dynamic Subject field resolution
- [Server Configuration Reference](/server-configuration-reference-for-cycles) — server-side properties
