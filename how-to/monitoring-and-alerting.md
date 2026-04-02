---
title: "Monitoring and Alerting"
description: "Key metrics, alerting thresholds, and observability patterns for monitoring a production Cycles deployment. Covers balances, reservations, budget exhaustion, and webhook delivery."
---

# Monitoring and Alerting

This guide covers key metrics to monitor, alerting thresholds, and observability patterns for a production Cycles deployment.

## Key metrics

### Budget utilization

The most important metric. Track the ratio of spent to allocated for each scope:

```
utilization = (spent + reserved) / allocated × 100%
```

**Alert thresholds:**

| Level | Threshold | Action |
|---|---|---|
| Warning | 80% | Notify team. Budget is running low — consider funding or reducing usage. |
| Critical | 95% | Page on-call. Imminent budget exhaustion will start denying requests. |
| Exhausted | 100% | All reservations denied. Fund immediately or accept denial. |

### Query balances for monitoring

```bash
# Get all balances for a tenant
curl -s "http://localhost:7878/v1/balances?tenant=acme-corp" \
  -H "X-Cycles-API-Key: $API_KEY" | jq '.balances[] | {scope, allocated, remaining, spent, reserved, debt}'
```

Build a polling monitor that queries balances and pushes to your metrics system:

```python
import time
import requests

def poll_budgets():
    response = requests.get(
        "http://localhost:7878/v1/balances",
        params={"tenant": "acme-corp"},
        headers={"X-Cycles-API-Key": API_KEY},
    )
    for balance in response.json()["balances"]:
        allocated = balance["allocated"]["amount"]
        if allocated > 0:
            utilization = (balance["spent"]["amount"] + balance["reserved"]["amount"]) / allocated
            push_metric(
                name="cycles.budget.utilization",
                value=utilization,
                tags={"scope": balance["scope"], "unit": balance["allocated"]["unit"]},
            )
            push_metric(
                name="cycles.budget.remaining",
                value=balance["remaining"]["amount"],
                tags={"scope": balance["scope"]},
            )

while True:
    poll_budgets()
    time.sleep(60)  # Poll every minute
```

For the full list of fields available on every reservation and event, see [Standard Metrics and Metadata](/protocol/standard-metrics-and-metadata-in-cycles).

### Reservation metrics

Track reservation lifecycle events:

| Metric | What to watch |
|---|---|
| **Reservations created/sec** | Throughput baseline. Sudden spikes may indicate loops. |
| **Reservation denial rate** | Percentage of reservations denied (`BUDGET_EXCEEDED`). High rates mean budgets are too tight or traffic is too high. |
| **Reservation TTL expiry rate** | Reservations expiring before commit. Indicates operations are taking too long or heartbeat is not working. |
| **Average reservation duration** | Time from reserve to commit. Growing duration may indicate slow downstream services. |
| **Active reservation count** | Current in-flight reservations. Sustained growth suggests commit/release failures. |

### Server health metrics

All three Cycles services expose Spring Boot Actuator metrics:

```bash
# Cycles Server
curl http://localhost:7878/actuator/health

# Admin Server
curl http://localhost:7979/actuator/health

# Events Service
curl http://localhost:7980/actuator/health

# JVM metrics (if metrics endpoint is enabled)
curl http://localhost:7878/actuator/metrics
```

Key server metrics:

| Metric | Component | Threshold |
|---|---|---|
| Response latency (p99) | Cycles Server | Alert if > 50ms |
| Error rate (5xx) | Cycles Server, Admin Server | Alert if > 1% |
| Redis connection pool usage | All services | Alert if > 80% |
| JVM heap usage | All services | Alert if > 80% |

### Events Service metrics

The Events Service (port 7980) delivers webhooks asynchronously. Monitor separately:

| Metric | What to watch |
|---|---|
| **Queue depth** (`redis-cli LLEN dispatch:pending`) | Sustained growth means delivery is falling behind. Should be near zero. |
| **Delivery success rate** | Percentage of deliveries receiving HTTP 2xx. Drops indicate endpoint issues. |
| **Retry rate** | High retry rates signal unreliable webhook endpoints or network issues. |
| **Auto-disabled subscriptions** | Any auto-disabled subscription needs investigation — the endpoint failed repeatedly. |
| **Delivery latency** | Time from event creation to successful delivery. Growing latency signals backlog. |

## Alerting rules

### Prometheus example

If you export Cycles metrics to Prometheus:

```yaml
groups:
  - name: cycles
    rules:
      - alert: CyclesBudgetWarning
        expr: cycles_budget_utilization > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Budget utilization above 80% for {{ $labels.scope }}"

      - alert: CyclesBudgetCritical
        expr: cycles_budget_utilization > 0.95
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Budget nearly exhausted for {{ $labels.scope }}"

      - alert: CyclesHighDenialRate
        expr: rate(cycles_reservations_denied_total[5m]) / rate(cycles_reservations_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Over 10% of reservations being denied"

      - alert: CyclesReservationLeak
        expr: cycles_active_reservations > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High number of active reservations — possible leak"

      - alert: CyclesServerLatency
        expr: histogram_quantile(0.99, cycles_request_duration_seconds) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Cycles Server p99 latency above 50ms"

      - alert: CyclesWebhookQueueBacklog
        expr: cycles_dispatch_pending_length > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Webhook delivery queue depth above 100 — Events Service may be falling behind"

      - alert: CyclesWebhookDeliveryFailures
        expr: rate(cycles_webhook_deliveries_failed_total[5m]) > 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Sustained webhook delivery failures — check endpoint availability"
```

### Debt monitoring

Track outstanding debt separately. Any non-zero debt is worth alerting on:

```yaml
- alert: CyclesDebtOutstanding
  expr: cycles_budget_debt > 0
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Scope {{ $labels.scope }} has outstanding debt"
```

## Dashboard suggestions

### Budget overview dashboard

Display for each tenant/scope:

- **Allocated** — total budget
- **Spent** — cumulative spend
- **Reserved** — currently locked by active reservations
- **Remaining** — available for new reservations
- **Debt** — outstanding debt from overdraft commits
- **Utilization %** — gauge showing spent/allocated ratio

### Reservation activity dashboard

- **Reservations/minute** — time series chart showing throughput
- **Decision distribution** — pie chart: ALLOW vs ALLOW_WITH_CAPS vs DENY
- **Avg reservation duration** — time from reserve to commit
- **Expiry rate** — percentage of reservations that expire without commit
- **Top spenders** — table showing which scopes are consuming the most

### Operational health dashboard

- **Server response latency** — p50, p95, p99 time series (Cycles Server + Admin Server)
- **Error rate** — 4xx and 5xx rate across all services
- **Redis connection pool** — active vs available connections
- **Active reservations** — current count (should be bounded)

### Webhook delivery dashboard

- **Queue depth** — `dispatch:pending` length over time (should trend toward zero)
- **Delivery rate** — successful deliveries/minute
- **Retry rate** — retries/minute (indicates endpoint reliability)
- **Failed deliveries** — failed after max retries
- **Auto-disabled subscriptions** — count of subscriptions disabled due to consecutive failures
- **Delivery latency** — time from event to successful delivery (p50, p95)

## Log-based monitoring

If you don't have a metrics pipeline, monitor from server logs:

```bash
# Watch for budget exhaustion events
docker compose logs -f cycles-server | grep "BUDGET_EXCEEDED"

# Watch for reservation expiry
docker compose logs -f cycles-server | grep "RESERVATION_EXPIRED"

# Watch for webhook delivery failures
docker compose logs -f cycles-events | grep "DELIVERY_FAILED"

# Watch for auto-disabled subscriptions
docker compose logs -f cycles-events | grep "SUBSCRIPTION_DISABLED"

# Watch for errors across all services
docker compose logs -f cycles-server cycles-admin cycles-events | grep "ERROR"
```

For structured logging, pipe to your log aggregation system (ELK, Datadog, CloudWatch) and create alerts on log patterns.

## Next steps

- [Observability Setup](/how-to/observability-setup) — Prometheus, Grafana, and Datadog integration
- [Production Operations Guide](/how-to/production-operations-guide) — deployment and infrastructure
- [Security Hardening](/how-to/security-hardening) — securing the deployment
- [Server Configuration Reference](/configuration/server-configuration-reference-for-cycles) — all server settings
