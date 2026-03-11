// .vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/docs/',
  title: 'Cycles Docs',
  description: 'Posts, docs, and articles about Cycles',
  themeConfig: {
    nav: [{ text: 'Home', link: '/' }],
    sidebar: [
      {
        text: 'Concepts',
        items: [
          { text: 'Why Rate Limits Are Not Enough', link: '/why-rate-limits-are-not-enough-for-autonomous-systems' },
          { text: 'What Cycles Is Not', link: '/what-cycles-is-not-billing-rate-limiting-orchestration-and-other-category-confusion' },
          { text: 'Idempotency, Retries & Concurrency', link: '/idempotency-retries-and-concurrency-why-cycles-is-built-for-real-failure-modes' },
          { text: 'From Observability to Enforcement', link: '/from-observability-to-enforcement-how-teams-evolve-from-dashboards-to-budget-authority' },
        ]
      },
      {
        text: 'How-To Guides',
        items: [
          { text: 'How Reserve Commit Works', link: '/how-reserve-commit-works-in-cycles' },
          { text: 'Hard Budget Limits with Spring AI', link: '/how-to-add-hard-budget-limits-to-spring-ai-with-cycles' },
          { text: 'Tenant Workflow & Run Budgets', link: '/how-to-model-tenant-workflow-and-run-budgets-in-cycles' },
          { text: 'Choose a First Rollout', link: '/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails' },
          { text: 'Estimate Exposure Before Execution', link: '/how-to-estimate-exposure-before-execution-practical-reservation-strategies-for-cycles' },
          { text: 'Degradation Paths', link: '/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer' },
          { text: 'Shadow Mode Rollout', link: '/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production' },
        ]
      },
      {
        text: 'Incident Patterns',
        items: [
          { text: 'Runaway Agents & Tool Loops', link: '/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/runcycles/docs' }
    ]
  }
})
