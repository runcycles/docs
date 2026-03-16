---
title: "Integrating Cycles with Anthropic"
description: "Guard Anthropic Messages API calls with Cycles budget reservations, including per-tool-call tracking for agentic workflows."
---

# Integrating Cycles with Anthropic

This guide shows how to guard Anthropic Messages API calls with Cycles budget reservations, including per-tool-call budget tracking for agentic workflows.

## Prerequisites

```bash
pip install runcycles anthropic
```

```bash
export CYCLES_BASE_URL="http://localhost:7878"
export CYCLES_API_KEY="your-api-key"
export CYCLES_TENANT="acme"
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Simple decorator pattern

Use `@cycles` to wrap a single Anthropic call with automatic reserve → execute → commit:

```python
from anthropic import Anthropic
from runcycles import (
    CyclesConfig, CyclesClient, CyclesMetrics,
    cycles, get_cycles_context, set_default_client,
)

set_default_client(CyclesClient(CyclesConfig.from_env()))
anthropic_client = Anthropic()

PRICE_PER_INPUT_TOKEN = 300       # $3.00 / 1M tokens in microcents
PRICE_PER_OUTPUT_TOKEN = 1_500    # $15.00 / 1M tokens in microcents

@cycles(
    estimate=lambda prompt, **kw: (
        len(prompt.split()) * 2 * PRICE_PER_INPUT_TOKEN
        + kw.get("max_tokens", 1024) * PRICE_PER_OUTPUT_TOKEN
    ),
    actual=lambda result: (
        result["usage"]["input_tokens"] * PRICE_PER_INPUT_TOKEN
        + result["usage"]["output_tokens"] * PRICE_PER_OUTPUT_TOKEN
    ),
    action_kind="llm.completion",
    action_name="claude-sonnet-4-20250514",
    unit="USD_MICROCENTS",
    ttl_ms=60_000,
)
def send_message(prompt: str, max_tokens: int = 1024) -> dict:
    ctx = get_cycles_context()
    if ctx and ctx.has_caps() and ctx.caps.max_tokens:
        max_tokens = min(max_tokens, ctx.caps.max_tokens)

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )

    if ctx:
        ctx.metrics = CyclesMetrics(
            tokens_input=response.usage.input_tokens,
            tokens_output=response.usage.output_tokens,
            model_version=response.model,
        )

    return {
        "content": response.content[0].text,
        "usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
    }
```

## Per-tool-call budget tracking

When Claude uses tools, each LLM turn in the conversation consumes tokens. Use the programmatic client to create a separate reservation for each turn:

```python
import uuid
from runcycles import (
    CyclesClient, CyclesConfig, ReservationCreateRequest,
    CommitRequest, Subject, Action, Amount, Unit, CyclesMetrics,
)

client = CyclesClient(CyclesConfig.from_env())
anthropic_client = Anthropic()

def chat_with_tools(prompt: str) -> str:
    messages = [{"role": "user", "content": prompt}]

    for turn in range(1, 6):  # max 5 turns
        key = str(uuid.uuid4())

        # Reserve budget for this turn
        res = client.create_reservation(ReservationCreateRequest(
            idempotency_key=key,
            subject=Subject(tenant="acme", agent="tool-agent"),
            action=Action(kind="llm.completion", name="claude-sonnet-4-20250514",
                          tags=[f"turn-{turn}"]),
            estimate=Amount(unit=Unit.USD_MICROCENTS, amount=2_000_000),
            ttl_ms=30_000,
        ))

        if not res.is_success:
            return "Budget exhausted — stopping."

        reservation_id = res.get_body_attribute("reservation_id")

        # Call Claude with tools
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            tools=TOOLS,
            messages=messages,
        )

        # Commit actual cost
        actual = (
            response.usage.input_tokens * PRICE_PER_INPUT_TOKEN
            + response.usage.output_tokens * PRICE_PER_OUTPUT_TOKEN
        )
        client.commit_reservation(reservation_id, CommitRequest(
            idempotency_key=f"commit-{key}",
            actual=Amount(unit=Unit.USD_MICROCENTS, amount=actual),
            metrics=CyclesMetrics(
                tokens_input=response.usage.input_tokens,
                tokens_output=response.usage.output_tokens,
                model_version=response.model,
                custom={"turn": turn},
            ),
        ))

        if response.stop_reason == "end_turn":
            return response.content[0].text

        # Process tool calls and continue
        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            messages.append({"role": "user", "content": tool_results})

    return "Max turns reached."
```

Each turn gets its own reservation, so the budget authority can deny mid-conversation if the agent is burning through budget too fast.

## Pricing reference

Adjust these constants for the model you use:

| Model | Input (microcents/token) | Output (microcents/token) |
|-------|--------------------------|---------------------------|
| Claude Haiku | 25 | 125 |
| Claude Sonnet | 300 | 1,500 |
| Claude Opus | 1,500 | 7,500 |

## Key points

- **Decorator for simple calls.** Use `@cycles` when you make a single API call and want automatic lifecycle management.
- **Programmatic client for multi-turn.** When tool use creates a loop of LLM calls, create a reservation per turn for fine-grained control.
- **Tag turns for observability.** Use `action.tags` (e.g., `["turn-1"]`) to distinguish costs across turns.
- **Custom metrics.** Use `CyclesMetrics.custom` to record tool-use metadata alongside standard token counts.

## Full example

See [`examples/anthropic_integration.py`](https://github.com/runcycles/cycles-client-python/blob/main/examples/anthropic_integration.py) for a complete, runnable script.
