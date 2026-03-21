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
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        {{ copied ? 'Copied!' : 'Copy link' }}
      </button>
      <a class="blog-share-btn" :href="shareUrl('twitter')" target="_blank" rel="noopener" aria-label="Share on X (Twitter)">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Share
      </a>
      <a class="blog-share-btn" :href="shareUrl('linkedin')" target="_blank" rel="noopener" aria-label="Share on LinkedIn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        Share
      </a>
    </div>
  </div>
</template>
