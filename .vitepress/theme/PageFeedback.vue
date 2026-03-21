<script setup>
import { ref, computed, onMounted } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter } = useData()
const route = useRoute()
const feedback = ref(null) // null | 'yes' | 'no'

const storageKey = computed(() => `page-feedback:${route.path}`)

onMounted(() => {
  try {
    const saved = localStorage.getItem(storageKey.value)
    if (saved) feedback.value = saved
  } catch {}
})

function vote(value) {
  feedback.value = value
  try {
    localStorage.setItem(storageKey.value, value)
  } catch {}
}
</script>

<template>
  <div class="page-feedback" v-if="!frontmatter.blog && frontmatter.layout !== 'home'">
    <div v-if="!feedback" class="feedback-prompt">
      <span class="feedback-label">Was this page helpful?</span>
      <div class="feedback-buttons">
        <button class="feedback-btn" @click="vote('yes')" aria-label="Yes, this page was helpful">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
        </button>
        <button class="feedback-btn" @click="vote('no')" aria-label="No, this page was not helpful">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
        </button>
      </div>
    </div>
    <div v-else class="feedback-thanks">
      <span>Thanks for the feedback!</span>
      <a v-if="feedback === 'no'" href="https://github.com/runcycles/docs/issues/new" target="_blank" rel="noopener" class="feedback-issue-link">Open an issue</a>
    </div>
  </div>
</template>

<style scoped>
.page-feedback {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
  display: flex;
  justify-content: center;
}

.feedback-prompt {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feedback-label {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.feedback-buttons {
  display: flex;
  gap: 8px;
}

.feedback-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all 0.2s;
}

.feedback-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.feedback-btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.feedback-thanks {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.feedback-issue-link {
  font-size: 13px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.feedback-issue-link:hover {
  text-decoration: underline;
}
</style>
