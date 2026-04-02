<script setup>
/**
 * EventFlowDiagram — webhook/event pipeline for the webhooks-and-events concept page.
 * Shows: Admin + Runtime servers → Redis → Events Service → HTTP POST
 */
</script>

<template>
  <div class="ef-diagram" role="img" aria-label="Event flow: Admin and Runtime servers write events to Redis, Events Service consumes via BRPOP and delivers webhooks via HTTP POST">
    <!-- Source row -->
    <div class="ef-row">
      <div class="ef-box ef-server">
        <span class="ef-label">Admin Server</span>
        <span class="ef-sub">CRUD operations</span>
      </div>
      <div class="ef-box ef-server">
        <span class="ef-label">Runtime Server</span>
        <span class="ef-sub">reserve / commit</span>
      </div>
    </div>

    <div class="ef-connector">
      <div class="ef-line"></div>
      <span class="ef-connector-label">event:{id} + delivery:{id} + LPUSH dispatch:pending</span>
    </div>

    <!-- Redis -->
    <div class="ef-box ef-redis">
      <span class="ef-label">Redis</span>
      <span class="ef-sub">dispatch:pending queue</span>
    </div>

    <div class="ef-connector">
      <div class="ef-line"></div>
      <span class="ef-connector-label">BRPOP</span>
    </div>

    <!-- Events Service -->
    <div class="ef-box ef-events">
      <span class="ef-label">Cycles Events Service</span>
      <span class="ef-sub">Port 7980</span>
    </div>

    <div class="ef-connector">
      <div class="ef-line"></div>
      <span class="ef-connector-label">HTTP POST + X-Cycles-Signature</span>
    </div>

    <!-- Webhooks -->
    <div class="ef-box ef-external">
      <span class="ef-label">Your Webhook Endpoint</span>
    </div>

    <div class="visually-hidden">
      Event flow architecture:
      1. Both the Admin Server (CRUD operations) and Runtime Server (reserve/commit) write events to Redis. Each event creates an event:{id} record, a delivery:{id} record, and is pushed to the dispatch:pending queue via LPUSH.
      2. Redis holds the dispatch:pending queue.
      3. The Cycles Events Service (port 7980) consumes events via BRPOP from the dispatch:pending queue.
      4. The Events Service delivers webhooks via HTTP POST with X-Cycles-Signature header to your webhook endpoint.
      The events service is optional. If not deployed, events accumulate in Redis with TTL and are delivered when the service starts.
    </div>
  </div>
</template>

<style scoped>
.ef-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 24px 0;
  max-width: 500px;
}

.ef-box {
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

.ef-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.ef-sub {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.ef-server {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.ef-server .ef-label {
  color: var(--vp-c-brand-1);
}

.ef-events {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.ef-events .ef-label {
  color: var(--vp-c-brand-1);
}

.ef-redis {
  border-style: dashed;
}

.ef-external {
  border-style: dotted;
  background: transparent;
}

.ef-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.ef-row .ef-box {
  flex: 1;
}

.ef-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
}

.ef-line {
  width: 2px;
  height: 20px;
  background: var(--vp-c-divider);
}

.ef-connector-label {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  text-align: center;
}

@media (max-width: 480px) {
  .ef-row { flex-direction: column; }
  .ef-connector-label { font-size: 10px; }
}
</style>
