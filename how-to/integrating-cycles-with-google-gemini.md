---
title: "Integrating Cycles with Google Gemini"
description: "Add budget governance to Google Gemini API calls using the runcycles TypeScript client and the @google/genai SDK."
---

# Integrating Cycles with Google Gemini

This guide shows how to add budget governance to Google Gemini API calls using the `runcycles` TypeScript client and the `@google/genai` SDK.

## Prerequisites

- A running Cycles stack with a tenant, API key, and budget ([Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack))
- A Google AI API key
- Node.js 20+

## Installation

```bash
npm install runcycles @google/genai
```

## Non-streaming calls with withCycles

```typescript
import { GoogleGenAI } from "@google/genai";
import { CyclesClient, CyclesConfig, withCycles, setDefaultClient } from "runcycles";

const cyclesClient = new CyclesClient(CyclesConfig.fromEnv());
setDefaultClient(cyclesClient);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const askGemini = withCycles(
  {
    estimate: 500_000,  // ~$0.005 per call
    actual: (result: string) => Math.ceil(result.length / 4 * 40),  // rough output-token cost
    actionKind: "llm.completion",
    actionName: "google:gemini-2.5-flash",
  },
  async (prompt: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text ?? "";
  },
);

const response = await askGemini("Explain budget governance for AI agents.");
console.log(response);
```

::: tip actual vs estimate
Without an `actual` callback, Cycles commits the `estimate` as the real spend — which overstates cost on cheap calls and understates it on expensive ones. Always provide `actual` when you can derive real usage from the response.
:::

## Streaming calls with reserveForStream

For streaming responses, use `reserveForStream` to reserve before the stream starts and commit after it finishes with real token counts:

```typescript
import { GoogleGenAI } from "@google/genai";
import {
  CyclesClient,
  CyclesConfig,
  reserveForStream,
  BudgetExceededError,
} from "runcycles";

const cyclesClient = new CyclesClient(CyclesConfig.fromEnv());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODEL = "gemini-2.5-flash";
const MAX_TOKENS = 1024;

// Gemini 2.5 Flash pricing:
// Input: $0.15/1M tokens = 15 microcents/token
// Output: $0.60/1M tokens = 60 microcents/token
function estimateCost(inputTokens: number, maxOutputTokens: number): number {
  return Math.ceil((inputTokens * 15 + maxOutputTokens * 60) * 1.2);
}

function actualCost(inputTokens: number, outputTokens: number): number {
  return Math.ceil(inputTokens * 15 + outputTokens * 60);
}

async function streamWithBudget(prompt: string) {
  const estimatedInputTokens = Math.ceil(prompt.length / 4);
  const estimate = estimateCost(estimatedInputTokens, MAX_TOKENS);

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
    const streamResult = await ai.models.generateContentStream({
      model: MODEL,
      contents: prompt,
      config: { maxOutputTokens: maxTokens },
    });

    for await (const chunk of streamResult) {
      const text = chunk.text;
      if (text) process.stdout.write(text);
    }
    console.log();

    // 3. Commit actual usage from aggregated response metadata
    const usage = streamResult.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    await handle.commit(actualCost(inputTokens, outputTokens), {
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

The `@google/genai` SDK provides token usage through `usageMetadata` on the response:

- `promptTokenCount` — input tokens
- `candidatesTokenCount` — output tokens
- `totalTokenCount` — total tokens

For streaming, access this from the stream result after iteration completes.

## Next steps

- [Handling Streaming Responses](/how-to/handling-streaming-responses-with-cycles) — streaming patterns in detail
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for estimation
- [Error Handling in TypeScript](/how-to/error-handling-patterns-in-typescript) — handling budget errors
- [Google Gemini example (TypeScript)](https://github.com/runcycles/cycles-client-typescript/tree/main/examples/google-gemini) — runnable Google Gemini integration
