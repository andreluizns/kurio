// Executa a auditoria: 3 medições por página e perfil, mediana por categoria e métricas (LCP, CLS, TBT).
// Pré-requisito: build de produção servido (pnpm build && pnpm preview). Uso: pnpm lighthouse
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { createRequire } from 'node:module'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'
import { BASE_URL, CATEGORIES, PAGES, PROFILES, RUNS, TARGETS } from './config.mjs'

const require = createRequire(import.meta.url)
const OUT = new URL('./reports/', import.meta.url)
await mkdir(OUT, { recursive: true })

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
const results = []

for (const page of PAGES) {
  for (const [profile, config] of Object.entries(PROFILES)) {
    const runs = []
    for (let i = 1; i <= RUNS; i++) {
      // Navegador novo a cada medição: sem cache nem service worker de execuções anteriores.
      const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
      try {
        const result = await lighthouse(`${BASE_URL}${page.path}`, { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: CATEGORIES }, config)
        const [html, json] = result.report
        const base = `${page.name}-${profile}-${i}`
        await writeFile(new URL(`${base}.html`, OUT), html)
        await writeFile(new URL(`${base}.json`, OUT), json)
        const lhr = result.lhr
        runs.push({
          scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbt: lhr.audits['total-blocking-time'].numericValue,
          fcp: lhr.audits['first-contentful-paint'].numericValue,
        })
        console.log(`${base}:`, runs.at(-1).scores)
      } finally {
        await chrome.kill()
      }
    }
    results.push({
      page: page.name,
      path: page.path,
      profile,
      median: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
      lcp: median(runs.map((r) => r.lcp)),
      cls: median(runs.map((r) => r.cls)),
      tbt: median(runs.map((r) => r.tbt)),
      fcp: median(runs.map((r) => r.fcp)),
      runs,
    })
  }
}

const versions = {
  lighthouse: require('lighthouse/package.json').version,
  chromeLauncher: require('chrome-launcher/package.json').version,
  playwrightChromium: chromePath,
  node: process.version,
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: os.cpus()[0]?.model,
  date: new Date().toISOString(),
  baseUrl: BASE_URL,
  runsPerPageProfile: RUNS,
}

const lines = [
  '# Resultados Lighthouse (medianas de 3 execuções)',
  '',
  `Gerado em ${versions.date} — Lighthouse ${versions.lighthouse}, Node ${versions.node}, ${versions.os}, CPU ${versions.cpu}.`,
  `Build de produção servido por \`vite preview\` em ${BASE_URL}, mocks MSW ativos (cenário padrão).`,
  '',
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...results.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${(r.lcp / 1000).toFixed(2)} s | ${r.cls.toFixed(3)} | ${Math.round(r.tbt)} ms |`,
  ),
  '',
  `Metas: Performance ≥ ${TARGETS.performance}, Accessibility ≥ ${TARGETS.accessibility}, Best Practices ≥ ${TARGETS['best-practices']}, SEO ≥ ${TARGETS.seo}.`,
]
await writeFile(new URL('summary.md', OUT), lines.join('\n') + '\n')
await writeFile(new URL('summary.json', OUT), JSON.stringify({ versions, targets: TARGETS, results }, null, 2))
console.log(lines.join('\n'))

const below = results.flatMap((r) => CATEGORIES.filter((c) => r.median[c] < TARGETS[c]).map((c) => `${r.page}/${r.profile}/${c}=${r.median[c]}`))
if (below.length) console.log('\nAbaixo da meta:', below.join(', '))
