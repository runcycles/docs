<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import NotFound from './NotFound.vue'
import HomeCodeSnippet from './HomeCodeSnippet.vue'
import BlogPost from './BlogPost.vue'
import BlogPostNav from './BlogPostNav.vue'
import PageFeedback from './PageFeedback.vue'
import Breadcrumb from './Breadcrumb.vue'

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
      <Breadcrumb />
      <BlogPost />
    </template>
    <template #doc-after>
      <BlogPostNav />
      <PageFeedback />
    </template>
  </Layout>
</template>
