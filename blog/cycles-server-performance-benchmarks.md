---
title: "AI Agent Budget Enforcement Latency: Cycles Server Performance Benchmarks"
date: 2026-03-23
author: Cycles Team
tags: [engineering, performance, benchmarks, scaling, latency, throughput, redis]
description: "How much latency does AI agent budget enforcement add? Published p50/p95/p99 latency and throughput benchmarks for every Cycles Protocol operation — reserve, commit, release, extend, decide, event, and read paths — with concurrent scaling to 2,400+ ops/sec."
blog: true
sidebar: false
head:
  - - meta
    - name: keywords
      content: ai agent performance, budget enforcement latency, cycles protocol benchmarks, redis lua performance, agent cost control overhead, reserve commit latency, ai agent throughput, cycles server scaling
---

# AI Agent Budget Enforcement Latency: Cycles Server Performance Benchmarks

The first question teams ask when evaluating runtime budget enforcement for AI agents: **how much latency does this add?** Budget enforcement sits in the critical path of every agent action. If it's slow, agents are slow. If it doesn't scale, your system doesn't scale.

We benchmarked every protocol operation end-to-end and under concurrent load. Here are the numbers.

<!-- more -->

## The Setup

All benchmarks measure **full HTTP round-trip latency** — not just Redis time, but the entire stack:

```
HTTP request → Spring Boot routing → Auth filter (API key validation)
→ JSON deserialization → Redis EVALSHA (atomic Lua script)
→ Response serialization → HTTP response
```

**Environment:** Spring Boot 3.5 / Java 21 / Redis 7 (Testcontainers), localhost networking. Production with dedicated Redis will be faster. 200 measured iterations per operation after 50 warmup iterations (JIT, connection pool, script cache primed).

## Write-Path Latency

| Operation           |  p50   |  p95   |  p99   |  min   |  max   |
|---------------------|--------|--------|--------|--------|--------|
| **Reserve**         |  5.6ms |  6.2ms |  6.6ms |  4.6ms |  6.9ms |
| **Commit**          |  4.5ms |  5.8ms | 15.8ms |  2.9ms | 22.1ms |
| **Release**         |  4.8ms |  5.5ms |  5.8ms |  3.5ms | 12.9ms |
| **Extend**          |  7.3ms |  8.7ms |  9.6ms |  6.0ms | 17.0ms |
| **Decide**          |  5.8ms |  6.9ms |  7.4ms |  4.5ms | 13.8ms |
| **Event**           |  4.9ms |  5.6ms |  6.0ms |  3.9ms | 15.2ms |

### What these numbers mean for your agents

**The reserve-commit lifecycle** (the most common pattern) takes about **14ms end-to-end** — 5.6ms to reserve budget before the LLM call, 4.5ms to commit actual usage after:

| Lifecycle           |  p50    |  p95    |  p99    |
|---------------------|---------|---------|---------|
| Reserve + Commit    |  14.3ms |  16.2ms |  18.0ms |
| Reserve + Release   |  12.0ms |  15.1ms |  19.5ms |

For context, a typical LLM API call takes 500ms-30s depending on the model and token count. **Budget enforcement adds ~14ms to a multi-second operation** — less than the variance in your LLM provider's response time.

If you just need a quick budget check without reserving (e.g., pre-flight check in a UI), **Decide** gives you a yes/no answer in ~6ms.

**Events** (direct debit without reservation) are the fastest mutation at 4.9ms p50 — useful for logging post-hoc usage where you don't need the reserve-commit guarantee.

## Read-Path Latency

Read operations are the fastest — no Lua script overhead, just direct Redis hash reads with pipelined multi-scope queries:

| Operation              |  p50   |  p95   |  p99   |  min   |  max   |
|------------------------|--------|--------|--------|--------|--------|
| **GET reservation**    |  3.2ms |  4.3ms |  4.4ms |  1.9ms |  5.4ms |
| **GET balances**       |  3.2ms |  4.1ms |  4.5ms |  1.7ms |  5.5ms |
| **LIST reservations**  |  3.9ms |  4.7ms |  5.2ms |  2.3ms |  5.4ms |
| **Decide (pipelined)** |  4.6ms |  5.6ms |  6.1ms |  3.4ms |  6.5ms |

Fetching a single reservation or checking balances takes just **3.2ms** — fast enough to call on every page load or agent step without concern. Listing reservations with filters adds less than 1ms more due to SCAN iteration.

The pipelined Decide path (4.6ms) is 20% faster than the write-path Decide (5.8ms) because the read pipeline batches all scope lookups into a single Redis round-trip instead of executing them inside a Lua script.

### Why Extend is slower

Extend (7.3ms) is the slowest single operation because it does the most work atomically inside Redis: read reservation state, validate expiration and extension limits, update TTL, update the sorted set index, read scope hierarchy, and snapshot balances across all affected budgets. All in one atomic Lua script — no round-trips, but more Redis commands per execution.

## Concurrent Throughput

Single-threaded latency doesn't tell you how the system behaves when 32 agents hit it simultaneously. We ran Reserve→Commit lifecycles at increasing concurrency:

| Threads | Throughput  |  p50    |  p95    |  p99    |  max    | Errors |
|---------|-------------|---------|---------|---------|---------|--------|
|       8 |    777 op/s |  10.1ms |  12.2ms |  17.9ms |  28.2ms |      0 |
|      16 |  1,096 op/s |  14.3ms |  19.7ms |  24.1ms |  52.0ms |      0 |
|      32 |  2,434 op/s |  12.1ms |  20.1ms |  30.9ms |  68.7ms |      0 |

### Key observations

**Near-linear scaling.** Throughput scales 3.1x when going from 8 to 32 threads (4x threads). The sub-linear factor is expected — Redis Lua scripts are serialized (single-threaded execution) and connection pool contention increases.

**Zero errors under load.** No budget violations, no connection pool exhaustion, no timeouts at any concurrency level. The Redis connection pool (50 connections) has headroom even at 32 concurrent threads.

**Tail latency grows predictably.** p99 goes from 17.9ms at 8 threads to 30.9ms at 32 threads. The 68.7ms max at 32 threads is likely a GC pause or connection pool wait — rare enough to not affect p99.

**2,434 complete lifecycles per second** at 32 threads means each thread completes a full Reserve→Commit cycle (two HTTP calls, two Lua script executions, two auth checks) in ~13ms average.

## What's in the critical path

Every operation goes through these layers, and we optimized each one:

### Auth: BCrypt caching

API key validation uses BCrypt, which is intentionally slow (~100ms). We cache validation results in-memory (SHA-256 of key → result, 60s TTL), so BCrypt runs once per key per minute. Every request after the first is a hash lookup.

### Redis: EVALSHA + atomic Lua

All mutations are atomic Lua scripts executed via `EVALSHA` (sends a 40-character SHA1 hash instead of the full script text). No multi-step Redis transactions, no optimistic locking, no retries. One network round-trip, one atomic execution.

### Balance snapshots: zero extra round-trips

Every mutation response includes current balance snapshots for all affected scopes. These are collected **inside** the Lua script after mutations complete — no separate Java-side Redis calls. This is what gives you the `balances` array in every response without additional latency.

### Tenant config: in-memory cache

Tenant configuration (default TTLs, overage policies, extension limits) is cached in-memory with a 60s TTL. Config changes propagate within a minute without restart.

## How we measure

Our benchmarks run as JUnit integration tests against a real Redis instance (Testcontainers). No mocks, no stubs, no synthetic loads — the same code path as production.

```bash
# Run benchmarks (requires Docker)
mvn test -Pbenchmark

# Run everything except benchmarks (default build)
mvn verify
```

Benchmarks are excluded from the default build so they don't slow down CI. The test harness warms up the JIT compiler, connection pool, and EVALSHA script cache before measuring — just like a production server that's been running for more than a few seconds.

Source: [`CyclesProtocolBenchmarkTest`](https://github.com/runcycles/cycles-server/blob/main/cycles-protocol-service/cycles-protocol-service-api/src/test/java/io/runcycles/protocol/api/CyclesProtocolBenchmarkTest.java), [`CyclesProtocolConcurrentBenchmarkTest`](https://github.com/runcycles/cycles-server/blob/main/cycles-protocol-service/cycles-protocol-service-api/src/test/java/io/runcycles/protocol/api/CyclesProtocolConcurrentBenchmarkTest.java), and [`CyclesProtocolReadBenchmarkTest`](https://github.com/runcycles/cycles-server/blob/main/cycles-protocol-service/cycles-protocol-service-api/src/test/java/io/runcycles/protocol/api/CyclesProtocolReadBenchmarkTest.java).

## The bottom line

Budget enforcement with Cycles adds **4.5-7.3ms per write operation** and **3.2-4.6ms per read** in the typical case. A full reserve-commit lifecycle adds **~14ms** to an LLM call that takes seconds. At 32 concurrent threads, the server sustains **2,400+ complete lifecycles per second** with zero errors.

The overhead is small enough that you shouldn't notice it. And if you don't enforce budgets, the cost of a single runaway agent will be orders of magnitude larger than any latency you saved.

## FAQ

### How much latency does Cycles add to LLM calls?

A full reserve-commit lifecycle adds ~14ms (p50) to your agent's LLM call. Since most LLM API calls take 500ms-30s, budget enforcement adds less than 3% overhead in the worst case and is effectively invisible in practice. Read-only queries (balance checks, reservation lookups) add just 3-4ms.

### Does Cycles scale horizontally?

The Cycles server is stateless — all state lives in Redis. You can run multiple server instances behind a load balancer. Redis itself can be scaled with Redis Cluster for sharding across multiple nodes. Our benchmarks show a single instance handling 2,400+ complete lifecycles per second.

### What happens if the Cycles server is slow or unavailable?

The protocol is designed for the [reserve-commit pattern](/protocol/how-reserve-commit-works-in-cycles). If a reserve call is slow, the agent waits before making the LLM call (fail-safe). If the server is unavailable, the reserve fails and the agent doesn't proceed — preventing uncontrolled spend. Commits and events can be retried with idempotency keys. Read-only endpoints (balance checks, reservation lookups) are the fastest at 3-4ms and can be used for status dashboards without concern.

### How does this compare to LLM proxy approaches?

LLM proxies add latency on every token streamed. Cycles operates at the action level — one reserve before the call, one commit after — so latency scales with the number of agent actions, not the number of tokens. For a 10,000-token completion, a proxy adds overhead to every chunk; Cycles adds two 5-7ms calls total.

---

*Questions about performance in your specific deployment? Check the [server configuration reference](/configuration/server-configuration-reference-for-cycles).*
