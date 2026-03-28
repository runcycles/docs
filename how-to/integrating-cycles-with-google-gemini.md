---
title: "Integrating Cycles with Google Gemini"
description: "Add budget governance to Google Gemini API calls using the runcycles TypeScript client. Covers non-streaming and streaming patterns with actual token-based cost accounting."
---

# Integrating Cycles with Google Gemini

This guide shows how to add budget governance to Google Gemini API calls using the `runcycles` TypeScript client.

::: warning SDK migration
The examples below use `@google/generative-ai`, which Google is replacing with `@google/genai`. The API patterns are similar — see [Google's migration guide](https://ai.google.dev/gemini-api/docs/migrate) for the new SDK. The runcycles integration works the same way with either SDK.
:::

## Prerequisites

- A running Cycles stack with a tenant, API key, and budget ([Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack))
- A Google AI API key (`GOOGLE_API_KEY`)
- Node.js 20+

## Installation

```bash
npm install runcycles @google/generative-ai
```

## Non-streaming calls with withCycles

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerateContentResult } from "@google/generative-ai";
import {
  CyclesClient, CyclesConfig, withCycles,
  getCyclesContext, BudgetExceededError,
} from "runcycles";

const cyclesClient = new CyclesClient(CyclesConfig.fromEnv());
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const MODEL = "gemini-2.0-flash";
const MAX_TOKENS = 1024;

// Per-token pricing in USD microcents (prompts ≤ 128k tokens)
// Input: $0.10/1M tokens = 10 microcents/token
// Output: $0.40/1M tokens = 40 microcents/token
function costMicrocents(inputTokens: number, outputTokens: number): number {
  return Math.ceil(inputTokens * 10 + outputTokens * 40);
}

const callGemini = withCycles(
  {
    client: cyclesClient,
    actionKind: "llm.completion",
    actionName: MODEL,
    estimate: (prompt: string) => {
      const inputTokens = Math.ceil(prompt.length / 4);
      return costMicrocents(inputTokens, MAX_TOKENS);
    },
    actual: (result: GenerateContentResult) => {
      const usage = result.response.usageMetadata;
      return costMicrocents(
        usage?.promptTokenCount ?? 0,
        usage?.candidatesTokenCount ?? 0,
      );
    },
  },
  async (prompt: string) => {
    const ctx = getCyclesContext();

    // Respect budget caps — reduce max_tokens if budget is running low
    let maxTokens = MAX_TOKENS;
    if (ctx?.caps?.maxTokens) {
      maxTokens = Math.min(maxTokens, ctx.caps.maxTokens);
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const result = await model.generateContent(prompt);

    // Report metrics for observability
    if (ctx) {
      const usage = result.response.usageMetadata;
      ctx.metrics = {
        tokensInput: usage?.promptTokenCount,
        tokensOutput: usage?.candidatesTokenCount,
        modelVersion: MODEL,
      };
    }

    return result;
  },
);

// Usage
try {
  const result = await callGemini("Explain budget governance for AI agents.");
  console.log(result.response.text());
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error("Budget exhausted:", err.message);
  } else {
    throw err;
  }
}
```

::: tip estimate vs actual
The `estimate` callback runs **before** the LLM call to reserve budget. The `actual` callback runs **after** to commit real usage. Without `actual`, Cycles commits the estimate — which overstates cost on short responses and understates it on long ones. Always provide both when token counts are available.
:::

## Streaming calls with reserveForStream

For streaming responses, use `reserveForStream` to reserve before the stream starts and commit real token counts after it finishes:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CyclesClient, CyclesConfig, reserveForStream, BudgetExceededError } from "runcycles";

const cyclesClient = new CyclesClient(CyclesConfig.fromEnv());
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const MODEL = "gemini-2.0-flash";
const MAX_TOKENS = 1024;

function costMicrocents(inputTokens: number, outputTokens: number): number {
  return Math.ceil(inputTokens * 10 + outputTokens * 40);
}

async function streamWithBudget(prompt: string) {
  const estimatedInputTokens = Math.ceil(prompt.length / 4);
  const estimate = costMicrocents(estimatedInputTokens, MAX_TOKENS);

  // 1. Reserve budget
  const handle = await reserveForStream({
    client: cyclesClient,
    estimate,
    unit: "USD_MICROCENTS",
    actionKind: "llm.completion",
    actionName: MODEL,
  });

  try {
    // Respect budget caps
    let maxTokens = MAX_TOKENS;
    if (handle.caps?.maxTokens) {
      maxTokens = Math.min(maxTokens, handle.caps.maxTokens);
    }

    // 2. Stream the response
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const streamResult = await model.generateContentStream(prompt);

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) process.stdout.write(text);
    }
    console.log();

    // 3. Commit actual usage from aggregated response
    const aggregated = await streamResult.response;
    const usage = aggregated.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    await handle.commit(costMicrocents(inputTokens, outputTokens), {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      modelVersion: MODEL,
    });
  } catch (err) {
    await handle.release("stream_error");
    throw err;
  }
}
```

## Gemini usage metadata

The Gemini SDK provides token counts through `response.usageMetadata`:

- `promptTokenCount` — input tokens
- `candidatesTokenCount` — output tokens
- `totalTokenCount` — total tokens

For streaming, access this from the aggregated response after the stream completes: `const aggregated = await streamResult.response`.

## Next steps

- [Handling Streaming Responses](/how-to/handling-streaming-responses-with-cycles) — streaming patterns in detail
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for estimation
- [Error Handling in TypeScript](/how-to/error-handling-patterns-in-typescript) — handling budget errors
- [Google Gemini example (TypeScript)](https://github.com/runcycles/cycles-client-typescript/tree/main/examples/google-gemini) — runnable Google Gemini integration
