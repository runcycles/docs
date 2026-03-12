# Getting Started with the Cycles Spring Boot Starter

The Cycles Spring Boot Starter provides a declarative way to add budget enforcement to any Spring application.

Instead of manually calling the Cycles API for every reservation, commit, and release, the starter provides an `@Cycles` annotation that handles the full lifecycle automatically.

## What the starter does

The starter wraps any annotated method in a reserve → execute → commit lifecycle:

1. **Before the method runs:** evaluates the estimate, creates a reservation, and checks the decision
2. **While the method runs:** maintains the reservation with automatic heartbeat extensions
3. **After the method returns:** commits actual usage and releases any unused remainder
4. **If the method throws:** releases the reservation to return budget to the pool

All of this happens transparently through Spring AOP.

## Try the demo app first

The fastest way to see the starter in action is to run the included demo application. It requires a running Cycles stack (see [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack)).

```bash
git clone https://github.com/runcycles/cycles-spring-boot-starter.git
cd cycles-spring-boot-starter/cycles-demo-client-java-spring
```

Edit the file `cycles-demo-client-java-spring/src/main/resources/application.yml` and set your API key (the one from the deployment guide):

```yaml
cycles:
  api-key: cyc_live_...    # paste your key here
  base-url: http://localhost:7878
```

Run the demo:

```bash
mvn spring-boot:run
```

The demo app starts on port 7955. Hit `GET http://localhost:7955/api/demo/index` for a full listing of all available endpoints.

### What the demo covers

The demo app includes working examples for every major feature area:

**Annotation-based (`/api/llm/*`)**
- `@Cycles` with SpEL estimate/actual, `CyclesContextHolder` for reading reservation context, `CyclesMetrics` for reporting token counts and latency, and `commitMetadata` for audit data

**Annotation variations (`/api/demo/annotation/*`)**
- `unit=TOKENS` with `actionTags` — `POST /api/demo/annotation/tokens`
- `unit=CREDITS` with `workflow`, `agent`, and custom `dimensions` — `POST /api/demo/annotation/credits`
- `overagePolicy=ALLOW_WITH_OVERDRAFT` — `POST /api/demo/annotation/overdraft`
- Custom `ttlMs` and `gracePeriodMs` — `POST /api/demo/annotation/custom-ttl`
- `dryRun=true` (shadow-mode evaluation) — `POST /api/demo/annotation/dry-run`

**Programmatic CyclesClient (`/api/demo/client/*`)**
- Full reserve → commit lifecycle — `POST /api/demo/client/reserve-commit`
- Reserve → release (cancellation) — `POST /api/demo/client/reserve-release`
- Preflight decision check — `POST /api/demo/client/decide`
- Balance queries — `GET /api/demo/client/balances`
- Reservation listing — `GET /api/demo/client/reservations`

**Standalone events (`/api/demo/events/*`)**
- Direct debit without reservation — `POST /api/demo/events/record`

**Error handling**
- Global `@RestControllerAdvice` for `CyclesProtocolException` with structured JSON error responses

### Demo app source files

| File | What it demonstrates |
|---|---|
| `service/LlmService.java` | `@Cycles` annotation, `CyclesContextHolder`, `CyclesMetrics`, `commitMetadata` |
| `service/AnnotationShowcaseService.java` | Annotation attribute variations (units, TTL, overdraft, dry-run, dimensions) |
| `service/ProgrammaticClientService.java` | Direct `CyclesClient` usage for the full reservation lifecycle |
| `service/EventService.java` | Standalone events via `CyclesClient.createEvent()` |
| `error/CyclesExceptionHandler.java` | Global error handling for `CyclesProtocolException` |
| `resolvers/CyclesTenantResolver.java` | Dynamic tenant resolution via `CyclesFieldResolver` |
| `controller/DemoController.java` | REST endpoints wiring all services at `/api/demo/*` |
| `controller/LlmController.java` | LLM endpoints with budget error handling |

All demo source files are under `cycles-demo-client-java-spring/src/main/java/io/runcycles/demo/client/spring/`.

## Configuration

Add the starter dependency and configure the connection in your project's `application.yml`:

```yaml
cycles:
  base-url: https://your-cycles-server.example.com
  api-key: your-api-key
  tenant: acme
  workspace: production
  app: support-bot
```

These defaults apply to all `@Cycles`-annotated methods unless overridden per method.

### Optional configuration

```yaml
cycles:
  http:
    connect-timeout: 2s
    read-timeout: 5s
  retry:
    enabled: true
    max-attempts: 5
    initial-delay: 500ms
    multiplier: 2.0
    max-delay: 30s
```

## The @Cycles annotation

The `@Cycles` annotation is applied to methods:

```java
@Cycles("500")
public String summarize(String text) {
    return chatModel.call(text);
}
```

This reserves 500 units (default unit: USD_MICROCENTS) before `summarize()` runs, then commits actual usage afterward.

### SpEL expressions for dynamic estimates

The estimate can use Spring Expression Language to compute cost from method arguments:

```java
@Cycles("#tokens * 10")
public String generate(int tokens) {
    return chatModel.call(prompt, tokens);
}
```

The expression is evaluated before the method runs, using method parameters as variables.

### Specifying actual cost

By default, the estimate is used as the actual cost at commit time. To calculate actual cost from the return value:

```java
@Cycles(estimate = "5000", actual = "#result.usage.totalTokens * 8")
public ChatResponse chat(String prompt) {
    return chatModel.call(prompt);
}
```

The `actual` expression is evaluated after the method returns, with `#result` bound to the return value.

## Annotation attributes

### Subject fields

Override the defaults from configuration:

```java
@Cycles(value = "1000",
         tenant = "acme",
         workspace = "production",
         app = "support-bot",
         workflow = "refund-assistant",
         agent = "planner",
         toolset = "search-tools")
```

### Action identity

```java
@Cycles(value = "1000",
         actionKind = "llm.completion",
         actionName = "openai:gpt-4o-mini",
         actionTags = {"prod", "customer-facing"})
```

If not specified, `actionKind` defaults to the declaring class name and `actionName` defaults to the method name.

### Unit

```java
@Cycles(value = "2500", unit = "TOKENS")
```

Supported units: `USD_MICROCENTS` (default), `TOKENS`, `CREDITS`, `RISK_POINTS`.

### TTL and grace period

```java
@Cycles(value = "1000", ttlMs = 30000, gracePeriodMs = 10000)
```

Default TTL is 60 seconds. The starter automatically sends heartbeat extensions at `ttlMs / 2` intervals.

### Overage policy

```java
@Cycles(value = "1000", overagePolicy = "ALLOW_IF_AVAILABLE")
```

Options: `REJECT` (default), `ALLOW_IF_AVAILABLE`, `ALLOW_WITH_OVERDRAFT`.

### Dry run (shadow mode)

```java
@Cycles(value = "1000", dryRun = true)
```

Evaluates the reservation without actually holding budget. Useful for shadow-mode rollouts.

### Custom dimensions

```java
@Cycles(value = "1000", dimensions = {"cost_center=engineering", "run=run-12345"})
```

## Accessing reservation context at runtime

Inside an annotated method, the current reservation context is available via `CyclesContextHolder`:

```java
@Cycles("1000")
public String process(String input) {
    CyclesReservationContext ctx = CyclesContextHolder.get();

    // Check reservation details
    String reservationId = ctx.getReservationId();
    Decision decision = ctx.getDecision();

    // Check caps (if ALLOW_WITH_CAPS)
    if (ctx.hasCaps()) {
        Caps caps = ctx.getCaps();
        Integer maxTokens = caps.getMaxTokens();
        if (!caps.isToolAllowed("web.search")) {
            // skip web search
        }
    }

    // Check expiration
    if (ctx.isExpiringSoon(5000)) {
        // wrap up quickly
    }

    // Attach metrics for the commit
    CyclesMetrics metrics = new CyclesMetrics();
    metrics.setTokensInput(150);
    metrics.setTokensOutput(80);
    metrics.setLatencyMs(320);
    metrics.setModelVersion("gpt-4o-mini-2024-07-18");
    ctx.setMetrics(metrics);

    // Attach metadata for audit
    ctx.setCommitMetadata(Map.of("request_id", "req-abc-123"));

    return chatModel.call(input);
}
```

## Decision handling

When the reservation decision comes back, the starter handles each case:

### ALLOW

The method runs normally.

### ALLOW_WITH_CAPS

The method runs, and a warning is logged. Caps are available through `CyclesContextHolder` for the method to inspect and respect.

### DENY

The method does not run. A `CyclesProtocolException` is thrown with the reason code and optional `retryAfterMs` hint.

The caller can catch this to implement degradation:

```java
try {
    return service.summarize(text);
} catch (CyclesProtocolException e) {
    if (e.getRetryAfterMs() != null) {
        // retry after suggested delay
    }
    return fallbackResponse();
}
```

## Nesting prevention

The starter does not allow nested `@Cycles` annotations. If method A is annotated with `@Cycles` and calls method B which is also annotated, an `IllegalStateException` is thrown.

This prevents double-reservation and ensures each budget lifecycle is clear and isolated.

## Commit retry

If the commit fails due to a transient error (network issue, 5xx response), the starter can retry automatically.

The retry engine is configurable and extensible. The default implementation uses exponential backoff based on the retry configuration.

Custom retry strategies can be provided by implementing the `CommitRetryEngine` interface.

## Lifecycle summary

For each `@Cycles`-annotated method call:

1. Estimate is evaluated (SpEL expression or fixed value)
2. Reservation is created on the Cycles server
3. Decision is checked (ALLOW / ALLOW_WITH_CAPS / DENY)
4. If DENY: throw exception, method does not run
5. Heartbeat extension is scheduled (background thread)
6. Method executes
7. Actual cost is evaluated (SpEL expression or estimate)
8. Commit is sent with actual amount and optional metrics
9. Heartbeat is cancelled
10. If method threw: reservation is released instead of committed

## Summary

The Cycles Spring Boot Starter turns budget enforcement into a single annotation:

- `@Cycles("estimate")` wraps any method in a reserve → execute → commit lifecycle
- SpEL expressions provide dynamic cost estimation
- Heartbeat extensions keep reservations alive for long-running operations
- Caps, metrics, and metadata are accessible through `CyclesContextHolder`
- DENY decisions throw catchable exceptions for degradation handling
- Commit retry handles transient failures automatically

This gives Spring applications production-grade budget enforcement with minimal code changes.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
