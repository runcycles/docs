---
title: "AI Agent Action Authority: Block Unauthorized Emails and Side Effects Before Execution"
date: 2026-03-22
author: Cycles Team
tags: [action-authority, demo, agents, runtime-authority, walkthrough, action-control, side-effects]
description: "A support agent has access to CRM, notes, and email — but should every run be allowed to send? This demo walkthrough shows how Cycles blocks a customer email before execution while allowing internal actions to proceed. Three decorators, one exception, zero unauthorized side effects."
blog: true
sidebar: false
---

# AI Agent Action Authority: Block Unauthorized Emails and Side Effects Before Execution

A support agent handles a billing dispute. Its workflow has four steps: read the case, log an internal note, update the CRM status, and send the customer a reply. Without a runtime decision layer, all four steps execute — including the email. With Cycles, the first three steps proceed normally. The fourth — `send_customer_email` — is blocked before execution because the `send-email` toolset has no provisioned budget. The email function never runs. The customer never receives an unauthorized message.

This post walks through the [action authority demo](https://github.com/runcycles/cycles-agent-action-authority-demo) step by step: what the agent does, how the unguarded and guarded runs differ, and what the code change looks like.

<!-- more -->

## The scenario

Customer case #4782: Acme Corp's invoice shows $847, but their contract says $720. A support automation agent (`support-bot`) picks up the case and runs a four-step workflow:

| Step | Tool | Toolset | Risk level |
|:----:|------|---------|------------|
| 1 | `read_case` | *(local)* | Read-only — no state change |
| 2 | `append_internal_note` | `internal-notes` | Write-local — internal log entry |
| 3 | `update_crm_status` | `crm-updates` | Mutation — changes case state |
| 4 | `send_customer_email` | `send-email` | Write-external — irreversible once delivered |

Steps 1–3 are internal operations. Step 4 is the consequential one: once the email is sent, it cannot be unsent. In the [action-control taxonomy](/blog/ai-agent-action-control-hard-limits-side-effects), internal notes fall at tier 2 (write-local, reversible) and outbound email at tier 3 (write-external, irreversible). The risk difference is not about cost — all four actions cost the same in model terms. It is about what happens if the action should not have been taken.

The tools in this demo are mocked. No real CRM, email service, or ticketing system is involved. The action authority is real.

## Without Cycles: all actions execute

When the agent runs without Cycles, every step completes with a green checkmark:

```
╭──────────── Support Case #4782 ─────────────╮
│ Customer:  Acme Corp (jane@acme.com)         │
│ Subject:   Invoice shows $847, contract $720 │
│ Agent:     support-bot                       │
│ Mode:      UNGUARDED                         │
╰──────────────────────────────────────────────╯

╭──────────── Action Log ──────────────────────╮
│  ✓ read_case                                  │
│  ✓ append_internal_note  [internal-notes]     │
│  ✓ update_crm_status     [crm-updates]        │
│  ✓ send_customer_email   [send-email]         │
╰──────────────────────────────────────────────╯

╭──────────── Result — UNGUARDED ──────────────╮
│ All actions executed — including the email.   │
│ 4 actions approved · 0 actions blocked        │
╰──────────────────────────────────────────────╯
```

The agent did exactly what it was told. That is the problem. No approval gate existed, so the email went out unchecked. In production, this means a customer receives a potentially premature or incorrect message — and you find out after the fact.

## With Cycles: the email is blocked

Same agent, same tools, same workflow. The only difference is that each tool call now passes through the Cycles server before execution. The first three steps still succeed. The fourth does not:

```
╭──────────── Support Case #4782 ─────────────╮
│ Customer:  Acme Corp (jane@acme.com)         │
│ Subject:   Invoice shows $847, contract $720 │
│ Agent:     support-bot                       │
│ Mode:      GUARDED                           │
╰──────────────────────────────────────────────╯

╭──────────── Action Log ──────────────────────╮
│  ✓ read_case                                  │
│    Loaded case #4782 — Acme Corp              │
│                                               │
│  ✓ append_internal_note  [internal-notes]     │
│    POST /v1/reservations → 200 ALLOW          │
│    Billing discrepancy: $847 vs $720          │
│                                               │
│  ✓ update_crm_status     [crm-updates]        │
│    POST /v1/reservations → 200 ALLOW          │
│    Status: Open → Investigating               │
│                                               │
│  ✗ send_customer_email   [send-email]         │
│    POST /v1/reservations → 409 BUDGET_EXCEEDED│
│    Email NOT sent — escalated to human.       │
╰──────────────────────────────────────────────╯

╭──────────── Result — GUARDED ────────────────╮
│ Cycles blocked the customer email before it   │
│ was sent.                                     │
│ 3 actions approved · 1 action blocked         │
╰──────────────────────────────────────────────╯
```

The `send_customer_email` function never executed. Not "rolled back." Not "logged and flagged for review." The function body never ran. The Cycles server returned `409 BUDGET_EXCEEDED` on the reservation attempt, the `@cycles` decorator raised `BudgetExceededError`, and the agent caught the exception and reported: *"Email NOT sent — escalated to human for approval."*

## The code change

The diff between `unguarded.py` and `guarded.py` is exactly this:

```python
# --- Import the SDK ---
from runcycles import (
    BudgetExceededError, CyclesClient, CyclesConfig,
    cycles, set_default_client,
)

# --- Initialize the client ---
config = CyclesConfig(
    base_url=os.environ["CYCLES_BASE_URL"],
    api_key=os.environ["CYCLES_API_KEY"],
    tenant=os.environ["CYCLES_TENANT"],
    agent="support-bot",
)
set_default_client(CyclesClient(config))

# --- Three decorators with toolset scoping ---
@cycles(estimate=COST_PER_ACTION_MICROCENTS, action_kind="tool.notes",
        action_name="append-note", toolset="internal-notes")
def append_internal_note(case_id, note):
    return _append_note(case_id, note)

@cycles(estimate=COST_PER_ACTION_MICROCENTS, action_kind="tool.crm",
        action_name="update-status", toolset="crm-updates")
def update_crm_status(case_id, old_status, new_status):
    return _update_status(case_id, old_status, new_status)

@cycles(estimate=COST_PER_ACTION_MICROCENTS, action_kind="tool.email",
        action_name="send-reply", toolset="send-email")
def send_customer_email(case_id, to, subject, body):
    return _send_email(case_id, to, subject, body)

# --- Catch the budget exception ---
try:
    send_customer_email(...)
except BudgetExceededError:
    # email not sent — escalated to human
```

Three decorators. One except. Only approved actions execute. The tool functions themselves are unchanged — the same `append_internal_note`, `update_crm_status`, and `send_customer_email` implementations from `tools.py` are called inside each wrapper.

## How toolset scoping works

The control is not in the code. It is in the budget provisioning.

The Cycles scope hierarchy for this demo looks like this:

```
tenant:demo-tenant
└─ workspace:default
   └─ app:default
      └─ workflow:default
         └─ agent:support-bot
            ├─ toolset:internal-notes   → $1.00 budget ✓
            ├─ toolset:crm-updates      → $1.00 budget ✓
            └─ toolset:send-email       → no budget     ✗
```

The provisioning script creates $1.00 budgets at every level of the hierarchy — tenant, workspace, app, workflow, agent — and then creates toolset-level budgets **only** for approved actions:

```bash
# Toolset budgets — ONLY for approved actions
for TOOLSET in "internal-notes" "crm-updates"; do
  SCOPE="tenant:$TENANT_ID/.../agent:support-bot/toolset:$TOOLSET"
  curl -X POST "$ADMIN_URL/budgets" \
    -d '{"scope": "'$SCOPE'", "allocated": {"amount": 100000000}}'
done
# NOTE: No budget for toolset:send-email → 409 on any reservation
```

When the `@cycles` decorator tries to reserve budget for `toolset:send-email`, the server walks the hierarchy, finds no budget at the toolset level, and returns `409 BUDGET_EXCEEDED`. The decorator raises the exception. The action never runs.

This is the operational model: **approving or revoking an agent action = adding or removing a budget**. Want the agent to send emails? Add a budget for `toolset:send-email`. Want to revoke it? Remove the budget. No code changes. No redeployment. No new API keys.

## Why not just use an allowlist?

Static tool allowlists are the most common alternative. They work for simple cases, but they break down in several ways that matter:

**Allowlists can't adapt at runtime.** A hardcoded list of approved tools requires a code change and redeployment to modify. If you need to temporarily revoke a tool — say, during an incident when you don't want any automated emails going out — you're waiting on a deploy.

**API keys grant blanket access.** If the agent has an API key for the email service, it can send emails. Period. The key doesn't know whether this particular run should be allowed to send, or whether the email content was reviewed, or whether the agent is in a loop.

**Role-based permissions don't distinguish "can" from "should."** An agent with the `email-sender` role *can* send emails. But that does not mean every run *should* send emails. The role is a static capability. The runtime decision — should this action proceed right now, in this context — is what's missing.

Cycles makes that decision per-action, per-run, before execution. This is what [runtime authority](/blog/what-is-runtime-authority-for-ai-agents) means in practice: not a static permission check, but a live enforcement point that can allow, constrain, or deny each consequential action as it happens.

## Run it yourself

Prerequisites: Docker Compose v2+, Python 3.10+, `curl`.

```bash
git clone https://github.com/runcycles/cycles-agent-action-authority-demo
cd cycles-agent-action-authority-demo
python3 -m venv .venv && source .venv/bin/activate
pip install -r agent/requirements.txt
./demo.sh
```

The script starts the Cycles stack (Redis + server + admin), provisions the tenant and toolset budgets, then runs both modes back to back. First run pulls ~200MB in Docker images; subsequent runs start in seconds. Stop with `./teardown.sh`.

## What's next

This demo shows action authority for a single agent with three tools. The concept extends to any number of agents, tools, and scoping levels.

For the conceptual foundation behind this demo:
- [AI Agent Action Control: Hard Limits on Side Effects](/blog/ai-agent-action-control-hard-limits-side-effects) — the taxonomy of consequential actions and why budget authority alone is not enough
- [What Is Runtime Authority for AI Agents?](/blog/what-is-runtime-authority-for-ai-agents) — the definition of runtime authority and how it differs from observability and rate limits

To add Cycles to your own application:
- [End-to-End Tutorial](https://runcycles.io/quickstart/end-to-end-tutorial) — zero to a working budget-guarded app in 10 minutes
- [Adding Cycles to an Existing App](https://runcycles.io/how-to/adding-cycles-to-an-existing-application) — incremental adoption guide

Protocol and SDKs:
- [Protocol](https://github.com/runcycles/cycles-protocol) · [Python](https://pypi.org/project/runcycles/) · [TypeScript](https://www.npmjs.com/package/runcycles) · [Java](https://github.com/runcycles/cycles-client-java)
