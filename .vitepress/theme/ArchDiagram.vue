<script setup>
/**
 * ArchDiagram — simplified architecture diagram for "What is Cycles?" page.
 * Shows: Your Application → Cycles Server + Admin → Redis → Events Service
 */
</script>

<template>
  <div class="arch-diagram" role="img" aria-label="Cycles architecture: Application connects to Server and Admin, both backed by Redis, with optional Events Service">
    <!-- Your Application -->
    <div class="arch-box arch-app">
      <span class="arch-label">Your Application</span>
      <span class="arch-sub">@cycles / withCycles / MCP</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">HTTP (port 7878) · X-Cycles-API-Key</span>
    </div>

    <!-- Server row -->
    <div class="arch-row">
      <div class="arch-box arch-server">
        <span class="arch-label">Cycles Server</span>
        <span class="arch-sub">Runtime enforcement · Port 7878</span>
      </div>
      <div class="arch-box arch-admin">
        <span class="arch-label">Cycles Admin Server</span>
        <span class="arch-sub">Tenants / budgets / keys · Port 7979</span>
      </div>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
    </div>

    <!-- Redis -->
    <div class="arch-box arch-redis">
      <span class="arch-label">Redis 7+</span>
      <span class="arch-sub">Budget state · reservations · tenants · audit logs</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">BRPOP</span>
    </div>

    <!-- Events -->
    <div class="arch-box arch-events">
      <span class="arch-label">Cycles Events Service</span>
      <span class="arch-sub">Webhooks (optional) · Port 7980</span>
    </div>

    <div class="visually-hidden">
      Cycles architecture diagram — vertical flow:
      1. Your Application (@cycles / withCycles / MCP) connects via HTTP on port 7878 with X-Cycles-API-Key.
      2. Cycles Server (port 7878, runtime budget enforcement) and Cycles Admin Server (port 7979, tenant/budget/key management) run side by side.
      3. Both connect to Redis 7+ which stores budget state, reservations, tenants, and audit logs.
      4. Redis feeds the Cycles Events Service (port 7980, optional) via BRPOP for async webhook delivery.
    </div>
  </div>
</template>

<style scoped>
.arch-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 24px 0;
  max-width: 600px;
}

.arch-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  width: 100%;
  text-align: center;
}

.arch-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.arch-sub {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.arch-app {
  background: var(--vp-c-bg-soft);
}

.arch-server {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.arch-server .arch-label {
  color: var(--vp-c-brand-1);
}

.arch-admin {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.arch-admin .arch-label {
  color: var(--vp-c-brand-1);
}

.arch-redis {
  border-style: dashed;
}

.arch-events {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.arch-events .arch-label {
  color: var(--vp-c-brand-1);
}

.arch-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.arch-row .arch-box {
  flex: 1;
}

.arch-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
}

.arch-line {
  width: 2px;
  height: 20px;
  background: var(--vp-c-divider);
}

.arch-connector-label {
  font-size: 11px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

@media (max-width: 480px) {
  .arch-row {
    flex-direction: column;
  }
  .arch-label { font-size: 13px; }
  .arch-sub { font-size: 11px; }
}
</style>
