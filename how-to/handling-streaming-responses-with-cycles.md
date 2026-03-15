# Handling Streaming Responses with Cycles

Streaming LLM responses require special handling because the actual cost is only known after the stream completes. This guide shows the reserve → stream → commit pattern.

## The challenge

With non-streaming calls, the `@cycles` decorator handles the full lifecycle automatically. With streaming, you need manual control because:

1. The reservation must stay alive for the duration of the stream
2. Token counts accumulate incrementally
3. If the stream fails mid-way, you should release the reservation

## The pattern

Use the programmatic `CyclesClient` (not the decorator) for streaming:

```python
import uuid
from openai import OpenAI
from runcycles import (
    CyclesClient, CyclesConfig, ReservationCreateRequest,
    CommitRequest, ReleaseRequest, Subject, Action, Amount,
    Unit, CyclesMetrics,
)

client = CyclesClient(CyclesConfig.from_env())
openai_client = OpenAI()

def stream_with_budget(prompt: str, max_tokens: int = 1024) -> str:
    key = str(uuid.uuid4())

    # 1. Reserve worst-case budget
    res = client.create_reservation(ReservationCreateRequest(
        idempotency_key=key,
        subject=Subject(tenant="acme", agent="streaming-agent"),
        action=Action(kind="llm.completion", name="gpt-4o"),
        estimate=Amount(unit=Unit.USD_MICROCENTS,
                        amount=max_tokens * 1_000),  # worst case
        ttl_ms=120_000,  # longer TTL for streaming
    ))

    if not res.is_success:
        raise RuntimeError(f"Reservation failed: {res.error_message}")

    reservation_id = res.get_body_attribute("reservation_id")

    # 2. Stream, with release on failure
    chunks = []
    try:
        stream = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
        )

        input_tokens = 0
        output_tokens = 0

        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                chunks.append(chunk.choices[0].delta.content)
            if chunk.usage:
                input_tokens = chunk.usage.prompt_tokens
                output_tokens = chunk.usage.completion_tokens

    except Exception:
        # Release budget on failure
        client.release_reservation(
            reservation_id,
            ReleaseRequest(idempotency_key=f"release-{key}"),
        )
        raise

    # 3. Commit actual cost
    actual_cost = input_tokens * 250 + output_tokens * 1_000
    client.commit_reservation(reservation_id, CommitRequest(
        idempotency_key=f"commit-{key}",
        actual=Amount(unit=Unit.USD_MICROCENTS, amount=actual_cost),
        metrics=CyclesMetrics(
            tokens_input=input_tokens,
            tokens_output=output_tokens,
            custom={"streamed": True},
        ),
    ))

    return "".join(chunks)
```

## TTL considerations

Streaming responses can take significantly longer than non-streaming calls. Set `ttl_ms` high enough to cover the full stream duration:

| Response size | Suggested TTL |
|--------------|---------------|
| Short (< 500 tokens) | 30,000 ms |
| Medium (500–2000 tokens) | 60,000 ms |
| Long (> 2000 tokens) | 120,000 ms |

The Cycles client's automatic heartbeat (TTL extension at half-interval) is **not** available in the programmatic flow. If you need it, call `client.extend_reservation()` periodically during long streams:

```python
from runcycles import ReservationExtendRequest

# Extend by another 60 seconds
client.extend_reservation(
    reservation_id,
    ReservationExtendRequest(
        idempotency_key=f"extend-{key}",
        extend_by_ms=60_000,
    ),
)
```

## Release on failure

Always release the reservation if streaming fails. This frees held budget immediately rather than waiting for TTL expiry:

```python
try:
    # stream...
except Exception:
    client.release_reservation(
        reservation_id,
        ReleaseRequest(idempotency_key=f"release-{key}"),
    )
    raise
```

## Respecting caps

Check for caps after creating the reservation:

```python
caps = res.get_body_attribute("caps")
if caps and caps.get("max_tokens"):
    max_tokens = min(max_tokens, caps["max_tokens"])
```

## Estimating accurately

The estimate determines how much budget is held. Over-estimating wastes budget capacity; under-estimating risks commit-time overage errors.

For streaming, a good estimate is `max_tokens × output_price`, since output tokens dominate cost and `max_tokens` is the upper bound.

## Key points

- **Use the programmatic client**, not the decorator, for streaming.
- **Set a longer TTL** to cover the full stream duration.
- **Always release on failure** to free held budget.
- **Commit the actual cost** after the stream completes using usage data from the final chunk.
- **The estimate holds budget** — the difference between estimate and actual is freed at commit time.

## Full example

See [`examples/streaming_usage.py`](https://github.com/runcycles/cycles-client-python/blob/main/examples/streaming_usage.py) for a complete, runnable script.
