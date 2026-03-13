# Testing with Cycles

This guide covers how to test code that uses the `@cycles` decorator (Python) or the `@Cycles` annotation (Java) and the `CyclesClient` interface.

## Python

### Unit testing @cycles-decorated functions

The `@cycles` decorator requires a client to function. In a unit test, you can test business logic by calling the underlying function directly without the decorator, or by mocking the client.

For plain function logic (without budget enforcement), test the function directly:

```python
def test_business_logic():
    result = call_llm("some text")
    assert result == "expected output"
```

### Mocking CyclesClient with pytest

When testing code that uses `CyclesClient` programmatically, mock the client responses:

```python
from unittest.mock import MagicMock, ANY
from runcycles import CyclesClient, CyclesResponse
import pytest

def test_successful_processing():
    client = MagicMock(spec=CyclesClient)

    # Mock reservation response
    client.create_reservation.return_value = CyclesResponse.success(200, {
        "reservation_id": "res-123",
        "decision": "ALLOW",
        "expires_at_ms": 1709312345678,
    })

    # Mock commit response
    client.commit_reservation.return_value = CyclesResponse.success(200, {
        "status": "COMMITTED",
    })

    result = process_document(client, "doc-1", "content")

    assert result is not None
    client.create_reservation.assert_called_once()
    client.commit_reservation.assert_called_once()


def test_budget_denied():
    client = MagicMock(spec=CyclesClient)

    # Insufficient budget returns 409
    client.create_reservation.return_value = CyclesResponse.http_error(
        409, "Insufficient remaining balance",
        body={"error": "BUDGET_EXCEEDED", "message": "Insufficient remaining balance"},
    )

    result = process_document(client, "doc-1", "content")

    assert result == "Budget exhausted. Please try again later."
    client.commit_reservation.assert_not_called()


def test_release_on_failure():
    client = MagicMock(spec=CyclesClient)

    client.create_reservation.return_value = CyclesResponse.success(200, {
        "reservation_id": "res-123",
        "decision": "ALLOW",
    })

    with pytest.raises(RuntimeError):
        process_document_that_fails(client, "doc-1", "content")

    # Verify budget was released
    client.release_reservation.assert_called_once()
```

### Testing with pytest-httpx

For integration-style tests, use `pytest-httpx` to mock HTTP responses:

```python
from runcycles import CyclesClient, CyclesConfig, ReservationCreateRequest

def test_full_lifecycle(httpx_mock):
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:7878/v1/reservations",
        json={
            "reservation_id": "res-test-001",
            "decision": "ALLOW",
            "expires_at_ms": 1709312345678,
            "affected_scopes": ["tenant:test"],
        },
        status_code=200,
    )

    httpx_mock.add_response(
        method="POST",
        url="http://localhost:7878/v1/reservations/res-test-001/commit",
        json={"status": "COMMITTED"},
        status_code=200,
    )

    config = CyclesConfig(base_url="http://localhost:7878", api_key="test-key")
    with CyclesClient(config) as client:
        response = client.create_reservation(request)
        assert response.is_success
        assert response.get_body_attribute("reservation_id") == "res-test-001"
```

### Testing error handling

```python
from runcycles import BudgetExceededError, CyclesProtocolError

def test_budget_exceeded_handling():
    ex = BudgetExceededError(
        "Budget exceeded",
        status=409,
        error_code="BUDGET_EXCEEDED",
    )
    assert ex.is_budget_exceeded()
    assert not ex.is_reservation_expired()
    assert ex.status == 409

def test_retry_after_handling():
    ex = CyclesProtocolError(
        "Try again later",
        status=409,
        error_code="BUDGET_EXCEEDED",
        retry_after_ms=5000,
    )
    assert ex.retry_after_ms == 5000
```

### Testing async code

```python
import pytest
from runcycles import AsyncCyclesClient, CyclesConfig

@pytest.mark.asyncio
async def test_async_reservation(httpx_mock):
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:7878/v1/reservations",
        json={"reservation_id": "res-async-001", "decision": "ALLOW"},
        status_code=200,
    )

    config = CyclesConfig(base_url="http://localhost:7878", api_key="test-key")
    async with AsyncCyclesClient(config) as client:
        response = await client.create_reservation(request)
        assert response.is_success
```

## Java (Spring)

### Unit testing @Cycles-annotated methods

The `@Cycles` annotation is driven by Spring AOP. In a plain unit test (without Spring context), the annotation has no effect — the method runs normally without any reservation lifecycle.

This means you can unit test the method's business logic without Cycles getting involved:

```java
@Test
void testBusinessLogic() {
    LlmService service = new LlmService(mockChatModel);
    String result = service.summarize("some text");
    assertEquals("expected output", result);
}
```

No mocking of Cycles is needed for pure unit tests.

### Mocking CyclesClient

When testing code that uses `CyclesClient` programmatically, mock the client:

```java
@ExtendWith(MockitoExtension.class)
class DocumentProcessorTest {

    @Mock
    private CyclesClient cyclesClient;

    @InjectMocks
    private DocumentProcessor processor;

    @Test
    void testSuccessfulProcessing() {
        Map<String, Object> reserveBody = Map.of(
            "reservation_id", "res-123",
            "decision", "ALLOW",
            "expires_at_ms", System.currentTimeMillis() + 60000
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.success(200, reserveBody));

        Map<String, Object> commitBody = Map.of("status", "COMMITTED");
        when(cyclesClient.commitReservation(eq("res-123"), any()))
            .thenReturn(CyclesResponse.success(200, commitBody));

        String result = processor.processDocument("doc-1", "content");

        assertNotNull(result);
        verify(cyclesClient).createReservation(any());
        verify(cyclesClient).commitReservation(eq("res-123"), any());
    }

    @Test
    void testBudgetDenied() {
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.error(409, "BUDGET_EXCEEDED",
                "Insufficient remaining balance"));

        String result = processor.processDocument("doc-1", "content");

        assertEquals("Budget exhausted. Please try again later.", result);
        verify(cyclesClient, never()).commitReservation(any(), any());
    }

    @Test
    void testReleaseOnFailure() {
        Map<String, Object> reserveBody = Map.of(
            "reservation_id", "res-123",
            "decision", "ALLOW"
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.success(200, reserveBody));

        doThrow(new RuntimeException("LLM error"))
            .when(mockLlm).call(any());

        assertThrows(RuntimeException.class,
            () -> processor.processDocument("doc-1", "content"));

        verify(cyclesClient).releaseReservation(eq("res-123"), any());
    }
}
```

### Integration testing with the @Cycles annotation

To test the full `@Cycles` lifecycle in a Spring context, mock the `CyclesClient` bean:

```java
@SpringBootTest
class CyclesIntegrationTest {

    @MockBean
    private CyclesClient cyclesClient;

    @Autowired
    private LlmService llmService;

    @Test
    void testAnnotatedMethodWithAllow() {
        Map<String, Object> reserveBody = Map.of(
            "reservation_id", "res-test-001",
            "decision", "ALLOW",
            "expires_at_ms", System.currentTimeMillis() + 60000,
            "affected_scopes", List.of("tenant:test"),
            "scope_path", "tenant:test",
            "reserved", Map.of("amount", 5000, "unit", "USD_MICROCENTS")
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.success(200, reserveBody));

        Map<String, Object> commitBody = Map.of(
            "status", "COMMITTED",
            "charged", Map.of("amount", 3200, "unit", "USD_MICROCENTS")
        );
        when(cyclesClient.commitReservation(any(), any()))
            .thenReturn(CyclesResponse.success(200, commitBody));

        String result = llmService.summarize("test input");

        assertNotNull(result);
        verify(cyclesClient).createReservation(any());
        verify(cyclesClient).commitReservation(eq("res-test-001"), any());
    }

    @Test
    void testAnnotatedMethodWithDeny() {
        Map<String, Object> denyBody = Map.of(
            "decision", "DENY",
            "error", "BUDGET_EXCEEDED",
            "message", "Insufficient budget"
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.httpError(409, "Insufficient budget", denyBody));

        assertThrows(CyclesProtocolException.class,
            () -> llmService.summarize("test input"));
    }
}
```

### Integration testing with a real Cycles server

For end-to-end tests, use Testcontainers to spin up Redis and the Cycles server:

```java
@SpringBootTest
@Testcontainers
class FullIntegrationTest {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("cycles.base-url", () -> "http://localhost:7878");
        registry.add("cycles.api-key", () -> "test-key");
        registry.add("cycles.tenant", () -> "test-tenant");
    }

    @Autowired
    private CyclesClient cyclesClient;

    @Test
    void testFullLifecycle() {
        ReservationCreateRequest request = ReservationCreateRequest.builder()
            .idempotencyKey("integration-test-001")
            .subject(Subject.builder().tenant("test-tenant").build())
            .action(new Action("test", "integration", null))
            .estimate(new Amount(Unit.USD_MICROCENTS, 100L))
            .build();

        CyclesResponse<Map<String, Object>> response =
            cyclesClient.createReservation(request);

        assertTrue(response.is2xx());
    }
}
```

### Testing CyclesFieldResolver implementations

Test custom field resolvers directly:

```java
@Test
void testTenantResolver() {
    RepositoryAccessService repoService = mock(RepositoryAccessService.class);
    when(repoService.findTenant()).thenReturn(Optional.of("resolved-tenant"));

    CyclesTenantResolver resolver = new CyclesTenantResolver();
    ReflectionTestUtils.setField(resolver, "repositoryAccessService", repoService);

    assertEquals("resolved-tenant", resolver.resolve());
}
```

### Testing SpEL expressions

Test that your SpEL expressions evaluate correctly:

```java
@Test
void testEstimateExpression() {
    CyclesExpressionEvaluator evaluator = new CyclesExpressionEvaluator();

    Method method = LlmService.class.getMethod("generate", int.class);
    Object[] args = { 500 };

    long result = evaluator.evaluate("#p0 * 10", method, args, null, null);
    assertEquals(5000, result);
}
```

## Tips

- **Unit tests**: test business logic without the decorator/annotation — it has no effect when bypassed
- **Mock CyclesClient**: use Python `MagicMock` or Java `@MockBean` to avoid needing a real server
- **Test both ALLOW and DENY paths**: ensure your code handles budget denial gracefully
- **Test error paths**: verify release is called when functions/methods throw
- **Use HTTP mocking for integration tests**: `pytest-httpx` for Python, Testcontainers for Java
- **Python-specific**: use `pytest-httpx` for sync and `respx` for async HTTP mocking

## Next steps

- [Error Handling in Python](/how-to/error-handling-patterns-in-python) — Python exception handling patterns
- [Error Handling Patterns](/how-to/error-handling-patterns-in-cycles-client-code) — general error handling patterns
- [Using the Client Programmatically](/how-to/using-the-cycles-client-programmatically) — direct client usage
- [SpEL Expression Reference](/configuration/spel-expression-reference-for-cycles) — expression syntax (Java)
