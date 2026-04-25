---
title: "Demos"
description: "Self-contained demos showing Cycles budget enforcement and action authority in action. Run locally with Docker — no LLM API key required."
---

# Demos

Each demo runs locally with Docker. No LLM API keys required — all tools and models are mocked.

## Runaway Agent Demo

A support agent with a quality-loop bug burns ~$6 in 30 seconds without Cycles — auto-terminated only because the demo enforces a safety timeout. In production, there would be no timeout. With Cycles, the agent stops cleanly at $1.00.

**What it shows:** Budget enforcement stops a cost runaway before damage accumulates.

### Run it

```bash
git clone https://github.com/runcycles/cycles-runaway-demo.git
cd cycles-runaway-demo
docker compose up --build
```

The demo provisions its own tenant and budget automatically. Watch the terminal output — you'll see the unguarded agent overspend, then the guarded agent stop at the $1.00 limit.

**What you'll see (illustrative):**

```text
=== UNGUARDED RUN ===
[step 01] tool=search          spent=$0.18  (no limit)
[step 09] tool=summarize       spent=$3.42  (no limit)
[step 18] tool=summarize       spent=$6.04  ← demo timeout (production = no timeout)

=== GUARDED RUN (Cycles) ===
[step 01] reserve → ALLOW       spent=$0.12
[step 02] reserve → ALLOW       spent=$0.47
[step 03] reserve → DENY        BUDGET_EXCEEDED  ← stopped at $1.00
```

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

**What you'll see (illustrative):**

```text
[step 1] tool=internal_note      → ALLOW  (low risk, allowed by toolset)
[step 2] tool=crm_update         → ALLOW  (low risk, allowed by toolset)
[step 3] tool=internal_note      → ALLOW
[step 4] tool=send_customer_email → DENY  ACTION_NOT_AUTHORIZED  ← blocked before send
```

[View on GitHub](https://github.com/runcycles/cycles-agent-action-authority-demo) · [Blog walkthrough](/blog/action-authority-demo-support-agent-walkthrough)

---

**Next:** wire Cycles into your app with the [End-to-End Tutorial](/quickstart/end-to-end-tutorial), [compare it to your current stack](/concepts/comparisons), or — if you're new to the category — read [What is Cycles?](/quickstart/what-is-cycles).
