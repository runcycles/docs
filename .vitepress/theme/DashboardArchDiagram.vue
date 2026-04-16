<script setup>
/**
 * DashboardArchDiagram — architecture of the Cycles Admin Dashboard.
 * Shows: Browser → TLS Proxy → Dashboard nginx → (split) cycles-admin + cycles-server → Redis
 *
 * The split is the key point: /v1/reservations* goes to the runtime server,
 * everything else goes to the admin server. Both share Redis.
 */
</script>

<template>
  <div class="arch-diagram" role="img" aria-label="Cycles Admin Dashboard architecture: browser connects via TLS proxy to the dashboard's nginx, which splits /v1/reservations* to cycles-server and everything else to cycles-admin, both backed by Redis">
    <!-- Browser -->
    <div class="arch-box arch-client">
      <span class="arch-label">Browser</span>
      <span class="arch-sub">Operator session · X-Admin-API-Key</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">HTTPS (443)</span>
    </div>

    <!-- TLS proxy -->
    <div class="arch-box arch-tls">
      <span class="arch-label">TLS Proxy</span>
      <span class="arch-sub">Caddy / ALB · auto-HTTPS</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">HTTP (80)</span>
    </div>

    <!-- Dashboard nginx -->
    <div class="arch-box arch-dashboard">
      <span class="arch-label">Dashboard</span>
      <span class="arch-sub">nginx:80 · static SPA · reverse proxies /v1/*</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">/v1/ proxy split</span>
    </div>

    <!-- Backend row: admin + runtime -->
    <div class="arch-row">
      <div class="arch-branch">
        <span class="arch-branch-label">/v1/* (default)</span>
        <div class="arch-box arch-admin">
          <span class="arch-label">cycles-admin</span>
          <span class="arch-sub">:7979 · governance plane</span>
          <span class="arch-detail">tenants · budgets · policies · webhooks · events · audit · API keys</span>
        </div>
      </div>
      <div class="arch-branch">
        <span class="arch-branch-label arch-branch-label-runtime">/v1/reservations*</span>
        <div class="arch-box arch-server">
          <span class="arch-label">cycles-server</span>
          <span class="arch-sub">:7878 · runtime plane</span>
          <span class="arch-detail">force-release during incidents (admin-on-behalf-of)</span>
        </div>
      </div>
    </div>

    <div class="arch-connector">
      <div class="arch-line arch-line-double"></div>
    </div>

    <!-- Redis -->
    <div class="arch-box arch-redis">
      <span class="arch-label">Redis 7+</span>
      <span class="arch-sub">:6379 · shared state</span>
    </div>

    <div class="visually-hidden">
      Dashboard architecture — vertical flow:
      1. Operator browser connects over HTTPS (port 443) to the TLS proxy (Caddy or ALB).
      2. TLS proxy forwards HTTP to the Dashboard nginx (port 80) which serves the static SPA and reverse-proxies /v1/* API calls.
      3. Dashboard nginx splits /v1/ traffic two ways:
         - /v1/* (default — tenants, budgets, policies, webhooks, events, audit, API keys) goes to cycles-admin on port 7979 (governance plane).
         - /v1/reservations* (force-release during incidents, admin-on-behalf-of) goes to cycles-server on port 7878 (runtime plane).
      4. Both backends share a single Redis 7+ instance on port 6379.
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
  max-width: 700px;
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

.arch-detail {
  font-size: 11px;
  color: var(--vp-c-text-3);
  margin-top: 4px;
  line-height: 1.4;
}

.arch-client {
  background: var(--vp-c-bg-soft);
}

.arch-tls {
  background: var(--vp-c-bg-soft);
}

.arch-dashboard {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.arch-dashboard .arch-label {
  color: var(--vp-c-brand-1);
}

.arch-admin {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.arch-admin .arch-label {
  color: var(--vp-c-brand-1);
}

.arch-server {
  border-color: var(--vp-c-green-1, #16a34a);
  background: var(--vp-c-green-soft, rgba(22, 163, 74, 0.1));
}

.arch-server .arch-label {
  color: var(--vp-c-green-1, #16a34a);
}

.arch-redis {
  border-style: dashed;
}

.arch-row {
  display: flex;
  gap: 12px;
  width: 100%;
  align-items: stretch;
}

.arch-branch {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 6px;
}

.arch-branch .arch-box {
  flex: 1;
}

.arch-branch-label {
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-brand-1);
  text-align: center;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  align-self: center;
}

.arch-branch-label-runtime {
  color: var(--vp-c-green-1, #16a34a);
  background: var(--vp-c-green-soft, rgba(22, 163, 74, 0.1));
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

.arch-line-double {
  height: 28px;
  background: repeating-linear-gradient(
    to bottom,
    var(--vp-c-divider) 0,
    var(--vp-c-divider) 4px,
    transparent 4px,
    transparent 8px
  );
}

.arch-connector-label {
  font-size: 11px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  font-family: var(--vp-font-family-mono);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 480px) {
  .arch-row {
    flex-direction: column;
  }
  .arch-label { font-size: 13px; }
  .arch-sub { font-size: 11px; }
  .arch-detail { font-size: 10px; }
}
</style>
