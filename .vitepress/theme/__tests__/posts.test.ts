import { describe, it, expect } from 'vitest'

// Re-implement the pure functions from posts.data.ts for testing.
// These are the exact same implementations used in the content loader.

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 230))
}

interface PostData {
  title: string
  date: string
  featured: boolean
}

function sortPosts(posts: PostData[]): PostData[] {
  return [...posts].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (dateDiff !== 0) return dateDiff
    return a.title.localeCompare(b.title)
  })
}

describe('estimateReadingTime', () => {
  it('returns 1 for empty content', () => {
    expect(estimateReadingTime('')).toBe(1)
  })

  it('returns 1 for short content', () => {
    expect(estimateReadingTime('<p>Hello world</p>')).toBe(1)
  })

  it('strips HTML tags before counting words', () => {
    const html = '<h1>Title</h1><p>Some <strong>bold</strong> text here.</p>'
    // Words: Title, Some, bold, text, here. = 5 words
    expect(estimateReadingTime(html)).toBe(1) // 5/230 rounds up to 1
  })

  it('calculates correctly for longer content', () => {
    // 460 words = 2 minutes
    const words = Array(460).fill('word').join(' ')
    expect(estimateReadingTime(words)).toBe(2)
  })

  it('rounds up partial minutes', () => {
    // 231 words = ceil(231/230) = 2 minutes
    const words = Array(231).fill('word').join(' ')
    expect(estimateReadingTime(words)).toBe(2)
  })
})

describe('sortPosts', () => {
  it('puts featured posts first', () => {
    const posts: PostData[] = [
      { title: 'Regular', date: '2025-03-01', featured: false },
      { title: 'Featured', date: '2025-01-01', featured: true },
    ]
    const sorted = sortPosts(posts)
    expect(sorted[0].title).toBe('Featured')
  })

  it('sorts by date descending within same featured status', () => {
    const posts: PostData[] = [
      { title: 'Older', date: '2025-01-01', featured: false },
      { title: 'Newer', date: '2025-03-01', featured: false },
    ]
    const sorted = sortPosts(posts)
    expect(sorted[0].title).toBe('Newer')
    expect(sorted[1].title).toBe('Older')
  })

  it('sorts by title alphabetically when dates are equal', () => {
    const posts: PostData[] = [
      { title: 'Bravo', date: '2025-01-01', featured: false },
      { title: 'Alpha', date: '2025-01-01', featured: false },
    ]
    const sorted = sortPosts(posts)
    expect(sorted[0].title).toBe('Alpha')
    expect(sorted[1].title).toBe('Bravo')
  })

  it('does not mutate the original array', () => {
    const posts: PostData[] = [
      { title: 'B', date: '2025-02-01', featured: false },
      { title: 'A', date: '2025-01-01', featured: true },
    ]
    const original = [...posts]
    sortPosts(posts)
    expect(posts).toEqual(original)
  })
})
