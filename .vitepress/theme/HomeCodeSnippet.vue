<script setup>
import { ref, onMounted } from 'vue'
import { createHighlighter } from 'shiki'

const activeTab = ref('python')
const highlighted = ref({})

const tabs = [
  { key: 'python', label: 'Python' },
  { key: 'typescript', label: 'TypeScript' },
  { key: 'java', label: 'Spring Boot' },
  { key: 'langchain', label: 'LangChain' },
  { key: 'vercel', label: 'Vercel AI' },
  { key: 'openclaw', label: 'OpenClaw' },
]

const snippets = {
  python: {
    lang: 'python',
    code: `from runcycles import cycles

@cycles(estimate=5000, action_kind="llm.completion", action_name="openai:gpt-4o")
def ask(prompt: str) -> str:
    return openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content`,
  },

  typescript: {
    lang: 'typescript',
    code: `import { withCycles } from "runcycles";

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
  },

  java: {
    lang: 'java',
    code: `import io.runcycles.client.java.spring.annotation.Cycles;

@Cycles(estimate = "5000", actionKind = "llm.completion", actionName = "openai:gpt-4o")
public String ask(String prompt) {
    return openAiClient.chatCompletion(prompt);
}`,
  },

  langchain: {
    lang: 'python',
    code: `from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from runcycles import CyclesClient, CyclesConfig, Subject
from budget_handler import CyclesBudgetHandler  # see docs

client = CyclesClient(CyclesConfig.from_env())
handler = CyclesBudgetHandler(
    client=client,
    subject=Subject(tenant="acme", agent="my-agent"),
)

llm = ChatOpenAI(model="gpt-4o", callbacks=[handler])
result = llm.invoke([HumanMessage(content="Hello!")])`,
  },

  vercel: {
    lang: 'typescript',
    code: `import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { reserveForStream } from "runcycles";

const handle = await reserveForStream({
  client, estimate: 2_000_000, unit: "USD_MICROCENTS",
  actionKind: "llm.completion", actionName: "gpt-4o",
});

const result = streamText({
  model: openai("gpt-4o"), messages,
  onFinish: async ({ usage }) => {
    const actual = (usage.promptTokens ?? 0) * 250
      + (usage.completionTokens ?? 0) * 1000;
    await handle.commit(actual, {
      tokensInput: usage.promptTokens,
      tokensOutput: usage.completionTokens,
    });
  },
});`,
  },

  openclaw: {
    lang: 'jsonc',
    code: `// npm install @runcycles/openclaw-budget-guard
// openclaw plugins enable cycles-openclaw-budget-guard

// openclaw.json
{
  "plugins": {
    "entries": {
      "cycles-openclaw-budget-guard": {
        "tenant": "acme",
        "modelBaseCosts": {
          "gpt-4o": 1000000,
          "gpt-4o-mini": 100000,
          "claude-sonnet-4-20250514": 300000
        }
      }
    }
  }
}`,
  },
}

onMounted(async () => {
  const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: ['python', 'typescript', 'java', 'jsonc'],
  })

  const result = {}
  for (const [key, { code, lang }] of Object.entries(snippets)) {
    result[key] = highlighter.codeToHtml(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    })
  }
  highlighted.value = result
})
</script>

<template>
  <section class="home-code-snippet">
    <div class="inner">
    <p class="code-caption"><code>@cycles</code> reserves budget before the call. If it's gone, the call never fires.</p>
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
        <div v-if="highlighted[activeTab]" v-html="highlighted[activeTab]" />
        <pre v-else><code>{{ snippets[activeTab].code }}</code></pre>
      </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.home-code-snippet {
  position: relative;
  padding: 0 24px 48px;
  text-align: center;
}

@media (min-width: 640px) {
  .home-code-snippet {
    padding: 0 48px 48px;
  }
}

@media (min-width: 960px) {
  .home-code-snippet {
    padding: 0 64px 48px;
  }
}

.inner {
  max-width: 1152px;
  margin: 0 auto;
}

.code-caption {
  font-size: 16px;
  color: var(--vp-c-text-2);
  margin-bottom: 20px;
  line-height: 1.5;
}
  
.code-caption code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.875em;
  color: var(--vp-code-color);
  background-color: var(--vp-code-bg);
  border-radius: 4px;
  padding: 2px 6px;
}
  
.code-container {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  text-align: left;
}

.tab-bar {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
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
  /* Fixed height prevents layout shift when switching tabs.
     Tallest snippet (Vercel AI) is ~17 lines × 14px × 1.6 + 40px padding */
  min-height: 420px;
}

.code-block :deep(pre) {
  margin: 0;
  background: transparent !important;
}

.code-block :deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre;
}

.code-block :deep(.shiki) {
  background: transparent !important;
}

.dark .code-block :deep(.shiki span) {
  color: var(--shiki-dark) !important;
}

@media (max-width: 640px) {
  .tab {
    padding: 8px 14px;
    font-size: 13px;
  }

  .code-block {
    padding: 16px;
    min-height: auto;
    -webkit-overflow-scrolling: touch;
  }

  .code-block :deep(code) {
    font-size: 12px;
  }
}
</style>
