import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const specPath = process.env.SPEC_PATH || resolve(__dirname, '../../cycles-protocol/cycles-protocol-v0.yaml')
const outPath = resolve(__dirname, '../public/openapi.json')

mkdirSync(dirname(outPath), { recursive: true })

const yaml = readFileSync(specPath, 'utf-8')
const json = JSON.stringify(YAML.parse(yaml), null, 2)
writeFileSync(outPath, json)

console.log(`Converted ${specPath} → ${outPath}`)
