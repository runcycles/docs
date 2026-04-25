<script setup>
const steps = [
  {
    n: 1,
    heading: 'Run the local demo',
    detail: 'docker compose up. No API keys. See $6→$1 budget enforcement in 30 seconds.',
    link: '/demos/',
  },
  {
    n: 2,
    heading: 'Wrap one LLM call',
    detail: 'One @cycles decorator (Python) or withCycles wrapper (TS) on a single function. ~10 minutes.',
    link: '/quickstart/end-to-end-tutorial',
  },
  {
    n: 3,
    heading: 'Wrap one tool call',
    detail: 'Add RISK_POINTS to gate side-effecting actions — email, deploy, mutation.',
    link: '/how-to/assigning-risk-points-to-agent-tools',
  },
  {
    n: 4,
    heading: 'Shadow mode',
    detail: 'Enforce in dry-run against real traffic. Calibrate budgets without blocking.',
    link: '/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production',
  },
  {
    n: 5,
    heading: 'Hard enforcement',
    detail: 'Flip one workflow to live enforcement. Expand from there.',
    link: '/how-to/adding-cycles-to-an-existing-application',
  },
]
</script>

<template>
  <section class="adoption-ladder">
    <div class="inner">
      <h2 class="heading">From demo to enforcement, in 5 steps</h2>
      <div class="grid">
        <a
          v-for="step in steps"
          :key="step.link"
          :href="step.link"
          class="card"
        >
          <div class="card-num">{{ step.n }}</div>
          <p class="card-heading">{{ step.heading }}</p>
          <p class="card-detail">{{ step.detail }}</p>
          <span class="card-cta">Start &rarr;</span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.adoption-ladder {
  padding: 0 24px 48px;
}

@media (min-width: 640px) {
  .adoption-ladder { padding: 0 48px 48px; }
}

@media (min-width: 960px) {
  .adoption-ladder { padding: 0 64px 48px; }
}

.inner {
  max-width: 1152px;
  margin: 0 auto;
}

.heading {
  font-size: 24px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0 0 24px;
  letter-spacing: -0.02em;
  line-height: 1.3;
  text-align: center;
  border: none;
  padding: 0;
}

@media (min-width: 768px) {
  .heading {
    font-size: 28px;
    margin: 0 0 32px;
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }
}

.card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  transition: border-color 0.2s, background 0.2s;
}

.card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
}

.card-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
}

.card-heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1.35;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.card-detail {
  font-size: 13px;
  color: var(--vp-c-text-2);
  line-height: 1.55;
  margin: 0 0 14px;
  flex: 1;
}

.card-cta {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  margin-top: auto;
}
</style>
