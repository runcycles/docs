---
title: "Design Partners"
description: "Cycles is in design-partner mode. We're working with up to three teams running multi-tenant agents in production. Founder office hours, roadmap influence, free self-hosted forever — in exchange for one real production workload, monthly syncs, and honest feedback."
---

# Design Partners

Cycles is in design-partner mode. We're working with **up to three teams** running multi-tenant agents in production who want runtime budget, risk, and action authority — and who are willing to push us hard on what's missing.

This page exists so the conversation can start with you knowing exactly what we're offering, what we're asking for, and who this is and isn't for.

Built by [Albert Mavashev](/about) (ex-CTO Nastel, ex-meshIQ) and a small team with nearly three decades in mission-critical transaction infrastructure. We've shipped runtime authority for banks, airlines, and telecoms; we're shipping it for AI agents now.

## What design partners get

- **Direct line to the founder.** Monthly 30-minute office hours. Email or Slack any time in between.
- **Roadmap influence.** What ships in the next two minor versions is shaped by the workloads design partners run. Your incident becomes our next runbook.
- **Free self-hosted forever.** Cycles is Apache 2.0; this isn't a "free for now" trick. You run it in your VPC; nothing leaves.
- **Priority support during your 60-day integration window.** When something breaks at 2 AM, you have a human to ping.
- **Optional public co-marketing.** Joint blog post, case study, or conference talk — opt-in, not required. You can be a named partner *or* stay anonymous; your choice.

## What we're asking for

- **One real production workload running on Cycles within 60 days.** Not a sandbox, not a Hello World. The whole point is finding what breaks under real conditions.
- **Monthly 30-minute sync.** Office hours go both ways — we need to hear what you're hitting.
- **Honest feedback.** We want pushback, not validation. If the protocol is wrong, the comparison page is misleading, or the SDK is awkward — we need to know.
- **Consent for either named or anonymous attribution.** Your choice; we just need a position so we can talk about the work later.

## Who this is for

- Teams running **multi-tenant** agents in production. Per-customer budget isolation matters; one runaway can't blow up another tenant's allocation.
- Teams with **production agents already deployed**, or shipping in the next 60 days. Cycles solves real costs, not hypothetical ones.
- Teams running **Python, TypeScript, Rust, Spring Boot, or MCP-host stacks** (Cursor, Continue, Windsurf, etc.). First-class SDKs for all of these.
- Teams that can **move fast**. No 6-month procurement cycles. We need to ship, learn, ship again.
- Teams whose engineering leadership is **comfortable with self-hosted Apache 2.0 OSS**. There is no managed cloud yet.

## Who this is NOT for

We'd rather be honest now than waste both of our time later. Cycles is probably not the right fit if:

- You're running a single-tenant prototype with no concurrency. You don't need atomic reservations yet — a local counter is fine.
- You haven't deployed agents to production yet. Come back when you have real cost to bound.
- You need a fully managed cloud / SaaS. We're self-hosted-only today; managed cloud is on the roadmap, not live.
- You can't commit to running one workload on Cycles within 60 days. We're not in a position to help with multi-quarter evaluations.
- Your blocker is whether agents need governance at all. The design-partner conversation assumes that's already settled for you.

## How to apply

The fastest path is to grab 30 minutes:

<a href="https://calendly.com/amavashev/30min" target="_blank" rel="noopener"><strong>Book a 30-minute call →</strong></a>

Or email [founder@runcycles.io](mailto:founder@runcycles.io) with one paragraph on:

1. What workload you'd run on Cycles
2. What stack you're on (language, framework, agent host)
3. What's currently broken or worrying you about agent budgeting / actions

A founder reads every email; expect a reply within 48 hours.

## What happens after the first call

1. **Mutual fit conversation.** No commitment yet. We talk through the workload, the stack, and whether Cycles actually solves your problem.
2. **One-page MOU.** If fit looks right, we draft a one-page commitment doc covering scope, timeline, and what each side delivers.
3. **60-day integration window.** Hands-on support, weekly check-ins as needed.
4. **Public artifact at 90 days.** If both parties want it: case study, joint blog post, or conference talk. Opt-in.

## Why we run this program

Runtime authority for AI agents is a category that did not exist 18 months ago. We can write about it, comparison-page it, and demo it — but the product gets built right only if real teams put it under real load and tell us where it breaks. Three design partners is enough to drive every meaningful product decision for the next two quarters. We'd rather get those right than pursue scale prematurely.

## Related

- [Why Cycles](/why-cycles) — the problems Cycles solves, by role
- [Demos](/demos/) — see runtime authority in 5 minutes, no API keys
- [End-to-End Tutorial](/quickstart/end-to-end-tutorial) — production-quality integration in 30 minutes
- [Security](/security) — self-hosted, no prompt storage, what we log and what we don't
- [Runtime Authority vs Runtime Authorization](/concepts/runtime-authority-vs-runtime-authorization) — how Cycles fits alongside identity-based agent governance
