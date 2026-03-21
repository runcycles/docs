<script setup>
import { ref, computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { data as posts } from '../../blog/posts.data'

const { frontmatter } = useData()
const route = useRoute()

const post = computed(() =>
  posts.find(p => p.url === route.path)
)

const copied = ref(false)

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })
}

function copyLink() {
  if (typeof window === 'undefined') return
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function shareUrl(platform) {
  if (typeof window === 'undefined') return '#'
  const url = encodeURIComponent(window.location.href)
  const title = encodeURIComponent(frontmatter.value.title)
  if (platform === 'twitter') {
    return `https://x.com/intent/tweet?text=${title}&url=${url}`
  }
  if (platform === 'linkedin') {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
  }
  return '#'
}
</script>

<template>
  <div class="blog-post-header" v-if="frontmatter.blog">
    <a href="/blog/" class="blog-back-link">&larr; Blog</a>
    <p class="blog-post-meta">
      <time :datetime="frontmatter.date">{{ formatDate(frontmatter.date) }}</time>
      <span v-if="frontmatter.author"> &middot; {{ frontmatter.author }}</span>
      <span v-if="post?.readingTime"> &middot; {{ post.readingTime }} min read</span>
    </p>
    <div class="blog-post-tags" v-if="frontmatter.tags?.length">
      <span v-for="tag in frontmatter.tags" :key="tag" class="blog-tag">{{ tag }}</span>
    </div>
    <div class="blog-share">
      <button class="blog-share-btn" @click="copyLink" :aria-label="copied ? 'Link copied' : 'Copy link'">
        {{ copied ? 'Copied!' : 'Copy link' }}
      </button>
      <a class="blog-share-btn" :href="shareUrl('twitter')" target="_blank" rel="noopener" aria-label="Share on X (Twitter)">X</a>
      <a class="blog-share-btn" :href="shareUrl('linkedin')" target="_blank" rel="noopener" aria-label="Share on LinkedIn">LinkedIn</a>
    </div>
  </div>
</template>
