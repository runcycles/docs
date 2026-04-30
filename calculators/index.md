---
title: "Cycles Calculators — Free Tools for AI Agent Cost & Risk"
description: "Free interactive calculators for AI agent cost and blast-radius risk planning. Shareable URLs, CSV/PNG/Markdown export, and embed snippets for blogs and articles."
---

# Cycles Calculators

Two symmetric tools, one runtime-authority thesis. Cost calculators answer "how much will this workload spend?" Blast-radius calculators answer "how much damage can it cause if it goes wrong?" Both questions matter in production. Both are bounded by Cycles at the same runtime gate.

Every configuration produces a unique URL. Share it, embed it, export it.

## Available calculators

### Claude vs GPT Cost Calculator
Per-call, per-day, per-month, and per-year cost across current Claude and OpenAI models. Editable rates so you can plug in contracted pricing, add or remove rows for the models you actually use.

- **[Open fullscreen calculator ↗](/calculators/claude-vs-gpt-cost-standalone)** — recommended view; wider table, full toolbar
- [Embedded version on this docs page](/calculators/claude-vs-gpt-cost-comparison) — same calculator inside the docs flow

### AI Agent Blast Radius Risk Calculator
Expected damage per year across agent action classes, modeled by reversibility (×1 / ×3 / ×10) and visibility (+0 / +1 / +4), with an editable runtime-authority containment factor. Highlights the catastrophic *irreversible + public* class with a red row outline.

- **[Open fullscreen calculator ↗](/calculators/ai-agent-blast-radius-standalone)** — recommended view; wider table, full toolbar
- [Embedded version on this docs page](/calculators/ai-agent-blast-radius-risk) — same calculator inside the docs flow

## Share and embed

Each calculator's state is encoded in the URL. Configure the calculator, click **Share** to copy a link with your numbers preserved, and the recipient sees exactly the same view.

Beyond the share link, the toolbar offers:

- **Copy** — generates a Markdown table for Slack, GitHub PRs, email, or anywhere that renders Markdown
- **CSV** — downloads a comma-separated file for spreadsheets
- **PNG** — captures a screenshot of the table for decks and reports
- **Embed** — generates an `<iframe>` snippet to drop the calculator into a blog post, article, or vendor-comparison page. The embedded version preserves the URL state, so you can publish a pre-configured calculator showing the numbers your post argues for.

Embed snippets look like this:

```html
<iframe
  src="https://runcycles.io/calculators/claude-vs-gpt-cost-embed#s=..."
  width="100%" height="820" frameborder="0" loading="lazy"
  title="Cycles cost calculator"></iframe>
```

The embed view strips the docs chrome, shows only the calculator, and includes a small "Built with Cycles runtime authority" credit linking back to runcycles.io.

## Why estimates do not equal runtime authority

These calculators help with capacity planning. They do not stop spend at runtime, and they say nothing about *what* an agent is permitted to do.

Estimating that a workload will cost $4,200/month is the start of the conversation. The rest is enforcing that it actually costs no more than $4,200/month — even when an agent loops, a tenant misuses your API, or a deploy regresses to a more expensive model — *and* that no single action (a refund, a deploy, a deletion) can cause damage that dwarfs your entire monthly LLM bill in one call.

If your projection includes the words "should not exceed" or "we expect," you are still relying on hope. See [Why Cycles](/why-cycles) for the full runtime authority model — cost, action authority, blast radius, multi-tenant isolation — and [Debugging sudden LLM cost spikes](/troubleshoot/llm-cost-spike-debugging) for the diagnostic playbook when reality exceeds the estimate.
