---
title: "Add Cycles to Windsurf (MCP)"
description: "60-second setup for adding Cycles budget enforcement to Windsurf (Codeium) via the MCP server. Config path, mock mode, common gotchas."
---

# Add Cycles to Windsurf

This page is the exact setup for [Windsurf](https://codeium.com/windsurf). For the protocol overview and reserve/commit lifecycle, see the [umbrella MCP quickstart](/quickstart/getting-started-with-the-mcp-server).

## Prerequisites

- **Windsurf installed** ([download](https://codeium.com/windsurf))
- **A Cycles API key** (`cyc_live_...`) — see [API key setup](/quickstart/getting-started-with-the-mcp-server#prerequisites). Skip for mock mode.
- **Cycles server running** locally or remote. Skip for mock mode.

## Setup

Edit Windsurf's MCP config file:

**macOS / Linux:**
```
~/.codeium/windsurf/mcp_config.json
```

**Windows:**
```
%USERPROFILE%\.codeium\windsurf\mcp_config.json
```

Create the file if it doesn't exist:

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

Replace `cyc_live_...` with your real key. Open Windsurf's settings → Cascade → MCP servers, and `cycles` should appear in the list. Toggle on / refresh if needed.

## Try mock mode (no API key required)

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

Returns realistic deterministic responses with no Cycles backend running.

## Verify

In Windsurf's Cascade chat, ask:

> Check the budget balance for tenant acme-corp

Cascade should invoke `cycles_check_balance` and return the balances. The tool call should be visible in the chat trail.

## Common gotchas

- **Config is user-scoped only.** Unlike Cursor, Windsurf does not currently support a project-scoped MCP config — every project sees the same servers. If you need per-project keys, use a wrapper script as the `command` that reads the right secret based on the working directory.
- **Cascade mode required.** MCP tools are only available in Cascade (Windsurf's agent mode), not in inline completions or plain chat.
- **Env not interpolated.** Like Cursor, Windsurf's MCP config does not expand `${VAR}` references. Hardcode the API key or use mock mode.
- **Tools list refreshes on Windsurf restart.** If you edit the config and the tools don't show, fully quit and reopen Windsurf (closing the window is not enough on macOS).

## Next steps

- [Reserve / commit lifecycle](/quickstart/getting-started-with-the-mcp-server#the-reserve-commit-lifecycle) — what the agent actually does with these tools
- [Cursor setup](/quickstart/mcp-cursor) — same protocol, different config
- [Claude Desktop](/quickstart/mcp-claude-desktop) · [Claude Code](/quickstart/mcp-claude-code)
- [HTTP transport](/how-to/running-the-mcp-server-over-http) — for shared / multi-user gateway deployments
- [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp) — advanced patterns
