---
title: "Integration Ecosystem"
description: "Explore the full Cycles integration ecosystem — SDKs, AI providers, frameworks, and tools that work with runtime authority for autonomous agents."
---

# Integration Ecosystem

Cycles integrates with the tools, frameworks, and AI providers you already use. Whether you're building autonomous agents, adding runtime authority to an existing application, or exploring what's possible with controlled AI spending, there's an integration path for you.

## AI Model Providers

### OpenAI

Integrate Cycles runtime authority with ChatGPT, GPT-4, GPT-4o, and other OpenAI models. Control per-request and per-session spending when your agents call OpenAI APIs.

- [OpenAI integration guide](/how-to/integrating-cycles-with-openai)
- [openai.com](https://openai.com)

### Anthropic

Use Cycles with Claude models to set spending limits on autonomous agent workflows powered by Anthropic's API.

- [Anthropic integration guide](/how-to/integrating-cycles-with-anthropic)
- [anthropic.com](https://anthropic.com)

### Google Gemini

Add runtime authority to applications built on Google's Gemini family of models.

- [Gemini integration guide](/how-to/integrating-cycles-with-google-gemini)
- [ai.google.dev](https://ai.google.dev)

### AWS Bedrock

Cycles works with AWS Bedrock's multi-model platform, giving you budget control across any foundation model available through Bedrock.

- [AWS Bedrock integration guide](/how-to/integrating-cycles-with-aws-bedrock)
- [aws.amazon.com/bedrock](https://aws.amazon.com/bedrock)

## AI Frameworks & SDKs

### LangChain (Python)

Build budget-aware LangChain agents in Python. Cycles integrates with LangChain's tool and callback system to enforce spending limits throughout chain execution.

- [LangChain integration guide](/how-to/integrating-cycles-with-langchain)
- [python.langchain.com](https://python.langchain.com)

### LangChain.js

The same LangChain integration, purpose-built for JavaScript and TypeScript environments.

- [LangChain.js integration guide](/how-to/integrating-cycles-with-langchain-js)
- [js.langchain.com](https://js.langchain.com)

### Vercel AI SDK

Add Cycles runtime authority to applications built with the Vercel AI SDK for seamless spending control in Next.js and other Vercel-deployed projects.

- [Vercel AI SDK integration guide](/how-to/integrating-cycles-with-vercel-ai-sdk)
- [sdk.vercel.ai](https://sdk.vercel.ai)

### Spring AI

Integrate Cycles with Spring AI to bring runtime authority to Java and Kotlin AI applications.

- [Spring AI quickstart](/quickstart/how-to-add-hard-budget-limits-to-spring-ai-with-cycles)
- [spring.io/projects/spring-ai](https://spring.io/projects/spring-ai)

## Web Frameworks

### Express.js

Add Cycles middleware to your Express.js API to enforce runtime authority on any route that triggers AI spending.

- [Express.js integration guide](/how-to/integrating-cycles-with-express)
- [expressjs.com](https://expressjs.com)

### FastAPI

Use the Cycles Python client with FastAPI for high-performance, budget-aware AI APIs.

- [FastAPI integration guide](/how-to/integrating-cycles-with-fastapi)
- [fastapi.tiangolo.com](https://fastapi.tiangolo.com)

### Spring Boot

Leverage the Cycles Spring Boot Starter for auto-configured runtime authority in your Spring Boot applications.

- [Spring Boot quickstart](/quickstart/getting-started-with-the-cycles-spring-boot-starter)
- [spring.io/projects/spring-boot](https://spring.io/projects/spring-boot)

## Agent Platforms

### MCP (Model Context Protocol)

Cycles provides an MCP server that exposes runtime authority as tools for any MCP-compatible client, including Claude Desktop, Claude Code, Cursor, and Windsurf.

- [MCP integration guide](/how-to/integrating-cycles-with-mcp)
- [modelcontextprotocol.io](https://modelcontextprotocol.io)

### OpenClaw

Connect Cycles to OpenClaw for budget-controlled multi-agent orchestration.

- [OpenClaw integration guide](/how-to/integrating-cycles-with-openclaw)

## Official SDKs

### Python Client

[![PyPI downloads](https://img.shields.io/pypi/dm/runcycles?label=downloads&color=555&style=flat-square)](https://pypi.org/project/runcycles/)

The official Cycles Python client. Install from PyPI and start enforcing budgets in minutes.

- [runcycles on PyPI](https://pypi.org/project/runcycles/)
- [Python quickstart](/quickstart/getting-started-with-the-python-client)

### TypeScript Client

[![npm downloads](https://img.shields.io/npm/dt/runcycles?label=downloads&color=555&style=flat-square)](https://www.npmjs.com/package/runcycles)

The official Cycles TypeScript client for Node.js and browser environments.

- [runcycles on npm](https://www.npmjs.com/package/runcycles)
- [TypeScript quickstart](/quickstart/getting-started-with-the-typescript-client)

### MCP Server

[![npm downloads](https://img.shields.io/npm/dt/@runcycles/mcp-server?label=downloads&color=555&style=flat-square)](https://www.npmjs.com/package/@runcycles/mcp-server)

The Cycles MCP server exposes runtime authority as tools for Claude Desktop, Claude Code, Cursor, and Windsurf.

- [@runcycles/mcp-server on npm](https://www.npmjs.com/package/@runcycles/mcp-server)
- [MCP quickstart](/quickstart/getting-started-with-the-mcp-server)

### Spring Boot Starter

[![Maven Central](https://img.shields.io/maven-central/v/io.runcycles/cycles-client-java-spring?label=Maven%20Central&color=555&style=flat-square)](https://central.sonatype.com/artifact/io.runcycles/cycles-client-java-spring)

Auto-configured Cycles integration for Spring Boot applications, available on Maven Central.

- [cycles-client-java-spring on Maven Central](https://central.sonatype.com/artifact/io.runcycles/cycles-client-java-spring)
- [Spring Boot quickstart](/quickstart/getting-started-with-the-cycles-spring-boot-starter)

## Protocol & Standards

### Cycles Protocol

The Cycles Protocol is an open specification for runtime authority in autonomous agent systems, licensed under Apache 2.0. Build your own implementation or contribute to the spec.

- [Cycles Protocol on GitHub](https://github.com/runcycles/cycles-protocol)

### OpenAPI Specification

A complete OpenAPI specification is available for the Cycles API, making it straightforward to generate clients in any language or integrate with API tooling.

- [Interactive API Reference](/api/)

## Community Tools

The Cycles ecosystem grows with every project that adopts runtime authority. If you've built a library, plugin, tool, or integration that works with Cycles, we want to hear about it.

Building something with Cycles? Add a [Built with Cycles badge](/community/badges) to your project and let the community know what you're working on.
