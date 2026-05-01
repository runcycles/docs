---
title: "Add Cycles to Cursor (MCP)"
description: "60-second setup for adding Cycles budget enforcement to Cursor via the MCP server. Project vs global config paths, common gotchas, and verification."
---

# Add Cycles to Cursor

This page is the exact setup for [Cursor](https://cursor.com). For the protocol overview and reserve/commit lifecycle, see the [umbrella MCP quickstart](/quickstart/getting-started-with-the-mcp-server).

## Prerequisites

- **Cursor installed** ([download](https://cursor.com))
- **A Cycles API key** (`cyc_live_...`) — see [API key setup](/quickstart/getting-started-with-the-mcp-server#prerequisites). Skip for mock mode.
- **Cycles server running** locally or remote. Skip for mock mode.

## Setup

Cursor reads MCP config from two locations:

- **Project-scoped:** `.cursor/mcp.json` in the project root (commit to share with teammates)
- **User-scoped:** `~/.cursor/mcp.json` (applies to every project)

Pick one. Most teams want project-scoped so the config travels with the repo. Create the file:

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

Replace `cyc_live_...` with your real key. Open Cursor's settings panel → MCP, and you should see `cycles` listed. Toggle it on if it isn't already. Cursor may prompt to approve the new server the first time.

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

In Cursor's chat (Cmd+L / Ctrl+L), with **Composer mode** enabled, ask:

> Check the budget balance for tenant acme-corp

Cursor should invoke `cycles_check_balance` (you'll see the tool-call expand in the chat) and return balances. The MCP indicator in Cursor's settings should show the server as connected.

## Common gotchas

- **Tool calls only fire in agent / composer mode.** MCP tools are not available in plain chat mode — switch to Composer (the default in recent Cursor versions).
- **Project vs user scope.** If both `.cursor/mcp.json` and `~/.cursor/mcp.json` define `cycles`, project wins. `claude mcp list` from Claude Code does NOT show Cursor's config — they're separate systems.
- **Env not interpolated.** Cursor's MCP config does not currently expand `${VAR}` references in the env block. Hardcode the API key or use mock mode.
- **`.cursor/` should be `.gitignore`d if it contains secrets.** If you commit `.cursor/mcp.json` with the API key in plain text, it ends up in git history. Either: (a) commit only with `CYCLES_MOCK: true` and have each developer override locally, or (b) use a secrets manager and a wrapper script as the `command` instead of `npx` directly.

## Next steps

- [Reserve / commit lifecycle](/quickstart/getting-started-with-the-mcp-server#the-reserve-commit-lifecycle) — what the agent actually does with these tools
- [Windsurf setup](/quickstart/mcp-windsurf) — same protocol, different config
- [Claude Desktop](/quickstart/mcp-claude-desktop) · [Claude Code](/quickstart/mcp-claude-code)
- [HTTP transport](/how-to/running-the-mcp-server-over-http) — for shared / multi-user gateway deployments
- [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp) — advanced patterns
