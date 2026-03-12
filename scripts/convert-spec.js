import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const candidates = [
  process.env.SPEC_PATH,
  resolve(__dirname, '../../cycles-protocol/cycles-protocol-v0.yaml'),   // local dev (sibling repo)
  resolve(__dirname, '../cycles-protocol/cycles-protocol-v0.yaml'),      // CI (checked out into workspace)
].filter(Boolean)
const specPath = candidates.find(p => existsSync(p))
if (!specPath) {
  console.error('Could not find cycles-protocol-v0.yaml. Searched:\n' + candidates.map(p => '  ' + p).join('\n'))
  console.error('Set SPEC_PATH env var to the correct location.')
  process.exit(1)
}
const outPath = resolve(__dirname, '../public/openapi.json')

mkdirSync(dirname(outPath), { recursive: true })

const yaml = readFileSync(specPath, 'utf-8')
const json = JSON.stringify(YAML.parse(yaml), null, 2)
writeFileSync(outPath, json)

console.log(`Converted ${specPath} → ${outPath}`)
