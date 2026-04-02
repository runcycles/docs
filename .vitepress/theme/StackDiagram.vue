<script setup>
const layers = [
  {
    id: 'routing',
    label: 'Routing',
    question: 'Which model?',
    examples: 'LiteLLM · Portkey · Gateways',
    accent: false,
  },
  {
    id: 'visibility',
    label: 'Visibility',
    question: 'What happened?',
    examples: 'LangSmith · Langfuse · Helicone',
    accent: false,
  },
  {
    id: 'authority',
    label: 'Authority',
    question: 'Should this happen?',
    examples: 'Cycles',
    accent: true,
  },
]
</script>

<template>
  <div class="stack-diagram" role="img" aria-label="AI agent infrastructure stack: Routing, Visibility, and Authority layers">
    <div
      v-for="(layer, i) in layers"
      :key="layer.id"
      class="stack-layer"
      :class="{ 'stack-layer--accent': layer.accent }"
    >
      <div class="layer-left">
        <span class="layer-label">{{ layer.label }}</span>
        <span class="layer-question">{{ layer.question }}</span>
      </div>
      <div class="layer-right">
        <span class="layer-examples">{{ layer.examples }}</span>
      </div>
      <div v-if="layer.accent" class="layer-pillars">
        <span class="pillar">Budget Gate</span>
        <span class="pillar">Action Gate</span>
        <span class="pillar">Audit Trail</span>
      </div>
    </div>
    <p class="stack-caption">
      Routing and visibility are necessary. They are not sufficient. Neither can prevent the 241st retry or block the 201st email.
    </p>
    <div class="visually-hidden">
      AI agent infrastructure stack — three layers:
      1. Routing layer (which model?) — LiteLLM, Portkey, gateway proxies.
      2. Visibility layer (what happened?) — LangSmith, Langfuse, Helicone.
      3. Authority layer (should this happen? — before execution) — Cycles.
      The Authority layer contains three capabilities: Budget Gate, Action Gate, and Audit Trail.
      Routing and visibility are necessary but not sufficient. Neither can prevent the 241st retry or block the 201st email. Cycles is the authority layer — the decision point between "the agent wants to do X" and "X happens."
    </div>
  </div>
</template>

<style scoped>
.stack-diagram {
  margin: 24px 0;
  max-width: 640px;
}

.stack-layer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  position: relative;
}

.stack-layer:first-child {
  border-radius: 12px 12px 0 0;
}

.stack-layer:not(:first-child) {
  border-top: none;
}

.stack-layer:last-of-type {
  border-radius: 0 0 12px 12px;
}

.stack-layer--accent {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  border-top: 1px solid var(--vp-c-brand-1);
}

.layer-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.layer-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  letter-spacing: -0.01em;
}

.stack-layer--accent .layer-label {
  color: var(--vp-c-brand-1);
}

.layer-question {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.layer-right {
  text-align: right;
}

.layer-examples {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.stack-layer--accent .layer-examples {
  font-weight: 700;
  color: var(--vp-c-brand-1);
  font-size: 14px;
}

.layer-pillars {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
}

.pillar {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  padding: 6px 8px;
  letter-spacing: 0.01em;
}

.stack-caption {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 12px 0 0;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .stack-layer {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .layer-right {
    text-align: left;
  }
  .pillar {
    font-size: 11px;
    padding: 5px 4px;
  }
}
</style>
