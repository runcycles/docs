import { defineConfig } from 'vitepress'
import { useSidebar } from 'vitepress-openapi'
import spec from '../public/openapi.json' with { type: 'json' }
import adminSpec from '../public/admin-openapi.json' with { type: 'json' }

const openApiSidebar = useSidebar({
  spec,
  linkPrefix: '/api/operations/',
})

const adminApiSidebar = useSidebar({
  spec: adminSpec,
  linkPrefix: '/admin-api/operations/',
})

export default defineConfig({
  base: '/',
  title: 'Cycles Docs',
  description: 'Documentation for Cycles, a budget authority for autonomous execution.',
  srcExclude: ['cycles-protocol/**', 'cycles-server-admin/**'],
  head: [
    ['link', { rel: 'icon', href: '/docs/runcycles-favicon.png' }],
  ],
  lastUpdated: true,
  themeConfig: {
    search: {
      provider: 'local'
    },
    logo: '/runcycles-logo-64.png',
    externalLinkIcon: true,
    editLink: {
      pattern: 'https://github.com/runcycles/docs/edit/main/:path',
      text: 'Edit this page on GitHub'
    },
    lastUpdated: {
      text: 'Last updated'
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },
    outline: {
      level: [2, 3],
      label: 'On this page'
    },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quickstart', link: '/quickstart/what-is-cycles' },
      {
        text: 'API Reference',
        items: [
          { text: 'Cycles Protocol API', link: '/api/' },
          { text: 'RunCyles Admin API', link: '/admin-api/' },
        ],
      },
      { text: 'Protocol', link: 'https://github.com/runcycles/cycles-protocol' },
      { text: 'GitHub', link: 'https://github.com/runcycles' }
    ],
    sidebar: {
      '/api/': [
        {
          text: 'Cycles Protocol API',
          items: [
            { text: 'Overview', link: '/api/' },
            ...openApiSidebar.generateSidebarGroups(),
          ],
        },
      ],
      '/admin-api/': [
        {
          text: 'RunCyles Admin API',
          items: [
            { text: 'Overview', link: '/admin-api/' },
            ...adminApiSidebar.generateSidebarGroups(),
          ],
        },
      ],
      '/': [
        {
          text: 'Quickstart',
          items: [
            { text: 'What is Cycles?', link: '/quickstart/what-is-cycles' },
            { text: 'End-to-End Tutorial', link: '/quickstart/end-to-end-tutorial', badge: { text: 'Start Here', type: 'tip' } },
            { text: 'Add to a Python App', link: '/quickstart/getting-started-with-the-python-client' },
            { text: 'Add to a TypeScript App', link: '/quickstart/getting-started-with-the-typescript-client' },
            { text: 'Add to a Spring Boot App', link: '/quickstart/getting-started-with-the-cycles-spring-boot-starter' },
            { text: 'Budget Limits with Spring AI', link: '/quickstart/how-to-add-hard-budget-limits-to-spring-ai-with-cycles' },
            { text: 'Choose a First Rollout', link: '/quickstart/how-to-choose-a-first-cycles-rollout-tenant-budgets-run-budgets-or-model-call-guardrails' },
            { text: 'Architecture Overview', link: '/quickstart/architecture-overview-how-cycles-fits-together' },
            { text: 'Deploy the Full Stack', link: '/quickstart/deploying-the-full-cycles-stack' },
            { text: 'Self-Hosting the Server', link: '/quickstart/self-hosting-the-cycles-server' },
          ]
        },
        {
          text: 'Concepts',
          items: [
            { text: 'Why Rate Limits Are Not Enough', link: '/concepts/why-rate-limits-are-not-enough-for-autonomous-systems' },
            { text: 'What Cycles Is Not', link: '/concepts/what-cycles-is-not-billing-rate-limiting-orchestration-and-other-category-confusion' },
            { text: 'Idempotency, Retries and Concurrency', link: '/concepts/idempotency-retries-and-concurrency-why-cycles-is-built-for-real-failure-modes' },
            { text: 'From Observability to Enforcement', link: '/concepts/from-observability-to-enforcement-how-teams-evolve-from-dashboards-to-budget-authority' },
            { text: 'How Cycles Compares', link: '/concepts/how-cycles-compares-to-rate-limiters-observability-provider-caps-in-app-counters-and-job-schedulers' },
          ]
        },
        {
          text: 'How-To Guides',
          collapsed: true,
          items: [
            { text: 'Adding Cycles to an Existing App', link: '/how-to/adding-cycles-to-an-existing-application' },
            { text: 'Choosing the Right Pattern', link: '/how-to/choosing-the-right-integration-pattern' },
            { text: 'Cost Estimation Cheat Sheet', link: '/how-to/cost-estimation-cheat-sheet' },
            { text: 'Common Budget Patterns', link: '/how-to/common-budget-patterns' },
            { text: 'Programmatic Client Usage', link: '/how-to/using-the-cycles-client-programmatically' },
            { text: 'Budget Allocation and Management', link: '/how-to/budget-allocation-and-management-in-cycles' },
            { text: 'API Key Management', link: '/how-to/api-key-management-in-cycles' },
            { text: 'Custom Field Resolvers', link: '/how-to/custom-field-resolvers-in-cycles' },
            { text: 'Tenant, Workflow, and Run Budgets', link: '/how-to/how-to-model-tenant-workflow-and-run-budgets-in-cycles' },
            { text: 'Estimate Exposure Before Execution', link: '/how-to/how-to-estimate-exposure-before-execution-practical-reservation-strategies-for-cycles' },
            { text: 'Degradation Paths', link: '/how-to/how-to-think-about-degradation-paths-in-cycles-deny-downgrade-disable-or-defer' },
            { text: 'Shadow Mode Rollout', link: '/how-to/shadow-mode-in-cycles-how-to-roll-out-budget-enforcement-without-breaking-production' },
            { text: 'Error Handling Patterns', link: '/how-to/error-handling-patterns-in-cycles-client-code' },
            { text: 'Error Handling in TypeScript', link: '/how-to/error-handling-patterns-in-typescript' },
            { text: 'Error Handling in Python', link: '/how-to/error-handling-patterns-in-python' },
            { text: 'Handling Streaming Responses', link: '/how-to/handling-streaming-responses-with-cycles' },
            { text: 'Testing with Cycles', link: '/how-to/testing-with-cycles' },
            { text: 'Troubleshooting and FAQ', link: '/how-to/troubleshooting-and-faq' },
          ]
        },
        {
          text: 'Integrations',
          collapsed: true,
          items: [
            { text: 'OpenAI', link: '/how-to/integrating-cycles-with-openai' },
            { text: 'Anthropic', link: '/how-to/integrating-cycles-with-anthropic' },
            { text: 'LangChain', link: '/how-to/integrating-cycles-with-langchain' },
            { text: 'Vercel AI SDK', link: '/how-to/integrating-cycles-with-vercel-ai-sdk' },
            { text: 'AWS Bedrock', link: '/how-to/integrating-cycles-with-aws-bedrock' },
            { text: 'Google Gemini', link: '/how-to/integrating-cycles-with-google-gemini' },
            { text: 'Express', link: '/how-to/integrating-cycles-with-express' },
            { text: 'FastAPI', link: '/how-to/integrating-cycles-with-fastapi' },
            { text: 'OpenClaw', link: '/how-to/integrating-cycles-with-openclaw' },
          ]
        },
        {
          text: 'Protocol Reference',
          collapsed: true,
          items: [
            { text: 'API Reference (Manual)', link: '/protocol/api-reference-for-the-cycles-protocol' },
            { text: 'API Reference (Interactive)', link: '/api/', badge: { text: 'Interactive', type: 'info' } },
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
          collapsed: true,
          items: [
            { text: 'Python Client Configuration', link: '/configuration/python-client-configuration-reference' },
            { text: 'TypeScript Client Configuration', link: '/configuration/typescript-client-configuration-reference' },
            { text: 'Spring Client Configuration', link: '/configuration/client-configuration-reference-for-cycles-spring-boot-starter' },
            { text: 'Server Configuration', link: '/configuration/server-configuration-reference-for-cycles' },
            { text: 'SpEL Expression Reference', link: '/configuration/spel-expression-reference-for-cycles' },
          ]
        },
        {
          text: 'Incident Patterns',
          collapsed: true,
          items: [
            { text: 'Runaway Agents and Tool Loops', link: '/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent' },
            { text: 'Retry Storms', link: '/incidents/retry-storms-and-idempotency-failures' },
            { text: 'Concurrent Agent Overspend', link: '/incidents/concurrent-agent-overspend' },
            { text: 'Scope Misconfiguration', link: '/incidents/scope-misconfiguration-and-budget-leaks' },
          ]
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Production Operations', link: '/how-to/production-operations-guide' },
            { text: 'Monitoring and Alerting', link: '/how-to/monitoring-and-alerting' },
            { text: 'Security Hardening', link: '/how-to/security-hardening' },
            { text: 'Changelog', link: '/changelog' },
          ]
        }
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/runcycles/docs' }
    ]
  },
  transformPageData(pageData) {
    if (pageData.params?.pageTitle) {
      pageData.title = pageData.params.pageTitle
    }
  },
})
