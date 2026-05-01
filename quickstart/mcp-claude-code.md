---
title: "Add Cycles to Claude Code (MCP)"
description: "60-second setup for adding Cycles budget enforcement to Claude Code via the MCP server. CLI registration, project-scoped vs global config, common gotchas."
---

# Add Cycles to Claude Code

This page is the exact setup for [Claude Code](https://www.claude.com/claude-code). For the protocol overview and reserve/commit lifecycle, see the [umbrella MCP quickstart](/quickstart/getting-started-with-the-mcp-server).

## Prerequisites

- **Claude Code installed** ([install guide](https://docs.claude.com/en/docs/claude-code))
- **A Cycles API key** (`cyc_live_...`) — see [API key setup](/quickstart/getting-started-with-the-mcp-server#prerequisites). Skip this for mock mode.
- **Cycles server running** locally or remote. Skip for mock mode.

## Setup

The fastest path is the CLI:

```bash
claude mcp add cycles -- npx -y @runcycles/mcp-server
```

Then export the API key and base URL in your shell:

```bash
export CYCLES_API_KEY=cyc_live_...
export CYCLES_BASE_URL=http://localhost:7878
```

`claude mcp add` defaults to `local` scope, which records the server in your user-level Claude Code config scoped to the current project's directory. To share with teammates, run the command from the project root with `--scope project` (or `-s project`) — it writes a committable `.mcp.json` file at the project root. For a global server available in every project, use `--scope user`.

## Project-scoped config (alternative)

If you'd rather hand-edit a `.mcp.json` in your project root:

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

Commit `.mcp.json` to share with teammates. The first time someone opens the project Claude Code prompts to approve the new MCP server.

## Try mock mode (no API key required)

```bash
claude mcp add cycles --env CYCLES_MOCK=true -- npx -y @runcycles/mcp-server
```

Returns realistic deterministic responses with no Cycles backend running.

## Verify

In Claude Code, ask:

> Check the budget balance for tenant acme-corp

Claude Code should invoke `cycles_check_balance` (you'll see a tool-call indicator) and return the balances. List registered MCP servers any time with:

```bash
claude mcp list
```

## Common gotchas

- **Env vars not picked up.** `claude mcp add` records the command but does NOT capture your current shell env. The `CYCLES_API_KEY` and `CYCLES_BASE_URL` need to be in the env Claude Code itself runs in. Either export them in your shell rc file or use `--env KEY=VALUE` flags on `claude mcp add`.
- **Three scopes, not two.** `local` (the default — applies only to the current project, stored in your Claude Code user config), `user` (applies in every project), and `project` (committed to `.mcp.json` in the project root). `claude mcp list` shows all of them. Project scope wins where it overlaps.
- **First-time approval prompt.** Claude Code will prompt before running a new MCP server. If you don't see the Cycles tools, check that you didn't miss the prompt.
- **`claude mcp add` updates Claude Code's view, not Claude Desktop's.** Each client has its own config — see [Claude Desktop setup](/quickstart/mcp-claude-desktop) if you want both.

## Next steps

- [Reserve / commit lifecycle](/quickstart/getting-started-with-the-mcp-server#the-reserve-commit-lifecycle) — what the agent actually does with these tools
- [Claude Desktop setup](/quickstart/mcp-claude-desktop) — same protocol, different config
- [Cursor setup](/quickstart/mcp-cursor) · [Windsurf setup](/quickstart/mcp-windsurf)
- [HTTP transport](/how-to/running-the-mcp-server-over-http) — for shared / multi-user gateway deployments
- [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp) — advanced patterns
