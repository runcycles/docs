---
title: "How to Assign RISK_POINTS to Agent Tools"
description: "Step-by-step guide to classifying your agent's tools into risk tiers and assigning RISK_POINTS scores — with a reference table of 25+ common tools."
---

# How to Assign RISK_POINTS to Agent Tools

This guide walks you through scoring your agent's tools with [RISK_POINTS](/glossary#risk-points) — the unit Cycles uses for action authority enforcement. By the end, you'll have a scored tool list and a per-run budget you can configure directly.

**Prerequisites:**
- You know what RISK_POINTS are ([protocol reference](/protocol/understanding-units-in-cycles-usd-microcents-tokens-credits-and-risk-points))
- You have a list of tools your agent can call

## Step 1: List your tools

Start by inventorying every tool the agent can invoke. For each tool, note:

- **Name** — the function or tool name your agent calls
- **What it does** — one-sentence description
- **What it modifies** — does it read, write locally, call external APIs, mutate records, or execute irreversible actions?

Example inventory for a customer support agent:

| Tool | What it does | What it modifies |
|---|---|---|
| `search_knowledge` | Searches the knowledge base | Nothing (read-only) |
| `get_customer` | Looks up customer by ID | Nothing (read-only) |
| `save_draft_note` | Saves internal draft note | Local, reversible |
| `call_crm_api` | Reads customer data from CRM | External API (read) |
| `send_customer_email` | Sends email to customer's inbox | External, hard to reverse |
| `update_crm_status` | Updates customer status in CRM | External, hard to reverse |
| `create_jira_ticket` | Creates a Jira ticket | External API call |
| `issue_refund` | Processes a financial refund | Irreversible |

## Step 2: Classify each tool into a tier

Use these three questions to classify:

```
Does this tool modify any state?
├── NO → Tier 0 (Read-only)
│
└── YES
    ├── Can a human undo this in under 5 minutes?
    │   └── YES → Tier 1 (Write-local)
    │
    ├── Does it leave your system boundary (external API)?
    │   └── YES, but reversible → Tier 2 (Write-external)
    │
    ├── Does it affect someone who did not request it?
    │   (customer, external party, end user)
    │   └── YES, hard to reverse → Tier 3 (Mutation)
    │
    └── Is the change irreversible? (deploy, payment, permission grant)
        └── YES → Tier 4 (Execution)
```

The third question — **"Does it affect someone who did not request it?"** — is the key differentiator between Tier 2 (external but contained) and Tier 3 (customer-facing impact). An API call to a third-party service you control is Tier 2. An email landing in a customer's inbox is Tier 3 — even though both are external.

Each tier has a **base RISK_POINTS score**:

| Tier | Type | Base Points | Rationale |
|:---:|---|:---:|---|
| 0 | Read-only | 0 | No side effects — reads should be free |
| 1 | Write-local | 1 | Low impact, easily reversible |
| 2 | Write-external | 5 | External dependency, some coordination to reverse |
| 3 | Mutation | 20 | Customer-facing impact, difficult to reverse |
| 4 | Execution | 50 | Irreversible, financial or production impact |

::: tip Edge cases
A "file write" could be Tier 1 (temp log) or Tier 4 (production config overwrite). Use the three questions above — they resolve ambiguity better than the action name alone. The same tool in different deployments can have different tiers based on what it connects to.
:::

## Step 3: Apply context multipliers

Base points assume a generic context. Four factors adjust them for your specific deployment. **Take the maximum** of all four — they don't stack multiplicatively.

**Formula:** `Final RISK_POINTS = Base × max(Audience, Sensitivity, Regulatory, Reputational)`

### Audience size

| Audience | Multiplier |
|---|:---:|
| Internal only | 1x |
| Single external party | 1.5x |
| Customer segment (<100) | 2x |
| Broad external (100+) | 3x |

### Data sensitivity

| Sensitivity | Multiplier |
|---|:---:|
| Public data | 1x |
| Internal business data | 1.5x |
| Customer PII | 2x |
| Financial / health / regulated | 3x |

### Regulatory context

| Regulatory | Multiplier |
|---|:---:|
| No specific regulation | 1x |
| General data protection (e.g., GDPR) | 1.5x |
| Industry-specific (e.g., HIPAA, PCI-DSS, SOX) | 2x |
| Multiple overlapping regulations | 3x |

### Reputational exposure

| Exposure | Multiplier |
|---|:---:|
| Internal only | 1x |
| Single external party | 1.5x |
| Customer-facing (visible to end users) | 2x |
| Press / social media / regulatory scrutiny | 3x |

### Applying the formula

For `send_customer_email`:
- Base: Tier 3 = 20 points
- Audience: customer segment (2x)
- Sensitivity: internal business data (1.5x)
- Regulatory: none (1x)
- Reputational: customer-facing (2x)
- Max multiplier: **2x** (audience or reputational)
- Final: 20 × 2 = **40 RISK_POINTS**

## Step 4: Set your per-run budget

Sum the expected tool calls for a **typical** run, then add buffer:

1. Count how many times each tool is called in a normal agent run
2. Multiply each by its RISK_POINTS score
3. Sum the results
4. Add 20-30% buffer for variance

**Example: Customer support agent**

| Tool | Score | Typical calls per run | Points consumed |
|---|:---:|:---:|:---:|
| `search_knowledge` | 0 | 4-6 | 0 |
| `get_customer` | 0 | 1-2 | 0 |
| `save_draft_note` | 2 | 1 | 2 |
| `call_crm_api` | 5 | 1 | 5 |
| `send_customer_email` | 40 | 1 | 40 |
| `update_crm_status` | 40 | 1 | 40 |
| `create_jira_ticket` | 5 | 0-1 | 0-5 |
| `issue_refund` | 150 | 0 (rare) | 0 |
| **Normal run total** | | | **87-92** |

Set per-run budget to **250 RISK_POINTS**:
- Normal resolution: ~90 points (comfortable headroom)
- Complex resolution (email + ticket + CRM update): ~90 points
- Single refund + email: 150 + 40 = 190 points (fits)
- Two refunds: 300 points (does **not** fit — requires escalation)

This budget lets the agent handle any normal support interaction while preventing it from issuing multiple refunds or sending dozens of emails in a single run.

## Step 5: Validate with shadow mode

Before enforcing, run with [`dry_run: true`](/protocol/webhook-scope-filter-syntax) for 1-2 weeks:

1. Create the RISK_POINTS budget via admin API
2. Set reservations to dry-run mode
3. Monitor the shadow-mode denial rate:
   - **> 5%** — scores or budget too tight, agents can't do normal work
   - **1-3%** — catching real anomalies without blocking legitimate work
   - **0%** — budget is too loose, won't catch incidents
4. Adjust individual tool scores or the run budget based on the data
5. When denial patterns are no longer surprising, enable enforcement

See the [shadow mode rollout guide](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) for the full process.

## Common tool classifications

Reference table for 25+ common tools. **These are starting points** — adjust based on your deployment context using the multiplier framework above.

### Tier 0 — Read-only (0 base points)

| Tool | Description | Typical final score |
|---|---|:---:|
| `search` / `search_knowledge` | Search knowledge base, vector DB | 0 |
| `get_user` / `get_customer` | Look up user/customer record | 0 |
| `read_file` | Read a local file | 0 |
| `get_weather` | Weather API lookup | 0 |
| `web_search` | Web search (Google, Bing) | 0 |
| `list_records` | List/query database records | 0 |
| `get_balance` | Check account balance | 0 |

::: tip Reads in regulated environments
If your agent handles PII, financial, or health data, consider assigning 1-2 points to sensitive read tools or tracking them under a separate budget. An agent that reads 10,000 customer records hasn't changed state, but has created a data-exposure surface.
:::

### Tier 1 — Write-local (1 base point)

| Tool | Description | Typical final score |
|---|---|:---:|
| `save_draft` | Save draft document | 1 |
| `log_event` | Write to application log | 1 |
| `update_cache` | Update local cache | 1 |
| `save_note` / `add_internal_note` | Save internal note | 1-2 |

### Tier 2 — Write-external (5 base points)

| Tool | Description | Typical final score |
|---|---|:---:|
| `call_external_api` | Generic third-party API call | 5-10 |
| `webhook_post` | Fire a webhook | 5-10 |
| `create_jira_ticket` | Create a ticket in external tracker | 5-10 |
| `post_to_internal_slack` | Post to an internal Slack channel | 5 |
| `generate_image` | Generate image via API (Stable Diffusion, DALL-E) | 5-10 |
| `generate_video` | Generate video via API | 10-15 |

### Tier 3 — Mutation (20 base points)

| Tool | Description | Typical final score |
|---|---|:---:|
| `send_email` / `send_customer_email` | Send email to customer | 40-60 |
| `send_external_slack` | Post to customer-shared Slack channel | 40-60 |
| `update_record` / `update_crm` | Update database/CRM record | 20-40 |
| `delete_record` | Delete a database record | 40-60 |
| `create_calendar_event` | Schedule meeting on someone's calendar | 20-40 |
| `update_subscription` | Modify a customer's subscription | 40-60 |

### Tier 4 — Execution (50 base points)

| Tool | Description | Typical final score |
|---|---|:---:|
| `deploy` / `trigger_deploy` | Deploy to production | 100-150 |
| `execute_payment` / `issue_refund` | Process financial transaction | 100-150 |
| `grant_permission` | Modify access control | 100-150 |
| `execute_code` | Run arbitrary code | 100 |
| `delete_database` | Drop a table or database | 150 |
| `modify_infrastructure` | Change cloud infrastructure (scaling, networking) | 100-150 |

## Worked example: Scoring from scratch

A data analysis agent with these tools:

1. **`query_database`** — reads data → Tier 0, 0 points
2. **`web_search`** — external search → Tier 0, 0 points (read-only)
3. **`generate_chart`** — calls chart API → Tier 2, 5 points (external, reversible)
4. **`send_report_email`** — emails stakeholders → Tier 3, 20 × 2x (customer segment audience) = **40 points**
5. **`update_dashboard`** — writes to internal dashboard → Tier 1, 1 point (easily reversible)
6. **`export_to_s3`** — writes file to S3 bucket → Tier 2, 5 × 1.5x (internal business data) ≈ **8 points** (round up)

Typical run: 10 queries (0) + 3 searches (0) + 2 charts (10) + 1 email (40) + 1 dashboard update (1) + 1 export (8) = **59 points**

Set run budget: **100 RISK_POINTS** — allows a normal run with room for a second email or extra charts, but prevents sending 3+ reports in a loop.

## When to recalibrate

Review your scores when:

- **A new tool is added.** Classify and score it before deployment.
- **An incident occurs.** If a tool caused damage, re-evaluate its tier and multiplier.
- **Usage patterns shift.** If shadow mode shows agents consistently near the budget ceiling on normal runs, the budget is too tight — raise it or optimize the workflow.
- **Commit overage events climb.** Rising [`reservation.commit_overage`](/protocol/event-payloads-reference) events indicate your cost estimates are drifting from reality. Tool scores may need adjusting too.

## Next steps

- [AI Agent Risk Assessment](/blog/ai-agent-risk-assessment-score-classify-enforce-tool-risk) — the full framework deep-dive
- [AI Agent Action Control](/blog/ai-agent-action-control-hard-limits-side-effects) — why action authority matters beyond cost
- [Shadow Mode Rollout](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) — validating scores before enforcing
- [Event Payloads Reference](/protocol/event-payloads-reference) — monitoring commit overage and denial events
