<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
import { data as posts } from '../../blog/posts.data'

const { frontmatter } = useData()

const currentIndex = computed(() =>
  posts.findIndex(p => p.title === frontmatter.value.title)
)

const prev = computed(() =>
  currentIndex.value < posts.length - 1 ? posts[currentIndex.value + 1] : null
)

const next = computed(() =>
  currentIndex.value > 0 ? posts[currentIndex.value - 1] : null
)
</script>

<template>
  <nav class="blog-post-nav" v-if="frontmatter.blog && (prev || next)">
    <a v-if="prev" :href="prev.url" class="blog-nav-link blog-nav-prev">
      <span class="blog-nav-label">Previous</span>
      <span class="blog-nav-title">{{ prev.title }}</span>
    </a>
    <a v-if="next" :href="next.url" class="blog-nav-link blog-nav-next">
      <span class="blog-nav-label">Next</span>
      <span class="blog-nav-title">{{ next.title }}</span>
    </a>
  </nav>
</template>
