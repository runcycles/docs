/**
 * Build-time data loader that aggregates total installs across all
 * distribution channels: npm, PyPI, crates.io, Maven Central, and GHCR.
 *
 * Uses per-source high-water mark caches (installs-cache.json) so the
 * displayed number never decreases — even if an API is down or returns
 * partial data. Each source is tracked independently to prevent a
 * rolling-window source (like PyPI last_month) from masking growth in
 * an all-time source (like npm).
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export interface InstallsData {
  total: number
  fetchedAt: string
}

export declare const data: InstallsData

interface InstallsCache {
  npm: number
  pypi: number
  crates: number
  ghcr: number
  maven: number
  total: number
  fetchedAt: string
}

const CACHE_PATH = resolve(process.cwd(), '.vitepress/theme/installs-cache.json')
const PUBLIC_PATH = resolve(process.cwd(), 'public/installs.json')

function readCache(): InstallsCache {
  try {
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
    return {
      npm: raw.npm ?? 0,
      pypi: raw.pypi ?? 0,
      crates: raw.crates ?? 0,
      ghcr: raw.ghcr ?? 0,
      maven: raw.maven ?? 0,
      total: raw.total ?? 0,
      fetchedAt: raw.fetchedAt ?? '',
    }
  } catch {
    return { npm: 0, pypi: 0, crates: 0, ghcr: 0, maven: 0, total: 0, fetchedAt: '' }
  }
}

function writeCache(data: InstallsCache): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(data) + '\n')
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

// ── crates.io ────────────────────────────────────────────────────────
const CRATES_PACKAGES = [
  'runcycles',
]

async function fetchCratesDownloads(): Promise<number> {
  const totals = await Promise.all(
    CRATES_PACKAGES.map(async (pkg) => {
      try {
        const res = await fetch(
          `https://crates.io/api/v1/crates/${pkg}`,
          { headers: { 'User-Agent': 'runcycles-docs (https://github.com/runcycles/docs)' } }
        )
        if (!res.ok) return 0
        const json = await res.json() as { crate?: { downloads?: number } }
        return json.crate?.downloads ?? 0
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
    const [npmFetched, pypiFetched, cratesFetched, ghcrFetched, mavenFetched] = await Promise.all([
      fetchNpmDownloads(),
      fetchPypiDownloads(),
      fetchCratesDownloads(),
      fetchGhcrPulls(),
      fetchMavenDownloads(),
    ])

    const cached = readCache()

    // Per-source high-water marks: each source never decreases independently
    const npm = Math.max(npmFetched, cached.npm)
    const pypi = Math.max(pypiFetched, cached.pypi)
    const crates = Math.max(cratesFetched, cached.crates)
    const ghcr = Math.max(ghcrFetched, cached.ghcr)
    const maven = Math.max(mavenFetched, cached.maven)
    const sum = npm + pypi + crates + ghcr + maven

    // Guard against legacy cache where total might exceed the sum of
    // per-source zeros (one-time migration from old {total}-only format)
    const total = Math.max(sum, cached.total)

    console.log(
      `[installs] npm=${npmFetched}(hwm:${npm}) pypi=${pypiFetched}(hwm:${pypi})` +
      ` crates=${cratesFetched}(hwm:${crates})` +
      ` ghcr=${ghcrFetched} maven=${mavenFetched} total=${total} cached=${cached.total}`
    )

    const now = new Date().toISOString()
    const newCache: InstallsCache = { npm, pypi, crates, ghcr, maven, total, fetchedAt: now }

    if (total > cached.total || npm > cached.npm || pypi > cached.pypi
        || crates > cached.crates || ghcr > cached.ghcr || maven > cached.maven) {
      writeCache(newCache)
    }

    // Write public/installs.json for runtime refresh in HomeSocialProof.vue
    try {
      writeFileSync(PUBLIC_PATH, JSON.stringify({ total, fetchedAt: now }) + '\n')
    } catch { /* non-critical */ }

    return { total, fetchedAt: now }
  },
}
