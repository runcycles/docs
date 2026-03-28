---
title: "Integrating Cycles with OpenAI Agents SDK"
description: "Add budget governance to OpenAI Agents SDK workflows with automatic reserve, commit, and release for every LLM call, tool invocation, and agent handoff. Python plugin — no per-function decoration required."
---

# Integrating Cycles with OpenAI Agents SDK

[![PyPI](https://img.shields.io/pypi/v/runcycles-openai-agents)](https://pypi.org/project/runcycles-openai-agents/)
[![PyPI downloads](https://img.shields.io/pypi/dm/runcycles-openai-agents?label=downloads&color=555&style=flat-square)](https://pypi.org/project/runcycles-openai-agents/)

This guide shows how to add budget governance to [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) workflows using the [`runcycles-openai-agents`](https://pypi.org/project/runcycles-openai-agents/) plugin. The plugin hooks into the SDK's native `RunHooks` interface to automatically reserve, commit, and release budget for every LLM call, tool invocation, and agent handoff — with no per-function decoration required.

## Prerequisites

```bash
pip install runcycles-openai-agents
```

Set environment variables:

```bash
export OPENAI_API_KEY="sk-..."         # required by the OpenAI Agents SDK
export CYCLES_BASE_URL="http://localhost:7878"
export CYCLES_API_KEY="cyc_live_..."    # create via Admin Server — see note below
```

> **Prefer not to use environment variables?** All settings can be loaded programmatically from any secret manager, vault, or encrypted config file:
>
> ```python
> from runcycles import CyclesConfig, AsyncCyclesClient
> from runcycles_openai_agents import CyclesRunHooks
>
> config = CyclesConfig(
>     base_url=load_from_vault("cycles_base_url"),
>     api_key=load_from_vault("cycles_api_key"),
> )
> hooks = CyclesRunHooks(client=AsyncCyclesClient(config), tenant="acme")
> ```
>
> See [Python Client Configuration](/configuration/python-client-configuration-reference) for all options.

> **Need a Cycles server or API key?** See [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) or [API Key Management](/how-to/api-key-management-in-cycles). For tenant and budget setup, see [Tenant Management](/how-to/tenant-creation-and-management-in-cycles) and [Budget Allocation](/how-to/budget-allocation-and-management-in-cycles).

::: tip 60-Second Quick Start
```python
from agents import Agent, Runner
from runcycles_openai_agents import CyclesRunHooks

hooks = CyclesRunHooks(tenant="acme")
agent = Agent(name="helper", instructions="You are a helpful assistant.")
result = await Runner.run(agent, input="What is budget authority?", hooks=hooks)
print(result.final_output)
```
That's it — every LLM call and tool invocation in the agent run is now budget-guarded. If the budget is exhausted, `BudgetExceededError` is raised _before_ the call is made. Read on for production patterns with tool risk mapping and pre-run guardrails.
:::

## How it works

The plugin implements the SDK's `RunHooks` interface. Every hook in the agent lifecycle maps to a Cycles API call:

| Hook | Cycles API Call | Blocking | Detail |
|------|----------------|----------|--------|
| `on_tool_start` | `create_reservation` (risk points) | Raises on DENY | Budget reserved based on tool risk map |
| `on_tool_end` | `commit_reservation` | No | Actual risk points committed |
| `on_llm_start` | `create_reservation` (token/USD budget) | Raises on DENY | Budget reserved before each LLM call |
| `on_llm_end` | `commit_reservation` (actual tokens) | No | Real token count from `response.usage` committed |
| `on_handoff` | `create_event` (audit trail) | No | Handoff recorded in Cycles ledger |

Reservations include automatic heartbeat — long-running tools won't silently expire.

## Tool risk mapping

Assign risk-point costs to tools. High-risk tools (send_email, deploy) consume budget faster. Zero-cost tools skip the Cycles API entirely:

```python
from runcycles_openai_agents import CyclesRunHooks, ToolRiskMap, ToolRiskConfig

hooks = CyclesRunHooks(
    tenant="acme",
    tool_risk=ToolRiskMap(
        mapping={
            "send_email": 50,
            "update_crm": ToolRiskConfig(risk_points=10, action_kind="tool.crm.update"),
            "search_knowledge": 0,  # free — no reservation, no API call
        },
        default_risk=1,  # unmapped tools cost 1 point
    ),
)
```

Or use a simple dict:

```python
hooks = CyclesRunHooks(
    tenant="acme",
    tool_risk={"send_email": 50, "search": 0},
)
```

## Pre-run guardrail

`cycles_budget_guardrail` returns an `InputGuardrail` that calls `/v1/decide` before the agent starts. If the tenant is suspended or budget is exhausted, the guardrail trips and the agent never runs — zero tokens consumed:

```python
from agents import Agent
from runcycles_openai_agents import cycles_budget_guardrail

guardrail = cycles_budget_guardrail(
    tenant="acme",
    estimate=5_000_000,       # expected total run cost
    fail_open=True,           # allow if Cycles server is down
)

agent = Agent(
    name="support-bot",
    input_guardrails=[guardrail],
)
```

## Error handling

When budget is denied, the hooks raise `BudgetExceededError` — the agent stops and no further tokens are consumed:

```python
from runcycles import BudgetExceededError

try:
    result = await Runner.run(agent, input="...", hooks=hooks)
except BudgetExceededError as e:
    print(f"Budget denied: {e}")
```

If `Runner.run()` raises for any other reason, pending reservations stay locked until TTL expires. Call `release_pending()` to free them immediately:

```python
try:
    result = await Runner.run(agent, input="...", hooks=hooks)
except Exception:
    await hooks.release_pending("agent_run_failed")
    raise
```

See [Error Handling Patterns in Python](/how-to/error-handling-patterns-in-python) for more patterns.

## Fail-open / fail-closed

By default, if the Cycles server is unreachable the agent continues (`fail_open=True`). This prevents infrastructure issues from blocking all agents. Set `fail_open=False` to enforce strict budget governance:

```python
hooks = CyclesRunHooks(tenant="acme", fail_open=False)
```

This matches the Cycles philosophy: budget enforcement should be a guardrail, not a single point of failure.

## Configuration reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `AsyncCyclesClient` | `None` | Explicit client (or auto-created from config/env) |
| `config` | `CyclesConfig` | `None` | Creates client if no client given |
| `tenant` | `str` | `None` | Subject.tenant |
| `workspace` | `str` | `None` | Subject.workspace |
| `app` | `str` | `None` | Subject.app |
| `workflow` | `str` | `None` | Subject.workflow |
| `agent` | `str` | `None` | Subject.agent (overridden by actual agent name) |
| `tool_risk` | `dict` or `ToolRiskMap` | `{}` | Tool name → risk points |
| `default_tool_risk` | `int` | `1` | Risk points for unmapped tools |
| `llm_estimate` | `int` | `500_000` | Per-LLM-call estimate (~$0.005) |
| `llm_unit` | `Unit` | `USD_MICROCENTS` | Unit for LLM reservations |
| `fail_open` | `bool` | `True` | Allow execution if Cycles is down |
| `ttl_ms` | `int` | `60_000` | Reservation TTL (heartbeat extends at half-interval) |
| `overage_policy` | `CommitOveragePolicy` | `ALLOW_IF_AVAILABLE` | Overage policy for commits |
| `dry_run` | `bool` | `False` | Shadow mode — no budget consumed |

## Comparison with manual integration

If you're already using the `@cycles` decorator from the [Python client](/quickstart/getting-started-with-the-python-client), the plugin automates the same reserve → commit → release pattern at the agent framework level:

| Concern | `@cycles` decorator | `CyclesRunHooks` plugin |
|---------|---------------------|-------------------------|
| Reserve before LLM call | Your code (per function) | Automatic via `on_llm_start` |
| Reserve before tool call | Your code (per function) | Automatic via `on_tool_start` |
| Commit after completion | Your code (per function) | Automatic via `on_llm_end` / `on_tool_end` |
| Release on error | Your code | `release_pending()` |
| Tool risk policies | Not applicable | `ToolRiskMap` with per-tool costs |
| Pre-run guardrail | Not applicable | `cycles_budget_guardrail` |
| Agent handoff tracking | Not applicable | Automatic audit events via `on_handoff` |
| Heartbeat for long tools | Not applicable | Automatic TTL extension |

The plugin is the recommended approach for OpenAI Agents SDK users — it requires no per-function decoration and covers the full agent lifecycle automatically.

## Examples

See the [`examples/`](https://github.com/runcycles/cycles-openai-agents/tree/main/examples) directory for runnable integration examples:

| Example | Description |
|---------|-------------|
| [`basic_budget.py`](https://github.com/runcycles/cycles-openai-agents/blob/main/examples/basic_budget.py) | LLM token budget enforcement |
| [`tool_governance.py`](https://github.com/runcycles/cycles-openai-agents/blob/main/examples/tool_governance.py) | Tool risk mapping — high-risk tools cost more |
| [`multi_agent.py`](https://github.com/runcycles/cycles-openai-agents/blob/main/examples/multi_agent.py) | Multi-agent handoff with shared budget |

## Next steps

- [Error Handling Patterns in Python](/how-to/error-handling-patterns-in-python) — handling budget errors
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — strategies for graceful degradation
- [Testing with Cycles](/how-to/testing-with-cycles) — testing budget-guarded code
- [Production Operations Guide](/how-to/production-operations-guide) — running Cycles in production
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — pricing reference for estimation
- [runcycles-openai-agents on PyPI](https://pypi.org/project/runcycles-openai-agents/) — package page
- [Source on GitHub](https://github.com/runcycles/cycles-openai-agents) — full source code and examples
