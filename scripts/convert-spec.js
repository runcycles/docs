import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))

function convertSpec(name, candidates, outFile, { copyYaml } = {}) {
  const specPath = candidates.filter(Boolean).find(p => existsSync(p))
  if (!specPath) {
    console.error(`Could not find ${name}. Searched:\n` + candidates.filter(Boolean).map(p => '  ' + p).join('\n'))
    process.exit(1)
  }
  const outPath = resolve(__dirname, '../public', outFile)
  mkdirSync(dirname(outPath), { recursive: true })
  const yamlContent = readFileSync(specPath, 'utf-8')
  const json = JSON.stringify(YAML.parse(yamlContent), null, 2)
  writeFileSync(outPath, json)
  console.log(`Converted ${specPath} → ${outPath}`)
  if (copyYaml) {
    const yamlOutPath = resolve(__dirname, '../public', copyYaml)
    writeFileSync(yamlOutPath, yamlContent)
    console.log(`Copied ${specPath} → ${yamlOutPath}`)
  }
}

// Cycles Protocol spec
convertSpec('cycles-protocol-v0.yaml', [
  process.env.SPEC_PATH,
  resolve(__dirname, '../../cycles-protocol/cycles-protocol-v0.yaml'),   // local dev (sibling repo)
  resolve(__dirname, '../cycles-protocol/cycles-protocol-v0.yaml'),      // CI (checked out into workspace)
], 'openapi.json', { copyYaml: 'cycles-protocol-v0.yaml' })

// Admin API spec
convertSpec('complete-budget-governance YAML', [
  process.env.ADMIN_SPEC_PATH,
  resolve(__dirname, '../../cycles-server-admin/complete-budget-governance-v0.1.24.yaml'),  // local dev (sibling repo)
  resolve(__dirname, '../cycles-server-admin/complete-budget-governance-v0.1.24.yaml'),     // CI (checked out into workspace)
], 'admin-openapi.json')
