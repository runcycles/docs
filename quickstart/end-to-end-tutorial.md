# End-to-End Tutorial: Zero to Budget-Guarded LLM Call

This tutorial takes you from nothing to a working budget-guarded OpenAI call in about 10 minutes. You will deploy the Cycles stack, create a tenant, fund a budget, and make your first budget-enforced LLM call.

::: tip Want to see Cycles in action before building?
Run the [Runaway Agent Demo](https://github.com/runcycles/cycles-runaway-demo) — no LLM key required, shows the problem and the fix in 60 seconds.
:::

## Prerequisites

- **Docker** and **Docker Compose v2+**
- **Python 3.10+** or **Node.js 20+** (for the application step)
- An **OpenAI API key** (for the final step — you can skip this and use a mock if preferred)

## Step 1: Start the Cycles stack

Create a `docker-compose.yml` and start the infrastructure:

```bash
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
    image: ghcr.io/runcycles/cycles-server-admin:0.1.23.3
    ports: ["7979:7979"]
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ""
      ADMIN_API_KEY: admin-bootstrap-key
    depends_on:
      redis: { condition: service_healthy }
  cycles-server:
    image: ghcr.io/runcycles/cycles-server:0.1.23.3
    ports: ["7878:7878"]
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ""
    depends_on:
      redis: { condition: service_healthy }
COMPOSE

docker compose up -d
```

Wait for services to be healthy:

```bash
until curl -sf http://localhost:7878/actuator/health > /dev/null 2>&1; do sleep 1; done
until curl -sf http://localhost:7979/actuator/health > /dev/null 2>&1; do sleep 1; done
echo "Cycles is running."
```

## Step 2: Create a tenant

```bash
curl -s -X POST http://localhost:7979/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{"tenant_id": "my-app", "name": "My Application"}' | jq .
```

## Step 3: Create an API key

```bash
API_KEY=$(curl -s -X POST http://localhost:7979/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: admin-bootstrap-key" \
  -d '{
    "tenant_id": "my-app",
    "name": "tutorial-key",
    "permissions": ["reservations:create","reservations:commit","reservations:release","reservations:extend","reservations:list","balances:read","decide","events:create"]
  }' | jq -r '.key_secret')

echo "Your API key: $API_KEY"
```

Save this key — the secret is only shown once.

## Step 4: Create a budget

Give the tenant $1.00 (100,000,000 microcents) to spend:

```bash
curl -s -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{
    "scope": "tenant:my-app",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 100000000, "unit": "USD_MICROCENTS" }
  }' | jq .
```

## Step 5: Verify with a raw HTTP test

Before adding an SDK, confirm the lifecycle works with curl:

```bash
# Reserve
RESERVATION_ID=$(curl -s -X POST http://localhost:7878/v1/reservations \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{
    "idempotency_key": "tutorial-001",
    "subject": {"tenant": "my-app"},
    "action": {"kind": "llm.completion", "name": "test"},
    "estimate": {"amount": 500000, "unit": "USD_MICROCENTS"},
    "ttl_ms": 30000
  }' | jq -r '.reservation_id')
echo "Reserved: $RESERVATION_ID"

# Commit
curl -s -X POST "http://localhost:7878/v1/reservations/$RESERVATION_ID/commit" \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{"idempotency_key": "tutorial-commit-001", "actual": {"amount": 350000, "unit": "USD_MICROCENTS"}}' | jq .

# Check balance
curl -s "http://localhost:7878/v1/balances?tenant=my-app" \
  -H "X-Cycles-API-Key: $API_KEY" | jq .
```

You should see `"decision": "ALLOW"`, then `"status": "COMMITTED"`, then a balance with `spent` of 350,000 and the remaining budget reduced accordingly.

## Step 6: Build a budget-guarded application

Choose your language:

::: code-group
```python [Python]
# Install: pip install runcycles openai
# Save as app.py

import os
from openai import OpenAI
from runcycles import CyclesClient, CyclesConfig, cycles, set_default_client

# Configure Cycles
cycles_client = CyclesClient(CyclesConfig(
    base_url="http://localhost:7878",
    api_key=os.environ["CYCLES_API_KEY"],
    tenant="my-app",
))
set_default_client(cycles_client)

# Configure OpenAI
openai_client = OpenAI()

@cycles(
    estimate=2000000,  # Reserve $0.02 per call
    action_kind="llm.completion",
    action_name="openai:gpt-4o-mini",
)
def ask(prompt: str) -> str:
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
    )
    return response.choices[0].message.content

# Run it
try:
    result = ask("What is budget governance for AI agents? Reply in one sentence.")
    print(f"Response: {result}")
except Exception as e:
    print(f"Error: {e}")
```
```typescript [TypeScript]
// Install: npm init -y && npm install runcycles openai
// Save as app.ts

import OpenAI from "openai";
import { CyclesClient, CyclesConfig, withCycles, setDefaultClient } from "runcycles";

const cyclesClient = new CyclesClient(new CyclesConfig({
  baseUrl: "http://localhost:7878",
  apiKey: process.env.CYCLES_API_KEY!,
  tenant: "my-app",
}));
setDefaultClient(cyclesClient);

const openai = new OpenAI();

const ask = withCycles(
  {
    estimate: 2000000,
    actionKind: "llm.completion",
    actionName: "openai:gpt-4o-mini",
  },
  async (prompt: string) => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });
    return response.choices[0].message.content;
  },
);

const result = await ask("What is budget governance for AI agents? Reply in one sentence.");
console.log("Response:", result);
```
:::

Run it:

```bash
export CYCLES_API_KEY="cyc_live_..."   # your key from Step 3
export OPENAI_API_KEY="sk-..."          # your OpenAI key
python app.py                           # or: npx tsx app.ts
```

## Step 7: Watch the budget decrease

After running your app, check the balance again:

```bash
curl -s "http://localhost:7878/v1/balances?tenant=my-app" \
  -H "X-Cycles-API-Key: $API_KEY" | jq '.[] | {scope, remaining, spent, reserved}'
```

You'll see `spent` has increased by the actual cost of your LLM call, and `remaining` has decreased.

## Step 8: See what happens when budget runs out

Try exhausting the budget to see enforcement in action. Set a tiny budget on a new scope:

```bash
curl -s -X POST http://localhost:7979/v1/admin/budgets \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{
    "scope": "tenant:my-app/workspace:demo",
    "unit": "USD_MICROCENTS",
    "allocated": { "amount": 100, "unit": "USD_MICROCENTS" }
  }' | jq .
```

Now try to reserve more than the budget:

```bash
curl -s -X POST http://localhost:7878/v1/reservations \
  -H "Content-Type: application/json" \
  -H "X-Cycles-API-Key: $API_KEY" \
  -d '{
    "idempotency_key": "exceed-001",
    "subject": {"tenant": "my-app", "workspace": "demo"},
    "action": {"kind": "llm.completion", "name": "test"},
    "estimate": {"amount": 500000, "unit": "USD_MICROCENTS"},
    "ttl_ms": 30000
  }' | jq .
```

You'll see `"error": "BUDGET_EXCEEDED"` — the call was blocked *before* any money was spent.

## Cleanup

```bash
docker compose down -v
```

## What's next

- [Choose a First Rollout](/quickstart/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails) — decide your adoption strategy
- [Adding Cycles to an Existing Application](/how-to/adding-cycles-to-an-existing-application) — integrate incrementally
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — how much to reserve per model call
- [Shadow Mode Rollout](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) — test policies without enforcing them
