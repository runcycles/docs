<script setup>
/**
 * DeliveryStateMachine — webhook delivery lifecycle for the webhook protocol page.
 * Shows: PENDING → SUCCESS / RETRYING → SUCCESS / FAILED → subscription DISABLED
 */
const states = [
  { id: 'pending', label: 'PENDING', desc: 'Queued, not yet attempted', type: 'neutral' },
  { id: 'success', label: 'SUCCESS', desc: 'HTTP 2xx received', type: 'success' },
  { id: 'retrying', label: 'RETRYING', desc: 'Failed, retries remain', type: 'warning' },
  { id: 'failed', label: 'FAILED', desc: 'Max retries exceeded', type: 'error' },
  { id: 'disabled', label: 'DISABLED', desc: 'Subscription auto-disabled', type: 'error' },
]
</script>

<template>
  <div class="sm-diagram" role="img" aria-label="Webhook delivery state machine: PENDING to SUCCESS on HTTP 2xx, PENDING to RETRYING on failure, RETRYING to SUCCESS on retry, RETRYING to FAILED after max retries, FAILED to subscription DISABLED after consecutive threshold">

    <!-- Happy path -->
    <div class="sm-path">
      <span class="sm-path-label">Happy path</span>
      <div class="sm-flow">
        <div class="sm-state sm-neutral">
          <span class="sm-state-label">PENDING</span>
        </div>
        <div class="sm-arrow">
          <span class="sm-arrow-label">HTTP 2xx</span>
          <span class="sm-arrow-icon">→</span>
        </div>
        <div class="sm-state sm-success">
          <span class="sm-state-label">SUCCESS</span>
        </div>
      </div>
    </div>

    <!-- Retry path -->
    <div class="sm-path">
      <span class="sm-path-label">Retry path</span>
      <div class="sm-flow">
        <div class="sm-state sm-neutral">
          <span class="sm-state-label">PENDING</span>
        </div>
        <div class="sm-arrow">
          <span class="sm-arrow-label">non-2xx</span>
          <span class="sm-arrow-icon">→</span>
        </div>
        <div class="sm-state sm-warning">
          <span class="sm-state-label">RETRYING</span>
        </div>
        <div class="sm-arrow">
          <span class="sm-arrow-label">retry succeeds</span>
          <span class="sm-arrow-icon">→</span>
        </div>
        <div class="sm-state sm-success">
          <span class="sm-state-label">SUCCESS</span>
        </div>
      </div>
    </div>

    <!-- Failure path -->
    <div class="sm-path">
      <span class="sm-path-label">Failure path</span>
      <div class="sm-flow">
        <div class="sm-state sm-warning">
          <span class="sm-state-label">RETRYING</span>
        </div>
        <div class="sm-arrow">
          <span class="sm-arrow-label">max retries</span>
          <span class="sm-arrow-icon">→</span>
        </div>
        <div class="sm-state sm-error">
          <span class="sm-state-label">FAILED</span>
        </div>
        <div class="sm-arrow">
          <span class="sm-arrow-label">consecutive ≥ threshold</span>
          <span class="sm-arrow-icon">→</span>
        </div>
        <div class="sm-state sm-error">
          <span class="sm-state-label">DISABLED</span>
          <span class="sm-state-sub">subscription</span>
        </div>
      </div>
    </div>

    <div class="visually-hidden">
      Webhook delivery status lifecycle — three paths:
      Happy path: PENDING → (HTTP 2xx response) → SUCCESS. The consecutive_failures counter is reset.
      Retry path: PENDING → (non-2xx response) → RETRYING → (retry succeeds with 2xx) → SUCCESS.
      Failure path: RETRYING → (max retries exceeded) → FAILED → (consecutive failures ≥ threshold) → subscription DISABLED (auto-disabled).
      States: PENDING = queued for delivery, not yet attempted. SUCCESS = delivered, received HTTP 2xx. RETRYING = failed but retries remain, scheduled for retry. FAILED = max retries exceeded. DISABLED = subscription auto-disabled after consecutive failures.
    </div>
  </div>
</template>

<style scoped>
.sm-diagram {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 24px 0;
  max-width: 640px;
}

.sm-path {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sm-path-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sm-flow {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.sm-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.sm-state-label {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
}

.sm-state-sub {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.sm-neutral {
  border-color: var(--vp-c-divider);
}

.sm-neutral .sm-state-label {
  color: var(--vp-c-text-2);
}

.sm-success {
  border-color: var(--vp-c-green-1);
  background: var(--vp-c-green-soft);
}

.sm-success .sm-state-label {
  color: var(--vp-c-green-1);
}

.sm-warning {
  border-color: var(--vp-c-yellow-1);
  background: var(--vp-c-yellow-soft);
}

.sm-warning .sm-state-label {
  color: var(--vp-c-yellow-1);
}

.sm-error {
  border-color: var(--vp-c-red-1);
  background: var(--vp-c-red-soft);
}

.sm-error .sm-state-label {
  color: var(--vp-c-red-1);
}

.sm-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 0 4px;
}

.sm-arrow-label {
  font-size: 10px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

.sm-arrow-icon {
  font-size: 16px;
  color: var(--vp-c-text-3);
}

@media (max-width: 480px) {
  .sm-flow { gap: 2px; }
  .sm-state { padding: 6px 10px; }
  .sm-state-label { font-size: 11px; }
  .sm-arrow-label { font-size: 9px; }
}
</style>
