import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'yaml'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const blogDir = path.join(repoRoot, 'blog')
const outDir = path.join(repoRoot, 'public', 'og', 'blog')

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

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  return yaml.parse(m[1])
}

function pickTitleSize(title) {
  const len = title.length
  if (len <= 40) return 72
  if (len <= 80) return 56
  if (len <= 120) return 44
  return 36
}

function el(type, style, children) {
  return { type, props: { style, children } }
}

function img(src, width, height) {
  return { type: 'img', props: { src, width, height, style: { width, height } } }
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
      border: `1px solid rgba(0, 201, 167, 0.4)`,
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

function buildTree({ title, date, author, tags }) {
  const titleSize = pickTitleSize(title)
  const visibleTags = (Array.isArray(tags) ? tags : []).slice(0, 4)

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
    [
      // Top accent bar
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '1200px',
        height: '3px',
        background: BRAND.teal,
        opacity: 0.6,
      }),

      // Header: logo mark + "Cycles" wordmark
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
        },
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
      ),

      // Divider line under header (matches og.svg treatment)
      el('div', {
        marginTop: '24px',
        width: '100%',
        height: '1px',
        background: BRAND.divider,
      }),

      // Main: title + tag chips
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          maxWidth: '1072px',
        },
        [
          el('div', {
            width: '72px',
            height: '4px',
            background: BRAND.teal,
            marginBottom: '28px',
          }),
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
          visibleTags.length > 0
            ? el(
                'div',
                {
                  display: 'flex',
                  flexWrap: 'wrap',
                  marginTop: '28px',
                },
                visibleTags.map((t) => tagChip(`#${t}`)),
              )
            : el('div', { display: 'flex' }),
        ],
      ),

      // Footer row: date · author (left) and runcycles.io (right)
      el(
        'div',
        {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
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
    ],
  )
}

function formatDate(input) {
  if (!input) return 'Draft'
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return 'Draft'
  return d.toISOString().slice(0, 10)
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const files = fs
    .readdirSync(blogDir)
    .filter((f) => f.endsWith('.md') && f !== 'index.md' && f !== 'README.md')

  // The script body and template are sources of truth too — if the template
  // changed since a PNG was rendered, those PNGs need regeneration even when
  // their .md source hasn't changed. Tracking the script's own mtime catches that.
  const scriptMtime = fs.statSync(fileURLToPath(import.meta.url)).mtimeMs

  let generated = 0
  let skipped = 0
  const failures = []

  for (const file of files) {
    const slug = file.replace(/\.md$/, '')
    const srcPath = path.join(blogDir, file)
    const outPath = path.join(outDir, `${slug}.png`)

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
      failures.push({ slug, message: `frontmatter parse: ${e.message}` })
      continue
    }
    if (!fm || fm.blog !== true) continue

    const title = String(fm.title ?? slug)
    const author = String(fm.author ?? 'Cycles Team')
    const date = formatDate(fm.date)
    const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : []

    try {
      const svg = await satori(buildTree({ title, date, author, tags }), {
        width: 1200,
        height: 630,
        fonts,
      })
      const png = new Resvg(svg).render().asPng()
      fs.writeFileSync(outPath, png)
      generated++
      console.log(`  + ${slug}.png`)
    } catch (e) {
      failures.push({ slug, message: e.message })
    }
  }

  console.log(
    `\nOG images: ${generated} generated, ${skipped} skipped${
      failures.length ? `, ${failures.length} failed` : ''
    }.`,
  )
  if (failures.length) {
    for (const f of failures) console.error(`  ! ${f.slug}: ${f.message}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
