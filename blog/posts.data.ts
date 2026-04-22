import { createContentLoader } from 'vitepress'

export interface PostData {
  title: string
  url: string
  date: string
  author: string
  tags: string[]
  description: string
  readingTime: number
  featured: boolean
  image: string | null
}

export declare const data: PostData[]

function estimateReadingTime(html: string): number {
  let text = html
  let prev: string
  do {
    prev = text
    text = text.replace(/<[^>]*>/g, '')
  } while (text !== prev)
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 230))
}

export default createContentLoader('blog/**/*.md', {
  render: true,
  transform(raw) {
    return raw
      .filter(page => page.frontmatter.blog === true)
      .map(page => ({
        title: page.frontmatter.title,
        url: page.url,
        date: new Date(page.frontmatter.date).toISOString(),
        author: page.frontmatter.author ?? 'Cycles Team',
        tags: page.frontmatter.tags ?? [],
        description: page.frontmatter.description ?? '',
        readingTime: estimateReadingTime(page.html ?? ''),
        featured: page.frontmatter.featured === true,
        image: page.frontmatter.image ?? null,
      }))
      .sort((a, b) => {
        // Strict reverse-chronological. Featured posts are surfaced via a
        // dedicated strip in BlogIndex.vue, not by queue-jumping the main
        // stream — so new writing always lands on page 1.
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title)
      })
  },
})
