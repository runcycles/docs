<script setup>
/**
 * NetworkTopology — recommended network architecture for production operations.
 * Shows: Load Balancer → Cycles Server (HA) → Redis ← Admin Server (internal)
 */
</script>

<template>
  <div class="net-diagram" role="img" aria-label="Recommended network topology: Load balancer fronts multiple Cycles Server instances, Admin Server on internal network, both backed by shared Redis">
    <div class="net-row">
      <!-- Public/runtime path -->
      <div class="net-col">
        <div class="net-box net-lb">
          <span class="net-label">Load Balancer</span>
          <span class="net-sub">Port 7878 · Application traffic</span>
        </div>

        <div class="net-connector">
          <div class="net-line"></div>
        </div>

        <div class="net-box net-server">
          <span class="net-label">Cycles Server</span>
          <span class="net-sub">Multiple instances for HA</span>
          <span class="net-note">Stateless — all state in Redis</span>
        </div>

        <div class="net-connector">
          <div class="net-line"></div>
        </div>

        <div class="net-box net-redis">
          <span class="net-label">Redis</span>
          <span class="net-sub">Internal network only</span>
        </div>
      </div>

      <!-- Admin/management path -->
      <div class="net-col">
        <div class="net-box net-admin">
          <span class="net-label">Admin Server</span>
          <span class="net-sub">Port 7979 · Internal/VPN only</span>
          <span class="net-note">Management plane</span>
        </div>

        <div class="net-connector">
          <div class="net-line"></div>
          <span class="net-connector-label">Same Redis instance</span>
        </div>

        <div class="net-box net-redis">
          <span class="net-label">Redis</span>
          <span class="net-sub">Shared instance</span>
        </div>
      </div>
    </div>

    <div class="net-zones">
      <div class="net-zone">
        <span class="net-zone-label">Runtime plane</span>
        <span class="net-zone-desc">App-facing, scalable</span>
      </div>
      <div class="net-zone net-zone--internal">
        <span class="net-zone-label">Management plane</span>
        <span class="net-zone-desc">Internal only, never public</span>
      </div>
    </div>

    <div class="visually-hidden">
      Recommended network topology for Cycles production deployment:
      Runtime plane (application-facing, scalable): Load Balancer (port 7878) receives application traffic and distributes to multiple Cycles Server instances for high availability. The server is stateless — all state lives in Redis. Redis is on the internal network only.
      Management plane (internal only, never public): Cycles Admin Server (port 7979) is accessible only via internal network or VPN. It manages tenants, API keys, and budgets. It connects to the same Redis instance as the runtime servers.
      Key rules: Cycles Server (port 7878) — accessible to your application, can be behind an API gateway. Admin Server (port 7979) — internal access only, never expose to public internet. Redis (port 6379) — internal access only, never expose directly.
    </div>
  </div>
</template>

<style scoped>
.net-diagram {
  margin: 24px 0;
  max-width: 600px;
}

.net-row {
  display: flex;
  gap: 24px;
}

.net-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
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

.net-zones {
  display: flex;
  gap: 24px;
  margin-top: 16px;
}

.net-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px;
  border-top: 2px solid var(--vp-c-brand-1);
}

.net-zone--internal {
  border-top-color: var(--vp-c-divider);
}

.net-zone-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.net-zone-desc {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

@media (max-width: 480px) {
  .net-row { flex-direction: column; gap: 16px; }
  .net-zones { flex-direction: column; gap: 8px; }
}
</style>
