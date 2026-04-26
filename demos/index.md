---
title: "Demos"
description: "Self-contained demos showing Cycles budget enforcement and action authority in action. Run locally with Docker — no LLM API key required."
---

# Demos

Each demo runs locally with Docker. No LLM API keys required — all tools and models are mocked.

## Runaway Agent Demo

A support agent with a quality-loop bug burns ~$10 in 12 seconds without Cycles — auto-terminated only because the demo enforces a safety timeout. In production, there would be no timeout. With Cycles, the agent stops cleanly at $1.00.

**What it shows:** Budget enforcement stops a cost runaway before damage accumulates.

### Run it

```bash
git clone https://github.com/runcycles/cycles-runaway-demo.git
cd cycles-runaway-demo
docker compose up --build
```

The demo provisions its own tenant and budget automatically. Watch the terminal output — you'll see the unguarded agent overspend, then the guarded agent stop at the $1.00 limit.

<video controls autoplay muted loop playsinline poster="/demo-runaway-poster.png" preload="metadata" style="width: 100%; max-width: 880px; display: block; border-radius: 8px;">
  <source src="/demo-runaway.webm" type="video/webm" />
  <source src="/demo-runaway.mp4" type="video/mp4" />
  <img src="/demo-runaway.gif" alt="Runaway agent demo: ~$10 burn without Cycles, $1 cap with Cycles" />
</video>

::: info About the recording
The recording above uses an accelerated call rate (~$10 in 12 seconds) for visual punch. Running `./demo.sh` yourself produces ~$5.95 over 30 seconds at realistic LLM call latency — same enforcement behavior, more realistic pace.
:::

[View on GitHub](https://github.com/runcycles/cycles-runaway-demo) · [Blog walkthrough](/blog/runaway-demo-agent-cost-blowup-walkthrough)

## Action Authority Demo

A support agent handles a billing dispute in four steps. Cycles allows internal actions (notes, CRM updates) but blocks the customer email — before it executes.

**What it shows:** Toolset-scoped budgets give agents authority over safe actions while blocking risky ones.

### Run it

```bash
git clone https://github.com/runcycles/cycles-agent-action-authority-demo.git
cd cycles-agent-action-authority-demo
./demo.sh
```

The script starts the full stack (Redis, Cycles Server, Admin Server), provisions a tenant with action-scoped budgets, and runs the agent in both unguarded and guarded modes. No API keys required — all LLM calls are mocked.

<video controls autoplay muted loop playsinline poster="/demo-action-authority-poster.png" preload="metadata" style="width: 100%; max-width: 880px; display: block; border-radius: 8px;">
  <source src="/demo-action-authority.webm" type="video/webm" />
  <source src="/demo-action-authority.mp4" type="video/mp4" />
  <img src="/demo-action-authority.gif" alt="Action authority demo: customer email blocked before it executes" />
</video>

[View on GitHub](https://github.com/runcycles/cycles-agent-action-authority-demo) · [Blog walkthrough](/blog/action-authority-demo-support-agent-walkthrough)

---

**Next:** wire Cycles into your app with the [End-to-End Tutorial](/quickstart/end-to-end-tutorial), [compare it to your current stack](/concepts/comparisons), or — if you're new to the category — read [What is Cycles?](/quickstart/what-is-cycles).
