/**
 * Build-time data loader that aggregates total installs across all
 * distribution channels: npm, PyPI, Maven Central, and GHCR.
 *
 * Uses a high-water mark cache (installs-cache.json) so the displayed
 * number never decreases — even if an API is down or returns partial data.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export interface InstallsData {
  total: number
  fetchedAt: string
}

export declare const data: InstallsData

const CACHE_PATH = resolve(process.cwd(), '.vitepress/theme/installs-cache.json')

function readCache(): number {
  try {
    const raw = readFileSync(CACHE_PATH, 'utf-8')
    return JSON.parse(raw).total ?? 0
  } catch {
    return 0
  }
}

function writeCache(total: number): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify({ total, fetchedAt: new Date().toISOString() }) + '\n')
  } catch { /* non-critical — CI environments may have read-only source dirs */ }
}

// ── npm ──────────────────────────────────────────────────────────────
const NPM_PACKAGES = [
  'runcycles',
  '@runcycles/mcp-server',
  '@runcycles/openclaw-budget-guard',
]

async function fetchNpmDownloads(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const totals = await Promise.all(
    NPM_PACKAGES.map(async (pkg) => {
      try {
        const res = await fetch(
          `https://api.npmjs.org/downloads/point/2020-01-01:${today}/${pkg}`
        )
        if (!res.ok) return 0
        const json = await res.json() as { downloads?: number }
        return json.downloads ?? 0
      } catch {
        return 0
      }
    })
  )
  return totals.reduce((a, b) => a + b, 0)
}

// ── PyPI ─────────────────────────────────────────────────────────────
const PYPI_PACKAGES = [
  'runcycles',
  'runcycles-openai-agents',
]

async function fetchPypiDownloads(): Promise<number> {
  const totals = await Promise.all(
    PYPI_PACKAGES.map(async (pkg) => {
      try {
        const res = await fetch(
          `https://pypistats.org/api/packages/${pkg}/recent`
        )
        if (!res.ok) return 0
        const json = await res.json() as { data?: { last_month?: number } }
        return json.data?.last_month ?? 0
      } catch {
        return 0
      }
    })
  )
  return totals.reduce((a, b) => a + b, 0)
}

// ── GHCR (GitHub Container Registry) ─────────────────────────────────
async function fetchGhcrPulls(): Promise<number> {
  // GitHub REST API doesn't expose container pull counts.
  // Requires GraphQL API with proper scopes — skip for now.
  return 0
}

// ── Maven Central ────────────────────────────────────────────────────
async function fetchMavenDownloads(): Promise<number> {
  // Maven Central has no public downloads API.
  // The search API only exposes versionCount, not download stats.
  return 0
}

// ── Loader ───────────────────────────────────────────────────────────
export default {
  async load(): Promise<InstallsData> {
    const [npm, pypi, ghcr, maven] = await Promise.all([
      fetchNpmDownloads(),
      fetchPypiDownloads(),
      fetchGhcrPulls(),
      fetchMavenDownloads(),
    ])
    const fetched = npm + pypi + ghcr + maven
    const cached = readCache()
    const total = Math.max(fetched, cached)
    console.log(`[installs] npm=${npm} pypi=${pypi} ghcr=${ghcr} maven=${maven} fetched=${fetched} cached=${cached} total=${total}`)
    if (total > cached) writeCache(total)
    return {
      total,
      fetchedAt: new Date().toISOString(),
    }
  },
}
