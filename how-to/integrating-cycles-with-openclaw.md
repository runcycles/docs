# Integrating Cycles with OpenClaw

This guide shows how to add budget enforcement to OpenClaw agents using the [`cycles-openclaw-budget-guard`](https://github.com/runcycles/cycles-openclaw-budget-guard) plugin. The plugin handles the full reserve → commit → release lifecycle automatically, with no custom code required.

## Prerequisites

```bash
npm install @runcycles/openclaw-budget-guard
```

```bash
export CYCLES_BASE_URL="http://localhost:7878"
export CYCLES_API_KEY="your-api-key"
export CYCLES_TENANT="acme"
```

You also need OpenClaw >= 0.1.0 with plugin support.

## Install and enable

```bash
# Install the plugin
openclaw plugins install @runcycles/openclaw-budget-guard

# Enable it
openclaw plugins enable cycles-openclaw-budget-guard
```

Or install from a local checkout:

```bash
openclaw plugins install -l ./cycles-openclaw-budget-guard
openclaw plugins enable cycles-openclaw-budget-guard
```

## Minimal configuration

Add the plugin to your OpenClaw config file (typically `openclaw.config.json`):

```json
{
  "plugins": {
    "entries": {
      "cycles-openclaw-budget-guard": {
        "tenant": "acme"
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
      "cycles-openclaw-budget-guard": {
        "cyclesBaseUrl": "http://localhost:7878",
        "cyclesApiKey": "your-api-key",
        "tenant": "acme"
      }
    }
  }
}
```

## What the plugin does

The plugin hooks into five OpenClaw lifecycle events to enforce budget boundaries:

| Hook | What happens |
|------|-------------|
| `before_model_resolve` | Fetches balance from Cycles. Downgrades the model if budget is low, blocks if exhausted. |
| `before_prompt_build` | Injects a budget-awareness hint into the system prompt. |
| `before_tool_call` | Creates a Cycles reservation for the tool's estimated cost. Blocks the call if denied. |
| `after_tool_call` | Commits the reservation as actual usage. |
| `agent_end` | Releases orphaned reservations and logs a budget summary. |

Each tool call follows the standard Cycles reserve → commit → release protocol. The plugin manages an in-memory map of active reservations so that every `before_tool_call` reservation is properly settled in `after_tool_call` or released at `agent_end`.

## Budget levels and model downgrading

The plugin classifies budget into three levels:

| Level | Condition | Behavior |
|-------|-----------|----------|
| **healthy** | `remaining > lowBudgetThreshold` | Pass through — no changes |
| **low** | `exhaustedThreshold < remaining ≤ lowBudgetThreshold` | Swap expensive models for cheaper ones via `modelFallbacks` |
| **exhausted** | `remaining ≤ exhaustedThreshold` | Block execution (or warn, if `failClosed: false`) |

To configure model downgrading, add a `modelFallbacks` map:

```json
{
  "plugins": {
    "entries": {
      "cycles-openclaw-budget-guard": {
        "tenant": "acme",
        "modelFallbacks": {
          "claude-opus-4-20250514": "claude-sonnet-4-20250514",
          "gpt-4o": "gpt-4o-mini"
        }
      }
    }
  }
}
```

When the budget drops below `lowBudgetThreshold` (default: 10,000,000 units), any model request matching a key in `modelFallbacks` is transparently swapped to the cheaper alternative.

## Tool cost estimation

Since there is no proxy layer in phase 1, tool costs are estimated upfront. Configure per-tool estimates via `toolBaseCosts`:

```json
{
  "plugins": {
    "entries": {
      "cycles-openclaw-budget-guard": {
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
```

Any tool not listed defaults to 100,000 units. The plugin reserves this amount before the tool call, then commits the same amount afterward (exact metering is planned for phase 2).

## Prompt budget hints

When `injectPromptBudgetHint` is enabled (the default), the plugin prepends a compact hint to the system prompt so the model itself is aware of budget constraints:

```
Budget: 5000000 USD_MICROCENTS remaining. Budget is low — prefer cheaper models and avoid expensive tools. 50% of budget remaining.
```

This helps models self-regulate — choosing cheaper tools, shorter responses, or skipping optional steps when budget is tight.

## Fail-open vs fail-closed

The plugin distinguishes between two failure modes:

**Budget confirmed exhausted** — controlled by `failClosed` (default: `true`):
- `failClosed: true` → throws `BudgetExhaustedError`, blocking the agent
- `failClosed: false` → logs a warning but allows execution to continue

**Cycles server unreachable** — always fail-open:
- If the balance check fails due to a network error, the plugin assumes healthy budget
- This prevents transient infrastructure issues from blocking all agents

This matches the Cycles philosophy: budget enforcement should be a guardrail, not a single point of failure.

## Verifying the integration

Set `logLevel: "debug"` to see the plugin's activity:

```json
{
  "plugins": {
    "entries": {
      "cycles-openclaw-budget-guard": {
        "tenant": "acme",
        "logLevel": "debug"
      }
    }
  }
}
```

You should see log lines like:

```
[cycles-budget-guard] Plugin initialized { tenant: 'acme' }
[cycles-budget-guard] before_model_resolve: model=claude-sonnet-4-20250514 level=healthy
[cycles-budget-guard] before_prompt_build: injecting hint (142 chars)
[cycles-budget-guard] before_tool_call: tool=web_search callId=abc123 estimate=500000
[cycles-budget-guard] after_tool_call: committed 500000 for tool=web_search
[cycles-budget-guard] Agent session budget summary: { remaining: 9500000, spent: 500000, reservations: 1 }
```

## Full configuration reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch |
| `cyclesBaseUrl` | string | `$CYCLES_BASE_URL` | Cycles server URL |
| `cyclesApiKey` | string | `$CYCLES_API_KEY` | Cycles API key |
| `tenant` | string | — | Cycles tenant (required) |
| `budgetId` | string | — | Optional app-level budget scope |
| `currency` | string | `USD_MICROCENTS` | Budget unit |
| `lowBudgetThreshold` | number | `10000000` | Below this → model downgrade |
| `exhaustedThreshold` | number | `0` | At or below this → block |
| `modelFallbacks` | object | `{}` | Expensive model → cheaper model |
| `toolBaseCosts` | object | `{}` | Tool name → estimated cost |
| `injectPromptBudgetHint` | boolean | `true` | Add budget hint to system prompt |
| `maxPromptHintChars` | number | `200` | Max hint length |
| `failClosed` | boolean | `true` | Block on exhausted budget |
| `logLevel` | string | `info` | `debug` / `info` / `warn` / `error` |

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

The plugin is the recommended approach for OpenClaw users — it requires zero custom code and covers the full lifecycle automatically.

## Next steps

- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — strategies beyond simple model downgrade
- [Estimate Exposure Before Execution](/how-to/how-to-estimate-exposure-before-execution-practical-reservation-strategies-for-cycles) — how to set `toolBaseCosts` effectively
- [Shadow Mode](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) — roll out enforcement without breaking production
- [Runaway Agents and Tool Loops](/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent) — the incidents this plugin helps prevent
