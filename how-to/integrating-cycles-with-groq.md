---
title: "Integrating Cycles with Groq"
description: "Add budget governance to Groq API calls using the OpenAI SDK with Cycles. Includes Groq-specific pricing, estimation, and a model-downgrade degradation pattern."
---

# Integrating Cycles with Groq

This guide shows how to add budget governance to [Groq](https://groq.com/) API calls. Groq provides an OpenAI-compatible API, so you use the standard OpenAI SDK with a different `base_url`. All Cycles patterns from the [OpenAI integration](/how-to/integrating-cycles-with-openai) apply directly.

## Prerequisites

```bash
pip install runcycles openai
```

```bash
export CYCLES_BASE_URL="http://localhost:7878"
export CYCLES_API_KEY="your-api-key"   # create via Admin Server — see note below
export CYCLES_TENANT="acme"
export GROQ_API_KEY="gsk_..."
```

> **Need a Cycles API key?** Create one via the Admin Server — see [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack#step-3-create-an-api-key) or [API Key Management](/how-to/api-key-management-in-cycles).

::: tip 60-Second Quick Start
```python
from openai import OpenAI
from runcycles import CyclesClient, CyclesConfig, cycles, set_default_client

set_default_client(CyclesClient(CyclesConfig.from_env()))
groq = OpenAI(base_url="https://api.groq.com/openai/v1", api_key="gsk_...")

@cycles(estimate=100_000, action_kind="llm.completion", action_name="llama-4-maverick-17b-128e")
def ask(prompt: str) -> str:
    return groq.chat.completions.create(
        model="llama-4-maverick-17b-128e",
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content

print(ask("What is budget authority?"))
```
Same OpenAI SDK, same `@cycles` decorator — just a different `base_url`. Notice the estimate is much lower than GPT-4o because Groq's pricing is 10-50x cheaper.
:::

## Basic pattern

```python
import os
from openai import OpenAI
from runcycles import (
    CyclesConfig, CyclesClient, CyclesMetrics,
    cycles, get_cycles_context, set_default_client,
)

set_default_client(CyclesClient(CyclesConfig.from_env()))

groq = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ["GROQ_API_KEY"],
)

# Llama 4 Maverick on Groq
PRICE_PER_INPUT_TOKEN = 20     # $0.20 / 1M tokens
PRICE_PER_OUTPUT_TOKEN = 60    # $0.60 / 1M tokens

@cycles(
    estimate=lambda prompt, **kw: len(prompt.split()) * 2 * PRICE_PER_INPUT_TOKEN
        + kw.get("max_tokens", 1024) * PRICE_PER_OUTPUT_TOKEN,
    actual=lambda result: (
        result["usage"]["prompt_tokens"] * PRICE_PER_INPUT_TOKEN
        + result["usage"]["completion_tokens"] * PRICE_PER_OUTPUT_TOKEN
    ),
    action_kind="llm.completion",
    action_name="llama-4-maverick-17b-128e",
    unit="USD_MICROCENTS",
)
def chat(prompt: str, max_tokens: int = 1024) -> dict:
    ctx = get_cycles_context()
    if ctx and ctx.has_caps() and ctx.caps.max_tokens:
        max_tokens = min(max_tokens, ctx.caps.max_tokens)

    response = groq.chat.completions.create(
        model="llama-4-maverick-17b-128e",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
    )

    if ctx:
        ctx.metrics = CyclesMetrics(
            tokens_input=response.usage.prompt_tokens,
            tokens_output=response.usage.completion_tokens,
            model_version=response.model,
        )

    return {
        "content": response.choices[0].message.content,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        },
    }
```

## TypeScript

```typescript
import OpenAI from "openai";
import { CyclesClient, CyclesConfig, withCycles, getCyclesContext } from "runcycles";

const cycles = new CyclesClient(CyclesConfig.fromEnv());
const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const INPUT_PRICE = 20;
const OUTPUT_PRICE = 60;

const chat = withCycles(
  {
    client: cycles,
    actionKind: "llm.completion",
    actionName: "llama-4-maverick-17b-128e",
    estimate: (prompt: string) => {
      const inputTokens = Math.ceil(prompt.length / 4);
      return inputTokens * INPUT_PRICE + 1024 * OUTPUT_PRICE;
    },
    actual: (r: OpenAI.ChatCompletion) =>
      (r.usage?.prompt_tokens ?? 0) * INPUT_PRICE +
      (r.usage?.completion_tokens ?? 0) * OUTPUT_PRICE,
  },
  async (prompt: string) => {
    const ctx = getCyclesContext();
    let maxTokens = 1024;
    if (ctx?.caps?.maxTokens) {
      maxTokens = Math.min(maxTokens, ctx.caps.maxTokens);
    }

    return groq.chat.completions.create({
      model: "llama-4-maverick-17b-128e",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
  },
);
```

## Groq pricing reference

Groq hosts open-source models on custom LPU hardware. Pricing is significantly lower than proprietary models:

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Input (microcents/token) | Output (microcents/token) |
|---|---|---|---|---|
| Llama 4 Maverick 17B | $0.20 | $0.60 | 20 | 60 |
| Llama 4 Scout 17B | $0.11 | $0.34 | 11 | 34 |
| Llama 3.3 70B | $0.59 | $0.79 | 59 | 79 |
| Gemma 2 9B | $0.20 | $0.20 | 20 | 20 |
| Mixtral 8x7B | $0.24 | $0.24 | 24 | 24 |

For comparison, GPT-4o is 250/1,000 microcents per token — **12x more expensive** than Llama 4 Maverick on Groq for input, **17x more** for output.

::: info Note
Groq pricing changes. Check [groq.com/pricing](https://groq.com/pricing) for current rates.
:::

## Model-downgrade degradation pattern

The most powerful Cycles + Groq pattern: when your primary model's budget runs low, automatically downgrade to a cheaper Groq model instead of denying the request entirely.

```python
from runcycles import BudgetExceededError

# Primary: GPT-4o (expensive, high quality)
primary_client = OpenAI()

# Fallback: Llama 4 Maverick on Groq (cheap, good quality)
fallback_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ["GROQ_API_KEY"],
)

@cycles(
    estimate=1_500_000,
    action_kind="llm.completion",
    action_name="gpt-4o",
)
def primary_chat(prompt: str) -> dict:
    response = primary_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"content": response.choices[0].message.content, "model": "gpt-4o"}

@cycles(
    estimate=100_000,
    action_kind="llm.completion",
    action_name="llama-4-maverick",
)
def fallback_chat(prompt: str) -> dict:
    response = fallback_client.chat.completions.create(
        model="llama-4-maverick-17b-128e",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"content": response.choices[0].message.content, "model": "llama-4-maverick"}

def chat_with_downgrade(prompt: str) -> dict:
    """Try GPT-4o first; fall back to Groq if budget is exhausted."""
    try:
        return primary_chat(prompt)
    except BudgetExceededError:
        return fallback_chat(prompt)
```

This pattern gives you:
- **Full quality** when budget allows (GPT-4o at $2.50/$10 per 1M tokens)
- **Continued service** when budget is low (Llama 4 Maverick at $0.20/$0.60 per 1M tokens)
- **Per-model observability** — Cycles tracks spend separately for each `action_name`

See [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) for more strategies.

## Key points

- **Same SDK, different `base_url`.** Groq uses the OpenAI-compatible API — no new SDK to learn.
- **Much lower estimates.** Groq models are 10-50x cheaper than GPT-4o. Adjust your `estimate` values accordingly.
- **Model downgrade is the killer pattern.** Use Groq as a budget-aware fallback when your primary model's budget runs low.
- **All OpenAI patterns apply.** Everything from the [OpenAI integration guide](/how-to/integrating-cycles-with-openai) works with Groq — decorators, streaming, caps, metrics.

## Next steps

- [Integrating with OpenAI](/how-to/integrating-cycles-with-openai) — full OpenAI patterns (all apply to Groq)
- [Integrating with OpenAI (TypeScript)](/how-to/integrating-cycles-with-openai-typescript) — TypeScript streaming patterns
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — model downgrade and other strategies
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for all providers
- [Integrating with Ollama](/how-to/integrating-cycles-with-ollama) — self-hosted open-source models
