# Testing with Cycles

This guide covers how to test code that uses the `@Cycles` annotation and the `CyclesClient` interface.

## Unit testing @Cycles-annotated methods

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

## Mocking CyclesClient

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
        // Mock reservation response
        Map<String, Object> reserveBody = Map.of(
            "reservation_id", "res-123",
            "decision", "ALLOW",
            "expires_at_ms", System.currentTimeMillis() + 60000
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.ok(reserveBody));

        // Mock commit response
        Map<String, Object> commitBody = Map.of(
            "status", "COMMITTED"
        );
        when(cyclesClient.commitReservation(eq("res-123"), any()))
            .thenReturn(CyclesResponse.ok(commitBody));

        String result = processor.processDocument("doc-1", "content");

        assertNotNull(result);
        verify(cyclesClient).createReservation(any());
        verify(cyclesClient).commitReservation(eq("res-123"), any());
    }

    @Test
    void testBudgetDenied() {
        Map<String, Object> denyBody = Map.of(
            "decision", "DENY"
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.ok(denyBody));

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
            .thenReturn(CyclesResponse.ok(reserveBody));

        // Simulate a processing error
        doThrow(new RuntimeException("LLM error"))
            .when(mockLlm).call(any());

        assertThrows(RuntimeException.class,
            () -> processor.processDocument("doc-1", "content"));

        // Verify budget was released
        verify(cyclesClient).releaseReservation(eq("res-123"), any());
    }
}
```

## Integration testing with the @Cycles annotation

To test the full `@Cycles` lifecycle in a Spring context, you need to mock the `CyclesClient` bean so no real Cycles server is required:

```java
@SpringBootTest
class CyclesIntegrationTest {

    @MockBean
    private CyclesClient cyclesClient;

    @Autowired
    private LlmService llmService;

    @Test
    void testAnnotatedMethodWithAllow() {
        // Mock a successful reservation
        Map<String, Object> reserveBody = Map.of(
            "reservation_id", "res-test-001",
            "decision", "ALLOW",
            "expires_at_ms", System.currentTimeMillis() + 60000,
            "affected_scopes", List.of("tenant:test"),
            "scope_path", "tenant:test",
            "reserved", Map.of("amount", 5000, "unit", "USD_MICROCENTS")
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.ok(201, reserveBody));

        // Mock a successful commit
        Map<String, Object> commitBody = Map.of(
            "status", "COMMITTED",
            "charged", Map.of("amount", 3200, "unit", "USD_MICROCENTS")
        );
        when(cyclesClient.commitReservation(any(), any()))
            .thenReturn(CyclesResponse.ok(commitBody));

        // Call the annotated method — the aspect handles the lifecycle
        String result = llmService.summarize("test input");

        assertNotNull(result);
        verify(cyclesClient).createReservation(any());
        verify(cyclesClient).commitReservation(eq("res-test-001"), any());
    }

    @Test
    void testAnnotatedMethodWithDeny() {
        // Mock a deny response
        Map<String, Object> denyBody = Map.of(
            "decision", "DENY",
            "error", "BUDGET_EXCEEDED",
            "message", "Insufficient budget"
        );
        when(cyclesClient.createReservation(any()))
            .thenReturn(CyclesResponse.error(409, denyBody));

        assertThrows(CyclesProtocolException.class,
            () -> llmService.summarize("test input"));
    }
}
```

## Integration testing with a real Cycles server

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
        // This test requires a running Cycles server
        // connected to the Testcontainers Redis instance

        ReservationCreateRequest request = ReservationCreateRequest.builder()
            .idempotencyKey("integration-test-001")
            .subject(Subject.builder().tenant("test-tenant").build())
            .action(Action.builder().kind("test").name("integration").build())
            .estimate(new Amount(100, Unit.USD_MICROCENTS))
            .build();

        CyclesResponse<Map<String, Object>> response =
            cyclesClient.createReservation(request);

        assertTrue(response.is2xx());
    }
}
```

## Testing CyclesFieldResolver implementations

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

@Test
void testTenantResolverWhenEmpty() {
    RepositoryAccessService repoService = mock(RepositoryAccessService.class);
    when(repoService.findTenant()).thenReturn(Optional.empty());

    CyclesTenantResolver resolver = new CyclesTenantResolver();
    ReflectionTestUtils.setField(resolver, "repositoryAccessService", repoService);

    assertNull(resolver.resolve());
}
```

## Testing SpEL expressions

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

@Test
void testActualExpression() {
    CyclesExpressionEvaluator evaluator = new CyclesExpressionEvaluator();

    Method method = LlmService.class.getMethod("summarize", String.class);
    Object[] args = { "input text" };
    String result = "output with 20 chars";

    long actual = evaluator.evaluate("#result.length() * 5", method, args, result, null);
    assertEquals(100, actual);
}
```

## Testing error handling

Test that your code handles Cycles errors correctly:

```java
@Test
void testBudgetExceededHandling() {
    CyclesProtocolException ex = new CyclesProtocolException(
        "Budget exceeded",
        ErrorCode.BUDGET_EXCEEDED,
        "BUDGET_EXCEEDED",
        409,
        null
    );

    assertTrue(ex.isBudgetExceeded());
    assertFalse(ex.isReservationExpired());
    assertEquals(409, ex.getHttpStatus());
}

@Test
void testRetryAfterHandling() {
    CyclesProtocolException ex = new CyclesProtocolException(
        "Try again later",
        ErrorCode.BUDGET_EXCEEDED,
        "BUDGET_EXCEEDED",
        409,
        5000
    );

    assertEquals(5000, ex.getRetryAfterMs());
}
```

## Tips

- **Unit tests**: test business logic without Spring context — `@Cycles` has no effect
- **Mock CyclesClient**: use `@MockBean` in Spring tests to avoid needing a real server
- **Test both ALLOW and DENY paths**: ensure your code handles budget denial gracefully
- **Test error paths**: verify release is called when methods throw
- **Test SpEL expressions independently**: catch evaluation errors early
- **Use Testcontainers for E2E**: spin up Redis for realistic integration tests

## Next steps

- [Error Handling Patterns](/error-handling-patterns-in-cycles-client-code) — handling Cycles exceptions
- [Using the Client Programmatically](/using-the-cycles-client-programmatically) — direct client usage
- [SpEL Expression Reference](/spel-expression-reference-for-cycles) — expression syntax
