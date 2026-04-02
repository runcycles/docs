<script setup>
/**
 * NetworkTopology — recommended network architecture for production operations.
 * Shows: Load Balancer → Cycles Server (HA) + Admin Server (internal) → shared Redis
 */
</script>

<template>
  <div class="net-diagram" role="img" aria-label="Recommended network topology: Load balancer fronts multiple Cycles Server instances, Admin Server on internal network, both backed by a single shared Redis instance">
    <!-- Load Balancer -->
    <div class="net-box net-lb">
      <span class="net-label">Load Balancer</span>
      <span class="net-sub">Port 7878 · Application traffic</span>
      <span class="net-zone-tag">Runtime plane</span>
    </div>

    <div class="net-connector">
      <div class="net-line"></div>
    </div>

    <!-- Server + Admin row -->
    <div class="net-row">
      <div class="net-box net-server">
        <span class="net-label">Cycles Server</span>
        <span class="net-sub">Multiple instances for HA</span>
        <span class="net-note">Stateless — all state in Redis</span>
        <span class="net-zone-tag">Runtime plane</span>
      </div>
      <div class="net-box net-admin">
        <span class="net-label">Admin Server</span>
        <span class="net-sub">Port 7979 · Internal/VPN only</span>
        <span class="net-note">Management plane</span>
        <span class="net-zone-tag net-zone-tag--internal">Management plane</span>
      </div>
    </div>

    <div class="net-connector">
      <div class="net-line"></div>
      <span class="net-connector-label">Both connect to the same instance</span>
    </div>

    <!-- Single shared Redis -->
    <div class="net-box net-redis">
      <span class="net-label">Redis 7+</span>
      <span class="net-sub">Single shared instance (or Redis Cluster) · Port 6379 · Internal network only</span>
    </div>

    <div class="visually-hidden">
      Recommended network topology for Cycles production deployment:
      1. Load Balancer (port 7878) receives application traffic and distributes to multiple Cycles Server instances for high availability. This is the runtime plane — app-facing and horizontally scalable.
      2. Cycles Server (port 7878, runtime enforcement) and Cycles Admin Server (port 7979, management plane, internal/VPN only) run side by side. The server is stateless — all state lives in Redis.
      3. Both the Cycles Server and Admin Server connect to the SAME shared Redis 7+ instance (or Redis Cluster) on port 6379. Redis is on the internal network only — never exposed directly.
      Key rules: Cycles Server (port 7878) — accessible to your application, can be behind an API gateway. Admin Server (port 7979) — internal access only, never expose to public internet. Redis (port 6379) — internal access only, never expose directly. All three share one Redis instance.
    </div>
  </div>
</template>

<style scoped>
.net-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 24px 0;
  max-width: 600px;
}

.net-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  width: 100%;
  text-align: center;
}

.net-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.net-sub {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.net-note {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-style: italic;
}

.net-zone-tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 4px;
  padding: 1px 8px;
  margin-top: 4px;
}

.net-zone-tag--internal {
  color: var(--vp-c-text-3);
  border-color: var(--vp-c-divider);
}

.net-server {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.net-server .net-label {
  color: var(--vp-c-brand-1);
}

.net-admin {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.net-admin .net-label {
  color: var(--vp-c-brand-1);
}

.net-redis {
  border-style: dashed;
}

.net-lb {
  background: var(--vp-c-bg-soft);
}

.net-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.net-row .net-box {
  flex: 1;
}

.net-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
}

.net-line {
  width: 2px;
  height: 20px;
  background: var(--vp-c-divider);
}

.net-connector-label {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

@media (max-width: 480px) {
  .net-row { flex-direction: column; }
}
</style>
