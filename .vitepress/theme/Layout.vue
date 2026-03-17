<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import NotFound from './NotFound.vue'
import HomeCodeSnippet from './HomeCodeSnippet.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <Layout>
    <template #home-features-before>
      <HomeCodeSnippet v-if="frontmatter.layout === 'home'" />
    </template>
    <template #not-found>
      <NotFound />
    </template>
  </Layout>
</template>
