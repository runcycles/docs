---
title: "Running the Cycles MCP Server over HTTP / SSE"
description: "When to use HTTP transport instead of STDIO for the Cycles MCP server, and how to deploy it as a shared remote MCP gateway. Includes docker-compose example and auth notes."
---

# Running the Cycles MCP Server over HTTP / SSE

The Cycles MCP server supports two transports:

- **STDIO** (default) — the AI client launches the server as a subprocess via `npx`. One server per developer, per machine.
- **HTTP / SSE** — the server runs as a long-lived process and clients connect remotely. One server, many clients.

This page covers HTTP. For STDIO setup with each AI client, see the per-client quickstarts: [Claude Desktop](/quickstart/mcp-claude-desktop), [Claude Code](/quickstart/mcp-claude-code), [Cursor](/quickstart/mcp-cursor), [Windsurf](/quickstart/mcp-windsurf).

## When to use HTTP instead of STDIO

| Situation | Transport |
|---|---|
| Single developer, local machine, one Cycles server | **STDIO** — simpler, zero process management |
| Team-wide MCP gateway shared across N developers | **HTTP** — one place to update, central auth |
| Remote / cloud deploy where the MCP server lives next to `cycles-server` | **HTTP** — co-located deploy |
| Agent runs in CI/CD or a Kubernetes pod | **HTTP** — sidecar pattern |
| You want to put auth, rate limiting, or audit logging in front of MCP | **HTTP** — terminate at a reverse proxy |

If you are not in one of the HTTP rows above, use STDIO. STDIO is simpler and avoids needing to think about network exposure, auth, or process supervision.

## Start the server with HTTP transport

```bash
npx @runcycles/mcp-server --transport http
```

The server starts on port `3000` and exposes:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness probe — returns `{"status": "ok", "version": "..."}` |
| `/mcp` | POST | MCP Streamable HTTP endpoint (preferred for new clients) |
| `/mcp` | GET | MCP SSE endpoint (legacy / browser-compatible) |
| `/mcp` | DELETE | Session cleanup |

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `CYCLES_API_KEY` | *(required)* | Cycles API key the server uses to talk to `cycles-server`. **Note:** in HTTP mode, this is the gateway's own key, not per-user. Per-user auth lives in front of the gateway (see below). |
| `CYCLES_BASE_URL` | *(required)* | URL of `cycles-server` (e.g. `http://cycles-server:7878` if co-deployed) |
| `CYCLES_MOCK` | — | `"true"` to skip the backend and return mock responses (useful for client-integration tests) |

## Worked example: docker-compose

The Cycles MCP server has no first-party container image yet, so the cleanest path today is a tiny Dockerfile that pins a server version, then run that image alongside your existing Cycles server. The example below assumes you already have a `cycles-server` running and reachable at some URL — see [Self-Hosting the Server](/quickstart/self-hosting-the-cycles-server) if you don't.

```dockerfile
# Dockerfile
FROM node:22-alpine
WORKDIR /app
RUN npm install --omit=dev @runcycles/mcp-server@latest
EXPOSE 3000
CMD ["npx", "@runcycles/mcp-server", "--transport", "http"]
```

```yaml
# docker-compose.yml
services:
  cycles-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      CYCLES_API_KEY: ${CYCLES_API_KEY}
      CYCLES_BASE_URL: ${CYCLES_BASE_URL}
      PORT: "3000"
```

Run it:

```bash
export CYCLES_API_KEY=cyc_live_...
export CYCLES_BASE_URL=http://host.docker.internal:7878   # or wherever your Cycles server is
docker compose up -d --build
curl http://localhost:3000/health
# => {"status":"ok","version":"..."}
```

You can now point any HTTP-capable MCP client at `http://localhost:3000/mcp`. For production, pin a specific version of `@runcycles/mcp-server` in the Dockerfile (replace `@latest`) and put a reverse proxy in front of `:3000`.

## Connecting an MCP client to a remote server

The client config replaces the STDIO `command`/`args` launch with a remote URL. The exact key naming differs across clients and is still evolving — some use `"url"`, others require an explicit `"type": "http"` discriminator. Two examples of shapes seen in the wild:

```json
{
  "mcpServers": {
    "cycles": {
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

```json
{
  "mcpServers": {
    "cycles": {
      "type": "http",
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

Check your client's current docs — remote-MCP support is rolling out unevenly across Claude Desktop, Claude Code, Cursor, and Windsurf release channels. STDIO is universally supported and is the right fallback while remote support stabilizes.

## Auth, scope derivation, and security

- **The MCP server's `CYCLES_API_KEY` is the gateway's identity, not the user's.** Every reservation it creates appears under that one key in audit logs. If you need per-user attribution, terminate auth at a reverse proxy in front of the gateway and forward the user identity into reservation `tags` or `metrics.custom`. See [Custom Field Resolvers](/how-to/custom-field-resolvers-in-cycles).
- **Scope derivation behaves identically over HTTP.** The reserve / commit / decide tools accept the same scope hierarchy ([tenant → workspace → app → workflow → agent → toolset](/concepts/exposure-why-rate-limits-leave-agents-unbounded)) regardless of transport.
- **Don't expose `/mcp` to the public internet without a reverse proxy.** Anyone who can reach the endpoint can use whatever budget the gateway's API key has. Put it behind nginx/caddy/Traefik with mTLS, an API gateway, or a VPC/private network.
- **Health check is unauthenticated.** `/health` returns version info; that's intentional for load balancers. The other `/mcp` endpoints inherit whatever auth your reverse proxy enforces.

## Known limitations

- **No built-in per-user auth.** As above — auth is layered in front. If the goal is per-developer attribution, STDIO is currently the simpler answer (each developer has their own API key).
- **No first-party container image.** A pinned GHCR image will land once HTTP demand is validated. Until then, the Dockerfile above is the recommended pattern — pin the package version in production rather than `@latest`.
- **Session lifetime is in-memory.** Restarting the server drops sessions. If you need durable sessions, run a single replica or front the server with a sticky-session load balancer.

## Next steps

- [Integrating Cycles with MCP](/how-to/integrating-cycles-with-mcp) — advanced patterns: preflight, degradation, long-running ops, fire-and-forget events
- [Per-client STDIO quickstarts](/quickstart/getting-started-with-the-mcp-server) — when STDIO is the right call
- [API Key Management](/how-to/api-key-management-in-cycles) — rotation and lifecycle for the gateway's key
- [Multi-Tenant Operations](/guides/multi-tenant-operations) — how scope hierarchy works end-to-end
