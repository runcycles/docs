---
title: "Integrating Cycles with OpenClaw"
description: "Add budget enforcement to OpenClaw agents using the cycles-openclaw-budget-guard plugin for automatic reserve, commit, and release."
---

# Integrating Cycles with OpenClaw

[![npm](https://img.shields.io/npm/v/@runcycles/openclaw-budget-guard)](https://www.npmjs.com/package/@runcycles/openclaw-budget-guard)
[![npm downloads](https://img.shields.io/npm/dt/@runcycles/openclaw-budget-guard?label=downloads&color=555&style=flat-square)](https://www.npmjs.com/package/@runcycles/openclaw-budget-guard)

This guide shows how to add budget enforcement to OpenClaw agents using the [`cycles-openclaw-budget-guard`](https://github.com/runcycles/cycles-openclaw-budget-guard) plugin. The plugin handles the full reserve → commit → release lifecycle for both model and tool calls automatically, with no custom code required.

## Why budget enforcement?

AI agents make autonomous decisions — calling models, invoking tools, retrying on failure — with no human in the loop. Without runtime enforcement:

- **Runaway spend** — a single [runaway agent](/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent) can blow through an entire budget in minutes. Provider spending caps are account-wide and react too slowly. Rate limits don't account for cost.
- **Uncontrolled side-effects** — an agent can send hundreds of emails, trigger deployments, or call dangerous APIs with nothing to stop it. Cost limits alone don't help — some actions are consequential regardless of price.
- **Noisy neighbors** — in multi-tenant or multi-user setups, one agent can consume the entire team budget, starving other users.
- **No session-level cost visibility** — when a session ends, you have no idea what it spent, which tools it called most, or whether it was cost-efficient.
- **Abrupt failure** — budget runs out and the agent crashes instead of adapting.

This plugin solves all five — and goes further. Every model call and tool invocation is budget-checked *before* execution. When budget runs low, models are automatically downgraded, expensive tools are disabled, and the agent is told about its remaining budget via prompt hints so it can self-regulate. Side-effects are capped per tool via `toolCallLimits`. Spend is isolated per user, session, or team. And every session produces a full cost breakdown.

Beyond enforcement, the plugin actively protects you:

- **Burn rate anomaly detection** catches runaway tool loops before they exhaust budget — if spending spikes 3x above the session average, `onBurnRateAnomaly` fires immediately
- **Predictive exhaustion warnings** estimate when budget will run out and fire `onExhaustionForecast` before it happens, so you can fund the budget or wind down gracefully
- **Automatic retry with backoff** on transient Cycles server errors (429/503/504) prevents spurious denials during load spikes
- **Reservation heartbeat** auto-extends long-running tool reservations so cost tracking doesn't silently break when a tool exceeds the default 60s TTL
- **Full observability** via `metricsEmitter` (pipe 12 metrics into Datadog, Prometheus, Grafana, or any OTLP collector) and opt-in session event logs for debugging exactly what happened
- **Unconfigured tool detection** reports which tools are using default cost estimates so you can tune `toolBaseCosts` after every session

The result: predictable spend, controlled behavior, and full visibility — even when agents run autonomously for hours.

Install, configure 3 fields, done. No agent code changes required.

::: tip When to use this vs. the Cycles client directly
If you're building a custom agent framework, use the [Cycles TypeScript client](/how-to/using-the-cycles-client-programmatically) directly. If you're running OpenClaw, this plugin gives you the same enforcement with zero custom code — just configure and go.
:::

For background on why rate limits and provider caps aren't enough, see [Exposure: Why Rate Limits Leave Agents Unbounded](/concepts/exposure-why-rate-limits-leave-agents-unbounded) and [Cycles vs. Provider Spending Caps](/concepts/cycles-vs-provider-spending-caps).

## Quick start

Get budget enforcement running in under a minute:

```bash
openclaw plugins install @runcycles/openclaw-budget-guard
openclaw plugins enable openclaw-budget-guard
```

Add minimal configuration to your OpenClaw config file (typically `openclaw.json` or `openclaw.config.json`):

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "cyclesBaseUrl": "http://localhost:7878",
          "cyclesApiKey": "cyc_live_...",
          "tenant": "my-org",
          "currency": "USD_MICROCENTS"
        }
      }
    }
  }
}
```

That's it — all model and tool calls are now budget-guarded. Read on for advanced features like model fallbacks, tool access control, and budget-aware prompt hints.

## Prerequisites

- A Cycles API key — create one via the Admin Server. See [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack#step-3-create-an-api-key) or [API Key Management](/how-to/api-key-management-in-cycles).

You also need:
- **OpenClaw** >= 0.1.0 with plugin support
- **Node.js** >= 20.0.0

## Install and enable

```bash
# Install the plugin
openclaw plugins install @runcycles/openclaw-budget-guard

# Enable it
openclaw plugins enable openclaw-budget-guard
```

Or install from a local checkout:

```bash
openclaw plugins install -l ./cycles-openclaw-budget-guard
openclaw plugins enable openclaw-budget-guard
```

## Minimal configuration

Add the plugin to your OpenClaw config file (typically `openclaw.config.json`). Three fields are required — everything else has sensible defaults:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "cyclesBaseUrl": "http://localhost:7878",
          "cyclesApiKey": "your-api-key",
          "tenant": "acme"
        }
      }
    }
  }
}
```

> **Important:** Budget exhaustion is enforced fail-closed by default, but Cycles server connectivity failures are handled fail-open — the plugin assumes healthy budget and allows execution to continue. See [Fail-open vs fail-closed](#fail-open-vs-fail-closed) for details.

## Understanding the cost model

Every model call and tool call reserves a fixed cost from the budget. The default currency is `USD_MICROCENTS` — 1 unit = $0.00001.

| Amount | USD |
|--------|-----|
| 100,000 | $0.001 |
| 1,000,000 | $0.01 |
| 10,000,000 | $0.10 |
| 100,000,000 | $1.00 |

**Example.** With a $5 budget (500,000,000 units) and `claude-opus` at 1,500,000/call, you can afford ~333 model calls. The `lowBudgetThreshold` (default 10,000,000 = $0.10) triggers model downgrade when budget is nearly exhausted.

**Setting tool costs.** Start with defaults (100,000/call). After your first session, check `sessionSummary.unconfiguredTools` for the list of tools that need explicit costs. External API tools (web search, code execution) typically cost 500K-1M. Lightweight tools (text formatting, math) cost 10K-50K.

## What the plugin does

The plugin hooks into five OpenClaw lifecycle events to enforce budget boundaries:

| Hook | What happens |
|------|-------------|
| `before_model_resolve` | Fetches balance, reserves budget for the model call, downgrades the model if budget is low, blocks if exhausted (via [model override workaround](#model-blocking-workaround-v073)). The reservation is held open for later commit (see [Model cost reconciliation](#model-cost-reconciliation-v050)). |
| `before_prompt_build` | Commits any pending model reservation from the previous turn (with `modelCostEstimator` reconciliation if configured). Injects a budget-awareness hint into the system prompt, including forecast projections and pool balances. |
| `before_tool_call` | Checks tool permissions (allowlist/blocklist), applies degradation strategies, creates a Cycles reservation. Optionally retries on denial. |
| `after_tool_call` | Commits the reservation with actual cost (via `costEstimator` callback if configured, otherwise uses the estimate). |
| `agent_end` | Releases orphaned reservations, builds a session summary with cost breakdown and forecasts, fires analytics callbacks/webhooks. |

Both model and tool calls follow the standard Cycles reserve → commit → release protocol. The plugin manages an in-memory map of active reservations so that every reservation is properly settled or released at `agent_end`.

## Budget levels and model downgrading

The plugin classifies budget into three levels:

| Level | Condition | Behavior |
|-------|-----------|----------|
| **healthy** | `remaining > lowBudgetThreshold` | Pass through — no changes |
| **low** | `exhaustedThreshold < remaining ≤ lowBudgetThreshold` | Apply low-budget strategies (model downgrade, token limits, tool restrictions) |
| **exhausted** | `remaining ≤ exhaustedThreshold` | Block execution (or warn, if `failClosed: false`) |

### Chained model fallbacks

Model fallbacks support both single values and ordered chains. When budget is low, the plugin iterates through candidates and selects the first one whose cost fits within the remaining budget:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "modelFallbacks": {
            "claude-opus-4-20250514": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
            "gpt-4o": "gpt-4o-mini"
          },
          "modelBaseCosts": {
            "claude-opus-4-20250514": 1500000,
            "claude-sonnet-4-20250514": 300000,
            "claude-haiku-4-5-20251001": 100000,
            "gpt-4o": 1000000,
            "gpt-4o-mini": 100000
          }
        }
      }
    }
  }
}
```

When the budget drops below `lowBudgetThreshold` (default: 10,000,000 units), any model request matching a key in `modelFallbacks` is transparently swapped to the cheapest affordable alternative.

## Tool cost estimation

Configure per-tool cost estimates via `toolBaseCosts`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "toolBaseCosts": {
            "web_search": 500000,
            "code_execution": 1000000,
            "file_read": 50000
          }
        }
      }
    }
  }
}
```

Any tool not listed defaults to 100,000 units.

::: warning Type safety note
Config values in `toolBaseCosts` and `modelBaseCosts` are not runtime-validated. If a value is accidentally a string (e.g., `"500000"` instead of `500000`), cost arithmetic will silently produce `NaN`. Ensure all cost values are numbers, not quoted strings.
:::

For more accurate cost tracking, provide a `costEstimator` callback programmatically:

```typescript
{
  costEstimator: (ctx) => {
    // ctx: { toolName, estimate, durationMs, result }
    if (ctx.toolName === "web_search" && ctx.durationMs) {
      return Math.ceil(ctx.durationMs * 100); // cost proportional to duration
    }
    return undefined; // fall back to estimate
  }
}
```

The `costEstimator` receives the tool name, original estimate, execution duration, and result. Return a number for actual cost or `undefined` to use the estimate.

## Tool access control

Control which tools can be called using allowlists and blocklists with glob-style patterns:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "toolAllowlist": ["web_search", "code_*"],
          "toolBlocklist": ["dangerous_*"]
        }
      }
    }
  }
}
```

- Blocklist takes precedence over allowlist
- Supports exact names and `*` wildcards (prefix: `code_*`, suffix: `*_tool`, all: `*`)
- Tools blocked by access lists are rejected before any budget reservation is attempted

## Tool call limits

Cap the number of times a specific tool can be invoked per session. Useful for consequential actions like sending emails or triggering deployments:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "toolCallLimits": {
            "send_email": 10,
            "deploy": 3
          }
        }
      }
    }
  }
}
```

Once a tool reaches its limit, further calls are blocked with a descriptive reason. Tools without a limit are unrestricted. Limits reset on each new agent session.

::: tip Combine with cost limits
Tool call limits complement cost-based budgeting. Use `toolBaseCosts` to control spend and `toolCallLimits` to cap side-effects independently — an agent can exhaust its budget before hitting call limits, or vice versa.
:::

## Graceful degradation strategies

When budget is low, the plugin can apply multiple composable strategies beyond model downgrading:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "lowBudgetStrategies": ["downgrade_model", "reduce_max_tokens", "disable_expensive_tools"],
          "maxTokensWhenLow": 1024,
          "expensiveToolThreshold": 1000000
        }
      }
    }
  }
}
```

Available strategies:

| Strategy | Effect |
|----------|--------|
| `downgrade_model` | Use cheaper fallback models from `modelFallbacks` (default) |
| `reduce_max_tokens` | Append token limit guidance to prompt hints |
| `disable_expensive_tools` | Block tools exceeding `expensiveToolThreshold` |
| `limit_remaining_calls` | Cap total tool/model calls via `maxRemainingCallsWhenLow` (default: 10) |

Strategies are composable — list multiple values to combine them.

## Prompt budget hints

When `injectPromptBudgetHint` is enabled (the default), the plugin prepends a compact hint to the system prompt so the model itself is aware of budget constraints:

```
Budget: 5000000 USD_MICROCENTS remaining. Budget is low — prefer cheaper models and avoid expensive tools. 50% of budget remaining. Est. ~10 tool calls and ~5 model calls remaining at current rate. Team pool: 50000000 remaining.
```

The hint includes:
- Current remaining balance and percentage
- Budget level warnings
- Forecast projections based on average call costs so far
- Team pool balance (when `parentBudgetId` is configured)
- Token limit guidance (when `reduce_max_tokens` strategy is active)

This helps models self-regulate — choosing cheaper tools, shorter responses, or skipping optional steps when budget is tight.

## Per-user and per-session scoping

Scope budgets to individual users or sessions:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "userId": "user-123",
          "sessionId": "session-456"
        }
      }
    }
  }
}
```

User and session identifiers can also be set dynamically via `ctx.metadata.userId` and `ctx.metadata.sessionId` at runtime — context values override static config.

These identifiers are threaded into Cycles reservation subjects as dimensions, enabling per-user or per-session budget enforcement.

## Reservation settings

Configure reservation behavior per-tool or globally:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "reservationTtlMs": 60000,
          "toolReservationTtls": {
            "code_execution": 120000
          },
          "overagePolicy": "ALLOW_IF_AVAILABLE",
          "toolOveragePolicies": {
            "web_search": "ALLOW_IF_AVAILABLE"
          }
        }
      }
    }
  }
}
```

Overage policies control what happens when a reservation exceeds the remaining budget:
- `ALLOW_IF_AVAILABLE` — allow up to the remaining balance (default)
- `REJECT` — deny the reservation
- `ALLOW_WITH_OVERDRAFT` — allow and create a debt

## Retry on denied reservations

Optionally retry tool reservations that are denied, useful when budget is being replenished or released concurrently:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "retryOnDeny": true,
          "retryDelayMs": 2000,
          "maxRetries": 1
        }
      }
    }
  }
}
```

::: warning Latency note
Retries block the `before_tool_call` hook synchronously. With the defaults (`retryDelayMs: 2000`, `maxRetries: 1`), a denied tool call pauses for 2 seconds before returning a block result. For interactive agents where responsiveness matters, consider lowering `retryDelayMs` or keeping `retryOnDeny: false` (the default) and handling denials at the application level instead.
:::

## Budget transition alerts

Get notified when the budget level changes (e.g., healthy → low → exhausted):

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "budgetTransitionWebhookUrl": "https://hooks.example.com/budget-alert"
        }
      }
    }
  }
}
```

Or set a callback programmatically:

```typescript
{
  onBudgetTransition: (event) => {
    // event: { previousLevel, currentLevel, remaining, timestamp }
    console.log(`Budget changed: ${event.previousLevel} → ${event.currentLevel}`);
  }
}
```

Webhooks are fire-and-forget (best-effort). For guaranteed delivery, use the callback.

::: info Note
Transition detection runs on every budget snapshot refresh (controlled by `snapshotCacheTtlMs`, default 5 seconds). If a budget oscillates rapidly around a threshold between cache refreshes, the same transition (e.g., healthy → low) may fire more than once. Callbacks should be idempotent or deduplicate by timestamp if this matters for your use case.
:::

## Session analytics and cost breakdown

The plugin tracks per-tool and per-model cost breakdowns throughout the session. At `agent_end`, it builds a `SessionSummary` containing:

- Tenant, budget, user, and session identifiers
- Final remaining/spent/reserved balances
- Total reservations made
- Per-component cost breakdown (e.g., `tool:web_search`, `model:claude-sonnet-4-20250514`)
- Per-tool invocation counts (e.g., `{ web_search: 15, code_execution: 3 }`)
- Session timing (start/end timestamps)
- Average cost and estimated remaining calls

The summary is attached to `ctx.metadata["openclaw-budget-guard"]` and can also be exported via callback or webhook:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "analyticsWebhookUrl": "https://analytics.example.com/sessions"
        }
      }
    }
  }
}
```

Or programmatically:

```typescript
{
  onSessionEnd: async (summary) => {
    await db.insert("agent_sessions", summary);
  }
}
```

## End-user budget visibility

Budget status is automatically attached to `ctx.metadata["openclaw-budget-guard-status"]` on every hook invocation, making it available to OpenClaw frontends for UI display:

```json
{
  "level": "low",
  "remaining": 5000000,
  "allocated": 10000000,
  "percentRemaining": 50
}
```

## Multi-currency support

Override the default currency per-tool or per-model:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "currency": "USD_MICROCENTS",
          "modelCurrency": "TOKENS",
          "toolCurrencies": {
            "web_search": "CREDITS"
          }
        }
      }
    }
  }
}
```

Each reservation uses the appropriate currency unit. Cost tracking respects the per-component currency.

## Budget pools

Surface hierarchical budget information by setting a parent budget ID:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "budgetId": "team-alpha-agent",
          "parentBudgetId": "team-alpha"
        }
      }
    }
  }
}
```

When `parentBudgetId` is set, the pool balance is included in budget snapshots and prompt hints (e.g., "Team pool: 50000000 remaining."). Reservations target the individual scope — the Cycles server handles hierarchical deduction from the pool.

## Dry-run mode

Test the plugin without a live Cycles server:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "cyclesBaseUrl": "http://unused",
          "cyclesApiKey": "unused",
          "dryRun": true,
          "dryRunBudget": 100000000
        }
      }
    }
  }
}
```

In dry-run mode, budget is tracked in-memory using a simulated client. All plugin behavior (classification, reservation, fallbacks, strategies) works identically — only the Cycles server communication is replaced. This is useful for development, testing, and evaluating the plugin before deploying a Cycles server.

## Fail-open vs fail-closed

The plugin distinguishes between two failure modes:

**Budget confirmed exhausted** — controlled by `failClosed` (default: `true`):
- `failClosed: true` → throws `BudgetExhaustedError`, blocking the agent
- `failClosed: false` → logs a warning but allows execution to continue

**Cycles server unreachable** — always fail-open:
- If the balance check or reservation fails due to a network error, the plugin assumes healthy budget
- This prevents transient infrastructure issues from blocking all agents

This matches the Cycles philosophy: budget enforcement should be a guardrail, not a single point of failure.

## Error handling

The plugin exports two structured error types:

```typescript
import { BudgetExhaustedError, ToolBudgetDeniedError } from "@runcycles/openclaw-budget-guard";
```

- **`BudgetExhaustedError`** (`code: "BUDGET_EXHAUSTED"`) — thrown when budget is exhausted and `failClosed: true`. Includes `remaining`, `tenant`, and `budgetId` properties. The message includes an actionable hint to increase budget via the Cycles API.
- **`ToolBudgetDeniedError`** (`code: "TOOL_BUDGET_DENIED"`) — structured error type for tool denials. Includes `toolName` property.

## Verifying the integration

Set `logLevel: "debug"` to see the plugin's activity:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme",
          "logLevel": "debug"
        }
      }
    }
  }
}
```

On startup, the plugin logs a config summary so you can verify settings at a glance:

```
  Cycles Budget Guard for OpenClaw v0.6.1
  https://runcycles.io
  tenant: acme
  cyclesBaseUrl: http://localhost:7878
  cyclesApiKey: ****_key
  currency: USD_MICROCENTS
  failClosed: true
  dryRun: false
  logLevel: debug
  lowBudgetThreshold: 10000000
  exhaustedThreshold: 0
```

The plugin also warns about common misconfigurations on startup (e.g., `downgrade_model` strategy with no `modelFallbacks`, or no `toolBaseCosts` configured).

With `logLevel: "debug"`, you'll see per-call activity:

```
[openclaw-budget-guard] before_model_resolve: model=claude-sonnet-4-20250514 level=healthy
[openclaw-budget-guard] before_prompt_build: injecting hint (142 chars)
[openclaw-budget-guard] Tool "web_search" has no entry in toolBaseCosts — using default estimate (100000 USD_MICROCENTS)
[openclaw-budget-guard] before_tool_call: tool=web_search callId=abc123 estimate=100000
[openclaw-budget-guard] after_tool_call: committed 100000 for tool=web_search
[openclaw-budget-guard] Agent session budget summary: remaining=9500000 spent=500000 reservations=1
```

## Full configuration reference

### Core settings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch |
| `cyclesBaseUrl` | string | — | Cycles server URL (required) |
| `cyclesApiKey` | string | — | Cycles API key (required) |
| `tenant` | string | — | Cycles tenant (required) |
| `budgetId` | string | — | Optional app-level budget scope |
| `currency` | string | `USD_MICROCENTS` | Default budget unit |
| `failClosed` | boolean | `true` | Block on exhausted budget |
| `logLevel` | string | `info` | `debug` / `info` / `warn` / `error` |

### Budget thresholds

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lowBudgetThreshold` | number | `10000000` | Below this → low budget mode |
| `exhaustedThreshold` | number | `0` | At or below this → exhausted |

### Model configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `modelFallbacks` | object | `{}` | Model → fallback model or chain (string or string[]) |
| `modelBaseCosts` | object | `{}` | Model name → estimated cost per call |
| `defaultModelCost` | number | `500000` | Fallback cost when model not in `modelBaseCosts` |
| `defaultModelName` | string | — | Model name for budget reservations. Required because OpenClaw's `before_model_resolve` event doesn't include the model name. Set to your agent's model (e.g. `"openai/gpt-5-nano"`). |
| `defaultModelActionKind` | string | `llm.completion` | Action kind for model reservations |
| `modelCurrency` | string | — | Override currency for model reservations |

### Tool configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `toolBaseCosts` | object | `{}` | Tool name → estimated cost per call |
| `defaultToolActionKindPrefix` | string | `tool.` | Prefix for tool action kinds |
| `toolAllowlist` | string[] | — | Only these tools are permitted (supports `*` wildcards) |
| `toolBlocklist` | string[] | — | These tools are blocked (supports `*` wildcards) |
| `toolCurrencies` | object | — | Tool name → currency override |
| `toolReservationTtls` | object | — | Tool name → TTL override (ms) |
| `toolOveragePolicies` | object | — | Tool name → overage policy override |
| `costEstimator` | function | — | Custom callback for dynamic cost estimation |
| `toolCallLimits` | object | — | Map: tool name → max invocations per session |

### Prompt hints

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `injectPromptBudgetHint` | boolean | `true` | Inject budget status into the system prompt |
| `maxPromptHintChars` | number | `200` | Max characters for the budget hint |

### Reservation settings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `reservationTtlMs` | number | `60000` | Default reservation TTL (ms) |
| `overagePolicy` | string | `ALLOW_IF_AVAILABLE` | Default overage policy (`REJECT`, `ALLOW_IF_AVAILABLE`, `ALLOW_WITH_OVERDRAFT`) |
| `snapshotCacheTtlMs` | number | `5000` | Budget snapshot cache TTL (ms) |

### Low-budget strategies

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lowBudgetStrategies` | string[] | `["downgrade_model"]` | Strategies to apply when budget is low |
| `maxTokensWhenLow` | number | `1024` | Token limit when `reduce_max_tokens` is active |
| `expensiveToolThreshold` | number | — | Cost threshold for `disable_expensive_tools` |
| `maxRemainingCallsWhenLow` | number | `10` | Max calls when `limit_remaining_calls` is active |

### Retry on deny

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `retryOnDeny` | boolean | `false` | Retry tool reservations after denial |
| `retryDelayMs` | number | `2000` | Delay between retries (ms) |
| `maxRetries` | number | `1` | Maximum retry attempts |

### Dry-run mode

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dryRun` | boolean | `false` | Use in-memory simulated budget |
| `dryRunBudget` | number | `100000000` | Starting budget for dry-run mode |

### Per-user/session scoping

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `userId` | string | — | User ID for budget scoping (overridable via `ctx.metadata.userId`) |
| `sessionId` | string | — | Session ID for budget scoping (overridable via `ctx.metadata.sessionId`) |

### Budget transitions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `onBudgetTransition` | function | — | Callback on budget level changes |
| `budgetTransitionWebhookUrl` | string | — | Webhook URL for level transitions |

### Session analytics

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `onSessionEnd` | function | — | Callback with session summary at agent end |
| `analyticsWebhookUrl` | string | — | Webhook URL for session summary data |

### Budget pools

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parentBudgetId` | string | — | Parent budget ID for pool balance visibility |

### Advanced / operational settings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `aggressiveCacheInvalidation` | boolean | `false` | Invalidate budget snapshot cache after every mutation |
| `heartbeatIntervalMs` | number | `30000` | Interval for reservation TTL heartbeat extensions |
| `retryableStatusCodes` | number[] | `[429, 502, 503, 504]` | HTTP status codes eligible for transient retry |
| `transientRetryMaxAttempts` | number | `2` | Max retries on transient server errors |
| `transientRetryBaseDelayMs` | number | `500` | Base delay for transient retries (ms) |
| `burnRateWindowMs` | number | `60000` | Window for burn-rate anomaly detection |
| `burnRateAlertThreshold` | number | — | Alert when burn rate exceeds this (per-window) |
| `enableEventLog` | boolean | `false` | Log all budget events for debugging |
| `exhaustionWarningThresholdMs` | number | — | Warn when time-to-exhaustion falls below this |
| `otlpMetricsEndpoint` | string | — | OpenTelemetry OTLP endpoint for budget metrics |
| `otlpMetricsHeaders` | object | — | Custom headers for OTLP exporter |

## Comparison with manual integration

If you're already using the Cycles TypeScript client directly (see [Programmatic Client Usage](/how-to/using-the-cycles-client-programmatically)), the plugin automates the same reserve → commit → release pattern but at the OpenClaw hook level:

| Concern | Manual client | OpenClaw plugin |
|---------|--------------|-----------------|
| Reserve before LLM call | Your code | `before_model_resolve` hook |
| Reserve before tool call | Your code | `before_tool_call` hook |
| Commit after completion | Your code | `after_tool_call` hook |
| Release orphans | Your code | `agent_end` hook |
| Model downgrade on low budget | Your code | Automatic via `modelFallbacks` |
| Prompt budget awareness | Your code | Automatic via `injectPromptBudgetHint` |
| Cost breakdown tracking | Your code | Automatic per-tool/model tracking |
| Session analytics | Your code | Automatic via `onSessionEnd` / webhook |
| Tool access control | Your code | Automatic via `toolAllowlist` / `toolBlocklist` |

The plugin is the recommended approach for OpenClaw users — it requires zero custom code and covers the full lifecycle automatically.

## Config presets

Common starting configurations for typical deployment scenarios.

### Strict enforcement

For production agents handling real spend. Blocks on exhaustion, downgrades models, caps tool calls:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "my-org",
          "failClosed": true,
          "lowBudgetStrategies": ["downgrade_model", "disable_expensive_tools", "limit_remaining_calls"],
          "modelFallbacks": {
            "claude-opus-4-20250514": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]
          },
          "modelBaseCosts": {
            "claude-opus-4-20250514": 1500000,
            "claude-sonnet-4-20250514": 300000,
            "claude-haiku-4-5-20251001": 100000
          },
          "toolBaseCosts": {
            "web_search": 500000,
            "code_execution": 1000000
          },
          "toolCallLimits": {
            "send_email": 10,
            "deploy": 3
          },
          "maxRemainingCallsWhenLow": 5
        }
      }
    }
  }
}
```

### Development / testing

Dry-run mode with generous budget. No Cycles server needed:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "dev",
          "cyclesBaseUrl": "http://unused",
          "cyclesApiKey": "unused",
          "dryRun": true,
          "dryRunBudget": 500000000,
          "logLevel": "debug"
        }
      }
    }
  }
}
```

### Cost-conscious

Aggressive cost savings. Low thresholds, model downgrade with token limits, expensive tools disabled early:

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "my-org",
          "lowBudgetThreshold": 5000000,
          "exhaustedThreshold": 100000,
          "lowBudgetStrategies": ["downgrade_model", "reduce_max_tokens", "disable_expensive_tools"],
          "maxTokensWhenLow": 512,
          "expensiveToolThreshold": 200000,
          "modelFallbacks": {
            "claude-opus-4-20250514": "claude-haiku-4-5-20251001",
            "gpt-4o": "gpt-4o-mini"
          }
        }
      }
    }
  }
}
```

## Model cost reconciliation (v0.5.0)

By default, model costs are estimated at reservation time based on `modelBaseCosts` or `defaultModelCost`. Since OpenClaw doesn't provide token counts after model completion, exact costs aren't available automatically.

v0.5.0 introduces the **reserve-then-commit** pattern for models: the plugin reserves budget in `before_model_resolve` but doesn't commit until the next `before_prompt_build` (or `agent_end` for the last turn). This opens a reconciliation window where you can use `modelCostEstimator` to adjust the cost.

```json
{
  "config": {
    "modelBaseCosts": {
      "claude-sonnet-4-20250514": 300000,
      "claude-opus-4-20250514": 1500000
    }
  }
}
```

For programmatic cost reconciliation (e.g., reading token counts from a proxy layer):

```typescript
import plugin from "@runcycles/openclaw-budget-guard";

plugin({
  ...api,
  pluginConfig: {
    tenant: "my-org",
    cyclesBaseUrl: "http://localhost:7878",
    cyclesApiKey: "cyc_...",
    modelCostEstimator: ({ model, estimatedCost, turnIndex }) => {
      // Look up actual token usage from your proxy/gateway
      const usage = getTokenUsageFromProxy(turnIndex);
      if (!usage) return undefined; // fall back to estimate
      return usage.inputTokens * getInputPrice(model) +
             usage.outputTokens * getOutputPrice(model);
    },
  },
});
```

When a `modelCostEstimator` is provided, the plugin calls it at commit time. Return a number to override the estimate, or `undefined` to use the original estimate. Errors are caught and logged — the estimate is used as fallback.

## Observability with MetricsEmitter (v0.5.0)

The plugin can emit structured metrics to any observability backend (Datadog, Prometheus, Grafana, OpenTelemetry) via the `metricsEmitter` callback.

### Using a custom emitter

```typescript
const emitter = {
  gauge(name, value, tags) { /* send to your backend */ },
  counter(name, delta, tags) { /* send to your backend */ },
  histogram(name, value, tags) { /* send to your backend */ },
};

// Pass as config
{ metricsEmitter: emitter }
```

### Using the built-in OTLP adapter

For zero-config OpenTelemetry integration, set `otlpMetricsEndpoint`:

```json
{
  "config": {
    "otlpMetricsEndpoint": "http://localhost:4318/v1/metrics",
    "otlpMetricsHeaders": {
      "Authorization": "Bearer <token>"
    }
  }
}
```

The plugin auto-creates a lightweight OTLP HTTP adapter that buffers metrics and flushes them periodically. No OpenTelemetry SDK dependency required.

### Emitted metrics

| Metric | Type | Tags | When |
|--------|------|------|------|
| `cycles.budget.remaining` | gauge | tenant, budgetId, currency | Every snapshot fetch |
| `cycles.budget.reserved` | gauge | tenant, budgetId | Every snapshot fetch |
| `cycles.budget.spent` | gauge | tenant, budgetId | Every snapshot fetch |
| `cycles.budget.level` | gauge (0/1/2) | tenant, budgetId, level | Every snapshot fetch |
| `cycles.reservation.created` | counter | tenant, kind, name | On reserve |
| `cycles.reservation.committed` | counter | tenant, kind, name | On commit |
| `cycles.reservation.denied` | counter | tenant, kind, name, reason | On deny |
| `cycles.reservation.cost` | histogram | tenant, kind, name | On commit |
| `cycles.model.downgrade` | counter | tenant, from, to | On model downgrade |
| `cycles.tool.blocked` | counter | tenant, tool, reason | On tool block |
| `cycles.session.duration_ms` | histogram | tenant | On agent_end |
| `cycles.session.total_cost` | histogram | tenant | On agent_end |

## Aggressive cache invalidation (v0.5.0)

By default (`aggressiveCacheInvalidation: true`), the plugin refetches the budget snapshot from the Cycles server after every commit or release. This reduces the "stale window" from the `snapshotCacheTtlMs` (default 5s) to near-zero for single-agent scenarios.

For high-throughput setups where the extra network call is undesirable, disable it:

```json
{
  "config": {
    "aggressiveCacheInvalidation": false,
    "snapshotCacheTtlMs": 2000
  }
}
```

## Resilience: retry and heartbeat (v0.6.0)

### Automatic retry on transient errors

The plugin retries Cycles server requests on transient HTTP errors (429, 503, 504) with exponential backoff:

```json
{
  "config": {
    "retryableStatusCodes": [429, 503, 504],
    "transientRetryMaxAttempts": 2,
    "transientRetryBaseDelayMs": 500
  }
}
```

With default settings, a 429 response triggers up to 2 retries with 500ms and 1000ms delays. The idempotency key is preserved across retries so the Cycles server deduplicates safely.

### Heartbeat for long-running tools

Tools that run longer than the reservation TTL (default 60s) previously lost cost tracking silently. v0.6.0 auto-extends reservations:

```json
{
  "config": {
    "heartbeatIntervalMs": 30000
  }
}
```

Every 30 seconds, the plugin calls the Cycles `extend` endpoint to keep the reservation alive. The timer is automatically stopped when the tool completes or at `agent_end`. Set to `0` to disable.

## Anomaly detection (v0.6.0)

### Burn rate monitoring

Detect runaway tool loops by monitoring cost-per-window:

```json
{
  "config": {
    "burnRateWindowMs": 60000,
    "burnRateAlertThreshold": 3.0
  }
}
```

If the cost rate in the current window exceeds 3x the previous window, the plugin fires `onBurnRateAnomaly` and emits `cycles.budget.burn_rate_anomaly`. Use the callback for custom responses:

```typescript
{
  onBurnRateAnomaly: (event) => {
    // event: { currentBurnRate, averageBurnRate, ratio, threshold, remaining }
    alertOps(`Agent burn rate spiked ${event.ratio.toFixed(1)}x — ${event.remaining} remaining`);
  }
}
```

### Predictive exhaustion warning

Get advance notice before budget runs out:

```json
{
  "config": {
    "exhaustionWarningThresholdMs": 120000
  }
}
```

When estimated time-to-exhaustion drops below 120 seconds (based on current burn rate), the plugin fires `onExhaustionForecast`. The warning fires once per session.

## Session event log (v0.6.0)

Enable a full audit trail of every budget decision:

```json
{
  "config": {
    "enableEventLog": true
  }
}
```

When enabled, `sessionSummary.eventLog` contains every reserve, commit, deny, block, and release event with timestamps, budget levels, and amounts. The log is capped at 10,000 entries. Useful for debugging budget exhaustion and understanding agent behavior.

Example event:
```json
{
  "timestamp": 1711468850000,
  "hook": "before_tool_call",
  "action": "reserve",
  "kind": "tool",
  "name": "web_search",
  "amount": 500000,
  "decision": "ALLOW",
  "budgetLevel": "healthy",
  "remaining": 45000000
}
```

The session summary also includes `unconfiguredTools` — a list of tools that used the default cost estimate (100,000 units) because they had no entry in `toolBaseCosts`. Use this to identify configuration gaps.

## Model blocking workaround (v0.7.3)

OpenClaw's `before_model_resolve` hook does not support `{ block: true }` like `before_tool_call` does ([feature request](https://github.com/openclaw/openclaw/issues/55771)). When budget is exhausted, the plugin cannot directly prevent the model call.

**Workaround:** The plugin returns `{ modelOverride: "__cycles_budget_exhausted__" }`, which causes the LLM provider to reject the request with "Unknown model." The agent receives no response and no budget is spent.

The user sees:
```
Agent failed before reply: Unknown model: openai/__cycles_budget_exhausted__
```

This is intentional. When OpenClaw adds `block` support to `before_model_resolve`, the plugin will switch to a clean blocking mechanism with a proper error message.

**Note:** OpenClaw's `before_model_resolve` event also does not include the model name — it only passes `{ prompt }`. Set `defaultModelName` in your plugin config so the plugin knows which model to track:

```json
{
  "config": {
    "defaultModelName": "openai/gpt-5-nano"
  }
}
```

## What to do when budget is exhausted

1. **Fund the budget** via the Cycles Admin API:
   ```bash
   curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:my-org&unit=USD_MICROCENTS" \
     -H "X-Cycles-API-Key: your-admin-key" \
     -H "Content-Type: application/json" \
     -d '{"operation": "CREDIT", "amount": 50000000, "idempotency_key": "topup-001"}'
   ```
   This adds 50,000,000 units ($0.50) to the budget. Adjust the `scope` to match your `tenant` and `budgetId`.

2. **Start a new agent session** — the plugin fetches fresh budget state at the start of each session.

For details, see [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles).

## Troubleshooting

**"Skipping registration" warning during install**
- This is normal. OpenClaw loads the plugin during install before your config is written. The plugin detects the missing config, logs a warning, and skips registration. After you add your config and restart the gateway, the plugin will register normally.

**Plugin not loading**
- Verify the plugin is enabled: `openclaw plugins list`
- Check that `openclaw.plugin.json` is included in the installed package

**"cyclesBaseUrl is required" error**
- Set `cyclesBaseUrl` in your plugin config (use `"${CYCLES_BASE_URL}"` for env var interpolation)

**"tenant is required" error**
- Add `"tenant": "your-org"` to the plugin config

**Budget always shows "healthy"**
- Verify `currency`, `tenant`, and `budgetId` match your Cycles setup
- Set `logLevel: "debug"` to see raw balance responses

**Tools not being blocked**
- Check `toolBaseCosts` includes your tool (default cost is 100,000 units)
- Check `failClosed` is `true` (default)

**"No toolBaseCosts configured" warning**
- This is informational. Without `toolBaseCosts`, all tools use the default cost estimate (100,000 units). Add entries for your tools to improve budgeting accuracy.

**Model not being downgraded**
- The exact model name must match a key in `modelFallbacks`
- Check model costs in `modelBaseCosts` — fallback must be cheaper than remaining budget
- If you see "no modelFallbacks configured" warning, add a `modelFallbacks` entry

## Next steps

- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — strategies beyond simple model downgrade
- [Estimate Exposure Before Execution](/how-to/how-to-estimate-exposure-before-execution-practical-reservation-strategies-for-cycles) — how to set `toolBaseCosts` effectively
- [Shadow Mode](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) — roll out enforcement without breaking production
- [Runaway Agents and Tool Loops](/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent) — the incidents this plugin helps prevent
