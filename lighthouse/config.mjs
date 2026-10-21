// Configuração versionada da auditoria Lighthouse (ver lighthouse/README.md).
export const BASE_URL = process.env.LH_BASE_URL ?? 'http://localhost:4173'
export const RUNS = Number(process.env.LH_RUNS ?? 3)

export const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/nft-emerald-ape-042' },
]

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

/** Perfis: mobile usa o padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop usa o preset oficial. */
export const PROFILES = {
  mobile: { extends: 'lighthouse:default', settings: { formFactor: 'mobile', throttlingMethod: 'simulate' } },
  desktop: {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'desktop',
      throttlingMethod: 'simulate',
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  },
}
