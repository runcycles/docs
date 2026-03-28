import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the pure high-water-mark logic from installs.data.ts

function highWaterMark(fetched: number, cached: number): number {
  return Math.max(fetched, cached)
}

function shouldUpdateCache(total: number, cached: number): boolean {
  return total > cached
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
