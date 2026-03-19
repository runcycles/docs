import { createContentLoader } from 'vitepress'

export interface PostData {
  title: string
  url: string
  date: string
  author: string
  tags: string[]
  description: string
}

export declare const data: PostData[]

export default createContentLoader('blog/**/*.md', {
  transform(raw) {
    return raw
      .filter(page => page.url !== '/blog/')
      .map(page => ({
        title: page.frontmatter.title,
        url: page.url,
        date: page.frontmatter.date,
        author: page.frontmatter.author ?? 'Cycles Team',
        tags: page.frontmatter.tags ?? [],
        description: page.frontmatter.description ?? '',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
})
