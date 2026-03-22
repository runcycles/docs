---
title: "Architecture Overview: How Cycles Fits Together"
description: "Learn how Cycles components interact — the protocol, server, admin server, and Spring Boot starter — and how budget enforcement flows through the system."
---

# Architecture Overview: How Cycles Fits Together

Cycles is a runtime authority for autonomous agents. It sits between your application and the actions that cost money or carry risk.

This page describes the components, how they interact, and where each piece runs.

::: tip Prerequisites
This is a reference page. If you haven't set up Cycles yet, start with the [End-to-End Tutorial](/quickstart/end-to-end-tutorial) or [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack).
:::

## System overview

```
┌──────────────────────────────────────┐  ┌────────────────────────────┐
│         Your Application             │  │   AI Agent (MCP Host)      │
│                                      │  │  Claude Desktop / Code /   │
│  ┌──────────────┐  ┌──────────────┐  │  │  Cursor / Windsurf         │
│  │  @Cycles     │  │ CyclesClient │  │  │           │                │
│  │  annotation  │  │   (direct)   │  │  │           ▼                │
│  └──────┬───────┘  └─────┬────────┘  │  │  ┌──────────────────────┐  │
│         │                │           │  │  │   Cycles MCP Server  │  │
│         ▼                ▼           │  │  │   (stdio / HTTP)     │  │
│  ┌──────────────────────────────┐    │  │  └──────────┬───────────┘  │
│  │ Java Spring, Other bindings  │    │  └─────────────┼──────────────┘
│  │     (Cycles Wire Protocol)   │    │                │
│  └──────────────┬───────────────┘    │                │
└─────────────────┼────────────────────┘                │
                  │ HTTP (JSON)                         │ HTTP (JSON)
                  │ X-Cycles-API-Key                    │ X-Cycles-API-Key
                  └──────────────┬──────────────────────┘
                                 ▼
┌─────────────────────────────────────┐  ┌───────────────────────────────────┐
│      Cycles Server (port 7878)      │  │  Cycles Admin Server (port 7979)  │
│     (runtime budget enforcement)    │  │  (tenant, key, budget management) │
│                                     │  │                                   │
│  ┌────────────┐  ┌──────────────┐   │  │  ┌─────────────────────────────┐  │
│  │ Controllers│  │ Auth Filter  │   │  │  │ Tenant CRUD, API Key Mgmt,  │  │
│  │ (REST API) │  │ (API Key)    │   │  │  │ Budget Ledgers, Policies,   │  │
│  └─────┬──────┘  └──────────────┘   │  │  │ Audit Logs, Auth Validation │  │
│        │                            │  │  └──────────────┬──────────────┘  │
│        ▼                            │  │                 │                 │
│  ┌──────────────────────────────┐   │  └─────────────────┼─────────────────┘
│  │ RedisReservationRepository   │   │                    │
│  │ (Lua scripts for atomicity)  │   │                    │
│  └──────────────┬───────────────┘   │                    │
└─────────────────┼───────────────────┘                    │
                  │                                        │
                  └──────────────┬─────────────────────────┘
                                 ▼
              ┌─────────────────────────────────────┐
              │            Redis 7+                 │
              │  (budget state, reservations,       │
              │   tenants, API keys, audit logs)    │
              └─────────────────────────────────────┘
```

Your application talks to the **Cycles Server** (port 7878) at runtime. The **Cycles Admin Server** (port 7979) is the management plane where you create tenants, generate API keys, and configure budget ledgers. Both servers share the same Redis instance.

## Components

### Cycles Protocol

The protocol specification defines the API contract. It is a language-agnostic OpenAPI 3.1 spec that any client or server can implement.

The protocol defines:

- Nine HTTP endpoints for reservations, decisions, balances, and events
- The Subject hierarchy (tenant, workspace, app, workflow, agent, toolset)
- The reserve → execute → commit lifecycle
- Error codes and their semantics
- Idempotency guarantees
- Scope derivation rules

The spec lives at [cycles-protocol](https://github.com/runcycles/cycles-protocol).

### Cycles Server

The reference server implementation. It is a Spring Boot 3.5 application backed by Redis 7+.

**What it does:**

- Accepts HTTP requests from clients
- Validates API keys and enforces tenant isolation
- Executes atomic budget operations via Redis Lua scripts
- Maintains budget state (allocated, spent, reserved, debt)
- Runs a background expiry sweep to clean up abandoned reservations

**Modules:**

| Module | Purpose |
|---|---|
| `cycles-protocol-service-api` | REST controllers, security filters, exception handling |
| `cycles-protocol-service-data` | Redis repository, Lua scripts, scope derivation, expiry service |
| `cycles-protocol-service-model` | Shared DTOs and enums |

**Why Redis and Lua:**

Budget enforcement under concurrency requires atomicity. A reservation must check and update multiple scope counters in a single operation. Redis Lua scripts execute atomically on the server, ensuring no race conditions between concurrent reservations.

Six Lua scripts handle the core operations:

| Script | Operation |
|---|---|
| `reserve.lua` | Check budgets across all scopes, reserve atomically |
| `commit.lua` | Record actual spend, release remainder, handle overage |
| `release.lua` | Return reserved budget to pool |
| `extend.lua` | Extend reservation TTL |
| `event.lua` | Record direct debit without reservation |
| `expire.lua` | Mark expired reservations and release their budget |

### Cycles Admin Server

The management plane for Cycles. It runs as a separate Spring Boot 3.5 service on port 7979 and shares the same Redis instance as the Cycles Server.

**What it does:**

- Manages tenants (create, list, update, suspend, close)
- Creates and revokes API keys with granular permissions
- Creates budget ledgers and handles funding operations (credit, debit, reset, repay debt)
- Defines policies (caps, rate limits, TTL overrides) matched by scope patterns
- Validates API keys (used by the Cycles Server for authentication)
- Maintains an audit log of all administrative operations

**Modules:**

| Module | Purpose |
|---|---|
| `cycles-admin-service-api` | REST controllers, auth interceptor, Spring Boot app |
| `cycles-admin-service-data` | Redis repositories, key service |
| `cycles-admin-service-model` | Shared domain models and DTOs |

**Authentication:** The admin server uses two auth schemes:

| Header | Purpose |
|---|---|
| `X-Admin-API-Key` | System administration (tenant/key management, audit) |
| `X-Cycles-API-Key` | Tenant-scoped operations (budgets, policies, reservations) |

**Why a separate server:**

Separating the management plane from the runtime enforcement plane lets you:

- Run the admin server in a restricted network (internal only) while the Cycles Server is accessible to applications
- Scale the enforcement server independently from the admin server
- Apply different access controls to management vs runtime operations

See the [Cycles Admin Server README](https://github.com/runcycles/cycles-server-admin) for the full API reference.

### Cycles MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Cycles runtime authority as MCP tools. MCP-compatible AI hosts (Claude Desktop, Claude Code, Cursor, Windsurf) discover and call these tools automatically.

**What it does:**

- Exposes 9 MCP tools covering the full Cycles protocol (reserve, commit, release, extend, decide, balance, events, reservations)
- Ships 3 built-in prompts for integration code generation, budget debugging, and strategy design
- Provides resources for inspecting balances and reservation state
- Wraps the `runcycles` TypeScript client internally — talks to the Cycles Server via HTTP

**When to use it:**

Use the MCP server when your agent host supports MCP. No SDK integration is needed in the agent's own code — adding the server to the agent's tool configuration is the only setup required. See [Getting Started with the MCP Server](/quickstart/getting-started-with-the-mcp-server).

### Cycles Spring Boot Starter

A client library that integrates Cycles into Spring Boot applications. It provides two usage modes:

1. **Declarative** — The `@Cycles` annotation wraps methods in a reserve → execute → commit lifecycle automatically via Spring AOP
2. **Programmatic** — The `CyclesClient` interface can be injected and used directly for fine-grained control

**Key components:**

| Component | Purpose |
|---|---|
| `@Cycles` annotation | Declarative budget enforcement on methods |
| `CyclesAspect` | AOP interceptor that drives the lifecycle |
| `CyclesLifecycleService` | Orchestrates reserve/execute/commit/release |
| `CyclesClient` / `DefaultCyclesClient` | HTTP client using Spring WebClient |
| `CyclesContextHolder` | ThreadLocal access to reservation state mid-execution |
| `CyclesExpressionEvaluator` | SpEL evaluation for dynamic estimates and actuals |
| `CyclesFieldResolver` | Interface for dynamic Subject field resolution |
| `CommitRetryEngine` | Retry engine for transient commit failures |
| `CyclesProperties` | Spring Boot configuration properties |

## Request flow

Here is what happens when an `@Cycles`-annotated method is called:

### 1. Estimate evaluation

The SpEL expression in the annotation is evaluated against method parameters to produce a numeric estimate.

### 2. Reservation request

The starter sends `POST /v1/reservations` to the Cycles server with the Subject, Action, estimate, TTL, and overage policy.

### 3. Atomic budget check (server side)

The server derives all affected scopes from the Subject, then executes `reserve.lua`. The Lua script:

- Checks each scope has sufficient remaining budget (`allocated - spent - reserved - debt >= estimate`)
- Checks no scope has outstanding debt or is over-limit
- If all checks pass, atomically increments the `reserved` counter on every scope
- Stores the reservation record with its TTL

### 4. Decision returned

The server returns one of three decisions: `ALLOW`, `ALLOW_WITH_CAPS`, or `DENY`.

### 5. Method execution

If allowed, the starter runs the annotated method. During execution:

- A heartbeat thread periodically extends the reservation TTL
- The method can access `CyclesContextHolder` to read caps or set metrics

### 6. Commit

After the method returns, the starter evaluates the `actual` expression and sends `POST /v1/reservations/{id}/commit`. The server executes `commit.lua` to record actual spend and release the unused remainder.

### 7. Error path

If the method throws, the starter sends `POST /v1/reservations/{id}/release` to return all reserved budget to the pool.

## Data model

All budget state lives in Redis. The key concepts:

### Scopes

A scope is a budgeting boundary derived from the Subject hierarchy. A single reservation may affect multiple scopes. For example, a reservation with `tenant=acme, workspace=prod, app=chatbot` affects three scopes:

- `tenant:acme`
- `tenant:acme/workspace:prod`
- `tenant:acme/workspace:prod/app:chatbot`

### Balances

Each scope tracks:

| Field | Meaning |
|---|---|
| `allocated` | Total budget assigned to this scope |
| `spent` | Committed actual usage |
| `reserved` | Currently held by active reservations |
| `remaining` | `allocated - spent - reserved - debt` |
| `debt` | Negative balance from overdraft commits |
| `overdraft_limit` | Maximum allowed debt |
| `is_over_limit` | Whether `debt > overdraft_limit` |

### Reservations

Each reservation is stored with:

- Unique ID
- Subject and action metadata
- Reserved amount and unit
- Status (ACTIVE, COMMITTED, RELEASED, EXPIRED)
- TTL and grace period timestamps
- Idempotency key and payload hash

## Authentication

The server authenticates every request via the `X-Cycles-API-Key` header. Each API key is associated with a tenant. The server enforces that `subject.tenant` matches the key's tenant — a key for tenant A cannot create reservations for tenant B.

## Deployment topology

A typical deployment:

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Agent A  │  │ Agent B  │  │ Agent C  │  │ Agent D  │  │ Agent E  │
│ (Spring) │  │ (Python) │  │ (Node.js)│  │  (HTTP)  │  │  (MCP)   │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     └──────┬──────┴─────────────┴─────────────┘
            │
            ▼
     ┌──────────────────────────────┐      ┌──────────────────────────┐
     │       Cycles Server          │      │   Cycles Admin Server    │
     │    (one or more instances)   │      │   (internal network)     │
     │         port 7878            │      │      port 7979           │
     └──────────────┬───────────────┘      └────────────┬─────────────┘
                    │                                   │
                    └─────────────┬──────────────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │         Redis 7+             │
                  │   (single instance or        │
                  │    Redis Cluster)            │
                  └──────────────────────────────┘
```

Multiple Cycles server instances can run behind a load balancer. All state is in Redis, so the server is stateless. The admin server is typically on an internal network, accessible only to operators and CI/CD pipelines.

Non-Spring clients (Python, TypeScript/Node.js, Go) can use the protocol directly via HTTP — the client libraries are convenience layers, not a requirement. MCP-compatible agents (Claude Desktop, Claude Code, Cursor, Windsurf) can use the Cycles MCP Server for a zero-code integration path.

## Next Steps

- [Tenants, Scopes, and Budgets](/how-to/understanding-tenants-scopes-and-budgets-in-cycles) — how tenants, scopes, and budgets work together as a unified model
- [Deploying the Full Cycles Stack](/quickstart/deploying-the-full-cycles-stack) — zero to working deployment with all components
- [Self-Hosting the Cycles Server](/quickstart/self-hosting-the-cycles-server) — server-specific configuration and deployment
- [API Reference](/api/) — interactive endpoint documentation
- [Getting Started with the MCP Server](/quickstart/getting-started-with-the-mcp-server) — add runtime authority to Claude Desktop, Claude Code, Cursor, or Windsurf
- [Getting Started with the Python Client](/quickstart/getting-started-with-the-python-client) — integrate with your Python app
- [Getting Started with the TypeScript Client](/quickstart/getting-started-with-the-typescript-client) — integrate with your TypeScript/Node.js app
- [Getting Started with the Spring Boot Starter](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — integrate with your Spring app
