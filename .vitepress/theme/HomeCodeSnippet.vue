<script setup>
import { ref } from 'vue'

const activeTab = ref('python')

const tabs = [
  { key: 'python', label: 'Python' },
  { key: 'typescript', label: 'TypeScript' },
  { key: 'java', label: 'Spring Boot' },
]

const snippets = {
  python: `from cycles import cycles

@cycles(estimate=5000, action_kind="llm.completion", action_name="openai:gpt-4o")
def ask(prompt: str) -> str:
    return openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content`,

  typescript: `import { withCycles } from "@runcycles/cycles-client-typescript";

const ask = withCycles(
  { estimate: 5000, actionKind: "llm.completion", actionName: "openai:gpt-4o" },
  async (prompt: string) => {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0].message.content;
  }
);`,

  java: `import io.runcycles.client.java.spring.annotation.Cycles;

@Cycles(estimate = 5000, actionKind = "llm.completion", actionName = "openai:gpt-4o")
public String ask(String prompt) {
    return openAiClient.chatCompletion(prompt);
}`,
}
</script>

<template>
  <section class="home-code-snippet">
    <p class="tagline">Budget is reserved before the call. If exhausted, the call is blocked — not billed.</p>
    <div class="code-container">
      <div class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="code-block">
        <pre><code>{{ snippets[activeTab] }}</code></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-code-snippet {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px 48px;
  text-align: center;
}

.tagline {
  font-size: 16px;
  color: var(--vp-c-text-2);
  margin-bottom: 20px;
  line-height: 1.5;
}

.code-container {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  text-align: left;
}

.tab-bar {
  display: flex;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0;
}

.tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  font-family: var(--vp-font-family-base);
}

.tab:hover {
  color: var(--vp-c-text-1);
}

.tab.active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.code-block {
  background: var(--vp-code-block-bg);
  padding: 20px 24px;
  overflow-x: auto;
}

.code-block pre {
  margin: 0;
}

.code-block code {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre;
}

@media (max-width: 640px) {
  .home-code-snippet {
    padding: 0 16px 32px;
  }

  .tab {
    padding: 8px 14px;
    font-size: 13px;
  }

  .code-block {
    padding: 16px;
  }

  .code-block code {
    font-size: 13px;
  }
}
</style>
