---
title: "Troubleshooting and FAQ"
description: "Solutions to common Cycles issues including budget exceeded errors, reservation failures, connectivity problems, and configuration mistakes."
---

# Troubleshooting and FAQ

Common issues when integrating and operating Cycles, with solutions.

## Reservation and budget issues

### BUDGET_EXCEEDED on first reservation

**Symptom:** The very first reservation attempt returns `409 BUDGET_EXCEEDED`.

**Cause:** No budget ledger exists for the scope. Creating a tenant does not automatically create a budget.

**Fix:** Create a budget via the admin API:

```bash
curl -s -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "scope": "tenant:acme-corp",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 100000000, "unit": "USD_MICROCENTS" }
  }' | jq .
```

Remember: a reservation is checked against every derived scope that has a budget defined. Scopes without budgets are skipped, but at least one derived scope must have a budget. If you have budgets at multiple levels, each one must have sufficient funds.

### BUDGET_EXCEEDED but I just funded the budget

**Symptom:** You funded a budget, but reservations are still denied.

**Possible causes:**

1. **Scope mismatch.** The funded scope does not match the reservation scope. Check that the scope path is exactly right — `tenant:acme-corp` is different from `tenant:acme-corp/workspace:prod`.

2. **Unit mismatch.** You funded in `TOKENS` but the reservation uses `USD_MICROCENTS`. Each unit has its own separate ledger.

3. **Reserved budget.** Other active reservations may be holding budget. Check balances to see the `reserved` field:

```bash
curl -s "http://localhost:7878/v1/balances?tenant=acme-corp" \
  -H "X-Cycles-API-Key: $API_KEY" | jq .
```

The `remaining` field shows available budget after accounting for active reservations.

4. **Hierarchical exhaustion.** A parent scope may be exhausted even if the child scope has budget. Check balances at all levels.

### RESERVATION_EXPIRED — TTL too short

**Symptom:** Commit fails with `410 RESERVATION_EXPIRED` because the LLM call took longer than expected.

**Fixes:**

- **Increase TTL** when creating reservations. Default is often 30 seconds. For long-running operations, use 60-120 seconds.
- **Use automatic heartbeat.** The SDK clients (Python `@cycles`, TypeScript `withCycles`, Java `@Cycles`) automatically extend the reservation TTL while the operation is running. Ensure you're using the decorator/HOF pattern rather than raw HTTP.
- **For raw HTTP users:** call `POST /v1/reservations/{id}/extend` periodically before the TTL expires.

### DEBT_OUTSTANDING blocking new reservations

**Symptom:** New reservations fail with `409 DEBT_OUTSTANDING` even though the budget was recently funded.

**Cause:** A previous commit with `ALLOW_WITH_OVERDRAFT` created debt. Any outstanding debt blocks new reservations until repaid.

**Fix:** Repay the debt:

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme-corp&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "operation": "REPAY_DEBT",
    "amount": { "amount": 500000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "repay-001"
  }' | jq .
```

### IDEMPOTENCY_MISMATCH on retry

**Symptom:** Retrying a failed request returns `409 IDEMPOTENCY_MISMATCH`.

**Cause:** You're reusing the same idempotency key with a different payload. Idempotency keys must be unique per distinct operation. If the original request *succeeded*, retrying with the same key and same payload returns the original response (safe replay). But if the payload changed, you get a mismatch.

**Fix:** Use a new idempotency key for each distinct operation. Use UUIDs or request-scoped identifiers.

## Authentication and authorization

### UNAUTHORIZED (401)

**Symptom:** All requests fail with `401`.

**Checklist:**

1. Is the `X-Cycles-API-Key` header present in the request?
2. Is the key value correct? (Keys start with `cyc_live_`)
3. Has the key been revoked? Validate it:

```bash
curl -s -X POST http://localhost:7979/v1/auth/validate \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{"key_secret": "cyc_live_..."}' | jq .
```

### FORBIDDEN (403) — tenant mismatch

**Symptom:** Requests return `403 FORBIDDEN`.

**Cause:** The `tenant` field in the reservation subject does not match the tenant associated with the API key.

**Fix:** Ensure the `subject.tenant` matches the API key's tenant. Each API key is scoped to exactly one tenant.

### Missing permissions

**Symptom:** Specific operations fail with `403` even though the API key is valid.

**Cause:** The API key does not have the required permission. Permissions are:

| Operation | Required permission |
|---|---|
| Reserve | `reservations:create` |
| Commit | `reservations:commit` |
| Release | `reservations:release` |
| Extend | `reservations:extend` |
| List reservations | `reservations:list` |
| Balances | `balances:read` |

**Fix:** Create a new API key with the required permissions, or update the existing key's permissions.

## Connection and infrastructure

### Connection refused on port 7878 or 7979

**Symptom:** `ECONNREFUSED` or `Connection refused`.

**Checklist:**

1. Is Docker running? (`docker compose ps`)
2. Are the containers healthy? (`docker compose logs cycles-server`)
3. Is Redis accessible? (`redis-cli -h localhost -p 6379 ping`)
4. Are ports conflicting? Check with `lsof -i :7878` or `netstat -tlnp | grep 7878`.

### Timeout errors

**Symptom:** Requests to Cycles server time out.

**Possible causes:**

1. **Redis is slow or unreachable.** Check Redis connectivity and latency.
2. **Server overloaded.** The reservation Lua scripts are atomic but can queue under very high concurrency.
3. **Network issues.** Ensure the client can reach the server (firewall, DNS, proxy).

**Fix for SDK clients:** Increase the client timeout:

::: code-group
```python [Python]
config = CyclesConfig(base_url="http://localhost:7878", timeout=10.0)  # 10 seconds
```
```typescript [TypeScript]
const config = new CyclesConfig({ baseUrl: "http://localhost:7878", timeout: 10000 });
```
:::

## SDK-specific issues

### Python: decorator not working with async functions

**Symptom:** The `@cycles` decorator doesn't seem to work with `async def` functions.

**Fix:** The `@cycles` decorator automatically detects sync vs async functions — no separate decorator is needed. Just use `@cycles` on both:

```python
from runcycles import cycles

# Works with sync functions
@cycles(estimate=5000, action_kind="llm.completion", action_name="gpt-4o")
def ask_sync(prompt: str) -> str:
    ...

# Also works with async functions — auto-detected
@cycles(estimate=5000, action_kind="llm.completion", action_name="gpt-4o")
async def ask_async(prompt: str) -> str:
    ...
```

If you need a fully async programmatic client (not the decorator), use `AsyncCyclesClient`:

```python
from runcycles import AsyncCyclesClient, CyclesConfig

client = AsyncCyclesClient(CyclesConfig.from_env())
```

### TypeScript: streaming response not committing

**Symptom:** Budget is reserved but never committed for streaming calls.

**Cause:** Using `withCycles` for streaming calls. The `withCycles` HOF commits when the wrapped function returns, but streaming functions return before the stream finishes.

**Fix:** Use `reserveForStream` for streaming operations:

```typescript
const handle = await reserveForStream({
  client: cyclesClient,
  estimate: 5000,
  actionKind: "llm.completion",
  actionName: "gpt-4o",
});

try {
  const stream = await openai.chat.completions.create({ stream: true, ... });
  // ... consume stream ...
  await handle.commit(actualCost, { tokensInput, tokensOutput });
} catch (err) {
  await handle.release("stream_error");
  throw err;
}
```

### Spring Boot: @Cycles annotation not intercepting

**Symptom:** Methods annotated with `@Cycles` run without budget enforcement.

**Checklist:**

1. Is `cycles-client-java-spring` on the classpath?
2. Is the `cycles.base-url` property set in `application.yml`?
3. Is the method being called through the Spring proxy? (Direct `this.method()` calls bypass AOP — see below.)
4. Is the class a Spring-managed bean (`@Service`, `@Component`, etc.)?

The most common cause is **self-invocation**: calling a `@Cycles` method from another method in the same class using `this.method()`. Spring's proxy-based AOP cannot intercept these internal calls. The starter logs a `WARN` at startup when it detects beans susceptible to this pattern.

**Fix:** Extract the `@Cycles` method into a separate `@Service`, or self-inject the proxy with `@Lazy @Autowired`. See [Self-Invocation](/quickstart/getting-started-with-the-cycles-spring-boot-starter#self-invocation-internal-method-calls) for full workarounds.

### Spring Boot: IllegalStateException — nested @Cycles

**Symptom:** `IllegalStateException("Nested @Cycles not supported")` thrown at runtime.

**Cause:** A `@Cycles`-annotated method called another `@Cycles`-annotated method (even across different beans). The starter prevents this because each reservation is independent — nesting would double-count budget.

**Fix:** Place `@Cycles` at the outermost entry point only. Remove `@Cycles` from inner methods that are called within an already-guarded operation. See [Nesting Prevention](/quickstart/getting-started-with-the-cycles-spring-boot-starter#nesting-prevention) for details.

### TypeScript / Python: nested budget guards double-counting

**Symptom:** Budget is consumed faster than expected when using nested `withCycles` (TypeScript) or `@cycles` (Python) calls.

**Cause:** Unlike Spring, the TypeScript and Python clients do not block nested calls — each guard silently creates an independent reservation. If an outer guard reserves 500 and an inner guard reserves 100, **600 total** is deducted from the budget, not 500.

**Fix:** Place the budget guard at the outermost entry point only. Inner functions should be plain functions without their own guard. See the nesting sections in the [TypeScript](/quickstart/getting-started-with-the-typescript-client#nested-withcycles-calls) and [Python](/quickstart/getting-started-with-the-python-client#nested-cycles-calls) quickstart guides.

## FAQ

### Why can't I delete tenants or budgets?

By design. Cycles uses **status-based lifecycle management** instead of hard deletion for most objects. Tenants, budgets, and reservations are referenced across the system (audit logs, API keys, committed transactions). Deleting them would orphan those records and break audit trails.

Instead, use the cleanup mechanism for each object type:

- **Tenants:** `PATCH status → CLOSED` — blocks all operations, retains data. See [Tenant Lifecycle](/how-to/tenant-creation-and-management-in-cycles#tenant-status-lifecycle).
- **Budgets:** `POST fund` with `RESET` to zero — prevents new reservations, retains ledger history. See [Resetting Budgets](/how-to/budget-allocation-and-management-in-cycles#resetting-budgets).
- **API Keys:** `DELETE` revokes the key (ACTIVE → REVOKED) but retains the record. See [Revoking API Keys](/how-to/api-key-management-in-cycles#revoking-api-keys).

### Can I use Cycles without Docker?

Yes. Run Redis 7+ natively, build the server JARs with Maven, and start them with `java -jar`. See [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) Option C.

### What happens if the Cycles server goes down?

Your application's behavior depends on your error handling. The SDK clients throw exceptions when the server is unreachable. You should implement a fallback strategy — see [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer).

### Can multiple applications share the same Cycles server?

Yes. Each application uses its own tenant (or its own workspace within a tenant). The Cycles server is stateless — all state lives in Redis.

### How do I reset a budget to zero?

Use the RESET funding operation:

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme-corp&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{"operation": "RESET", "amount": {"amount": 0, "unit": "USD_MICROCENTS"}, "idempotency_key": "reset-001"}' | jq .
```

### How do I see what's using my budget?

Check active reservations and balances:

```bash
# Active reservations
curl -s "http://localhost:7878/v1/reservations?tenant=acme-corp&status=ACTIVE" \
  -H "X-Cycles-API-Key: $API_KEY" | jq .

# Balance breakdown
curl -s "http://localhost:7878/v1/balances?tenant=acme-corp" \
  -H "X-Cycles-API-Key: $API_KEY" | jq .
```

### Is there a way to test without a running server?

Use [shadow mode / dry-run](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) to evaluate budget policies without enforcing them. For unit tests, mock the `CyclesClient` — see [Testing with Cycles](/how-to/testing-with-cycles).

## MCP server issues

### MCP tool calls not enforcing budget

**Symptom:** The MCP tools respond but reservations are not actually created on your Cycles server.

**Checklist:**

1. Is `CYCLES_API_KEY` set in the MCP server environment? Without it, the server cannot authenticate.
2. Is `CYCLES_BASE_URL` pointing to your server? The default is `https://api.runcycles.io`. For local development, set it to `http://localhost:7878`.
3. Is `CYCLES_MOCK` set to `"true"`? Mock mode returns realistic responses without contacting a real server. Remove it for production use.

### MCP server not appearing in Claude Desktop or Cursor

**Symptom:** The agent does not see Cycles tools.

**Checklist:**

1. Is the config file in the right location?
   - Claude Desktop macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Claude Desktop Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Is the JSON valid? A trailing comma or missing brace will silently break the config. Validate with `cat claude_desktop_config.json | jq .`
3. Did you restart the application after editing the config? MCP server configs are read at startup.
4. For Claude Code: did you run `claude mcp add cycles -- npx -y @runcycles/mcp-server`? Check with `claude mcp list`.

### MCP decisions always return ALLOW

**Symptom:** Every reservation or decide call returns `ALLOW` regardless of budget state.

**Cause:** The server is running in mock mode (`CYCLES_MOCK=true`), which returns deterministic mock responses.

**Fix:** Remove the `CYCLES_MOCK` environment variable and ensure `CYCLES_BASE_URL` and `CYCLES_API_KEY` are set correctly.

## Admin API issues

### Cannot create budget — 401 on admin API

**Symptom:** `POST /v1/admin/budgets` returns `401 UNAUTHORIZED`.

**Common causes:**

1. **Wrong port.** The admin API runs on port **7979**, not 7878. The protocol API (reservations, commits) runs on 7878.
2. **Wrong header.** The admin API uses `X-Admin-API-Key`, not `X-Cycles-API-Key`. These are different keys.
3. **Using a protocol API key.** Protocol keys (`cyc_live_...`) do not work on the admin API. Use the admin bootstrap key configured in the server.

### Budget fund operation has no effect

**Symptom:** You called the fund endpoint but the balance did not change.

**Checklist:**

1. **Scope path mismatch.** The scope in the fund request must exactly match the budget scope. `tenant:acme-corp` is not the same as `tenant:acme-corp/workspace:prod`.
2. **Wrong operation.** The `operation` field must be one of `ADD`, `SET`, `RESET`, or `REPAY_DEBT`. If you used `SET` with the same amount as the current balance, there is no visible change.
3. **Check the response.** The fund endpoint returns the updated balance. Verify the response body confirms the change.

### Fund endpoint returns 404 for workspace budget

**Symptom:** Funding a workspace budget returns `404 NOT_FOUND`.

**Cause:** You may be using the old path-based endpoint format. The fund and patch endpoints accept `scope` and `unit` as **query parameters**, not path variables.

**Fix:** Use query parameters:

```bash
curl -X POST "http://localhost:7979/v1/admin/budgets/fund?scope=tenant:acme/workspace:prod&unit=USD_MICROCENTS" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "CREDIT",
    "amount": { "amount": 500000, "unit": "USD_MICROCENTS" }
  }'
```

The same pattern applies to the patch endpoint: `PATCH /v1/admin/budgets?scope=...&unit=...`.

### Tenant creation returns 409

**Symptom:** `POST /v1/admin/tenants` returns `409`.

**Cause:** A tenant with that ID already exists. Tenant IDs are unique. If you are rerunning a setup script, this is expected and safe to ignore.

## Common first-integration mistakes

### Commit fails with 404 NOT_FOUND

**Symptom:** Reserve succeeds, but commit returns `404 NOT_FOUND`.

**Cause:** The reservation expired before the commit arrived. The default TTL may be too short for long-running LLM calls.

**Fix:**

- Increase the `ttl_seconds` when creating reservations. For LLM calls, 60-120 seconds is typical.
- Use the SDK decorators (`@cycles` in Python, `withCycles` in TypeScript, `@Cycles` in Spring) which automatically extend TTL via heartbeat.
- For raw HTTP: call `POST /v1/reservations/{id}/extend` periodically before the TTL expires.

### Budget math does not add up

**Symptom:** You funded a budget with `100000000` expecting $100, but it shows as $1.

**Cause:** Cycles uses `USD_MICROCENTS` where **1 dollar = 100,000,000 microcents** (1 microcent = 10⁻⁸ dollars).

Quick reference:

| Amount | USD_MICROCENTS |
|---|---|
| $0.01 (1 cent) | 1,000,000 |
| $1.00 | 100,000,000 |
| $10.00 | 1,000,000,000 |
| $100.00 | 10,000,000,000 |

See [Understanding Units](/protocol/understanding-units-in-cycles-usd-microcents-tokens-credits-and-risk-points) for the full unit reference.

### Scopes not matching — reservation denied despite budget existing

**Symptom:** A budget exists but reservations are still denied with `BUDGET_EXCEEDED`.

**Cause:** The budget scope path does not match any of the reservation's derived scopes. Enforcement checks every derived scope that has a budget defined — scopes without budgets are skipped, but at least one derived scope must have a budget. Common mismatches:

- Budget at `tenant:acme-corp/workspace:prod` but subject uses `workspace=staging`
- Budget at `tenant:acme-corp/workspace:prod` but subject omits `workspace` entirely (the derived scopes are just `tenant:acme-corp`, which has no budget)
- Budget uses a different tenant ID than the one in the subject

**Fix:** Check that the scope path on the budget matches the scopes derived from the reservation subject. Use the [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles) reference to understand which scopes are derived. See also [Tenants, Scopes, and Budgets](/how-to/understanding-tenants-scopes-and-budgets-in-cycles).

## Debugging production incidents

For deeper incident analysis, the Incident Patterns section documents common production failures with root cause analysis and prevention strategies:

- **[Runaway Agents and Tool Loops](/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent)** — agents that loop indefinitely, burning budget on repeated tool calls
- **[Retry Storms](/incidents/retry-storms-and-idempotency-failures)** — retries that double-charge or bypass budget checks
- **[Concurrent Agent Overspend](/incidents/concurrent-agent-overspend)** — race conditions where multiple agents collectively exceed a shared budget
- **[Scope Misconfiguration](/incidents/scope-misconfiguration-and-budget-leaks)** — budget leaks caused by incorrect scope hierarchies

## Next steps

- [Error Codes and Error Handling](/protocol/error-codes-and-error-handling-in-cycles) — complete error code reference
- [Testing with Cycles](/how-to/testing-with-cycles) — testing strategies and fixtures
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — handling budget denial gracefully
