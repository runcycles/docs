<script setup>
import { computed } from 'vue'
import { useRoute, useData } from 'vitepress'

const route = useRoute()
const { frontmatter } = useData()

const sectionMap = {
  'quickstart': 'Quickstart',
  'concepts': 'Concepts',
  'how-to': 'How-To Guides',
  'protocol': 'Protocol',
  'configuration': 'Configuration',
  'incidents': 'Incidents',
  'community': 'Community',
  'blog': 'Blog',
  'api': 'API Reference',
  'admin-api': 'Admin API',
}

const firstPageMap = {
  'quickstart': '/quickstart/what-is-cycles',
  'concepts': '/concepts/comparisons',
  'how-to': '/how-to/adding-cycles-to-an-existing-application',
  'protocol': '/protocol/how-reserve-commit-works-in-cycles',
  'configuration': '/configuration/python-client-configuration-reference',
  'incidents': '/incidents/runaway-agents-tool-loops-and-budget-overruns-the-incidents-cycles-is-designed-to-prevent',
  'community': '/community/badges',
  'blog': '/blog/',
  'api': '/api/',
  'admin-api': '/admin-api/',
}

const breadcrumb = computed(() => {
  if (frontmatter.value.layout === 'home' || frontmatter.value.blog) return null
  const path = route.path
  const segments = path.split('/').filter(Boolean)
  if (segments.length < 2) return null
  const section = segments[0]
  const label = sectionMap[section]
  if (!label) return null
  return { label, link: firstPageMap[section] || `/${section}/` }
})
</script>

<template>
  <nav v-if="breadcrumb" class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Docs</a>
    <span class="separator">/</span>
    <a :href="breadcrumb.link" class="current-section">{{ breadcrumb.label }}</a>
  </nav>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-3);
  margin-bottom: 16px;
}

.breadcrumb a {
  color: var(--vp-c-text-3);
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb a:hover {
  color: var(--vp-c-brand-1);
}

.separator {
  color: var(--vp-c-text-3);
  opacity: 0.5;
}

.current-section {
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.2s;
}

.current-section:hover {
  color: var(--vp-c-brand-1);
}
</style>
