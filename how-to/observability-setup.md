---
title: "Observability Setup"
description: "Set up Prometheus metrics, Grafana dashboards, and Datadog integration for monitoring a Cycles deployment. Includes PromQL queries and importable dashboard JSON."
---

# Observability Setup

This guide covers how to expose metrics from the Cycles Server and visualize them in Prometheus, Grafana, and Datadog. For alerting rules and budget-level monitoring patterns, see [Monitoring and Alerting](/how-to/monitoring-and-alerting).

## Exposing Prometheus metrics

The Cycles Server is a Spring Boot application. To expose Prometheus-format metrics, enable the Actuator Prometheus endpoint.

### Step 1: Enable the Prometheus endpoint

Set the following property via environment variable or `application.properties`:

```properties
management.endpoints.web.exposure.include=health,info,prometheus
```

In Docker Compose:

```yaml
cycles-server:
  image: ghcr.io/runcycles/cycles-server:0.1.25.8
  environment:
    REDIS_HOST: redis
    REDIS_PORT: 6379
    REDIS_PASSWORD: ${REDIS_PASSWORD}
    MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE: health,info,prometheus
  ports:
    - "7878:7878"
```

### Step 2: Verify

```bash
curl -s http://localhost:7878/actuator/prometheus | head -20
```

You should see Micrometer metrics in Prometheus exposition format:

```
# HELP http_server_requests_seconds Duration of HTTP server request handling
# TYPE http_server_requests_seconds histogram
http_server_requests_seconds_bucket{method="POST",uri="/v1/reservations",status="201",le="0.005"} 142.0
...
```

### Step 3: Configure Prometheus scrape

Add the Cycles Server as a target in your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "cycles-server"
    metrics_path: "/actuator/prometheus"
    scrape_interval: 15s
    static_configs:
      - targets: ["cycles-server:7878"]
        labels:
          service: "cycles"

  # Optional: scrape the Admin Server too
  - job_name: "cycles-admin"
    metrics_path: "/actuator/prometheus"
    scrape_interval: 30s
    static_configs:
      - targets: ["cycles-admin:7979"]
        labels:
          service: "cycles-admin"
```

## Key metrics reference

The Cycles Server exposes standard Spring Boot Actuator / Micrometer metrics. These are the most relevant for Cycles:

### HTTP endpoint metrics

| Metric | Type | Description |
|---|---|---|
| `http_server_requests_seconds` | histogram | Request duration by `method`, `uri`, `status` |
| `http_server_requests_seconds_count` | counter | Total request count by `method`, `uri`, `status` |

Key `uri` labels for Cycles endpoints:

| URI pattern | Operation |
|---|---|
| `/v1/reservations` | Create reservation |
| `/v1/reservations/{id}/commit` | Commit |
| `/v1/reservations/{id}/release` | Release |
| `/v1/reservations/{id}/extend` | Heartbeat extend |
| `/v1/decide` | Preflight decision |
| `/v1/events` | Direct debit event |
| `/v1/balances` | Balance query |

### JVM metrics

| Metric | Description |
|---|---|
| `jvm_memory_used_bytes{area="heap"}` | Current heap usage |
| `jvm_memory_max_bytes{area="heap"}` | Maximum heap size |
| `jvm_gc_pause_seconds` | GC pause duration |
| `jvm_threads_live_threads` | Active thread count |

### System metrics

| Metric | Description |
|---|---|
| `system_cpu_usage` | System CPU utilization (0.0–1.0) |
| `process_cpu_usage` | Process CPU utilization (0.0–1.0) |

::: info Custom Cycles metrics
The Cycles Server currently uses standard Spring Boot Actuator metrics. It does not emit custom Micrometer metrics (e.g. `cycles_reservations_total`). Use the HTTP endpoint metrics (`http_server_requests_seconds`) filtered by `uri` and `status` as proxies. The alert rules in [Monitoring and Alerting](/how-to/monitoring-and-alerting) use custom metric names (`cycles_budget_utilization`, etc.) which assume you push these from a polling monitor — see that guide for the polling script.
:::

## PromQL query cookbook

### Reservation throughput (requests/second)

```promql
rate(http_server_requests_seconds_count{uri="/v1/reservations",method="POST"}[5m])
```

### Commit throughput

```promql
rate(http_server_requests_seconds_count{uri=~"/v1/reservations/.+/commit",method="POST"}[5m])
```

### Reservation latency (p50, p95, p99)

```promql
# p50
histogram_quantile(0.5, rate(http_server_requests_seconds_bucket{uri="/v1/reservations",method="POST"}[5m]))

# p95
histogram_quantile(0.95, rate(http_server_requests_seconds_bucket{uri="/v1/reservations",method="POST"}[5m]))

# p99
histogram_quantile(0.99, rate(http_server_requests_seconds_bucket{uri="/v1/reservations",method="POST"}[5m]))
```

### Denial rate (409 responses on reservation create)

```promql
rate(http_server_requests_seconds_count{uri="/v1/reservations",method="POST",status="409"}[5m])
/
rate(http_server_requests_seconds_count{uri="/v1/reservations",method="POST"}[5m])
```

### Server error rate (5xx)

```promql
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
/
sum(rate(http_server_requests_seconds_count[5m]))
```

### JVM heap utilization

```promql
jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"}
```

## Grafana dashboard

Import the following JSON into Grafana (**Dashboards > Import > Paste JSON**). It creates a "Cycles Overview" dashboard with three rows: throughput, latency, and infrastructure.

::: details Click to expand dashboard JSON
```json
{
  "dashboard": {
    "title": "Cycles Overview",
    "tags": ["cycles"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Reservation Throughput",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
        "targets": [{
          "expr": "rate(http_server_requests_seconds_count{uri=\"/v1/reservations\",method=\"POST\"}[5m])",
          "legendFormat": "reservations/sec"
        }]
      },
      {
        "title": "Commit Throughput",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 },
        "targets": [{
          "expr": "rate(http_server_requests_seconds_count{uri=~\"/v1/reservations/.+/commit\",method=\"POST\"}[5m])",
          "legendFormat": "commits/sec"
        }]
      },
      {
        "title": "Denial Rate",
        "type": "gauge",
        "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 },
        "targets": [{
          "expr": "rate(http_server_requests_seconds_count{uri=\"/v1/reservations\",method=\"POST\",status=\"409\"}[5m]) / rate(http_server_requests_seconds_count{uri=\"/v1/reservations\",method=\"POST\"}[5m])",
          "legendFormat": "denial rate"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "thresholds": {
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 0.05 },
                { "color": "red", "value": 0.1 }
              ]
            }
          }
        }
      },
      {
        "title": "Reservation Latency",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.5, rate(http_server_requests_seconds_bucket{uri=\"/v1/reservations\",method=\"POST\"}[5m]))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_server_requests_seconds_bucket{uri=\"/v1/reservations\",method=\"POST\"}[5m]))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_server_requests_seconds_bucket{uri=\"/v1/reservations\",method=\"POST\"}[5m]))",
            "legendFormat": "p99"
          }
        ],
        "fieldConfig": { "defaults": { "unit": "s" } }
      },
      {
        "title": "Commit Latency",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.5, rate(http_server_requests_seconds_bucket{uri=~\"/v1/reservations/.+/commit\",method=\"POST\"}[5m]))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_server_requests_seconds_bucket{uri=~\"/v1/reservations/.+/commit\",method=\"POST\"}[5m]))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_server_requests_seconds_bucket{uri=~\"/v1/reservations/.+/commit\",method=\"POST\"}[5m]))",
            "legendFormat": "p99"
          }
        ],
        "fieldConfig": { "defaults": { "unit": "s" } }
      },
      {
        "title": "Error Rate (5xx)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 0, "y": 16 },
        "targets": [{
          "expr": "sum(rate(http_server_requests_seconds_count{status=~\"5..\"}[5m])) / sum(rate(http_server_requests_seconds_count[5m]))",
          "legendFormat": "5xx rate"
        }],
        "fieldConfig": { "defaults": { "unit": "percentunit" } }
      },
      {
        "title": "JVM Heap Usage",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 8, "y": 16 },
        "targets": [
          {
            "expr": "jvm_memory_used_bytes{area=\"heap\"}",
            "legendFormat": "used"
          },
          {
            "expr": "jvm_memory_max_bytes{area=\"heap\"}",
            "legendFormat": "max"
          }
        ],
        "fieldConfig": { "defaults": { "unit": "bytes" } }
      },
      {
        "title": "CPU Usage",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 16, "y": 16 },
        "targets": [
          {
            "expr": "process_cpu_usage",
            "legendFormat": "process"
          },
          {
            "expr": "system_cpu_usage",
            "legendFormat": "system"
          }
        ],
        "fieldConfig": { "defaults": { "unit": "percentunit" } }
      }
    ],
    "schemaVersion": 39
  },
  "overwrite": true
}
```
:::

After importing, set the **Prometheus** data source if prompted.

## Datadog integration

### Option A: Datadog Agent with Spring Boot integration

If you run the Datadog Agent alongside the Cycles Server, enable the Spring Boot Actuator check:

```yaml
# datadog-agent/conf.d/openmetrics.d/conf.yaml
instances:
  - openmetrics_endpoint: http://cycles-server:7878/actuator/prometheus
    namespace: cycles
    metrics:
      - http_server_requests_seconds
      - jvm_memory_used_bytes
      - jvm_gc_pause_seconds
      - system_cpu_usage
      - process_cpu_usage
```

### Option B: Micrometer Datadog registry

Add the `micrometer-registry-datadog` dependency to the Cycles Server and configure:

```properties
management.datadog.metrics.export.api-key=${DD_API_KEY}
management.datadog.metrics.export.step=30s
management.datadog.metrics.export.uri=https://api.datadoghq.com
```

### Key Datadog monitors

| Monitor | Query | Threshold |
|---|---|---|
| Reservation latency | `avg:cycles.http_server_requests_seconds.p99{uri:/v1/reservations}` | > 0.05 (50ms) |
| Error rate | `sum:cycles.http_server_requests_seconds_count{status:5*}.as_rate() / sum:cycles.http_server_requests_seconds_count{*}.as_rate()` | > 0.01 (1%) |
| JVM heap | `avg:cycles.jvm_memory_used_bytes{area:heap} / avg:cycles.jvm_memory_max_bytes{area:heap}` | > 0.8 (80%) |

## Client-side observability

### Logging

All three clients log the reservation lifecycle at DEBUG level:

- **Python**: Set `logging.getLogger("runcycles").setLevel(logging.DEBUG)`
- **TypeScript**: The client logs transport errors via `console.error`
- **Spring Boot**: Set `logging.level.io.runcycles=DEBUG` in `application.yml`

### Custom instrumentation with OpenTelemetry

Wrap the decorator or HOF with your own spans to trace reservation lifecycles in your distributed tracing system:

```python
from opentelemetry import trace
from runcycles import cycles

tracer = trace.get_tracer("my-app")

@cycles(estimate=1000, action_kind="llm.completion", action_name="gpt-4o")
def call_llm(prompt: str) -> str:
    with tracer.start_as_current_span("cycles.call_llm") as span:
        span.set_attribute("cycles.estimate", 1000)
        result = openai.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
        span.set_attribute("cycles.actual_tokens", result.usage.total_tokens)
        return result.choices[0].message.content
```

For structured error logging patterns, see [Error Handling Patterns](/how-to/error-handling-patterns-in-cycles-client-code).

## Next steps

- [Monitoring and Alerting](/how-to/monitoring-and-alerting) — alerting rules and budget monitoring patterns
- [Client Performance Tuning](/how-to/client-performance-tuning) — timeout and retry optimization
- [Production Operations Guide](/how-to/production-operations-guide) — server infrastructure
- [Server Configuration Reference](/configuration/server-configuration-reference-for-cycles) — all server properties
