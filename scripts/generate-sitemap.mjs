import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(projectRoot, 'public')
const siteUrl = (process.env.VITE_SITE_URL || 'https://yuzhangci.com').replace(/\/+$/, '')

const languages = ['sc', 'tc']
const dialects = ['lac', 'ced']
const publicPages = [
  'dict/home',
  'dict/pinyin',
  'dict/about',
  'dict/tutorial',
  'ysw/home',
  'ysw/alphabet',
  'ysw/alphabet/tc-sc',
  'ysw/diary'
]

const escapeXml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const urls = []
for (const language of languages) {
  for (const dialect of dialects) {
    for (const page of publicPages) {
      urls.push(`${siteUrl}/${language}/${dialect}/${page}`)
    }
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`),
  '</urlset>',
  ''
].join('\n')

await mkdir(publicDir, { recursive: true })
await writeFile(path.join(publicDir, 'sitemap.xml'), xml, 'utf8')

console.log(`Generated sitemap.xml with ${urls.length} public URLs for ${siteUrl}`)
