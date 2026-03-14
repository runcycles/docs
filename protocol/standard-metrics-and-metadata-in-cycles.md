# Standard Metrics and Metadata in Cycles

Budget enforcement tells you whether work is allowed and how much it costs.

But production systems need more than cost numbers. They need to know what happened during execution — how many tokens were consumed, how long it took, which model version was used, and any custom data relevant for debugging or analytics.

That is what standard metrics and metadata provide.

## Where metrics and metadata appear

Metrics and metadata can be attached to two operations:

- **Commits** (`POST /v1/reservations/{id}/commit`) — when finalizing a reservation
- **Events** (`POST /v1/events`) — when recording direct debit usage

Both accept an optional `metrics` field and an optional `metadata` field.

## Standard metrics

The protocol defines a `StandardMetrics` schema with four named fields and an extensible custom map:

### tokens_input

```json
"tokens_input": 1250
```

The number of input tokens consumed by the operation. Integer, minimum 0.

Useful for tracking prompt size and correlating with model pricing.

### tokens_output

```json
"tokens_output": 430
```

The number of output tokens generated. Integer, minimum 0.

Useful for tracking generation length and correlating with output pricing (which is typically higher than input pricing).

### latency_ms

```json
"latency_ms": 1840
```

The total operation latency in milliseconds. Integer, minimum 0.

Useful for SLA monitoring, performance analysis, and identifying slow operations that may need different TTL or timeout handling.

### model_version

```json
"model_version": "gpt-4o-mini-2024-07-18"
```

The actual model or tool version used. String, maximum 128 characters.

This is important because the model requested and the model used are not always the same. Providers may route to different versions, and this field captures what actually ran.

### custom

```json
"custom": {
  "cache_hit": "true",
  "region": "us-east-1",
  "retry_count": "2"
}
```

An open map for arbitrary additional metrics. Values can be any JSON type (strings, numbers, booleans, objects).

Use custom metrics for anything not covered by the standard fields — cache behavior, retry counts, routing decisions, feature flags, or domain-specific measurements.

## A complete metrics example

```json
{
  "idempotency_key": "commit-run-42-step-7",
  "actual": { "unit": "USD_MICROCENTS", "amount": 285000 },
  "metrics": {
    "tokens_input": 1250,
    "tokens_output": 430,
    "latency_ms": 1840,
    "model_version": "gpt-4o-mini-2024-07-18",
    "custom": {
      "cache_hit": "false",
      "prompt_template": "summarize-v3"
    }
  }
}
```

## Metadata

Metadata is a separate field from metrics. It is an open map for arbitrary key-value pairs:

```json
{
  "idempotency_key": "commit-run-42-step-7",
  "actual": { "unit": "USD_MICROCENTS", "amount": 285000 },
  "metadata": {
    "request_id": "req-abc-123",
    "trace_id": "trace-xyz-789",
    "user_id": "user-456",
    "session_id": "session-001"
  }
}
```

Metadata is intended for audit, debugging, and correlation — not for operational metrics.

### Metrics vs metadata

- **Metrics** are about what happened during execution (tokens, latency, model version)
- **Metadata** is about context and correlation (request IDs, trace IDs, user IDs)

Both are optional. Both are stored with the commit or event record. But they serve different analytical purposes.

## Where metadata also appears

Metadata is accepted on several other operations beyond commits and events:

- **Reservation creation** (`POST /v1/reservations`) — attach context to the reservation itself
- **Reservation extend** (`POST /v1/reservations/{id}/extend`) — attach debugging metadata to extend operations

This means a full reservation lifecycle can carry metadata from creation through commit:

1. Create reservation with `metadata: { "trace_id": "..." }`
2. Extend with `metadata: { "heartbeat_seq": "3" }`
3. Commit with `metadata: { "request_id": "..." }` and `metrics: { ... }`

## Metrics in client code

### Python

Inside a `@cycles`-decorated function, attach metrics and metadata through `get_cycles_context()`:

```python
from runcycles import cycles, get_cycles_context, CyclesMetrics

@cycles(estimate=1000)
def chat(prompt: str) -> str:
    response = call_llm(prompt)

    ctx = get_cycles_context()
    ctx.metrics = CyclesMetrics(
        tokens_input=response.usage.prompt_tokens,
        tokens_output=response.usage.completion_tokens,
        latency_ms=elapsed,
        model_version=response.model,
    )
    ctx.commit_metadata = {
        "request_id": request_id,
        "trace_id": trace_id,
    }

    return response.text
```

The decorator automatically includes these metrics and metadata in the commit request when the function returns.

### Java (Spring Boot)

The Spring Boot client exposes metrics through `CyclesContextHolder`:

```java
@Cycles("1000")
public ChatResponse chat(String prompt) {
    ChatResponse response = chatModel.call(prompt);

    CyclesReservationContext ctx = CyclesContextHolder.get();

    CyclesMetrics metrics = new CyclesMetrics();
    metrics.setTokensInput(response.getUsage().getPromptTokens());
    metrics.setTokensOutput(response.getUsage().getCompletionTokens());
    metrics.setLatencyMs(elapsed);
    metrics.setModelVersion(response.getMetadata().getModel());
    ctx.setMetrics(metrics);

    ctx.setCommitMetadata(Map.of(
        "request_id", requestId,
        "trace_id", traceId
    ));

    return response;
}
```

The starter automatically includes these metrics and metadata in the commit request when the method returns.

## Why standard metrics matter

### Cost attribution

Tokens input and output, combined with model version, enable precise cost attribution:

- which model was used
- how many tokens it consumed
- what the actual cost was

This connects budget accounting to provider-level billing.

### Performance monitoring

Latency metrics across commits reveal:

- which actions are slow
- whether latency correlates with budget consumption
- where timeout or TTL adjustments are needed

### Audit trail

Metadata creates a traceable path from budget operations back to the originating request, user, or workflow run.

When investigating a budget incident, metadata helps answer: who triggered this, from which session, as part of which trace?

### Analytics

Over time, standard metrics enable aggregate analysis:

- average tokens per model call by action type
- latency distributions by model version
- cache hit rates across workflows
- cost efficiency trends

## Best practices

### Always include tokens and model version on LLM calls

These are the minimum metrics that make budget data actionable. Without them, cost numbers exist without context.

### Use metadata for correlation IDs

Attach `request_id`, `trace_id`, or `session_id` to every commit. This makes it possible to join budget data with application logs and distributed traces.

### Keep custom metrics stable

Treat custom metric keys like a schema. Changing keys breaks downstream analytics. Add new keys freely, but avoid renaming or removing existing ones without coordination.

### Do not put sensitive data in metrics or metadata

Metrics and metadata are stored and may be visible through admin interfaces or log aggregation. Do not include PII, secrets, or authentication tokens.

## Summary

Standard metrics and metadata enrich budget operations with execution context:

- **tokens_input** and **tokens_output** — token consumption
- **latency_ms** — operation duration
- **model_version** — actual model used
- **custom** — extensible metrics map
- **metadata** — correlation IDs, audit context, and debugging data

These fields are optional but recommended. They turn budget accounting from raw cost numbers into actionable operational data.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Python using the [Python Client](/quickstart/getting-started-with-the-python-client)
- Integrate with TypeScript using the [TypeScript Client](/quickstart/getting-started-with-the-typescript-client)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
