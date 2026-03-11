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
        ]
      },
      {
        text: 'How-To Guides',
        items: [
          { text: 'How Reserve Commit Works', link: '/how-reserve-commit-works-in-cycles' },
          { text: 'Hard Budget Limits with Spring AI', link: '/how-to-add-hard-budget-limits-to-spring-ai-with-cycles' },
          { text: 'Tenant Workflow & Run Budgets', link: '/how-to-model-tenant-workflow-and-run-budgets-in-cycles' },
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
