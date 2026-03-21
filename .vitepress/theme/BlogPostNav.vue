<script setup>
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { data as posts } from '../../blog/posts.data'

const { frontmatter } = useData()
const route = useRoute()

const currentIndex = computed(() =>
  posts.findIndex(p => p.url === route.path)
)

const older = computed(() =>
  currentIndex.value < posts.length - 1 ? posts[currentIndex.value + 1] : null
)

const newer = computed(() =>
  currentIndex.value > 0 ? posts[currentIndex.value - 1] : null
)

const related = computed(() => {
  if (currentIndex.value < 0) return []
  const currentTags = frontmatter.value.tags ?? []
  if (!currentTags.length) return []
  const olderUrl = older.value?.url
  const newerUrl = newer.value?.url
  return posts
    .filter((p, i) => i !== currentIndex.value && p.url !== olderUrl && p.url !== newerUrl)
    .map(p => ({
      ...p,
      shared: p.tags.filter(t => currentTags.includes(t)).length
    }))
    .filter(p => p.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
})

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })
}
</script>

<template>
  <div v-if="frontmatter.blog">
    <nav class="blog-post-nav" v-if="older || newer" aria-label="Blog post navigation">
      <a v-if="older" :href="older.url" class="blog-nav-link blog-nav-prev" :aria-label="'Read older post: ' + older.title">
        <span class="blog-nav-label">&larr; Older</span>
        <span class="blog-nav-title">{{ older.title }}</span>
      </a>
      <a v-if="newer" :href="newer.url" class="blog-nav-link blog-nav-next" :aria-label="'Read newer post: ' + newer.title">
        <span class="blog-nav-label">Newer &rarr;</span>
        <span class="blog-nav-title">{{ newer.title }}</span>
      </a>
    </nav>

    <section class="blog-related" v-if="related.length" aria-label="Related posts">
      <h3 class="blog-related-heading">More from the Blog</h3>
      <div class="blog-related-grid">
        <a v-for="p in related" :key="p.url" :href="p.url" class="blog-related-card">
          <span class="blog-related-title">{{ p.title }}</span>
          <span class="blog-related-date">{{ formatDate(p.date) }}</span>
        </a>
      </div>
    </section>
  </div>
</template>
