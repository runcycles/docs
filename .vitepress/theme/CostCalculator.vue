<script setup>
import { ref, computed } from 'vue'

/*
  Defaults reflect each provider's published per-million-token pricing as of
  2026-04. Verify against the source before relying on these for budgeting:
   - OpenAI:    https://developers.openai.com/api/docs/pricing
   - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
  Excludes prompt caching, batch API discounts, fine-tuning, fast mode,
  and data-residency premiums. Add or remove rows in the UI as releases change.
*/

const inputTokens = ref(2000)
const outputTokens = ref(800)
const callsPerDay = ref(10000)

const models = ref([
  { name: 'GPT-5.5',           inputPerM: 5.00, outputPerM: 30.00 },
  { name: 'GPT-5.4',           inputPerM: 2.50, outputPerM: 15.00 },
  { name: 'GPT-5.4-mini',      inputPerM: 0.75, outputPerM:  4.50 },
  { name: 'GPT-5.4-nano',      inputPerM: 0.20, outputPerM:  1.25 },
  { name: 'Claude Opus 4.7',   inputPerM: 5.00, outputPerM: 25.00 },
  { name: 'Claude Opus 4.6',   inputPerM: 5.00, outputPerM: 25.00 },
  { name: 'Claude Sonnet 4.6', inputPerM: 3.00, outputPerM: 15.00 },
  { name: 'Claude Haiku 4.5',  inputPerM: 1.00, outputPerM:  5.00 },
])

function addModel() {
  models.value.push({ name: 'New model', inputPerM: 0, outputPerM: 0 })
}
function removeModel(i) {
  models.value.splice(i, 1)
}

const rows = computed(() =>
  models.value.map(m => {
    const perCall =
      (Number(inputTokens.value)  / 1_000_000) * Number(m.inputPerM) +
      (Number(outputTokens.value) / 1_000_000) * Number(m.outputPerM)
    const perDay   = perCall * Number(callsPerDay.value)
    const perMonth = perDay * 30
    const perYear  = perDay * 365
    return { ...m, perCall, perDay, perMonth, perYear }
  })
)

const cheapestPerYear = computed(() =>
  Math.min(...rows.value.map(r => r.perYear))
)

function fmt(v) {
  if (v >= 100) return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  if (v >= 1)   return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 })
}
</script>

<template>
  <section class="cost-calc">
    <div class="inputs">
      <label class="field">
        <span class="field-label">Input tokens / call</span>
        <input v-model.number="inputTokens" type="number" min="0" step="100" />
      </label>
      <label class="field">
        <span class="field-label">Output tokens / call</span>
        <input v-model.number="outputTokens" type="number" min="0" step="50" />
      </label>
      <label class="field">
        <span class="field-label">Calls / day</span>
        <input v-model.number="callsPerDay" type="number" min="0" step="100" />
      </label>
    </div>

    <div class="table-wrap">
      <table class="cost-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Input $ / M</th>
            <th>Output $ / M</th>
            <th>Per call</th>
            <th>Per day</th>
            <th>Per month</th>
            <th>Per year</th>
            <th aria-label="Remove"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i" :class="{ best: row.perYear > 0 && row.perYear === cheapestPerYear }">
            <td><input v-model="models[i].name" type="text" class="name-input" /></td>
            <td><input v-model.number="models[i].inputPerM"  type="number" min="0" step="0.01" class="rate-input" /></td>
            <td><input v-model.number="models[i].outputPerM" type="number" min="0" step="0.01" class="rate-input" /></td>
            <td>{{ fmt(row.perCall) }}</td>
            <td>{{ fmt(row.perDay) }}</td>
            <td>{{ fmt(row.perMonth) }}</td>
            <td class="year-cell">{{ fmt(row.perYear) }}</td>
            <td><button type="button" class="row-remove" @click="removeModel(i)" aria-label="Remove model">×</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="add-row" @click="addModel">+ Add model</button>
    </div>

    <p class="disclaimer">
      Defaults reflect published list pricing as of 2026-04 from
      <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noopener">OpenAI</a>
      and
      <a href="https://platform.claude.com/docs/en/about-claude/pricing" target="_blank" rel="noopener">Anthropic</a>;
      verify before relying on these for budgeting and edit any cell to match your contracted rate.
      Calculation: <code>(input_tokens × input_$/M + output_tokens × output_$/M) ÷ 1,000,000 × calls/day</code>.
      Excludes prompt caching, batch discounts, fine-tuning, fast-mode, and data-residency premiums.
    </p>
  </section>
</template>

<style scoped>
.cost-calc {
  container-type: inline-size;
  margin: 24px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.inputs {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-bottom: 20px;
}
@container (min-width: 600px) { .inputs { grid-template-columns: repeat(3, 1fr); } }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.field input {
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.field input:focus { outline: 2px solid var(--vp-c-brand-1); outline-offset: 1px; border-color: var(--vp-c-brand-1); }

.table-wrap { overflow-x: auto; margin: 0 -4px; }
.cost-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.cost-table th, .cost-table td {
  padding: 10px 12px;
  text-align: right;
  border-bottom: 1px solid var(--vp-c-divider);
  white-space: nowrap;
}
.cost-table th {
  text-align: right;
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 2px solid var(--vp-c-divider);
}
.cost-table th:first-child, .cost-table td:first-child { text-align: left; }
.year-cell  { font-weight: 600; }

.name-input {
  width: 160px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-1);
  font: inherit;
  font-weight: 600;
}
.name-input:hover { border-color: var(--vp-c-divider); }
.name-input:focus { outline: 2px solid var(--vp-c-brand-1); outline-offset: 1px; border-color: var(--vp-c-brand-1); background: var(--vp-c-bg); }

.row-remove {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
}
.row-remove:hover { color: var(--vp-c-danger-1, #e11d48); border-color: var(--vp-c-divider); background: var(--vp-c-bg-mute); }

.add-row {
  margin-top: 12px;
  padding: 8px 14px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.add-row:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); border-style: solid; }

.rate-input {
  width: 80px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-1);
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.rate-input:hover  { border-color: var(--vp-c-divider); }
.rate-input:focus  { outline: 2px solid var(--vp-c-brand-1); outline-offset: 1px; border-color: var(--vp-c-brand-1); background: var(--vp-c-bg); }

.cost-table tr.best { background: color-mix(in srgb, var(--vp-c-brand-1) 6%, transparent); }
.cost-table tr.best .year-cell { color: var(--vp-c-brand-1); }

.disclaimer {
  margin: 16px 0 0;
  padding: 10px 12px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-mute);
  border-radius: 8px;
}
.disclaimer code {
  font-size: 11.5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--vp-c-bg);
}
</style>
