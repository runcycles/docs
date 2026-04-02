<script setup>
/**
 * ScopeDiagram — nested scope hierarchy for "Understanding Tenants, Scopes, and Budgets"
 * Shows: Tenant → Scopes → Budgets as nested containers
 */
</script>

<template>
  <div class="scope-diagram" role="img" aria-label="Cycles hierarchy: Tenant contains Scopes, which contain Budgets">
    <!-- Tenant (outermost) -->
    <div class="scope-box scope-tenant">
      <div class="scope-header">
        <span class="scope-label">Tenant</span>
      </div>
      <p class="scope-desc">The isolation boundary. All operations are scoped to exactly one tenant via the API key.</p>

      <!-- Scopes (middle) -->
      <div class="scope-box scope-scopes">
        <div class="scope-header">
          <span class="scope-label">Scopes</span>
        </div>
        <p class="scope-desc">Hierarchical paths derived from the Subject:</p>
        <div class="scope-paths">
          <code>tenant:acme</code>
          <span class="scope-arrow">→</span>
          <code>tenant:acme/workspace:prod</code>
          <span class="scope-arrow">→</span>
          <code>tenant:acme/workspace:prod/app:chatbot</code>
        </div>

        <!-- Budgets (innermost) -->
        <div class="scope-box scope-budgets">
          <div class="scope-header">
            <span class="scope-label">Budgets</span>
          </div>
          <p class="scope-desc">An allocation at each scope you want to control. Checked atomically on every reservation.</p>
          <div class="scope-allocations">
            <div class="scope-alloc">
              <code>tenant:acme</code>
              <span class="scope-amount">$100 allocated</span>
            </div>
            <div class="scope-alloc">
              <code>tenant:acme/workspace:prod</code>
              <span class="scope-amount">$60 allocated</span>
            </div>
            <div class="scope-alloc">
              <code>tenant:acme/.../app:chatbot</code>
              <span class="scope-amount">$20 allocated</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="scope-caption">Each layer builds on the one above it. Tenants provide isolation. Scopes provide hierarchy within a tenant. Budgets provide enforcement at each scope.</p>
    <div class="visually-hidden">
      Cycles scope hierarchy — three nested layers:
      1. TENANT (outermost) — The isolation boundary. All operations are scoped to exactly one tenant via the API key.
      2. SCOPES (middle) — Hierarchical paths derived from the Subject: tenant:acme → tenant:acme/workspace:prod → tenant:acme/workspace:prod/app:chatbot.
      3. BUDGETS (innermost) — An allocation at each scope you want to control. Checked atomically on every reservation. Example allocations: tenant:acme = $100, tenant:acme/workspace:prod = $60, tenant:acme/workspace:prod/app:chatbot = $20.
      Each layer builds on the one above it. Tenants provide isolation. Scopes provide hierarchy within a tenant. Budgets provide enforcement at each scope.
    </div>
  </div>
</template>

<style scoped>
.scope-diagram {
  margin: 24px 0;
  max-width: 640px;
}

.scope-box {
  border-radius: 8px;
  padding: 16px;
}

.scope-tenant {
  border: 2px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.scope-scopes {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  margin-top: 12px;
}

.scope-budgets {
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  margin-top: 12px;
}

.scope-header {
  margin-bottom: 6px;
}

.scope-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.scope-budgets .scope-label {
  color: var(--vp-c-brand-1);
}

.scope-desc {
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin: 0 0 8px;
  line-height: 1.5;
}

.scope-paths {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.scope-paths code {
  font-size: 12px;
  background: var(--vp-c-bg-soft);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  white-space: nowrap;
}

.scope-arrow {
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.scope-allocations {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scope-alloc {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.scope-alloc code {
  font-size: 12px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-brand-1);
  white-space: nowrap;
}

.scope-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.scope-caption {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 12px 0 0;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .scope-box { padding: 12px; }
  .scope-paths { flex-direction: column; align-items: flex-start; }
  .scope-arrow { display: none; }
  .scope-alloc { flex-direction: column; align-items: flex-start; gap: 2px; }
  .scope-alloc code { font-size: 11px; }
}
</style>
