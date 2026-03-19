# Blog Authoring Guide

## Quick Start

Create a new markdown file in `docs/blog/`:

```bash
touch docs/blog/my-post-slug.md
```

Add the required frontmatter and write your content:

```markdown
---
title: Your Post Title
date: 2026-03-20
author: Your Name
tags: [engineering, announcement]
description: A one-line summary that appears on the blog index card and in og:description.
blog: true
sidebar: false
---

# Your Post Title

Your content here. Standard markdown — code blocks, images, links, etc.

<!-- more -->

Content after the fold. Everything above `<!-- more -->` becomes the excerpt.
```

That's it. VitePress picks it up automatically. No config changes needed.

---

## Frontmatter Reference

| Field         | Required | Description                                                        |
|---------------|----------|--------------------------------------------------------------------|
| `title`       | Yes      | Post title. Shown on the blog index card and in the browser tab.   |
| `date`        | Yes      | Publish date as `YYYY-MM-DD`. Used for sorting (newest first).     |
| `author`      | No       | Author name. Defaults to "Cycles Team" if omitted.                 |
| `tags`        | No       | Array of tags, e.g. `[engineering, release]`. Powers tag filtering. |
| `description` | Yes      | One-line summary for the index card and `og:description` meta tag. |
| `blog`        | Yes      | Must be `true`. Triggers the date/author/tags header on the post.  |
| `sidebar`     | Yes      | Must be `false`. Hides the docs sidebar on blog pages.             |

---

## File Naming & Slugs

The filename **is** the URL slug. VitePress uses it directly — there's no separate slug field.

### How to create a good slug

1. Take your post title
2. Lowercase it
3. Replace spaces with hyphens
4. Remove special characters (colons, commas, question marks, etc.)
5. Keep it short but descriptive

### Examples

| Post Title | Filename | URL |
|------------|----------|-----|
| Why Budget Authority Matters | `why-budget-authority-matters.md` | `/blog/why-budget-authority-matters` |
| Cycles v0.5: What's New | `cycles-v0-5-whats-new.md` | `/blog/cycles-v0-5-whats-new` |
| How We Handle 10K Concurrent Agents | `how-we-handle-10k-concurrent-agents.md` | `/blog/how-we-handle-10k-concurrent-agents` |
| Introducing MCP Support | `introducing-mcp-support.md` | `/blog/introducing-mcp-support` |

### Rules

- **Lowercase kebab-case only:** `my-post-title.md` (no spaces, underscores, or uppercase)
- **No special characters:** strip `:`, `,`, `?`, `!`, `'`, `"`, `(`, `)`, etc.
- **Keep it under ~60 chars** for clean URLs and social sharing
- **Use words, not dates** in the slug — the date goes in frontmatter, not the filename
- **Once published, don't rename** — it changes the URL and breaks existing links
- **Subdirectories work:** `blog/2026/my-post.md` → `/blog/2026/my-post`

---

## Full Workflow

### 1. Create your post

```bash
# From the repo root
cat > docs/blog/why-budget-authority-matters.md << 'FRONTMATTER'
---
title: Why Budget Authority Matters for Autonomous Agents
date: 2026-03-20
author: Jane Doe
tags: [engineering, deep-dive]
description: A technical look at why pre-execution budget enforcement is the missing layer in agent infrastructure.
blog: true
sidebar: false
---

# Why Budget Authority Matters for Autonomous Agents

Your markdown content goes here...
FRONTMATTER
```

### 2. Preview locally

```bash
cd docs
npm run dev
```

Open `http://localhost:5173/blog/` — your post should appear in the listing.
Click through to verify the date/author/tags header renders above your content.

### 3. Commit and push

```bash
git add docs/blog/why-budget-authority-matters.md
git commit -m "Add blog post: Why Budget Authority Matters"
git push
```

### 4. CI and deploy

- **CI** (`ci.yml`): Runs `npm run build` on every PR to `main`. Blog posts are included in the standard VitePress build — no extra steps.
- **Deploy** (`deploy.yml`): Automatically deploys to GitHub Pages when merged to `main`.

No workflow changes are needed. Blog posts are just markdown files that VitePress processes during the normal build.

---

## What Happens Automatically

When you add a blog post, the following happens at build time with **zero config changes**:

| What                        | How                                                                 |
|-----------------------------|---------------------------------------------------------------------|
| Post appears on blog index  | `posts.data.ts` scans `blog/**/*.md` via `createContentLoader`      |
| Sorted newest-first         | Sorted by `date` frontmatter, then alphabetically by title          |
| Tag filtering works         | `BlogIndex.vue` reads `tags` from frontmatter                       |
| Pagination                  | Blog index paginates at 10 posts per page                           |
| Reading time                | Estimated from word count (~230 wpm), shown on index and post pages |
| Date/author/tags header     | `BlogPost.vue` renders via `#doc-before` Layout slot                |
| Prev/Next navigation        | `BlogPostNav.vue` renders via `#doc-after` Layout slot              |
| Excerpt support             | Use `<!-- more -->` break; content above it becomes the excerpt     |
| SEO meta tags               | `transformPageData` sets `og:type=article`, `og:title`, `og:description`, `og:url`, `article:published_time`, `twitter:title`, `twitter:description` |
| Canonical URL               | Auto-generated: `https://runcycles.io/blog/<slug>`                  |
| RSS / Atom feeds            | Generated at build time: `/feed.xml` (RSS 2.0), `/feed.atom` (Atom)|
| Sitemap entry               | Auto-included by VitePress sitemap generator                        |
| Search indexed              | VitePress local search indexes all blog content                     |
| Edit link hidden            | "Edit this page" and "Last updated" are hidden on blog posts        |

---

## Architecture

```
docs/
├── blog/
│   ├── posts.data.ts              # Data loader — scans all blog posts at build time
│   ├── index.md                   # Blog landing page — renders <BlogIndex />
│   ├── introducing-cycles-blog.md # Example post
│   └── your-new-post.md           # ← Add posts here
├── .vitepress/
│   ├── config.ts                  # Nav link, sidebar config, OG meta, RSS head links
│   ├── rss.ts                     # RSS/Atom feed generation (runs at buildEnd)
│   └── theme/
│       ├── BlogIndex.vue          # Post listing with tag filtering and pagination
│       ├── BlogPost.vue           # Date/author/tags/reading-time header (guarded by frontmatter.blog)
│       ├── BlogPostNav.vue        # Previous/Next post navigation
│       ├── Layout.vue             # Injects BlogPost via #doc-before, BlogPostNav via #doc-after
│       ├── index.ts               # Registers BlogIndex + BlogPost globally
│       └── custom.css             # Blog styles (cards, tags, pagination, nav)
```

---

## Tips

- **No config changes needed** to add a post. Just create the markdown file.
- **Tags are freeform.** Use whatever makes sense: `engineering`, `release`, `announcement`, `deep-dive`, etc. They auto-populate the filter bar.
- **Images:** Place them in `docs/public/blog/` and reference as `/blog/my-image.png`.
- **Drafts:** Omit the file from git, or set `draft: true` in frontmatter (not filtered by default — you'd need to add filtering if desired).
- **Ordering:** Posts sort by `date` descending, then alphabetically by title. For same-day ordering, use full ISO timestamps: `date: 2026-03-20T14:00:00`.
- **Excerpts:** Add `<!-- more -->` in your post body. Content above it is used as the excerpt in feeds.
- **RSS/Atom:** Feeds are at `/feed.xml` and `/feed.atom`, auto-generated at build time.
