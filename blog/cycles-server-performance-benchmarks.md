---
title: "AI Agent Budget Enforcement Latency: Cycles Server Performance Benchmarks"
date: 2026-03-23
author: Cycles Team
tags: [engineering, performance, benchmarks, scaling, latency, throughput, redis]
description: "How much latency does AI agent budget enforcement add? Published p50/p95/p99 latency and throughput benchmarks for every Cycles Protocol operation — reserve, commit, release, extend, decide, event, and read paths — with concurrent scaling to 2,390+ ops/sec. Includes v0.1.23 vs v0.1.24 runaway agent demo showing 9x faster guarded runtime."
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
| **Reserve**         |  4.5ms |  5.9ms |  6.2ms |  3.2ms |  6.4ms |
| **Commit**          |  4.4ms |  5.9ms |  6.5ms |  2.6ms |  7.0ms |
| **Release**         |  3.5ms |  4.3ms |  4.7ms |  2.5ms |  5.4ms |
| **Extend**          |  6.3ms |  7.8ms |  8.3ms |  4.9ms |  9.6ms |
| **Decide**          |  4.9ms |  6.4ms |  7.3ms |  3.7ms |  7.6ms |
| **Event**           |  4.3ms |  5.1ms |  5.6ms |  2.9ms |  5.7ms |

### What these numbers mean for your agents

**The reserve-commit lifecycle** (the most common pattern) takes about **11ms end-to-end** — 4.5ms to reserve budget before the LLM call, 4.4ms to commit actual usage after:

| Lifecycle           |  p50    |  p95    |  p99    |
|---------------------|---------|---------|---------|
| Reserve + Commit    |  11.0ms |  13.6ms |  16.0ms |
| Reserve + Release   |   9.2ms |  11.7ms |  13.2ms |

For context, a typical LLM API call takes 500ms-30s depending on the model and token count. **Budget enforcement adds ~11ms to a multi-second operation** — less than the variance in your LLM provider's response time.

If you just need a quick budget check without reserving (e.g., pre-flight check in a UI), **Decide** gives you a yes/no answer in ~5ms.

**Events** (direct debit without reservation) are the fastest mutation at 4.3ms p50 — useful for logging post-hoc usage where you don't need the reserve-commit guarantee.

## Read-Path Latency

Read operations are the fastest — no Lua script overhead, just direct Redis hash reads with pipelined multi-scope queries:

| Operation              |  p50   |  p95   |  p99   |  min   |  max   |
|------------------------|--------|--------|--------|--------|--------|
| **GET reservation**    |  3.7ms |  5.0ms |  5.5ms |  2.4ms |  9.5ms |
| **GET balances**       |  3.3ms |  4.2ms |  4.8ms |  2.0ms |  5.4ms |
| **LIST reservations**  |  4.1ms |  5.0ms |  5.9ms |  3.0ms |  6.3ms |
| **Decide (pipelined)** |  4.8ms |  7.5ms |  8.8ms |  3.3ms | 12.2ms |

Fetching a single reservation or checking balances takes just **3.3-3.7ms** — fast enough to call on every page load or agent step without concern. Listing reservations with filters adds less than 1ms more due to SCAN iteration.

The pipelined Decide path (4.8ms) is slightly faster than the write-path Decide (4.9ms) because the read pipeline batches all scope lookups into a single Redis round-trip instead of executing them inside a Lua script.

### Why Extend is slower

Extend (6.3ms) is the slowest single operation because it does the most work atomically inside Redis: read reservation state, validate expiration and extension limits, update TTL, update the sorted set index, read scope hierarchy, and snapshot balances across all affected budgets. All in one atomic Lua script — no round-trips, but more Redis commands per execution.

## Concurrent Throughput

Single-threaded latency doesn't tell you how the system behaves when 32 agents hit it simultaneously. We ran Reserve→Commit lifecycles at increasing concurrency:

| Threads | Throughput  |  p50    |  p95    |  p99    |  max    | Errors |
|---------|-------------|---------|---------|---------|---------|--------|
|       8 |    786 op/s |   9.9ms |  12.2ms |  21.7ms |  30.5ms |      0 |
|      16 |  1,122 op/s |  14.0ms |  19.7ms |  23.4ms |  34.9ms |      0 |
|      32 |  2,390 op/s |  11.8ms |  23.6ms |  39.6ms |  72.3ms |      0 |

### Key observations

**Near-linear scaling.** Throughput scales 3.0x when going from 8 to 32 threads (4x threads). The sub-linear factor is expected — Redis Lua scripts are serialized (single-threaded execution) and connection pool contention increases.

**Zero errors under load.** No budget violations, no connection pool exhaustion, no timeouts at any concurrency level. The Redis connection pool (50 connections) has headroom even at 32 concurrent threads.

**Tail latency grows predictably.** p99 goes from 21.7ms at 8 threads to 39.6ms at 32 threads. The 72.3ms max at 32 threads is likely a GC pause or connection pool wait — rare enough to not affect p99.

**2,390 complete lifecycles per second** at 32 threads means each thread completes a full Reserve→Commit cycle (two HTTP calls, two Lua script executions, two auth checks) in ~11ms average.

## Runaway Agent Demo: v0.1.23 vs v0.1.24

Synthetic benchmarks show per-operation overhead. But what does budget enforcement look like when a real agent runs away? We ran the same demo against both v0.1.23.3 and v0.1.24.1 — an agent making LLM calls in a tight loop, first unguarded (no budget), then guarded (with a $1.00 budget).

| Metric               | v0.1.23.3 | v0.1.24.1 | Notes              |
|-----------------------|-----------|-----------|---------------------|
| **Unguarded calls**   | 595       | 597       | Same (~600)         |
| **Unguarded spend**   | $5.95     | $5.97     | Same (~$6)          |
| **Unguarded duration**| 30.1s     | 30.1s     | Identical           |
| **Guarded calls**     | 100       | 100       | Identical           |
| **Guarded spend**     | $1.0000   | $1.0000   | Identical           |
| **Guarded duration**  | 67.8s     | 7.5s      | **9x faster**       |
| **Budget stop**       | 409 BUDGET_EXCEEDED | 409 BUDGET_EXCEEDED | Identical behavior |

The unguarded baseline is identical — same agent, same workload, same ~600 calls burning ~$6 in 30 seconds. That confirms the comparison is fair.

With budget enforcement enabled, both versions stop the agent at exactly 100 calls and $1.00 of spend. The budget boundary is airtight in both versions. The difference is how fast the guarded agent completes: v0.1.24.1 finishes in **7.5 seconds** versus 67.8 seconds on v0.1.23.3 — a **9x improvement** in end-to-end guarded runtime.

The speedup comes from the optimizations described below: BCrypt caching, EVALSHA pipelining, and in-Lua balance snapshots. In v0.1.23, each budget check added enough overhead that 100 guarded calls took longer than 600 unguarded calls. In v0.1.24, budget enforcement overhead is invisible — the guarded run is faster simply because it makes fewer calls.

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

Budget enforcement with Cycles adds **3.5-6.3ms per write operation** and **3.3-4.8ms per read** in the typical case. A full reserve-commit lifecycle adds **~11ms** to an LLM call that takes seconds. At 32 concurrent threads, the server sustains **2,390+ complete lifecycles per second** with zero errors.

The overhead is small enough that you shouldn't notice it. In our runaway agent demo, v0.1.24 stops a $6 agent at exactly $1.00 — and the guarded run finishes **9x faster** than the previous version. If you don't enforce budgets, the cost of a single runaway agent will be orders of magnitude larger than any latency you saved.

## FAQ

### How much latency does Cycles add to LLM calls?

A full reserve-commit lifecycle adds ~11ms (p50) to your agent's LLM call. Since most LLM API calls take 500ms-30s, budget enforcement adds less than 3% overhead in the worst case and is effectively invisible in practice. In our runaway agent demo, the guarded agent completed 9x faster on v0.1.24 than v0.1.23, demonstrating that per-operation overhead reduction compounds across hundreds of calls. Read-only queries (balance checks, reservation lookups) add just 3-4ms.

### Does Cycles scale horizontally?

The Cycles server is stateless — all state lives in Redis. You can run multiple server instances behind a load balancer. Redis itself can be scaled with Redis Cluster for sharding across multiple nodes. Our benchmarks show a single instance handling 2,390+ complete lifecycles per second.

### What happens if the Cycles server is slow or unavailable?

The protocol is designed for the [reserve-commit pattern](/protocol/how-reserve-commit-works-in-cycles). If a reserve call is slow, the agent waits before making the LLM call (fail-safe). If the server is unavailable, the reserve fails and the agent doesn't proceed — preventing uncontrolled spend. Commits and events can be retried with idempotency keys. Read-only endpoints (balance checks, reservation lookups) are the fastest at 3-4ms and can be used for status dashboards without concern.

### How does this compare to LLM proxy approaches?

LLM proxies add latency on every token streamed. Cycles operates at the action level — one reserve before the call, one commit after — so latency scales with the number of agent actions, not the number of tokens. For a 10,000-token completion, a proxy adds overhead to every chunk; Cycles adds two 4-5ms calls total.

---

*Questions about performance in your specific deployment? Check the [server configuration reference](/configuration/server-configuration-reference-for-cycles).*
