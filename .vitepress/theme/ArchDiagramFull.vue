<script setup>
/**
 * ArchDiagramFull — detailed architecture diagram for the Architecture Overview page.
 * Shows: Application + MCP Host → Cycles Server + Admin → Redis → Events → Webhooks
 */
</script>

<template>
  <div class="arch-full" role="img" aria-label="Full Cycles architecture: Application and MCP Host connect via HTTP to Cycles Server and Admin Server, both backed by Redis with Lua atomicity, feeding the Events Service for webhook delivery">
    <!-- Client row -->
    <div class="arch-row">
      <div class="arch-box arch-client">
        <span class="arch-label">Your Application</span>
        <div class="arch-chips">
          <span class="arch-chip">@Cycles annotation</span>
          <span class="arch-chip">CyclesClient (direct)</span>
        </div>
        <span class="arch-sub">Java Spring, Python, TypeScript, Rust</span>
      </div>
      <div class="arch-box arch-client">
        <span class="arch-label">AI Agent (MCP Host)</span>
        <span class="arch-sub">Claude Desktop / Code / Cursor / Windsurf</span>
        <div class="arch-chips">
          <span class="arch-chip">Cycles MCP Server</span>
        </div>
      </div>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">HTTP (JSON) · X-Cycles-API-Key</span>
    </div>

    <!-- Server row -->
    <div class="arch-row">
      <div class="arch-box arch-server">
        <span class="arch-label">Cycles Server</span>
        <span class="arch-port">Port 7878</span>
        <span class="arch-sub">Runtime budget enforcement</span>
        <div class="arch-chips">
          <span class="arch-chip">REST API</span>
          <span class="arch-chip">Auth Filter (API Key)</span>
        </div>
        <div class="arch-inner">
          <span class="arch-chip arch-chip--accent">RedisReservationRepository</span>
          <span class="arch-sub">Lua scripts for atomicity</span>
        </div>
      </div>
      <div class="arch-box arch-server">
        <span class="arch-label">Cycles Admin Server</span>
        <span class="arch-port">Port 7979</span>
        <span class="arch-sub">Tenant, key, budget management</span>
        <div class="arch-chips">
          <span class="arch-chip">Tenant CRUD</span>
          <span class="arch-chip">API Key Mgmt</span>
          <span class="arch-chip">Budget Ledgers</span>
          <span class="arch-chip">Audit Logs</span>
        </div>
      </div>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
    </div>

    <!-- Redis -->
    <div class="arch-box arch-data">
      <span class="arch-label">Redis 7+</span>
      <span class="arch-sub">Budget state · reservations · tenants · API keys · audit logs</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">BRPOP (dispatch:pending)</span>
    </div>

    <!-- Events -->
    <div class="arch-box arch-events">
      <span class="arch-label">Cycles Events Service</span>
      <span class="arch-port">Port 7980</span>
      <span class="arch-sub">Async webhook delivery · HMAC signing · retry · auto-disable</span>
    </div>

    <div class="arch-connector">
      <div class="arch-line"></div>
      <span class="arch-connector-label">HTTP POST + X-Cycles-Signature</span>
    </div>

    <!-- External -->
    <div class="arch-box arch-external">
      <span class="arch-label">External Webhook Endpoints</span>
      <span class="arch-sub">PagerDuty · Slack · your app</span>
    </div>
  </div>
</template>

<style scoped>
.arch-full {
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
  gap: 4px;
  padding: 14px 16px;
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

.arch-port {
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}

.arch-sub {
  font-size: 12px;
  color: var(--vp-c-text-3);
  line-height: 1.4;
}

.arch-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed var(--vp-c-divider);
  width: 100%;
}

.arch-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
}

.arch-chip {
  font-size: 11px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.arch-chip--accent {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
}

.arch-server {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.arch-server .arch-label {
  color: var(--vp-c-brand-1);
}

.arch-data {
  border-style: dashed;
}

.arch-events {
  border-style: dashed;
}

.arch-external {
  border-style: dotted;
  background: transparent;
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
  font-family: var(--vp-font-family-mono);
  white-space: nowrap;
}

@media (max-width: 580px) {
  .arch-row {
    flex-direction: column;
  }
  .arch-label { font-size: 13px; }
  .arch-sub { font-size: 11px; }
  .arch-chip { font-size: 10px; }
}
</style>
