<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import NotFound from './NotFound.vue'
import HomeCodeSnippet from './HomeCodeSnippet.vue'
import BlogPost from './BlogPost.vue'
import BlogPostNav from './BlogPostNav.vue'

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
    <template #doc-before>
      <BlogPost />
    </template>
    <template #doc-after>
      <BlogPostNav />
    </template>
  </Layout>
</template>
