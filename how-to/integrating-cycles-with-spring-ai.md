---
title: "Integrating Cycles with Spring AI"
description: "Guard Spring AI chat completions and tool calls with Cycles budget reservations using the @Cycles annotation. Includes cost estimation, caps awareness, streaming, and error handling."
---

# Integrating Cycles with Spring AI

This guide shows how to guard Spring AI chat completions and tool calls with Cycles budget reservations so that every LLM interaction is cost-controlled, caps-aware, and observable.

For strategic guidance on where to integrate, see [Budget Limits with Spring AI](/quickstart/how-to-add-hard-budget-limits-to-spring-ai-with-cycles).

## Prerequisites

Add the Cycles Spring Boot Starter to your project:

::: code-group
```xml [Maven]
<dependency>
    <groupId>io.runcycles</groupId>
    <artifactId>cycles-client-java-spring</artifactId>
    <version>0.2.0</version>
</dependency>
```
```groovy [Gradle]
implementation 'io.runcycles:cycles-client-java-spring:0.2.0'
```
:::

Configure the connection in `application.yml`:

```yaml
cycles:
  base-url: http://localhost:7878
  api-key: ${CYCLES_API_KEY}
  tenant: acme
  app: my-spring-ai-app
```

> **Need an API key?** Create one via the Admin Server — see [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack#step-3-create-an-api-key) or [API Key Management](/how-to/api-key-management-in-cycles).

::: tip 60-Second Quick Start
```java
import io.runcycles.client.java.spring.annotation.Cycles;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class ChatService {

    private final ChatClient chatClient;

    public ChatService(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    @Cycles(value = "#maxTokens * 15",
            actionKind = "llm.completion",
            actionName = "gpt-4o")
    public String chat(String prompt, int maxTokens) {
        return chatClient.prompt(prompt)
            .call()
            .content();
    }
}
```

That's it. Every call to `chat()` is now budget-guarded: Cycles reserves the estimated cost before execution, commits actual usage after, and throws `CyclesProtocolException` if the budget is exceeded.
:::

## Dynamic cost estimation

Use SpEL expressions to estimate cost from method parameters. The `value` (or `estimate`) attribute is evaluated before the method runs:

```java
// Estimate based on max tokens × price per token (in USD_MICROCENTS)
// GPT-4o: ~$2.50/1M input tokens = 25 microcents/token
@Cycles(value = "#maxTokens * 25",
        actionKind = "llm.completion",
        actionName = "gpt-4o")
public String generate(String prompt, int maxTokens) {
    return chatClient.prompt(prompt)
        .call()
        .content();
}

// Estimate from prompt length (rough token approximation)
@Cycles(value = "#prompt.length() / 4 * 25",
        actionKind = "llm.completion",
        actionName = "gpt-4o")
public String summarize(String prompt) {
    return chatClient.prompt(prompt)
        .call()
        .content();
}
```

See [SpEL Expression Reference](/configuration/spel-expression-reference-for-cycles) for all available expressions.

## Reporting actual usage

The `actual` attribute is evaluated after the method returns, using `#result` to reference the return value:

```java
@Cycles(value = "#maxTokens * 25",
        actual = "#result.length() / 4 * 25",
        actionKind = "llm.completion",
        actionName = "gpt-4o")
public String generate(String prompt, int maxTokens) {
    return chatClient.prompt(prompt)
        .call()
        .content();
}
```

For precise token counts, access the `ChatResponse` metadata and report via `CyclesMetrics`:

```java
@Cycles(value = "#maxTokens * 25",
        actionKind = "llm.completion",
        actionName = "gpt-4o")
public String generateWithMetrics(String prompt, int maxTokens) {
    long start = System.currentTimeMillis();

    ChatResponse response = chatClient.prompt(prompt)
        .call()
        .chatResponse();

    String content = response.getResult().getOutput().getText();

    // Report exact token usage via the reservation context
    CyclesReservationContext ctx = CyclesContextHolder.get();
    if (ctx != null) {
        Usage usage = response.getMetadata().getUsage();
        CyclesMetrics metrics = new CyclesMetrics();
        metrics.setTokensInput((int) usage.getPromptTokens());
        metrics.setTokensOutput((int) usage.getCompletionTokens());
        metrics.setLatencyMs((int) (System.currentTimeMillis() - start));
        metrics.setModelVersion("gpt-4o-2024-08-06");
        ctx.setMetrics(metrics);

        // Commit actual cost based on real token counts
        int actualCost = (int) (usage.getTotalTokens() * 25);
        ctx.setActual(actualCost);
    }

    return content;
}
```

## Respecting caps

When budget is running low, Cycles may return `ALLOW_WITH_CAPS` instead of a flat `ALLOW`. Caps tell you how to constrain the operation. Read them from the reservation context:

```java
@Cycles(value = "#maxTokens * 25",
        actionKind = "llm.completion",
        actionName = "gpt-4o")
public String capsAwareChat(String prompt, int maxTokens) {
    CyclesReservationContext ctx = CyclesContextHolder.get();

    // Respect token cap from budget authority
    int effectiveMaxTokens = maxTokens;
    if (ctx != null && ctx.hasCaps() && ctx.getCaps().getMaxTokens() != null) {
        effectiveMaxTokens = Math.min(maxTokens, ctx.getCaps().getMaxTokens());
    }

    return chatClient.prompt(prompt)
        .options(ChatOptions.builder()
            .maxTokens(effectiveMaxTokens)
            .build())
        .call()
        .content();
}
```

## Guarding tool calls

For Spring AI function callbacks, wrap the tool execution with `@Cycles` on a separate service bean:

```java
@Service
public class GuardedToolService {

    @Cycles(value = "500000",  // $0.005 per tool call
            actionKind = "tool.search",
            actionName = "web-search",
            toolset = "search-tools")
    public String webSearch(String query) {
        return searchApi.search(query);
    }

    @Cycles(value = "100000",  // $0.001 per DB query
            actionKind = "tool.database",
            actionName = "sql-query",
            toolset = "data-tools")
    public String queryDatabase(String sql) {
        return jdbcTemplate.queryForList(sql).toString();
    }
}
```

Then register these as Spring AI function callbacks:

```java
@Configuration
public class ToolConfig {

    @Bean
    public FunctionCallback webSearchTool(GuardedToolService tools) {
        return FunctionCallback.builder()
            .function("web_search", (String query) -> tools.webSearch(query))
            .description("Search the web")
            .inputType(String.class)
            .build();
    }
}
```

The `toolset` attribute scopes budget per tool category, so you can set different budgets for search tools vs. database tools via the Admin API.

## Streaming responses

For streaming, use the programmatic `CyclesClient` instead of the annotation, since the stream commits after completion:

```java
@Service
public class StreamingChatService {

    private final ChatClient chatClient;
    private final CyclesClient cyclesClient;

    @Autowired
    public StreamingChatService(ChatClient.Builder builder, CyclesClient cyclesClient) {
        this.chatClient = builder.build();
        this.cyclesClient = cyclesClient;
    }

    public Flux<String> streamChat(String prompt, int maxTokens) {
        // Reserve budget before streaming
        var reservation = cyclesClient.createReservation(
            ReservationCreateRequest.builder()
                .idempotencyKey(UUID.randomUUID().toString())
                .subject(Subject.builder().tenant("acme").build())
                .action(Action.builder().kind("llm.completion").name("gpt-4o").build())
                .estimate(Amount.builder().unit("USD_MICROCENTS").amount(maxTokens * 25L).build())
                .ttlMs(120000)
                .build()
        );

        if (!"ALLOW".equals(reservation.getDecision())) {
            throw new CyclesProtocolException("Budget denied: " + reservation.getDecision());
        }

        AtomicInteger tokenCount = new AtomicInteger();

        return chatClient.prompt(prompt)
            .stream()
            .content()
            .doOnNext(chunk -> tokenCount.addAndGet(chunk.length() / 4))
            .doOnComplete(() -> {
                // Commit actual usage
                cyclesClient.commitReservation(reservation.getReservationId(),
                    CommitRequest.builder()
                        .idempotencyKey(UUID.randomUUID().toString())
                        .actual(Amount.builder()
                            .unit("USD_MICROCENTS")
                            .amount(tokenCount.get() * 25L)
                            .build())
                        .build()
                );
            })
            .doOnError(err -> {
                // Release on failure
                cyclesClient.releaseReservation(reservation.getReservationId(),
                    ReleaseRequest.builder()
                        .idempotencyKey(UUID.randomUUID().toString())
                        .reason("stream_error: " + err.getMessage())
                        .build()
                );
            });
    }
}
```

## Agent loop budget control

For multi-step agent workflows, guard each iteration:

```java
@Service
public class AgentService {

    private final GuardedLlmService llm;

    public String runAgent(String task, int maxIterations) {
        String context = task;

        for (int i = 0; i < maxIterations; i++) {
            try {
                String response = llm.think(context, 2048);
                if (isComplete(response)) {
                    return response;
                }
                context = response;
            } catch (CyclesProtocolException e) {
                if (e.isBudgetExceeded()) {
                    return "Agent stopped: budget exhausted after " + i + " iterations.";
                }
                throw e;
            }
        }

        return "Agent reached max iterations.";
    }
}
```

Each call to `llm.think()` gets its own reservation. When budget runs out, Cycles denies the next reservation and the agent stops cleanly.

## Error handling

Catch `CyclesProtocolException` to degrade gracefully:

```java
@Service
public class ResilientChatService {

    private final GuardedLlmService premiumLlm;
    private final GuardedLlmService budgetLlm;

    @Autowired
    public ResilientChatService(GuardedLlmService premiumLlm, GuardedLlmService budgetLlm) {
        this.premiumLlm = premiumLlm;
        this.budgetLlm = budgetLlm;
    }

    public String chat(String prompt) {
        try {
            return premiumLlm.generate(prompt, 4096);     // GPT-4o
        } catch (CyclesProtocolException e) {
            if (e.isBudgetExceeded()) {
                return budgetLlm.generate(prompt, 1024);   // GPT-4o-mini fallback
            }
            if (e.isRetryable() && e.getRetryAfterMs() != null) {
                // Queue for later
                scheduleRetry(prompt, e.getRetryAfterMs());
                return "Request queued. Retrying shortly.";
            }
            throw e;
        }
    }
}
```

For global exception handling in a REST API:

```java
@ControllerAdvice
public class CyclesExceptionHandler {

    @ExceptionHandler(CyclesProtocolException.class)
    public ResponseEntity<Map<String, Object>> handleBudgetError(CyclesProtocolException e) {
        if (e.isBudgetExceeded()) {
            return ResponseEntity.status(429)
                .header("Retry-After", String.valueOf(e.getRetryAfterMs() != null ? e.getRetryAfterMs() / 1000 : 60))
                .body(Map.of("error", "budget_exceeded", "message", "Budget limit reached."));
        }
        return ResponseEntity.status(503)
            .body(Map.of("error", e.getReasonCode(), "message", e.getMessage()));
    }
}
```

## Production patterns

### Dry-run rollout

Start in shadow mode to measure budget impact without affecting production:

```java
@Cycles(value = "#maxTokens * 25",
        actionKind = "llm.completion",
        actionName = "gpt-4o",
        dryRun = true)
public String shadowChat(String prompt, int maxTokens) {
    // This method does NOT execute in dry-run mode.
    // The reservation is evaluated but no budget is held.
    return chatClient.prompt(prompt).call().content();
}
```

::: warning
When `dryRun = true`, the guarded method does **not** execute. The annotation returns `null` after the dry-run reservation check. Use this for measuring budget impact, not for production traffic.
:::

### Multi-tenant via SpEL

Resolve tenant from the request context:

```java
@Cycles(value = "#maxTokens * 25",
        tenant = "#tenantId",
        actionKind = "llm.completion",
        actionName = "gpt-4o")
public String tenantChat(String tenantId, String prompt, int maxTokens) {
    return chatClient.prompt(prompt).call().content();
}
```

### Self-invocation workaround

Spring AOP proxies do not intercept self-calls within the same bean. If you call an `@Cycles` method from another method in the same class, the annotation is bypassed. Use a separate service bean:

```java
// This bean's @Cycles annotations ARE intercepted by the proxy
@Service
public class GuardedLlmService {
    @Cycles(value = "#maxTokens * 25", actionKind = "llm.completion", actionName = "gpt-4o")
    public String generate(String prompt, int maxTokens) {
        return chatClient.prompt(prompt).call().content();
    }
}

// This bean calls the guarded bean — proxy intercepts correctly
@Service
public class AgentOrchestrator {
    @Autowired private GuardedLlmService llm;

    public String orchestrate(String task) {
        return llm.generate(task, 2048);  // @Cycles is applied
    }
}
```

## Next steps

- [Spring Boot Starter Quickstart](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — demo app, annotation reference, full walkthrough
- [Spring Client Configuration](/configuration/client-configuration-reference-for-cycles-spring-boot-starter) — all `cycles.*` properties
- [SpEL Expression Reference](/configuration/spel-expression-reference-for-cycles) — estimate and actual expressions
- [Choosing the Right Overage Policy](/how-to/choosing-the-right-overage-policy) — REJECT vs ALLOW_IF_AVAILABLE vs ALLOW_WITH_OVERDRAFT
- [Budget Limits with Spring AI](/quickstart/how-to-add-hard-budget-limits-to-spring-ai-with-cycles) — strategic guidance
