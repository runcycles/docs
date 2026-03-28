import { describe, it, expect } from 'vitest'

// Test the frontmatter parsing logic from rss.ts

function parseFrontmatter(raw: string): Record<string, any> {
  const frontmatter: Record<string, any> = {}
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const lines = fmMatch[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^(\w+):\s*(.+)/)
      if (m) {
        let val: any = m[2].trim()
        if (val.startsWith('[') && val.endsWith(']')) {
          val = val.slice(1, -1).split(',').map((s: string) => s.trim())
        }
        frontmatter[m[1]] = val
      }
    }
  }
  return frontmatter
}

describe('frontmatter parsing', () => {
  it('parses simple key-value pairs', () => {
    const raw = `---
title: My Post
author: Jane Doe
---
# Content`
    const fm = parseFrontmatter(raw)
    expect(fm.title).toBe('My Post')
    expect(fm.author).toBe('Jane Doe')
  })

  it('parses array values in brackets', () => {
    const raw = `---
tags: [cycles, budgets, ai]
---
Content`
    const fm = parseFrontmatter(raw)
    expect(fm.tags).toEqual(['cycles', 'budgets', 'ai'])
  })

  it('returns empty object for content without frontmatter', () => {
    const raw = '# Just a heading\nSome content'
    const fm = parseFrontmatter(raw)
    expect(fm).toEqual({})
  })

  it('handles boolean-like values as strings', () => {
    const raw = `---
blog: true
featured: false
---`
    const fm = parseFrontmatter(raw)
    expect(fm.blog).toBe('true')
    expect(fm.featured).toBe('false')
  })

  it('handles date values', () => {
    const raw = `---
date: 2025-03-15
---`
    const fm = parseFrontmatter(raw)
    expect(fm.date).toBe('2025-03-15')
  })
})

describe('blog post filtering', () => {
  it('filters posts with blog: true', () => {
    const posts = [
      { frontmatter: { blog: true, title: 'Post 1' } },
      { frontmatter: { blog: false, title: 'Not a post' } },
      { frontmatter: { title: 'Also not a post' } },
    ]
    const blogPosts = posts.filter(p => p.frontmatter.blog === true)
    expect(blogPosts).toHaveLength(1)
    expect(blogPosts[0].frontmatter.title).toBe('Post 1')
  })
})
