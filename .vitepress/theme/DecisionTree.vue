<script setup>
/**
 * DecisionTree — interactive integration pattern selector for
 * "Choosing the Right Integration Pattern" page.
 */
const tree = {
  question: 'Is the agent an MCP-compatible host?',
  detail: 'Claude Desktop, Claude Code, Cursor, Windsurf',
  yes: {
    answer: 'Use the MCP Server',
    detail: '@runcycles/mcp-server — zero code changes',
    link: '/quickstart/getting-started-with-the-mcp-server',
  },
  no: {
    question: 'Is it an agent framework with lifecycle hooks?',
    detail: 'OpenAI Agents SDK, OpenClaw',
    yes: {
      answer: 'Use the framework plugin',
      detail: 'runcycles-openai-agents, openclaw-budget-guard',
      link: '/how-to/integrating-cycles-with-openai-agents',
    },
    no: {
      question: 'Is the call streaming?',
      yes: {
        answer: 'Use reserveForStream (TS), ReservationGuard (Rust), or programmatic client (Python)',
        link: '/how-to/handling-streaming-responses-with-cycles',
      },
      no: {
        question: 'Is budget logic per-request in a web framework?',
        yes: {
          answer: 'Use middleware',
          detail: 'Express, FastAPI, Axum, Actix',
        },
        no: {
          question: 'Do you need fine-grained control over commit timing?',
          yes: {
            answer: 'Use programmatic client or ReservationGuard (Rust)',
            link: '/quickstart/getting-started-with-the-python-client',
          },
          no: {
            answer: 'Use decorator / wrapper',
            detail: '@cycles (Python) / withCycles (TS) / with_cycles (Rust) / @Cycles (Java)',
          },
        },
      },
    },
  },
}

function flattenTree(node, depth = 0, path = []) {
  const rows = []
  if (node.question) {
    rows.push({ type: 'question', text: node.question, detail: node.detail, depth, path: [...path] })
    if (node.yes) {
      if (node.yes.answer) {
        rows.push({ type: 'answer', text: node.yes.answer, detail: node.yes.detail, link: node.yes.link, depth: depth + 1, branch: 'Yes', path: [...path, 'yes'] })
      } else {
        rows.push({ type: 'branch', branch: 'Yes', depth: depth + 1, path: [...path, 'yes'] })
        rows.push(...flattenTree(node.yes, depth + 1, [...path, 'yes']))
      }
    }
    if (node.no) {
      if (node.no.answer) {
        rows.push({ type: 'answer', text: node.no.answer, detail: node.no.detail, link: node.no.link, depth: depth + 1, branch: 'No', path: [...path, 'no'] })
      } else {
        rows.push({ type: 'branch', branch: 'No', depth: depth + 1, path: [...path, 'no'] })
        rows.push(...flattenTree(node.no, depth + 1, [...path, 'no']))
      }
    }
  }
  return rows
}

const rows = flattenTree(tree)
</script>

<template>
  <div class="decision-tree" role="img" aria-label="Decision tree for choosing the right Cycles integration pattern">
    <template v-for="(row, i) in rows" :key="i">
      <div v-if="row.type === 'question'" class="dt-node dt-question" :style="{ marginLeft: row.depth * 24 + 'px' }">
        <span class="dt-icon">?</span>
        <div class="dt-content">
          <span class="dt-text">{{ row.text }}</span>
          <span v-if="row.detail" class="dt-detail">{{ row.detail }}</span>
        </div>
      </div>
      <div v-else-if="row.type === 'branch'" class="dt-node dt-branch" :style="{ marginLeft: row.depth * 24 + 'px' }">
        <span class="dt-badge" :class="row.branch === 'Yes' ? 'dt-badge--yes' : 'dt-badge--no'">{{ row.branch }}</span>
      </div>
      <div v-else-if="row.type === 'answer'" class="dt-node dt-answer" :style="{ marginLeft: row.depth * 24 + 'px' }">
        <span class="dt-badge" :class="row.branch === 'Yes' ? 'dt-badge--yes' : 'dt-badge--no'">{{ row.branch }}</span>
        <div class="dt-content">
          <component :is="row.link ? 'a' : 'span'" :href="row.link || undefined" class="dt-answer-text">→ {{ row.text }}</component>
          <span v-if="row.detail" class="dt-detail">{{ row.detail }}</span>
        </div>
      </div>
    </template>
    <div class="visually-hidden">
      Decision tree for choosing the right Cycles integration pattern:
      Q: Is the agent an MCP-compatible host (Claude Desktop, Claude Code, Cursor, Windsurf)?
        Yes → Use the MCP Server (@runcycles/mcp-server) — zero code changes.
        No →
      Q: Is it an agent framework with lifecycle hooks (OpenAI Agents SDK, OpenClaw)?
        Yes → Use the framework plugin (runcycles-openai-agents, openclaw-budget-guard).
        No →
      Q: Is the call streaming?
        Yes → Use reserveForStream (TS), ReservationGuard (Rust), or programmatic client (Python).
        No →
      Q: Is budget logic per-request in a web framework?
        Yes → Use middleware (Express, FastAPI, Axum, Actix).
        No →
      Q: Do you need fine-grained control over commit timing?
        Yes → Use programmatic client or ReservationGuard (Rust).
        No → Use decorator/wrapper (@cycles Python / withCycles TS / with_cycles Rust / @Cycles Java).
    </div>
  </div>
</template>

<style scoped>
.decision-tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 24px 0;
  max-width: 640px;
}

.dt-node {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
}

.dt-question {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
}

.dt-branch {
  padding: 4px 12px;
}

.dt-answer {
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
}

.dt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  font-size: 12px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
  margin-top: 1px;
}

.dt-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dt-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.4;
}

.dt-detail {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.dt-answer-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

a.dt-answer-text:hover {
  text-decoration: underline;
}

.dt-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.dt-badge--yes {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-1);
}

.dt-badge--no {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
}

@media (max-width: 480px) {
  .dt-node { padding: 6px 8px; }
  .dt-text { font-size: 12px; }
  .dt-detail { font-size: 11px; }
}
</style>
