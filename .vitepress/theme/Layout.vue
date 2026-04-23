<script setup>
import DefaultTheme from 'vitepress/theme-without-fonts'
import { useData } from 'vitepress'
import NotFound from './NotFound.vue'
import HomeCodeSnippet from './HomeCodeSnippet.vue'
import HomeSocialProof from './HomeSocialProof.vue'
import HomeProblems from './HomeProblems.vue'
import HomeIntegrations from './HomeIntegrations.vue'
import HomeContact from './HomeContact.vue'
import BlogPost from './BlogPost.vue'
import BlogPostNav from './BlogPostNav.vue'
import PageFeedback from './PageFeedback.vue'
import Breadcrumb from './Breadcrumb.vue'
import MobileThemeToggle from './MobileThemeToggle.vue'
import SiteFooter from './SiteFooter.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <Layout>
    <template #home-features-before>
      <HomeSocialProof v-if="frontmatter.layout === 'home'" />
      <HomeProblems v-if="frontmatter.layout === 'home'" />
      <HomeIntegrations v-if="frontmatter.layout === 'home'" />
      <HomeCodeSnippet v-if="frontmatter.layout === 'home'" />
    </template>
    <template #home-features-after>
      <HomeContact v-if="frontmatter.layout === 'home'" />
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
    <template #layout-bottom>
      <MobileThemeToggle />
      <SiteFooter />
    </template>
  </Layout>
</template>
