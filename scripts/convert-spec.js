import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Recursively resolve internal $ref pointers against the root spec.
 * Unresolvable refs (e.g. missing components/responses) are left as-is.
 * The `stack` set tracks the current resolution chain to detect true circular refs.
 */
function derefInternal(node, root, stack = new Set()) {
  if (node === null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(item => derefInternal(item, root, stack))

  if (node.$ref && typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
    if (stack.has(node.$ref)) return node // true circular ref, leave as-is
    const pointer = node.$ref.substring(2).split('/')
    let resolved = root
    for (const token of pointer) {
      resolved = resolved?.[decodeURIComponent(token.replace(/~1/g, '/').replace(/~0/g, '~'))]
      if (resolved === undefined) return node // unresolvable, leave as-is
    }
    stack.add(node.$ref)
    const result = derefInternal(resolved, root, stack)
    stack.delete(node.$ref)
    return result
  }

  const result = {}
  for (const [key, value] of Object.entries(node)) {
    result[key] = derefInternal(value, root, stack)
  }
  return result
}

function convertSpec(name, candidates, outFile, { copyYaml } = {}) {
  const specPath = candidates.filter(Boolean).find(p => existsSync(p))
  if (!specPath) {
    console.error(`Could not find ${name}. Searched:\n` + candidates.filter(Boolean).map(p => '  ' + p).join('\n'))
    process.exit(1)
  }
  const outPath = resolve(__dirname, '../public', outFile)
  mkdirSync(dirname(outPath), { recursive: true })
  const yamlContent = readFileSync(specPath, 'utf-8')
  const parsed = YAML.parse(yamlContent)
  const dereferenced = derefInternal(parsed, parsed)
  const json = JSON.stringify(dereferenced, null, 2)
  writeFileSync(outPath, json)
  console.log(`Converted ${specPath} → ${outPath} (dereferenced)`)
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
