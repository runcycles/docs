#!/usr/bin/env node
/**
 * Generate branded PDFs from published blog posts.
 *
 * Finds all posts with `pdf: true` in frontmatter (or `featured: true`),
 * renders each via Puppeteer against the built site, and writes branded
 * PDFs to .vitepress/dist/pdfs/<slug>.pdf.
 *
 * Runs AFTER vitepress build (expects .vitepress/dist to exist).
 *
 * Usage: node scripts/generate-pdfs.js
 */

import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { parse as parseYAML } from 'yaml'
import puppeteer from 'puppeteer'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BLOG_DIR = join(ROOT, 'blog')
const DIST_DIR = join(ROOT, '.vitepress', 'dist')
const PDF_OUTPUT_DIR = join(DIST_DIR, 'pdfs')
const PORT = 4323

function extractFrontmatter(content) {
  // Handle both LF and CRLF line endings
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  try {
    return parseYAML(match[1])
  } catch {
    return null
  }
}

function findPdfEligiblePosts() {
  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md') && f !== 'index.md')
  const eligible = []

  for (const file of files) {
    const content = readFileSync(join(BLOG_DIR, file), 'utf-8')
    const fm = extractFrontmatter(content)
    if (!fm) continue

    // Include posts with explicit pdf: true OR featured: true
    if (fm.pdf === true || fm.featured === true) {
      eligible.push({
        slug: file.replace(/\.md$/, ''),
        title: fm.title,
        author: fm.author || 'Cycles Team',
        date: fm.date,
        description: fm.description
      })
    }
  }

  return eligible
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const serve = serveStatic(DIST_DIR, { index: ['index.html'] })
    const server = createServer((req, res) => {
      serve(req, res, finalhandler(req, res))
    })
    server.listen(PORT, '127.0.0.1', (err) => {
      if (err) return reject(err)
      resolve(server)
    })
  })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })
}

function buildHeaderTemplate(post) {
  return `
    <div style="font-size:9px; width:100%; padding:0 12mm; color:#888; display:flex; justify-content:space-between;">
      <span>${post.title.replace(/"/g, '&quot;')}</span>
      <span>runcycles.io</span>
    </div>
  `
}

function buildFooterTemplate() {
  return `
    <div style="font-size:9px; width:100%; padding:0 12mm; color:#888; display:flex; justify-content:space-between;">
      <span>&copy; Cycles — runcycles.io</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  `
}

async function renderPdf(browser, post) {
  const page = await browser.newPage()
  const url = `http://127.0.0.1:${PORT}/blog/${post.slug}.html`

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })

  // Inject print-specific CSS overrides
  await page.addStyleTag({
    content: `
      @media print {
        /* Hide nav, sidebar, footer, feedback components */
        .VPNav, .VPSidebar, .VPDocAsideSponsors, .VPDocFooter,
        .page-feedback, .blog-post-nav, nav, footer { display: none !important; }

        /* Reset layout for print */
        .VPContent, .VPDoc, .VPDocAside { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
        .content-container, .content { max-width: 100% !important; padding: 0 !important; }

        /* Typography */
        body { font-size: 10.5pt; line-height: 1.55; color: #222; }
        h1 { font-size: 22pt; page-break-after: avoid; margin-top: 0; }
        h2 { font-size: 15pt; page-break-after: avoid; page-break-before: always; margin-top: 0; padding-top: 0; }
        h2:first-of-type { page-break-before: auto; }
        h3 { font-size: 12pt; page-break-after: avoid; }
        h4, h5 { page-break-after: avoid; }
        p, li { orphans: 3; widows: 3; }

        /* Tables */
        table { page-break-inside: avoid; width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th, td { padding: 6px 8px; border: 1px solid #ddd; font-size: 9.5pt; }
        th { background: #f5f5f5; }

        /* Code blocks */
        pre, code { page-break-inside: avoid; font-size: 9pt; }
        pre { padding: 10px; border: 1px solid #e0e0e0; background: #fafafa; }

        /* Links - keep color but add URL in print */
        a { color: #2563eb; text-decoration: none; }
        a[href^="http"]:after { content: " (" attr(href) ")"; font-size: 8pt; color: #888; word-break: break-all; }
        a[href^="/"]:after { content: ""; }

        /* Blockquotes */
        blockquote { page-break-inside: avoid; border-left: 3px solid #2563eb; padding-left: 12px; color: #555; }

        /* Images */
        img { max-width: 100%; page-break-inside: avoid; }
      }
    `
  })

  // Wait briefly for any lazy content
  await new Promise(r => setTimeout(r, 500))

  const outputPath = join(PDF_OUTPUT_DIR, `${post.slug}.pdf`)
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: buildHeaderTemplate(post),
    footerTemplate: buildFooterTemplate(),
    margin: { top: '22mm', bottom: '22mm', left: '18mm', right: '18mm' }
  })

  await page.close()
  return outputPath
}

async function main() {
  if (!existsSync(DIST_DIR)) {
    console.error(`✗ Build output not found at ${DIST_DIR}. Run 'npm run build' first.`)
    process.exit(1)
  }

  mkdirSync(PDF_OUTPUT_DIR, { recursive: true })

  const posts = findPdfEligiblePosts()
  if (posts.length === 0) {
    console.log('No PDF-eligible posts found (need pdf:true or featured:true).')
    return
  }

  console.log(`Found ${posts.length} PDF-eligible post(s):`)
  posts.forEach(p => console.log(`  - ${p.slug}`))

  console.log('\nStarting static server...')
  const server = await startStaticServer()

  console.log('Launching Puppeteer...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    for (const post of posts) {
      process.stdout.write(`  rendering ${post.slug}... `)
      try {
        const outPath = await renderPdf(browser, post)
        console.log(`✓ ${basename(outPath)}`)
      } catch (err) {
        console.log(`✗ failed: ${err.message}`)
      }
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`\n✓ PDFs written to ${PDF_OUTPUT_DIR}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
