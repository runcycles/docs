---
title: "Why I'm Building Cycles"
date: 2026-04-04
author: Albert Mavashev
tags: [founder, vision, agents, governance]
description: "After nearly three decades building middleware governance, I saw the same catastrophic gap emerge in AI agents. This is why I'm building Cycles."
blog: true
sidebar: false
featured: false
---

# Why I'm Building Cycles

For nearly three decades I worked on systems that sat underneath mission-critical enterprise applications: middleware, message brokers, transaction pipelines — the infrastructure that could quietly turn a small failure into a very expensive one. First at Nastel Technologies, then through its rebrand as [meshIQ](https://www.meshiq.com/news-article/nastel-technologies-receives-investment-from-software-growth-partners-and-announces-strategic-rebrand-as-meshiq/). Banks, airlines, telecoms, government agencies. Systems where a single uncontrolled message could cascade into millions in losses.

The lesson I learned the hard way was simple: seeing a failure is not the same as stopping it.

That lesson is why I'm building Cycles.

<!-- more -->

## One Agent, One Loop, One Morning

After meshIQ, I built [scalerX.ai](https://scalerx.ai) — a platform for deploying AI agents on Telegram. Each agent on scalerX connects to multiple models and providers — OpenAI for reasoning, Stable Diffusion for image generation, Google and Kling for video. One morning I woke up to find that an agent had gotten stuck in a tool-call loop overnight. It had generated a dozen images and several videos, cycling between models — each call triggering the next. By the time anyone noticed, that single run had burned through more budget than we'd planned for the entire week. Across three providers. While we slept.

I stared at the logs. The agent had done exactly what it was designed to do — reason, generate, iterate — just without any structural limit on how many times it could repeat the cycle, or any way to enforce a boundary that spanned all three models at once. We had dashboards. We had per-provider usage tracking. None of that mattered, because no single system could answer the only question that would have prevented the damage: *should this next call — to any provider — be allowed to happen at all?*

That was the problem. Not visibility into one LLM's usage. **Enforcement across all of them.**

I'd seen this exact failure mode before. Not in AI. In middleware.

## The Pattern I Couldn't Unsee

In the middleware world, circa 2000, teams would deploy message brokers and integration buses with logging but no pre-execution controls. A misconfigured routing rule could fan out a single message into thousands of downstream calls. A retry loop could amplify one failed transaction into a cascade that burned through compute budgets and overwhelmed dependent services.

We built systems to solve that — systems that intercepted transactions before execution, enforced policies on message flow, and gave operators deterministic control over what could happen — not just visibility into what had already happened. Policy-based routing, message flow control, pre-execution validation. The shift from "detect and respond" to "prevent and enforce" is what made enterprise middleware production-safe.

That scalerX incident brought the pattern into focus: today's AI agents have the same governance gap that enterprise middleware had 25 years ago. **Teams have observability but no enforcement.** Different technology, identical control-plane gap.

## Why Cycles, Why Now

When I started sketching what became Cycles, I kept coming back to three principles from the middleware governance world:

**1. Enforcement must be atomic.** In enterprise middleware, a half-applied policy is worse than no policy. If you reserve capacity for a transaction, that reservation must be atomic — either the full budget is locked or none of it is. Cycles uses a reserve-commit lifecycle borrowed directly from this principle. Budget is atomically reserved before an agent acts, actual usage is committed after, and unused budget is released. No race conditions. No [time-of-check-to-time-of-use](https://dev.to/amavashev/your-ai-agent-budget-check-has-a-race-condition-33ei) gaps.

**2. Authority must attenuate, not propagate.** In middleware, a message broker doesn't grant downstream systems the same permissions as the originating system. Each hop in the chain has narrower scope. Cycles applies the same principle to agent delegation: when an agent spawns a sub-agent, the sub-agent gets a carved-out sub-budget and a restricted action mask. Authority can only decrease with depth, never increase.

**3. Control must be structural, not semantic.** You can't rely on an LLM to respect a system prompt that says "don't spend more than $10." That's a semantic control — a suggestion to a probabilistic system. Structural controls operate outside the LLM, at the infrastructure layer, and enforce boundaries deterministically. One is a hope. The other is an engineering guarantee.

These aren't novel ideas. They're battle-tested patterns from decades of distributed systems engineering. What's novel is applying them to autonomous AI agents — where the "messages" are tool calls, the "brokers" are agent orchestrators, and the "transactions" are LLM inference chains that can spawn arbitrary sub-tasks.

## What I'm Not Building

Cycles is not an observability platform. There are excellent tools for watching what agents do. Cycles is not an eval framework. There are good tools for testing agent outputs. Cycles is not an LLM proxy. There are solid products for routing and caching inference calls.

Cycles is the enforcement layer that sits between the agent's decision to act and the action itself. It answers one question: **is this agent allowed to do this, right now, given what it's already done?**

That's it. One question, answered deterministically, at every tool call, for every agent, in every delegation chain. And if the answer is no, the action doesn't happen. Not "gets logged for later review." Not "triggers an alert." Doesn't happen.

## The Road Ahead

Cycles is early and open source under [Apache 2.0](https://github.com/runcycles). The protocol, server, and client SDKs are available across Python, TypeScript, Java, and Rust. We integrate with [26 frameworks and LLM providers](/blog/26-integrations-every-ai-framework-one-budget-protocol).

I've seen this movie before. I know how the first act goes — the technology is exciting, adoption outpaces governance, incidents accumulate, and eventually the industry builds the enforcement layer it should have built from the start.

I'd rather build it now.

I think agent systems will need this layer sooner than most people realize.

---

- [What Is Runtime Authority for AI Agents](/blog/what-is-runtime-authority-for-ai-agents)
- [The True Cost of Uncontrolled AI Agents](/blog/true-cost-of-uncontrolled-agents)
- [GitHub: runcycles](https://github.com/runcycles)
- [Get started in 5 minutes](/quickstart/what-is-cycles)
