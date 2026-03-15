# Scope Misconfiguration and Budget Leaks

A failure mode where budget is consumed from unintended scopes due to misconfigured subject fields, or where budget is not properly tracked because scopes don't match.

## The incident

A team sets up per-workspace budgets but their application doesn't consistently pass the `workspace` field in reservations. Some calls include `workspace=prod`, others omit it entirely. The result: calls without a workspace field only check the tenant-level budget, bypassing the workspace limit entirely.

### Example

**Budget setup:**

```
tenant:acme-corp                    → $100/month
tenant:acme-corp/workspace:prod     → $50/month
```

**Application code (inconsistent):**

```python
# Route A: Includes workspace — checks both scopes
@cycles(estimate=2000000, action_kind="llm.completion",
        action_name="gpt-4o", workspace="prod")
def route_a(prompt):
    ...

# Route B: Missing workspace — only checks tenant scope
@cycles(estimate=2000000, action_kind="llm.completion",
        action_name="gpt-4o")
def route_b(prompt):
    ...
```

Route B spends against `tenant:acme-corp` but never touches `tenant:acme-corp/workspace:prod`. The workspace budget appears underutilized while the tenant budget drains from both routes.

## Why this matters

- **Budget bypass.** If the workspace budget is meant to limit production spend, calls that skip the workspace field are unaccounted for at that level.
- **Misleading balances.** The workspace balance report shows less spending than actually occurred. Operators think production is within limits, but the tenant-level budget tells a different story.
- **No enforcement gap.** Cycles enforces exactly what it's told. If the subject doesn't include a scope level, that level is not checked.

## Common misconfiguration patterns

### 1. Inconsistent subject fields across routes

Different code paths construct subjects differently. One team uses `workspace`, another doesn't.

**Fix:** Centralize subject construction:

```python
def build_subject(**overrides):
    return {
        "tenant": os.environ["CYCLES_TENANT"],
        "workspace": os.environ.get("CYCLES_WORKSPACE", "default"),
        **overrides,
    }
```

### 2. Missing budget at intermediate scope levels

Budgets exist at `tenant:acme` and `tenant:acme/workspace:prod/app:chatbot`, but not at `tenant:acme/workspace:prod`. Reservations with all three fields check all three scopes. The missing middle scope has no budget, causing `BUDGET_EXCEEDED`.

**Fix:** Create budgets at every scope level that appears in your subject hierarchy:

```bash
# Create budget at every level
curl -s -X POST .../budgets -d '{"scope": "tenant:acme"}'
curl -s -X POST .../budgets -d '{"scope": "tenant:acme/workspace:prod"}'
curl -s -X POST .../budgets -d '{"scope": "tenant:acme/workspace:prod/app:chatbot"}'
```

### 3. Wrong scope order

Cycles scopes follow a fixed hierarchy: `tenant → workspace → app → workflow → agent → toolset`. Providing fields in a different conceptual mapping (e.g., using `agent` for what's really a workspace concept) causes budget checks against the wrong ledgers.

**Fix:** Map your domain concepts to Cycles scopes consistently. See [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles).

### 4. Typos in scope values

`workspace: "prod"` vs `workspace: "production"` creates two separate scope paths with separate budgets. One gets all the traffic, the other sits unused.

**Fix:** Use constants or enums for scope values, not string literals.

## Detection

### Check for scope inconsistency

Compare the scopes that have budget with the scopes appearing in reservation activity:

```bash
# Budget scopes
curl -s "http://localhost:7878/v1/balances?tenant=acme-corp" \
  -H "X-Cycles-API-Key: $API_KEY" | jq '.[].scope'

# Active reservations show which scopes are being used
curl -s "http://localhost:7878/v1/reservations?tenant=acme-corp&status=ACTIVE" \
  -H "X-Cycles-API-Key: $API_KEY" | jq '.[].subject'
```

If reservations are hitting scopes that don't appear in your budget list, you have a configuration gap.

### Use dry-run mode to audit

Run in [shadow mode](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) to see all the scopes your application actually uses before creating budgets.

## Prevention

1. **Centralize subject construction.** Don't let individual routes build subjects ad hoc.
2. **Use environment variables for common fields.** Tenant, workspace, and app should come from configuration, not hardcoded strings.
3. **Audit scope usage regularly.** Compare active reservation scopes against budget scopes.
4. **Create budgets at all hierarchy levels.** Any scope that appears in a subject needs a budget.
5. **Use shadow mode when adding new scope levels.** Verify the new scopes match before enforcing.

## Next steps

- [Scope Derivation](/protocol/how-scope-derivation-works-in-cycles) — how Cycles builds scope paths from subject fields
- [Budget Allocation and Management](/how-to/budget-allocation-and-management-in-cycles) — creating and funding budgets
- [Shadow Mode Rollout](/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production) — testing scopes without enforcement
