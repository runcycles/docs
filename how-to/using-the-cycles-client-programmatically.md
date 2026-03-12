# Using the Cycles Client Programmatically

The `@Cycles` annotation handles most use cases automatically. But sometimes you need direct control — building requests manually, managing the lifecycle yourself, or calling endpoints that the annotation does not cover.

The `CyclesClient` interface provides programmatic access to every Cycles protocol endpoint.

## Getting the client

If you are using the Spring Boot Starter, `CyclesClient` is auto-configured and available for injection:

```java
@Service
public class BudgetService {

    private final CyclesClient cyclesClient;

    public BudgetService(CyclesClient cyclesClient) {
        this.cyclesClient = cyclesClient;
    }
}
```

## The CyclesClient interface

```java
public interface CyclesClient {
    // Core lifecycle
    CyclesResponse<Map<String, Object>> createReservation(Object body);
    CyclesResponse<Map<String, Object>> commitReservation(String reservationId, Object body);
    CyclesResponse<Map<String, Object>> releaseReservation(String reservationId, Object body);
    CyclesResponse<Map<String, Object>> extendReservation(String reservationId, Object body);

    // Preflight decision
    CyclesResponse<Map<String, Object>> decide(Object body);

    // Query
    CyclesResponse<Map<String, Object>> listReservations(Map<String, String> queryParams);
    CyclesResponse<Map<String, Object>> getReservation(String reservationId);
    CyclesResponse<Map<String, Object>> getBalances(Map<String, String> queryParams);

    // Direct debit
    CyclesResponse<Map<String, Object>> createEvent(Object body);
}
```

Each method also has a typed overload that accepts a request DTO and calls `.toMap()` internally.

## Creating a reservation

```java
ReservationCreateRequest request = ReservationCreateRequest.builder()
    .idempotencyKey(UUID.randomUUID().toString())
    .subject(Subject.builder()
        .tenant("acme")
        .workspace("production")
        .app("chatbot")
        .build())
    .action(new Action("llm.completion", "gpt-4o", null))
    .estimate(new Amount(Unit.USD_MICROCENTS, 5000L))
    .ttlMs(60000L)
    .overagePolicy(CommitOveragePolicy.REJECT)
    .build();

CyclesResponse<Map<String, Object>> response = cyclesClient.createReservation(request);

if (!response.is2xx()) {
    // Handle error
    throw new RuntimeException("Reservation failed: " + response.getErrorMessage());
}

Map<String, Object> body = response.getBody();
String reservationId = (String) body.get("reservation_id");
String decision = (String) body.get("decision");

// For non-dry-run reservations, insufficient budget returns 409 (not decision=DENY).
// decision=DENY in a 2xx response only occurs when dry_run=true.

// Proceed with work...
```

## Committing actual usage

```java
CyclesMetrics metrics = new CyclesMetrics();
metrics.setTokensInput(150);
metrics.setTokensOutput(80);
metrics.setLatencyMs(320);
metrics.setModelVersion("gpt-4o-2024-08-06");

CommitRequest commitRequest = CommitRequest.builder()
    .idempotencyKey("commit-" + UUID.randomUUID())
    .actual(new Amount(Unit.USD_MICROCENTS, 3200L))
    .metrics(metrics)
    .metadata(Map.of("request_id", "req-abc-123"))
    .build();

CyclesResponse<Map<String, Object>> commitResponse =
    cyclesClient.commitReservation(reservationId, commitRequest);
```

## Releasing a reservation

If work is cancelled or fails before producing any usage:

```java
ReleaseRequest releaseRequest = ReleaseRequest.builder()
    .idempotencyKey("release-" + UUID.randomUUID())
    .reason("Task cancelled by user")
    .build();

cyclesClient.releaseReservation(reservationId, releaseRequest);
```

## Full lifecycle example

```java
@Service
public class DocumentProcessor {

    private final CyclesClient cyclesClient;

    public DocumentProcessor(CyclesClient cyclesClient) {
        this.cyclesClient = cyclesClient;
    }

    public String processDocument(String docId, String content) {
        String idempotencyKey = "doc-" + docId;
        int estimatedTokens = content.length() / 4;

        // 1. Reserve
        ReservationCreateRequest reservation = ReservationCreateRequest.builder()
            .idempotencyKey(idempotencyKey)
            .subject(Subject.builder()
                .tenant("acme")
                .workspace("production")
                .app("doc-processor")
                .build())
            .action(new Action("llm.completion", "gpt-4o", null))
            .estimate(new Amount(Unit.USD_MICROCENTS, (long) estimatedTokens * 10))
            .ttlMs(120000L)
            .overagePolicy(CommitOveragePolicy.ALLOW_IF_AVAILABLE)
            .build();

        CyclesResponse<Map<String, Object>> reserveResponse =
            cyclesClient.createReservation(reservation);

        if (!reserveResponse.is2xx()) {
            throw new CyclesProtocolException("Reservation failed: "
                + reserveResponse.getErrorMessage());
        }

        String reservationId = (String) reserveResponse.getBody().get("reservation_id");
        // For non-dry-run reservations, a 2xx response means decision is ALLOW or ALLOW_WITH_CAPS.
        // Insufficient budget returns 409 (handled above by !is2xx check).

        // 2. Execute
        try {
            String result = callLlm(content);

            // 3. Commit
            int actualTokens = countTokens(result);
            CyclesMetrics commitMetrics = new CyclesMetrics();
            commitMetrics.setTokensInput(estimatedTokens);
            commitMetrics.setTokensOutput(actualTokens);

            CommitRequest commit = CommitRequest.builder()
                .idempotencyKey("commit-" + idempotencyKey)
                .actual(new Amount(Unit.USD_MICROCENTS, (long) actualTokens * 10))
                .metrics(commitMetrics)
                .build();

            cyclesClient.commitReservation(reservationId, commit);
            return result;

        } catch (Exception e) {
            // 4. Release on failure
            cyclesClient.releaseReservation(reservationId,
                ReleaseRequest.builder()
                    .idempotencyKey("release-" + idempotencyKey)
                    .reason("Processing failed: " + e.getMessage())
                    .build());
            throw e;
        }
    }
}
```

## Preflight decision check

Check budget availability without creating a reservation:

```java
DecisionRequest decisionRequest = DecisionRequest.builder()
    .idempotencyKey("decide-" + UUID.randomUUID())
    .subject(Subject.builder()
        .tenant("acme")
        .workspace("production")
        .build())
    .action(new Action("llm.completion", "gpt-4o", null))
    .estimate(new Amount(Unit.USD_MICROCENTS, 50000L))
    .build();

CyclesResponse<Map<String, Object>> decisionResponse = cyclesClient.decide(decisionRequest);
String decision = (String) decisionResponse.getBody().get("decision");

if ("DENY".equals(decision)) {
    // Show "budget low" warning in UI
}
```

## Querying balances

```java
Map<String, String> params = Map.of(
    "tenant", "acme",
    "workspace", "production"
);

CyclesResponse<Map<String, Object>> balanceResponse = cyclesClient.getBalances(params);
List<Map<String, Object>> balances =
    (List<Map<String, Object>>) balanceResponse.getBody().get("balances");

for (Map<String, Object> balance : balances) {
    String scope = (String) balance.get("scope");
    Number allocated = (Number) balance.get("allocated");
    Number spent = (Number) balance.get("spent");
    Number reserved = (Number) balance.get("reserved");
    System.out.printf("Scope: %s, allocated: %d, spent: %d, reserved: %d%n",
        scope, allocated.longValue(), spent.longValue(), reserved.longValue());
}
```

## Listing reservations

```java
Map<String, String> params = Map.of(
    "tenant", "acme",
    "status", "ACTIVE",
    "limit", "20"
);

CyclesResponse<Map<String, Object>> listResponse =
    cyclesClient.listReservations(params);
```

## Recording events (direct debit)

For post-hoc accounting without a reservation:

```java
EventCreateRequest event = EventCreateRequest.builder()
    .idempotencyKey("evt-" + UUID.randomUUID())
    .subject(Subject.builder()
        .tenant("acme")
        .workspace("production")
        .build())
    .action(new Action("search.api", "google-search", null))
    .actual(new Amount(Unit.USD_MICROCENTS, 1200L))
    .build();

cyclesClient.createEvent(event);
```

## Using raw maps instead of DTOs

If you prefer working with maps directly:

```java
Map<String, Object> body = Map.of(
    "idempotency_key", UUID.randomUUID().toString(),
    "subject", Map.of("tenant", "acme", "workspace", "production"),
    "action", Map.of("kind", "llm.completion", "name", "gpt-4o"),
    "estimate", Map.of("amount", 5000, "unit", "USD_MICROCENTS")
);

CyclesResponse<Map<String, Object>> response = cyclesClient.createReservation(body);
```

## CyclesResponse

All client methods return `CyclesResponse<Map<String, Object>>`:

```java
CyclesResponse<Map<String, Object>> response = cyclesClient.createReservation(request);

response.is2xx();           // true if HTTP 2xx
response.is5xx();           // true if HTTP 5xx
response.isTransportError();// true if connection failed
response.getStatus();       // HTTP status code
response.getBody();         // parsed JSON body as Map
response.getErrorMessage(); // error message (if error)
```

## When to use programmatic vs annotation

| Use case | Approach |
|---|---|
| Wrapping a single method call in a budget lifecycle | `@Cycles` annotation |
| Managing multiple reservations in a workflow | Programmatic `CyclesClient` |
| Querying balances or listing reservations | Programmatic `CyclesClient` |
| Preflight decisions for UI routing | Programmatic `CyclesClient` |
| Recording events without reservations | Programmatic `CyclesClient` |
| Fine-grained error handling per step | Programmatic `CyclesClient` |

## Working example in the demo app

The demo application includes a complete working implementation of programmatic client usage:

- **`ProgrammaticClientService.java`** (`cycles-demo-client-java-spring/src/main/java/io/runcycles/demo/client/spring/service/ProgrammaticClientService.java`) — Demonstrates the full reserve → commit lifecycle, reserve → release (cancellation), preflight `decide()`, balance queries, and reservation listing using typed DTOs.
- **`EventService.java`** (`cycles-demo-client-java-spring/src/main/java/io/runcycles/demo/client/spring/service/EventService.java`) — Demonstrates `createEvent()` for direct debit accounting without a reservation.

Run the demo with `mvn spring-boot:run` and use the `/api/demo/client/*` and `/api/demo/events/*` endpoints to see these in action.

## Next steps

- [Getting Started with the Spring Boot Starter](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — annotation-based approach
- [API Reference](/protocol/api-reference-for-the-cycles-protocol) — full endpoint documentation
- [Error Handling Patterns](/how-to/error-handling-patterns-in-cycles-client-code) — handling exceptions in client code
