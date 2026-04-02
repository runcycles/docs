---
title: "26 Integrations: Every AI Framework, One Budget Protocol"
date: 2026-04-02
author: Albert Mavashev
tags: [announcement, integrations, langchain, langgraph, autogen, openai, anthropic, groq, django, nextjs, flask, anyagent, runtime-authority]
description: "Cycles now integrates with 26 frameworks across Python, TypeScript, and Java — from OpenAI and Anthropic to LangGraph, AutoGen, AnyAgent, Groq, Django, Next.js, and Flask. One protocol covers every agent stack."
blog: true
sidebar: false
---

# 26 Integrations: Every AI Framework, One Budget Protocol

When we launched Cycles, the question we heard most was: *"Does this work with my stack?"*

Today the answer is yes — for almost every stack. Cycles now integrates with **26 frameworks** across Python, TypeScript, and Java. Every LLM call, tool execution, and agent workflow in your stack can be budget-governed with the same reserve → commit → release protocol.

<!-- more -->

## What shipped

We added 13 new integration guides in the past month, doubling our coverage:

### LLM Providers (8)

| Provider | Languages | What's new |
|----------|-----------|------------|
| [OpenAI](/how-to/integrating-cycles-with-openai) | Python, [TypeScript](/how-to/integrating-cycles-with-openai-typescript) | **TypeScript guide added** — `withCycles` and `reserveForStream` with `stream_options: { include_usage: true }` |
| [Anthropic](/how-to/integrating-cycles-with-anthropic) | Python, [TypeScript](/how-to/integrating-cycles-with-anthropic-typescript) | **TypeScript guide added** — streaming via `client.messages.stream()`, per-tool-call tracking |
| [Groq](/how-to/integrating-cycles-with-groq) | Python, TypeScript | **New** — OpenAI-compatible API, Groq-specific pricing, model-downgrade degradation pattern |
| [AWS Bedrock](/how-to/integrating-cycles-with-aws-bedrock) | TypeScript | — |
| [Google Gemini](/how-to/integrating-cycles-with-google-gemini) | TypeScript | — |
| [Ollama / Local LLMs](/how-to/integrating-cycles-with-ollama) | Python, TypeScript | — |

### AI Frameworks (10)

| Framework | Language | What's new |
|-----------|----------|------------|
| [LangGraph](/how-to/integrating-cycles-with-langgraph) | Python | **New** — callback handler in graph nodes, per-node scoping, conditional edges with `client.decide()` |
| [AutoGen](/how-to/integrating-cycles-with-autogen) | Python | **New** — model client wrapper for teams, swarms, and graph flows |
| [AnyAgent](/how-to/integrating-cycles-with-anyagent) | Python | **New** — single callback covers all 7 supported frameworks |
| [LangChain](/how-to/integrating-cycles-with-langchain) | Python, [JS](/how-to/integrating-cycles-with-langchain-js) | — |
| [Vercel AI SDK](/how-to/integrating-cycles-with-vercel-ai-sdk) | TypeScript | — |
| [Spring AI](/how-to/integrating-cycles-with-spring-ai) | Java | — |
| [LlamaIndex](/how-to/integrating-cycles-with-llamaindex) | Python | — |
| [CrewAI](/how-to/integrating-cycles-with-crewai) | Python | — |
| [Pydantic AI](/how-to/integrating-cycles-with-pydantic-ai) | Python | — |

### Agent Platforms (3)

| Platform | Language |
|----------|----------|
| [MCP (Claude, Cursor, Windsurf)](/how-to/integrating-cycles-with-mcp) | TypeScript |
| [OpenAI Agents SDK](/how-to/integrating-cycles-with-openai-agents) | Python |
| [OpenClaw](/how-to/integrating-cycles-with-openclaw) | TypeScript |

### Web Frameworks (5)

| Framework | Language | What's new |
|-----------|----------|------------|
| [Next.js](/how-to/integrating-cycles-with-nextjs) | TypeScript | **New** — route-level guards, server actions, per-tenant isolation |
| [Django](/how-to/integrating-cycles-with-django) | Python | **New** — middleware, exception handling, per-tenant budget dashboard |
| [Flask](/how-to/integrating-cycles-with-flask) | Python | **New** — error handlers, `before_request` preflight |
| [Express](/how-to/integrating-cycles-with-express) | TypeScript | — |
| [FastAPI](/how-to/integrating-cycles-with-fastapi) | Python | — |

## The pattern that matters: model downgrade

The most interesting new pattern isn't in the integration guides themselves — it's in the [Groq guide](/how-to/integrating-cycles-with-groq).

Most budget systems have two modes: allow or deny. When your budget runs out, the agent stops. But Cycles gives you a third option: **downgrade**.

```python
def chat_with_downgrade(prompt: str) -> dict:
    try:
        return primary_chat(prompt)    # GPT-4o: $2.50/$10 per 1M tokens
    except BudgetExceededError:
        return fallback_chat(prompt)   # Groq Llama 4: $0.11/$0.34 per 1M tokens
```

When your GPT-4o budget runs low, the agent automatically switches to Groq's Llama 4 Scout — 23x cheaper for input, 29x cheaper for output. The user still gets an answer. The agent keeps working. Your costs stay bounded.

This is only possible because Cycles tracks budgets per `action_name`. The budget authority can set different limits for `gpt-4o` and `llama-4-scout`, and your application routes between them based on what's available.

## Multi-tenant SaaS guide

Beyond integrations, we shipped a comprehensive [Multi-Tenant SaaS Guide](/how-to/multi-tenant-saas-with-cycles) — the single most-requested doc.

It covers the full lifecycle:
- **Customer onboarding** — automated tenant + API key + budget creation
- **Plan tiers** — Free ($5/mo), Pro ($50/mo), Enterprise ($500/mo) with overdraft limits
- **Per-tenant middleware** — extract tenant from headers, scope every Cycles call
- **Monthly budget resets** — `RESET` operation at billing cycle boundaries
- **Graceful degradation** — upgrade prompts, model downgrade, caching
- **Tenant suspension** — ACTIVE → SUSPENDED → CLOSED lifecycle

All with working Python and TypeScript code.

## What's next

26 integrations covers the vast majority of production AI stacks. We're not chasing more framework checkboxes. Instead, we're focused on:

- **Example repos** — `git clone` and run for every integration guide
- **Batch/queue patterns** — Celery and Bull with budget governance
- **Cost estimation improvements** — better defaults, adaptive estimation

## Try it

Pick your framework from the [integration overview](/how-to/integrations-overview), follow the guide, and have budget governance running in under 10 minutes.

If your stack isn't covered, [open an issue](https://github.com/runcycles/docs/issues). We're prioritizing based on real user requests.
