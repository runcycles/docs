<script setup>
import { useData } from 'vitepress'

const { frontmatter } = useData()

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
</script>

<template>
  <div class="blog-post-header" v-if="frontmatter.blog">
    <p class="blog-post-meta">
      <time>{{ formatDate(frontmatter.date) }}</time>
      <span v-if="frontmatter.author"> &middot; {{ frontmatter.author }}</span>
    </p>
    <div class="blog-post-tags" v-if="frontmatter.tags?.length">
      <span v-for="tag in frontmatter.tags" :key="tag" class="blog-tag">{{ tag }}</span>
    </div>
  </div>
</template>
