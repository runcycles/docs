# Debt, Overdraft, and the Over-Limit Model in Cycles

Budget enforcement in Cycles is designed to prevent unbounded execution.

But real systems sometimes cross budget boundaries.

A model call may cost more than expected.
A retry may push actual usage past the reserved amount.
Concurrent commits may collectively exceed available budget.

When this happens, the system needs a clear model for what occurred, how much debt exists, and when normal operation can resume.

That is what the debt and overdraft model provides.

## The problem: what happens when actuals exceed budget?

In a strict system, any overage is rejected. The commit fails.

That is the default behavior in Cycles (overage policy `REJECT`).

But sometimes the work has already happened. The model call returned. The tool executed. The side effect occurred.

Rejecting the commit at that point does not undo the work. It just creates an unaccounted gap in the ledger.

The overdraft model solves this by allowing the system to record what actually happened, even when budget is insufficient, while clearly marking the resulting debt.

## How overdraft works

When a commit or event uses the `ALLOW_WITH_OVERDRAFT` overage policy and the actual amount exceeds available budget:

1. The server checks whether `(current_debt + delta) <= overdraft_limit` for each affected scope
2. If yes: the commit succeeds, the delta is added to debt, and remaining can go negative
3. If no: the commit is rejected with `409 OVERDRAFT_LIMIT_EXCEEDED`

This means the system can absorb overages up to a defined limit, then stops.

## Key concepts

### debt

Debt represents actual consumption that occurred when insufficient budget was available.

It is a real number in the balance ledger. It is not theoretical. It reflects work that happened and was accounted for, even though budget did not fully cover it.

### overdraft_limit

The overdraft limit defines the maximum debt a scope is allowed to accumulate.

If the limit is 10,000 units, the scope can absorb up to 10,000 units of debt before further overages are rejected.

If the limit is absent or zero, no overdraft is permitted (the scope behaves as if using `ALLOW_IF_AVAILABLE`).

### is_over_limit

When debt exceeds the overdraft limit — typically due to concurrent commits — the scope enters an over-limit state.

In this state:

- `is_over_limit` is `true` on the balance
- all new reservations against that scope are rejected with `409 OVERDRAFT_LIMIT_EXCEEDED`
- existing active reservations can still be committed or released normally

The scope remains blocked until debt is repaid below the overdraft limit.

### remaining (can be negative)

In Cycles, the `remaining` balance uses a `SignedAmount` — it can go negative.

A negative remaining means the scope has consumed more than its allocated budget. This is only possible when overdraft is enabled.

The formula is: `remaining = allocated - spent - reserved - debt`

## How concurrent commits create over-limit state

The overdraft limit check is per-commit, not atomic across concurrent commits.

Consider this scenario:

- Scope has overdraft_limit = 5,000
- Current debt = 0
- Two concurrent commits each need 4,000 in overage

Each commit individually checks: `(0 + 4,000) <= 5,000` → passes.

Both commits succeed. But now debt = 8,000, which exceeds overdraft_limit = 5,000.

The scope enters over-limit state.

This is by design. The commits represent work that already happened. Rejecting them would create unaccounted gaps. Instead, the system records the reality and blocks future work until the situation is resolved.

## What happens when a scope is over-limit

When `is_over_limit` is true:

1. **New reservations are blocked.** Any attempt to reserve against the scope returns `409 OVERDRAFT_LIMIT_EXCEEDED`.

2. **Existing reservations can be finalized.** Active reservations can still be committed or released. This prevents in-flight work from being stranded.

3. **Decide returns DENY.** The decide endpoint returns `DENY` with an appropriate reason code instead of a 409 error.

4. **The block is automatic.** No operator action is needed to enforce the block — it is protocol-level.

5. **Recovery is through funding.** The scope is unblocked when debt is repaid below the overdraft limit through budget funding operations (which are outside the scope of the v0 protocol).

## Debt vs budget denial

These are different situations:

**Budget denial** (`BUDGET_EXCEEDED`): the scope has no remaining budget and the overage policy is `REJECT` or `ALLOW_IF_AVAILABLE`. The commit or reservation is refused. No debt is created.

**Debt creation** (`ALLOW_WITH_OVERDRAFT`): the scope has insufficient budget, but the overage policy allows debt. The commit succeeds, debt is recorded, and the ledger reflects reality.

**Over-limit block** (`OVERDRAFT_LIMIT_EXCEEDED`): debt has exceeded the overdraft limit. Future reservations are blocked until debt is repaid.

**Outstanding debt block** (`DEBT_OUTSTANDING`): debt exists (even if below overdraft limit). New reservations are blocked because the scope has unresolved debt.

## When to use overdraft

Overdraft is most useful when:

- the cost of unaccounted work is worse than the cost of debt
- model calls and tool actions cannot be undone after execution
- the system needs accurate ledger state even under budget pressure
- concurrent execution makes strict pre-commit enforcement impractical
- operators prefer to reconcile debt after the fact rather than lose ledger accuracy

## When not to use overdraft

Overdraft is less appropriate when:

- strict budget enforcement is required (use `REJECT`)
- the system should never exceed allocated budget under any circumstances
- debt reconciliation processes are not in place
- the team prefers hard stops over post-hoc resolution

## Monitoring over-limit state

The spec recommends operators monitor over-limit scopes with:

- **Dashboard** showing scopes where `is_over_limit` is true
- **Warning alerts** when debt reaches 80% of overdraft_limit
- **Critical alerts** when debt exceeds 100% (over-limit state)
- **Metrics** tracking `debt_utilization = debt / overdraft_limit`

The recommended operator runbook:

1. Investigate which commits caused the over-limit state
2. Determine whether the overdraft limit should increase (normal variance) or whether this is anomalous (incident)
3. Fund the scope to repay debt below the limit
4. Monitor that `is_over_limit` returns to false
5. Operations resume automatically

## Summary

The debt and overdraft model in Cycles provides a controlled way to handle budget overages in real production systems.

Instead of choosing between "reject everything" and "allow everything," teams can define an overdraft limit that absorbs reasonable overages while blocking new work when debt becomes excessive.

The key mechanisms:

- **overdraft_limit** defines how much debt a scope can tolerate
- **debt** records actual consumption beyond available budget
- **is_over_limit** blocks new reservations when debt exceeds the limit
- **recovery** happens through budget funding, which is outside the v0 protocol scope

This gives teams accurate ledger state, bounded risk, and a clear path to resolution.

## Next steps

To explore the Cycles stack:

- Read the [Cycles Protocol](https://github.com/runcycles/cycles-protocol)
- Run the [Cycles Server](https://github.com/runcycles/cycles-server)
- Manage budgets with [Cycles Admin](https://github.com/runcycles/cycles-server-admin)
- Integrate with Spring AI using the [Spring Client](https://github.com/runcycles/cycles-spring-boot-starter)
