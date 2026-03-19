<script setup>
import { ref, computed } from 'vue'
import { data as posts } from '../../blog/posts.data'

const selectedTag = ref(null)
const page = ref(1)
const perPage = 10

const allTags = computed(() =>
  [...new Set(posts.flatMap(p => p.tags))].sort()
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

function selectTag(tag) {
  selectedTag.value = tag
  page.value = 1
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
</script>

<template>
  <div class="blog-index">
    <div class="blog-tags" v-if="allTags.length">
      <button
        :class="{ active: !selectedTag }"
        @click="selectTag(null)"
      >All</button>
      <button
        v-for="tag in allTags" :key="tag"
        :class="{ active: selectedTag === tag }"
        @click="selectTag(tag)"
      >{{ tag }}</button>
    </div>

    <article v-for="post in paginatedPosts" :key="post.url" class="blog-card">
      <h2><a :href="post.url">{{ post.title }}</a></h2>
      <div class="blog-meta">
        <span class="blog-date">{{ formatDate(post.date) }}</span>
        <span class="blog-author">{{ post.author }}</span>
        <span class="blog-reading-time">{{ post.readingTime }} min read</span>
      </div>
      <p class="blog-description">{{ post.description }}</p>
      <div class="blog-card-tags" v-if="post.tags.length">
        <span v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</span>
      </div>
    </article>

    <p v-if="paginatedPosts.length === 0" class="blog-empty">
      No posts found.
    </p>

    <nav class="blog-pagination" v-if="totalPages > 1">
      <button :disabled="page <= 1" @click="page--">&larr; Newer</button>
      <span class="blog-page-info">Page {{ page }} of {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++">&rarr; Older</button>
    </nav>
  </div>
</template>
