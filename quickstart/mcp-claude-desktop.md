---
title: "Add Cycles to Claude Desktop (MCP)"
description: "60-second setup for adding Cycles budget enforcement to Claude Desktop via the MCP server. Exact config paths for macOS and Windows, mock-mode option, common gotchas."
---

# Add Cycles to Claude Desktop

This page is the exact setup for [Claude Desktop](https://claude.ai/download). For the protocol overview and reserve/commit lifecycle, see the [umbrella MCP quickstart](/quickstart/getting-started-with-the-mcp-server).

## Prerequisites

- **Claude Desktop installed** ([download](https://claude.ai/download))
- **A Cycles API key** (`cyc_live_...`) — see [API key setup](/quickstart/getting-started-with-the-mcp-server#prerequisites). Skip this if you only want to try mock mode below.
- **Cycles server running** locally or remote. Skip this for mock mode.

## Setup

Edit the Claude Desktop config file. Create it if it doesn't exist.

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

Paste the following, replacing `cyc_live_...` with your real API key:

```json
{
  "mcpServers": {
    "cycles": {
      "command": "npx",
      "args": ["-y", "@runcycles/mcp-server"],
      "env": {
        "CYCLES_API_KEY": "cyc_live_...",
        "CYCLES_BASE_URL": "http://localhost:7878"
      }
    }
  }
}
```

**Quit Claude Desktop completely** (cmd+Q on macOS — closing the window is not enough), then reopen. The Cycles tools should appear in the MCP indicator at the bottom of the chat.

## Try mock mode (no API key required)

Drop `CYCLES_API_KEY` and `CYCLES_BASE_URL`, and set `CYCLES_MOCK` instead. The server returns realistic deterministic responses with no Cycles backend running:

```json
{
  "mcpServers": {
    "cycles": {
      "command": "npx",
      "args": ["-y", "@runcycles/mcp-server"],
      "env": { "CYCLES_MOCK": "true" }
    }
  }
}
```

Useful for trying out the tools before standing up a stack.

## Verify

In Claude Desktop, ask:

> Check the budget balance for tenant acme-corp

Claude should call `cycles_check_balance` and return the balances. If you don't see a tools indicator or the call doesn't fire, see "Common gotchas" below.

## Common gotchas

- **Indicator missing after edit.** Claude Desktop only re-reads the config on a full quit/restart. Closing the window is not enough on macOS.
- **`npx` not found on Windows.** Make sure Node 18+ is on PATH. `where npx` should resolve. Reinstall Node if not.
- **`CYCLES_BASE_URL` reachability.** If your Cycles server is in Docker, `localhost:7878` from Claude Desktop on macOS reaches the host's localhost — that works. From inside another container, use `host.docker.internal`.
- **API key starts with `cyc_test_` not `cyc_live_`.** Test keys work but only against test budgets; if you're getting `BUDGET_NOT_FOUND` errors, double-check the tenant has a budget allocated.

## Next steps

- [Reserve / commit lifecycle](/quickstart/getting-started-with-the-mcp-server#the-reserve-commit-lifecycle) — what the agent actually does with these tools
- [Claude Code setup](/quickstart/mcp-claude-code) — same protocol, different config
- [HTTP transport](/how-to/running-the-mcp-server-over-http) — for shared / multi-user gateway deployments
- [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp) — advanced patterns: preflight decisions, graceful degradation, fire-and-forget events
