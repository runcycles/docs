# Error Handling Patterns in Cycles Client Code

This guide covers practical patterns for handling Cycles errors in your application — both with the decorator/annotation and with the programmatic client.

For Python-specific patterns (exception hierarchy, FastAPI integration), see [Error Handling in Python](/how-to/error-handling-patterns-in-python).

## Protocol error structure

Both the Python and Java clients expose structured error information when the server returns a protocol-level error.

### Python — CyclesProtocolError

```python
from runcycles import CyclesProtocolError

# Available attributes:
e.status           # HTTP status code (e.g. 409)
e.error_code       # Machine-readable error code (e.g. "BUDGET_EXCEEDED")
e.reason_code      # Reason code string
e.retry_after_ms   # Suggested retry delay in ms (or None)
e.request_id       # Server request ID
e.details          # Additional error details dict

# Convenience checks:
e.is_budget_exceeded()
e.is_overdraft_limit_exceeded()
e.is_debt_outstanding()
e.is_reservation_expired()
e.is_reservation_finalized()
e.is_idempotency_mismatch()
e.is_unit_mismatch()
e.is_retryable()
```

### Java — CyclesProtocolException

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

When a reservation is denied, the decorated function / annotated method does not execute. An exception is thrown instead.

### Python

```python
from runcycles import cycles, BudgetExceededError, CyclesProtocolError

@cycles(estimate=1000)
def summarize(text: str) -> str:
    return call_llm(text)

try:
    result = summarize(text)
except BudgetExceededError:
    result = "Service temporarily unavailable due to budget limits."
except CyclesProtocolError as e:
    if e.retry_after_ms:
        schedule_retry(text, delay_ms=e.retry_after_ms)
        result = f"Request queued. Retrying in {e.retry_after_ms}ms."
    else:
        raise
```

### Java

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

## Degradation patterns

### Python

```python
from runcycles import BudgetExceededError

try:
    result = premium_service.analyze(data)   # GPT-4o, high cost
except BudgetExceededError:
    result = basic_service.analyze(data)     # GPT-4o-mini, lower cost
```

### Java

```java
try {
    return premiumService.analyze(data);  // Uses GPT-4o, high cost
} catch (CyclesProtocolException e) {
    if (e.isBudgetExceeded()) {
        return basicService.analyze(data);  // Uses GPT-4o-mini, lower cost
    }
    throw e;
}
```

## Handling debt and overdraft errors

### DebtOutstandingError / DEBT_OUTSTANDING

A scope has unpaid debt. New reservations are blocked until the debt is resolved.

**Python:**

```python
from runcycles import DebtOutstandingError

try:
    result = process(input_data)
except DebtOutstandingError:
    logger.warning("Scope has outstanding debt. Notifying operator.")
    alert_operator("Budget debt detected. Funding required.")
    result = "Service paused pending budget review."
```

**Java:**

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

### OverdraftLimitExceededError / OVERDRAFT_LIMIT_EXCEEDED

The scope's debt has exceeded its overdraft limit.

**Python:**

```python
from runcycles import OverdraftLimitExceededError

try:
    result = process(input_data)
except OverdraftLimitExceededError:
    logger.error("Overdraft limit exceeded. Scope is blocked.")
    result = "Budget limit reached. Please contact support."
```

**Java:**

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

If a function takes longer than the reservation TTL plus grace period, the commit will fail with `RESERVATION_EXPIRED`. Both clients handle heartbeat extensions automatically, but network issues can prevent extensions.

**Python:**

```python
from runcycles import ReservationExpiredError

try:
    result = long_running_process(data)
except ReservationExpiredError:
    logger.warning(
        "Reservation expired during processing. "
        "Consider increasing ttl_ms or checking network connectivity."
    )
    record_as_event(data)
```

**Java:**

```java
try {
    return longRunningService.process(data);
} catch (CyclesProtocolException e) {
    if (e.isReservationExpired()) {
        log.warn("Reservation expired during processing. "
            + "Consider increasing ttlMs or checking network connectivity.");
        recordAsEvent(data);
        return result;
    }
    throw e;
}
```

## Catching all Cycles errors

### Python

```python
from runcycles import (
    BudgetExceededError,
    DebtOutstandingError,
    OverdraftLimitExceededError,
    ReservationExpiredError,
    CyclesProtocolError,
    CyclesTransportError,
)

try:
    result = guarded_func()
except BudgetExceededError:
    result = fallback()
except DebtOutstandingError:
    alert_operator("Debt outstanding")
    result = "Service paused"
except OverdraftLimitExceededError:
    result = "Budget limit reached"
except ReservationExpiredError:
    record_as_event(data)
except CyclesProtocolError as e:
    logger.error("Protocol error: %s (code=%s, status=%d)", e, e.error_code, e.status)
    raise
except CyclesTransportError as e:
    logger.error("Transport error: %s (cause=%s)", e, e.cause)
    raise
```

### Java

```java
try {
    return annotatedMethod();
} catch (CyclesProtocolException e) {
    if (e.isBudgetExceeded()) {
        return fallback();
    } else if (e.isDebtOutstanding()) {
        alertOperator("Debt outstanding");
        return "Service paused";
    } else if (e.isOverdraftLimitExceeded()) {
        return "Budget limit reached";
    } else if (e.isReservationExpired()) {
        recordAsEvent(data);
        return result;
    } else {
        log.error("Protocol error: code={}, status={}", e.getReasonCode(), e.getHttpStatus());
        throw e;
    }
}
```

## Web framework error handlers

### Python (FastAPI)

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from runcycles import CyclesProtocolError

app = FastAPI()

@app.exception_handler(CyclesProtocolError)
async def cycles_error_handler(request: Request, exc: CyclesProtocolError):
    if exc.is_budget_exceeded():
        retry_after = exc.retry_after_ms // 1000 if exc.retry_after_ms else 60
        return JSONResponse(
            status_code=429,
            content={"error": "budget_exceeded", "message": "Budget limit reached."},
            headers={"Retry-After": str(retry_after)},
        )

    if exc.is_debt_outstanding() or exc.is_overdraft_limit_exceeded():
        return JSONResponse(
            status_code=503,
            content={"error": "service_unavailable", "message": "Service paused due to budget constraints."},
        )

    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An unexpected error occurred."},
    )
```

### Java (Spring @ExceptionHandler)

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

        return ResponseEntity.status(500)
            .body(Map.of(
                "error", "internal_error",
                "message", "An unexpected error occurred."
            ));
    }
}
```

## Programmatic client error handling

When using the client directly, errors come as response status codes rather than exceptions.

### Python

```python
from runcycles import CyclesClient

with CyclesClient(config) as client:
    response = client.create_reservation(request)

    if response.is_success:
        reservation_id = response.get_body_attribute("reservation_id")
        # Proceed with work
    elif response.is_server_error:
        # Server error — retry with backoff
        logger.warning("Cycles server error: %s", response.error_message)
    elif response.is_transport_error:
        # Network failure — retry with backoff
        logger.warning("Transport error: %s", response.error_message)
    else:
        # Client error (4xx) — do not retry
        # 409 = budget exceeded, debt outstanding, overdraft limit exceeded
        # 400 = invalid request, unit mismatch
        # 410 = reservation expired
        logger.error(
            "Cycles client error: status=%d, error=%s",
            response.status, response.error_message,
        )
```

### Java

```java
CyclesResponse<Map<String, Object>> response = cyclesClient.createReservation(request);

if (response.is2xx()) {
    // For non-dry-run reservations, a 2xx response means ALLOW or ALLOW_WITH_CAPS.
    // Insufficient budget returns 409 (handled below by the else branch).
    // Proceed with work
} else if (response.is5xx() || response.isTransportError()) {
    // Server error or network issue — retry
    log.warn("Cycles server error: {}", response.getErrorMessage());
    return retryOrFallback();
} else {
    // Client error (4xx) — do not retry
    // 409 = budget exceeded, debt outstanding, overdraft limit exceeded
    // 400 = invalid request, unit mismatch
    // 410 = reservation expired
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

In Python, use `e.is_retryable()` to check programmatically — it returns `True` for `INTERNAL_ERROR`, `UNKNOWN`, and any 5xx status.

## Error handling checklist

1. **Always catch protocol errors** (`CyclesProtocolError` / `CyclesProtocolException`) at the boundary where user-facing behavior is determined
2. **Use specific subclasses** (`BudgetExceededError`, `DebtOutstandingError`, etc.) for precise handling in Python
3. **Check `retry_after_ms`** before implementing your own retry delay
4. **Distinguish between DENY and server errors** — DENY means the system is working correctly, server errors mean something is wrong
5. **Log `error_code` and `status`** for debugging
6. **Never swallow errors silently** — at minimum, log them
7. **Handle `RESERVATION_EXPIRED`** by recording usage as an event if the work already completed
8. **Register a global exception handler** in web frameworks for consistent API error responses

## Next steps

- [Error Handling in Python](/how-to/error-handling-patterns-in-python) — Python exception hierarchy, transport errors, and FastAPI patterns
- [Error Codes and Error Handling](/protocol/error-codes-and-error-handling-in-cycles) — protocol error code reference
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — strategies for handling budget constraints
- [Using the Client Programmatically](/how-to/using-the-cycles-client-programmatically) — direct client usage patterns
