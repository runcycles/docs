---
title: "Integrations Overview"
description: "Overview of all supported Cycles integrations — LLM providers, frameworks, and web servers — with language support and streaming capabilities."
---

# Integrations Overview

Cycles integrates with LLM providers, agent frameworks, and web servers. Each integration wraps model calls with the reserve → commit → release lifecycle so that every call is budget-checked before execution.

## Supported integrations

| Integration | Language | Streaming | Pattern |
|-------------|----------|-----------|---------|
| [MCP Server](/how-to/integrating-cycles-with-mcp) | TypeScript (Node.js) | — | MCP tools |
| [OpenAI](/how-to/integrating-cycles-with-openai) | Python | Yes | Decorator |
| [Anthropic](/how-to/integrating-cycles-with-anthropic) | Python | Yes | Decorator |
| [LangChain](/how-to/integrating-cycles-with-langchain) | Python | Yes | Callback handler |
| [LangChain.js](/how-to/integrating-cycles-with-langchain-js) | TypeScript | Yes | Callback handler |
| [Vercel AI SDK](/how-to/integrating-cycles-with-vercel-ai-sdk) | TypeScript | Yes | `reserveForStream` |
| [AWS Bedrock](/how-to/integrating-cycles-with-aws-bedrock) | TypeScript | Yes | `withCycles` / `reserveForStream` |
| [Google Gemini](/how-to/integrating-cycles-with-google-gemini) | TypeScript | Yes | `withCycles` / `reserveForStream` |
| [Express](/how-to/integrating-cycles-with-express) | TypeScript | Yes | Middleware / `withCycles` |
| [FastAPI](/how-to/integrating-cycles-with-fastapi) | Python | — | Middleware / Decorator |
| [OpenClaw](/how-to/integrating-cycles-with-openclaw) | TypeScript | Yes | Plugin (lifecycle hooks) |

## Integration patterns

Cycles offers several integration approaches depending on your stack:

### MCP Server

The zero-code approach. Add the Cycles MCP Server to your AI agent's tool configuration and the agent gets direct access to budget tools via the Model Context Protocol. No SDK integration in the agent's code required — the agent discovers and calls `cycles_reserve`, `cycles_commit`, and other tools through standard MCP tool discovery.

Best for: Claude Desktop, Claude Code, Cursor, Windsurf, and any MCP-compatible AI host.

### Decorator / Higher-order function

The simplest approach. Wrap your LLM-calling function and Cycles handles reservation, commit, and release automatically.

- **Python:** `@cycles` decorator
- **TypeScript:** `withCycles` higher-order function

Best for: individual model calls, simple request-response flows.

### Callback handler

For agent frameworks like LangChain that fire events on every LLM call. A custom callback handler creates reservations on `llm_start` and commits on `llm_end`.

Best for: multi-turn agents, tool-calling chains, LangChain/LangGraph pipelines.

### `reserveForStream`

For streaming responses where the actual cost is only known after the stream completes. Reserves budget upfront, auto-extends the reservation TTL during streaming, and commits actual usage when the stream finishes.

Best for: streaming chat UIs, Vercel AI SDK, any provider with streaming support.

### Programmatic client

Direct access to the Cycles client for full control over the reservation lifecycle. Use when the higher-level patterns don't fit your architecture.

Best for: custom frameworks, complex orchestration, batch processing.

See [Choosing the Right Integration Pattern](/how-to/choosing-the-right-integration-pattern) for detailed guidance.

## Adding a new integration

All integrations follow the same protocol:

1. **Reserve** budget before the LLM call with an estimated cost
2. **Execute** the model call (respecting any caps returned)
3. **Commit** actual cost from token usage after execution
4. **Release** on error to free held budget

See [Using the Cycles Client Programmatically](/how-to/using-the-cycles-client-programmatically) for the full client API reference.

## Next Steps

- [Adding Cycles to an Existing Application](/how-to/adding-cycles-to-an-existing-application) — step-by-step guide for your first integration
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for estimation
- [Error Handling Patterns](/how-to/error-handling-patterns-in-cycles-client-code) — handling budget errors across languages
