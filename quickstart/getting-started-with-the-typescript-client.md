# Getting Started with the TypeScript Client

The `runcycles` TypeScript package provides a `withCycles` higher-order function, a `reserveForStream` streaming adapter, and a programmatic `CyclesClient` for adding budget enforcement to any Node.js application.

The `withCycles` HOF wraps any async function in a reserve → execute → commit lifecycle:

1. **Before the function runs:** evaluates the estimate, creates a reservation, and checks the decision
2. **While the function runs:** maintains the reservation with automatic heartbeat extensions
3. **After the function returns:** commits actual usage and releases any unused remainder
4. **If the function throws:** releases the reservation to return budget to the pool

## Prerequisites

You need a running Cycles stack with a tenant, API key, and budget. If you don't have one yet, follow [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) first.

## Installation

```bash
npm install runcycles
```

Requires Node.js 20+. TypeScript 5+ is recommended but optional — the package works with plain JavaScript. Zero runtime dependencies (uses built-in `fetch` and `AsyncLocalStorage`).

## Configuration

```typescript
import { CyclesConfig } from "runcycles";

const config = new CyclesConfig({
  baseUrl: "http://localhost:7878",
  apiKey: "cyc_live_...",
  tenant: "acme-corp",
});
```

Or from environment variables:

```bash
export CYCLES_BASE_URL=http://localhost:7878
export CYCLES_API_KEY=cyc_live_...
export CYCLES_TENANT=acme-corp
```

```typescript
const config = CyclesConfig.fromEnv();
```

## The withCycles higher-order function

The simplest usage — wrap an async function with a fixed estimate:

```typescript
import { CyclesClient, CyclesConfig, withCycles, setDefaultClient } from "runcycles";

const config = new CyclesConfig({
  baseUrl: "http://localhost:7878",
  apiKey: "cyc_live_...",
  tenant: "acme-corp",
});
const client = new CyclesClient(config);
setDefaultClient(client);

const summarize = withCycles(
  { estimate: 1000 },
  async (text: string) => {
    return await callLlm(text);
  },
);

const result = await summarize("Hello world");
```

This reserves 1000 USD_MICROCENTS before `summarize()` runs, then commits the same amount afterward.

### Dynamic estimates

The estimate can be a function that receives the wrapped function's arguments:

```typescript
const generate = withCycles(
  { estimate: (text: string, maxTokens: number) => maxTokens * 10 },
  async (text: string, maxTokens: number) => {
    return await callLlm(text, maxTokens);
  },
);
```

### Specifying actual cost

By default, the estimate is used as the actual cost at commit time. To calculate actual cost from the return value:

```typescript
const chat = withCycles(
  {
    estimate: 5000,
    actual: (result: string) => result.length * 5,
  },
  async (prompt: string) => {
    return await callLlm(prompt);
  },
);
```

### withCycles parameters

| Parameter | Default | Description |
|---|---|---|
| `estimate` | (required) | `number` or function returning `number`. Estimated cost. |
| `actual` | `undefined` | `number` or function receiving the return value. Defaults to estimate. |
| `actionKind` | `"unknown"` | Action category (e.g. `"llm.completion"`). |
| `actionName` | `"unknown"` | Action identifier (e.g. `"gpt-4"`). |
| `actionTags` | `undefined` | Array of tags for filtering/reporting. |
| `unit` | `"USD_MICROCENTS"` | Cost unit: `"USD_MICROCENTS"`, `"TOKENS"`, `"CREDITS"`, `"RISK_POINTS"`. |
| `ttlMs` | `60000` | Reservation TTL in milliseconds (range: 1000–86400000). |
| `gracePeriodMs` | `undefined` | Grace period after TTL expiry (range: 0–60000). |
| `overagePolicy` | `"REJECT"` | `"REJECT"`, `"ALLOW_IF_AVAILABLE"`, or `"ALLOW_WITH_OVERDRAFT"`. |
| `dryRun` | `false` | If `true`, evaluate without persisting. Function does not execute. |
| `tenant` | `undefined` | Subject tenant override. |
| `workspace` | `undefined` | Subject workspace override. |
| `app` | `undefined` | Subject app override. |
| `workflow` | `undefined` | Subject workflow override. |
| `agent` | `undefined` | Subject agent override. |
| `toolset` | `undefined` | Subject toolset override. |
| `dimensions` | `undefined` | Custom dimensions object. |
| `client` | `undefined` | Explicit client. Falls back to module default. |
| `useEstimateIfActualNotProvided` | `true` | If `true` and `actual` is not set, use estimate as actual at commit. |

## Accessing reservation context at runtime

Inside a `withCycles`-guarded function, the current reservation context is available via `getCyclesContext()`:

```typescript
import { withCycles, getCyclesContext } from "runcycles";

const process = withCycles(
  { estimate: 1000, client },
  async (text: string) => {
    const ctx = getCyclesContext();

    // Check reservation details
    console.log(`Reservation: ${ctx?.reservationId}`);
    console.log(`Decision: ${ctx?.decision}`);

    // Check caps (if ALLOW_WITH_CAPS)
    if (ctx?.caps) {
      const maxTokens = ctx.caps.maxTokens;
      // Adjust behavior based on caps
    }

    // Attach metrics for the commit
    if (ctx) {
      ctx.metrics = {
        tokensInput: 150,
        tokensOutput: 80,
        latencyMs: 320,
        modelVersion: "gpt-4o-mini",
      };

      // Attach metadata for audit
      ctx.commitMetadata = { requestId: "req-abc-123" };
    }

    return await callLlm(text);
  },
);
```

The context uses `AsyncLocalStorage`, so it is available in any nested async call within the guarded function.

## Decision handling

When the reservation decision comes back, the HOF handles each case:

- **ALLOW** — the function runs normally.
- **ALLOW_WITH_CAPS** — the function runs. Caps are available through `getCyclesContext()` for the function to inspect and respect.
- **DENY** — the function does not run. A `BudgetExceededError` (or appropriate subclass) is raised.

```typescript
import { BudgetExceededError, CyclesProtocolError } from "runcycles";

try {
  const result = await summarize("Hello");
} catch (err) {
  if (err instanceof BudgetExceededError) {
    result = fallbackResponse();
  } else if (err instanceof CyclesProtocolError) {
    if (err.retryAfterMs) {
      // retry after suggested delay
    }
    result = fallbackResponse();
  }
}
```

### Exception hierarchy

| Exception | When |
|-----------|------|
| `CyclesError` | Base for all Cycles errors |
| `CyclesProtocolError` | Server returned a protocol-level error |
| `BudgetExceededError` | Budget insufficient for the reservation |
| `OverdraftLimitExceededError` | Debt exceeds the overdraft limit |
| `DebtOutstandingError` | Outstanding debt blocks new reservations |
| `ReservationExpiredError` | Operating on an expired reservation |
| `ReservationFinalizedError` | Operating on an already-committed/released reservation |
| `CyclesTransportError` | Network-level failure (connection, DNS, timeout) |

## Streaming support

For LLM streaming where usage is only known after the stream finishes, use `reserveForStream`:

```typescript
import { CyclesClient, CyclesConfig, reserveForStream } from "runcycles";

const config = new CyclesConfig({
  baseUrl: "http://localhost:7878",
  apiKey: "cyc_live_...",
  tenant: "acme",
});
const client = new CyclesClient(config);

let handle;
try {
  handle = await reserveForStream({
    client,
    estimate: 5000,
    actionKind: "llm.completion",
    actionName: "gpt-4o",
  });
} catch (err) {
  // Reservation denied — no cleanup needed
  throw err;
}

try {
  const stream = streamText({
    model: openai("gpt-4o"),
    messages,
    onFinish: async ({ usage }) => {
      const actualCost = (usage.promptTokens + usage.completionTokens) * 3;
      await handle.commit(actualCost, {
        tokensInput: usage.promptTokens,
        tokensOutput: usage.completionTokens,
      });
    },
  });

  return stream.toDataStreamResponse();
} catch (err) {
  await handle.release("stream_error");
  throw err;
}
```

The handle is once-only and race-safe: `commit()` throws if already finalized (so bugs are never silently hidden), while `release()` is a silent no-op if already finalized (best-effort by design).

### Which pattern to use?

| Pattern | Use when |
|---------|----------|
| `withCycles` | You have an async function that returns a result — the lifecycle is fully automatic |
| `reserveForStream` | You're streaming and usage is known only after the stream finishes |
| `CyclesClient` | You need full control over the reservation lifecycle, or are building custom integrations |

## Programmatic client

For full control, use `CyclesClient` directly. The client operates on wire-format (snake_case) JSON. Use typed mappers for camelCase convenience, or pass raw snake_case objects:

```typescript
import {
  CyclesClient,
  CyclesConfig,
  reservationCreateRequestToWire,
  reservationCreateResponseFromWire,
  commitRequestToWire,
  releaseRequestToWire,
} from "runcycles";

const config = new CyclesConfig({
  baseUrl: "http://localhost:7878",
  apiKey: "cyc_live_...",
});
const client = new CyclesClient(config);

// 1. Reserve
const response = await client.createReservation(
  reservationCreateRequestToWire({
    idempotencyKey: "req-001",
    subject: { tenant: "acme", agent: "support-bot" },
    action: { kind: "llm.completion", name: "gpt-4" },
    estimate: { unit: "USD_MICROCENTS", amount: 500_000 },
    ttlMs: 30_000,
  }),
);

if (!response.isSuccess) {
  throw new Error(`Reservation failed: ${response.errorMessage}`);
}

const parsed = reservationCreateResponseFromWire(response.body!);

// 2. Execute
try {
  const result = await callLlm("Hello");

  // 3. Commit
  await client.commitReservation(
    parsed.reservationId!,
    commitRequestToWire({
      idempotencyKey: "commit-001",
      actual: { unit: "USD_MICROCENTS", amount: 420_000 },
      metrics: { tokensInput: 1200, tokensOutput: 800 },
    }),
  );
} catch (err) {
  // 4. Release on failure
  await client.releaseReservation(
    parsed.reservationId!,
    releaseRequestToWire({
      idempotencyKey: "release-001",
      reason: "Processing failed",
    }),
  );
  throw err;
}
```

You can also pass raw snake_case objects directly without mappers:

```typescript
const response = await client.createReservation({
  idempotency_key: "req-001",
  subject: { tenant: "acme", agent: "support-bot" },
  action: { kind: "llm.completion", name: "gpt-4" },
  estimate: { unit: "USD_MICROCENTS", amount: 500_000 },
  ttl_ms: 30_000,
});
```

### Preflight decision check

```typescript
import { decisionRequestToWire, decisionResponseFromWire } from "runcycles";

const response = await client.decide(
  decisionRequestToWire({
    idempotencyKey: "decide-001",
    subject: { tenant: "acme" },
    action: { kind: "llm.completion", name: "gpt-4" },
    estimate: { unit: "USD_MICROCENTS", amount: 500_000 },
  }),
);

if (response.isSuccess) {
  const parsed = decisionResponseFromWire(response.body!);
  console.log(parsed.decision); // "ALLOW", "ALLOW_WITH_CAPS", or "DENY"
}
```

### Querying balances

```typescript
import { balanceResponseFromWire } from "runcycles";

const response = await client.getBalances({ tenant: "acme" });
if (response.isSuccess) {
  const parsed = balanceResponseFromWire(response.body!);
  for (const balance of parsed.balances) {
    console.log(`${balance.scopePath}: remaining=${balance.remaining.amount}`);
  }
}
```

### Recording events (direct debit)

```typescript
import { eventCreateRequestToWire } from "runcycles";

const response = await client.createEvent(
  eventCreateRequestToWire({
    idempotencyKey: "evt-001",
    subject: { tenant: "acme" },
    action: { kind: "api.call", name: "geocode" },
    actual: { unit: "USD_MICROCENTS", amount: 1_500 },
  }),
);
```

## Suggested walkthrough

Follow this order to build understanding progressively:

**1. Reserve and commit with a fixed estimate**

```typescript
import { CyclesClient, CyclesConfig, withCycles, setDefaultClient } from "runcycles";

const config = new CyclesConfig({
  baseUrl: "http://localhost:7878",
  apiKey: "cyc_live_...",
  tenant: "acme-corp",
});
const client = new CyclesClient(config);
setDefaultClient(client);

const hello = withCycles(
  { estimate: 1000 },
  async (name: string) => `Hello, ${name}!`,
);

const result = await hello("world");
console.log(result);
```

**2. Check your balance**

```typescript
import { balanceResponseFromWire } from "runcycles";

const response = await client.getBalances({ tenant: "acme-corp" });
if (response.isSuccess) {
  console.log(balanceResponseFromWire(response.body!));
}
```

**3. Try a dry run**

```typescript
const dryRunFunc = withCycles(
  { estimate: 500, dryRun: true },
  async () => "This won't consume budget",
);

await dryRunFunc();
// Check balances — they haven't changed
```

**4. Use dynamic estimates with metrics**

```typescript
import { getCyclesContext } from "runcycles";

const generate = withCycles(
  {
    estimate: (prompt: string, maxTokens: number) => maxTokens * 10,
    actual: (result: string) => result.length * 5,
    actionKind: "llm.completion",
    actionName: "gpt-4",
  },
  async (prompt: string, maxTokens: number) => {
    const ctx = getCyclesContext();
    if (ctx) {
      ctx.metrics = { tokensInput: prompt.length, tokensOutput: maxTokens };
    }
    return `Generated response for: ${prompt}`;
  },
);

const result = await generate("Explain budgets", 500);
```

**5. Handle denials gracefully**

```typescript
import { BudgetExceededError } from "runcycles";

const expensiveFunc = withCycles(
  { estimate: 999_999_999 },
  async () => "This needs a lot of budget",
);

try {
  await expensiveFunc();
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.log("Budget exhausted — using fallback");
  }
}
```

## Lifecycle summary

For each `withCycles`-guarded function call:

1. Estimate is evaluated (function or fixed value)
2. Reservation is created on the Cycles server
3. Decision is checked (ALLOW / ALLOW_WITH_CAPS / DENY)
4. If DENY: exception is thrown, function does not run
5. Heartbeat extension is scheduled (background, at half the TTL interval)
6. Function executes
7. Actual cost is evaluated (function, fixed value, or estimate)
8. Commit is sent with actual amount and optional metrics
9. Heartbeat is stopped
10. If function threw: reservation is released instead of committed

## Next steps

- [TypeScript Client Configuration Reference](/configuration/typescript-client-configuration-reference) — all config options and environment variables
- [Error Handling in TypeScript](/how-to/error-handling-patterns-in-typescript) — exception hierarchy, Express/Next.js patterns
- [Testing with Cycles](/how-to/testing-with-cycles) — unit and integration testing patterns
- [Using the Client Programmatically](/how-to/using-the-cycles-client-programmatically) — programmatic client reference
- [Error Handling Patterns](/how-to/error-handling-patterns-in-cycles-client-code) — general error handling patterns across all languages
- [API Reference](/api/) — interactive endpoint documentation
