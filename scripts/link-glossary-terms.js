#!/usr/bin/env node
/**
 * Auto-link first occurrences of glossary terms in blog posts to their
 * canonical definitions in /glossary.
 *
 * For each blog post:
 *   1. Parses glossary.md to extract terms + anchor slugs
 *   2. For each term, finds the first unlinked occurrence in the post body
 *   3. Wraps it in [term](/glossary#anchor)
 *
 * Rules:
 *   - Skips first occurrences inside code blocks, inline code, existing links
 *   - Skips the post's own H1 and frontmatter
 *   - Only links the first occurrence per term per post
 *   - Case-insensitive matching but preserves original casing
 *   - Skips terms shorter than 4 chars (too noisy)
 *   - Preserves existing links to /glossary
 *
 * Usage:
 *   node scripts/link-glossary-terms.js --dry-run    # preview changes
 *   node scripts/link-glossary-terms.js              # apply changes
 *   node scripts/link-glossary-terms.js --file=blog/foo.md  # single file
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GLOSSARY_PATH = join(ROOT, 'glossary.md')
const BLOG_DIR = join(ROOT, 'blog')

// Terms to skip — too common, too short, or ambiguous in prose
const SKIP_TERMS = new Set([
  'Token', 'Balance', 'Release', 'Actual', 'Estimate', 'Commit', 'Extend',
  'Scope', 'Subject', 'Heartbeat', 'Webhook', 'Guardrail', 'Event',
  'Decide', 'Cap / Budget Cap', 'Event / Direct Debit',
])

function slugify(term) {
  return term
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')  // remove parenthetical
    .replace(/\s*\/\s*/g, '-')      // slash to dash
    .replace(/_/g, '-')             // underscore to dash (VitePress style)
    .replace(/[^a-z0-9\s-]/g, '')   // strip other non-alphanumerics
    .trim()
    .replace(/\s+/g, '-')           // spaces to dashes
    .replace(/-+/g, '-')            // collapse multiple dashes
}

function parseGlossary() {
  const content = readFileSync(GLOSSARY_PATH, 'utf-8')
  const terms = []
  const regex = /^### (.+?)$/gm
  let m
  while ((m = regex.exec(content)) !== null) {
    const term = m[1].trim()
    if (SKIP_TERMS.has(term)) continue
    if (term.length < 4) continue
    terms.push({
      term,
      anchor: slugify(term),
    })
  }
  // Sort by length descending — match longer terms first
  // (so "authority attenuation" matches before "authority")
  terms.sort((a, b) => b.term.length - a.term.length)
  return terms
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) return { frontmatter: '', body: content }
  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  }
}

function extractProtectedRanges(body) {
  // Find ranges we must NOT modify: code blocks, inline code, existing links
  const ranges = []

  // Fenced code blocks
  const fencedRegex = /```[\s\S]*?```/g
  let m
  while ((m = fencedRegex.exec(body)) !== null) {
    ranges.push([m.index, m.index + m[0].length])
  }

  // Inline code
  const inlineRegex = /`[^`\n]+`/g
  while ((m = inlineRegex.exec(body)) !== null) {
    ranges.push([m.index, m.index + m[0].length])
  }

  // Existing markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\([^)]+\)/g
  while ((m = linkRegex.exec(body)) !== null) {
    ranges.push([m.index, m.index + m[0].length])
  }

  // All headings (H1-H6) — don't link inside headings
  const headingRegex = /^#{1,6} .+$/gm
  while ((m = headingRegex.exec(body)) !== null) {
    ranges.push([m.index, m.index + m[0].length])
  }

  // Final resource links section (after last ---)
  // Many posts end with an "Additional Resources" list; keep those untouched
  const lastRuleIdx = body.lastIndexOf('\n---\n')
  if (lastRuleIdx > body.length * 0.7) {
    ranges.push([lastRuleIdx, body.length])
  }

  return ranges
}

function isInProtectedRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end)
}

function buildTermRegex(term) {
  // Escape regex metacharacters
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match as whole word (case-insensitive)
  // Handle plural by allowing optional 's' at end
  return new RegExp(`\\b(${escaped})s?\\b`, 'gi')
}

function findFirstMatch(body, term, protectedRanges) {
  const regex = buildTermRegex(term)
  let m
  while ((m = regex.exec(body)) !== null) {
    if (!isInProtectedRange(m.index, protectedRanges)) {
      return { index: m.index, match: m[0] }
    }
  }
  return null
}

function processPost(filePath, terms, dryRun) {
  const content = readFileSync(filePath, 'utf-8')
  const { frontmatter, body } = extractFrontmatter(content)
  const protectedRanges = extractProtectedRanges(body)

  // Terms are pre-sorted longest-first. As we accept matches, we treat their
  // ranges as protected so shorter overlapping terms (e.g. "tenant" inside
  // "tenant isolation") won't also match.
  const replacements = []
  const allProtected = [...protectedRanges]
  for (const { term, anchor } of terms) {
    const found = findFirstMatch(body, term, allProtected)
    if (!found) continue
    replacements.push({ term, anchor, ...found })
    allProtected.push([found.index, found.index + found.match.length])
  }

  if (replacements.length === 0) return { changed: false, replacements: [] }

  // Apply replacements from end to start to preserve indices
  replacements.sort((a, b) => b.index - a.index)

  let newBody = body
  for (const r of replacements) {
    const before = newBody.slice(0, r.index)
    const after = newBody.slice(r.index + r.match.length)
    newBody = before + `[${r.match}](/glossary#${r.anchor})` + after
  }

  if (!dryRun) {
    writeFileSync(filePath, frontmatter + newBody, 'utf-8')
  }

  return { changed: true, replacements: replacements.reverse() }
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const fileArg = args.find(a => a.startsWith('--file='))
  const singleFile = fileArg ? fileArg.slice('--file='.length) : null

  const terms = parseGlossary()
  console.log(`Loaded ${terms.length} glossary terms (after filtering).`)
  console.log(dryRun ? '\n=== DRY RUN (no files written) ===\n' : '\n=== APPLYING CHANGES ===\n')

  const EXCLUDE = new Set(['index.md', 'README.md'])
  const files = singleFile
    ? [singleFile]
    : readdirSync(BLOG_DIR)
        .filter(f => f.endsWith('.md') && !EXCLUDE.has(f))
        .map(f => join('blog', f))

  let totalChanged = 0
  let totalLinks = 0

  for (const relPath of files) {
    const absPath = join(ROOT, relPath)
    const result = processPost(absPath, terms, dryRun)
    if (result.changed) {
      totalChanged++
      totalLinks += result.replacements.length
      console.log(`${relPath}: ${result.replacements.length} link(s)`)
      for (const r of result.replacements) {
        console.log(`  + [${r.match}] → /glossary#${r.anchor}`)
      }
    }
  }

  console.log(`\nSummary: ${totalLinks} links added across ${totalChanged} files`)
  if (dryRun) console.log('(dry-run: no files written)')
}

main()
