import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'yaml'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const ogRoot = path.join(repoRoot, 'public', 'og')

const force = process.argv.includes('--force')

const fontsBase = path.join(repoRoot, 'node_modules', '@fontsource')
const fonts = [
  {
    name: 'Inter',
    weight: 400,
    style: 'normal',
    data: fs.readFileSync(path.join(fontsBase, 'inter/files/inter-latin-400-normal.woff')),
  },
  {
    name: 'Inter',
    weight: 700,
    style: 'normal',
    data: fs.readFileSync(path.join(fontsBase, 'inter/files/inter-latin-700-normal.woff')),
  },
]

// Brand palette — pulled from public/runcycles-og.svg and public/runcycles-logo.svg.
const BRAND = {
  bg: '#1B1B1F',
  divider: '#3C3C43',
  teal: '#00C9A7',
  textPrimary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#636366',
}

const logoSvg = fs.readFileSync(path.join(repoRoot, 'public', 'runcycles-logo.svg'), 'utf-8')
const logoDataUri =
  'data:image/svg+xml;base64,' + Buffer.from(logoSvg).toString('base64')

// ── Page classification ───────────────────────────────────────────────────────
//
// Returns null for pages that should NOT get a generated OG image.
// Otherwise: { kind: 'blog' | 'docs', section?: string }
//
// The section label is rendered in the docs template (e.g. "How-to Guide").
// The blog template ignores section and uses date · author instead.

const TOP_LEVEL_DOCS = new Set([
  'why-cycles.md',
  'about.md',
  'glossary.md',
  'design-partners.md',
  'security.md',
  'contact.md',
  'changelog.md',
])

function classify(rel) {
  if (rel.endsWith('-embed.md')) return null // iframe targets — canonicalized away
  if (rel.startsWith('blog/')) return { kind: 'blog' }
  if (rel.startsWith('how-to/')) return { kind: 'docs', section: 'How-to Guide' }
  if (rel.startsWith('troubleshoot/')) return { kind: 'docs', section: 'Troubleshooting' }
  if (rel.startsWith('concepts/cycles-vs-')) return { kind: 'docs', section: 'Comparison' }
  if (rel.startsWith('concepts/')) return { kind: 'docs', section: 'Concepts' }
  if (rel.startsWith('quickstart/')) return { kind: 'docs', section: 'Quickstart' }
  if (rel.startsWith('calculators/')) return { kind: 'docs', section: 'Calculator' }
  if (TOP_LEVEL_DOCS.has(rel)) return { kind: 'docs', section: null }
  return null
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  return yaml.parse(m[1])
}

function pickTitleSize(title, hasDescription) {
  const len = title.length
  if (hasDescription) {
    if (len <= 40) return 60
    if (len <= 80) return 48
    if (len <= 120) return 40
    return 34
  }
  if (len <= 40) return 72
  if (len <= 80) return 56
  if (len <= 120) return 44
  return 36
}

function truncate(s, max) {
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

function el(type, style, children) {
  return { type, props: { style, children } }
}

function img(src, width, height) {
  return { type: 'img', props: { src, width, height, style: { width, height } } }
}

function header() {
  return el(
    'div',
    { display: 'flex', alignItems: 'center', gap: '18px' },
    [
      img(logoDataUri, 64, 64),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: '44px',
          letterSpacing: '-0.02em',
          color: BRAND.textPrimary,
        },
        'Cycles',
      ),
    ],
  )
}

function divider() {
  return el('div', {
    marginTop: '24px',
    width: '100%',
    height: '1px',
    background: BRAND.divider,
  })
}

function topAccentBar() {
  return el('div', {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '1200px',
    height: '3px',
    background: BRAND.teal,
    opacity: 0.6,
  })
}

function tealAccentBar() {
  return el('div', {
    width: '72px',
    height: '4px',
    background: BRAND.teal,
    marginBottom: '28px',
  })
}

function frame(children) {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '1200px',
      height: '630px',
      background: BRAND.bg,
      padding: '56px 64px',
      fontFamily: 'Inter',
      color: BRAND.textPrimary,
      position: 'relative',
    },
    children,
  )
}

function tagChip(label) {
  return el(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      height: '36px',
      padding: '0 18px',
      borderRadius: '18px',
      background: 'rgba(0, 201, 167, 0.12)',
      border: '1px solid rgba(0, 201, 167, 0.4)',
      color: BRAND.teal,
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: '15px',
      letterSpacing: '0.01em',
      marginRight: '12px',
    },
    label,
  )
}

function blogTree({ title, date, author, tags }) {
  const titleSize = pickTitleSize(title, false)
  const visibleTags = (Array.isArray(tags) ? tags : []).slice(0, 4)

  const titleBlockChildren = [
    tealAccentBar(),
    el(
      'div',
      {
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: `${titleSize}px`,
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
        color: BRAND.textPrimary,
      },
      title,
    ),
  ]
  if (visibleTags.length > 0) {
    titleBlockChildren.push(
      el(
        'div',
        { display: 'flex', flexWrap: 'wrap', marginTop: '28px' },
        visibleTags.map((t) => tagChip(`#${t}`)),
      ),
    )
  }

  return frame([
    topAccentBar(),
    header(),
    divider(),
    el(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'center',
        maxWidth: '1072px',
      },
      titleBlockChildren,
    ),
    el(
      'div',
      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      [
        el(
          'div',
          {
            display: 'flex',
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSize: '22px',
            color: BRAND.textSecondary,
          },
          `${date}  ·  ${author}`,
        ),
        el(
          'div',
          {
            display: 'flex',
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSize: '22px',
            color: BRAND.textMuted,
          },
          'runcycles.io',
        ),
      ],
    ),
  ])
}

function docsTree({ title, description, section }) {
  const desc = truncate(description, 160)
  const titleSize = pickTitleSize(title, !!desc)

  const bodyChildren = []
  if (section) {
    bodyChildren.push(
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: '16px',
          letterSpacing: '0.18em',
          color: BRAND.teal,
          textTransform: 'uppercase',
          marginBottom: '20px',
        },
        section.toUpperCase(),
      ),
    )
  }
  bodyChildren.push(tealAccentBar())
  bodyChildren.push(
    el(
      'div',
      {
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: `${titleSize}px`,
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
        color: BRAND.textPrimary,
      },
      title,
    ),
  )
  if (desc) {
    bodyChildren.push(
      el(
        'div',
        {
          marginTop: '20px',
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: '24px',
          lineHeight: 1.4,
          color: BRAND.textSecondary,
          maxHeight: '70px',
          overflow: 'hidden',
        },
        desc,
      ),
    )
  }

  return frame([
    topAccentBar(),
    header(),
    divider(),
    el(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'center',
        maxWidth: '1072px',
      },
      bodyChildren,
    ),
    el(
      'div',
      { display: 'flex', justifyContent: 'flex-end', alignItems: 'center' },
      [
        el(
          'div',
          {
            display: 'flex',
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSize: '22px',
            color: BRAND.textMuted,
          },
          'runcycles.io',
        ),
      ],
    ),
  ])
}

function formatDate(input) {
  if (!input) return 'Draft'
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return 'Draft'
  return d.toISOString().slice(0, 10)
}

// Walk a directory recursively, returning .md file paths relative to repoRoot.
function walkMd(rel, out = []) {
  const abs = path.join(repoRoot, rel)
  if (!fs.existsSync(abs)) return out
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const childRel = path.posix.join(rel, entry.name)
    if (entry.isDirectory()) {
      walkMd(childRel, out)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(childRel)
    }
  }
  return out
}

async function main() {
  // Sources: top-level allowlisted files + recursive walks of section directories.
  const sources = []
  for (const f of TOP_LEVEL_DOCS) sources.push(f)
  for (const dir of ['blog', 'how-to', 'troubleshoot', 'concepts', 'quickstart', 'calculators']) {
    walkMd(dir, sources)
  }

  // Cache-bust: regenerate when the generator script itself changes.
  const scriptMtime = fs.statSync(fileURLToPath(import.meta.url)).mtimeMs

  let generated = 0
  let skipped = 0
  let unclassified = 0
  const failures = []

  for (const rel of sources) {
    const cls = classify(rel)
    if (!cls) {
      unclassified++
      continue
    }

    const stem = rel.replace(/\.md$/, '')
    const srcPath = path.join(repoRoot, rel)
    const outPath = path.join(ogRoot, `${stem}.png`)

    const srcStat = fs.statSync(srcPath)
    if (!force && fs.existsSync(outPath)) {
      const outStat = fs.statSync(outPath)
      const newest = Math.max(srcStat.mtimeMs, scriptMtime)
      if (outStat.mtimeMs >= newest) {
        skipped++
        continue
      }
    }

    const raw = fs.readFileSync(srcPath, 'utf-8')
    let fm
    try {
      fm = parseFrontmatter(raw)
    } catch (e) {
      failures.push({ rel, message: `frontmatter parse: ${e.message}` })
      continue
    }
    if (!fm) continue

    // Skip the homepage (layout: home with hand-crafted og image)
    if (fm.layout === 'home') continue

    // Blog requires explicit blog: true frontmatter (matches posts.data.ts and rss.ts)
    if (cls.kind === 'blog' && fm.blog !== true) continue

    if (!fm.title) continue // can't render without a title

    const title = String(fm.title)

    let tree
    if (cls.kind === 'blog') {
      tree = blogTree({
        title,
        date: formatDate(fm.date),
        author: String(fm.author ?? 'Cycles Team'),
        tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
      })
    } else {
      tree = docsTree({
        title,
        description: typeof fm.description === 'string' ? fm.description : '',
        section: cls.section,
      })
    }

    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      const svg = await satori(tree, { width: 1200, height: 630, fonts })
      const png = new Resvg(svg).render().asPng()
      fs.writeFileSync(outPath, png)
      generated++
      console.log(`  + ${stem}.png`)
    } catch (e) {
      failures.push({ rel, message: e.message })
    }
  }

  console.log(
    `\nOG images: ${generated} generated, ${skipped} skipped, ${unclassified} ignored${
      failures.length ? `, ${failures.length} failed` : ''
    }.`,
  )
  if (failures.length) {
    for (const f of failures) console.error(`  ! ${f.rel}: ${f.message}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
