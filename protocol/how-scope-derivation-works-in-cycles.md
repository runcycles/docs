# How Scope Derivation Works in Cycles

Budget enforcement in Cycles is hierarchical.

A single action does not just charge one counter. It may need to satisfy limits at multiple levels — tenant, workspace, app, workflow, agent, toolset — all at once.

That is what makes Cycles different from flat usage counters.

But how does the server know which budget scopes to check and charge?

That is scope derivation.

## What scope derivation is

Scope derivation is the process by which the server transforms a Subject (a bag of dimension fields) into an ordered set of canonical scope identifiers.

When a reservation, commit, release, or event is processed, the server derives every scope that needs to be affected.

For example, given a Subject with:

- tenant: `acme`
- app: `support-bot`
- workflow: `refund-assistant`

The server derives these scopes (in canonical order):

1. `tenant:acme`
2. `tenant:acme/workspace:default`
3. `tenant:acme/workspace:default/app:support-bot`
4. `tenant:acme/workspace:default/app:support-bot/workflow:refund-assistant`

Each of these scopes is a separate budget boundary. A reservation must satisfy all of them.

## The canonical hierarchy

The Cycles protocol defines a fixed ordering for Subject fields:

```
tenant → workspace → app → workflow → agent → toolset
```

This ordering is normative. The server always processes fields in this order, and `affected_scopes` in responses are always returned in this canonical order.

## Gap-filling with defaults

Not every Subject includes all six fields. When a field is missing from the hierarchy, the server fills the gap with `"default"`.

For example, given:

- tenant: `acme`
- agent: `summarizer-v2`

The derived scope path is:

```
tenant:acme/workspace:default/app:default/workflow:default/agent:summarizer-v2
```

And the derived scopes are:

1. `tenant:acme`
2. `tenant:acme/workspace:default`
3. `tenant:acme/workspace:default/app:default`
4. `tenant:acme/workspace:default/app:default/workflow:default`
5. `tenant:acme/workspace:default/app:default/workflow:default/agent:summarizer-v2`

Gap-filling ensures that every scope path is unambiguous and consistent, regardless of which fields the client provides.

## Why hierarchical scopes matter

Hierarchical scopes enable layered budget governance.

### Tenant-level protection

The tenant scope ensures that all actions under a tenant count against the tenant's total budget.

No matter which app, workflow, or agent is running, the tenant boundary is always checked.

### App-level isolation

Different applications under the same tenant can have different budgets.

A support bot and a research agent can each have their own budget envelope, preventing one from consuming the other's allocation.

### Workflow-level control

Within an app, different workflows can have different cost profiles.

A refund workflow may justify more budget than a simple FAQ response.

### Agent-level boundaries

Within a workflow, individual agents can be bounded separately.

A planning agent and an execution agent can each have their own limits.

### Toolset-level restrictions

Within an agent, different toolsets can be governed independently.

Web search tools may have a different budget than database query tools.

## Atomic reservation across scopes

When a reservation is created, budget is reserved atomically across all derived scopes.

If any scope has insufficient budget, the reservation fails entirely. There is no partial reservation.

This prevents situations where a reservation succeeds at the local level but violates a parent boundary.

For example, if a workflow has budget remaining but the tenant is exhausted, the reservation is denied at the tenant scope.

## affected_scopes in responses

Reservation and event responses include an `affected_scopes` field listing all scopes that were charged.

This tells the client exactly which budget boundaries were affected, which is useful for:

- debugging denial reasons
- understanding which scope is the bottleneck
- monitoring budget pressure across the hierarchy

## scope_path

The `scope_path` field in responses is the full canonical path for the reservation.

For example: `tenant:acme/workspace:default/app:support-bot/workflow:refund-assistant`

This uniquely identifies the leaf scope in the hierarchy.

## Custom dimensions

The Subject also supports a `dimensions` field for custom key-value pairs.

For example:

```json
{
  "tenant": "acme",
  "app": "support-bot",
  "dimensions": {
    "cost_center": "engineering",
    "run": "run-12345"
  }
}
```

In v0, servers may or may not use dimensions for budgeting decisions. But they must accept and round-trip the data.

This is how concepts like "run budgets" can be modeled — by passing a unique run identifier through dimensions.

## Scope derivation and balances

When querying balances (`GET /v1/balances`), the same scope hierarchy applies.

A balance query for tenant `acme` returns balances at all scopes under that tenant.

A balance query for app `support-bot` returns balances for that app and its children.

This gives operators visibility into budget state at any level of the hierarchy.

## Practical implications

### Budget allocation flows top-down

Tenant budgets constrain everything beneath them. If the tenant is exhausted, no child scope can reserve budget, even if the child has its own allocation.

### Pressure signals flow bottom-up

When a workflow or agent scope runs low, that pressure is visible at higher levels through balance queries and denial signals.

### Scope design is a policy decision

The scopes you populate on each Subject determine which budget boundaries are checked.

If you only provide tenant and workflow, the server derives scopes for tenant, workspace (default), app (default), and workflow. Agent and toolset scopes are not checked.

This means scope design is part of policy design. More scopes mean finer-grained control but more configuration.

## Summary

Scope derivation transforms Subject fields into a hierarchical set of budget boundaries:

- The canonical order is: tenant → workspace → app → workflow → agent → toolset
- Missing fields are gap-filled with `"default"`
- Reservations are atomic across all derived scopes
- Balances, affected_scopes, and scope_path all follow the same hierarchy
- Custom dimensions extend the model for additional taxonomies

Understanding scope derivation is essential for designing effective budget policy in Cycles.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Python using the [Python Client](https://github.com/runcycles/cycles-client-python)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
