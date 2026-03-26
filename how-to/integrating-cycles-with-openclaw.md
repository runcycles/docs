---
title: "Integrating Cycles with OpenClaw"
description: "Add budget enforcement to OpenClaw agents using the cycles-openclaw-budget-guard plugin for automatic reserve, commit, and release."
---

# Integrating Cycles with OpenClaw

This guide shows how to add budget enforcement to OpenClaw agents using the [`cycles-openclaw-budget-guard`](https://github.com/runcycles/cycles-openclaw-budget-guard) plugin. The plugin handles the full reserve → commit → release lifecycle for both model and tool calls automatically, with no custom code required.

## Why budget enforcement?

AI agents make autonomous decisions that cost money — every model call, tool invocation, and retry adds up. Without hard limits, a single [runaway agent](/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent) can blow through an entire budget in minutes. Provider spending caps are account-wide and react too slowly. Rate limits don't account for cost. In-app counters don't survive restarts or coordinate across concurrent agents.

This plugin enforces **hard budget limits at the hook level** — before any model or tool call executes, it reserves budget via a Cycles server. When budget is low, models are automatically downgraded. When budget is exhausted, execution stops. The agent itself is told about remaining budget via prompt hints, so it can self-regulate before hard limits kick in.

The result: predictable spend per user, session, or team — even when agents run autonomously for hours.

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

```bash
export CYCLES_BASE_URL="http://localhost:7878"
export CYCLES_API_KEY="your-api-key"   # create via Admin Server — see note below
```

> **Need an API key?** Create one via the Admin Server — see [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack#step-3-create-an-api-key) or [API Key Management](/how-to/api-key-management-in-cycles).

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

Add the plugin to your OpenClaw config file (typically `openclaw.config.json`):

```json
{
  "plugins": {
    "entries": {
      "openclaw-budget-guard": {
        "config": {
          "tenant": "acme"
        }
      }
    }
  }
}
```

With `CYCLES_BASE_URL` and `CYCLES_API_KEY` set as environment variables, this is the only config you need. The plugin uses sensible defaults for everything else.

If you prefer to inline the connection details:

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

## What the plugin does

The plugin hooks into five OpenClaw lifecycle events to enforce budget boundaries:

| Hook | What happens |
|------|-------------|
| `before_model_resolve` | Fetches balance, reserves budget for the model call, downgrades the model if budget is low, blocks if exhausted. Commits immediately since OpenClaw has no `after_model_resolve` hook. |
| `before_prompt_build` | Injects a budget-awareness hint into the system prompt, including forecast projections and pool balances. |
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

The summary is attached to `ctx.metadata["cycles-budget-guard"]` and can also be exported via callback or webhook:

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

Budget status is automatically attached to `ctx.metadata["cycles-budget-guard-status"]` on every hook invocation, making it available to OpenClaw frontends for UI display:

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
[cycles-budget-guard] v0.3.4 starting
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
[cycles-budget-guard] before_model_resolve: model=claude-sonnet-4-20250514 level=healthy
[cycles-budget-guard] before_prompt_build: injecting hint (142 chars)
[cycles-budget-guard] Tool "web_search" has no entry in toolBaseCosts — using default estimate (100000 USD_MICROCENTS)
[cycles-budget-guard] before_tool_call: tool=web_search callId=abc123 estimate=100000
[cycles-budget-guard] after_tool_call: committed 100000 for tool=web_search
[cycles-budget-guard] Agent session budget summary: remaining=9500000 spent=500000 reservations=1
```

## Full configuration reference

### Core settings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch |
| `cyclesBaseUrl` | string | `$CYCLES_BASE_URL` | Cycles server URL |
| `cyclesApiKey` | string | `$CYCLES_API_KEY` | Cycles API key |
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

## Troubleshooting

**"Skipping registration" warning during install**
- This is normal. OpenClaw loads the plugin during install before your config is written. The plugin detects the missing config, logs a warning, and skips registration. After you add your config and restart the gateway, the plugin will register normally.

**Plugin not loading**
- Verify the plugin is enabled: `openclaw plugins list`
- Check that `openclaw.plugin.json` is included in the installed package

**"cyclesBaseUrl is required" error**
- Set `cyclesBaseUrl` in config or export `CYCLES_BASE_URL` env var

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
