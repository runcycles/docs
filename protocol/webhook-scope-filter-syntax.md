---
title: "Webhook Scope Filter Syntax"
description: "How to filter webhook events by scope using scope_filter on subscriptions — exact match and trailing wildcard syntax with examples."
---

# Webhook Scope Filter Syntax

Webhook subscriptions can filter events by scope path using the `scope_filter` field. When set, only events whose `scope` matches the filter are delivered to your endpoint. Events without a scope (some system events) are never delivered to subscriptions with a scope filter.

## Matching rules

The scope filter supports two modes:

### Exact match (no wildcard)

The event scope must exactly equal the filter string.

```json
{
  "scope_filter": "tenant:acme-corp/workspace:prod"
}
```

This delivers events **only** when the event scope is exactly `tenant:acme-corp/workspace:prod`. Events scoped to `tenant:acme-corp/workspace:prod/workflow:support` would **not** match.

### Prefix match (trailing wildcard)

A filter ending with `*` matches any event scope that starts with the prefix before the `*`.

```json
{
  "scope_filter": "tenant:acme-corp/*"
}
```

This delivers events for any scope under `tenant:acme-corp/`, including:
- `tenant:acme-corp/workspace:prod`
- `tenant:acme-corp/workspace:prod/workflow:support`
- `tenant:acme-corp/workspace:staging/agent:bot-1`

### No filter (default)

If `scope_filter` is null, empty, or not provided, the subscription matches **all events** regardless of scope.

```json
{
  "scope_filter": null
}
```

## Syntax summary

| Filter | Matches |
|---|---|
| `null` / empty | All events (no filtering) |
| `tenant:acme-corp` | Only events with scope exactly `tenant:acme-corp` |
| `tenant:acme-corp/*` | Events with scope starting with `tenant:acme-corp/` |
| `tenant:acme-corp/workspace:prod` | Only events with that exact scope |
| `tenant:acme-corp/workspace:prod/*` | Events with scope starting with `tenant:acme-corp/workspace:prod/` |

## What's NOT supported

- **Mid-string wildcards** — `tenant:*/workspace:prod` does not work. The `*` is only meaningful at the end of the filter string.
- **Multiple wildcards** — `tenant:acme-corp/*/workflow:*` is not valid. Only one trailing `*` is supported.
- **Regex** — no regular expression matching is supported.
- **Glob patterns** — `?`, `[a-z]`, and other glob characters are treated as literal characters.
- **Multiple scope filters per subscription** — each subscription has a single `scope_filter` string. Create multiple subscriptions if you need to watch multiple unrelated scopes.

If a `*` appears anywhere other than the end of the filter string, it is treated as a **literal character** in an exact-match comparison (which almost certainly won't match any real scope).

## Examples

### Subscribe to all events for one tenant

```bash
curl -X POST http://localhost:7979/v1/admin/webhooks \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ops.example.com/cycles-events",
    "event_types": [],
    "scope_filter": "tenant:acme-corp/*"
  }'
```

### Subscribe to one specific workspace

```bash
curl -X POST http://localhost:7979/v1/admin/webhooks \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ops.example.com/prod-alerts",
    "event_types": ["budget.exhausted", "reservation.denied"],
    "scope_filter": "tenant:acme-corp/workspace:prod/*"
  }'
```

This delivers only `budget.exhausted` and `reservation.denied` events where the scope starts with `tenant:acme-corp/workspace:prod/`.

### No scope filter — receive everything

```bash
curl -X POST http://localhost:7979/v1/admin/webhooks \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ops.example.com/all-events",
    "event_types": []
  }'
```

Both `event_types` and `scope_filter` omitted — this subscription receives all events from all scopes.

### Combining event type filter with scope filter

Both filters apply with AND logic. An event must match **both** the event type list and the scope filter to be delivered.

```bash
curl -X POST http://localhost:7979/v1/admin/webhooks \
  -H "X-Admin-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ops.example.com/cost-alerts",
    "event_types": ["budget.exhausted", "budget.over_limit_entered"],
    "scope_filter": "tenant:acme-corp/workspace:prod/*"
  }'
```

This delivers only `budget.exhausted` **or** `budget.over_limit_entered` events **and** only when the scope starts with `tenant:acme-corp/workspace:prod/`.

## Events without scope

Some events (particularly system events like `system.store_connection_lost`) may not have a `scope` field. When `scope_filter` is set on a subscription and an event has a null scope, the event is **not delivered** to that subscription. Use a separate subscription without a scope filter to capture unscoped events.

## Related

- [Managing Webhooks](/how-to/managing-webhooks) — creating, updating, and testing subscriptions
- [Webhook Event Delivery Protocol](/protocol/webhook-event-delivery-protocol) — delivery mechanics, retry schedule, signatures
- [Event Payloads Reference](/protocol/event-payloads-reference) — payload schemas for all event types
