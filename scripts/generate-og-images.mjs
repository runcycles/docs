import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import {
  TOP_LEVEL_DOCS,
  classify,
  parseFrontmatter,
  extractToolPreview,
  pickTitleSize,
  pickToolTitleSize,
  pickPreviewValueSize,
  truncate,
  formatDate,
} from './lib/og-helpers.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const ogRoot = path.join(repoRoot, 'public', 'og')

const force = process.argv.includes('--force')

const fontsBase = path.join(repoRoot, 'node_modules', '@fontsource')
const fontPaths = {
  inter400: path.join(fontsBase, 'inter/files/inter-latin-400-normal.woff'),
  inter700: path.join(fontsBase, 'inter/files/inter-latin-700-normal.woff'),
}
const logoPath = path.join(repoRoot, 'public', 'runcycles-logo.svg')

const fonts = [
  { name: 'Inter', weight: 400, style: 'normal', data: fs.readFileSync(fontPaths.inter400) },
  { name: 'Inter', weight: 700, style: 'normal', data: fs.readFileSync(fontPaths.inter700) },
]

// Brand palette — pulled from public/runcycles-og.svg and public/runcycles-logo.svg.
// Amber matches the calculator's in-app "biggest monthly radius" highlight
// (#d97706); used here for the tool-template pill so it reads against the
// teal value instead of blending in.
const BRAND = {
  bg: '#1B1B1F',
  divider: '#3C3C43',
  teal: '#00C9A7',
  amber: '#F59E0B',
  textPrimary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#636366',
}

const logoSvg = fs.readFileSync(logoPath, 'utf-8')
const logoDataUri =
  'data:image/svg+xml;base64,' + Buffer.from(logoSvg).toString('base64')

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

// Tool template — for calculator/demo pages where the OG image should preview
// the actual output, not just restate the title and meta-description.
//
// Layout: left column = eyebrow + title + one-line hook. Right column =
// preview card with optional pill (e.g. "×14"), big value (e.g. "$342K"),
// and a label (e.g. "monthly blast radius").
//
// Description is dropped on purpose — it's already rendered as og:description
// below the card by the social embed, so repeating it on the image is dead
// weight. The hook replaces it as something that converts on a glance.
function toolTree({ title, section, hook, preview }) {
  const titleSize = pickToolTitleSize(title)
  const valueSize = pickPreviewValueSize(preview.value)

  const leftChildren = []
  if (section) {
    leftChildren.push(
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
  leftChildren.push(tealAccentBar())
  leftChildren.push(
    el(
      'div',
      {
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: `${titleSize}px`,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        color: BRAND.textPrimary,
      },
      title,
    ),
  )
  if (hook) {
    leftChildren.push(
      el(
        'div',
        {
          marginTop: '24px',
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: '22px',
          lineHeight: 1.4,
          color: BRAND.textSecondary,
        },
        truncate(hook, 110),
      ),
    )
  }

  const cardChildren = []
  if (preview.pill) {
    cardChildren.push(
      el(
        'div',
        {
          display: 'flex',
          alignSelf: 'flex-end',
          alignItems: 'center',
          height: '40px',
          padding: '0 18px',
          borderRadius: '20px',
          background: 'rgba(245, 158, 11, 0.18)',
          border: '1px solid rgba(245, 158, 11, 0.55)',
          color: BRAND.amber,
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: '20px',
          letterSpacing: '0.01em',
          marginBottom: '12px',
        },
        preview.pill,
      ),
    )
  }
  cardChildren.push(
    el(
      'div',
      {
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: `${valueSize}px`,
        lineHeight: 1,
        letterSpacing: '-0.03em',
        color: BRAND.teal,
      },
      preview.value,
    ),
  )
  cardChildren.push(
    el(
      'div',
      {
        marginTop: '16px',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: '20px',
        lineHeight: 1.3,
        color: BRAND.textSecondary,
        maxWidth: '380px',
      },
      preview.label,
    ),
  )

  const previewCard = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '440px',
      padding: '36px 40px',
      borderRadius: '16px',
      background: 'rgba(0, 201, 167, 0.06)',
      border: '1px solid rgba(0, 201, 167, 0.25)',
    },
    cardChildren,
  )

  return frame([
    topAccentBar(),
    header(),
    divider(),
    el(
      'div',
      {
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        gap: '40px',
      },
      [
        el(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            width: '600px',
          },
          leftChildren,
        ),
        previewCard,
      ],
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
  // Sections excluded by classify() (api/operations, admin-api/operations) are still
  // walked but ignored at classification time — keeping the walk list flat avoids
  // the case where a new section directory ships and silently gets no OG images.
  const sources = []
  for (const f of TOP_LEVEL_DOCS) sources.push(f)
  for (const dir of [
    'blog',
    'how-to',
    'troubleshoot',
    'concepts',
    'quickstart',
    'calculators',
    'protocol',
    'configuration',
    'guides',
    'incidents',
    'why-cycles',
    'community',
    'demos',
    'docs',
    'admin-api',
    'api',
  ]) {
    walkMd(dir, sources)
  }

  // Cache-bust: regenerate when the generator script OR any rendering input
  // (logo SVG, font files) changes. Without this, swapping fonts or tweaking
  // the logo would leave existing PNGs stale until someone ran --force.
  const cacheBustMtime = Math.max(
    fs.statSync(fileURLToPath(import.meta.url)).mtimeMs,
    fs.statSync(logoPath).mtimeMs,
    fs.statSync(fontPaths.inter400).mtimeMs,
    fs.statSync(fontPaths.inter700).mtimeMs,
  )

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
      const newest = Math.max(srcStat.mtimeMs, cacheBustMtime)
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
      // Tool template is opt-in via frontmatter `og.preview`. Pages that omit
      // it fall back to docs — including index pages under calculators/ and
      // demos/, where there's no single output number to highlight.
      const preview = extractToolPreview(fm)
      if (preview) {
        tree = toolTree({
          title,
          section: cls.section,
          hook: preview.hook,
          preview,
        })
      } else {
        tree = docsTree({
          title,
          description: typeof fm.description === 'string' ? fm.description : '',
          section: cls.section,
        })
      }
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
