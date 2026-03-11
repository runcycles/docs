import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/docs/',
  title: 'Cycles Docs',
  description: 'Documentation for Cycles, a budget authority for autonomous execution.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Protocol', link: 'https://github.com/runcycles/cycles-protocol' },
      { text: 'GitHub', link: 'https://github.com/runcycles' }
    ],
    sidebar: [
      {
        text: 'Quickstart',
        items: [
          { text: 'Start Here', link: '/' },
          { text: 'Architecture Overview', link: '/quickstart/architecture-overview-how-cycles-fits-together' },
          { text: 'Self-Hosting the Server', link: '/quickstart/self-hosting-the-cycles-server' },
          { text: 'Spring Boot Starter', link: '/quickstart/getting-started-with-the-cycles-spring-boot-starter' },
          { text: 'Hard Budget Limits with Spring AI', link: '/quickstart/how-to-add-hard-budget-limits-to-spring-ai-with-cycles' },
          { text: 'Choose a First Rollout', link: '/quickstart/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails' },
        ]
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Why Rate Limits Are Not Enough', link: '/concepts/why-rate-limits-are-not-enough-for-autonomous-systems' },
          { text: 'What Cycles Is Not', link: '/concepts/what-cycles-is-not-billing-rate-limiting-orchestration-and-other-category-confusion' },
          { text: 'Idempotency, Retries and Concurrency', link: '/concepts/idempotency-retries-and-concurrency-why-cycles-is-built-for-real-failure-modes' },
          { text: 'From Observability to Enforcement', link: '/concepts/from-observability-to-enforcement-how-teams-evolve-from-dashboards-to-budget-authority' },
        ]
      },
      {
        text: 'How-To Guides',
        items: [
          { text: 'Hard Budget Limits with Spring AI', link: '/quickstart/how-to-add-hard-budget-limits-to-spring-ai-with-cycles' },
          { text: 'Spring Boot Starter', link: '/quickstart/getting-started-with-the-cycles-spring-boot-starter' },
          { text: 'Programmatic Client Usage', link: '/how-to/using-the-cycles-client-programmatically' },
          { text: 'Budget Allocation and Management', link: '/how-to/budget-allocation-and-management-in-cycles' },
          { text: 'API Key Management', link: '/how-to/api-key-management-in-cycles' },
          { text: 'Custom Field Resolvers', link: '/how-to/custom-field-resolvers-in-cycles' },
          { text: 'Tenant, Workflow, and Run Budgets', link: '/how-to/how-to-model-tenant-workflow-and-run-budgets-in-cycles' },
          { text: 'Choose a First Rollout', link: '/quickstart/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails' },
          { text: 'Estimate Exposure Before Execution', link: '/how-to/how-to-estimate-exposure-before-execution-practical-reservation-strategies-for-cycles' },
          { text: 'Degradation Paths', link: '/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer' },
          { text: 'Shadow Mode Rollout', link: '/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production' },
          { text: 'Error Handling Patterns', link: '/how-to/error-handling-patterns-in-cycles-client-code' },
          { text: 'Testing with Cycles', link: '/how-to/testing-with-cycles' },
        ]
      },
      {
        text: 'Protocol Reference',
        items: [
          { text: 'API Reference', link: '/protocol/api-reference-for-the-cycles-protocol' },
          { text: 'Reserve / Commit Lifecycle', link: '/protocol/how-reserve-commit-works-in-cycles' },
          { text: 'Authentication and Tenancy', link: '/protocol/authentication-tenancy-and-api-keys-in-cycles' },
          { text: 'Scope Derivation', link: '/protocol/how-scope-derivation-works-in-cycles' },
          { text: 'Understanding Units', link: '/protocol/understanding-units-in-cycles-usd-microcents-tokens-credits-and-risk-points' },
          { text: 'Caps and Three-Way Decisions', link: '/protocol/caps-and-the-three-way-decision-model-in-cycles' },
          { text: 'Commit Overage Policies', link: '/protocol/commit-overage-policies-in-cycles-reject-allow-if-available-and-allow-with-overdraft' },
          { text: 'TTL, Grace Period, and Extend', link: '/protocol/reservation-ttl-grace-period-and-extend-in-cycles' },
          { text: 'Decide: Preflight Checks', link: '/protocol/how-decide-works-in-cycles-preflight-budget-checks-without-reservation' },
          { text: 'Dry Run and Shadow Mode', link: '/protocol/dry-run-shadow-mode-evaluation-in-cycles' },
          { text: 'Events and Direct Debit', link: '/protocol/how-events-work-in-cycles-direct-debit-without-reservation' },
          { text: 'Debt and Overdraft', link: '/protocol/debt-overdraft-and-the-over-limit-model-in-cycles' },
          { text: 'Querying Balances', link: '/protocol/querying-balances-in-cycles-understanding-budget-state' },
          { text: 'Reservation Recovery and Listing', link: '/protocol/reservation-recovery-and-listing-in-cycles' },
          { text: 'Metrics and Metadata', link: '/protocol/standard-metrics-and-metadata-in-cycles' },
          { text: 'Error Codes and Error Handling', link: '/protocol/error-codes-and-error-handling-in-cycles' },
        ]
      },
      {
        text: 'Configuration Reference',
        items: [
          { text: 'Client Configuration', link: '/configuration/client-configuration-reference-for-cycles-spring-boot-starter' },
          { text: 'Server Configuration', link: '/configuration/server-configuration-reference-for-cycles' },
          { text: 'SpEL Expression Reference', link: '/configuration/spel-expression-reference-for-cycles' },
        ]
      },
      {
        text: 'Incident Patterns',
        items: [
          { text: 'Runaway Agents and Tool Loops', link: '/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/runcycles/docs' }
    ]
  }
})
