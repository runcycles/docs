<script setup>
/**
 * NetworkZones — public vs internal network separation diagram.
 * Used in security-hardening.md and security.md.
 * Shows: Public (App → LB → Server:7878) vs Internal (Admin:7979, Events:7980, Redis:6379)
 */
</script>

<template>
  <div class="nz-diagram" role="img" aria-label="Network zone separation: public network for application traffic to Cycles Server, internal network for Admin Server, Events Service, and Redis">
    <!-- Public zone -->
    <div class="nz-zone nz-public">
      <span class="nz-zone-label">Public Network</span>
      <div class="nz-flow">
        <span class="nz-node">Your App</span>
        <span class="nz-arrow">→</span>
        <span class="nz-node">Load Balancer</span>
        <span class="nz-arrow">→</span>
        <span class="nz-node nz-branded">Cycles Server :7878</span>
      </div>
    </div>

    <!-- Internal zone -->
    <div class="nz-zone nz-internal">
      <span class="nz-zone-label">Internal / VPN Only</span>
      <div class="nz-items">
        <div class="nz-flow">
          <span class="nz-node">Admin UI</span>
          <span class="nz-arrow">→</span>
          <span class="nz-node nz-branded">Admin Server :7979</span>
        </div>
        <div class="nz-flow">
          <span class="nz-node nz-branded">Events Service :7980</span>
          <span class="nz-arrow">→</span>
          <span class="nz-node nz-external">Webhooks (outbound)</span>
        </div>
        <div class="nz-flow">
          <span class="nz-node nz-data">Redis :6379</span>
        </div>
      </div>
    </div>

    <div class="visually-hidden">
      Network zone separation for Cycles production deployment:
      Public network: Your application connects through a load balancer to the Cycles Server on port 7878. This is the only component accessible from the public network.
      Internal / VPN only: The Admin Server (port 7979) is accessible only to the operations team via VPN or internal network. The Events Service (port 7980) is internal only — it consumes from Redis and delivers webhooks outbound to external endpoints. Redis (port 6379) is internal only — never exposed directly. The Admin Server, Events Service, and Redis should never be accessible from the public internet.
    </div>
  </div>
</template>

<style scoped>
.nz-diagram {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 24px 0;
  max-width: 580px;
}

.nz-zone {
  border-radius: 8px;
  padding: 14px 16px;
}

.nz-public {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.nz-internal {
  border: 2px dashed var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.nz-zone-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
  margin-bottom: 10px;
}

.nz-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nz-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nz-node {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 4px 10px;
  white-space: nowrap;
}

.nz-branded {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.nz-data {
  border-style: dashed;
}

.nz-external {
  border-style: dotted;
  color: var(--vp-c-text-2);
}

.nz-arrow {
  color: var(--vp-c-text-3);
  font-size: 16px;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .nz-node { font-size: 12px; padding: 3px 8px; }
  .nz-flow { gap: 4px; }
}
</style>
