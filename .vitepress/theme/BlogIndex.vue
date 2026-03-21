<script setup>
import { ref, computed, onMounted } from 'vue'
import { data as posts } from '../../blog/posts.data'

const selectedTag = ref(null)
const page = ref(1)
const perPage = 10

const tagCounts = computed(() => {
  const counts = {}
  posts.forEach(p => p.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
  return counts
})

const allTags = computed(() =>
  Object.keys(tagCounts.value).sort()
)

const filteredPosts = computed(() =>
  selectedTag.value
    ? posts.filter(p => p.tags.includes(selectedTag.value))
    : posts
)

const totalPages = computed(() =>
  Math.ceil(filteredPosts.value.length / perPage)
)

const paginatedPosts = computed(() =>
  filteredPosts.value.slice((page.value - 1) * perPage, page.value * perPage)
)

function isNew(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return diff < 7 * 24 * 60 * 60 * 1000
}

function selectTag(tag) {
  selectedTag.value = tag
  page.value = 1
  const url = new URL(window.location.href)
  if (tag) {
    url.searchParams.set('tag', tag)
  } else {
    url.searchParams.delete('tag')
  }
  history.replaceState(null, '', url.toString())
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })
}

onMounted(() => {
  const url = new URL(window.location.href)
  const tagParam = url.searchParams.get('tag')
  if (tagParam && allTags.value.includes(tagParam)) {
    selectedTag.value = tagParam
  }
})
</script>

<template>
  <div class="blog-index">
    <div class="blog-tags-row">
      <div class="blog-tags" v-if="allTags.length" role="group" aria-label="Filter by tag">
        <button
          :class="{ active: !selectedTag }"
          :aria-pressed="!selectedTag"
          @click="selectTag(null)"
        >All ({{ posts.length }})</button>
        <button
          v-for="tag in allTags" :key="tag"
          :class="{ active: selectedTag === tag }"
          :aria-pressed="selectedTag === tag"
          @click="selectTag(tag)"
        >{{ tag }} ({{ tagCounts[tag] }})</button>
      </div>
      <a href="/feed.xml" class="blog-rss-link" aria-label="Subscribe via RSS">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
        RSS
      </a>
    </div>

    <article v-for="(post, i) in paginatedPosts" :key="post.url" class="blog-card">
      <div class="blog-card-content">
        <h2>
          <a :href="post.url">{{ post.title }}</a>
          <span v-if="post.featured" class="blog-featured-badge">FEATURED</span>
          <span v-else-if="i === 0 && page === 1 && !selectedTag && isNew(post.date)" class="blog-new-badge">NEW</span>
        </h2>
        <div class="blog-meta">
          <time class="blog-date" :datetime="post.date">{{ formatDate(post.date) }}</time>
          <span class="blog-author"> &middot; {{ post.author }}</span>
          <span class="blog-reading-time"> &middot; {{ post.readingTime }} min read</span>
        </div>
        <p class="blog-description">{{ post.description }}</p>
        <div class="blog-card-tags" v-if="post.tags.length">
          <span v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</span>
        </div>
      </div>
      <img v-if="post.image" :src="post.image" :alt="post.title" class="blog-card-thumb" loading="lazy" />
    </article>

    <p v-if="paginatedPosts.length === 0" class="blog-empty">
      No posts found.
    </p>

    <nav class="blog-pagination" v-if="totalPages > 1" aria-label="Blog pagination">
      <button :disabled="page <= 1" @click="page--" aria-label="Newer posts">&larr; Newer</button>
      <span class="blog-page-info">Page {{ page }} of {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++" aria-label="Older posts">&rarr; Older</button>
    </nav>
  </div>
</template>
