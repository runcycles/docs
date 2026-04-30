---
title: "Cycles Guides"
description: "In-depth guides on the two dimensions of runtime authority for AI agents: cost (what they spend) and action / blast radius (what they do). Each guide is a map of how the topic connects across blog posts, how-tos, and protocol reference."
---

# Cycles Guides

Long-form guides covering the two core enforcement dimensions of runtime authority. Each guide is a map — a short orientation per subtopic that links into the deep coverage. Read top to bottom for a structured view, or jump to whichever section matches what you are working on.

## The two core enforcement dimensions of runtime authority

Cost and action are different enforcement problems. Cost controls *how much* an agent can spend; action authority controls *what* it is allowed to do. Most real production incidents touch both — a runaway agent that loops on the LLM is a cost incident; an agent that loops while writing to a database is an action incident; a single agent that does both is the canonical disaster scenario.

Tenant isolation and audit evidence build on these two enforcement dimensions: who owns the budget, and what record each decision leaves behind.

- **[The LLM Cost Control Guide](/guides/llm-cost-control)** — bounding what AI agents *spend*. Causes of cost blowups, why dashboards are not enough, the runtime patterns that work, multi-tenant cost isolation, unit economics, and provider-specific patterns.
- **[The AI Agent Risk & Blast Radius Guide](/guides/risk-and-blast-radius)** — bounding what AI agents *do*. Risk scoring, action authority, blast-radius containment, degradation paths, delegation chains, governance frameworks, and incident patterns.

More guides on multi-tenant operations and audit / evidence are in development.
