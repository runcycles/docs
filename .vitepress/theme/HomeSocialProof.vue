<script setup>
import { computed } from 'vue'
import { data } from './installs.data'

const formatted = computed(() =>
  data.total.toLocaleString('en-US')
)
</script>

<template>
  <p v-if="data.total > 0" class="social-proof">
    <svg class="social-proof-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    {{ formatted }}+ package installs
  </p>
</template>

<style scoped>
.social-proof {
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 500;
  padding: 0 24px 24px;
  margin: -20px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  letter-spacing: 0.01em;
}

.social-proof-icon {
  flex-shrink: 0;
}
</style>
