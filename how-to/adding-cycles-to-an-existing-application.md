# Adding Cycles to an Existing Application

This guide covers how to incrementally add budget governance to an application that already makes LLM or API calls. Rather than rewriting your integration layer, you can adopt Cycles in stages.

## The incremental adoption path

```
1. Shadow mode     →  Observe what enforcement would do, without blocking anything
2. Wrap one call   →  Add budget governance to a single LLM call path
3. Expand coverage →  Wrap additional call paths
4. Enforce         →  Switch from shadow mode to live enforcement
```

## Stage 1: Deploy Cycles in shadow mode

Start by deploying the Cycles stack and connecting your app in **dry-run mode**. This lets you see what budget decisions would be made without actually blocking any calls.

### Python

```python
from runcycles import CyclesClient, CyclesConfig, cycles, set_default_client

client = CyclesClient(CyclesConfig.from_env())
set_default_client(client)

# dry_run=True means the decorator logs decisions but never blocks
@cycles(
    estimate=2000000,
    action_kind="llm.completion",
    action_name="openai:gpt-4o",
    dry_run=True,
)
def existing_chat_function(prompt: str) -> str:
    # Your existing code — completely unchanged
    return call_openai(prompt)
```

### TypeScript

```typescript
import { withCycles, CyclesClient, CyclesConfig, setDefaultClient } from "runcycles";

const client = new CyclesClient(CyclesConfig.fromEnv());
setDefaultClient(client);

// dryRun: true means decisions are logged but never block execution
const existingChatFunction = withCycles(
  {
    estimate: 2000000,
    actionKind: "llm.completion",
    actionName: "openai:gpt-4o",
    dryRun: true,
  },
  async (prompt: string) => {
    // Your existing code — completely unchanged
    return await callOpenAI(prompt);
  },
);
```

In shadow mode, every call still succeeds. But Cycles records what the decision *would have been* — ALLOW, ALLOW_WITH_CAPS, or DENY. This gives you data to tune budgets before enforcing.

See [Shadow Mode Rollout](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) for the full guide.

## Stage 2: Wrap your first call

Pick the highest-value call path to wrap first. Good candidates:

- The call that costs the most per invocation (e.g., GPT-4o or Claude Opus)
- The call that runs most frequently
- The call most likely to loop or retry

### Wrapping an existing function (Python)

**Before:**

```python
def generate_summary(document: str) -> str:
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": f"Summarize: {document}"}],
        max_tokens=2000,
    )
    return response.choices[0].message.content
```

**After:**

```python
from runcycles import cycles

@cycles(
    estimate=lambda document: int(len(document) / 4 * 250 + 2000 * 1000) * 1.2,
    action_kind="llm.completion",
    action_name="openai:gpt-4o",
)
def generate_summary(document: str) -> str:
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": f"Summarize: {document}"}],
        max_tokens=2000,
    )
    return response.choices[0].message.content
```

The only change is adding the `@cycles` decorator. Your business logic stays exactly the same.

### Handling budget denial

Your existing error handling needs one new branch — what to do when budget is denied:

```python
from runcycles import BudgetExceededError

try:
    result = generate_summary(document)
except BudgetExceededError:
    # Option A: Return a graceful fallback
    result = "Summary unavailable — budget limit reached."
    # Option B: Use a cheaper model
    result = generate_summary_cheap(document)
    # Option C: Queue for later
    queue_for_retry(document)
```

See [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) for a full treatment of fallback strategies.

## Stage 3: Expand coverage

Once the first call path is working, wrap additional calls. Use a consistent pattern:

```python
@cycles(estimate=500000, action_kind="llm.completion", action_name="openai:gpt-4o-mini")
def classify_intent(text: str) -> str:
    ...

@cycles(estimate=3000000, action_kind="llm.completion", action_name="openai:gpt-4o")
def generate_response(context: str, intent: str) -> str:
    ...

@cycles(estimate=100000, action_kind="tool.call", action_name="web-search")
def search_web(query: str) -> list:
    ...
```

Each wrapped function reserves independently. If the agent calls all three in sequence, the total budget consumed is the sum of actual usage — and each call is individually authorized before it runs.

## Stage 4: Switch to live enforcement

Once you're confident in your budget allocations (from shadow mode data), remove `dry_run=True`:

```python
# Remove dry_run to enable enforcement
@cycles(
    estimate=2000000,
    action_kind="llm.completion",
    action_name="openai:gpt-4o",
    # dry_run=True,  ← remove this line
)
def generate_summary(document: str) -> str:
    ...
```

## Tips for existing applications

### Keep your existing error handling

Don't replace your existing try/except or try/catch blocks. Add Cycles error handling alongside them:

```python
try:
    result = generate_summary(document)
except BudgetExceededError:
    result = "Budget limit reached."
except openai.APIError as e:
    # Your existing error handling stays
    result = handle_openai_error(e)
```

### Start with generous budgets

When first deploying, set budgets higher than you think you need. You can tighten them after collecting real usage data. Under-budgeting on day one creates unnecessary friction.

### Use scopes to separate environments

Use different workspace scopes for dev, staging, and production:

```python
@cycles(
    estimate=2000000,
    action_kind="llm.completion",
    action_name="openai:gpt-4o",
    workspace=os.environ.get("ENVIRONMENT", "dev"),  # dev, staging, prod
)
def generate_summary(document: str) -> str:
    ...
```

### Don't wrap everything at once

It's better to have 3 well-instrumented call paths than 30 poorly-estimated ones. Start with the calls that matter most.

## Next steps

- [Shadow Mode Rollout](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) — full guide to safe rollout
- [Cost Estimation Cheat Sheet](/how-to/cost-estimation-cheat-sheet) — how much to reserve per model
- [Choosing the Right Integration Pattern](/how-to/choosing-the-right-integration-pattern) — decorator vs programmatic vs middleware
- [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) — what to do when budget is denied
