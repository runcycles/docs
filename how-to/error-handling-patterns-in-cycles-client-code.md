# Error Handling Patterns in Cycles Client Code

This guide covers practical patterns for handling Cycles errors in your Spring application — both with the `@Cycles` annotation and with the programmatic `CyclesClient`.

## CyclesProtocolException

When the `@Cycles` annotation encounters a problem, it throws `CyclesProtocolException`. This exception carries structured information about the failure:

```java
public class CyclesProtocolException extends RuntimeException {
    ErrorCode getErrorCode();     // Machine-readable error code
    String getReasonCode();       // String error code
    int getHttpStatus();          // HTTP status from the server
    Integer getRetryAfterMs();    // Suggested retry delay (nullable)

    // Convenience checks
    boolean isBudgetExceeded();
    boolean isOverdraftLimitExceeded();
    boolean isDebtOutstanding();
    boolean isReservationExpired();
    boolean isReservationFinalized();
    boolean isIdempotencyMismatch();
    boolean isUnitMismatch();
}
```

## Handling DENY decisions

When a reservation is denied, the annotated method does not execute. A `CyclesProtocolException` is thrown instead.

### Basic catch

```java
try {
    return llmService.summarize(text);
} catch (CyclesProtocolException e) {
    if (e.isBudgetExceeded()) {
        return "Service temporarily unavailable due to budget limits.";
    }
    throw e; // Re-throw unexpected errors
}
```

### With retry delay

The server may include a `retryAfterMs` hint suggesting when budget might become available:

```java
try {
    return llmService.summarize(text);
} catch (CyclesProtocolException e) {
    if (e.isBudgetExceeded() && e.getRetryAfterMs() != null) {
        scheduleRetry(text, e.getRetryAfterMs());
        return "Request queued. Retrying in " + e.getRetryAfterMs() + "ms.";
    }
    if (e.isBudgetExceeded()) {
        return fallbackSummary(text);
    }
    throw e;
}
```

### Degradation patterns

```java
try {
    return premiumService.analyze(data);  // Uses GPT-4o, high cost
} catch (CyclesProtocolException e) {
    if (e.isBudgetExceeded()) {
        // Downgrade to cheaper model
        return basicService.analyze(data);  // Uses GPT-4o-mini, lower cost
    }
    throw e;
}
```

## Handling debt and overdraft errors

### DEBT_OUTSTANDING

A scope has unpaid debt. New reservations are blocked until the debt is resolved.

```java
try {
    return service.process(input);
} catch (CyclesProtocolException e) {
    if (e.isDebtOutstanding()) {
        log.warn("Scope has outstanding debt. Notifying operator.");
        alertOperator("Budget debt detected. Funding required.");
        return "Service paused pending budget review.";
    }
    throw e;
}
```

### OVERDRAFT_LIMIT_EXCEEDED

The scope's debt has exceeded its overdraft limit.

```java
try {
    return service.process(input);
} catch (CyclesProtocolException e) {
    if (e.isOverdraftLimitExceeded()) {
        log.error("Overdraft limit exceeded. Scope is blocked.");
        return "Budget limit reached. Please contact support.";
    }
    throw e;
}
```

## Handling expired reservations

If a method takes longer than the reservation TTL plus grace period, the commit will fail with `RESERVATION_EXPIRED`. The starter handles heartbeat extensions automatically, but network issues can prevent extensions.

```java
try {
    return longRunningService.process(data);
} catch (CyclesProtocolException e) {
    if (e.isReservationExpired()) {
        log.warn("Reservation expired during processing. "
            + "Consider increasing ttlMs or checking network connectivity.");
        // The work already ran — record the usage as an event
        recordAsEvent(data);
        return result;
    }
    throw e;
}
```

## Spring @ExceptionHandler

For REST controllers, use a global exception handler:

```java
@RestControllerAdvice
public class CyclesExceptionHandler {

    @ExceptionHandler(CyclesProtocolException.class)
    public ResponseEntity<Map<String, Object>> handleCyclesError(
            CyclesProtocolException e) {

        if (e.isBudgetExceeded()) {
            return ResponseEntity.status(429)
                .header("Retry-After",
                    String.valueOf(e.getRetryAfterMs() != null
                        ? e.getRetryAfterMs() / 1000 : 60))
                .body(Map.of(
                    "error", "budget_exceeded",
                    "message", "Budget limit reached. Please try again later."
                ));
        }

        if (e.isDebtOutstanding() || e.isOverdraftLimitExceeded()) {
            return ResponseEntity.status(503)
                .body(Map.of(
                    "error", "service_unavailable",
                    "message", "Service temporarily paused due to budget constraints."
                ));
        }

        // Unexpected Cycles errors
        return ResponseEntity.status(500)
            .body(Map.of(
                "error", "internal_error",
                "message", "An unexpected error occurred."
            ));
    }
}
```

## Programmatic client error handling

When using `CyclesClient` directly, errors come as response status codes rather than exceptions:

```java
CyclesResponse<Map<String, Object>> response = cyclesClient.createReservation(request);

if (response.is2xx()) {
    String decision = (String) response.getBody().get("decision");
    if ("DENY".equals(decision)) {
        // Budget insufficient
        return handleDeny(response.getBody());
    }
    // Proceed with work
} else if (response.is5xx() || response.isTransportError()) {
    // Server error or network issue — retry
    log.warn("Cycles server error: {}", response.getErrorMessage());
    return retryOrFallback();
} else {
    // Client error (4xx) — do not retry
    log.error("Cycles client error: status={}, error={}",
        response.getStatus(), response.getErrorMessage());
    throw new RuntimeException("Cycles request failed: " + response.getErrorMessage());
}
```

## Transient vs non-transient errors

| Error | Retryable? | Action |
|---|---|---|
| `BUDGET_EXCEEDED` (409) | Maybe | Budget may free up after other reservations commit. Retry with backoff or degrade. |
| `DEBT_OUTSTANDING` (409) | Wait | Requires operator to fund the scope. Retry after funding. |
| `OVERDRAFT_LIMIT_EXCEEDED` (409) | Wait | Requires operator intervention. |
| `RESERVATION_EXPIRED` (410) | No | Create a new reservation or record as event. |
| `RESERVATION_FINALIZED` (409) | No | Reservation already settled. No action needed. |
| `IDEMPOTENCY_MISMATCH` (409) | No | Fix the idempotency key or payload. |
| `UNIT_MISMATCH` (400) | No | Fix the unit in your request. |
| `INVALID_REQUEST` (400) | No | Fix the request payload. |
| `UNAUTHORIZED` (401) | No | Fix the API key. |
| `FORBIDDEN` (403) | No | Fix the tenant configuration. |
| `NOT_FOUND` (404) | No | Check the reservation ID. |
| `INTERNAL_ERROR` (500) | Yes | Retry with exponential backoff. |
| Transport error | Yes | Retry with exponential backoff. |

## Error handling checklist

1. **Always catch `CyclesProtocolException`** at the boundary where user-facing behavior is determined
2. **Check `retryAfterMs`** before implementing your own retry delay
3. **Distinguish between DENY and server errors** — DENY means the system is working correctly, server errors mean something is wrong
4. **Log the error code and HTTP status** for debugging
5. **Never swallow errors silently** — at minimum, log them
6. **Handle RESERVATION_EXPIRED** by recording usage as an event if the work already completed
7. **Use `@ExceptionHandler`** in REST controllers for consistent API error responses

## Next steps

- [Error Codes and Error Handling](/error-codes-and-error-handling-in-cycles) — protocol error code reference
- [Degradation Paths](/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — strategies for handling budget constraints
- [Using the Client Programmatically](/using-the-cycles-client-programmatically) — direct client usage patterns
