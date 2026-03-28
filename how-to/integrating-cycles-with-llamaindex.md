---
title: "Integrating Cycles with LlamaIndex"
description: "Guard LlamaIndex RAG queries with Cycles budget reservations for cost-controlled retrieval and generation. Includes Python examples for query engines and retrieval pipelines."
---

# Integrating Cycles with LlamaIndex

This guide shows how to guard LlamaIndex RAG queries with Cycles budget reservations so that every retrieval and generation call is cost-controlled and observable.

## Prerequisites

```bash
pip install runcycles llama-index
```

```bash
export CYCLES_BASE_URL="http://localhost:7878"
export CYCLES_API_KEY="your-api-key"   # create via Admin Server — see note below
export CYCLES_TENANT="acme"
export OPENAI_API_KEY="sk-..."
```

> **Need an API key?** Create one via the Admin Server — see [Deploy the Full Stack](/quickstart/deploying-the-full-cycles-stack#step-3-create-an-api-key) or [API Key Management](/how-to/api-key-management-in-cycles).

::: tip 60-Second Quick Start
```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from runcycles import CyclesClient, CyclesConfig, cycles, set_default_client

set_default_client(CyclesClient(CyclesConfig.from_env()))

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

@cycles(estimate=2_000_000, action_kind="rag.query", action_name="llamaindex-query")
def ask(question: str) -> str:
    response = query_engine.query(question)
    return str(response)

print(ask("What are the key findings?"))
```
Every query is now budget-guarded. If the budget is exhausted, `BudgetExceededError` is raised _before_ the query executes. Read on for production patterns.
:::

## Guarding index queries

Use the `@cycles` decorator to wrap a query engine call with automatic reserve, execute, and commit:

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from runcycles import (
    CyclesClient, CyclesConfig, CyclesMetrics,
    cycles, get_cycles_context, set_default_client, BudgetExceededError,
)

config = CyclesConfig.from_env()
set_default_client(CyclesClient(config))

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

PRICE_PER_INPUT_TOKEN = 250       # $2.50 / 1M tokens
PRICE_PER_OUTPUT_TOKEN = 1_000    # $10.00 / 1M tokens

@cycles(
    estimate=lambda question, **kw: len(question.split()) * 4 * PRICE_PER_INPUT_TOKEN
        + 1024 * PRICE_PER_OUTPUT_TOKEN,
    action_kind="rag.query",
    action_name="llamaindex-query",
    unit="USD_MICROCENTS",
    ttl_ms=120_000,
)
def ask(question: str) -> str:
    response = query_engine.query(question)

    ctx = get_cycles_context()
    if ctx:
        ctx.metrics = CyclesMetrics(model_version="gpt-4o")

    return str(response)
```

## Guarding retrieval and generation separately

For fine-grained cost tracking, decorate the retrieval and generation steps independently:

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.llms import ChatMessage
from llama_index.llms.openai import OpenAI
from runcycles import cycles, get_cycles_context, CyclesMetrics

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
retriever = index.as_retriever(similarity_top_k=5)
llm = OpenAI(model="gpt-4o")

@cycles(estimate=100_000, action_kind="tool.search", action_name="vector-retrieval")
def retrieve(question: str) -> list:
    return retriever.retrieve(question)

@cycles(
    estimate=2_000_000,
    action_kind="llm.completion",
    action_name="gpt-4o",
    unit="USD_MICROCENTS",
)
def generate(question: str, context_nodes: list) -> str:
    context_text = "\n".join(node.get_content() for node in context_nodes)
    prompt = f"Context:\n{context_text}\n\nQuestion: {question}"
    response = llm.chat([ChatMessage(role="user", content=prompt)])

    ctx = get_cycles_context()
    if ctx:
        ctx.metrics = CyclesMetrics(
            tokens_input=response.raw.usage.prompt_tokens,
            tokens_output=response.raw.usage.completion_tokens,
            model_version="gpt-4o",
        )

    return str(response)

# Pipeline: retrieve then generate, each independently budget-guarded
nodes = retrieve("What are the key findings?")
answer = generate("What are the key findings?", nodes)
```

## Cost estimation for RAG pipelines

RAG pipelines involve both retrieval (embedding lookups) and generation (LLM calls). Estimate each stage separately for accuracy:

| Stage | action_kind | Estimation strategy |
|-------|-------------|---------------------|
| Embedding / retrieval | `tool.search` | Flat cost per query (embedding calls are cheap) |
| Generation | `llm.completion` | Input tokens (context + question) + max output tokens |

For production, estimate generation cost based on the retrieved context size:

```python
@cycles(
    estimate=lambda question, context_nodes, **kw: (
        sum(len(n.get_content().split()) for n in context_nodes) * 2 * PRICE_PER_INPUT_TOKEN
        + 1024 * PRICE_PER_OUTPUT_TOKEN
    ),
    action_kind="llm.completion",
    action_name="gpt-4o",
)
def generate_with_context(question: str, context_nodes: list) -> str:
    context_text = "\n".join(node.get_content() for node in context_nodes)
    prompt = f"Context:\n{context_text}\n\nQuestion: {question}"
    return str(llm.chat([ChatMessage(role="user", content=prompt)]))
```

## Error handling

When the budget is insufficient, `BudgetExceededError` is raised **before** the query executes:

```python
from runcycles import BudgetExceededError

try:
    answer = ask("Summarize the entire dataset...")
except BudgetExceededError:
    answer = "Budget limit reached. Please try a shorter query or contact your administrator."
```

For retrieval-then-generation pipelines, handle each step:

```python
try:
    nodes = retrieve(question)
    answer = generate(question, nodes)
except BudgetExceededError:
    answer = "Service temporarily unavailable due to budget limits."
```

See [Degradation Paths](/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer) for patterns like caching, model downgrade, and queueing.

## Key points

- **Wrap any function.** The `@cycles` decorator works on any callable, so LlamaIndex query engines, retrievers, and LLM calls all work out of the box.
- **Split retrieval and generation.** Separate decorators give per-stage cost visibility and independent budget control.
- **Estimate before, commit after.** The `estimate` function determines the reservation; actual cost is committed after execution.
- **The function never executes on DENY.** Neither the retrieval nor the LLM call runs if the budget is exhausted.

## Next steps

- [Error Handling Patterns in Python](/how-to/error-handling-patterns-in-python) — handling budget errors in Python
- [Testing with Cycles](/how-to/testing-with-cycles) — testing budget-guarded code
- [Integrating with LangChain](/how-to/integrating-cycles-with-langchain) — budget governance for LangChain apps
- [Production Operations Guide](/how-to/production-operations-guide) — running Cycles in production
