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

## File Naming

- Use lowercase kebab-case: `my-post-title.md`
- The filename becomes the URL slug: `/blog/my-post-title`
- Subdirectories are supported: `blog/2026/my-post.md` → `/blog/2026/my-post`

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
| Sorted newest-first         | Sorted by `date` frontmatter field                                  |
| Tag filtering works         | `BlogIndex.vue` reads `tags` from frontmatter                       |
| Date/author/tags header     | `BlogPost.vue` renders via `#doc-before` Layout slot                |
| SEO meta tags               | `transformPageData` in `config.ts` sets `og:type=article`, `og:title`, `og:description`, `article:published_time` |
| Canonical URL               | Auto-generated: `https://runcycles.io/blog/<slug>`                  |
| Sitemap entry               | Auto-included by VitePress sitemap generator                        |
| Search indexed              | VitePress local search indexes all blog content                     |

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
│   ├── config.ts                  # Nav link, sidebar config, OG meta logic
│   └── theme/
│       ├── BlogIndex.vue          # Post listing with tag filtering
│       ├── BlogPost.vue           # Date/author/tags header (guarded by frontmatter.blog)
│       ├── Layout.vue             # Injects BlogPost via #doc-before slot
│       ├── index.ts               # Registers BlogIndex + BlogPost globally
│       └── custom.css             # Blog styles (cards, tags, metadata)
```

---

## Tips

- **No config changes needed** to add a post. Just create the markdown file.
- **Tags are freeform.** Use whatever makes sense: `engineering`, `release`, `announcement`, `deep-dive`, etc. They auto-populate the filter bar.
- **Images:** Place them in `docs/public/blog/` and reference as `/blog/my-image.png`.
- **Drafts:** Omit the file from git, or set `draft: true` in frontmatter (not filtered by default — you'd need to add filtering if desired).
- **Ordering:** Posts sort by `date` descending. For same-day ordering, use full ISO timestamps: `date: 2026-03-20T14:00:00`.
