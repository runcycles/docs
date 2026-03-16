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
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "scope": "tenant:acme-corp",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 100000000, "unit": "USD_MICROCENTS" }
  }' | jq .
```

Remember: every scope in the subject hierarchy needs its own budget. If your reservation uses `tenant=acme-corp, workspace=prod`, you need budgets for both `tenant:acme-corp` and `tenant:acme-corp/workspace:prod`.

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
curl -s -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme-corp/USD_MICROCENTS/fund" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
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
| Decide | `decide` |
| Events | `events:create` |

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
3. Is the method being called through the Spring proxy? (Direct `this.method()` calls bypass AOP.)
4. Is the class a Spring-managed bean (`@Service`, `@Component`, etc.)?

## FAQ

### Can I use Cycles without Docker?

Yes. Run Redis 7+ natively, build the server JARs with Maven, and start them with `java -jar`. See [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack) Option C.

### What happens if the Cycles server goes down?

Your application's behavior depends on your error handling. The SDK clients throw exceptions when the server is unreachable. You should implement a fallback strategy — see [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer).

### Can multiple applications share the same Cycles server?

Yes. Each application uses its own tenant (or its own workspace within a tenant). The Cycles server is stateless — all state lives in Redis.

### How do I reset a budget to zero?

Use the RESET funding operation:

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme-corp/USD_MICROCENTS/fund" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
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

## Next steps

- [Error Codes and Error Handling](/protocol/error-codes-and-error-handling-in-cycles) — complete error code reference
- [Testing with Cycles](/how-to/testing-with-cycles) — testing strategies and fixtures
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — handling budget denial gracefully
