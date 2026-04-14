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

All three Cycles services expose Spring Boot Actuator. The exposed endpoints are `health`, `info`, and `prometheus`:

```bash
# Cycles Server (runtime)
curl http://localhost:7878/actuator/health
curl http://localhost:7878/actuator/prometheus

# Admin Server — also exposes Kubernetes liveness/readiness probes
curl http://localhost:7979/actuator/health
curl http://localhost:7979/actuator/health/liveness
curl http://localhost:7979/actuator/health/readiness
curl http://localhost:7979/actuator/prometheus

# Events Service
curl http://localhost:7980/actuator/health
curl http://localhost:7980/actuator/prometheus
```

::: tip Liveness/readiness probes
Only the Admin Server enables Spring's liveness/readiness probes (`management.endpoint.health.probes.enabled=true`). The runtime server and events service expose only the aggregate `/actuator/health` endpoint.
:::

Key server metrics (all derived from Spring Boot's default Micrometer registrations — see [Observability Setup](/how-to/observability-setup) for the full metric list):

| Metric | Component | Threshold |
|---|---|---|
| Response latency (p99) — `http_server_requests_seconds_bucket` | Cycles Server | Alert if > 50ms |
| Error rate (5xx) — `http_server_requests_seconds_count{status=~"5.."}` | Cycles Server, Admin Server | Alert if > 1% |
| JVM heap usage — `jvm_memory_used_bytes{area="heap"}` / `jvm_memory_max_bytes{area="heap"}` | All services | Alert if > 80% |
| Redis connection pool usage | All services | No server-side metric exposed today — monitor via Redis `CLIENT LIST` or a Redis exporter. |

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

::: warning Cycles-specific custom metrics are on the roadmap
The server versions shipping at time of writing (runtime 0.1.25.8, admin 0.1.25.16, events 0.1.25.5) do **not** register any custom `cycles_*` metrics with Micrometer — `/actuator/prometheus` exposes only Spring Boot's defaults (`http_server_requests_seconds*`, `jvm_*`, `process_*`, `system_*`). Planned additions such as `cycles_budget_utilization`, `cycles_reservations_denied_total`, `cycles_active_reservations`, `cycles_dispatch_pending_length`, and `cycles_webhook_deliveries_failed_total` will land in a future release — track the changelog.

The alert rules below use metrics that **do** exist today. Where a Cycles-specific signal has no server-side metric yet, we show the balance-polling or Redis-exporter fallback instead.
:::

### Prometheus example (using default metrics)

```yaml
groups:
  - name: cycles
    rules:
      # Latency — default Spring Boot HTTP histogram
      - alert: CyclesServerLatency
        expr: histogram_quantile(0.99, sum by (le) (rate(http_server_requests_seconds_bucket{application="cycles-protocol-service",uri=~"/v1/reservations.*|/v1/decide"}[5m]))) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Cycles Server p99 latency above 50ms on reservation/decide path"

      # Denial rate — reservation POSTs returning HTTP 409 (BUDGET_EXCEEDED / BUDGET_FROZEN / OVERDRAFT_LIMIT_EXCEEDED / DEBT_OUTSTANDING)
      - alert: CyclesHighDenialRate
        expr: |
          sum(rate(http_server_requests_seconds_count{application="cycles-protocol-service",uri="/v1/reservations",method="POST",status="409"}[5m]))
            / sum(rate(http_server_requests_seconds_count{application="cycles-protocol-service",uri="/v1/reservations",method="POST"}[5m]))
            > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Over 10% of reservations being denied"

      # 5xx error rate
      - alert: CyclesServerErrors
        expr: |
          sum(rate(http_server_requests_seconds_count{application=~"cycles-.*",status=~"5.."}[5m]))
            / sum(rate(http_server_requests_seconds_count{application=~"cycles-.*"}[5m]))
            > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Cycles 5xx error rate above 1%"

      # JVM heap pressure
      - alert: CyclesJvmHeapHigh
        expr: |
          jvm_memory_used_bytes{application=~"cycles-.*",area="heap"}
            / jvm_memory_max_bytes{application=~"cycles-.*",area="heap"}
            > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "JVM heap usage above 80% for {{ $labels.application }}"
```

### Balance-polling alerts (no custom metric required)

Until custom metrics ship, build budget / debt / overshoot alerts from the balance-polling sidecar shown in [Query balances for monitoring](#query-balances-for-monitoring). Push the sampled values as your own Prometheus gauges (`cycles_budget_utilization`, `cycles_budget_debt`, `cycles_active_reservations`) via a pushgateway or statsd bridge, then alert on them as you would on any other gauge. This is the path most operators are running today.

### Webhook delivery queue depth

The events service has no `cycles_dispatch_pending_length` gauge yet. Scrape Redis directly with `redis_exporter` — the exporter exposes `redis_list_length{list="dispatch:pending"}` when configured with `--check-single-keys=dispatch:pending`:

```yaml
- alert: CyclesWebhookQueueBacklog
  expr: redis_list_length{list="dispatch:pending"} > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Webhook delivery queue depth above 100 — Events Service may be falling behind"
```

For delivery success / failure rates and auto-disabled subscriptions, query the admin API (`GET /v1/admin/webhooks/{id}/deliveries?status=FAILED`) on a schedule and push the sampled counts to your metrics pipeline.

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
