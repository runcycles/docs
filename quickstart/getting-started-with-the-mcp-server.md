---
title: "Getting Started with the Cycles MCP Server"
description: "Add budget enforcement to Claude Desktop, Claude Code, Cursor, Windsurf, and any MCP-compatible AI agent — no SDK code changes required."
---

# Getting Started with the Cycles MCP Server

The Cycles MCP Server gives any MCP-compatible AI agent runtime budget authority. Instead of integrating an SDK into your application code, you add the MCP server to your agent's tool configuration and the agent gets direct access to budget tools — reserve, commit, release, check balance, and more.

This is the fastest way to add budget awareness to an AI agent. One config change, zero code changes.

## Prerequisites

You need a running Cycles stack with a tenant, API key, and budget. If you don't have one yet, follow [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) first.

::: tip Where do I get my API key?
API keys are created through the **Cycles Admin Server** (port 7979) and always start with `cyc_live_`. If your stack is already running with a tenant, create one directly:

```bash
curl -s -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "mcp-key",
    "permissions": ["reservations:create","reservations:commit","reservations:release","reservations:extend","reservations:list","balances:read","decide","events:create"]
  }' | jq -r '.key_secret'
```

The response returns the full key (e.g. `cyc_live_abc123...`). **Save it — the secret is only shown once.**

Need the full setup? See [Deploy the Full Stack — Create an API key](/quickstart/deploying-the-full-cycles-stack#step-3-create-an-api-key). For rotation and lifecycle details, see [API Key Management](/how-to/api-key-management-in-cycles).
:::

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cycles": {
      "command": "npx",
      "args": ["-y", "@runcycles/mcp-server"],
      "env": {
        "CYCLES_API_KEY": "cyc_live_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add cycles -- npx -y @runcycles/mcp-server
```

Set your API key in the environment:

```bash
export CYCLES_API_KEY=cyc_live_...
```

### Cursor / Windsurf

Use the stdio transport with:

```
command: npx
args: ["-y", "@runcycles/mcp-server"]
env: { CYCLES_API_KEY: "cyc_live_..." }
```

### Mock mode (local development)

To try the server without a Cycles backend, enable mock mode. Mock mode returns realistic responses with deterministic data — no API key or running server needed.

```json
{
  "mcpServers": {
    "cycles": {
      "command": "npx",
      "args": ["-y", "@runcycles/mcp-server"],
      "env": {
        "CYCLES_MOCK": "true"
      }
    }
  }
}
```

## Your first budget check

Once connected, ask your agent to check a budget balance:

> "Check the budget balance for tenant acme-corp"

The agent calls the `cycles_check_balance` tool and returns something like:

```json
{
  "balances": [{
    "scope": "tenant:acme-corp",
    "remaining": { "unit": "USD_MICROCENTS", "amount": 750000 },
    "reserved":  { "unit": "USD_MICROCENTS", "amount": 50000 },
    "spent":     { "unit": "USD_MICROCENTS", "amount": 200000 },
    "allocated": { "unit": "USD_MICROCENTS", "amount": 1000000 }
  }]
}
```

If you see balances, the server is working. If you're in mock mode, you'll see the default mock balance.

## The reserve/commit lifecycle

Every costly operation follows three steps:

### 1. Reserve budget

Before making an LLM call or tool invocation, the agent calls `cycles_reserve` with an estimated cost:

```json
{
  "idempotencyKey": "unique-uuid",
  "subject": { "tenant": "acme-corp", "workflow": "summarize", "agent": "researcher" },
  "action": { "kind": "llm.completion", "name": "claude-sonnet" },
  "estimate": { "unit": "USD_MICROCENTS", "amount": 50000 },
  "ttlMs": 60000
}
```

The server responds with a **decision**:
- **ALLOW** — proceed normally
- **ALLOW_WITH_CAPS** — proceed with constraints (e.g., reduced `maxTokens`)
- **DENY** — insufficient budget, skip or degrade

### 2. Execute the operation

If allowed, the agent performs the work. If the decision included caps, the agent should respect them — for example, using a lower `max_tokens` value.

### 3. Commit actual usage

After the operation completes, the agent calls `cycles_commit` with the real cost:

```json
{
  "reservationId": "rsv_...",
  "idempotencyKey": "commit-uuid",
  "actual": { "unit": "USD_MICROCENTS", "amount": 35000 },
  "metrics": {
    "tokensInput": 1200,
    "tokensOutput": 800,
    "latencyMs": 2500,
    "modelVersion": "claude-sonnet-4-20250514"
  }
}
```

The difference between the estimate (50,000) and actual (35,000) is returned to the budget pool.

If the operation fails or is cancelled, call `cycles_release` instead to return the full reserved amount.

## Available tools

| Tool | Description |
|------|-------------|
| `cycles_reserve` | Reserve budget before a costly operation |
| `cycles_commit` | Commit actual usage after an operation completes |
| `cycles_release` | Release a reservation without committing |
| `cycles_extend` | Extend reservation TTL (heartbeat for long operations) |
| `cycles_decide` | Lightweight preflight budget check without reserving |
| `cycles_check_balance` | Check current budget balance for a scope |
| `cycles_list_reservations` | List reservations with filters |
| `cycles_get_reservation` | Get reservation details by ID |
| `cycles_create_event` | Record usage without the reserve/commit lifecycle |

## Built-in prompts

The MCP server includes three prompts that help AI assistants work with Cycles:

| Prompt | What it does |
|--------|-------------|
| `integrate_cycles` | Generates Cycles integration code for a given language and use case |
| `diagnose_overrun` | Walks through debugging budget exhaustion or stopped runs |
| `design_budget_strategy` | Recommends scope hierarchy, limits, units, and degradation strategy |

Ask your agent to use these prompts directly:

> "Use the design_budget_strategy prompt to plan budgets for my multi-agent customer support system"

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CYCLES_API_KEY` | Yes (unless mock) | — | API key from the Admin Server |
| `CYCLES_BASE_URL` | No | `https://api.runcycles.io` | Cycles Server URL |
| `CYCLES_MOCK` | No | `false` | Enable mock mode for local development |
| `PORT` | No | `3000` | HTTP transport port |

## Next steps

- [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp) — detailed patterns for reserve/commit, degradation, long-running ops, and multi-step workflows
- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — how the MCP server fits into the Cycles stack
- [End-to-End Tutorial](/quickstart/end-to-end-tutorial) — deploy the full stack and test the complete lifecycle
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for LLM cost estimates
