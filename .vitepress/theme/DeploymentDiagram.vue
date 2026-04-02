<script setup>
/**
 * DeploymentDiagram — deployment topology for the Architecture Overview page.
 * Shows: Multiple agents → Cycles Server + Admin → Redis → Events → Webhooks
 */
const agents = [
  { name: 'Agent A', sub: 'Spring' },
  { name: 'Agent B', sub: 'Python' },
  { name: 'Agent C', sub: 'Node.js' },
  { name: 'Agent D', sub: 'HTTP' },
  { name: 'Agent E', sub: 'MCP' },
]
</script>

<template>
  <div class="deploy-diagram" role="img" aria-label="Cycles deployment topology: multiple agents connect to stateless Cycles servers backed by Redis, with optional Events Service for webhooks">
    <!-- Agent row -->
    <div class="deploy-agents">
      <div v-for="agent in agents" :key="agent.name" class="deploy-agent">
        <span class="deploy-agent-name">{{ agent.name }}</span>
        <span class="deploy-agent-sub">{{ agent.sub }}</span>
      </div>
    </div>

    <div class="deploy-connector">
      <div class="deploy-line"></div>
      <span class="deploy-connector-label">HTTP · X-Cycles-API-Key</span>
    </div>

    <!-- Server row -->
    <div class="deploy-row">
      <div class="deploy-box deploy-server">
        <span class="deploy-label">Cycles Server</span>
        <span class="deploy-sub">One or more instances · Port 7878</span>
        <span class="deploy-note">Stateless — all state in Redis</span>
      </div>
      <div class="deploy-box deploy-server">
        <span class="deploy-label">Cycles Admin Server</span>
        <span class="deploy-sub">Internal network · Port 7979</span>
        <span class="deploy-note">Operators and CI/CD only</span>
      </div>
    </div>

    <div class="deploy-connector">
      <div class="deploy-line"></div>
    </div>

    <!-- Redis -->
    <div class="deploy-box deploy-data">
      <span class="deploy-label">Redis 7+</span>
      <span class="deploy-sub">Single instance or Redis Cluster</span>
    </div>

    <div class="deploy-connector">
      <div class="deploy-line"></div>
    </div>

    <!-- Events + Webhooks row -->
    <div class="deploy-row">
      <div class="deploy-box deploy-events">
        <span class="deploy-label">Cycles Events Service</span>
        <span class="deploy-sub">Optional · Port 7980</span>
      </div>
      <div class="deploy-arrow">→</div>
      <div class="deploy-box deploy-external">
        <span class="deploy-label">Webhook Endpoints</span>
        <span class="deploy-sub">PagerDuty · Slack · your app</span>
      </div>
    </div>

    <div class="visually-hidden">
      Cycles deployment topology — vertical flow:
      1. Multiple agents connect in parallel: Agent A (Spring), Agent B (Python), Agent C (Node.js), Agent D (HTTP), Agent E (MCP). All connect via HTTP with X-Cycles-API-Key.
      2. Cycles Server (one or more stateless instances, port 7878) and Cycles Admin Server (internal network only, port 7979) run side by side. The server is stateless — all state lives in Redis.
      3. Redis 7+ (single instance or Redis Cluster) stores all budget state.
      4. Cycles Events Service (optional, port 7980) consumes delivery jobs from Redis and delivers webhooks with HMAC-SHA256 signatures to external endpoints (PagerDuty, Slack, your app).
      Non-Spring clients use the protocol directly via HTTP. MCP-compatible agents (Claude Desktop, Claude Code, Cursor, Windsurf) use the Cycles MCP Server for zero-code integration.
    </div>
  </div>
</template>

<style scoped>
.deploy-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 24px 0;
  max-width: 700px;
}

.deploy-agents {
  display: flex;
  gap: 8px;
  width: 100%;
}

.deploy-agent {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 10px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  text-align: center;
}

.deploy-agent-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.deploy-agent-sub {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.deploy-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  width: 100%;
  text-align: center;
}

.deploy-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.deploy-sub {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.deploy-note {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-style: italic;
}

.deploy-server {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.deploy-server .deploy-label {
  color: var(--vp-c-brand-1);
}

.deploy-events {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.deploy-events .deploy-label {
  color: var(--vp-c-brand-1);
}

.deploy-data {
  border-style: dashed;
}

.deploy-external {
  border-style: dotted;
  background: transparent;
}

.deploy-row {
  display: flex;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.deploy-row .deploy-box {
  flex: 1;
}

.deploy-arrow {
  font-size: 20px;
  color: var(--vp-c-text-3);
  flex-shrink: 0;
}

.deploy-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
}

.deploy-line {
  width: 2px;
  height: 20px;
  background: var(--vp-c-divider);
}

.deploy-connector-label {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  white-space: nowrap;
}

@media (max-width: 580px) {
  .deploy-agents {
    flex-wrap: wrap;
  }
  .deploy-agent {
    flex: 0 0 calc(33% - 6px);
  }
  .deploy-row {
    flex-direction: column;
  }
  .deploy-arrow {
    transform: rotate(90deg);
  }
}
</style>
