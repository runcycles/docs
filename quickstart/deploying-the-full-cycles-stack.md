# Deploying the Full Cycles Stack

This guide walks you from zero to a working Cycles deployment. By the end, you will have budget enforcement running and verified with a real reserve-commit cycle.

## What you'll have at the end

A working Cycles stack where you can reserve budget, commit actual spend, and verify balances:

```bash
$ curl -s -X POST http://localhost:7878/v1/reservations ...
{ "decision": "ALLOW", "reservation_id": "rsv_..." }

$ curl -s -X POST http://localhost:7878/v1/reservations/rsv_.../commit ...
{ "status": "COMMITTED" }

$ curl -s http://localhost:7878/v1/balances?tenant=acme-corp ...
{ "remaining": ..., "spent": 350000, ... }
```

<details>
<summary><strong>TL;DR — Full quickstart in 60 seconds</strong></summary>

If you have Docker running and just want to try Cycles immediately, copy-paste this entire block:

```bash
# 1. Create docker-compose.yml and start the stack
cat > docker-compose.yml <<'COMPOSE'
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
  cycles-admin:
    image: ghcr.io/runcycles/cycles-server-admin:latest
    ports: ["7979:7979"]
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ""
      ADMIN_API_KEY: admin-bootstrap-key
    depends_on:
      redis: { condition: service_healthy }
  cycles-server:
    image: ghcr.io/runcycles/cycles-server:latest
    ports: ["7878:7878"]
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ""
    depends_on:
      redis: { condition: service_healthy }
volumes:
  redis-data:
COMPOSE

docker compose up -d

# 2. Wait for services to be ready
echo "Waiting for services..."
until curl -sf http://localhost:7878/actuator/health > /dev/null 2>&1; do sleep 1; done
until curl -sf http://localhost:7979/actuator/health > /dev/null 2>&1; do sleep 1; done
echo "Services are up."

# 3. Create tenant
curl -s -X POST http://localhost:7979/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{"tenant_id": "acme-corp", "name": "Acme Corporation"}' | jq .

# 4. Create API key and capture it
API_KEY=$(curl -s -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "quickstart-key",
    "permissions": ["reservations:create","reservations:commit","reservations:release","reservations:extend","reservations:list","balances:read","decide","events:create"]
  }' | jq -r '.key_secret')
echo "API Key: $API_KEY"

# 5. Create a budget ($1.00 = 100,000,000 microcents)
curl -s -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{"scope": "tenant:acme-corp", "unit": "USD_MICROCENTS", "allocated": {"amount": 100000000, "unit": "USD_MICROCENTS"}}' | jq .

# 6. Test: reserve → commit → check balance
RESERVATION_ID=$(curl -s -X POST http://localhost:7878/v1/reservations \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{
    "idempotency_key": "qs-reserve-001",
    "subject": {"tenant": "acme-corp"},
    "action": {"kind": "llm.completion", "name": "openai:gpt-4o"},
    "estimate": {"amount": 500000, "unit": "USD_MICROCENTS"},
    "ttl_ms": 30000
  }' | jq -r '.reservation_id')
echo "Reserved: $RESERVATION_ID"

curl -s -X POST "http://localhost:7878/v1/reservations/$RESERVATION_ID/commit" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{"idempotency_key": "qs-commit-001", "actual": {"amount": 350000, "unit": "USD_MICROCENTS"}}' | jq .

curl -s "http://localhost:7878/v1/balances?tenant=acme-corp" \
  -H "X-Cycles-API-Key: $API_KEY" | jq .

echo ""
echo "Done! Your Cycles stack is running."
echo "  Runtime server: http://localhost:7878/swagger-ui.html"
echo "  Admin server:   http://localhost:7979/swagger-ui.html"
echo "  API key:        $API_KEY"
```

</details>

## What you are deploying

A complete Cycles deployment has three components that share a single Redis instance:

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Your Application                               │
│    @Cycles annotation  /  CyclesClient  /  raw HTTP                 │
└──────────────┬───────────────────────────────────────────────────────┘
               │ HTTP (port 7878)
               ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│     Cycles Server        │     │   Cycles Admin Server    │
│  (runtime enforcement)   │     │  (tenant/budget/key mgmt)│
│  Port 7878               │     │  Port 7979               │
└──────────┬───────────────┘     └──────────┬───────────────┘
           │                                │
           └───────────┬───────────────────┘
                       ▼
              ┌─────────────────┐
              │    Redis 7+     │
              │   Port 6379     │
              └─────────────────┘
```

| Component | Purpose | Port |
|---|---|---|
| **Redis 7+** | Stores all budget state, reservations, and tenant data | 6379 |
| **Cycles Admin Server** | Create tenants, API keys, and budget ledgers. Management plane. | 7979 |
| **Cycles Server** | Runtime budget enforcement. Your app talks to this. | 7878 |

Your application only talks to the **Cycles Server** (port 7878). You use the **Admin Server** (port 7979) to set up tenants, keys, and budgets before your app starts enforcing.

## Prerequisites

- **Docker** and **Docker Compose** (for the quick path — no Java needed), or
- **Java 21+** and **Maven 3.9+** (for running from source without Docker)
- **Redis 7+** (if not using Docker)

Verify Docker is ready:

```bash
docker --version          # Docker 20+ required
docker compose version    # Docker Compose v2+ required
```

If `docker compose` fails, you may need to install the Docker Compose plugin or use the standalone `docker-compose` binary.

## Step 1: Start the infrastructure

### Option A: Docker Compose from GHCR images (recommended for end users)

The easiest way to deploy is using pre-built images from GitHub Container Registry. No Java or Maven required — Docker pulls the images automatically.

Create a `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  cycles-admin:
    image: ghcr.io/runcycles/cycles-server-admin:latest
    ports:
      - "7979:7979"
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ""
      ADMIN_API_KEY: ${ADMIN_API_KEY:-admin-bootstrap-key}
    depends_on:
      redis:
        condition: service_healthy

  cycles-server:
    image: ghcr.io/runcycles/cycles-server:latest
    ports:
      - "7878:7878"
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ""
    depends_on:
      redis:
        condition: service_healthy

volumes:
  redis-data:
```

Start the stack:

```bash
docker compose up -d
```

> **Pinning versions:** Replace `:latest` with a specific version tag (e.g., `:0.1.23`) for reproducible deployments.

Verify all services are healthy:

```bash
curl -s http://localhost:7878/actuator/health   # Cycles Server
curl -s http://localhost:7979/actuator/health   # Admin Server
```

Both should return `{"status":"UP"}`.

### Option B: Docker Compose from source (for development)

Both repositories include multi-stage Dockerfiles that build the JARs inside Docker — no local Java or Maven installation required. Each repository includes a `docker-compose.full-stack.yml` that brings up Redis, the Cycles Server, and the Admin Server together.

Clone both repositories side by side:

```bash
git clone https://github.com/runcycles/cycles-server.git
git clone https://github.com/runcycles/cycles-server-admin.git
```

Start the full stack from either repo:

```bash
cd cycles-server-admin
docker compose -f docker-compose.full-stack.yml up -d
```

The multi-stage Docker build compiles the JARs automatically — no manual `mvn package` step needed.

Verify all services are healthy:

```bash
curl -s http://localhost:7878/actuator/health   # Cycles Server
curl -s http://localhost:7979/actuator/health   # Admin Server
```

Both should return `{"status":"UP"}`.

### Option C: Running from source

Start Redis:

```bash
docker run -d --name cycles-redis -p 6379:6379 redis:7-alpine
```

Build and start the admin server:

```bash
cd cycles-server-admin/cycles-admin-service
mvn clean package -DskipTests
REDIS_HOST=localhost REDIS_PORT=6379 REDIS_PASSWORD= ADMIN_API_KEY=admin-bootstrap-key \
  java -jar cycles-admin-service-api/target/cycles-admin-service-api-0.1.23.jar
```

In a second terminal, build and start the cycles server:

```bash
cd cycles-server/cycles-protocol-service
mvn clean package -DskipTests
REDIS_HOST=localhost REDIS_PORT=6379 \
  java -jar cycles-protocol-service-api/target/cycles-protocol-service-api-0.1.23.jar
```

## Step 2: Create a tenant

Every budget and API key belongs to a tenant. Create one using the admin API:

```bash
curl -s -X POST http://localhost:7979/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "Acme Corporation"
  }' | jq .
```

You should see the tenant returned with its details.

## Step 3: Create an API key

Create a tenant-scoped API key. This is the key your application will use in the `X-Cycles-API-Key` header:

```bash
curl -s -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "acme-corp",
    "name": "dev-key",
    "description": "Development key for acme-corp",
    "permissions": [
      "reservations:create",
      "reservations:commit",
      "reservations:release",
      "reservations:extend",
      "reservations:list",
      "balances:read",
      "decide",
      "events:create"
    ]
  }' | jq .
```

**Important:** The response includes the full API key (e.g., `cyc_live_...`). Save it — the full secret is only returned once.

```bash
# Save the key for use in later steps
export CYCLES_API_KEY="cyc_live_..."   # paste the key from the response
```

## Step 4: Create a budget

Create a budget ledger for the tenant. Without a budget, all reservations will be denied with `BUDGET_EXCEEDED`:

```bash
curl -s -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "scope": "tenant:acme-corp",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 10000000, "unit": "USD_MICROCENTS" }
  }' | jq .
```

This creates a budget ledger with $0.10 (10,000,000 microcents) available to spend. The `allocated` amount is immediately available as spendable balance.

To add more funds later (e.g., on a schedule or when a customer upgrades), use the fund endpoint:

```bash
curl -s -X POST "http://localhost:7979/v1/admin/budgets/tenant:acme-corp/USD_MICROCENTS/fund" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "operation": "CREDIT",
    "amount": { "amount": 10000000, "unit": "USD_MICROCENTS" },
    "idempotency_key": "topup-001",
    "reason": "Budget top-up"
  }' | jq .
```

> **Note:** The CREDIT operation adds to the existing balance. If you created the budget with 10M and then credit 10M, the total available becomes 20M.

## Step 5: Verify the full lifecycle

Now test a complete reserve → commit cycle against the **Cycles Server** (port 7878):

```bash
# 1. Reserve
RESERVE_RESPONSE=$(curl -s -X POST http://localhost:7878/v1/reservations \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "idempotency_key": "test-deploy-001",
    "subject": { "tenant": "acme-corp" },
    "action": { "kind": "llm.completion", "name": "openai:gpt-4o" },
    "estimate": { "amount": 500000, "unit": "USD_MICROCENTS" },
    "ttl_ms": 30000,
    "overage_policy": "REJECT"
  }')

echo "$RESERVE_RESPONSE" | jq .
RESERVATION_ID=$(echo "$RESERVE_RESPONSE" | jq -r '.reservation_id')
echo "Reservation ID: $RESERVATION_ID"
```

You should see `"decision": "ALLOW"` and a `reservation_id`.

```bash
# 2. Commit actual spend
curl -s -X POST "http://localhost:7878/v1/reservations/$RESERVATION_ID/commit" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" \
  -d '{
    "idempotency_key": "test-commit-001",
    "actual": { "amount": 350000, "unit": "USD_MICROCENTS" },
    "metrics": {
      "tokens_input": 1200,
      "tokens_output": 800,
      "model_version": "gpt-4o-2024-05"
    }
  }' | jq .
```

You should see `"status": "COMMITTED"`.

```bash
# 3. Check the balance
curl -s "http://localhost:7878/v1/balances?tenant=acme-corp" \
  -H "X-Cycles-API-Key: $CYCLES_API_KEY" | jq .
```

You should see `spent` has increased and `remaining` has decreased.

**Your deployment is working.** The full reserve-commit-balance cycle completed successfully.

## Step 6: Connect your application

### Spring Boot (using the Cycles Spring Boot Starter)

Add the dependency:

```xml
<dependency>
    <groupId>io.runcycles</groupId>
    <artifactId>cycles-client-java-spring</artifactId>
    <version>0.1.1</version>
</dependency>
```

Configure your project's `application.yml`:

```yaml
cycles:
  base-url: http://localhost:7878
  api-key: ${CYCLES_API_KEY}
  tenant: acme-corp
```

Annotate methods:

```java
@Service
public class LlmService {

    @Cycles(estimate = "#maxTokens * 10", unit = "USD_MICROCENTS",
            actionKind = "llm.completion", actionName = "openai:gpt-4o")
    public String generate(String prompt, int maxTokens) {
        // Call your LLM provider here
        return callOpenAI(prompt, maxTokens);
    }
}
```

### Any language (raw HTTP)

Any HTTP client can use Cycles. The protocol is language-agnostic:

```python
import requests

CYCLES_URL = "http://localhost:7878"
API_KEY = "cyc_live_..."

# Reserve
resp = requests.post(f"{CYCLES_URL}/v1/reservations", json={
    "idempotency_key": "py-001",
    "subject": {"tenant": "acme-corp"},
    "action": {"kind": "llm.completion", "name": "openai:gpt-4o"},
    "estimate": {"amount": 500000, "unit": "USD_MICROCENTS"},
    "ttl_ms": 30000
}, headers={"X-Cycles-API-Key": API_KEY})

reservation_id = resp.json()["reservation_id"]

# ... call the LLM ...

# Commit
requests.post(f"{CYCLES_URL}/v1/reservations/{reservation_id}/commit", json={
    "idempotency_key": "py-commit-001",
    "actual": {"amount": 420000, "unit": "USD_MICROCENTS"}
}, headers={"X-Cycles-API-Key": API_KEY})
```

## Environment variable reference

### Cycles Server (port 7878)

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `server.port` | `7878` | HTTP port |
| `cycles.expiry.interval-ms` | `5000` | Reservation expiry sweep interval (ms) |

### Cycles Admin Server (port 7979)

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | (required) | Redis hostname |
| `REDIS_PORT` | (required) | Redis port |
| `REDIS_PASSWORD` | (required) | Redis password (set empty string if none) |
| `ADMIN_API_KEY` | (empty) | Master admin key for `X-Admin-API-Key` header |
| `server.port` | `7979` | HTTP port |

## Troubleshooting

### "BUDGET_EXCEEDED" on first reservation

No budget exists for the scope. Create a budget ledger via the admin API (Step 4). Every scope in the subject hierarchy needs an allocated budget.

### "UNAUTHORIZED" or 401

The API key is missing, invalid, or expired. Verify with:

```bash
curl -s -X POST http://localhost:7979/v1/auth/validate \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{"key_secret": "cyc_live_..."}' | jq .
```

### Connection refused on port 7878 or 7979

The server is not running. Check Docker containers (`docker compose ps`) or check that the Java processes are running.

### "DEBT_OUTSTANDING" on new reservations

A scope has accumulated debt from `ALLOW_WITH_OVERDRAFT` commits. Repay the debt via the admin API:

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

### Docker daemon not running

If `docker compose up` fails with "Cannot connect to the Docker daemon", ensure Docker Desktop is running (macOS/Windows) or that the Docker service is started (`sudo systemctl start docker` on Linux).

### Port conflicts

If you see "port is already allocated", another service is using port 6379, 7878, or 7979. Stop the conflicting service or change the port mapping in your `docker-compose.yml` (e.g., `"7879:7878"`).

### Redis connection errors

Ensure Redis 7+ is running and accessible at the configured host:port. Test with:

```bash
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

## Next steps

- [Architecture Overview](/quickstart/architecture-overview-how-cycles-fits-together) — how the components interact in detail
- [Server Configuration Reference](/configuration/server-configuration-reference-for-cycles) — all server configuration properties
- [Getting Started with the Spring Boot Starter](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — full Spring Boot integration guide
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — budget patterns and strategies
- [API Key Management](/how-to/api-key-management-in-cycles) — key rotation, scoping, and security
