<script setup>
/**
 * NetworkZones — public / DMZ / internal network separation diagram.
 * Used in security-hardening.md and security.md.
 * Shows: Public (Your App) → DMZ (Load Balancer, TLS) → Internal (all Cycles services + Redis)
 */
</script>

<template>
  <div class="nz-diagram" role="img" aria-label="Network zone separation: your application on the public network connects through a load balancer in the DMZ. All Cycles services and Redis are on the internal network only.">
    <!-- Public zone -->
    <div class="nz-zone nz-public">
      <span class="nz-zone-label">Public Network</span>
      <div class="nz-flow">
        <span class="nz-node">Your App</span>
      </div>
    </div>

    <div class="nz-connector">
      <div class="nz-line"></div>
      <span class="nz-connector-label">HTTPS (443)</span>
    </div>

    <!-- DMZ -->
    <div class="nz-zone nz-dmz">
      <span class="nz-zone-label">DMZ / Edge</span>
      <div class="nz-flow">
        <span class="nz-node">Load Balancer</span>
        <span class="nz-note">TLS termination · proxies to internal Cycles Server</span>
      </div>
    </div>

    <div class="nz-connector">
      <div class="nz-line"></div>
      <span class="nz-connector-label">HTTP (7878) · internal only</span>
    </div>

    <!-- Internal zone -->
    <div class="nz-zone nz-internal">
      <span class="nz-zone-label">Internal / VPN Only</span>
      <div class="nz-items">
        <div class="nz-flow">
          <span class="nz-node nz-branded">Cycles Server :7878</span>
          <span class="nz-note">Runtime enforcement</span>
        </div>
        <div class="nz-flow">
          <span class="nz-node nz-branded">Admin Server :7979</span>
          <span class="nz-note">Operators / CI only</span>
        </div>
        <div class="nz-flow">
          <span class="nz-node nz-branded">Events Service :7980</span>
          <span class="nz-arrow">→</span>
          <span class="nz-node nz-external">Webhooks (outbound HTTPS)</span>
        </div>
        <div class="nz-flow">
          <span class="nz-node nz-data">Redis :6379</span>
          <span class="nz-note">Shared by all services</span>
        </div>
      </div>
    </div>

    <div class="visually-hidden">
      Network zone separation for Cycles production deployment — three zones:
      1. Public network: Your application lives here. It connects to the load balancer via HTTPS (port 443). No Cycles service is directly accessible from the public network.
      2. DMZ / Edge: The load balancer terminates TLS and proxies traffic to the Cycles Server on the internal network (HTTP, port 7878). The load balancer is the only component with a public-facing port.
      3. Internal / VPN only: ALL Cycles services run here. Cycles Server (port 7878, runtime enforcement), Admin Server (port 7979, operators and CI/CD only), Events Service (port 7980, delivers webhooks outbound via HTTPS), and Redis (port 6379, shared by all services). None of these should be accessible from the public internet. The Admin Server is accessible only via VPN or internal network. The Events Service requires no inbound traffic — it only makes outbound HTTP calls to webhook endpoints.
    </div>
  </div>
</template>

<style scoped>
.nz-diagram {
  display: flex;
  flex-direction: column;
  gap: 0;
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

.nz-dmz {
  border: 1px solid var(--vp-c-yellow-1);
  background: var(--vp-c-yellow-soft);
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

.nz-dmz .nz-zone-label {
  color: var(--vp-c-yellow-1);
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

.nz-note {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-style: italic;
}

.nz-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
}

.nz-line {
  width: 2px;
  height: 16px;
  background: var(--vp-c-divider);
}

.nz-connector-label {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}

@media (max-width: 480px) {
  .nz-node { font-size: 12px; padding: 3px 8px; }
  .nz-flow { gap: 4px; }
}
</style>
