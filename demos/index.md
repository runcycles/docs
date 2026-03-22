---
title: "Demos"
description: "Self-contained demos showing Cycles in action. No LLM API key required."
---

# Demos

Each demo runs locally with Docker. No LLM API keys required — all tools and models are mocked.

## Runaway Agent Demo

A support agent with a quality-loop bug burns ~$6 in 30 seconds without Cycles. With Cycles it stops cleanly at $1.00.

**What it shows:** Budget enforcement stops a cost runaway before damage accumulates.

[View on GitHub](https://github.com/runcycles/cycles-runaway-demo)

## Action Authority Demo

A support agent handles a billing dispute in four steps. Cycles allows internal actions (notes, CRM updates) but blocks the customer email — before it executes.

**What it shows:** Toolset-scoped budgets give agents authority over safe actions while blocking risky ones.

[View on GitHub](https://github.com/runcycles/cycles-agent-action-authority-demo) · [Blog walkthrough](/blog/action-authority-demo-support-agent-walkthrough)

---

New to Cycles? Start with [What is Cycles?](/quickstart/what-is-cycles) or jump straight to the [End-to-End Tutorial](/quickstart/end-to-end-tutorial).
