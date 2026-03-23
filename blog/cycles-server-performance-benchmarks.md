---
title: "AI Agent Budget Enforcement Latency: Cycles Server Performance Benchmarks"
date: 2026-03-23
author: Cycles Team
tags: [engineering, performance, benchmarks, scaling, latency, throughput, redis]
description: "How much latency does AI agent budget enforcement add? Published p50/p95/p99 latency and throughput benchmarks for every Cycles Protocol operation — reserve, commit, release, extend, decide, and event — with concurrent scaling to 2,400+ ops/sec."
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

## Single-Operation Latency

| Operation           |  p50   |  p95   |  p99   |  min   |  max   |
|---------------------|--------|--------|--------|--------|--------|
| **Reserve**         |  6.1ms |  7.9ms |  8.5ms |  4.8ms | 13.7ms |
| **Commit**          |  5.0ms |  6.7ms |  7.1ms |  3.4ms |  7.2ms |
| **Release**         |  5.2ms |  6.0ms |  6.5ms |  3.9ms |  6.7ms |
| **Extend**          |  7.6ms |  9.7ms | 12.0ms |  5.8ms | 17.2ms |
| **Decide**          |  6.9ms |  8.1ms | 10.4ms |  5.5ms | 16.0ms |
| **Event**           |  5.1ms |  6.7ms |  7.2ms |  3.6ms |  8.8ms |

### What these numbers mean for your agents

**The reserve-commit lifecycle** (the most common pattern) takes about **15ms end-to-end** — 6ms to reserve budget before the LLM call, 5ms to commit actual usage after:

| Lifecycle           |  p50    |  p95    |  p99    |
|---------------------|---------|---------|---------|
| Reserve + Commit    |  14.7ms |  17.8ms |  19.9ms |
| Reserve + Release   |  11.7ms |  14.4ms |  17.4ms |

For context, a typical LLM API call takes 500ms-30s depending on the model and token count. **Budget enforcement adds ~15ms to a multi-second operation** — less than the variance in your LLM provider's response time.

If you just need a quick budget check without reserving (e.g., pre-flight check in a UI), **Decide** gives you a yes/no answer in ~7ms.

**Events** (direct debit without reservation) are the fastest mutation at 5.1ms p50 — useful for logging post-hoc usage where you don't need the reserve-commit guarantee.

### Why Extend is slower

Extend (7.6ms) is the slowest single operation because it does the most work atomically inside Redis: read reservation state, validate expiration and extension limits, update TTL, update the sorted set index, read scope hierarchy, and snapshot balances across all affected budgets. All in one atomic Lua script — no round-trips, but more Redis commands per execution.

## Concurrent Throughput

Single-threaded latency doesn't tell you how the system behaves when 32 agents hit it simultaneously. We ran Reserve→Commit lifecycles at increasing concurrency:

| Threads | Throughput  |  p50    |  p95    |  p99    |  max    | Errors |
|---------|-------------|---------|---------|---------|---------|--------|
|       8 |    805 op/s |   9.7ms |  11.8ms |  17.9ms |  33.7ms |      0 |
|      16 |  1,101 op/s |  14.2ms |  19.8ms |  23.9ms |  28.8ms |      0 |
|      32 |  2,483 op/s |  11.6ms |  21.4ms |  35.2ms |  65.8ms |      0 |

### Key observations

**Near-linear scaling.** Throughput scales 3.1x when going from 8 to 32 threads (4x threads). The sub-linear factor is expected — Redis Lua scripts are serialized (single-threaded execution) and connection pool contention increases.

**Zero errors under load.** No budget violations, no connection pool exhaustion, no timeouts at any concurrency level. The Redis connection pool (50 connections) has headroom even at 32 concurrent threads.

**Tail latency grows predictably.** p99 goes from 17.9ms at 8 threads to 35.2ms at 32 threads. The 65.8ms max at 32 threads is likely a GC pause or connection pool wait — rare enough to not affect p99.

**2,483 complete lifecycles per second** at 32 threads means each thread completes a full Reserve→Commit cycle (two HTTP calls, two Lua script executions, two auth checks) in ~13ms average.

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

Source: [`CyclesProtocolBenchmarkTest`](https://github.com/runcycles/cycles-server/blob/main/cycles-protocol-service/cycles-protocol-service-api/src/test/java/io/runcycles/protocol/api/CyclesProtocolBenchmarkTest.java) and [`CyclesProtocolConcurrentBenchmarkTest`](https://github.com/runcycles/cycles-server/blob/main/cycles-protocol-service/cycles-protocol-service-api/src/test/java/io/runcycles/protocol/api/CyclesProtocolConcurrentBenchmarkTest.java).

## The bottom line

Budget enforcement with Cycles adds **5-8ms per operation** in the typical case. A full reserve-commit lifecycle adds **~15ms** to an LLM call that takes seconds. At 32 concurrent threads, the server sustains **2,400+ complete lifecycles per second** with zero errors.

The overhead is small enough that you shouldn't notice it. And if you don't enforce budgets, the cost of a single runaway agent will be orders of magnitude larger than any latency you saved.

## FAQ

### How much latency does Cycles add to LLM calls?

A full reserve-commit lifecycle adds ~15ms (p50) to your agent's LLM call. Since most LLM API calls take 500ms-30s, budget enforcement adds less than 3% overhead in the worst case and is effectively invisible in practice.

### Does Cycles scale horizontally?

The Cycles server is stateless — all state lives in Redis. You can run multiple server instances behind a load balancer. Redis itself can be scaled with Redis Cluster for sharding across multiple nodes. Our benchmarks show a single instance handling 2,400+ complete lifecycles per second.

### What happens if the Cycles server is slow or unavailable?

The protocol is designed for the [reserve-commit pattern](/concepts/reserve-commit). If a reserve call is slow, the agent waits before making the LLM call (fail-safe). If the server is unavailable, the reserve fails and the agent doesn't proceed — preventing uncontrolled spend. Commits and events can be retried with idempotency keys.

### How does this compare to LLM proxy approaches?

LLM proxies add latency on every token streamed. Cycles operates at the action level — one reserve before the call, one commit after — so latency scales with the number of agent actions, not the number of tokens. For a 10,000-token completion, a proxy adds overhead to every chunk; Cycles adds two 5-7ms calls total.

---

*Questions about performance in your specific deployment? [Join the community](/community) or check the [self-hosting guide](/configuration/self-hosting).*
