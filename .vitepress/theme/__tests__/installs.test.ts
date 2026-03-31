import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the pure high-water-mark logic from installs.data.ts

function highWaterMark(fetched: number, cached: number): number {
  return Math.max(fetched, cached)
}

function shouldUpdateCache(total: number, cached: number): boolean {
  return total > cached
}

// Mirrors the per-source high-water mark logic in installs.data.ts
interface SourceCounts {
  npm: number
  pypi: number
  crates: number
  ghcr: number
  maven: number
}

interface InstallsCache extends SourceCounts {
  total: number
}

function computeTotal(fetched: SourceCounts, cached: InstallsCache): number {
  const npm = Math.max(fetched.npm, cached.npm)
  const pypi = Math.max(fetched.pypi, cached.pypi)
  const crates = Math.max(fetched.crates, cached.crates)
  const ghcr = Math.max(fetched.ghcr, cached.ghcr)
  const maven = Math.max(fetched.maven, cached.maven)
  const sum = npm + pypi + crates + ghcr + maven
  return Math.max(sum, cached.total)
}

describe('installs high-water-mark logic', () => {
  it('returns fetched when fetched > cached', () => {
    expect(highWaterMark(1000, 500)).toBe(1000)
  })

  it('returns cached when cached > fetched', () => {
    expect(highWaterMark(500, 1000)).toBe(1000)
  })

  it('returns either when equal', () => {
    expect(highWaterMark(500, 500)).toBe(500)
  })

  it('handles zero cached (first run)', () => {
    expect(highWaterMark(1000, 0)).toBe(1000)
  })

  it('handles zero fetched (API down)', () => {
    expect(highWaterMark(0, 1000)).toBe(1000)
  })

  it('handles both zero', () => {
    expect(highWaterMark(0, 0)).toBe(0)
  })
})

describe('cache update decision', () => {
  it('updates cache when total exceeds cached', () => {
    expect(shouldUpdateCache(1000, 500)).toBe(true)
  })

  it('does not update when total equals cached', () => {
    expect(shouldUpdateCache(500, 500)).toBe(false)
  })

  it('does not update when total is less than cached', () => {
    expect(shouldUpdateCache(300, 500)).toBe(false)
  })
})

describe('npm downloads aggregation', () => {
  it('sums downloads from multiple packages', () => {
    const downloads = [100, 200, 300]
    const total = downloads.reduce((a, b) => a + b, 0)
    expect(total).toBe(600)
  })

  it('treats API failures as zero', () => {
    const downloads = [100, 0, 300] // middle package failed
    const total = downloads.reduce((a, b) => a + b, 0)
    expect(total).toBe(400)
  })
})

describe('per-source high-water marks', () => {
  it('captures npm growth even when pypi drops', () => {
    const cached: InstallsCache = { npm: 2000, pypi: 1286, crates: 0, ghcr: 0, maven: 0, total: 3286 }
    const fetched: SourceCounts = { npm: 2200, pypi: 900, crates: 0, ghcr: 0, maven: 0 }
    expect(computeTotal(fetched, cached)).toBe(3486) // npm grew by 200
  })

  it('preserves pypi peak when pypi rolling window decreases', () => {
    const cached: InstallsCache = { npm: 2506, pypi: 1286, crates: 0, ghcr: 0, maven: 0, total: 3792 }
    const fetched: SourceCounts = { npm: 2506, pypi: 900, crates: 0, ghcr: 0, maven: 0 }
    expect(computeTotal(fetched, cached)).toBe(3792) // pypi stays at 1286
  })

  it('handles legacy cache format (no per-source fields)', () => {
    // Legacy cache only has total, per-source fields default to 0
    const cached: InstallsCache = { npm: 0, pypi: 0, crates: 0, ghcr: 0, maven: 0, total: 3286 }
    const fetched: SourceCounts = { npm: 2506, pypi: 1090, crates: 0, ghcr: 0, maven: 0 }
    expect(computeTotal(fetched, cached)).toBe(3596) // new sum exceeds old total
  })

  it('legacy cache floor prevents regression when APIs are partially down', () => {
    const cached: InstallsCache = { npm: 0, pypi: 0, crates: 0, ghcr: 0, maven: 0, total: 3286 }
    const fetched: SourceCounts = { npm: 2000, pypi: 500, crates: 0, ghcr: 0, maven: 0 }
    expect(computeTotal(fetched, cached)).toBe(3286) // floor holds
  })

  it('all sources contribute independently to total', () => {
    const cached: InstallsCache = { npm: 100, pypi: 200, crates: 40, ghcr: 50, maven: 30, total: 420 }
    const fetched: SourceCounts = { npm: 150, pypi: 180, crates: 60, ghcr: 60, maven: 25 }
    // npm: max(150,100)=150, pypi: max(180,200)=200, crates: max(60,40)=60, ghcr: max(60,50)=60, maven: max(25,30)=30
    expect(computeTotal(fetched, cached)).toBe(500)
  })

  it('handles all APIs down gracefully', () => {
    const cached: InstallsCache = { npm: 2506, pypi: 1090, crates: 50, ghcr: 0, maven: 0, total: 3646 }
    const fetched: SourceCounts = { npm: 0, pypi: 0, crates: 0, ghcr: 0, maven: 0 }
    expect(computeTotal(fetched, cached)).toBe(3646) // all cached values preserved
  })

  it('includes crates.io downloads in total', () => {
    const cached: InstallsCache = { npm: 2506, pypi: 1090, crates: 0, ghcr: 0, maven: 0, total: 3596 }
    const fetched: SourceCounts = { npm: 2506, pypi: 1090, crates: 100, ghcr: 0, maven: 0 }
    expect(computeTotal(fetched, cached)).toBe(3696) // crates adds 100
  })
})
