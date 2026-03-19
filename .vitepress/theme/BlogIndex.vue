<script setup>
import { ref, computed } from 'vue'
import { data as posts } from '../../blog/posts.data'

const selectedTag = ref(null)

const allTags = computed(() =>
  [...new Set(posts.flatMap(p => p.tags))].sort()
)

const filteredPosts = computed(() =>
  selectedTag.value
    ? posts.filter(p => p.tags.includes(selectedTag.value))
    : posts
)

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
        @click="selectedTag = null"
      >All</button>
      <button
        v-for="tag in allTags" :key="tag"
        :class="{ active: selectedTag === tag }"
        @click="selectedTag = tag"
      >{{ tag }}</button>
    </div>

    <article v-for="post in filteredPosts" :key="post.url" class="blog-card">
      <h2><a :href="post.url">{{ post.title }}</a></h2>
      <div class="blog-meta">
        <span class="blog-date">{{ formatDate(post.date) }}</span>
        <span class="blog-author">{{ post.author }}</span>
      </div>
      <p class="blog-description">{{ post.description }}</p>
      <div class="blog-card-tags" v-if="post.tags.length">
        <span v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</span>
      </div>
    </article>

    <p v-if="filteredPosts.length === 0" class="blog-empty">
      No posts found.
    </p>
  </div>
</template>
