---
title: "Integrating Cycles with Google Gemini"
description: "Add budget governance to Google Gemini API calls using the runcycles TypeScript client and the @google/generative-ai SDK."
---

# Integrating Cycles with Google Gemini

This guide shows how to add budget governance to Google Gemini API calls using the `runcycles` TypeScript client and the `@google/generative-ai` SDK.

## Prerequisites

- A running Cycles stack with a tenant, API key, and budget ([Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack))
- A Google AI API key
- Node.js 20+

## Installation

```bash
npm install runcycles @google/generative-ai
```

## Non-streaming calls with withCycles

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CyclesClient, CyclesConfig, withCycles, setDefaultClient } from "runcycles";

const cyclesClient = new CyclesClient(CyclesConfig.fromEnv());
setDefaultClient(cyclesClient);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

const askGemini = withCycles(
  {
    estimate: 500000,  // ~$0.005 per call (Gemini 2.0 Flash is inexpensive)
    actionKind: "llm.completion",
    actionName: "gemini-2.0-flash",
  },
  async (prompt: string) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },
);

const response = await askGemini("Explain budget governance for AI agents.");
console.log(response);
```

## Streaming calls with reserveForStream

For streaming responses, use `reserveForStream`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  CyclesClient,
  CyclesConfig,
  reserveForStream,
  BudgetExceededError,
} from "runcycles";

const cyclesClient = new CyclesClient(CyclesConfig.fromEnv());
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

const MODEL_NAME = "gemini-2.0-flash";
const MAX_TOKENS = 1024;

// Gemini 2.0 Flash pricing:
// Input: $0.10/1M tokens = 10 microcents/token
// Output: $0.40/1M tokens = 40 microcents/token
function estimateCost(inputTokens: number, maxOutputTokens: number): number {
  return Math.ceil((inputTokens * 10 + maxOutputTokens * 40) * 1.2);
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
    actionName: MODEL_NAME,
  });

  try {
    // Respect budget caps
    let maxTokens = MAX_TOKENS;
    if (handle.caps?.maxTokens) {
      maxTokens = Math.min(maxTokens, handle.caps.maxTokens);
    }

    // 2. Stream the response
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const streamResult = await model.generateContentStream(prompt);

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) process.stdout.write(text);
    }
    console.log();

    // 3. Commit actual usage from aggregated response metadata
    const aggregated = await streamResult.response;
    const usage = aggregated.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    const actualCost = Math.ceil(inputTokens * 10 + outputTokens * 40);
    await handle.commit(actualCost, {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      modelVersion: MODEL_NAME,
    });
  } catch (err) {
    await handle.release("stream_error");
    throw err;
  }
}
```

## Gemini usage metadata

The Gemini SDK provides token usage through `response.usageMetadata`:

- `promptTokenCount` — input tokens
- `candidatesTokenCount` — output tokens
- `totalTokenCount` — total tokens

For streaming, access this from the aggregated response after the stream completes: `const aggregated = await streamResult.response`.

## Next steps

- [Handling Streaming Responses](/how-to/handling-streaming-responses-with-cycles) — streaming patterns in detail
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for estimation
- [Error Handling in TypeScript](/how-to/error-handling-patterns-in-typescript) — handling budget errors
- [Google Gemini example (TypeScript)](https://github.com/runcycles/cycles-client-typescript/tree/main/examples/google-gemini) — runnable Google Gemini integration
