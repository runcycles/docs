---
title: "Your AI Agents Are Running in Production. Who's Watching the Limits?"
date: 2026-04-09
author: Albert Mavashev
tags: [product, operations, dashboard, runtime-authority]
description: "AI agents have budgets and risk limits. But when something breaks at 2am, what do you actually do? Three production scenarios and how an operational dashboard changes the game."
blog: true
sidebar: false
head:
  - - meta
    - name: keywords
      content: "AI agent budget control, AI agent risk governance, admin dashboard, runtime authority, agent cost management, risk points, budget monitoring, incident response, API key management, webhook management"
---

# Your AI Agents Are Running in Production. Who's Watching the Limits?

Every team building AI agents eventually adds budget limits. Some add risk scoring. You set up a governance layer — cost caps per tenant, risk point budgets per agent, overdraft policies for when things get tight.

Then it's 2am. An agent burns through its risk allowance. A tenant hits their spend ceiling mid-transaction. Your compliance webhook stopped receiving events three hours ago and nobody noticed.

You SSH into a box. You grep for the right curl command in the runbook. You try to remember if it's `scope=tenant:acme/agent:primary` or `scope=tenant:acme/agents:primary`. You get a 404. You check the spec. You try again. Meanwhile, Slack is on fire.

**Governance systems need an operational surface.** Not just APIs — a place where operators can see what's happening, decide what to do, and act on it. Without leaving the browser. Without remembering endpoint paths.

Here are three production scenarios we kept hitting, and how we solved each one.

<!-- more -->

## Scenario 1: Agent burns through its risk budget

Your customer support agent hit its [risk point](/glossary#risk-points) ceiling. It's been making tool calls that score high on the risk scale — external API calls, database writes, email sends. The budget is at 85% utilization. Customers are starting to get fallback responses.

You need to see the situation, decide if the usage is legitimate, and either credit more risk points or freeze the scope before it gets worse.

![Overview showing budget alerts, debt scopes, and event activity across all tenants](/images/dashboard/overview-alerts.png)

The overview surfaces it immediately: over-limit budgets, scopes with outstanding debt, and recent event activity across all tenants. You can see that `tenant:wayne-corp/agent:primary` is burning through RISK_POINTS — and drill straight into the budget detail.

From there, one click opens the fund dialog. Select **Credit**, enter the amount, add a reason for the audit trail. The budget is topped up. The agent resumes. Total time: under 30 seconds.

![Budget detail showing RISK_POINTS utilization at 85% with the Fund Budget dialog open](/images/dashboard/risk-budget-fund.png)

If the usage looks suspicious instead of legitimate? Click **Freeze** directly from the budget list. No detail page needed. The scope is locked immediately — all reservations, commits, and fund operations blocked until you unfreeze it.

This works for cost budgets too. USD spend, token usage, credits — the same workflow applies. The governance system doesn't care whether you're capping dollars or risk. The operator shouldn't have to either.

## Scenario 2: Compromised API key

Your audit logs show unusual patterns — a burst of auth failures followed by successful operations from an IP you don't recognize. Someone may have a leaked key.

You need to revoke it immediately, provision a replacement, hand the new secret to the team, and verify the audit trail — all without a deploy.

![Audit logs with expanded metadata showing operation details, resource IDs, and request context](/images/dashboard/audit-investigation.png)

Filter audit logs by `resource_type: api_key` and the time window. Expand any row to see the full context: who did what, from which IP, with what parameters. The metadata shows the exact resource ID, operation, and request details.

Found the compromised key? Click **Revoke** on the API Keys page. It's invalidated instantly. Active reservations using that key can still commit (no data loss), but no new operations are permitted.

Now create a replacement. The new key secret is shown exactly once — copy it, confirm you've saved it, and the dialog closes. The secret is never stored in the dashboard or retrievable again.

![API Key Created dialog showing the one-time secret with copy button and confirmation checkbox](/images/dashboard/key-secret-reveal.png)

The clipboard auto-clears after 60 seconds. The entire rotation — revoke old, create new, copy secret — takes under a minute without touching a terminal.

## Scenario 3: Webhook delivery failing silently

Your compliance audit sink stopped receiving events. You check the webhook detail: 2 pending deliveries, the endpoint returning errors. Your SOC2 auditor is going to ask about the gap.

![Webhook detail showing action buttons, subscribed event types, and delivery history](/images/dashboard/webhook-operations.png)

The webhook detail page gives you everything in one view: the URL, subscribed event types, delivery history, and a row of action buttons. **Send Test** to verify connectivity — you'll see the HTTP status, response time, and error message inline. If the URL changed, click **Edit** to update it. Need a new signing secret? **Rotate Secret** generates a cryptographically strong one and shows it via the same one-time reveal pattern.

Once the endpoint is fixed, click **Replay** to re-deliver the events that were missed. Set the time window, hit execute, and the gap is closed.

If the webhook needs maintenance downtime, **Pause** it from the list view — events will be silently dropped rather than piling up failed deliveries. **Enable** it when you're ready.

## What this looks like at scale

These aren't toy examples. The seeded environment behind those screenshots has 12 tenants, 42 budgets across four unit types (USD, tokens, credits, risk points), 6 webhooks, and a full audit trail. Every operation is tracked with resource type, resource ID, and metadata. Filter, expand, export to CSV or JSON for your compliance team.

The operational checklist:

- **Freeze a runaway scope in under 10 seconds?** Yes — directly from the budget list.
- **Credit risk points without a deploy?** Yes — Fund dialog with audit reason.
- **Rotate a webhook secret and see it exactly once?** Yes — crypto-strong generation with auto-clear clipboard.
- **Export audit logs for your SOC2 auditor?** Yes — CSV and JSON with all metadata.
- **Revoke a key and provision a replacement in under a minute?** Yes — without touching a terminal.
- **See cost and risk budgets in the same view?** Yes — USD, tokens, credits, and risk points side by side.

## Try it

```bash
docker compose up -d   # starts admin server + Redis
npm run dev            # starts dashboard on localhost:5173
```

Login with your admin API key. Everything else is in the [README](https://github.com/runcycles/cycles-dashboard).

The dashboard is open source, ships as a Docker image, and covers every admin endpoint in the [Cycles governance spec](https://github.com/runcycles/cycles-server-admin/blob/main/complete-budget-governance-v0.1.25.yaml). If your agents have budgets, they deserve an ops UI.
