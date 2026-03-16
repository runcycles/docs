---
title: "Retry Storms and Idempotency Failures"
description: "How retry loops without idempotency create unbounded spend, and how Cycles budget enforcement prevents this failure mode."
---

# Retry Storms and Idempotency Failures

A common failure mode in autonomous systems where retry logic multiplies cost without bound.

## The incident

An application retries failed LLM calls with exponential backoff. Each retry creates a new reservation and makes a new LLM call. When the underlying issue is transient (network blip, rate limit), retries work as intended. But when the issue is persistent (bad prompt causing errors, model returning incomplete responses that trigger re-processing), the retry loop creates unbounded spend.

### Example

An agent processes documents. When the model returns a response that fails validation, the agent retries with a modified prompt:

```python
def process_document(doc):
    for attempt in range(10):
        response = call_llm(f"Process this document: {doc}")
        if validate(response):
            return response
        # Retry with more context
        doc = doc + f"\n\nPrevious attempt failed validation. Try again."
```

Each retry calls the LLM again. With 10 retries at $0.05 per call, a single document costs $0.50 instead of $0.05. Across 1,000 documents, this turns a $50 batch into $500.

### Without Cycles

The retry loop runs all 10 attempts for every document. There's no mechanism to stop retrying when the total cost exceeds a threshold. Rate limiters don't help — each retry is a valid individual request.

### With Cycles

Each LLM call reserves budget before executing:

```python
@cycles(estimate=5000000, action_kind="llm.completion", action_name="gpt-4o")
def call_llm_guarded(prompt: str) -> str:
    return call_llm(prompt)

def process_document(doc):
    for attempt in range(10):
        try:
            response = call_llm_guarded(f"Process this document: {doc}")
            if validate(response):
                return response
        except BudgetExceededError:
            return "Document processing stopped: budget limit reached."
```

When total spend across all retries hits the budget limit, further attempts are denied immediately — no LLM call is made.

## Key points

- **Retries are individually valid requests.** Rate limiters can't distinguish retry #1 from retry #10.
- **Idempotency prevents double-counting.** If you use the same idempotency key for retries of the same operation, Cycles returns the original response without re-reserving. Use unique keys only for genuinely different operations.
- **Budget is the aggregate control.** Individual retries may be cheap, but their sum can be expensive. Cycles tracks the cumulative total.

## Idempotency gotcha

If your retry uses the **same idempotency key** with a **different payload** (because the prompt changed), you'll get `IDEMPOTENCY_MISMATCH`. This is correct — Cycles is telling you that this is a new operation, not a retry of the same one. Use a new idempotency key:

```python
idempotency_key = f"doc-{doc_id}-attempt-{attempt}"
```

## Prevention strategies

1. **Per-document or per-task budget.** Create a workflow-scoped budget for each document or task. Retries share the same budget pool.
2. **Cap retries with budget checks.** Before each retry, use `decide` to check if budget is available without reserving.
3. **Track retry cost separately.** Use the `metrics` field on commit to tag retries, so you can monitor retry cost ratios.

## Next steps

- [Idempotency, Retries and Concurrency](/concepts/idempotency-retries-and-concurrency-why-cycles-is-built-for-real-failure-modes) — how Cycles handles retries safely
- [Error Codes and Error Handling](/protocol/error-codes-and-error-handling-in-cycles) — understanding IDEMPOTENCY_MISMATCH
- [Runaway Agents and Tool Loops](/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent) — the broader runaway agent problem
